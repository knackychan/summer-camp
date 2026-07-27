/* SQGames — the arcade game registry (design.md §2).
   Pure: no DOM, no globals reached for. The host publishes it on window;
   this module never touches window itself, so node can import it directly. */

var games = {};
var order = [];

function register(game) {
  if (!game || !game.id) throw new Error("game must have an id");
  if (typeof game.init !== "function") throw new Error("game " + game.id + " has no init()");
  if (games[game.id]) throw new Error("game " + game.id + " is already registered");
  games[game.id] = game;
  order.push(game.id);
  return game;
}

function get(id) {
  var g = games[id];
  return g ? g : null;
}

function has(id) {
  return !!games[id];
}

function ids() {
  return order.slice();
}

function all() {
  return order.map(function (id) { return games[id]; });
}

/* A best-score stat key belongs to some registered game. sync.js asks this
   instead of carrying its own list (design.md §5). */
function isBest(key) {
  if (!key) return false;
  for (var i = 0; i < order.length; i++) {
    if (games[order[i]].bestKey === key) return true;
  }
  return false;
}

/* Tests only. The app registers once at boot and never unregisters. */
function reset() {
  Object.keys(games).forEach(function (k) { delete games[k]; });
  order.length = 0;
}

export var SQGames = { register: register, get: get, has: has, ids: ids, all: all, isBest: isBest, reset: reset };
export default SQGames;
