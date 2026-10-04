/* Saved Code Quest progression. Profile v12 keeps the persistent Rune Library and
   splits bounded persistent behavior into independent Hero and Companion programs while
   migrating every earlier save without discarding v11 behavior source. The Lab's
   Curiosity Journal (`lab`) is additive inside v12: older builds ignore the field, while
   a version bump would make them discard the whole save. */

import { generateLootChoices, normalizeLootItem, rarityInfo } from './loot.js';
import { normalizeDungeonRun, dungeonRunSummary } from './run.js';
import { normalizeLab } from './lab/journal.js';

const LIMIT = 1000000;
const INGREDIENT_IDS = Object.freeze(['sunHerb', 'moonBerry', 'waterCrystal', 'emberRoot']);
const POTION_IDS = Object.freeze(['healing', 'focus', 'antidote', 'ward']);
const SLOT_IDS = Object.freeze(['weapon', 'armor', 'charm']);
const EQUIPMENT = Object.freeze({
  trainingBlade: Object.freeze({ id: 'trainingBlade', slot: 'weapon', damage: 1, range: 1, spellDamage: 0, element: 'neutral', label: ['Training Blade', '練習短劍'] }),
  bronzeBlade: Object.freeze({ id: 'bronzeBlade', slot: 'weapon', damage: 2, range: 1, spellDamage: 0, element: 'neutral', label: ['Bronze Blade', '青銅短劍'] }),
  clockworkBlade: Object.freeze({ id: 'clockworkBlade', slot: 'weapon', damage: 3, range: 1, spellDamage: 0, element: 'neutral', label: ['Clockwork Blade', '機關短劍'] }),
  emberWand: Object.freeze({ id: 'emberWand', slot: 'weapon', damage: 1, range: 4, spellDamage: 2, element: 'fire', setId:'ember', label: ['Ember Wand', '餘燼魔杖'] }),
  frostScepter: Object.freeze({ id: 'frostScepter', slot: 'weapon', damage: 1, range: 4, spellDamage: 2, element: 'frost', setId:'frost', label: ['Frost Scepter', '冰霜權杖'] }),
  guardCape: Object.freeze({ id: 'guardCape', slot: 'armor', defense: 1, setId:'aegis', label: ['Guard Cape', '守衛披風'] }),
  alchemistApron: Object.freeze({ id: 'alchemistApron', slot: 'armor', maxHp: 1, setId:'ember', label: ['Alchemist Apron', '鍊金圍裙'] }),
  signalCharm: Object.freeze({ id: 'signalCharm', slot: 'charm', wardBonus: 1, setId:'aegis', label: ['Signal Charm', '預警護符'] }),
  wardenCrest: Object.freeze({ id: 'wardenCrest', slot: 'charm', wardBonus: 2, setId:'aegis', label: ['Warden Crest', '守衛徽記'] }),
  seekerLens: Object.freeze({ id: 'seekerLens', slot: 'charm', rangeBonus: 1, setId:'frost', label: ['Seeker Lens', '尋敵透鏡'] })
});

export const RECIPES = Object.freeze([
  Object.freeze({ id: 'healing', label: ['Healing Potion', '治療藥水'], ingredients: Object.freeze(['sunHerb', 'sunHerb', 'waterCrystal']), process: Object.freeze(['grind', 'stir']) }),
  Object.freeze({ id: 'focus', label: ['Focus Potion', '專注藥水'], ingredients: Object.freeze(['moonBerry', 'sunHerb', 'waterCrystal']), process: Object.freeze(['grind', 'stir', 'cool']) }),
  Object.freeze({ id: 'antidote', label: ['Antidote', '解毒藥水'], ingredients: Object.freeze(['moonBerry', 'moonBerry', 'emberRoot']), process: Object.freeze(['grind', 'heat', 'stir']) }),
  Object.freeze({ id: 'ward', label: ['Ward Tonic', '守護藥水'], ingredients: Object.freeze(['emberRoot', 'waterCrystal', 'waterCrystal']), process: Object.freeze(['heat', 'stir', 'cool']) })
]);

export const ALCHEMY_STEPS = Object.freeze(['grind', 'heat', 'stir', 'cool']);

