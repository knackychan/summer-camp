/* Laboratory of Curiosity screen (lab design D1, D2, D5, D7, D8, D10, D12; slice 04).
   The pure helpers at the top hold the experiment — mix, steps, selection, last
   result — and decide what a Brew does to the profile; they are tested with no DOM.
   mountLab() is the thin DOM + pointer controller around them: it draws the scene
   (lab-view.js), turns taps and drags on its hit rects into helper calls, and talks to
   Code Quest only through `api`, so the Lab never reaches into the dungeon. */
import { createScheduler } from '../../../game-services/scheduler.js';
import { RECIPES, ALCHEMY_STEPS, brewLab } from '../progression.js';
import { runAlchemyCode, recipeToAlchemyCode, recipeById } from '../alchemy-code.js';
import { ALCHEMY_LABELS, ITEM_LABELS, LAB, UI, MESSAGES, labMadeLine, labPagesLine, pairHTML, t } from '../strings.js';
import { spriteURL } from '../pixel-art.js';
import { placeBubbleRect } from '../bubble.js';
import { LAB_INGREDIENTS, LAB_FREE_INGREDIENTS } from './ingredients.js';
import { LAB_RULES } from './rules.js';
import { resolveExperiment, mixHint, LAB_MAX_INGREDIENTS, LAB_MAX_STEPS } from './resolve.js';
import { normalizeLab, recordFound, recordSeen } from './journal.js';
import { drawLab, hitAt } from './lab-view.js';
import { drawLabSprite, labSpriteSize } from './lab-art.js';

const RULE = Object.fromEntries(LAB_RULES.map(rule => [rule.id, rule]));

/* ---------- pure experiment state ---------- */

export function createLabState() {
  return Object.freeze({ mix: Object.freeze([]), steps: Object.freeze([]), selection: null, effect: null, lastResult: null, line: LAB.welcome, newPage: false });
}
const next = (state, patch) => Object.freeze({ ...state, ...patch });

/** Lift a jar / bag item (`jar:<id>` or `bag:<id>`), or put it down again with null. */
export function labSelect(state, hitId) {
  // The first time only: once something is in the cauldron the kid knows the move.
  return next(state, { selection: hitId || null, line: hitId && !state.mix.length ? LAB.picked : state.line });
}

export function labAdd(state, id) {
  if (!Object.hasOwn(LAB_INGREDIENTS, id)) return next(state, { selection: null });
  if (state.mix.length >= LAB_MAX_INGREDIENTS) return next(state, { selection: null, line: LAB.full });
  return next(state, { mix: Object.freeze([...state.mix, id]), selection: null });
}

export function labRemove(state, index) {
  if (!(index >= 0 && index < state.mix.length)) return state;
  return next(state, { mix: Object.freeze(state.mix.filter((_, i) => i !== index)) });
}

export function labStep(state, step) {
  if (!ALCHEMY_STEPS.includes(step)) return state;
  if (state.steps.length >= LAB_MAX_STEPS) return next(state, { line: LAB.full });
  return next(state, { steps: Object.freeze([...state.steps, step]) });
}

export function labUndo(state) {
  return state.steps.length ? next(state, { steps: Object.freeze(state.steps.slice(0, -1)) }) : state;
}

/** ✕ clears the experiment and whatever the last Brew left in the room. */
export function labClear(state) {
  return next(state, { mix: Object.freeze([]), steps: Object.freeze([]), selection: null, effect: null, newPage: false });
}

/**
 * Brew the current experiment. Returns `{ state, profile, changed, potionId, newRule }`:
 * `changed` says whether the profile needs saving, `potionId` names a bottled dungeon
 * potion (the caller tops up the live run). Mix and steps stay, so a kid can change one
 * thing and brew again.
 */
