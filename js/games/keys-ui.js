/* keys-ui.js — keybed component (slice 41).
   Presentation only: draws keys, tracks multi-touch, emits MIDI note numbers.
   No audio, no opinions about sound. Piano and Moog both consume this. */

export function createKeybed(opts) {
  var mount = opts.mount;
  var lowMidi = opts.lowMidi || 48; /* C3 */
  var octaves = opts.octaves || 2;
  var onNoteOn = opts.onNoteOn || function () {};
  var onNoteOff = opts.onNoteOff || function () {};

  var keyMap = new Map();      /* pointerId -> midi */
  var keyElements = new Map(); /* midi -> DOM element */
  var container = null;
  var whiteKeys = [];
  var blackKeys = [];
  var destroyed = false;

  /* Black key positions: midi offset from lowMidi, index into white-key array (where
     the black key sits between those two white keys), and label.
     A piano has 5 black keys per octave: C# D# F# G# A# */
  var BLACK_KEYS = [];
  for (var oct = 0; oct < octaves; oct++) {
    /* Mind the two strides: 12 semitones but only 7 white keys per octave. */
    var base = oct * 12, white = oct * 7;
    BLACK_KEYS.push({ offset: base + 1, whiteIdx: white + 0, label: "C\u266F" }); /* C# between C-D */
    BLACK_KEYS.push({ offset: base + 3, whiteIdx: white + 1, label: "D\u266F" }); /* D# between D-E */
    BLACK_KEYS.push({ offset: base + 6, whiteIdx: white + 3, label: "F\u266F" }); /* F# between F-G */
    BLACK_KEYS.push({ offset: base + 8, whiteIdx: white + 4, label: "G\u266F" }); /* G# between G-A */
    BLACK_KEYS.push({ offset: base + 10, whiteIdx: white + 5, label: "A\u266F" }); /* A# between A-B */
  }

  function midiToName(midi) {
    var octave = Math.floor(midi / 12) - 1;
    var noteIdx = midi % 12;
    var noteNames = ["C", "C\u266F", "D", "D\u266F", "E", "F", "F\u266F", "G", "G\u266F", "A", "A\u266F", "B"];
    var tzNames = ["\u0043", "\u5347\u0043", "\u0044", "\u5347\u0044", "\u0045", "\u0046", "\u5347\u0046", "\u0047", "\u5347\u0047", "\u0041", "\u5347\u0041", "\u0042"];
    return { en: noteNames[noteIdx] + octave, tz: tzNames[noteIdx] + octave };
  }

  /* The keybed owns its own pressed/highlight styles. This used to be injected by
     piano.js only, so opening the Synth first in a session gave keys that never
     lit up when pressed. */
  function injectStyle() {
    if (document.getElementById("sq-keys-style")) return;
    var styleEl = document.createElement("style");
    styleEl.id = "sq-keys-style";
    styleEl.textContent =
      ".sq-key-white.sq-key-active{background:#5AD1C4!important;color:#14131A!important}" +
      ".sq-key-black.sq-key-active{background:#3AB0A3!important}" +
      ".sq-key-highlight{box-shadow:inset 0 0 14px #FFB13C!important}";
    document.head.appendChild(styleEl);
  }

  function build() {
    injectStyle();
    container = document.createElement("div");
    container.style.cssText = "position:relative;height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;";

    var keysWrap = document.createElement("div");
    /* display:flex is load-bearing — the keys carry flex:1 to share the width
       evenly, which does nothing in a block container (they stack instead). */
    keysWrap.style.cssText = "position:relative;flex:1;min-height:0;display:flex;align-items:stretch;overflow:hidden;";
    container.appendChild(keysWrap);

    /* White keys as a flex row */
    var whiteCount = octaves * 7;
    for (var wi = 0; wi < whiteCount; wi++) {
      var oct = Math.floor(wi / 7);
      var noteIdx = wi % 7;
      var midi = lowMidi + oct * 12 + [0, 2, 4, 5, 7, 9, 11][noteIdx];
      var name = midiToName(midi);

      var key = document.createElement("button");
      key.setAttribute("role", "button");
      key.setAttribute("aria-label", name.en + " / " + name.tz);
      key.className = "sq-key sq-key-white";
      key.dataset.midi = String(midi);
      key.dataset.nameEn = name.en;
      key.dataset.nameTz = name.tz;
      /* A white key reads as white — the old #2A2838 face left white and black
         keys nearly the same colour, which is unusable at a glance. */
      key.style.cssText = "flex:1;border:1px solid #3A3850;border-radius:0 0 6px 6px;background:#EFEDF6;cursor:pointer;position:relative;z-index:1;min-width:44px;min-height:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;font-family:Fredoka,Nunito,system-ui;font-size:11px;font-weight:600;color:#6E6A88;outline:none;";
      key.textContent = name.en;

      attachPointerHandlers(key);

      keysWrap.appendChild(key);
      keyElements.set(midi, key);
      whiteKeys.push(key);
    }

    /* Black keys absolutely positioned */
    for (var bi = 0; bi < BLACK_KEYS.length; bi++) {
      var bk = BLACK_KEYS[bi];
      if (bk.whiteIdx >= whiteCount) continue;
      var midi = lowMidi + bk.offset;
      var name = midiToName(midi);

      var bkKey = document.createElement("button");
      bkKey.setAttribute("role", "button");
      bkKey.setAttribute("aria-label", name.en + " / " + name.tz);
      bkKey.className = "sq-key sq-key-black";
      bkKey.dataset.midi = String(midi);
      bkKey.dataset.nameEn = name.en;
      bkKey.dataset.nameTz = name.tz;

      /* Position the black key: width is 60% of a white key, centred between
         the target white key and the next one. The black key sits on top (z-index 2). */
      var whiteEl = whiteKeys[bk.whiteIdx];
      var nextWhite = whiteKeys[bk.whiteIdx + 1];
      bkKey.style.cssText = "position:absolute;z-index:2;border:1px solid #3A3850;border-radius:0 0 4px 4px;background:#14131A;cursor:pointer;width:60%;min-width:26px;top:0;height:60%;outline:none;";

      /* We'll compute the actual left in a resize handler or requestAnimationFrame,
         stored references to let rendering adjust. For now set via percentage. */
      bkKey._leftWhite = whiteEl;
      bkKey._nextWhite = nextWhite;
      bkKey._bk = bk;

      attachPointerHandlers(bkKey);

      keysWrap.appendChild(bkKey);
      keyElements.set(midi, bkKey);
      blackKeys.push(bkKey);
    }

    mount.appendChild(container);
    positionBlackKeys();
  }

  function activateKey(el, pointerId) {
    if (destroyed) return;
    var midi = parseInt(el.dataset.midi, 10);
    keyMap.set(pointerId, midi);
    if (el.setPointerCapture) {
      try { el.setPointerCapture(pointerId); } catch (e) {}
    }
    el.classList.add("sq-key-active");
    onNoteOn(midi);
  }

  function releasePointer(pointerId) {
    if (destroyed) return;
    var midi = keyMap.get(pointerId);
    keyMap.delete(pointerId);
    if (midi === undefined) return;
    var el = keyElements.get(midi);
    if (el) el.classList.remove("sq-key-active");
    onNoteOff(midi);
  }

  function movePointer(e) {
    if (destroyed) return;
    if (!keyMap.has(e.pointerId)) return;
    var oldMidi = keyMap.get(e.pointerId);
    var target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.dataset && target.dataset.midi) {
      var newMidi = parseInt(target.dataset.midi, 10);
      if (newMidi !== oldMidi) {
        keyMap.set(e.pointerId, newMidi);
        onNoteOff(oldMidi);
        onNoteOn(newMidi);
        var oldEl = keyElements.get(oldMidi);
        if (oldEl) oldEl.classList.remove("sq-key-active");
        var newEl = keyElements.get(newMidi);
        if (newEl) newEl.classList.add("sq-key-active");
      }
    }
  }

  function attachPointerHandlers(key) {
    key.addEventListener("pointerdown", function (e) {
      activateKey(this, e.pointerId);
    });
    key.addEventListener("pointerup", function (e) {
      releasePointer(e.pointerId);
    });
    key.addEventListener("pointercancel", function (e) {
      releasePointer(e.pointerId);
    });
    key.addEventListener("lostpointercapture", function (e) {
      releasePointer(e.pointerId);
    });
    key.addEventListener("pointermove", movePointer);
  }

  function positionBlackKeys() {
    for (var i = 0; i < blackKeys.length; i++) {
      var bkKey = blackKeys[i];
      if (!bkKey._leftWhite) continue;
      var leftRect = bkKey._leftWhite.getBoundingClientRect();
      var rightRect = bkKey._nextWhite ? bkKey._nextWhite.getBoundingClientRect() : null;
      var containerRect = container.getBoundingClientRect();

      if (!leftRect.width) continue;
      var middle = leftRect.right;
      if (bkKey._bk.label === "D\u266F") {
        /* D# is centred more toward D (the left white) — it's about 40% from left */
        middle = leftRect.right - leftRect.width * 0.1;
      } else if (bkKey._bk.label === "A\u266F") {
        /* Same for A# */
        middle = leftRect.right - leftRect.width * 0.1;
      }

      var bkWidth = leftRect.width * 0.6;
      bkKey.style.left = (middle - containerRect.left - bkWidth / 2) + "px";
      bkKey.style.width = bkWidth + "px";
    }
  }

  build();
  window.addEventListener("resize", positionBlackKeys);

  function allNotesOff() {
    keyMap.forEach(function (midi, ptrId) {
      onNoteOff(midi);
    });
    keyMap.clear();
    keyElements.forEach(function (el) {
      el.classList.remove("sq-key-active");
    });
  }

  function highlight(midi, className) {
    var el = keyElements.get(midi);
    if (el) el.classList.add(className || "sq-key-highlight");
  }

  function unhighlight(midi, className) {
    var el = keyElements.get(midi);
    if (el) el.classList.remove(className || "sq-key-highlight");
  }

  function destroy() {
    destroyed = true;
    window.removeEventListener("resize", positionBlackKeys);
    allNotesOff();
    keyElements.clear();
    whiteKeys.length = 0;
    blackKeys.length = 0;
    if (container && container.parentNode) container.parentNode.removeChild(container);
    container = null;
  }

  return {
    allNotesOff: allNotesOff,
    highlight: highlight,
    unhighlight: unhighlight,
    destroy: destroy,
    get element() { return container; }
  };
}

export default createKeybed;