function count(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(LIMIT, Math.max(0, Math.floor(value))) : 0;
}
function own(value, key) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}
function ids(value, pattern, max = 128) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => typeof item === 'string' && pattern.test(item)).slice(0, max))];
}
function counts(raw, allowed) {
  return Object.freeze(Object.fromEntries(allowed.map(key => [key, count(own(raw, key))])));
}
function bestBlocks(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (/^(q\d{2}|endless-\d{4})$/.test(key)) out[key] = Math.min(96, count(value));
    }
  }
  return Object.freeze(out);
}
function gearFromLists(lootGear, id) {
  return EQUIPMENT[id] || (Array.isArray(lootGear) ? lootGear.find(item => item.id === id) : null) || null;
}
function normalizeLoadout(raw, owned, lootGear, legacyEquipped) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const requestedWeapon = typeof src.weapon === 'string' ? src.weapon : legacyEquipped;
  const out = { weapon: 'trainingBlade', armor: null, charm: null };
  for (const slot of SLOT_IDS) {
    const requested = slot === 'weapon' ? requestedWeapon : src[slot], item = typeof requested === 'string' ? gearFromLists(lootGear, requested) : null;
    const ownedStatic = typeof requested === 'string' && owned.includes(requested), ownedLoot = !!(item && lootGear.some(entry => entry.id === requested));
    if (item && (ownedStatic || ownedLoot) && item.slot === slot) out[slot] = requested;
  }
  return Object.freeze(out);
}

function codeText(value, max=16000) { return typeof value === 'string' ? value.slice(0,max) : ''; }
function runeLibrary(raw) {
  const input=Array.isArray(raw)?raw:[]; return Object.freeze(Array.from({length:4},(_,i)=>codeText(input[i]||'',16000)));
}

export function normalizeProfile(raw, legacyBest = 0) {
  const version = count(own(raw, 'version'));
  const source = [1,2,3,4,5,6,7,8,9,10,11,12].includes(version) ? raw : undefined;
  const completed = ids(own(source, 'completed'), /^q\d{2}$/);
  const ownedEquipment = ids(own(source, 'equipment'), /^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/).filter(key => EQUIPMENT[key]);
  if (!ownedEquipment.includes('trainingBlade')) ownedEquipment.unshift('trainingBlade');
  const lootGear = []; const seenLoot = new Set();
  for (const rawItem of Array.isArray(own(source, 'lootGear')) ? own(source, 'lootGear').slice(0, 32) : []) {
    const item = normalizeLootItem(rawItem, EQUIPMENT); if (item && !seenLoot.has(item.id)) { seenLoot.add(item.id); lootGear.push(item); }
  }
  const pendingLoot = [];
  for (const rawItem of Array.isArray(own(source, 'pendingLoot')) ? own(source, 'pendingLoot').slice(0, 3) : []) {
    const item = normalizeLootItem(rawItem, EQUIPMENT); if (item && !pendingLoot.some(entry => entry.id === item.id)) pendingLoot.push(item);
  }
  const legacyEquipped = typeof own(source, 'equipped') === 'string' ? own(source, 'equipped') : 'trainingBlade';
  const loadout = normalizeLoadout(own(source, 'loadout'), ownedEquipment, lootGear, legacyEquipped);
  const legacyBehaviorSource = codeText(own(source,'behaviorSource'),16000), legacyBehaviorEnabled = own(source,'behaviorEnabled') === true;
  const heroBehaviorSource = version >= 12 ? codeText(own(source,'heroBehaviorSource'),16000) : '';
  const companionBehaviorSource = version >= 12 ? codeText(own(source,'companionBehaviorSource'),16000) : legacyBehaviorSource;
  const heroBehaviorEnabled = version >= 12 ? own(source,'heroBehaviorEnabled') === true : false;
  const companionBehaviorEnabled = version >= 12 ? own(source,'companionBehaviorEnabled') === true : legacyBehaviorEnabled;
  return Object.freeze({
    version: 12,
    completed: Object.freeze(completed),
    bestBlocks: bestBlocks(own(source, 'bestBlocks')),
    ingredients: counts(own(source, 'ingredients'), INGREDIENT_IDS),
    potions: counts(own(source, 'potions'), POTION_IDS),
    equipment: Object.freeze(ownedEquipment),
    lootGear: Object.freeze(lootGear),
    pendingLoot: Object.freeze(pendingLoot),
    loadout,
    equipped: loadout.weapon,
    discoveredRecipes: Object.freeze(ids(own(source, 'discoveredRecipes'), /^(healing|focus|antidote|ward)$/)),
    endlessBest: Math.min(9999, count(own(source, 'endlessBest'))),
    questsCleared: Math.max(completed.length, count(own(source, 'questsCleared'))),
    lootFound: count(own(source, 'lootFound')),
    activeRun: normalizeDungeonRun(own(source, 'activeRun')),
    expeditionsCleared: Math.min(9999, count(own(source, 'expeditionsCleared'))),
    bestExpeditionRooms: Math.min(13, count(own(source, 'bestExpeditionRooms'))),
    runeLibrary: runeLibrary(own(source,'runeLibrary')),
    heroBehaviorSource, companionBehaviorSource, heroBehaviorEnabled, companionBehaviorEnabled,
    // Legacy mirrors are kept so old host/debug surfaces can still inspect the migrated behavior.
    behaviorSource: companionBehaviorSource, behaviorEnabled: companionBehaviorEnabled,
    lab: normalizeLab(own(source, 'lab')),
    legacyBest: count(legacyBest)
  });
}

