/* Deterministic Code Quest relic generation.
   Loot is regenerated from seed+tier instead of trusting saved stat blobs. */

export const RARITIES = Object.freeze({
  common: Object.freeze({ id:'common', rank:1, affixes:1, label:Object.freeze(['Common','普通']) }),
  uncommon: Object.freeze({ id:'uncommon', rank:2, affixes:1, label:Object.freeze(['Uncommon','精良']) }),
  rare: Object.freeze({ id:'rare', rank:3, affixes:2, label:Object.freeze(['Rare','稀有']) }),
  epic: Object.freeze({ id:'epic', rank:4, affixes:3, label:Object.freeze(['Epic','史詩']) })
});

export const RELIC_SETS = Object.freeze({
  ember:Object.freeze({ id:'ember', label:Object.freeze(['Ember Circuit','餘燼迴路']) }),
  frost:Object.freeze({ id:'frost', label:Object.freeze(['Frost Circuit','冰霜迴路']) }),
  aegis:Object.freeze({ id:'aegis', label:Object.freeze(['Aegis Circuit','守護迴路']) })
});

const AFFIXES = Object.freeze([
  Object.freeze({ id:'keen', slots:['weapon'], label:['Keen','銳利'], stats:{ damage:1 } }),
  Object.freeze({ id:'arcane', slots:['weapon'], label:['Arcane','奧術'], stats:{ spellDamage:1 } }),
  Object.freeze({ id:'reaching', slots:['weapon','charm'], label:['Reaching','延伸'], stats:{ range:1 } }),
  Object.freeze({ id:'ember', slots:['weapon'], label:['Ember','餘燼'], stats:{ element:'fire', spellDamage:1 } }),
  Object.freeze({ id:'rime', slots:['weapon'], label:['Rime','霜紋'], stats:{ element:'frost', spellDamage:1 } }),
  Object.freeze({ id:'sturdy', slots:['armor'], label:['Sturdy','堅固'], stats:{ defense:1 } }),
  Object.freeze({ id:'vital', slots:['armor'], label:['Vital','活力'], stats:{ maxHp:1 } }),
  Object.freeze({ id:'warded', slots:['armor','charm'], label:['Warded','守護'], stats:{ wardBonus:1 } }),
  Object.freeze({ id:'seeking', slots:['charm'], label:['Seeking','尋敵'], stats:{ rangeBonus:1 } }),
  Object.freeze({ id:'fortified', slots:['armor'], label:['Fortified','強韌'], stats:{ defense:1, maxHp:1 } })
]);

function hash32(input) {
  let h = 2166136261 >>> 0;
  for (const ch of String(input)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed) {
  let state = hash32(seed) || 0x9e3779b9;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; };
}
function choose(list, random) { return list[Math.min(list.length - 1, Math.floor(random() * list.length))]; }
function clamp(value, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : min; }
function rarityFor(tier, random) {
  const t = clamp(tier, 1, 9), roll = random();
  if (t >= 7 && roll > 0.52) return RARITIES.epic;
  if (t >= 4 && roll > 0.38) return RARITIES.rare;
  if (t >= 2 && roll > 0.28) return RARITIES.uncommon;
  return RARITIES.common;
}
function basePool(catalog) {
  return ['bronzeBlade','clockworkBlade','emberWand','frostScepter','guardCape','alchemistApron','signalCharm','seekerLens']
    .map(id => catalog[id]).filter(Boolean);
}
function boundedStats(base, affixes) {
  const out = {
    damage: clamp(base.damage || 0, 0, 9), spellDamage: clamp(base.spellDamage || 0, 0, 9),
    range: clamp(base.range || 1, 1, 6), element: ['fire','frost'].includes(base.element) ? base.element : 'neutral',
    defense: clamp(base.defense || 0, 0, 4), maxHp: clamp(base.maxHp || 0, 0, 4),
    wardBonus: clamp(base.wardBonus || 0, 0, 3), rangeBonus: clamp(base.rangeBonus || 0, 0, 2)
  };
  for (const affix of affixes) {
    for (const [key, value] of Object.entries(affix.stats || {})) {
      if (key === 'element') out.element = ['fire','frost'].includes(value) ? value : out.element;
      else if (key === 'range') out.range = clamp(out.range + value, 1, 6);
      else if (key === 'damage' || key === 'spellDamage') out[key] = clamp(out[key] + value, 0, 9);
      else if (key === 'defense') out.defense = clamp(out.defense + value, 0, 4);
      else if (key === 'maxHp') out.maxHp = clamp(out.maxHp + value, 0, 4);
      else if (key === 'wardBonus') out.wardBonus = clamp(out.wardBonus + value, 0, 3);
      else if (key === 'rangeBonus') out.rangeBonus = clamp(out.rangeBonus + value, 0, 2);
    }
  }
  return Object.freeze(out);
}

export function buildLootItem(seed, tier, catalog) {
  const safeSeed = String(seed || '').slice(0, 80) || 'relic';
  const safeTier = clamp(tier, 1, 9), random = rng(safeSeed + ':' + safeTier);
  const bases = basePool(catalog || {}); if (!bases.length) return null;
  const base = choose(bases, random), rarity = rarityFor(safeTier, random);
  const possible = AFFIXES.filter(affix => affix.slots.includes(base.slot));
  const chosen = [];
  while (chosen.length < rarity.affixes && chosen.length < possible.length) {
    const candidate = choose(possible, random);
    if (!chosen.some(item => item.id === candidate.id)) chosen.push(candidate);
  }
  const stats = boundedStats(base, chosen), setId = rarity.rank >= 2 ? choose(Object.keys(RELIC_SETS), random) : null, prefixEn = chosen.map(item => item.label[0]).join(' '), prefixZh = chosen.map(item => item.label[1]).join('・');
  const id = 'loot-' + hash32(safeSeed + ':' + safeTier).toString(36);
  return Object.freeze({
    id, seed:safeSeed, tier:safeTier, baseId:base.id, spriteId:base.id, slot:base.slot,
    rarity:rarity.id, rarityRank:rarity.rank, setId, affixes:Object.freeze(chosen.map(item => item.id)),
    affixLabels:Object.freeze(chosen.map(item => Object.freeze([...item.label]))),
    label:Object.freeze([(prefixEn ? prefixEn + ' ' : '') + base.label[0], (prefixZh ? prefixZh + '・' : '') + base.label[1]]),
    ...stats
  });
}

export function normalizeLootItem(raw, catalog) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.seed !== 'string') return null;
  return buildLootItem(raw.seed, raw.tier, catalog);
}

export function generateLootChoices(seed, tier, catalog) {
  const safe = String(seed || 'choice').slice(0, 64), out = [], seen = new Set();
  for (let i = 0; i < 9 && out.length < 3; i++) {
    const item = buildLootItem(safe + ':' + i, tier, catalog);
    if (item && !seen.has(item.id)) { seen.add(item.id); out.push(item); }
  }
  return Object.freeze(out);
}

export function rarityInfo(id) { return RARITIES[id] || RARITIES.common; }
