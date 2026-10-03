/* 2.5D dungeon-diorama projection for Code Quest.
   v0.14 visualizes bounded state transitions and actor/dungeon signal pulses while keeping
   all gameplay state in the deterministic model. This module remains a visual projection only. */
import { HEX, C, nearestIndex } from '../../world/planet-palette.js';
import { drawSprite, spriteSize } from './pixel-art.js';

export const WIDTH = 480;
export const HEIGHT = 270;

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = HEX[color];
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function rgba(ctx, color, alpha) {
  ctx.fillStyle = HEX[color];
  ctx.globalAlpha = alpha;
}
function quad(ctx, color, a, b, c, d, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = HEX[color];
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.lineTo(Math.round(c.x), Math.round(c.y));
  ctx.lineTo(Math.round(d.x), Math.round(d.y));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function line(ctx, color, x1, y1, x2, y2, width = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = HEX[color];
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(Math.round(x1), Math.round(y1)); ctx.lineTo(Math.round(x2), Math.round(y2)); ctx.stroke();
  ctx.restore();
}
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function ease(t) { const p = clamp01(t); return 1 - Math.pow(1 - p, 3); }
function wallKeySet(snapshot) { return new Set(snapshot.walls || []); }
function pitKeySet(snapshot) { return new Set((snapshot.pits || []).map(item => typeof item === 'string' ? item : key(item.x,item.y))); }
function key(x, y) { return x + ',' + y; }

function geometry(snapshot) {
  const slant = snapshot.width > 10 ? 6 : 8;
  const tileW = Math.max(28, Math.min(46, Math.floor((WIDTH - 50 - Math.max(0, snapshot.height - 1) * slant) / snapshot.width)));
  const tileD = snapshot.height > 5 ? 12 : 15;
  const wallH = Math.max(34, Math.min(50, tileW + 5));
  const sceneW = snapshot.width * tileW + Math.max(0, snapshot.height - 1) * slant;
  const originX = Math.floor((WIDTH - sceneW) / 2);
  const originY = 125;
  return { slant, tileW, tileD, wallH, originX, originY };
}

function project(g, x, y) {
  return { x: g.originX + x * g.tileW + y * g.slant, y: g.originY + y * g.tileD };
}
function tilePoints(g, x, y) {
  const p = project(g, x, y);
  return {
    a: p,
    b: { x: p.x + g.tileW, y: p.y },
    c: { x: p.x + g.tileW + g.slant, y: p.y + g.tileD },
    d: { x: p.x + g.slant, y: p.y + g.tileD }
  };
}
function anchor(g, x, y) {
  const p = project(g, x, y);
  return { x: p.x + g.tileW / 2 + g.slant / 2, y: p.y + g.tileD + 1 };
}

function drawBackdrop(ctx, time) {
  rect(ctx, C.space, 0, 0, WIDTH, HEIGHT);
  rect(ctx, C.rockDark, 0, 0, WIDTH, 128);
  rect(ctx, C.outline, 0, 118, WIDTH, 10);
  // Large back-wall blocks.
  for (let y = 8; y < 116; y += 18) {
    const offset = ((y / 18) % 2) ? -17 : 0;
    for (let x = offset; x < WIDTH; x += 52) {
      rect(ctx, C.rock, x + 2, y + 2, 48, 14);
      rect(ctx, C.rockLit, x + 4, y + 3, 43, 2);
      rect(ctx, C.outline, x, y + 16, 52, 2);
      rect(ctx, C.rockDark, x + 49, y, 3, 18);
    }
  }
  // Recessed central arch; it makes the camera feel side-facing rather than overhead.
  rect(ctx, C.outline, WIDTH / 2 - 61, 38, 122, 82);
  rect(ctx, C.space, WIDTH / 2 - 54, 46, 108, 74);
  rect(ctx, C.purple, WIDTH / 2 - 47, 53, 94, 67);
  rect(ctx, C.rockDark, WIDTH / 2 - 35, 66, 70, 54);
  rect(ctx, C.outline, WIDTH / 2 - 7, 72, 14, 48);
  // Torches and pixel glow.
  const flick = Math.floor(time * 8) % 2;
  for (const tx of [56, WIDTH - 74]) {
    rect(ctx, C.lava, tx - 10 - flick, 63 - flick, 28 + flick * 2, 28 + flick * 2);
    ctx.save(); ctx.globalAlpha = .18; rect(ctx, C.yellow, tx - 18, 55, 44, 45); ctx.restore();
    drawSprite(ctx, 'torch', tx, 68, 2);
  }
  // Floor void and a strong horizon line.
  rect(ctx, C.outline, 0, 126, WIDTH, HEIGHT - 126);
  rect(ctx, C.rockDark, 0, 130, WIDTH, HEIGHT - 130);
  for (let y = 140; y < HEIGHT; y += 21) rect(ctx, C.space, 0, y, WIDTH, 2);
}

function drawFloorTile(ctx, g, x, y, walls, pits, hero, alt) {
  const pts = tilePoints(g, x, y);
  const tileKey = key(x, y), isWall = walls.has(tileKey);
  if (isWall) return;
  if (pits.has(tileKey)) {
    quad(ctx, C.outline, pts.a, pts.b, pts.c, pts.d);
    quad(ctx, C.space, { x:pts.a.x+3,y:pts.a.y+2 }, { x:pts.b.x-3,y:pts.b.y+2 }, { x:pts.c.x-5,y:pts.c.y-2 }, { x:pts.d.x+5,y:pts.d.y-2 }, .98);
    return;
  }
  const dist = Math.abs(hero.x - x) + Math.abs(hero.y - y);
  const base = alt ? C.rock : C.rockDark;
  quad(ctx, base, pts.a, pts.b, pts.c, pts.d);
  quad(ctx, alt ? C.rockLit : C.rock, { x: pts.a.x + 2, y: pts.a.y + 2 }, { x: pts.b.x - 2, y: pts.b.y + 2 }, { x: pts.c.x - 3, y: pts.c.y - 2 }, { x: pts.d.x + 3, y: pts.d.y - 2 }, .92);
  line(ctx, C.outline, pts.d.x, pts.d.y, pts.c.x, pts.c.y, 2, .7);
  if ((x * 3 + y * 5) % 5 === 0) {
    line(ctx, C.rockDark, pts.a.x + g.tileW * .38, pts.a.y + 4, pts.a.x + g.tileW * .57, pts.a.y + g.tileD - 3, 1, .85);
  }
  if (dist > 5) {
    ctx.save(); ctx.globalAlpha = Math.min(.22, (dist - 5) * .04); ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(pts.a.x, pts.a.y); ctx.lineTo(pts.b.x, pts.b.y); ctx.lineTo(pts.c.x, pts.c.y); ctx.lineTo(pts.d.x, pts.d.y); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

function drawWallBlock(ctx, g, x, y, frontCutaway) {
  const pts = tilePoints(g, x, y);
  const h = frontCutaway ? 10 : g.wallH;
  const top = {
    a: { x: pts.a.x, y: pts.a.y - h }, b: { x: pts.b.x, y: pts.b.y - h },
    c: { x: pts.c.x, y: pts.c.y - h }, d: { x: pts.d.x, y: pts.d.y - h }
  };
  // top, front and side faces
  quad(ctx, C.rockLit, top.a, top.b, top.c, top.d);
  quad(ctx, C.rock, top.d, top.c, pts.c, pts.d);
  quad(ctx, C.rockDark, top.b, top.c, pts.c, pts.b);
  line(ctx, C.outline, top.d.x, top.d.y, top.c.x, top.c.y, 2);
  line(ctx, C.outline, pts.d.x, pts.d.y, pts.c.x, pts.c.y, 2);
  if (!frontCutaway) {
    // block seams on the vertical face
    const yy = top.d.y + Math.floor(h * .52);
    line(ctx, C.rockDark, top.d.x + 2, yy, top.c.x - 2, yy, 2, .9);
    const seamX = Math.round((top.d.x + top.c.x) / 2);
    line(ctx, C.rockDark, seamX, top.d.y + 2, seamX + 2, yy - 1, 1, .8);
  }
}

function hpBar(ctx, entity, centerX, topY, width) {
  const max = Math.max(1, entity.maxHp || entity.hp || 1), ratio = clamp01(entity.hp / max);
  rect(ctx, C.outline, centerX - width / 2, topY, width, 5);
  rect(ctx, ratio > .5 ? C.greenLit : ratio > .25 ? C.yellow : C.red, centerX - width / 2 + 1, topY + 1, Math.max(0, Math.floor((width - 2) * ratio)), 3);
}

function motionPosition(entity, motion, now) {
  if (!motion || !motion.from || !motion.to || !Number.isFinite(motion.start)) return { x: entity.x, y: entity.y };
  const duration = Math.max(1, Number(motion.duration) || 280);
  const t = ease((now - motion.start) / duration);
  if (t >= 1) return { x: entity.x, y: entity.y };
  return { x: lerp(motion.from.x, motion.to.x, t), y: lerp(motion.from.y, motion.to.y, t) };
}

function drawGroundRune(ctx, g, entity, color) {
  const a = anchor(g, entity.x, entity.y);
  line(ctx, color, a.x - 13, a.y - 2, a.x, a.y + 3, 2, .75);
  line(ctx, color, a.x, a.y + 3, a.x + 13, a.y - 2, 2, .75);
}

function drawExit(ctx, g, exit, time) {
  if (!exit) return;
  const a = anchor(g, exit.x, exit.y), pulse = Math.floor(time * 5) % 2;
  if (exit.kind === 'stairs') {
    drawSprite(ctx, 'stairs', a.x - 18, a.y - 20, 2);
    ctx.save(); ctx.globalAlpha = .22; rect(ctx, C.cyan, a.x - 18, a.y - 4, 38, 6); ctx.restore();
    return;
  }
  ctx.save(); ctx.globalAlpha = .3; rect(ctx, C.cyan, a.x - 18 - pulse, a.y - 9 - pulse, 36 + pulse * 2, 9 + pulse); ctx.restore();
  drawSprite(ctx, 'exit', a.x - 10, a.y - 24, 2);
}

function drawTrap(ctx, g, trap) {
  const a = anchor(g, trap.x, trap.y);
  drawSprite(ctx, trap.disarmed ? 'trap-safe' : 'trap-active', a.x - 12, a.y - 18, 2);
}
function drawCycleTrap(ctx, g, trap) {
  const a = anchor(g, trap.x, trap.y), id = trap.active ? 'cycle-trap-active' : 'cycle-trap-safe';
  drawSprite(ctx, id, a.x - 12, a.y - 18, 2);
}
function drawPlatform(ctx, g, item) {
  const a = anchor(g, item.x, item.y), sz = spriteSize('moving-platform', 2);
  drawSprite(ctx, 'moving-platform', a.x - sz.width / 2, a.y - sz.height + 7, 2);
}
function drawQuestToken(ctx, g, item, time) {
  if (item.collected) return;
  const a = anchor(g, item.x, item.y), bob = Math.floor(time * 6) % 2, sz = spriteSize('quest-token', 2);
  drawSprite(ctx, 'quest-token', a.x - sz.width / 2, a.y - sz.height - bob + 2, 2);
}
function drawRuneCore(ctx, g, item, time) {
  if (!item || item.heldBy) return;
  const a = anchor(g, item.x, item.y), bob = Math.floor(time * 6) % 2, sz = spriteSize('rune-core', 2);
  drawGroundRune(ctx, g, item, C.yellow);
  drawSprite(ctx, 'rune-core', a.x - sz.width / 2, a.y - sz.height - bob + 2, 2);
}
function drawPushBlock(ctx, g, item) {
  const a = anchor(g, item.x, item.y), sz = spriteSize('push-block', 2);
  drawSprite(ctx, 'push-block', a.x - sz.width / 2, a.y - sz.height + 2, 2);
}
function drawCompanion(ctx, g, item) {
  if (!item) return;
  const a = anchor(g, item.x, item.y), sz = spriteSize('companion', 3);
  drawGroundRune(ctx, g, item, C.purple);
  drawSprite(ctx, 'companion', a.x - sz.width / 2, a.y - sz.height + 2, 3);
  if (item.carrying) { const core = spriteSize('rune-core', 1); drawSprite(ctx, 'rune-core', a.x - core.width / 2, a.y - sz.height - core.height - 3, 1); }
  if (item.guarding) { ctx.save(); ctx.globalAlpha=.65; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(a.x-17,a.y-sz.height-2,34,sz.height+5); ctx.restore(); }
}
function drawKey(ctx, g, item, time) {
  if (item.collected) return;
  const a = anchor(g, item.x, item.y), bob = Math.floor(time * 6) % 2;
  drawSprite(ctx, 'key', a.x - 10, a.y - 24 - bob, 2);
}
function drawDoor(ctx, g, door) {
  const a = anchor(g, door.x, door.y), id = door.open ? 'door-open' : 'door-closed';
  const sz = spriteSize(id, 3);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 3, 3);
}
function drawChest(ctx, g, chest) {
  const a = anchor(g, chest.x, chest.y), id = chest.open ? 'chest-open' : 'chest-closed';
  const sz = spriteSize(id, 2);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 2, 2);
}
function drawLever(ctx, g, item) {
  const a = anchor(g, item.x, item.y), id = item.active ? 'lever-on' : 'lever-off', sz = spriteSize(id, 2);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 2, 2);
}
function drawPlate(ctx, g, item) {
  const a = anchor(g, item.x, item.y), id = item.active ? 'plate-on' : 'plate-off', sz = spriteSize(id, 2);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 5, 2);
}
function drawRuneGate(ctx, g, item) {
  const a = anchor(g, item.x, item.y), id = item.open ? 'rune-gate-open' : 'rune-gate-closed', sz = spriteSize(id, 3);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 3, 3);
}
function drawCrate(ctx, g, item) {
  if (item.broken) return;
  const a = anchor(g, item.x, item.y), sz = spriteSize('crate', 2);
  drawSprite(ctx, 'crate', a.x - sz.width / 2, a.y - sz.height + 2, 2);
}
function drawNpc(ctx, g, item) {
  const a = anchor(g, item.x, item.y), id = item.helped ? 'npc-helped' : 'npc', sz = spriteSize(id, 3);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 2, 3);
  if (!item.helped) { rect(ctx, C.yellow, a.x - 2, a.y - sz.height - 10, 4, 7); rect(ctx, C.yellow, a.x - 2, a.y - sz.height - 1, 4, 4); }
}

