/* Restricted JavaScript parser for Code Quest.
   It accepts only syntax representable by the bounded Code Quest AST. This is
   deliberately NOT a JavaScript evaluator and never runs source text. */

import {
  action, targetNode, repeat, ifNode, call, letNode, returnNode, forOfNode, onNode, signalNode, stateNode,
  literal, variableRef, propertyRef, memberRef, sensor, binary, unaryNot,
  normalizeProgram, normalizeFunctions, functionDescriptor, AST_LIMITS, PROPERTY_PATHS, COLLECTION_FIELDS, EVENTS, SIGNALS, ACTOR_STATES
} from './ast.js';

const MAX_SOURCE = 16000;
const MAX_TOKENS = 3200;
const MAX_FUNCTIONS = AST_LIMITS.MAX_FUNCTIONS;

const ACTION_METHODS = Object.freeze({
  move:'move', turnLeft:'turnLeft', turnRight:'turnRight', attack:'attack', heavyAttack:'heavyAttack',
  guard:'guard', open:'open', disarm:'disarm', interact:'interact', smash:'smash', push:'push', take:'take', throw:'throw', usePotion:'usePotion', useAntidote:'useAntidote',
  useWard:'useWard', wait:'wait', targetNearest:'targetNearest', targetWeakest:'targetWeakest',
  targetArmored:'targetArmored', targetElementWeak:'targetElementWeak', cast:'cast'
});
const CONDITION_METHODS = Object.freeze({
  seesEnemyAhead:'enemyAhead', seesArmoredEnemyAhead:'enemyArmoredAhead', seesWeakEnemyAhead:'enemyWeakAhead',
  seesIncomingDanger:'dangerIncoming', isPoisoned:'heroPoisoned', seesChestAhead:'chestAhead',
  seesDoorAhead:'doorAhead', seesTrapAhead:'trapAhead', isBlockedAhead:'blockedAhead', isOnExit:'onExit',
  seesMultipleEnemies:'multipleEnemies', isTargetInRange:'targetInRange', isTargetWeak:'targetWeak',
  isTargetArmored:'targetArmored', isTargetElementWeak:'targetElementWeak',
  seesLeverAhead:'leverAhead', seesBreakableAhead:'breakableAhead', seesNpcAhead:'npcAhead', seesRuneGateAhead:'runeGateAhead',
  seesPushableAhead:'pushableAhead', seesCycleTrapAhead:'cycleTrapAhead', seesActiveCycleTrapAhead:'cycleTrapActiveAhead',
  seesPlatformAhead:'platformAhead', isOnPlatform:'onPlatform', seesQuestTokenAhead:'questTokenAhead', isCompanionNear:'companionNear',
  seesCarryableAhead:'carryableAhead', isCarrying:'heroCarrying', isOnPlate:'heroOnPlate'
});
const COMPANION_ACTION_METHODS = Object.freeze({ follow:'companionFollow', hold:'companionHold', guard:'companionGuard', assist:'companionAssist', move:'companionMove', turnLeft:'companionTurnLeft', turnRight:'companionTurnRight', interact:'companionInteract', push:'companionPush', take:'companionTake', throw:'companionThrow' });
const COMPANION_CONDITION_METHODS = Object.freeze({ seesCarryableAhead:'companionCarryableAhead', isCarrying:'companionCarrying', isOnPlate:'companionOnPlate' });
const RESERVED = new Set(['function','if','else','repeat','on','hero','companion','enemy','enemies','return','while','for','of','const','let','var','true','false','null','new','this','class','switch','try','catch','async','await']);
const FUNCTION_NAME = /^[A-Za-z][A-Za-z0-9_]{0,23}$/;

export class CodeQuestParseError extends Error {
  constructor(message, token, source) {
    super(message); this.name = 'CodeQuestParseError';
    this.line = token && token.line || 1; this.column = token && token.column || 1;
    this.offset = token && Number.isFinite(token.start) ? token.start : 0;
    this.length = token && Number.isFinite(token.end) ? Math.max(1, token.end - token.start) : 1;
    this.source = source;
  }
}

