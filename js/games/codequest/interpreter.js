import { normalizeProgram, normalizeFunctions, functionDescriptor, normalizeExpression, AST_LIMITS } from './ast.js';

const DEFAULT_BUDGET = 192;
const MAX_CALL_DEPTH = 8;

function scalar(value) {
  if (typeof value === 'boolean' || typeof value === 'string' || value === null) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(-999, Math.min(999, value));
  return 0;
}
function readVar(scope, name) {
  let cursor = scope;
  while (cursor) {
    if (Object.hasOwn(cursor, name)) return cursor[name];
    cursor = Object.getPrototypeOf(cursor);
  }
  return 0;
}
function evalExpr(raw, scope, env) {
  const expr = normalizeExpression(raw);
  if (expr.type === 'literal') return expr.value;
  if (expr.type === 'var') return readVar(scope, expr.name);
  if (expr.type === 'member') {
    const item = readVar(scope, expr.name);
    if (!item || typeof item !== 'object' || item.__cqEnemyRef !== true) return 0;
    return scalar(Object.hasOwn(item, expr.field) ? item[expr.field] : 0);
  }
  if (expr.type === 'property') {
    try { return scalar(env && typeof env.read === 'function' ? env.read(expr.path) : 0); }
    catch { return 0; }
  }
  if (expr.type === 'sensor') {
    try { return !!(env && typeof env.test === 'function' && env.test(expr.test)); }
    catch { return false; }
  }
  if (expr.type === 'not') return !evalExpr(expr.value, scope, env);
  if (expr.type === 'binary') {
    if (expr.op === '&&') return !!evalExpr(expr.left, scope, env) && !!evalExpr(expr.right, scope, env);
    if (expr.op === '||') return !!evalExpr(expr.left, scope, env) || !!evalExpr(expr.right, scope, env);
    const left = evalExpr(expr.left, scope, env), right = evalExpr(expr.right, scope, env);
    if (expr.op === '+') return scalar(Number(left) + Number(right));
    if (expr.op === '-') return scalar(Number(left) - Number(right));
    if (expr.op === '*') return scalar(Number(left) * Number(right));
    if (expr.op === '/') return Number(right) === 0 ? 0 : scalar(Number(left) / Number(right));
    if (expr.op === '<') return Number(left) < Number(right);
    if (expr.op === '<=') return Number(left) <= Number(right);
    if (expr.op === '>') return Number(left) > Number(right);
    if (expr.op === '>=') return Number(left) >= Number(right);
    if (expr.op === '===') return left === right;
    if (expr.op === '!==') return left !== right;
  }
  return 0;
}

/**
 * Deterministic, step-able interpreter for the Code Quest AST.
 * v0.14 keeps bounded read-only for...of iteration and adds bounded actor state plus FIFO cooperative messages.
 * No eval, Function, globals, DOM, timers or network access exist here.
 */
export class ProgramRunner {
  constructor(program, functions = {}, options = {}) {
    this.program = normalizeProgram(program);
    this.functions = normalizeFunctions(functions);
    this.budget = Math.max(8, Math.min(768, Math.floor(Number(options.budget) || DEFAULT_BUDGET)));
    this.steps = 0;
    this.halted = false;
    this.error = null;
    this.rootScope = Object.create(null);
    this.stack = [{ kind: 'block', nodes: this.program, index: 0, calls: [], scope: this.rootScope }];
  }

  _tick() {
    this.steps++;
    if (this.steps > this.budget) { this.error = 'budget'; this.halted = true; return false; }
    return true;
  }
  _fail(reason, extra = {}) {
    this.error = reason; this.halted = true;
    return { type: 'error', reason, ...extra };
  }
  _finishFunction(frame) {
    this.stack.pop();
    if (frame.assign && frame.callerScope) frame.callerScope[frame.assign] = scalar(frame.returnValue);
  }