function enemySprite(enemy) {
  if (enemy.type === 'golem') return 'golem';
  if (enemy.type === 'goblin') return 'goblin';
  if (enemy.type === 'bulwark') return 'bulwark';
  if (enemy.type === 'viper') return 'viper';
  if (enemy.type === 'archer') return 'archer';
  if (enemy.type === 'runeWarden') return 'runeWarden';
  if (enemy.type === 'relicHydra') return 'relicHydra';
  if (enemy.type === 'circuitGuardian') return 'circuitGuardian';
  if (enemy.type === 'emberImp') return 'emberImp';
  if (enemy.type === 'frostMite') return 'frostMite';
  return 'slime';
}

function drawEnemyBadges(ctx, enemy, a, topY, time) {
  let x = a.x + 18;
  if ((enemy.armor || 0) > 0) {
    rect(ctx, C.outline, x - 8, topY - 1, 15, 12);
    rect(ctx, C.steel, x - 6, topY + 1, 11, 7);
    rect(ctx, C.white, x - 3, topY + 2, 5, 2);
    x += 18;
  }
  if (enemy.statuses && enemy.statuses.burn > 0) {
    rect(ctx, C.lava, x - 6, topY + 1, 5, 8); rect(ctx, C.yellow, x - 4, topY - 2, 3, 5); x += 12;
  }
  if (enemy.statuses && enemy.statuses.freeze > 0) {
    rect(ctx, C.cyan, x - 7, topY, 12, 9); rect(ctx, C.white, x - 4, topY + 2, 6, 2); x += 15;
  }
  if (enemy.intent === 'shot') {
    const pulse = Math.floor(time * 8) % 2;
    rect(ctx, C.outline, x - 8 - pulse, topY - 3 - pulse, 17 + pulse * 2, 15 + pulse * 2);
    rect(ctx, C.red, x - 5, topY, 11, 8);
    line(ctx, C.white, x - 3, topY + 4, x + 4, topY + 4, 2);
    line(ctx, C.white, x + 2, topY + 1, x + 5, topY + 4, 2);
    line(ctx, C.white, x + 2, topY + 7, x + 5, topY + 4, 2);
  }
}

