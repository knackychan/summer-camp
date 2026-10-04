/* Laboratory of Curiosity screen (lab design D1, D2, D5, D7, D8, D10, D12; slice 04).
   The pure helpers at the top hold the experiment — mix, steps, selection, last
   result — and decide what a Brew does to the profile; they are tested with no DOM.
   mountLab() is the thin DOM + pointer controller around them: it draws the scene
   (lab-view.js), turns taps and drags on its hit rects into helper calls, and talks to
   Code Quest only through `api`, so the Lab never reaches into the dungeon. */
import { createScheduler } from '../../../game-services/scheduler.js';
import { RECIPES, ALCHEMY_STEPS, brewLab } from '../progression.js';
import { runAlchemyCode, recipeToAlchemyCode, recipeById } from '../alchemy-code.js';
import { ALCHEMY_LABELS, LAB, LAB_PROPS, LAB_FAMILIES, LAB_STATE_NAMES, UI, MESSAGES, labMadeLine, labPagesLine, labFormName, pairHTML, t } from '../strings.js';
import { spriteURL } from '../pixel-art.js';
import { placeBubbleRect } from '../bubble.js';
import { LAB_INGREDIENTS, LAB_FREE_INGREDIENTS, STATE_TOOL } from './ingredients.js';
import { LAB_RULES } from './rules.js';
import { resolveExperiment, mixHint, labEntries, labKey, LAB_MAX_INGREDIENTS, LAB_MAX_STEPS } from './resolve.js';
import { normalizeLab, recordFound, recordSeen, recordStates, journalReactions, journalPotions, journalIngredients } from './journal.js';
import { drawLab, hitAt } from './lab-view.js';
import { drawLabSprite, labSpriteSize } from './lab-art.js';

const RULE = Object.fromEntries(LAB_RULES.map(rule => [rule.id, rule]));

/* ---------- pure experiment state ----------
   `mix` and `held` use the compact key of resolve.js: the bare id for a fresh ingredient,
   "id:state" for a crushed / heated / frozen one (lab-states D6). */

export function createLabState() {
  return Object.freeze({ mix: Object.freeze([]), steps: Object.freeze([]), selection: null, held: null, effect: null, lastResult: null, line: LAB.welcome, newPage: false });
}
const next = (state, patch) => Object.freeze({ ...state, ...patch });

/** Lift a jar / bag item (`jar:<id>` or `bag:<id>`), or put it down again with null.
    Pressing the item already lifted keeps it (and its state) in hand. */
export function labSelect(state, hitId) {
  if (!hitId) return next(state, { selection: null, held: null });
  if (hitId === state.selection && state.held) return state;
  const id = String(hitId).split(':')[1];
  // The first time only: once something is in the cauldron the kid knows the moves.
  return next(state, { selection: hitId, held: Object.hasOwn(LAB_INGREDIENTS, id) ? id : null, line: !state.mix.length ? LAB.pickToChange : state.line });
}

/** A tool tap (lab-states D1): with something lifted, mortar / burner / frost plate change *it*
    and it stays lifted; the spoon, or any tool with empty hands, is a whole-cauldron step. */
export function labProcess(state, step) {
  const form = STATE_TOOL[step];
  if (!state.held || !form) return labStep(state, step);
  const [entry] = labEntries([state.held]);
  if (!entry) return labStep(state, step);
  const name = labFormName(LAB_INGREDIENTS[entry.id].label, form);
  return next(state, { held: labKey(entry.id, form), line: [name[0] + '!', name[1] + '！'] });
}