export function equipmentDescriptor(raw, id) {
  const profile = normalizeProfile(raw);
  return gearFromLists(profile.lootGear, id);
}
export function equipmentFor(raw, slot = 'weapon') {
  const profile = normalizeProfile(raw), id = profile.loadout[slot], item = gearFromLists(profile.lootGear, id);
  return item || (slot === 'weapon' ? EQUIPMENT.trainingBlade : null);
}
export function weaponFor(raw) { return equipmentFor(raw, 'weapon'); }

export function combatStatsFor(raw) {
  const profile = normalizeProfile(raw), weapon = equipmentFor(profile, 'weapon'), armor = equipmentFor(profile, 'armor'), charm = equipmentFor(profile, 'charm');
  const equipped = [weapon, armor, charm].filter(Boolean), setCounts = {};
  for (const item of equipped) if (item.setId && ['ember','frost','aegis'].includes(item.setId)) setCounts[item.setId] = (setCounts[item.setId] || 0) + 1;
  const activeSets = Object.freeze(Object.entries(setCounts).filter(([,n]) => n >= 2).map(([id,n]) => Object.freeze({ id, pieces:n })));
  const emberBonus = (setCounts.ember || 0) >= 2 ? 1 : 0, frostBonus = (setCounts.frost || 0) >= 2 ? 1 : 0, aegisBonus = (setCounts.aegis || 0) >= 2 ? 1 : 0;
  const triadBonus = Object.values(setCounts).some(n => n >= 3) ? 1 : 0;
  return Object.freeze({
    weaponDamage: Math.max(1, count(weapon && weapon.damage) || 1),
    spellDamage: Math.min(9, count(weapon && weapon.spellDamage) + emberBonus),
    weaponRange: Math.max(1, Math.min(6, count(weapon && weapon.range) + Math.min(2, count(charm && charm.rangeBonus)) + frostBonus)),
    weaponElement: weapon && ['fire','frost'].includes(weapon.element) ? weapon.element : 'neutral',
    defense: Math.min(4, count(armor && armor.defense) + aegisBonus),
    maxHp: 5 + Math.min(4, count(armor && armor.maxHp) + triadBonus),
    wardBonus: Math.min(3, count(charm && charm.wardBonus)),
    activeSets, setBonusCount:activeSets.length,
    weaponRarityRank: weapon && weapon.rarity ? rarityInfo(weapon.rarity).rank : 1,
    weaponAffixCount: weapon && Array.isArray(weapon.affixes) ? Math.min(3, weapon.affixes.length) : 0,
    armorRarityRank: armor && armor.rarity ? rarityInfo(armor.rarity).rank : armor ? 1 : 0,
    charmRarityRank: charm && charm.rarity ? rarityInfo(charm.rarity).rank : charm ? 1 : 0,
    consumables: Object.freeze({
      healing: Math.min(9, profile.potions.healing),
      antidote: Math.min(9, profile.potions.antidote),
      ward: Math.min(9, profile.potions.ward),
      focus: Math.min(9, profile.potions.focus)
    })
  });
}