export function labBrew(state, profile, { free = LAB_FREE_INGREDIENTS, now = 0 } = {}) {
  const mix = [...state.mix], steps = [...state.steps];
  if (!mix.length) return { state: next(state, { selection: null, line: LAB.empty }), profile, changed: false, potionId: null, newRule: false };
  const lastIngredient = mix[mix.length - 1];
  let result = resolveExperiment({ ingredients: mix, steps, recipes: RECIPES });
  let practice = false;
  if (result.kind === 'potion') {
    const brewed = brewLab(profile, mix, steps, { free });
    if (brewed.ok) {
      const recipe = recipeById(result.potionId);
      return {
        state: next(state, { selection: null, lastResult: result, newPage: false, line: labMadeLine(recipe.label),
          effect: Object.freeze({ ruleId: 'potion', potionId: result.potionId, intensity: 1, start: now, lastIngredient }) }),
        profile: brewed.profile, changed: true, potionId: result.potionId, newRule: false
      };
    }
    // D5 off and the bag is short: the reaction still plays as a practice brew.
    result = resolveExperiment({ ingredients: mix, steps, recipes: [] });
    practice = true;
  }
  const fresh = !normalizeLab(profile.lab).found.includes(result.ruleId);
  const recorded = recordFound(recordSeen(profile, mix), result.ruleId);
  const line = practice ? LAB.practice : result.hint === 'order' ? LAB.orderHint : RULE[result.ruleId].line;
  return {
    state: next(state, { selection: null, lastResult: practice ? Object.freeze({ ...result, practice: true }) : result, newPage: state.newPage || fresh, line,
      effect: Object.freeze({ ruleId: result.ruleId, intensity: result.intensity, start: now, lastIngredient }) }),
    profile: recorded, changed: recorded !== profile, potionId: null, newRule: fresh
  };
}

/* ---------- DOM controller ---------- */

const LINE_MS = 6000;
// Existing host sounds only (lab design D13); per-family audio is a later phase.
const REACTION_SOUND = Object.freeze({ explosion: 'hit', fireball: 'zap', singularity: 'zap' });
const DRAG_PX = 8;
const BUBBLE_SIDE_CLASSES = ['below', 'side-left', 'side-right', 'caption'];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const button = (act, content, attrs = '') => '<button type="button" data-lab="' + act + '" ' + attrs + '>' + content + '</button>';

const iconCache = new Map();
/** 32×32 icon for a strip slot or drag ghost: bag items reuse the dungeon sprites, shelf items the lab bitmaps. */
function iconURL(id, accent) {
  if (LAB_INGREDIENTS[id] && LAB_INGREDIENTS[id].where === 'bag') return spriteURL(id, accent);
  if (iconCache.has(id)) return iconCache.get(id);
  const { width, height } = labSpriteSize(id), canvas = document.createElement('canvas');
  canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx || !width) return '';
  const scale = Math.max(1, Math.floor(Math.min(32 / width, 32 / height)));
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, Math.floor((32 - width * scale) / 2), Math.floor((32 - height * scale) / 2));
  drawLabSprite(ctx, id, 0, 0);
  const url = canvas.toDataURL(); iconCache.set(id, url); return url;
}

/**
 * Mounts the Lab into `root`. `api`: { profile(), save(profile), onPotion(id), sfx, kidColor(),
 * canScript(), reduced, onExit() }. Returns { destroy(), render(), snapshot() }.
 */
