/* Scene loader manifest (implementation-guidelines.md §12.3).
   A static map — never build an import path from unsanitized input. A game id
   with no entry here intentionally falls back to generic.js; that is the normal
   state for a Brain game whose bespoke scene has not shipped yet (slices 36-37). */

export var SCENE_LOADERS = Object.freeze({
  crunch: function () { return import("./bonds.js"); },
  change: function () { return import("./change.js"); },
  recall: function () { return import("./recall.js"); },
  fractions: function () { return import("./fractions.js"); },
  balance: function () { return import("./balance.js"); },
  circuit: function () { return import("./circuit.js"); },
  sorter: function () { return import("./sorter.js"); },
  sentence: function () { return import("./sentence.js"); },
  soundmatch: function () { return import("./soundmatch.js"); },
  memorymatch: function () { return import("./memorymatch.js"); },
  patternecho: function () { return import("./patternecho.js"); }
});

export default SCENE_LOADERS;