export function saveRuneLibrary(raw, index, source) {
  const profile=normalizeProfile(raw), i=Number(index); if(!Number.isInteger(i)||i<0||i>=4) return {ok:false,profile,reason:'slot'};
  const code=codeText(source,16000); if(!code.trim()) return {ok:false,profile,reason:'empty'};
  const runeLibrary=[...profile.runeLibrary]; runeLibrary[i]=code; return {ok:true,profile:normalizeProfile({...profile,runeLibrary}),code};
}
export function loadRuneLibrary(raw,index) { const profile=normalizeProfile(raw),i=Number(index); const code=Number.isInteger(i)&&i>=0&&i<4?profile.runeLibrary[i]:''; return code&&code.trim()?{ok:true,profile,code}:{ok:false,profile,reason:'empty'}; }
export function saveBehaviorSource(raw, owner, source, enabled=true) {
  // Backward-compatible v0.13 signature: saveBehaviorSource(profile, source, enabled).
  if (owner !== 'hero' && owner !== 'companion') { enabled = source === undefined ? true : source; source = owner; owner = 'companion'; }
  const profile=normalizeProfile(raw), code=codeText(source,16000); if(!code.trim()) return {ok:false,profile,reason:'empty',code};
  const key=owner==='hero'?'heroBehaviorSource':'companionBehaviorSource', enabledKey=owner==='hero'?'heroBehaviorEnabled':'companionBehaviorEnabled';
  return {ok:true,profile:normalizeProfile({...profile,[key]:code,[enabledKey]:!!enabled}),code,owner};
}
export function setBehaviorEnabled(raw, owner, enabled) {
  // Backward-compatible v0.13 signature: setBehaviorEnabled(profile, enabled).
  if (owner !== 'hero' && owner !== 'companion') { enabled = owner; owner = 'companion'; }
  const profile=normalizeProfile(raw), key=owner==='hero'?'heroBehaviorEnabled':'companionBehaviorEnabled'; return normalizeProfile({...profile,[key]:!!enabled});
}
export function behaviorFor(raw, owner='hero') {
  const profile=normalizeProfile(raw), hero=owner!=='companion'; return Object.freeze({ owner:hero?'hero':'companion', source:hero?profile.heroBehaviorSource:profile.companionBehaviorSource, enabled:hero?profile.heroBehaviorEnabled:profile.companionBehaviorEnabled });
}

export function modeFor(raw) {
  const n = normalizeProfile(raw).completed.length;
  if (n >= 20) return 'architect';
  if (n >= 12) return 'coder';
  if (n >= 4) return 'builder';
  return 'explorer';
}

export function isLevelUnlocked(raw, index) {
  const profile = normalizeProfile(raw);
  if (index <= 0) return true;
  return profile.completed.includes('q' + String(index).padStart(2, '0'));
}

function mergeCounts(base, delta, allowed) {
  const next = { ...base };
  for (const key of allowed) next[key] = count(next[key]) + count(delta && delta[key]);
  return next;
}

