/* Safe, tiny potion-bench scripting language.
   Source is parsed into an operation list and then handed to the existing pure
   brewLab model. No source is evaluated as JavaScript. */

import { brewLab, RECIPES, ALCHEMY_STEPS, CODEQUEST_INGREDIENTS } from './progression.js';

const MAX_SOURCE = 4000;
const MAX_OPS = 16;
const INGREDIENTS = new Set(CODEQUEST_INGREDIENTS);
const STEPS = new Set(ALCHEMY_STEPS);

function err(message, line = 1, column = 1) { return Object.freeze({ message, line, column }); }

export function parseAlchemyCode(source) {
  const text = String(source == null ? '' : source);
  if (text.length > MAX_SOURCE) return { ok:false, operations:[], error:err('Potion script is too long.') };
  const operations = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    let match = /^bench\.add\((['"])([A-Za-z][A-Za-z0-9_]*)\1\);?$/.exec(line);
    if (match) {
      if (!INGREDIENTS.has(match[2])) return { ok:false, operations:[], error:err('Unknown ingredient “'+match[2]+'”.', i+1, 1) };
      operations.push(Object.freeze({ type:'add', ingredient:match[2] }));
    } else {
      match = /^bench\.(grind|heat|stir|cool|bottle)\(\);?$/.exec(line);
      if (!match) return { ok:false, operations:[], error:err('Use bench.add("ingredient") or a bench process method.', i+1, 1) };
      operations.push(Object.freeze({ type:match[1] }));
    }
    if (operations.length > MAX_OPS) return { ok:false, operations:[], error:err('Potion scripts are limited to '+MAX_OPS+' operations.', i+1, 1) };
  }
  if (!operations.length) return { ok:false, operations:[], error:err('Potion script is empty.') };
  const bottle = operations.findIndex(op => op.type === 'bottle');
  if (bottle < 0) return { ok:false, operations:[], error:err('Finish the recipe with bench.bottle().') };
  if (bottle !== operations.length - 1) return { ok:false, operations:[], error:err('bench.bottle() must be the final operation.') };
  if (operations.filter(op => op.type === 'bottle').length !== 1) return { ok:false, operations:[], error:err('Bottle the potion exactly once.') };
  return Object.freeze({ ok:true, operations:Object.freeze(operations), error:null });
}

export function runAlchemyCode(profile, source) {
  const parsed = parseAlchemyCode(source);
  if (!parsed.ok) return { ok:false, reason:'parse', profile, error:parsed.error };
  const tray = parsed.operations.filter(op => op.type === 'add').map(op => op.ingredient);
  const steps = parsed.operations.filter(op => STEPS.has(op.type)).map(op => op.type);
  if (tray.length !== 3) return { ok:false, reason:'need-three', profile };
  return brewLab(profile, tray, steps);
}

export function recipeToAlchemyCode(recipe) {
  if (!recipe) return '// Choose a discovered recipe · 選擇已發現的配方';
  const lines = recipe.ingredients.map(id => 'bench.add("'+id+'");');
  for (const step of recipe.process) lines.push('bench.'+step+'();');
  lines.push('bench.bottle();');
  return lines.join('\n');
}

export function recipeById(id) { return RECIPES.find(recipe => recipe.id === id) || null; }
export const ALCHEMY_CODE_LIMITS = Object.freeze({ MAX_SOURCE, MAX_OPS });