function tokenize(source) {
  const input = String(source == null ? '' : source);
  if (input.length > MAX_SOURCE) throw new CodeQuestParseError('Program is too long for Code Quest.', { line:1, column:1, start:0, end:1 }, input);
  const tokens = []; let i = 0, line = 1, column = 1;
  const push = (type, value, start, end, tokenLine, tokenColumn) => {
    if (tokens.length >= MAX_TOKENS) throw new CodeQuestParseError('Program has too many tokens.', { line:tokenLine, column:tokenColumn, start, end }, input);
    tokens.push({ type, value, start, end, line:tokenLine, column:tokenColumn });
  };
  const advance = () => { const ch = input[i++]; if (ch === '\n') { line++; column = 1; } else column++; return ch; };
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { advance(); continue; }
    if (ch === '/' && input[i + 1] === '/') { advance(); advance(); while (i < input.length && input[i] !== '\n') advance(); continue; }
    if (ch === '/' && input[i + 1] === '*') {
      const start=i, tokenLine=line, tokenColumn=column; advance(); advance(); let closed=false;
      while (i < input.length) { if (input[i] === '*' && input[i+1] === '/') { advance(); advance(); closed=true; break; } advance(); }
      if (!closed) throw new CodeQuestParseError('Unclosed block comment.', { line:tokenLine, column:tokenColumn, start, end:i }, input);
      continue;
    }
    const start=i, tokenLine=line, tokenColumn=column;
    const three=input.slice(i,i+3), two=input.slice(i,i+2);
    if (three === '===' || three === '!==') { advance(); advance(); advance(); push('symbol',three,start,i,tokenLine,tokenColumn); continue; }
    if (['=>','<=','>=','&&','||'].includes(two)) { advance(); advance(); push('symbol',two,start,i,tokenLine,tokenColumn); continue; }
    if ('(){}[];,.><\/=+-*!'.includes(ch)) { advance(); push('symbol',ch,start,i,tokenLine,tokenColumn); continue; }
    if (ch === '"' || ch === "'") {
      const quote=advance(); let value='', closed=false;
      while (i < input.length) {
        const c=advance();
        if (c === quote) { closed=true; break; }
        if (c === '\\') {
          if (i >= input.length) break;
          const escaped=advance();
          if (escaped === 'n') value += '\n'; else if (escaped === 't') value += '\t'; else if (escaped === quote || escaped === '\\') value += escaped;
          else throw new CodeQuestParseError('Only simple string escapes are allowed.', { line:tokenLine, column:tokenColumn, start, end:i }, input);
        } else value += c;
        if (value.length > 32) throw new CodeQuestParseError('Strings are limited to 32 characters.', { line:tokenLine, column:tokenColumn, start, end:i }, input);
      }
      if (!closed) throw new CodeQuestParseError('Unclosed string.', { line:tokenLine, column:tokenColumn, start, end:i }, input);
      push('string',value,start,i,tokenLine,tokenColumn); continue;
    }
    if (/[0-9]/.test(ch)) {
      let value=''; while (i < input.length && /[0-9]/.test(input[i])) value += advance();
      push('number',value,start,i,tokenLine,tokenColumn); continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let value=''; while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) value += advance();
      push('identifier',value,start,i,tokenLine,tokenColumn); continue;
    }
    throw new CodeQuestParseError('This symbol is not part of the Code Quest coding language: ' + ch, { line:tokenLine, column:tokenColumn, start, end:start+1 }, input);
  }
  tokens.push({ type:'eof', value:'<eof>', start:i, end:i, line, column });
  return tokens;
}

class Parser {
  constructor(source) {
    this.source=String(source==null?'':source); this.tokens=tokenize(this.source); this.i=0; this.depth=0; this.functionDepth=0;
    this.functions={}; this.calls=[]; this.iterators=[];
  }
  current(){ return this.tokens[this.i]; }
  peek(n=1){ return this.tokens[Math.min(this.tokens.length-1,this.i+n)]; }
  is(value){ return this.current().value===value; }
  eat(value){ if(this.is(value)){const t=this.current();this.i++;return t;}return null; }
  expect(value,message){const t=this.eat(value);if(!t)this.fail(message||('Expected “'+value+'”.'));return t;}
  expectIdentifier(message){const t=this.current();if(t.type!=='identifier')this.fail(message||'Expected a name.');this.i++;return t;}
  fail(message,token=this.current()){throw new CodeQuestParseError(message,token,this.source);}
  enter(){this.depth++;if(this.depth>AST_LIMITS.MAX_DEPTH)this.fail('This program is nested too deeply. Try a smaller function or loop.');}
  leave(){this.depth=Math.max(0,this.depth-1);}