export function recordLevelComplete(raw, level, blocksUsed) {
  const before = normalizeProfile(raw);
  if (!level || typeof level.id !== 'string' || !/^q\d{2}$/.test(level.id)) {
    return { profile: before, firstClear: false, improved: false, reward: {} };
  }
  const firstClear = !before.completed.includes(level.id);
  const previousBest = before.bestBlocks[level.id] || 0;
  const used = Math.max(1, Math.min(96, Math.floor(Number(blocksUsed) || 96)));
  const improved = !previousBest || used < previousBest;
  const reward = firstClear && level.reward ? level.reward : {};
  const equipment = [...before.equipment];
  if (firstClear && reward.equipment && EQUIPMENT[reward.equipment] && !equipment.includes(reward.equipment)) equipment.push(reward.equipment);
  const completed = firstClear ? before.completed.concat(level.id) : [...before.completed];
  const discovered = [...before.discoveredRecipes];
  if (completed.length >= 3 && !discovered.includes('healing')) discovered.push('healing');
  if (completed.length >= 7 && !discovered.includes('focus')) discovered.push('focus');
  if (completed.length >= 16 && !discovered.includes('antidote')) discovered.push('antidote');
  if (completed.length >= 18 && !discovered.includes('ward')) discovered.push('ward');
  const pendingLoot = firstClear && reward.lootChoiceSeed && !before.pendingLoot.length ? generateLootChoices(reward.lootChoiceSeed, reward.lootTier || Math.max(1, Math.ceil(completed.length / 8)), EQUIPMENT) : before.pendingLoot;
  const profile = normalizeProfile({
    ...before,
    completed,
    bestBlocks: { ...before.bestBlocks, ...(improved ? { [level.id]: used } : {}) },
    ingredients: firstClear ? mergeCounts(before.ingredients, reward.ingredients, INGREDIENT_IDS) : before.ingredients,
    potions: firstClear ? mergeCounts(before.potions, reward.potions, POTION_IDS) : before.potions,
    equipment,
    lootGear: before.lootGear,
    pendingLoot,
    loadout: before.loadout,
    discoveredRecipes: discovered,
    questsCleared: completed.length,
    lootFound: before.lootFound + (firstClear ? count(reward.lootFound || Object.values(reward.ingredients || {}).reduce((a, b) => a + count(b), 0) + (reward.equipment ? 1 : 0)) : 0)
  });
  return { profile, firstClear, improved, reward: firstClear ? reward : {} };
}

export function recordEndlessClear(raw, floor, reward = {}) {
  const before = normalizeProfile(raw);
  const f = Math.max(1, Math.min(9999, Math.floor(Number(floor) || 1)));
  const pendingLoot = reward.lootChoiceSeed && !before.pendingLoot.length ? generateLootChoices(reward.lootChoiceSeed, reward.lootTier || Math.max(1, Math.min(9, Math.ceil(f / 20))), EQUIPMENT) : before.pendingLoot;
  const profile = normalizeProfile({
    ...before,
    endlessBest: Math.max(before.endlessBest, f),
    ingredients: mergeCounts(before.ingredients, reward.ingredients, INGREDIENT_IDS),
    potions: mergeCounts(before.potions, reward.potions, POTION_IDS),
    pendingLoot,
    lootFound: before.lootFound + count(reward.lootFound || 1)
  });
  return { profile, improved: profile.endlessBest > before.endlessBest };
}

function multiset(list) {
  const out = {};
  for (const item of list) out[item] = (out[item] || 0) + 1;
  return out;
}
function findRecipe(items) {
  const got = multiset(items);
  return RECIPES.find(entry => {
    const need = multiset(entry.ingredients);
    return INGREDIENT_IDS.every(id => (got[id] || 0) === (need[id] || 0));
  });
}
function consumeRecipe(before, recipe, free = false) {
  const required = multiset(recipe.ingredients);
  if (!free) for (const [id, n] of Object.entries(required)) if (before.ingredients[id] < n) return { ok: false, reason: 'missing-ingredient', profile: before, recipe };
  const ingredients = { ...before.ingredients };
  if (!free) for (const [id, n] of Object.entries(required)) ingredients[id] -= n;
  const potions = { ...before.potions, [recipe.id]: before.potions[recipe.id] + 1 };
  const discovered = before.discoveredRecipes.includes(recipe.id) ? before.discoveredRecipes : before.discoveredRecipes.concat(recipe.id);
  return { ok: true, recipe, profile: normalizeProfile({ ...before, ingredients, potions, discoveredRecipes: discovered }) };
}

/* v0.2 compatibility helper: ingredient-only brew. The v0.3 UI uses brewLab. */
export function brew(raw, tray) {
  const before = normalizeProfile(raw);
  const items = Array.isArray(tray) ? tray.filter(id => INGREDIENT_IDS.includes(id)).slice(0, 3) : [];
  if (items.length !== 3) return { ok: false, reason: 'need-three', profile: before };
  const recipe = findRecipe(items);
  if (!recipe) return { ok: false, reason: 'unknown-recipe', profile: before };
  return consumeRecipe(before, recipe);
}

