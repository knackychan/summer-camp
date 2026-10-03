/* Path preview for the Explorer stage (redesign D7). Runs a program on a throw-away
   CodeQuestModel until the dungeon would take its turn, and returns the tiles the hero
   visits with the facing at each. The caller passes a fresh model; the live one is never
   touched. Bounded by the interpreter's own budget plus a hard step cap. */
export function previewPath(model, program, functions = {}) {
  const hero = model.hero;
  const path = [{ x: hero.x, y: hero.y, dir: hero.dir }];
  if (!Array.isArray(program) || !program.length) return path;
  const begun = model.begin(program, functions);
  if (!begun || !begun.ok) return path;
  for (let i = 0; i < 256 && model.phase === 'executing'; i++) {
    const event = model.step();
    if (!event || event.type === 'world-turn') break;
    const last = path[path.length - 1], now = model.hero;
    if (now.x !== last.x || now.y !== last.y) path.push({ x: now.x, y: now.y, dir: now.dir });
    else last.dir = now.dir;
  }
  return path;
}
