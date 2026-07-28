/* Piano practice exercises (slice 42).
   Plain data, no logic, node-testable, bilingual. Not coupled to js/drills.js (D10).
   Steps: {beat, midi, finger}, where beat is quarter-note counts (0-based).
   For contrary motion, midiR and midiL carry right/left hand separately. */

var DRILLS = [
  {
    id: "c-five-finger",
    bpm: 60,
    bars: 10,
    hand: "right",
    name: { en: "C Five-Finger", tz: "C\u5927\u8ABF\u4E94\u6307" },
    hint: { en: "Curved fingers, wrists relaxed", tz: "\u624B\u6307\u5F4E\u66F2\uFF0C\u624B\u8155\u653E\u9B06" },
    steps: [
      /* Up: C D E F G */
      { beat: 0, midi: 60, finger: 1 }, { beat: 1, midi: 62, finger: 2 },
      { beat: 2, midi: 64, finger: 3 }, { beat: 3, midi: 65, finger: 4 },
      { beat: 4, midi: 67, finger: 5 },
      /* Down: F E D C */
      { beat: 5, midi: 65, finger: 4 }, { beat: 6, midi: 64, finger: 3 },
      { beat: 7, midi: 62, finger: 2 }, { beat: 8, midi: 60, finger: 1 }
    ]
  },
  {
    id: "c-five-finger-lh",
    bpm: 60,
    bars: 10,
    hand: "left",
    name: { en: "C Five-Finger (LH)", tz: "C\u5927\u8ABF\u4E94\u6307\uFF08\u5DE6\u624B\uFF09" },
    hint: { en: "Curved fingers, wrists relaxed", tz: "\u624B\u6307\u5F4E\u66F2\uFF0C\u624B\u8155\u653E\u9B06" },
    steps: [
      { beat: 0, midi: 48, finger: 1 }, { beat: 1, midi: 50, finger: 2 },
      { beat: 2, midi: 52, finger: 3 }, { beat: 3, midi: 53, finger: 4 },
      { beat: 4, midi: 55, finger: 5 },
      { beat: 5, midi: 53, finger: 4 }, { beat: 6, midi: 52, finger: 3 },
      { beat: 7, midi: 50, finger: 2 }, { beat: 8, midi: 48, finger: 1 }
    ]
  },
  {
    id: "c-major-scale-rh",
    bpm: 60,
    bars: 16,
    hand: "right",
    name: { en: "C Major Scale (RH)", tz: "C\u5927\u8ABF\u97F3\u968E\uFF08\u53F3\u624B\uFF09" },
    hint: { en: "Tuck your thumb under for F", tz: "\u5927\u62C7\u6307\u7A7F\u904E\u53BB\u5F48F" },
    steps: [
      { beat: 0, midi: 60, finger: 1 }, { beat: 1, midi: 62, finger: 2 },
      { beat: 2, midi: 64, finger: 3 }, { beat: 3, midi: 65, finger: 1 },
      { beat: 4, midi: 67, finger: 2 }, { beat: 5, midi: 69, finger: 3 },
      { beat: 6, midi: 71, finger: 4 }, { beat: 7, midi: 72, finger: 5 },
      { beat: 8, midi: 71, finger: 4 }, { beat: 9, midi: 69, finger: 3 },
      { beat: 10, midi: 67, finger: 2 }, { beat: 11, midi: 65, finger: 1 },
      { beat: 12, midi: 64, finger: 3 }, { beat: 13, midi: 62, finger: 2 },
      { beat: 14, midi: 60, finger: 1 }
    ]
  },
  {
    id: "c-major-scale-lh",
    bpm: 50,
    bars: 16,
    hand: "left",
    name: { en: "C Major Scale (LH)", tz: "C\u5927\u8ABF\u97F3\u968E\uFF08\u5DE6\u624B\uFF09" },
    hint: { en: "Cross your middle finger over", tz: "\u4E2D\u6307\u8DE8\u904E\u53BB" },
    steps: [
      { beat: 0, midi: 48, finger: 5 }, { beat: 1, midi: 50, finger: 4 },
      { beat: 2, midi: 52, finger: 3 }, { beat: 3, midi: 53, finger: 2 },
      { beat: 4, midi: 55, finger: 1 }, { beat: 5, midi: 57, finger: 3 },
      { beat: 6, midi: 59, finger: 2 }, { beat: 7, midi: 60, finger: 1 },
      { beat: 8, midi: 59, finger: 2 }, { beat: 9, midi: 57, finger: 3 },
      { beat: 10, midi: 55, finger: 1 }, { beat: 11, midi: 53, finger: 2 },
      { beat: 12, midi: 52, finger: 3 }, { beat: 13, midi: 50, finger: 4 },
      { beat: 14, midi: 48, finger: 5 }
    ]
  },
  {
    id: "contrary-c",
    bpm: 50,
    bars: 10,
    hand: "both",
    name: { en: "Contrary Motion", tz: "\u53CD\u5411\u904B\u52D5" },
    hint: { en: "Both hands together, opposite directions", tz: "\u96D9\u624B\u540C\u6642\uFF0C\u76F8\u53CD\u65B9\u5411" },
    steps: [
      { beat: 0, midiR: 60, midiL: 60, finger: 1 },
      { beat: 1, midiR: 62, midiL: 58, finger: 2 },
      { beat: 2, midiR: 64, midiL: 56, finger: 3 },
      { beat: 3, midiR: 65, midiL: 55, finger: 4 },
      { beat: 4, midiR: 67, midiL: 53, finger: 5 },
      { beat: 5, midiR: 65, midiL: 55, finger: 4 },
      { beat: 6, midiR: 64, midiL: 56, finger: 3 },
      { beat: 7, midiR: 62, midiL: 58, finger: 2 },
      { beat: 8, midiR: 60, midiL: 60, finger: 1 }
    ]
  },
  {
    id: "g-five-finger",
    bpm: 60,
    bars: 10,
    hand: "right",
    name: { en: "G Five-Finger (F\u266F)", tz: "G\u5927\u8ABF\u4E94\u6307\uFF08\u5347F\uFF09" },
    hint: { en: "Watch the F sharp!", tz: "\u6CE8\u610F\u5347F\uFF01" },
    steps: [
      { beat: 0, midi: 67, finger: 1 }, { beat: 1, midi: 69, finger: 2 },
      { beat: 2, midi: 71, finger: 3 }, { beat: 3, midi: 72, finger: 4 },
      { beat: 4, midi: 74, finger: 5 },
      { beat: 5, midi: 72, finger: 4 }, { beat: 6, midi: 71, finger: 3 },
      { beat: 7, midi: 69, finger: 2 }, { beat: 8, midi: 67, finger: 1 }
    ]
  }
];

export { DRILLS };
export default DRILLS;