  parse(){
    const main=[];
    while(this.current().type!=='eof'){ if(this.is('function')) this.parseFunction(); else main.push(this.parseStatement()); }
    const safeFunctions=normalizeFunctions(this.functions);
    for(const entry of this.calls){
      if(!Object.hasOwn(safeFunctions,entry.name)) this.fail('Function “'+entry.name+'” is called but never defined.',entry.token);
      const desc=functionDescriptor(safeFunctions[entry.name]);
      if(desc.params.length!==entry.argc) this.fail('Function “'+entry.name+'” expects '+desc.params.length+' argument'+(desc.params.length===1?'':'s')+', but got '+entry.argc+'.',entry.token);
    }
    return { program:normalizeProgram(main), functions:safeFunctions };
  }

  parseFunction(){
    const start=this.expect('function');
    if(Object.keys(this.functions).length>=MAX_FUNCTIONS)this.fail('Code Quest allows at most '+MAX_FUNCTIONS+' functions in one program.',start);
    const nameToken=this.expectIdentifier('Give this function a short name, for example strike.'); const fn=nameToken.value;
    if(!FUNCTION_NAME.test(fn)||RESERVED.has(fn))this.fail('That function name is reserved or invalid. Use letters/numbers, for example strike.',nameToken);
    if(Object.hasOwn(this.functions,fn))this.fail('Function “'+fn+'” is defined twice.',nameToken);
    this.expect('('); const params=[];
    if(!this.is(')')){
      while(true){
        const p=this.expectIdentifier('Function parameters need a name.');
        if(RESERVED.has(p.value)||!FUNCTION_NAME.test(p.value))this.fail('Invalid parameter name.',p);
        if(params.includes(p.value))this.fail('Parameter “'+p.value+'” is listed twice.',p);
        params.push(p.value); if(params.length>AST_LIMITS.MAX_PARAMS)this.fail('Code Quest functions allow at most '+AST_LIMITS.MAX_PARAMS+' parameters.',p);
        if(!this.eat(','))break;
      }
    }
    this.expect(')'); this.functionDepth++; const body=this.parseBlock(); this.functionDepth--;
    this.functions[fn]=params.length?{params,body}:body;
  }
  parseBlock(){
    this.expect('{','Expected “{” to start this block.'); this.enter(); const body=[];
    while(!this.is('}')){ if(this.current().type==='eof')this.fail('This block is missing its closing “}”.'); if(this.is('function'))this.fail('Define functions at the top level, not inside another block.'); body.push(this.parseStatement()); }
    this.expect('}'); this.leave(); return body;
  }
  parseStatement(){
    if(this.is('if'))return this.parseIf();
    if(this.is('repeat'))return this.parseRepeat();
    if(this.is('for'))return this.parseForOf();
    if(this.is('let'))return this.parseLet();
    if(this.is('return'))return this.parseReturn();
    if(this.is('on'))return this.parseOn();
    if(this.is('hero'))return this.parseHeroAction();
    if(this.is('companion'))return this.parseCompanionAction();
    if(this.current().type==='identifier')return this.parseFunctionCall();
    this.fail('Expected a hero/companion action, let, IF, repeat, for...of, on(...), return, or function call.');
  }
  parseHeroAction(){
    this.expect('hero');this.expect('.','Use a method such as hero.move().');const method=this.expectIdentifier('Choose a hero method such as move or attack.');
    if(method.value==='target'){
      this.expect('(','Choose an enemy index or an enemy loop item with hero.target(...).');
      const index=this.parseExpression();
      this.expect(')','Close hero.target(index) with “)”.');this.eat(';');return targetNode(index);
    }
    if(method.value==='signal'){
      this.expect('(','Use hero.signal(\"ready\").'); const channel=this.current();
      if(channel.type!=='string'||!SIGNALS.includes(channel.value))this.fail('Choose a bounded signal: '+SIGNALS.join(', ')+'.',channel); this.i++;
      this.expect(')','Close hero.signal(channel) with “)”.');this.eat(';');return signalNode('hero',channel.value);
    }
    if(method.value==='state'&&this.eat('=')){
      const value=this.current(); if(value.type!=='string'||!ACTOR_STATES.includes(value.value))this.fail('Choose a bounded hero state: '+ACTOR_STATES.join(', ')+'.',value); this.i++; this.eat(';'); return stateNode('hero',value.value);
    }
    const op=ACTION_METHODS[method.value];
    if(!op)this.fail('“hero.'+method.value+'()” is not an available Code Quest action.',method);
    this.expect('(','Call this hero method with ().');this.expect(')','This Code Quest hero action does not take arguments.');this.eat(';');return action(op);
  }
  parseCompanionAction(){
    this.expect('companion');this.expect('.','Use a companion method such as companion.follow().');const method=this.expectIdentifier('Choose a safe companion action such as move, hold, guard, or assist.');
    if(method.value==='signal'){
      this.expect('(','Use companion.signal(\"ready\").'); const channel=this.current();
      if(channel.type!=='string'||!SIGNALS.includes(channel.value))this.fail('Choose a bounded signal: '+SIGNALS.join(', ')+'.',channel); this.i++;
      this.expect(')','Close companion.signal(channel) with “)”.');this.eat(';');return signalNode('companion',channel.value);
    }
    if(method.value==='state'&&this.eat('=')){
      const value=this.current(); if(value.type!=='string'||!ACTOR_STATES.includes(value.value))this.fail('Choose a bounded companion state: '+ACTOR_STATES.join(', ')+'.',value); this.i++; this.eat(';'); return stateNode('companion',value.value);
    }
    const op=COMPANION_ACTION_METHODS[method.value];
    if(!op)this.fail('“companion.'+method.value+'()” is not an available Code Quest companion action.',method);
    this.expect('(','Call this companion method with ().');this.expect(')','Companion commands do not take arguments.');this.eat(';');return action(op);
  }

