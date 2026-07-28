/* Minimal fake DOM for node-only Brain host/scene tests (implementation-guidelines.md
   §15.1: "do not add a test dependency" — no jsdom, so this is the whole browser surface
   js/brain/host.js and js/brain/scenes/*.js actually touch, hand-rolled. It is deliberately
   narrow: enough to create elements, set innerHTML from the exact markup those files emit,
   query it back with the selectors they actually use, and fire the two events the host
   listens for (visibilitychange, pointerdown/keydown/click). Real visual behaviour is a
   browser/tablet test (§15.2); this only proves the state machine and scene contract. */

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link"]);

class FakeStyle {
  constructor() { this._props = {}; }
  setProperty(name, value) { this._props[name] = value; }
  getPropertyValue(name) { return this._props[name] || ""; }
  removeProperty(name) { delete this._props[name]; }
}

class FakeElement {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this._classes = [];
    this._attrs = {};
    this.children = [];
    this.parentNode = null;
    this.style = new FakeStyle();
    this._listeners = {};
    this.disabled = false;
    this.hidden = false;
    this.onclick = null;
    this.oninput = null;
    this._value = "";
  }
  get classList() {
    var el = this;
    return {
      add: function () { for (var i = 0; i < arguments.length; i++) { var n = arguments[i]; if (el._classes.indexOf(n) < 0) el._classes.push(n); } },
      remove: function () { for (var i = 0; i < arguments.length; i++) { var idx = el._classes.indexOf(arguments[i]); if (idx >= 0) el._classes.splice(idx, 1); } },
      contains: function (n) { return el._classes.indexOf(n) >= 0; }
    };
  }
  get className() { return this._classes.join(" "); }
  set className(v) { this._classes = String(v).trim().split(/\s+/).filter(Boolean); }
  setAttribute(name, value) { this._attrs[name] = String(value); if (name === "class") this.className = value; }
  getAttribute(name) { return name in this._attrs ? this._attrs[name] : null; }
  removeAttribute(name) { delete this._attrs[name]; }
  get dataset() {
    var attrs = this._attrs;
    return new Proxy({}, {
      get: function (_, key) { return attrs["data-" + String(key).replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); })]; },
      set: function (_, key, val) { attrs["data-" + String(key).replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); })] = String(val); return true; }
    });
  }
  set innerHTML(html) { this.children = parseHtml(html); this.children.forEach(function (c) { if (c instanceof FakeElement) c.parentNode = this; }, this); }
  get innerHTML() { return "[fake]"; }
  set textContent(t) { this.children = []; this._text = String(t); }
  get textContent() {
    if (this.children.length) return this.children.map(function (c) { return c.textContent || ""; }).join("");
    return this._text || "";
  }
  get value() { return this._value; }
  set value(v) { this._value = v; }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node; }
  remove() { if (this.parentNode) { var i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } }
  get lastElementChild() {
    for (var i = this.children.length - 1; i >= 0; i--) if (this.children[i] instanceof FakeElement) return this.children[i];
    return null;
  }
  addEventListener(type, fn, opts) {
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push({ fn: fn, once: !!(opts && opts.once) });
  }
  removeEventListener(type, fn) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(function (l) { return l.fn !== fn; });
  }
  dispatch(type, evt) {
    var list = (this._listeners[type] || []).slice();
    var self = this;
    list.forEach(function (l) { l.fn(evt || {}); if (l.once) self.removeEventListener(type, l.fn); });
  }
  focus() {}
  animate() {
    var listeners = {};
    var anim = {
      cancel: function () { fire("cancel"); },
      pause: function () {}, play: function () {},
      addEventListener: function (type, fn) { listeners[type] = fn; }
    };
    function fire(type) { if (listeners[type]) listeners[type](); }
    setTimeout(function () { fire("finish"); }, 0);
    return anim;
  }
  querySelectorAll(sel) { return queryAll(this, sel); }
  querySelector(sel) { var r = queryAll(this, sel); return r.length ? r[0] : null; }
}

