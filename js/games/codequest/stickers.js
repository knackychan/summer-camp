/* Stickers (simple-cards design D1, D2): a card can carry one repeat sticker and one if
   sticker. Stickers are only a view of the existing AST — card + ×N is repeat(N, [card]),
   card + if T is ifNode(T, [card]), both is repeat(N, [ifNode(T, [card])]). Any other
   shape is a legacy bracket (`cardView` gives null): it still runs, but takes no stickers.
   Pure: no DOM, inputs never mutated, nodes built only with ast.js constructors. */
import { repeat, ifNode } from './ast.js';

/** One card on its own: an action, a target or a call (the 🪨 Rune card). */
export function isPlainCard(node) {
  return !!node && (node.type === 'action' || node.type === 'target' || node.type === 'call');
}
/** if T [card], no else, T a named condition. */
function stickerIf(node) {
  return !!node && node.type === 'if' && typeof node.test === 'string' && node.then.length === 1
    && !(node.else && node.else.length) && isPlainCard(node.then[0]);
}

/** `{ card, times, test }`, or null for a legacy bracket. */
export function cardView(node) {
  if (isPlainCard(node)) return { card: node, times: 1, test: null };
  if (stickerIf(node)) return { card: node.then[0], times: 1, test: node.test };
  // A literal count of 2+ only: an expression count or ×1 is a bracket the Code sheet wrote.
  if (node && node.type === 'repeat' && typeof node.times === 'number' && node.times > 1 && node.body.length === 1) {
    const inner = node.body[0];
    if (isPlainCard(inner)) return { card: inner, times: node.times, test: null };
    if (stickerIf(inner)) return { card: inner.then[0], times: node.times, test: inner.test };
  }
  return null;
}

/** The D2 shape for a view; `uid` is the caller's `prefix → string` for the new wrappers. */
export function buildCard({ card, times = 1, test = null }, uid = () => undefined) {
  let node = card;
  if (test) node = ifNode(test, [node], [], uid('i'));
  if (times > 1) node = repeat(times, [node], uid('r'));
  return node;
}

/** `sticker` is { kind: 'repeat', times } or { kind: 'if', test }; it replaces the card's own of that kind. */
export function withSticker(node, sticker, uid) {
  const view = cardView(node);
  if (!view || !sticker) return null;
  if (sticker.kind === 'repeat') view.times = sticker.times;
  else if (sticker.kind === 'if') view.test = sticker.test;
  else return null;
  return buildCard(view, uid);
}

/** The bare card, or null for a legacy bracket. */
export function withoutStickers(node) {
  const view = cardView(node);
  return view ? view.card : null;
}
