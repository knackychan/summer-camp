/* Speech-bubble placement for Code Quest (redesign UX polish slice 07, U1/U2).
   Pure geometry in CSS px relative to the scene box: no DOM, no model. The bubble
   tries the four sides of the hero, never touches the HUD / debug controls / the hero,
   and prefers the side that covers the fewest tiles the puzzle depends on. */

export const BUBBLE_SIDES = Object.freeze(['above', 'right', 'left', 'below']);
const INSET = 8;   // keep clear of the scene edge
const GAP = 10;    // room for the tail between the bubble and the hero
const TAIL = 14;   // tail stays this far from the bubble's corners

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function candidate(side, box, size, hero) {
  const { w, h } = size, hb = hero.box, cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
  const clampX = x => clamp(x, INSET, box.w - w - INSET), clampY = y => clamp(y, INSET, box.h - h - INSET);
  let x, y;
  if (side === 'above') { x = clampX(cx - w / 2); y = hb.y - GAP - h; }
  else if (side === 'below') { x = clampX(cx - w / 2); y = hb.y + hb.h + GAP; }
  else if (side === 'right') { x = hb.x + hb.w + GAP; y = clampY(cy - h / 2); }
  else { x = hb.x - GAP - w; y = clampY(cy - h / 2); }
  const vertical = side === 'above' || side === 'below';
  const tail = vertical ? clamp(cx - x, TAIL, w - TAIL) : clamp(cy - y, TAIL, h - TAIL);
  return { side, x, y, w, h, tail };
}

function fits(rect, box, hard) {
  if (rect.x < INSET - .5 || rect.y < INSET - .5 || rect.x + rect.w > box.w - INSET + .5 || rect.y + rect.h > box.h - INSET + .5) return false;
  return hard.every(r => !overlap(rect, r));
}

/**
 * @param {{ box:{w,h}, size:{w,h}, hero:{box:{x,y,w,h}}, hard?:Array, soft?:Array, previous?:string }} input
 * @returns {{ side:string, x:number, y:number, tail:number }}
 */
export function placeBubbleRect({ box, size, hero, hard = [], soft = [], previous = null }) {
  if (hero && hero.box) {
    const blocked = hard.concat([hero.box]);
    const options = BUBBLE_SIDES.map(side => candidate(side, box, size, hero))
      .filter(rect => fits(rect, box, blocked))
      .map(rect => ({ ...rect, score: soft.reduce((sum, r) => sum + overlap(rect, r), 0) }));
    if (options.length) {
      // Lowest score wins; ties go to the preferred side order.
      const best = options.reduce((a, b) => (b.score < a.score ? b : a));
      // Stay on the previous side while it is still clear and nearly as good, so the bubble doesn't jump as the hero walks.
      const kept = options.find(o => o.side === previous);
      const pick = kept && kept.score <= best.score * 1.1 + 1 ? kept : best;
      return { side: pick.side, x: Math.round(pick.x), y: Math.round(pick.y), tail: Math.round(pick.tail) };
    }
  }
  // Every side collides: a caption along the scene's bottom (then top) edge, no tail.
  const blocked = hard.concat(hero && hero.box ? [hero.box] : []);
  const xs = [(box.w - size.w) / 2, INSET, box.w - size.w - INSET], ys = [box.h - size.h - INSET, INSET];
  // Then any other gap along the edge, nearest the middle first: the scene beside the picker
  // column (simple-cards D7) is narrow enough that the goal and debug panels can block all three.
  const middle = (box.w - size.w) / 2, sweep = [];
  for (let x = INSET; x <= box.w - size.w - INSET; x += 8) sweep.push(x);
  xs.push(...sweep.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle)));
  const spots = [];
  for (const y of ys) for (const x of xs) spots.push({ x: Math.max(INSET, x), y: Math.max(INSET, y), w: size.w, h: size.h });
  const spot = spots.find(r => fits(r, box, blocked)) || spots[0];
  return { side: 'caption', x: Math.round(spot.x), y: Math.round(spot.y), tail: 0 };
}