  parseOn(){
    const token=this.expect('on');
    if(this.depth>0||this.functionDepth>0)this.fail('Event handlers must be registered at the top level of the turn program.',token);
    this.expect('(','Use on("danger", react);');
    const event=this.current(); if(event.type!=='string'||!EVENTS.includes(event.value))this.fail('Choose a bounded Code Quest event: '+EVENTS.join(', ')+'.',event); this.i++;
    this.expect(',','Add the callback function name after the event.');
    const handler=this.expectIdentifier('Choose a zero-argument function to run for this event.');
    if(RESERVED.has(handler.value)||!FUNCTION_NAME.test(handler.value))this.fail('That callback function name is invalid.',handler);
    this.expect(')','Close on(event, callback) with “)”.');this.eat(';');
    this.calls.push({name:handler.value,argc:0,token:handler,handler:true});
    return onNode(event.value,handler.value);
  }

  parseArgList(){
    const args=[]; this.expect('(');
    if(!this.is(')')){ while(true){args.push(this.parseExpression());if(args.length>AST_LIMITS.MAX_ARGS)this.fail('Code Quest function calls allow at most '+AST_LIMITS.MAX_ARGS+' arguments.');if(!this.eat(','))break;} }
    this.expect(')'); return args;
  }
  parseFunctionCall(assign){
    const token=this.expectIdentifier();if(!FUNCTION_NAME.test(token.value)||RESERVED.has(token.value))this.fail('That is not a callable Code Quest function name.',token);
    const args=this.parseArgList();this.eat(';');this.calls.push({name:token.value,argc:args.length,token});return call(token.value,undefined,args,assign);
  }
  parseLet(){
    const start=this.expect('let'); const variable=this.expectIdentifier('Give this variable a name, for example steps.');
    if(RESERVED.has(variable.value)||!FUNCTION_NAME.test(variable.value))this.fail('That variable name is reserved or invalid.',variable);
    this.expect('=','Initialize variables with =.');
    if(this.current().type==='identifier'&&!RESERVED.has(this.current().value)&&this.peek().value==='(') return this.parseFunctionCall(variable.value);
    const value=this.parseExpression();this.eat(';');return letNode(variable.value,value,start && undefined);
  }
  parseReturn(){
    const token=this.expect('return');if(this.functionDepth<=0)this.fail('return can only be used inside a function.',token);
    const value=this.parseExpression();this.eat(';');return returnNode(value);
  }
  parseRepeat(){
    const token=this.expect('repeat');this.expect('(','Use repeat(count, () => { ... }).');const times=this.parseExpression();if(times.type==='literal'&&typeof times.value==='number'&&(!Number.isInteger(times.value)||times.value<1||times.value>AST_LIMITS.MAX_REPEAT))this.fail('Repeat must be from 1 to '+AST_LIMITS.MAX_REPEAT+'.',token);this.expect(',','Add a comma after the repeat count.');
    this.expect('(','Use an arrow function: () => { ... }.');this.expect(')','Use an empty arrow function: () => { ... }.');this.expect('=>','Repeat uses an arrow: () => { ... }.');const body=this.parseBlock();this.expect(')','Close repeat with “)”.');this.eat(';');
    if(!body.length)this.fail('Repeat needs at least one action inside it.',token);return repeat(times,body);
  }

