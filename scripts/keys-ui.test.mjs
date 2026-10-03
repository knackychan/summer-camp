import test from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-stub.mjs";
import { createKeybed } from "../js/games/keys-ui.js";

test("keybed keeps each note sounding until its last pointer releases", function () {
  const doc = installDom();
  const createElement = doc.createElement.bind(doc);
  const captures = [];
  doc.createElement = function (tag) {
    const el = createElement(tag);
    el.getBoundingClientRect = () => ({ width: 0 });
    el.setPointerCapture = pointerId => captures.push([el.dataset.midi, pointerId]);
    el.removeChild = child => child.remove();
    return el;
  };
  doc.head = doc.createElement("head");
  doc.getElementById = id => doc.head.children.find(el => el.id === id);
  let target = null;
  doc.elementFromPoint = () => target;
  const resizeListeners = new Set();
  window.addEventListener = (type, fn) => resizeListeners.add(fn);
  window.removeEventListener = (type, fn) => resizeListeners.delete(fn);

  const events = [];
  const mount = doc.createElement("div");
  const keybed = createKeybed({ mount, octaves: 1,
    onNoteOn: midi => events.push(["on", midi]),
    onNoteOff: midi => events.push(["off", midi])
  });
  const c = mount.querySelector('[data-midi="48"]');
  const e = mount.querySelector('[data-midi="52"]');
  function fire(key, type, pointerId, value) {
    const event = { pointerId, key: value, clientX: 0, clientY: 0, preventDefault() {} };
    (key._listeners[type] || []).forEach(listener => listener.fn.call(key, event));
  }
  function expect(...expected) {
    assert.deepEqual(events, expected);
    events.length = 0;
  }
  const held = key => key.classList.contains("sq-key-active");

  fire(c, "pointerdown", 1); fire(e, "pointerdown", 2);
  expect(["on", 48], ["on", 52]);
  fire(c, "pointerup", 1);
  expect(["off", 48]);
  assert.ok(!held(c) && held(e), "releasing one chord note preserves the other");
  fire(e, "pointercancel", 2); fire(e, "lostpointercapture", 2);
  expect(["off", 52]);

  fire(c, "pointerdown", 1); fire(c, "pointerdown", 2); fire(c, "pointerdown", 1);
  expect(["on", 48]);
  fire(c, "pointerup", 1);
  expect(); assert.ok(held(c));
  fire(c, "lostpointercapture", 2); fire(c, "pointerup", 2);
  expect(["off", 48]); assert.ok(!held(c));

  fire(c, "pointerdown", 1); fire(e, "pointerdown", 2);
  const beforeMove = captures.length;
  target = e; fire(c, "pointermove", 1);
  expect(["on", 48], ["on", 52], ["off", 48]);
  assert.equal(captures.length, beforeMove, "glissando keeps capture on its initial key");
  fire(e, "pointerup", 2);
  expect(); assert.ok(held(e));
  fire(c, "pointerup", 1); fire(c, "pointermove", 1);
  expect(["off", 52]);

  fire(c, "pointerdown", 1); fire(c, "pointerdown", 2);
  target = e; fire(c, "pointermove", 1);
  expect(["on", 48], ["on", 52]); assert.ok(held(c) && held(e));
  fire(c, "pointercancel", 2); fire(c, "lostpointercapture", 1);
  expect(["off", 48], ["off", 52]);

  fire(c, "pointerdown", 1); fire(e, "pointerdown", 1); fire(e, "pointerup", 1);
  expect(["on", 48], ["off", 48], ["on", 52], ["off", 52]);
  fire(c, "keydown", null, "Enter"); fire(c, "keydown", null, "Enter");
  fire(c, "pointerdown", 1); fire(c, "keyup", null, "Enter");
  expect(["on", 48]); assert.ok(held(c));
  fire(c, "pointercancel", 1);
  expect(["off", 48]);

  for (const end of [() => keybed.allNotesOff(), () => keybed.destroy()]) {
    fire(c, "pointerdown", 1); fire(c, "pointerdown", 2); fire(e, "pointerdown", 3);
    expect(["on", 48], ["on", 52]);
    end(); end();
    expect(["off", 48], ["off", 52]);
    assert.ok(!held(c) && !held(e));
    fire(c, "pointerup", 1); fire(c, "lostpointercapture", 2); fire(e, "pointercancel", 3);
    expect();
  }
  fire(c, "pointerdown", 1);
  expect();
  assert.equal(mount.children.length, 0);
  assert.equal(resizeListeners.size, 0);
});