  /** Open function calls, outermost first: [{ uid, name }]. Read-only; lets the UI light the running call card. */
  activeCalls() {
    return this.stack.filter(frame => frame.kind === 'function').map(frame => ({ uid: frame.uid || null, name: frame.name }));
  }

  step(env = {}) {
    if (this.halted) return { type: this.error ? 'error' : 'done', reason: this.error || undefined };

    while (this.stack.length) {
      const frame = this.stack[this.stack.length - 1];
      if (frame.kind === 'function') { this._finishFunction(frame); continue; }
      if (frame.kind === 'forOf') {
        if (frame.index >= frame.items.length) { this.stack.pop(); continue; }
        const item = frame.items[frame.index++];
        const childScope = Object.create(frame.scope); childScope[frame.iterator] = item;
        this.stack.push({ kind: 'block', nodes: frame.body, index: 0, calls: frame.calls, scope: childScope });
        continue;
      }
      if (frame.kind === 'repeat') {
        if (frame.remaining <= 0) { this.stack.pop(); continue; }
        frame.remaining--;
        this.stack.push({ kind: 'block', nodes: frame.body, index: 0, calls: frame.calls, scope: frame.scope });
        continue;
      }
      if (frame.index >= frame.nodes.length) { this.stack.pop(); continue; }

      const node = frame.nodes[frame.index++];
      if (!this._tick()) return { type: 'error', reason: this.error };

      if (node.type === 'action') return { type: 'action', op: node.op, uid: node.uid, node };
      if (node.type === 'signal') return { type:'signal', actor:node.actor, channel:node.channel, uid:node.uid, node };
      if (node.type === 'state') return { type:'state', actor:node.actor, state:node.state, uid:node.uid, node };
      if (node.type === 'target') {
        const raw = evalExpr(node.index, frame.scope, env);
        if (raw && typeof raw === 'object' && raw.__cqEnemyRef === true && typeof raw.id === 'string' && /^enemy-\d+$/.test(raw.id)) {
          return { type: 'target-ref', id: raw.id, uid: node.uid, node };
        }
        const index = Math.floor(Number(raw));
        if (!Number.isFinite(index) || index < 0 || index > 3) return this._fail('target-index', { index: raw, uid: node.uid });
        return { type: 'target', index, uid: node.uid, node };
      }
      if (node.type === 'let') {
        if (Object.keys(frame.scope).length >= AST_LIMITS.MAX_VARIABLES && !Object.hasOwn(frame.scope, node.name)) return this._fail('too-many-variables', { name: node.name });
        frame.scope[node.name] = scalar(evalExpr(node.value, frame.scope, env));
        continue;
      }
      if (node.type === 'forOf') {
        let rawItems = [];
        try { rawItems = env && typeof env.collection === 'function' ? env.collection(node.collection) : []; } catch { rawItems = []; }
        const items = (Array.isArray(rawItems) ? rawItems : []).slice(0, AST_LIMITS.MAX_FOREACH).map(item => Object.freeze({
          __cqEnemyRef: true, id: typeof item.id === 'string' && /^enemy-\d+$/.test(item.id) ? item.id : '',
          hp: scalar(item.hp), maxHp: scalar(item.maxHp), armor: scalar(item.armor), distance: scalar(item.distance),
          element: scalar(item.element), alive: !!item.alive, weakTo: scalar(item.weakTo), burning: !!item.burning, frozen: !!item.frozen
        })).filter(item => item.id);
        this.stack.push({ kind: 'forOf', items, index: 0, iterator: node.iterator, body: node.body, calls: frame.calls, scope: frame.scope, uid: node.uid });
        continue;
      }
      if (node.type === 'repeat') {
        const raw = typeof node.times === 'number' ? node.times : evalExpr(node.times, frame.scope, env);
        const times = Math.floor(Number(raw));
        if (!Number.isFinite(times) || times < 1 || times > AST_LIMITS.MAX_REPEAT) return this._fail('repeat-value');
        this.stack.push({ kind: 'repeat', body: node.body, remaining: times, calls: frame.calls, scope: frame.scope, uid: node.uid });
        continue;
      }
      if (node.type === 'if') {
        let passed = false;
        try { passed = typeof node.test === 'string' ? !!(env && typeof env.test === 'function' && env.test(node.test)) : !!evalExpr(node.test, frame.scope, env); }
        catch (error) { return this._fail('condition', { node, error }); }
        const branch = passed ? node.then : node.else;
        if (branch.length) this.stack.push({ kind: 'block', nodes: branch, index: 0, calls: frame.calls, scope: frame.scope });
        continue;
      }
      if (node.type === 'on') {
        const value = this.functions[node.name];
        if (!value) return this._fail('missing-function', { name: node.name, uid: node.uid });
        const desc = functionDescriptor(value);
        if (desc.params.length !== 0) return this._fail('event-handler-arguments', { name: node.name, uid: node.uid });
        return { type:'handler', event:node.event, name:node.name, uid:node.uid, node };
      }
      if (node.type === 'call') {
        const value = this.functions[node.name];
        if (!value) return this._fail('missing-function', { name: node.name, uid: node.uid });
        const desc = functionDescriptor(value);
        if (desc.params.length !== node.args.length) return this._fail('argument-count', { name: node.name, expected: desc.params.length, got: node.args.length });
        if (frame.calls.includes(node.name)) return this._fail('recursive-call', { name: node.name, uid: node.uid });
        if (frame.calls.length >= MAX_CALL_DEPTH) return this._fail('call-depth', { name: node.name, uid: node.uid });
        const childScope = Object.create(frame.scope);
        desc.params.forEach((param, index) => { const value = evalExpr(node.args[index], frame.scope, env); childScope[param] = value && typeof value === 'object' && value.__cqEnemyRef === true ? value : scalar(value); });
        const calls = frame.calls.concat(node.name);
        this.stack.push({ kind: 'function', name: node.name, uid: node.uid, assign: node.assign, callerScope: frame.scope, returnValue: null, calls, scope: childScope });
        this.stack.push({ kind: 'block', nodes: desc.body, index: 0, calls, scope: childScope });
        continue;
      }
      if (node.type === 'return') {
        let index = this.stack.length - 1;
        while (index >= 0 && this.stack[index].kind !== 'function') index--;
        if (index < 0) return this._fail('return-outside-function');
        const fn = this.stack[index];
        fn.returnValue = scalar(evalExpr(node.value, frame.scope, env));
        this.stack.splice(index + 1); // discard nested repeat/block frames inside the function
        continue;
      }
    }

    this.halted = true;
    return { type: 'done' };
  }