  parseForOf(){
    const token=this.expect('for');this.expect('(','Use for (const foe of enemies) { ... }.');this.expect('const','Code Quest collection loops use const.');
    const iterator=this.expectIdentifier('Give this enemy item a name, for example foe.');
    if(RESERVED.has(iterator.value)||!FUNCTION_NAME.test(iterator.value))this.fail('That loop item name is reserved or invalid.',iterator);
    this.expect('of','Use “of” to iterate the active enemies collection.');this.expect('enemies','Code Quest for...of loops can only iterate enemies.');this.expect(')','Close the for...of header with “)”.');
    if(this.iterators.includes(iterator.value))this.fail('That loop item name is already active.',iterator);
    this.iterators.push(iterator.value);const body=this.parseBlock();this.iterators.pop();
    if(!body.length)this.fail('for...of needs at least one action inside it.',token);
    return forOfNode(iterator.value,body);
  }

  parseIf(){
    const token=this.expect('if');this.expect('(','IF conditions go inside parentheses.');const test=this.parseExpression();this.expect(')','Close the IF condition with “)”.');const thenBody=this.parseBlock();let elseBody=[];if(this.eat('else'))elseBody=this.parseBlock();
    if(!thenBody.length&&!elseBody.length)this.fail('IF needs at least one action in THEN or ELSE.',token);return ifNode(test,thenBody,elseBody);
  }