function drawEnemy(ctx, g, enemy, time, motion, anchors, selected = false) {
  if (enemy.hp <= 0) return;
  const pos = motionPosition(enemy, motion, time * 1000), a = anchor(g, pos.x, pos.y), id = enemySprite(enemy), scale = id === 'runeWarden' || id === 'relicHydra' || id === 'circuitGuardian' ? 4 : 3;
  const sz = spriteSize(id, scale), bounce = id === 'slime' ? Math.floor(time * 7) % 2 : 0;
  if (selected) {
    ctx.save(); ctx.globalAlpha = .65; ctx.strokeStyle = HEX[C.yellow]; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(Math.round(a.x), Math.round(a.y - 4), Math.max(17, sz.width / 2 + 4), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height - bounce + 1, scale);
  hpBar(ctx, enemy, a.x, a.y - sz.height - 7, Math.max(28, sz.width));
  drawEnemyBadges(ctx, enemy, a, a.y - sz.height - 24, time);
  anchors.set(enemy.id, { x: a.x, y: a.y - sz.height / 2 });
}

function directionGlyph(ctx, g, hero) {
  const a = anchor(g, hero.x, hero.y), color = C.yellow;
  let dx = 0, dy = 0;
  if (hero.dir === 'E') dx = 10;
  else if (hero.dir === 'W') dx = -10;
  else if (hero.dir === 'N') { dx = -5; dy = -5; }
  else { dx = 5; dy = 5; }
  rect(ctx, color, a.x + dx - 2, a.y + dy - 3, 4, 4);
}

function drawHero(ctx, g, hero, options, anchors) {
  const time = Number(options.time) || 0, now = Number(options.now) || time * 1000;
  const pos = motionPosition(hero, options.heroMotion, now);
  const a = anchor(g, pos.x, pos.y), tick = Math.floor(time * 8);
  const state = options.heroState || 'idle';
  const id = state === 'attack' ? 'hero-attack' : state === 'hurt' ? 'hero-hurt' : state === 'walk' ? (tick % 2 ? 'hero-walk-1' : 'hero-walk-2') : 'hero-idle';
  const scale = 3, sz = spriteSize(id, scale), accent = nearestIndex(options.kidColor || '#39d0c8');
  const flip = hero.dir === 'W';
  const poisoned = hero.statuses && hero.statuses.poison > 0, warded = hero.statuses && hero.statuses.ward > 0;
  drawGroundRune(ctx, g, { x: pos.x, y: pos.y }, poisoned ? C.greenLit : warded ? C.purple : C.cyan);
  drawSprite(ctx, id, a.x - sz.width / 2, a.y - sz.height + 2, scale, { accent, flip });
  if (hero.carrying) { const core = spriteSize('rune-core', 1); drawSprite(ctx, 'rune-core', a.x - core.width / 2, a.y - sz.height - core.height - 3, 1); }
  hpBar(ctx, hero, a.x, a.y - sz.height - 8, 34);
  if (hero.guarding) { rect(ctx, C.outline, a.x - 25, a.y - 35, 9, 17); rect(ctx, C.steel, a.x - 23, a.y - 33, 5, 13); }
  if (poisoned) { rect(ctx, C.greenLit, a.x + 18, a.y - sz.height - 5, 5, 5); rect(ctx, C.green, a.x + 24, a.y - sz.height - 10, 3, 3); }
  if (warded) { ctx.save(); ctx.globalAlpha = .45; ctx.strokeStyle = HEX[C.purple]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(Math.round(a.x), Math.round(a.y - sz.height / 2), Math.max(18, sz.width / 2 + 5), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  directionGlyph(ctx, g, { ...hero, x: pos.x, y: pos.y });
  anchors.set('hero', { x: a.x, y: a.y - sz.height / 2 });
}

function drawAttackFx(ctx, options, anchors) {
  const fx = options.fx;
  if (!fx || !Number.isFinite(fx.start)) return;
  const now = Number(options.now) || (Number(options.time) || 0) * 1000;
  const t = (now - fx.start) / Math.max(1, Number(fx.duration) || 320);
  if (t < 0 || t > 1) return;
  const a = anchors.get(fx.target) || anchors.get('hero');
  if (!a) return;
  const phase = Math.floor(t * 4);
  if (fx.kind === 'signal') {
    const from = anchors.get(fx.actor) || anchors.get('hero');
    const to = anchors.get(fx.target) || anchors.get(fx.to) || (fx.actor === 'hero' ? anchors.get('companion') : anchors.get('hero'));
    if (!from || !to) return;
    line(ctx, C.cyan, from.x, from.y, to.x, to.y, 2);
    const px = from.x + (to.x - from.x) * t, py = from.y + (to.y - from.y) * t;
    rect(ctx, C.white, px - 4, py - 4, 8, 8);
    rect(ctx, C.purple, px - 2, py - 2, 4, 4);
    return;
  }
  if (fx.kind === 'state') {
    const glow = 12 + phase * 3;
    line(ctx, C.cyan, a.x - glow, a.y - 24, a.x + glow, a.y - 24, 2);
    rect(ctx, C.white, a.x - 3, a.y - 29 - phase, 6, 6);
  } else if (fx.kind === 'attack') {
    const spread = 6 + phase * 4;
    line(ctx, C.white, a.x - spread, a.y - 9, a.x + spread, a.y + 8, 3);
    line(ctx, C.yellow, a.x - spread + 3, a.y - 12, a.x + spread + 3, a.y + 5, 2);
  } else if (fx.kind === 'trap') {
    for (let i = 0; i < 4; i++) rect(ctx, i % 2 ? C.red : C.lava, a.x - 12 + i * 7, a.y - 10 - phase * 2, 4, 4);
  } else if (fx.kind === 'shot') {
    line(ctx, C.red, a.x - 28 + phase * 5, a.y - 5, a.x + 8, a.y - 5, 3);
    line(ctx, C.white, a.x - 8, a.y - 8, a.x + 8, a.y - 5, 1);
  } else if (fx.kind === 'poison') {
    for (let i = 0; i < 5; i++) rect(ctx, i % 2 ? C.greenLit : C.green, a.x - 12 + i * 6, a.y - 8 - ((phase + i) % 3) * 4, 4, 4);
  } else if (fx.kind === 'fire') {
    for (let i = 0; i < 6; i++) rect(ctx, i % 2 ? C.yellow : C.lava, a.x - 15 + i * 6, a.y - 8 - ((phase + i) % 4) * 5, 4, 6);
  } else if (fx.kind === 'frost') {
    for (let i = 0; i < 5; i++) {
      const x = a.x - 14 + i * 7, y = a.y - 14 - ((phase + i) % 2) * 3;
      line(ctx, C.cyan, x - 3, y, x + 3, y, 2); line(ctx, C.white, x, y - 3, x, y + 3, 2);
    }
  } else if (fx.kind === 'guard') {
    rect(ctx, C.steel, a.x - 19 - phase, a.y - 24 - phase, 38 + phase * 2, 31 + phase * 2);
    rect(ctx, C.space, a.x - 15 - phase, a.y - 20 - phase, 30 + phase * 2, 23 + phase * 2);
  } else if (fx.kind === 'open') {
    for (let i = 0; i < 5; i++) rect(ctx, i % 2 ? C.yellow : C.white, a.x - 16 + i * 8, a.y - 16 - phase * 2, 3, 3);
  }
}

function drawInventoryPlaque(ctx, hero) {
  const consumables = hero.consumables || {};
  rect(ctx, C.outline, 8, HEIGHT - 27, 174, 19);
  rect(ctx, C.woodDark, 10, HEIGHT - 25, 170, 15);
  drawSprite(ctx, 'key', 14, HEIGHT - 25, 1);
  for (let i = 0; i < Math.min(hero.keys || 0, 3); i++) rect(ctx, C.yellow, 30 + i * 7, HEIGHT - 19, 4, 3);
  drawSprite(ctx, 'potion', 54, HEIGHT - 25, 1);
  for (let i = 0; i < Math.min(consumables.healing || hero.potions || 0, 3); i++) rect(ctx, C.cyan, 70 + i * 7, HEIGHT - 19, 4, 3);
  drawSprite(ctx, 'antidote', 94, HEIGHT - 25, 1);
  for (let i = 0; i < Math.min(consumables.antidote || hero.antidotes || 0, 3); i++) rect(ctx, C.greenLit, 110 + i * 7, HEIGHT - 19, 4, 3);
  drawSprite(ctx, 'ward', 134, HEIGHT - 25, 1);
  for (let i = 0; i < Math.min(consumables.ward || hero.wards || 0, 3); i++) rect(ctx, C.purple, 150 + i * 7, HEIGHT - 19, 4, 3);
}

/** Draw an angled side/three-quarter dungeon diorama from a model snapshot. */
export function drawDungeonWorld(canvas, snapshot, options = {}) {
  if (!canvas || !snapshot) return;
  if (canvas.width !== WIDTH) canvas.width = WIDTH;
  if (canvas.height !== HEIGHT) canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const time = Number(options.time) || 0, now = Number(options.now) || time * 1000;
  drawBackdrop(ctx, time);

  const g = geometry(snapshot), walls = wallKeySet(snapshot), pits = pitKeySet(snapshot), hero = snapshot.hero;
  // Floor is always painted before vertical objects.
  for (let y = 0; y < snapshot.height; y++) {
    for (let x = 0; x < snapshot.width; x++) drawFloorTile(ctx, g, x, y, walls, pits, hero, (x + y) % 2);
  }

  // Static floor markings are under actors.
  drawExit(ctx, g, snapshot.exit, time);
  for (const trap of snapshot.traps || []) drawTrap(ctx, g, trap);
  for (const trap of snapshot.cycleTraps || []) drawCycleTrap(ctx, g, trap);
  for (const item of snapshot.movingPlatforms || []) drawPlatform(ctx, g, item);
  for (const item of snapshot.plates || []) drawPlate(ctx, g, item);
  for (const item of snapshot.keys || []) drawKey(ctx, g, item, time);
  for (const item of snapshot.questTokens || []) drawQuestToken(ctx, g, item, time);
  for (const item of snapshot.orbs || []) drawRuneCore(ctx, g, item, time);

  // Everything vertical is depth sorted by logical row, then column.
  const renderables = [];
  for (let y = 0; y < snapshot.height; y++) for (let x = 0; x < snapshot.width; x++) {
    if (walls.has(key(x, y))) renderables.push({ kind: 'wall', x, y, depth: y * 100 + x });
  }
  for (const door of snapshot.doors || []) renderables.push({ kind: 'door', x: door.x, y: door.y, depth: door.y * 100 + door.x, value: door });
  for (const gate of snapshot.runeGates || []) renderables.push({ kind: 'runeGate', x: gate.x, y: gate.y, depth: gate.y * 100 + gate.x + .05, value: gate });
  for (const lever of snapshot.levers || []) renderables.push({ kind: 'lever', x: lever.x, y: lever.y, depth: lever.y * 100 + lever.x + .1, value: lever });
  for (const crate of snapshot.crates || []) if (!crate.broken) renderables.push({ kind: 'crate', x: crate.x, y: crate.y, depth: crate.y * 100 + crate.x + .15, value: crate });
  for (const block of snapshot.pushBlocks || []) renderables.push({ kind: 'pushBlock', x: block.x, y: block.y, depth: block.y * 100 + block.x + .17, value: block });
  for (const npc of snapshot.npcs || []) renderables.push({ kind: 'npc', x: npc.x, y: npc.y, depth: npc.y * 100 + npc.x + .2, value: npc });
  for (const chest of snapshot.chests || []) renderables.push({ kind: 'chest', x: chest.x, y: chest.y, depth: chest.y * 100 + chest.x + .25, value: chest });
  for (const enemy of snapshot.enemies || []) if (enemy.hp > 0) renderables.push({ kind: 'enemy', x: enemy.x, y: enemy.y, depth: enemy.y * 100 + enemy.x + .3, value: enemy });
  if (snapshot.companion) renderables.push({ kind: 'companion', x: snapshot.companion.x, y: snapshot.companion.y, depth: snapshot.companion.y * 100 + snapshot.companion.x + .5, value: snapshot.companion });
  renderables.push({ kind: 'hero', x: hero.x, y: hero.y, depth: hero.y * 100 + hero.x + .6, value: hero });
  renderables.sort((a, b) => a.depth - b.depth);

  const anchors = new Map();
  for (const item of renderables) {
    if (item.kind === 'wall') {
      const front = item.y === snapshot.height - 1;
      drawWallBlock(ctx, g, item.x, item.y, front);
    } else if (item.kind === 'door') drawDoor(ctx, g, item.value);
    else if (item.kind === 'runeGate') drawRuneGate(ctx, g, item.value);
    else if (item.kind === 'lever') drawLever(ctx, g, item.value);
    else if (item.kind === 'crate') drawCrate(ctx, g, item.value);
    else if (item.kind === 'pushBlock') drawPushBlock(ctx, g, item.value);
    else if (item.kind === 'npc') drawNpc(ctx, g, item.value);
    else if (item.kind === 'chest') { drawChest(ctx, g, item.value); anchors.set(item.value.id, anchor(g, item.x, item.y)); }
    else if (item.kind === 'companion') { drawCompanion(ctx, g, item.value); anchors.set('companion', anchor(g,item.x,item.y)); }
    else if (item.kind === 'enemy') {
      const motion = options.enemyMotions && options.enemyMotions[item.value.id];
      drawEnemy(ctx, g, item.value, time, motion, anchors, hero.targetId === item.value.id);
    } else if (item.kind === 'hero') drawHero(ctx, g, item.value, { ...options, now }, anchors);
  }

  // Doors/keys/traps can be FX targets too.
  for (const door of snapshot.doors || []) anchors.set(door.id, anchor(g, door.x, door.y));
  for (const trap of snapshot.traps || []) anchors.set(trap.id, anchor(g, trap.x, trap.y));
  for (const trap of snapshot.cycleTraps || []) anchors.set(trap.id, anchor(g, trap.x, trap.y));
  for (const item of snapshot.keys || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.levers || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.plates || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.runeGates || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.crates || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.pushBlocks || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.questTokens || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.orbs || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.movingPlatforms || []) anchors.set(item.id, anchor(g, item.x, item.y));
  for (const item of snapshot.npcs || []) anchors.set(item.id, anchor(g, item.x, item.y));
  drawAttackFx(ctx, { ...options, now }, anchors);
  drawInventoryPlaque(ctx, hero);

  if (options.paused) {
    ctx.save(); ctx.globalAlpha = .72; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.restore();
    rect(ctx, C.outline, WIDTH / 2 - 40, HEIGHT / 2 - 27, 80, 54);
    rect(ctx, C.sandLit, WIDTH / 2 - 36, HEIGHT / 2 - 23, 72, 46);
    rect(ctx, C.woodDark, WIDTH / 2 - 15, HEIGHT / 2 - 12, 9, 24);
    rect(ctx, C.woodDark, WIDTH / 2 + 6, HEIGHT / 2 - 12, 9, 24);
  }
}

export const DUNGEON_VIEW = Object.freeze({ WIDTH, HEIGHT, geometry });