/** Drops an ingredient (an id or an "id:state" key) into the cauldron and empties the hand. */
export function labAdd(state, item) {
  const [entry] = labEntries([item]);
  if (!entry) return next(state, { selection: null, held: null });
  if (state.mix.length >= LAB_MAX_INGREDIENTS) return next(state, { selection: null, held: null, line: LAB.full });
  return next(state, { mix: Object.freeze([...state.mix, labKey(entry.id, entry.state)]), selection: null, held: null });
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

/** Journal "Put in cauldron": a known recipe's ingredients and steps, ready for the kid to tap Brew. */
export function labLoad(state, ingredients, steps) {
  const mix = ingredients.filter(id => Object.hasOwn(LAB_INGREDIENTS, id)).slice(0, LAB_MAX_INGREDIENTS);
  const process = steps.filter(step => ALCHEMY_STEPS.includes(step)).slice(0, LAB_MAX_STEPS);
  return next(state, { mix: Object.freeze(mix), steps: Object.freeze(process), selection: null, held: null, effect: null, line: LAB.ready });
}

/** ✕ clears the experiment and whatever the last Brew left in the room. */
export function labClear(state) {
  return next(state, { mix: Object.freeze([]), steps: Object.freeze([]), selection: null, held: null, effect: null, newPage: false });
}

/**
 * Brew the current experiment. Returns `{ state, profile, changed, potionId, newRule }`:
 * `changed` says whether the profile needs saving, `potionId` names a bottled dungeon
 * potion (the caller tops up the live run). Mix and steps stay, so a kid can change one
 * thing and brew again.
 */
export function labBrew(state, profile, { free = LAB_FREE_INGREDIENTS, now = 0 } = {}) {
  const mix = [...state.mix], steps = [...state.steps], entries = labEntries(mix);
  if (!entries.length) return { state: next(state, { selection: null, held: null, line: LAB.empty }), profile, changed: false, potionId: null, newRule: false };
  const lastIngredient = entries[entries.length - 1].id;
  let result = resolveExperiment({ ingredients: mix, steps, recipes: RECIPES });
  let practice = false;
  if (result.kind === 'potion') {
    // A potion only comes from fresh ingredients (lab-states D5), so ids are the whole story.
    const brewed = brewLab(profile, entries.map(entry => entry.id), steps, { free });
    if (brewed.ok) {
      const recipe = recipeById(result.potionId);
      return {
        state: next(state, { selection: null, held: null, lastResult: result, newPage: false, line: labMadeLine(recipe.label),
          effect: Object.freeze({ ruleId: 'potion', potionId: result.potionId, intensity: 1, start: now, lastIngredient }) }),
        profile: brewed.profile, changed: true, potionId: result.potionId, newRule: false
      };
    }
    // D5 off and the bag is short: the reaction still plays as a practice brew.
    result = resolveExperiment({ ingredients: mix, steps, recipes: [] });
    practice = true;
  }
  const fresh = !normalizeLab(profile.lab).found.includes(result.ruleId);
  const recorded = recordStates(recordFound(recordSeen(profile, entries), result.ruleId), entries);
  const line = practice ? LAB.practice : result.hint === 'fresh' ? LAB.freshHint : result.hint === 'order' ? LAB.orderHint : RULE[result.ruleId].line;
  return {
    state: next(state, { selection: null, held: null, lastResult: practice ? Object.freeze({ ...result, practice: true }) : result, newPage: state.newPage || fresh, line,
      effect: Object.freeze({ ruleId: result.ruleId, intensity: result.intensity, start: now, lastIngredient }) }),
    profile: recorded, changed: recorded !== profile, potionId: null, newRule: fresh
  };
}

/* ---------- DOM controller ---------- */

const LINE_MS = 6000;
// Journal icons: one emoji per property and per reaction family (the words sit beside them).
const PROP_ICON = Object.freeze({ life: '💚', growth: '🌱', fire: '🔥', cold: '❄️', water: '💧', echo: '🔔', space: '🌌', time: '⏳', light: '✨', chaos: '🌀', calm: '🍃' });
const FAMILY_ICON = Object.freeze({ reality: '🌌', instability: '💥', time: '⏳', space: '🕳️', creature: '👾', replication: '🔁', biological: '🌿', elemental: '🔥', light: '💡', fallback: '💨' });
const JOURNAL_TABS = Object.freeze(['reactions', 'potions', 'ingredients']);
// Existing host sounds only (lab design D13); per-family audio is a later phase.
const REACTION_SOUND = Object.freeze({ explosion: 'hit', fireball: 'zap', singularity: 'zap', thermalShock: 'hit' });
// A small badge on a changed ingredient in the strip and the drag ghost (lab-states D8).
const STATE_BADGE = Object.freeze({ crushed: '🔨', heated: '🔥', frozen: '🧊' });
const TOOL_MS = 600;
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
    '<div class="cq-lab-sheet" role="dialog" hidden></div><div class="cq-lab-sheet cq-lab-journal" role="region" hidden></div><p class="cq-sr" role="status" aria-live="polite"></p>';
  root.appendChild(el);
  const scene = el.querySelector('.cq-lab-scene'), canvas = el.querySelector('canvas'), bubble = el.querySelector('.cq-lab-bubble');
  const scheduler = createScheduler();
  let state = createLabState(), view = null, lineAt = performance.now(), bubbleSide = null, press = null, ghost = null;
  let script = { open: false, code: '', error: null };
  const journal = { open: false, tab: 'reactions' };
  const sheetOpen = () => script.open || journal.open;
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

  /** Strip / ghost icon: the ingredient plus its state badge. */
  function formIcon(entry) {
    return '<img src="' + iconURL(entry.id, accent()) + '" alt="">' + (STATE_BADGE[entry.state] ? '<i class="cq-lab-badge" aria-hidden="true">' + STATE_BADGE[entry.state] + '</i>' : '');
  }
  let tool = null;   // { step, start }: the tool the kid just used, for its little animation
  function useTool(step) { tool = { step, start: performance.now() }; }

  /* ----- drawing ----- */
  function draw(time = performance.now()) {
    if (destroyed) return;
    const box = scene.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const hint = mixHint(state.mix, state.steps);
    view = drawLab(canvas, {
      cssWidth: box.width, cssHeight: box.height, dpr: window.devicePixelRatio || 1, now: time,
      mix: state.mix, steps: state.steps, tint: hint.tint, shaky: hint.shaky, selection: state.selection, held: state.held,
      tool: tool && time - tool.start < TOOL_MS ? tool : null, effect: state.effect, reduced: !!api.reduced
    });
    placeBubble(time, box);
    placeTag();
    placeCounts();
  }
  function placeBubble(time, box) {
    const visible = !sheetOpen() && time - lineAt < LINE_MS;
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
      const [entry] = labEntries([state.mix[i]]);
      slots.push(entry
        ? button('remove:' + i, formIcon(entry), 'class="cq-lab-slot" aria-label="' + esc(t(LAB.takeOut) + ': ' + t(labFormName(LAB_INGREDIENTS[entry.id].label, entry.state))) + '"')
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
  /* ----- Curiosity Journal (slice 06): a half-height sheet; the lab keeps playing above ----- */
  function chip(prop, n) {
    return '<span class="cq-lab-prop" title="' + esc(t(LAB_PROPS[prop])) + '"><i aria-hidden="true">' + PROP_ICON[prop] + '</i>' + pairHTML(LAB_PROPS[prop]) + (n > 1 ? '<b>×' + n + '</b>' : '') + '</span>';
  }
  function formulaHTML(tokens) {
    if (!tokens.length) return '<span class="cq-lab-formula"><i aria-hidden="true">❔</i></span>';
    return '<span class="cq-lab-formula">' + tokens.map(token => token.startsWith('ing:')
      ? '<img src="' + iconURL(token.slice(4), accent()) + '" alt="' + esc(t(LAB_INGREDIENTS[token.slice(4)].label)) + '">'
      : token.startsWith('state:')
        ? '<i class="cq-lab-state" title="' + esc(t(LAB_STATE_NAMES[token.slice(6)])) + '">' + STATE_BADGE[token.slice(6)] + '</i>'
        : '<i title="' + esc(t(LAB_PROPS[token])) + '">' + PROP_ICON[token] + '</i>').join('<b>+</b>') + '</span>';
  }
  function journalPage() {
    const profile = api.profile();
    if (journal.tab === 'potions') {
      return '<div class="cq-lab-cards">' + journalPotions(profile, RECIPES).map(page => page.found
        ? '<article class="cq-lab-card"><header><img src="' + spriteURL(page.id === 'healing' ? 'potion' : page.id === 'focus' ? 'moonBerry' : page.id, accent()) + '" alt=""><b>' + pairHTML(page.label) + '</b></header>' +
          '<span class="cq-lab-formula">' + page.ingredients.map(id => '<img src="' + iconURL(id, accent()) + '" alt="' + esc(t(LAB_INGREDIENTS[id].label)) + '">').join('<b>+</b>') + '</span>' +
          '<span class="cq-lab-trail">' + page.process.map((step, i) => '<span><b>' + (i + 1) + '</b>' + pairHTML(ALCHEMY_LABELS[step]) + '</span>').join('') + '</span>' +
          button('journal:use:' + page.id, pairHTML(LAB.putIn), 'class="cq-primary"') + '</article>'
        : '<article class="cq-lab-card unknown"><header><i aria-hidden="true">❔</i><b>' + pairHTML(LAB.notFound) + '</b></header></article>').join('') + '</div>';
    }
    if (journal.tab === 'ingredients') {
      return '<div class="cq-lab-cards">' + journalIngredients(profile.lab).map(page =>
        '<article class="cq-lab-card' + (page.seen ? '' : ' unseen') + '"><header><img src="' + iconURL(page.id, accent()) + '" alt=""><b>' + pairHTML(page.label) + '</b><small>' + pairHTML(page.where === 'bag' ? LAB.bag : LAB.shelf) + '</small></header>' +
        (page.seen ? '<span class="cq-lab-props">' + page.props.map(([prop, n]) => chip(prop, n)).join('') + '</span>' : '<p>' + pairHTML(LAB.unseen) + '</p>') +
        // Forms the kid has brewed with (lab-states D7): one row each, never a hint of the others.
        page.forms.map(form => '<div class="cq-lab-form"><b><i aria-hidden="true">' + STATE_BADGE[form.state] + '</i>' + pairHTML(LAB_STATE_NAMES[form.state]) + '</b><span class="cq-lab-props">' + form.props.map(([prop, n]) => chip(prop, n)).join('') + '</span></div>').join('') +
        '</article>').join('') + '</div>';
    }
    const book = journalReactions(profile.lab);
    return '<p class="cq-lab-count">' + pairHTML(labPagesLine(book.found, book.total)) + '</p><div class="cq-lab-cards">' + book.pages.map(page => page.found
      ? '<article class="cq-lab-card"><header><i aria-hidden="true">' + FAMILY_ICON[page.family] + '</i><b>' + pairHTML(page.label) + '</b></header>' + formulaHTML(page.formula) + '<p>' + pairHTML(page.line) + '</p></article>'
      : '<article class="cq-lab-card unknown"><header><i aria-hidden="true">' + FAMILY_ICON[page.family] + '</i><b>' + pairHTML(LAB.notFound) + '</b></header><small>' + pairHTML(LAB_FAMILIES[page.family]) + '</small></article>').join('') + '</div>';
  }
  function renderJournal() {
    const sheet = el.querySelector('.cq-lab-journal');
    sheet.hidden = !journal.open;
    if (!journal.open) { sheet.innerHTML = ''; return; }
    sheet.setAttribute('aria-label', t(LAB.journal));
    const tabs = { reactions: LAB.tabReactions, potions: LAB.tabPotions, ingredients: LAB.tabIngredients };
    const icon = { reactions: '🧪', potions: '⚗️', ingredients: '🍄' };
    sheet.innerHTML = '<div class="cq-lab-sheet-head"><div class="cq-lab-tabs" role="tablist">' + JOURNAL_TABS.map(tab =>
      button('journal:tab:' + tab, '<i aria-hidden="true">' + icon[tab] + '</i>' + pairHTML(tabs[tab]), 'role="tab" aria-selected="' + (journal.tab === tab) + '" class="cq-lab-tab' + (journal.tab === tab ? ' on' : '') + '"')).join('') +
      '</div>' + button('journal:close', '✕', 'class="cq-lab-tool" aria-label="' + esc(t(UI.close)) + '"') + '</div><div class="cq-lab-journal-page">' + journalPage() + '</div>';
  }
  function openJournal() {
    script.open = false; renderSheet();
    journal.open = true; state = next(state, { newPage: false });
    renderJournal(); draw();
  }
  function closeJournal() { journal.open = false; renderJournal(); draw(); }

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
  function dropHeld() {
    if (!state.held) return;
    const before = state.mix.length;
    apply(labAdd(state, state.held));
    if (state.mix.length > before) sfx('pop');
  }
  /** A tool on the lifted ingredient, or a whole-cauldron step with empty hands (lab-states D1). */
  function processWith(step) {
    const holding = !!state.held && !!STATE_TOOL[step], before = state.steps.length;
    const after = labProcess(state, step);
    if (holding || after.steps.length > before) { useTool(step); sfx('pop'); }
    apply(after);
    // The owl names the form every time, even when it is the same form again.
    if (holding) say(after.line);
  }
  function tapHit(hit) {
    if (!hit) return;
    if (hit.kind === 'cauldron') { dropHeld(); return; }
    if (hit.kind === 'prop') { processWith(hit.step); return; }
    if (hit.kind === 'owl') { say(state.line); return; }
    if (hit.kind === 'book') { openJournal(); return; }
    if (hit.kind === 'scroll') {
      if (!api.canScript()) { say(LAB.scriptLocked); return; }
      if (journal.open) closeJournal();
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
    if (name === 'journal:close') { closeJournal(); return; }
    if (name.startsWith('journal:tab:')) { const tab = name.slice(12); if (JOURNAL_TABS.includes(tab)) { journal.tab = tab; renderJournal(); } return; }
    if (name.startsWith('journal:use:')) {
      const recipe = recipeById(name.slice(12));
      if (recipe && api.profile().discoveredRecipes.includes(recipe.id)) { journal.open = false; renderJournal(); apply(labLoad(state, recipe.ingredients, recipe.process)); }
      return;
    }
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
    // The Journal is not a modal: a tap on the room above it just closes it.
    if (journal.open) { e.preventDefault(); closeJournal(); return; }
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
      ghost.innerHTML = formIcon(labEntries([state.held || press.hit.ingredient])[0]);
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
    if (over && over.kind === 'cauldron') dropHeld();
    // Dropped on the mortar, burner or frost plate: changed, and still in hand over the tool.
    else if (over && over.kind === 'prop' && STATE_TOOL[over.step]) processWith(over.step);
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

  say(state.line); renderDock(); renderSheet(); renderJournal();

  return {
    render() { say(state.line); el.querySelector('.cq-lab-tag').innerHTML = pairHTML(LAB.newPage); renderDock(); renderSheet(); renderJournal(); draw(); },
    /** Closes the Journal or the script sheet if one is open; returns true when it did (Back closes a sheet first). */
    closeSheet() {
      if (journal.open) { closeJournal(); return true; }
      if (!script.open) return false;
      script.open = false; renderSheet(); return true;
    },
    destroy() {
      destroyed = true;
      scheduler.cancelAll();
      if (resize) resize.disconnect();
      if (ghost) ghost.remove();
      el.remove();
    },
    snapshot() {
      return {
        open: true, mix: [...state.mix], steps: [...state.steps], selection: state.selection, held: state.held, effect: state.effect,
        lastResult: state.lastResult, newPage: state.newPage, line: state.line, script: script.open, journal: journal.open ? journal.tab : null,
        hits: view ? view.hits.map(hit => ({ id: hit.id, kind: hit.kind, x: hit.x, y: hit.y, w: hit.w, h: hit.h })) : []
      };
    }
  };
}