/** `options.free` (Lab design D5): brew without the stock check and without using ingredients up. */
export function brewLab(raw, tray, steps, options = {}) {
  const before = normalizeProfile(raw);
  const items = Array.isArray(tray) ? tray.filter(id => INGREDIENT_IDS.includes(id)).slice(0, 3) : [];
  const process = Array.isArray(steps) ? steps.filter(step => ALCHEMY_STEPS.includes(step)).slice(0, 5) : [];
  if (items.length !== 3) return { ok: false, reason: 'need-three', profile: before };
  const recipe = findRecipe(items);
  if (!recipe) return { ok: false, reason: 'unknown-recipe', profile: before };
  if (process.length !== recipe.process.length || process.some((step, i) => step !== recipe.process[i])) {
    return { ok: false, reason: 'wrong-process', profile: before, recipe, expected: recipe.process, got: Object.freeze([...process]) };
  }
  return consumeRecipe(before, recipe, !!(options && options.free === true));
}

export function equip(raw, equipmentId) {
  const before = normalizeProfile(raw), item = gearFromLists(before.lootGear, equipmentId);
  const owned = before.equipment.includes(equipmentId) || before.lootGear.some(entry => entry.id === equipmentId);
  if (!item || !owned) return before;
  return normalizeProfile({ ...before, loadout: { ...before.loadout, [item.slot]: equipmentId } });
}

export function claimLoot(raw, lootId) {
  const before = normalizeProfile(raw), item = before.pendingLoot.find(entry => entry.id === lootId);
  if (!item) return { ok:false, profile:before, item:null };
  const lootGear = before.lootGear.some(entry => entry.id === item.id) ? before.lootGear : before.lootGear.concat(item).slice(-32);
  return { ok:true, item, profile:normalizeProfile({ ...before, lootGear, pendingLoot:[], lootFound:before.lootFound + 1 }) };
}

export function consumePotion(raw, potionId, amount = 1) {
  const before = normalizeProfile(raw);
  if (!POTION_IDS.includes(potionId)) return before;
  const n = Math.max(1, Math.min(9, Math.floor(Number(amount) || 1)));
  if (before.potions[potionId] < n) return before;
  return normalizeProfile({ ...before, potions: { ...before.potions, [potionId]: before.potions[potionId] - n } });
}


export function setActiveDungeonRun(raw, run) {
  const before = normalizeProfile(raw), activeRun = normalizeDungeonRun(run);
  const rooms = activeRun ? dungeonRunSummary(activeRun).roomsCleared : 0;
  return normalizeProfile({ ...before, activeRun, bestExpeditionRooms:Math.max(before.bestExpeditionRooms, rooms) });
}

export function finishDungeonRun(raw, run) {
  const before = normalizeProfile(raw), activeRun = normalizeDungeonRun(run);
  if (!activeRun || !activeRun.finished) return { ok:false, profile:before, reward:null };
  const pendingLoot = before.pendingLoot.length ? before.pendingLoot : generateLootChoices('expedition:' + activeRun.seed + ':victory', 6, EQUIPMENT);
  const profile = normalizeProfile({
    ...before, activeRun:null, pendingLoot, expeditionsCleared:before.expeditionsCleared + 1,
    bestExpeditionRooms:Math.max(before.bestExpeditionRooms, activeRun.cleared.length), lootFound:before.lootFound + 1
  });
  return { ok:true, profile, reward:Object.freeze({ lootChoiceSeed:'expedition:' + activeRun.seed + ':victory', rooms:activeRun.cleared.length }) };
}

export function abandonDungeonRun(raw) {
  const before = normalizeProfile(raw);
  return normalizeProfile({ ...before, activeRun:null });
}

export function scoreForProfile(raw) {
  const profile = normalizeProfile(raw);
  return profile.completed.length * 100 + profile.endlessBest * 10 + profile.expeditionsCleared * 250 + profile.bestExpeditionRooms * 20 + Math.min(99, profile.lootFound) + Math.min(99, profile.lootGear.length * 2);
}

export const CODEQUEST_EQUIPMENT = EQUIPMENT;
export const CODEQUEST_RARITIES = Object.freeze(Object.fromEntries(Object.entries({ common:rarityInfo('common'), uncommon:rarityInfo('uncommon'), rare:rarityInfo('rare'), epic:rarityInfo('epic') }))); 
export const CODEQUEST_INGREDIENTS = INGREDIENT_IDS;
export const CODEQUEST_POTIONS = POTION_IDS;