export function mountLab(root, api) {
  const el = document.createElement('section');
  el.className = 'cq-lab';
  el.innerHTML = '<div class="cq-lab-scene"><canvas></canvas><div class="cq-bubble cq-lab-bubble" hidden></div>' +
    '<span class="cq-lab-tag" hidden></span><div class="cq-lab-counts" aria-hidden="true"></div></div>' +
    '<div class="cq-lab-dock"><div class="cq-lab-slots" role="group"></div><div class="cq-lab-steps" role="list"></div>' +
    '<div class="cq-lab-tools"></div><div class="cq-lab-brewbox"></div></div>' +
    '<div class="cq-lab-sheet" role="dialog" hidden></div><p class="cq-sr" role="status" aria-live="polite"></p>';
  root.appendChild(el);
  const scene = el.querySelector('.cq-lab-scene'), canvas = el.querySelector('canvas'), bubble = el.querySelector('.cq-lab-bubble');
  const scheduler = createScheduler();
  let state = createLabState(), view = null, lineAt = performance.now(), bubbleSide = null, press = null, ghost = null;
  let script = { open: false, code: '', error: null };
  let destroyed = false;

  const accent = () => (api.kidColor ? api.kidColor() : '#39d0c8');
  const sfx = name => { const fx = api.sfx; if (fx && typeof fx[name] === 'function') try { fx[name](); } catch (e) { /* sound is optional */ } };

  function say(line) {
    state = next(state, { line });
    lineAt = performance.now();
    bubble.innerHTML = pairHTML(line);
    el.querySelector('.cq-sr').innerHTML = pairHTML(line);
  }
  function apply(nextState) {
    const lineChanged = nextState.line !== state.line;
    state = nextState;
    if (lineChanged) say(state.line);
    renderDock();
    draw();
  }

  /* ----- drawing ----- */
  function draw(time = performance.now()) {
    if (destroyed) return;
    const box = scene.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const hint = mixHint(state.mix, state.steps);
    view = drawLab(canvas, {
      cssWidth: box.width, cssHeight: box.height, dpr: window.devicePixelRatio || 1, now: time,
      mix: state.mix, steps: state.steps, tint: hint.tint, shaky: hint.shaky, selection: state.selection,
      effect: state.effect, reduced: !!api.reduced
    });
    placeBubble(time, box);
    placeTag();
    placeCounts();
  }
  function placeBubble(time, box) {
    const visible = !script.open && time - lineAt < LINE_MS;
    if (bubble.hidden === visible) bubble.hidden = !visible;
    if (!visible || !view) return;
    const owl = view.hits.find(hit => hit.id === 'owl'), cauldron = view.hits.find(hit => hit.id === 'cauldron');
    const spot = placeBubbleRect({
      box: { w: box.width, h: box.height }, size: { w: bubble.offsetWidth, h: bubble.offsetHeight },
      hero: owl ? { box: owl } : null, hard: cauldron ? [cauldron] : [],
      soft: view.hits.filter(hit => hit.kind === 'jar' || hit.kind === 'book'), previous: bubbleSide
    });
    bubbleSide = spot.side;
    for (const cls of BUBBLE_SIDE_CLASSES) bubble.classList.toggle(cls, spot.side === cls.replace('side-', ''));
    bubble.style.transform = 'translate(' + spot.x + 'px,' + spot.y + 'px)';
    bubble.style.setProperty('--tail', spot.tail + 'px');
  }
  // "New page!" sits on the Journal book until the kid taps it.
  function placeTag() {
    const tag = el.querySelector('.cq-lab-tag'), book = view && view.hits.find(hit => hit.id === 'book');
    const show = !!(state.newPage && book);
    if (tag.hidden === show) tag.hidden = !show;
    if (!show) return;
    if (!tag.innerHTML) tag.innerHTML = pairHTML(LAB.newPage);
    tag.style.transform = 'translate(' + Math.round(book.x) + 'px,' + Math.round(Math.max(4, book.y - 34)) + 'px)';
  }
  // Bag counts show only once ingredients cost something again (D5 off).
  function placeCounts() {
    const layer = el.querySelector('.cq-lab-counts');
    if (LAB_FREE_INGREDIENTS || !view) { if (layer.innerHTML) layer.innerHTML = ''; return; }
    const bag = api.profile().ingredients || {};
    const html = view.hits.filter(hit => hit.kind === 'bag').map(hit => '<span style="transform:translate(' + Math.round(hit.x + hit.w - 22) + 'px,' + Math.round(hit.y + hit.h - 18) + 'px)">×' + (bag[hit.ingredient] || 0) + '</span>').join('');
    if (layer.innerHTML !== html) layer.innerHTML = html;
  }

  /* ----- dock: cauldron slots, step trail, undo / clear, Brew ----- */
  function renderDock() {
    const slots = [];
    for (let i = 0; i < LAB_MAX_INGREDIENTS; i++) {
      const id = state.mix[i];
      slots.push(id
        ? button('remove:' + i, '<img src="' + iconURL(id, accent()) + '" alt="">', 'class="cq-lab-slot" aria-label="' + esc(t(LAB.takeOut) + ': ' + t(LAB_INGREDIENTS[id].label)) + '"')
        : '<span class="cq-lab-slot empty" aria-hidden="true"></span>');
    }
    const slotBox = el.querySelector('.cq-lab-slots');
    slotBox.setAttribute('aria-label', t(LAB.cauldron));
    slotBox.innerHTML = slots.join('');
    el.querySelector('.cq-lab-steps').innerHTML = state.steps.length
      ? state.steps.map((step, i) => '<span role="listitem"><b>' + (i + 1) + '</b>' + pairHTML(ALCHEMY_LABELS[step]) + '</span>').join('')
      : '<i>' + pairHTML(LAB.noSteps) + '</i>';
    el.querySelector('.cq-lab-tools').innerHTML =
      button('undo', '↶', 'class="cq-lab-tool" aria-label="' + esc(t(LAB.undoStep)) + '"' + (state.steps.length ? '' : ' disabled')) +
      button('clear', '✕', 'class="cq-lab-tool" aria-label="' + esc(t(LAB.clear)) + '"' + (state.mix.length || state.steps.length || state.effect ? '' : ' disabled'));
    el.querySelector('.cq-lab-brewbox').innerHTML = button('brew', '▶ <b>' + pairHTML(LAB.brew) + '</b>', 'class="cq-lab-brew"');
    canvas.setAttribute('aria-label', t(LAB.title));
  }

  /* ----- potion script sheet (D10): same language and gating, brews free under D5 ----- */
  function renderSheet() {
    const sheet = el.querySelector('.cq-lab-sheet');
    sheet.hidden = !script.open;
    if (!script.open) { sheet.innerHTML = ''; return; }
    const profile = api.profile();
    const known = RECIPES.filter(recipe => profile.discoveredRecipes.includes(recipe.id));
    sheet.setAttribute('aria-label', t(UI.potionCode));
    sheet.innerHTML = '<div class="cq-lab-sheet-head"><h3>' + pairHTML(UI.potionCode) + '</h3>' + button('script:close', pairHTML(UI.close)) + '</div>' +
      (known.length ? '<div class="cq-lab-sheet-recipes"><b>' + pairHTML(LAB.scriptRecipes) + '</b>' + known.map(recipe => button('script:load:' + recipe.id, '<img src="' + spriteURL(recipe.id === 'healing' ? 'potion' : recipe.id === 'focus' ? 'moonBerry' : recipe.id, accent()) + '" alt="">' + pairHTML(recipe.label), 'class="cq-code-chip"')).join('') + '</div>' : '') +
      '<textarea class="cq-lab-code-input" spellcheck="false" autocomplete="off">' + esc(script.code) + '</textarea>' +
      (script.error ? '<div class="cq-code-error"><b>' + pairHTML(MESSAGES.potionCodeError) + '</b><span>' + esc(script.error.message) + '</span><small>Ln ' + script.error.line + '</small></div>' : '') +
      '<div class="cq-dialog-actions">' + button('script:run', pairHTML(UI.runPotionCode), 'class="cq-primary"') + '</div>';
  }
  function runScript() {
    const input = el.querySelector('.cq-lab-code-input');
    if (input) script.code = input.value;
    const result = runAlchemyCode(api.profile(), script.code, { free: LAB_FREE_INGREDIENTS });
    if (!result.ok) {
      script.error = result.error || { message: result.reason === 'need-three' ? 'Add exactly three ingredients in code.' : result.reason === 'wrong-process' ? 'The bench process order does not match a recipe.' : 'The potion script did not produce a known recipe.', line: 1 };
      renderSheet(); return;
    }
    script.error = null; script.open = false;
    api.save(result.profile);
    if (api.onPotion) api.onPotion(result.recipe.id);
    sfx('good');
    state = next(state, { effect: Object.freeze({ ruleId: 'potion', potionId: result.recipe.id, intensity: 1, start: performance.now(), lastIngredient: null }) });
    renderSheet(); say(labMadeLine(result.recipe.label)); renderDock(); draw();
  }

  /* ----- actions ----- */
  function brew() {
    const out = labBrew(state, api.profile(), { free: LAB_FREE_INGREDIENTS, now: performance.now() });
    if (out.changed) api.save(out.profile);
    if (out.potionId && api.onPotion) api.onPotion(out.potionId);
    if (out.state.lastResult) sfx(out.potionId || out.newRule ? 'good' : REACTION_SOUND[out.state.lastResult.ruleId] || 'pop');
    apply(out.state);
    // The same line twice in a row (brew again) still needs the owl to speak.
    if (out.state.lastResult) say(out.state.line);
  }
  function tapHit(hit) {
    if (!hit) return;
    if (hit.kind === 'cauldron') {
      const picked = view && state.selection ? view.hits.find(h => h.id === state.selection) : null;
      if (picked && picked.ingredient) { const before = state.mix.length; apply(labAdd(state, picked.ingredient)); if (state.mix.length > before) sfx('pop'); }
      return;
    }
    if (hit.kind === 'prop') { const before = state.steps.length; apply(labStep(state, hit.step)); if (state.steps.length > before) sfx('pop'); return; }
    if (hit.kind === 'owl') { say(state.line); return; }
    if (hit.kind === 'book') {
      state = next(state, { newPage: false });
      say(labPagesLine(normalizeLab(api.profile().lab).found.length, LAB_RULES.length)); draw(); return;
    }
    if (hit.kind === 'scroll') {
      if (!api.canScript()) { say(LAB.scriptLocked); return; }
      script.open = true; script.error = null;
      if (!script.code) { const first = RECIPES.find(recipe => api.profile().discoveredRecipes.includes(recipe.id)); script.code = recipeToAlchemyCode(first || null); }
      renderSheet(); draw();
    }
  }
  function act(name) {
    if (name.startsWith('remove:')) { apply(labRemove(state, Number(name.slice(7)))); return; }
    if (name === 'undo') { apply(labUndo(state)); return; }
    if (name === 'clear') { apply(labClear(state)); return; }
    if (name === 'brew') { brew(); return; }
    if (name === 'script:close') { script.open = false; renderSheet(); return; }
    if (name === 'script:run') { runScript(); return; }
    if (name.startsWith('script:load:')) {
      const recipe = recipeById(name.slice(12));
      if (recipe && api.profile().discoveredRecipes.includes(recipe.id)) { script.code = recipeToAlchemyCode(recipe); script.error = null; renderSheet(); }
    }
  }

  /* ----- pointer input on the scene: tap, or drag a jar / bag item onto the cauldron ----- */
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    if (e.button !== 0 || !view || press) return;
    const p = local(e), hit = hitAt(view.hits, p.x, p.y);
    if (!hit) { if (state.selection) apply(labSelect(state, null)); return; }
    e.preventDefault();
    if (hit.kind === 'jar' || hit.kind === 'bag') {
      press = { hit, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, wasSelected: state.selection === hit.id };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older WebViews */ }
      apply(labSelect(state, hit.id));
      return;
    }
    tapHit(hit);
  }
  function onMove(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    if (!press.moved && Math.abs(e.clientX - press.x0) + Math.abs(e.clientY - press.y0) > DRAG_PX) {
      press.moved = true;
      ghost = document.createElement('div'); ghost.className = 'cq-drag-ghost';
      ghost.innerHTML = '<img src="' + iconURL(press.hit.ingredient, accent()) + '" alt="">';
      el.appendChild(ghost);
    }
    if (ghost) ghost.style.transform = 'translate(' + (e.clientX - 24) + 'px,' + (e.clientY - 24) + 'px)';
  }
  function onUp(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    const done = press; press = null;
    if (ghost) { ghost.remove(); ghost = null; }
    if (!done.moved) { if (done.wasSelected) apply(labSelect(state, null)); return; }
    const p = local(e), over = e.type === 'pointerup' ? hitAt(view && view.hits, p.x, p.y) : null;
    if (over && over.kind === 'cauldron') { const before = state.mix.length; apply(labAdd(state, done.hit.ingredient)); if (state.mix.length > before) sfx('pop'); }
    else apply(labSelect(state, null));
  }
  function onDockDown(e) {
    const target = e.target.closest('button[data-lab]');
    if (!target || target.disabled || e.button !== 0) return;
    e.preventDefault(); act(target.dataset.lab);
  }
  function onDockClick(e) {
    const target = e.target.closest('button[data-lab]');
    // Keyboard / assistive activation only: a click that came from a pointer was already handled on pointerdown.
    if (target && !target.disabled && e.detail === 0 && !e.pointerType) act(target.dataset.lab);
  }
  function onInput(e) {
    if (e.target.classList && e.target.classList.contains('cq-lab-code-input')) { script.code = e.target.value; script.error = null; }
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  el.addEventListener('pointerdown', e => { if (e.target !== canvas) onDockDown(e); });
  el.addEventListener('click', onDockClick);
  el.addEventListener('input', onInput);
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
  if (resize) resize.observe(scene);
  let last = 0;
  scheduler.frame(time => { if (time - last > 48) { last = time; draw(time); } });

  say(state.line); renderDock(); renderSheet();

  return {
    render() { say(state.line); el.querySelector('.cq-lab-tag').innerHTML = pairHTML(LAB.newPage); renderDock(); renderSheet(); draw(); },
    /** Closes the script sheet if open; returns true when it did (Back closes the sheet first). */
    closeSheet() { if (!script.open) return false; script.open = false; renderSheet(); return true; },
    destroy() {
      destroyed = true;
      scheduler.cancelAll();
      if (resize) resize.disconnect();
      if (ghost) ghost.remove();
      el.remove();
    },
    snapshot() {
      return {
        open: true, mix: [...state.mix], steps: [...state.steps], selection: state.selection, effect: state.effect,
        lastResult: state.lastResult, newPage: state.newPage, line: state.line, script: script.open,
        hits: view ? view.hits.map(hit => ({ id: hit.id, kind: hit.kind, x: hit.x, y: hit.y, w: hit.w, h: hit.h })) : []
      };
    }
  };
}