  parseExpression(){return this.parseOr();}
  parseOr(){let left=this.parseAnd();while(this.eat('||'))left=binary('||',left,this.parseAnd());return left;}
  parseAnd(){let left=this.parseCompare();while(this.eat('&&'))left=binary('&&',left,this.parseCompare());return left;}
  parseCompare(){let left=this.parseAdd();while(['<','<=','>','>=','===','!=='].includes(this.current().value)){const op=this.current().value;this.i++;left=binary(op,left,this.parseAdd());}return left;}
  parseAdd(){let left=this.parseMultiply();while(this.is('+')||this.is('-')){const op=this.current().value;this.i++;left=binary(op,left,this.parseMultiply());}return left;}
  parseMultiply(){let left=this.parseUnary();while(this.is('*')||this.is('/')){const op=this.current().value;this.i++;left=binary(op,left,this.parseUnary());}return left;}
  parseUnary(){if(this.eat('!'))return unaryNot(this.parseUnary());return this.parsePrimary();}
  parsePrimary(){
    const token=this.current();
    if(this.eat('(')){const value=this.parseExpression();this.expect(')','Close this expression with “)”.');return value;}
    if(token.type==='number'){this.i++;return literal(Number(token.value));}
    if(token.type==='string'){this.i++;return literal(token.value);}
    if(token.value==='true'){this.i++;return literal(true);} if(token.value==='false'){this.i++;return literal(false);} if(token.value==='null'){this.i++;return literal(null);}
    if(token.value==='hero'||token.value==='companion'||token.value==='enemy'||token.value==='enemies')return this.parsePropertyOrSensor();
    if(token.type==='identifier'){
      if(RESERVED.has(token.value))this.fail('That keyword cannot be used as a value.',token);
      const iterator=this.iterators.includes(token.value); this.i++;
      if(iterator&&this.eat('.')){const field=this.expectIdentifier('Choose a safe enemy field such as hp or armor.');if(!COLLECTION_FIELDS.includes(field.value))this.fail('“'+field.value+'” is not a readable enemy-loop property.',field);return memberRef(token.value,field.value);}
      if(this.is('('))this.fail('Function calls that return values must start a let declaration, for example: let result = plan(2);',token);
      return variableRef(token.value);
    }
    this.fail('Expected a number, variable, RPG property, sensor, or parenthesized expression.',token);
  }
  parsePropertyOrSensor(){
    const root=this.current().value;this.i++;
    const parts=[root];
    let first;
    if(root==='enemies'&&this.eat('[')){
      const index=this.current();
      if(index.type!=='number')this.fail('Enemy collection indexes must be fixed numbers from 0 to 3.',index);
      this.i++; const n=Number(index.value);
      if(!Number.isInteger(n)||n<0||n>3)this.fail('Enemy collection indexes are limited to 0 through 3.',index);
      this.expect(']','Close the enemy index with “]”.');this.expect('.','Choose a property after enemies[index].');
      first=this.expectIdentifier('Choose hp, armor, distance, element, or alive.');parts.push(String(n),first.value);
    } else {
      this.expect('.','Use dot notation for Code Quest properties.');first=this.expectIdentifier('Choose a safe Code Quest property or sensor.');parts.push(first.value);
      if(root==='hero'&&CONDITION_METHODS[first.value]&&this.is('(')){
        this.expect('(');this.expect(')','Sensors do not take arguments.');return sensor(CONDITION_METHODS[first.value]);
      }
      if(root==='companion'&&COMPANION_CONDITION_METHODS[first.value]&&this.is('(')){
        this.expect('(');this.expect(')','Companion sensors do not take arguments.');return sensor(COMPANION_CONDITION_METHODS[first.value]);
      }
      while(this.eat('.'))parts.push(this.expectIdentifier('Choose a property after the dot.').value);
    }
    const path=parts.join('.');if(!PROPERTY_PATHS.includes(path))this.fail('“'+path+'” is not a readable Code Quest RPG property.',first);
    return propertyRef(path);
  }
}

export function parseJavaScript(source){
  try{const parsed=new Parser(source).parse();return Object.freeze({ok:true,program:parsed.program,functions:parsed.functions,error:null});}
  catch(error){if(error instanceof CodeQuestParseError)return Object.freeze({ok:false,program:Object.freeze([]),functions:Object.freeze({}),error:Object.freeze({message:error.message,line:error.line,column:error.column,offset:error.offset,length:error.length})});throw error;}
}

export const CODE_API=Object.freeze({
  actions:Object.freeze(Object.keys(ACTION_METHODS).map(method=>'hero.'+method+'();').concat(Object.keys(COMPANION_ACTION_METHODS).map(method=>'companion.'+method+'();'), ['hero.target(0);'])),
  conditions:Object.freeze(Object.keys(CONDITION_METHODS).map(method=>'hero.'+method+'()').concat(Object.keys(COMPANION_CONDITION_METHODS).map(method=>'companion.'+method+'()'), ['hero.keys > 0','hero.hp <= hero.maxHp / 2','enemies.length > 1'])),
  properties:PROPERTY_PATHS,
  structures:Object.freeze([
    'let steps = 3;',
    'if (CONDITION) {\n  // actions\n} else {\n  // actions\n}',
    'repeat(steps, () => {\n  // actions\n});',
    'function advance(steps) {\n  repeat(steps, () => { hero.move(); });\n  return steps;\n}',
    'let moved = advance(3);',
    'for (const foe of enemies) {\n  hero.target(foe);\n  hero.cast();\n}',
    'function react() { companion.guard(); }\non("danger", react);',
    'function relay() { companion.move(); }\non("signal", relay);\nhero.signal("ready");',
    'hero.state = "attack";',
    'companion.state = "regroup";'
  ])
});
export const CODE_LIMITS=Object.freeze({MAX_SOURCE,MAX_TOKENS});