function parseSelectorToken(tok) {
  var spec = { tag: null, classes: [], attrs: [] };
  var rest = tok;
  var tagMatch = rest.match(/^[a-zA-Z][\w-]*/);
  if (tagMatch) { spec.tag = tagMatch[0].toLowerCase(); rest = rest.slice(tagMatch[0].length); }
  var partRe = /\.[\w-]+|\[[^\]]+\]/g, m;
  while ((m = partRe.exec(rest))) {
    var part = m[0];
    if (part[0] === ".") spec.classes.push(part.slice(1));
    else {
      var inner = part.slice(1, -1);
      var eq = inner.indexOf("=");
      if (eq < 0) spec.attrs.push({ name: inner, value: undefined });
      else spec.attrs.push({ name: inner.slice(0, eq), value: inner.slice(eq + 1).replace(/^["']|["']$/g, "") });
    }
  }
  return spec;
}
function matchesSpec(el, spec) {
  if (spec.tag && el.tagName.toLowerCase() !== spec.tag) return false;
  for (var i = 0; i < spec.classes.length; i++) if (el._classes.indexOf(spec.classes[i]) < 0) return false;
  for (var j = 0; j < spec.attrs.length; j++) {
    var a = spec.attrs[j], v = el._attrs[a.name];
    if (v == null) return false;
    if (a.value !== undefined && v !== a.value) return false;
  }
  return true;
}
function queryAll(root, selector) {
  var tokens = selector.split(",").map(function (s) { return parseSelectorToken(s.trim()); });
  var out = [];
  (function walk(node) {
    node.children.forEach(function (child) {
      if (!(child instanceof FakeElement)) return;
      if (tokens.some(function (t) { return matchesSpec(child, t); })) out.push(child);
      walk(child);
    });
  })(root);
  return out;
}

function parseHtml(html) {
  var root = new FakeElement("root");
  var stack = [root];
  var tagRe = /<\/?[a-zA-Z][^<>]*>/g;
  var last = 0, m;
  while ((m = tagRe.exec(html))) {
    var text = html.slice(last, m.index);
    if (text) appendText(stack[stack.length - 1], text);
    last = tagRe.lastIndex;
    var raw = m[0];
    if (raw[1] === "/") {
      var closeName = raw.slice(2, -1).trim().toLowerCase();
      for (var i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName.toLowerCase() === closeName) { stack.length = i; break; }
      }
    } else {
      var selfClose = /\/>\s*$/.test(raw);
      var inner = raw.slice(1, raw.length - (selfClose ? 2 : 1)).trim();
      var spaceIdx = inner.search(/\s/);
      var tag = (spaceIdx < 0 ? inner : inner.slice(0, spaceIdx)).toLowerCase();
      var attrsStr = spaceIdx < 0 ? "" : inner.slice(spaceIdx + 1);
      var el = new FakeElement(tag);
      var attrRe = /([a-zA-Z_:][\w:-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s"'=<>]+))?/g, am;
      while ((am = attrRe.exec(attrsStr))) {
        var value = am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : (am[2] || "");
        el._attrs[am[1]] = value;
        if (am[1] === "class") el.className = value;
      }
      stack[stack.length - 1].appendChild(el);
      if (!selfClose && !VOID_TAGS.has(tag)) stack.push(el);
    }
  }
  var tail = html.slice(last);
  if (tail) appendText(stack[stack.length - 1], tail);
  return root.children;
}
function appendText(parent, text) { parent.children.push({ textContent: text }); }

class FakeDocument extends FakeElement {
  constructor() { super("document"); this.body = new FakeElement("body"); this.hidden = false; }
  createElement(tag) { return new FakeElement(tag); }
}

export function installDom() {
  var doc = new FakeDocument();
  globalThis.document = doc;
  globalThis.window = globalThis;
  globalThis.matchMedia = function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; };
  globalThis.requestAnimationFrame = function (fn) { return setTimeout(function () { fn(Date.now()); }, 16); };
  globalThis.cancelAnimationFrame = function (id) { clearTimeout(id); };
  globalThis.speechSynthesis = { cancel: function () {} };
  return doc;
}