  snapshot() {
    const vars = {};
    for (const [key, value] of Object.entries(this.rootScope)) vars[key] = value;
    return Object.freeze({ done: this.halted && !this.error, error: this.error, steps: this.steps, budget: this.budget, depth: this.stack.length, variables: Object.freeze(vars) });
  }
}

export function runToActions(program, functions, env, limit = 384) {
  const runner = new ProgramRunner(program, functions, { budget: limit });
  const actions = [];
  for (let i = 0; i < limit + 8; i++) {
    const event = runner.step(env);
    if (event.type === 'action') actions.push(event.op);
    else if (event.type === 'target') actions.push('target:' + event.index);
    else if (event.type === 'target-ref') actions.push('target-ref:' + event.id);
    else if (event.type === 'handler') actions.push('on:' + event.event + ':' + event.name);
    else if (event.type === 'signal') actions.push(event.actor + '.signal:' + event.channel);
    else if (event.type === 'state') actions.push(event.actor + '.state:' + event.state);
    else if (event.type === 'done') return { actions, done: true, error: null, snapshot: runner.snapshot() };
    else if (event.type === 'error') return { actions, done: false, error: event.reason, snapshot: runner.snapshot() };
  }
  return { actions, done: false, error: 'outer-limit', snapshot: runner.snapshot() };
}

export const INTERPRETER_LIMITS = Object.freeze({ DEFAULT_BUDGET, MAX_CALL_DEPTH });
