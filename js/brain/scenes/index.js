/* Scene loader manifest (implementation-guidelines.md §12.3).
   A static map — never build an import path from unsanitized input. A game id
   with no entry here intentionally falls back to generic.js; that is the normal
   state for a Brain game whose bespoke scene has not shipped yet (slices 36-37). */

export var SCENE_LOADERS = Object.freeze({
  change: function () { return import("./change.js"); }
});

export default SCENE_LOADERS;
