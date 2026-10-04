/* Laboratory of Curiosity ingredients (docs/plans/2026-10-04-lab-of-curiosity, design.md).
   Each ingredient carries integer property points 0–3; the resolver sums them, so a
   reaction comes from what is in the mix, not from a recipe list. Shelf jars are the
   Lab's own curiosity ingredients; the bag is the four dungeon ingredients. */
import { ITEM_LABELS } from '../strings.js';

export const LAB_PROPERTIES = Object.freeze(['life', 'growth', 'fire', 'cold', 'water', 'echo', 'space', 'time', 'light', 'chaos', 'calm']);

/* D5 (Papa, 2026-10-04): ingredients are free for now — nothing runs out and brewing a
   dungeon potion does not use up bag ingredients. Set to false for the approved fallback:
   the shelf stays free, a dungeon potion costs its bag ingredients again, and without
   enough stock the reaction still plays as a practice brew. */
export const LAB_FREE_INGREDIENTS = true;

const item = (id, where, label, props) => Object.freeze({ id, where, label: Object.freeze(label), props: Object.freeze(props) });

const SHELF = [
  item('redMushroom', 'shelf', ['Red Mushroom', '紅蘑菇'], { life: 1, growth: 2, chaos: 1 }),
  item('echoCrystal', 'shelf', ['Echo Crystal', '回音水晶'], { echo: 3, space: 1, calm: 1 }),
  item('emberSeed', 'shelf', ['Ember Seed', '餘燼種子'], { growth: 1, fire: 3, chaos: 1 }),
  item('moonflower', 'shelf', ['Moonflower', '月光花'], { life: 1, light: 2, calm: 1 }),
  item('voidDust', 'shelf', ['Void Dust', '虛空塵'], { space: 3, time: 1, chaos: 2 }),
  item('lifeSap', 'shelf', ['Life Sap', '生命樹液'], { life: 3, growth: 1 }),
  item('frostDew', 'shelf', ['Frost Dew', '霜露'], { cold: 2, water: 2, calm: 1 }),
  item('starDust', 'shelf', ['Star Dust', '星塵'], { fire: 1, time: 1, light: 2, chaos: 1 })
];
// Same ids and order as progression.js INGREDIENT_IDS (tested). Not imported from there:
// progression.js imports lab/journal.js, which imports this file.
const BAG_PROPS = {
  sunHerb: { life: 2, light: 1 },
  moonBerry: { life: 1, calm: 2 },
  waterCrystal: { water: 2, echo: 1, calm: 1 },
  emberRoot: { growth: 1, fire: 2 }
};
const BAG = Object.keys(BAG_PROPS).map(id => item(id, 'bag', ITEM_LABELS[id], BAG_PROPS[id]));

export const LAB_INGREDIENTS = Object.freeze(Object.fromEntries([...SHELF, ...BAG].map(entry => [entry.id, entry])));
export const SHELF_IDS = Object.freeze(SHELF.map(entry => entry.id));
export const BAG_IDS = Object.freeze(BAG.map(entry => entry.id));

/* Phase 2 (docs/plans/2026-10-04-lab-states, D2/D3): one state per ingredient, set by
   lifting it and tapping a tool. A state changes that ingredient's own points before
   the mix is summed; whole-cauldron steps still apply on top. */
export const LAB_STATES = Object.freeze(['raw', 'crushed', 'heated', 'frozen']);
export const STATE_TOOL = Object.freeze({ grind: 'crushed', heat: 'heated', cool: 'frozen' });

/** An ingredient's points in a state: crushed = stronger but wilder, heated = hotter, frozen = cold and asleep. */
export function applyState(props, state) {
  const out = { ...props };
  if (state === 'crushed') {
    let best = null;
    for (const prop of LAB_PROPERTIES) {
      if (prop === 'chaos' || prop === 'calm' || !(out[prop] > 0)) continue;
      if (best === null || out[prop] > out[best]) best = prop;
    }
    if (best) out[best] += 1;
    out.chaos = (out.chaos || 0) + 1;
  } else if (state === 'heated') {
    out.fire = (out.fire || 0) + 2;
    out.cold = 0;
    out.water = Math.max(0, (out.water || 0) - 1);
    out.chaos = (out.chaos || 0) + 1;
  } else if (state === 'frozen') {
    out.cold = (out.cold || 0) + 2;
    out.calm = (out.calm || 0) + 1;
    out.fire = 0; out.life = 0; out.growth = 0;
  }
  for (const key of Object.keys(out)) if (!out[key]) delete out[key];
  return Object.freeze(out);
}
