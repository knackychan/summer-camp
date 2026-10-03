/* Small, code-drawn specimens keep the field tray available offline. */
var SHAPES = {
  cat: "M5 4H9V7H15V4H19V16H16V21H8V16H5Z",
  fish: "M3 9H6V6H15V9H18V7H22V17H18V15H15V18H6V15H3Z",
  bird: "M5 11H11V5H17V8H21V11H17V17H13V21H11V17H7V15H5Z",
  frog: "M4 5H9V8H15V5H20V11H18V16H22V20H15V17H9V20H2V16H6V11H4Z",
  flower: "M9 2H15V5H19V11H15V14H13V22H10V18H5V15H10V14H6V11H3V5H9Z",
  tree: "M9 2H15V5H19V9H22V16H15V22H9V16H2V9H5V5H9Z",
  cactus: "M10 2H15V12H18V6H22V15H15V22H10V16H3V8H7V12H10Z",
  grass: "M2 22V12H5V16H7V5H10V13H13V2H16V13H19V8H22V22Z",
  stone: "M6 6H17V9H21V18H17V21H4V18H2V12H6Z",
  book: "M3 3H21V21H3Z M6 6V18H18V6Z",
  spoon: "M8 2H16V5H18V10H15V13H14V22H10V13H9V10H6V5H8Z",
  water: "M3 3H6V19H18V3H21V22H3Z M7 10H17V18H7Z",
  air: "M2 4H6V8H2Z M15 2H19V6H15Z M9 11H13V15H9Z M19 17H23V21H19Z M2 19H6V23H2Z",
  dolphin: "M2 11H5V8H12V4H15V8H18V11H22V15H19V18H22V21H16V16H12V19H9V15H2Z",
  bat: "M1 5H4V8H8V11H10V6H14V11H16V8H20V5H23V17H19V14H16V17H14V21H10V17H8V14H5V17H1Z",
  penguin: "M9 2H15V5H18V10H20V17H17V20H19V23H13V21H11V23H5V20H7V17H4V10H6V5H9Z",
  shark: "M2 11H5V8H10V3H14V8H18V11H21V7H23V20H21V16H17V18H13V21H10V17H5V14H2Z",
  turtle: "M6 6H10V9H16V6H19V10H22V15H19V19H16V17H9V20H6V17H3V14H6Z",
  snake: "M3 3H18V6H21V12H17V9H7V14H19V21H3V18H15V17H3Z",
  salamander: "M9 2H15V7H13V10H17V7H21V10H17V14H14V17H19V21H15V18H12V22H8V18H4V15H8V12H5V8H8V10H11V7H9Z",
  snail: "M4 6H14V9H17V16H20V8H22V20H2V17H4Z M7 9V14H11V12H10V11H13V16H6V9Z",
  butterfly: "M2 3H8V6H11V8H13V6H16V3H22V11H18V13H21V21H15V18H13V22H11V18H9V21H3V13H6V11H2Z",
  robot: "M10 1H14V5H20V15H17V20H20V23H14V20H10V23H4V20H7V15H4V5H10Z M7 8V11H10V8Z M14 8V11H17V8Z",
  ice: "M3 5H17V8H21V21H7V18H3Z M6 8V16H8V10H15V8Z M10 13V18H18V13Z",
  drops: "M5 1H7V5H10V10H8V12H4V10H2V5H5Z M16 10H18V14H21V20H19V22H15V20H12V14H16Z",
  nail: "M5 2H19V6H14V19H12V22H10V6H5Z",
  ring: "M7 2H17V5H21V19H17V22H7V19H3V5H7Z M8 7V17H16V7Z",
  foil: "M3 3H19V6H22V21H6V18H3Z M7 7V10H14V7Z M12 13V16H18V13Z",
  wire: "M3 2H6V7H17V10H20V18H17V21H3V18H16V11H6V14H3Z",
  clip: "M7 2H17V5H20V19H17V22H7V19H4V7H7V18H16V6H10V15H7Z",
  eraser: "M2 12L12 2H17L23 8L10 21H6Z M14 5L7 12L11 16L19 8Z"
};
function specimenArt(id) {
  var alias = { milk: "water", oil: "water", oxygen: "air", co2: "air" };
  return '<svg class="brain-sorter__sprite" viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges"><path fill-rule="evenodd" d="' + SHAPES[alias[id] || id] + '"/>' +
    (['cat', 'fish', 'bird', 'frog', 'dolphin', 'bat', 'penguin', 'shark', 'turtle', 'snake', 'salamander'].indexOf(id) >= 0 ? '<rect class="brain-sorter__eye" x="12" y="8" width="2" height="2"/>' : '') + '</svg>';
}

function create(ctx) {
  var item = null, inputEnabled = false, pending = false;
  function setInputEnabled(enabled) {
    inputEnabled = !!enabled;
    ctx.mount.querySelectorAll(".brain-sorter__bin").forEach(function (button) { button.disabled = !inputEnabled || pending; });
  }
  function present(next) {
    item = next; inputEnabled = false; pending = false;
    var p = next.prompt;
    ctx.mount.innerHTML = '<div class="brain-sorter">' +
      '<div class="brain-science__instruction">' + (p.question ? p.question[0] : p.en) + '<span class="zhs">' + (p.question ? p.question[1] : p.zh) + '</span></div>' +
      '<div class="brain-sorter__specimen">' + specimenArt(p.specimen.icon || p.specimen.id) + '<strong>' + p.specimen.name[0] + '<span class="zhs">' + p.specimen.name[1] + '</span></strong></div>' +
      '<div class="brain-sorter__bins" role="group" aria-label="Choose a group 選擇分類">' + p.categories.map(function (category) {
        return '<button class="brain-key brain-sorter__bin" type="button" data-category="' + category.id + '">' + category.name[0] + '<span class="zhs">' + category.name[1] + '</span></button>';
      }).join("") + '</div><div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelectorAll(".brain-sorter__bin").forEach(function (button, i) {
      button.onclick = function () {
        if (!item || !inputEnabled || pending) return;
        pending = true; setInputEnabled(false);
        button.classList.add("is-selected");
        ctx.audio.play("token-pick", {});
        ctx.motion.move(ctx.mount.querySelector(".brain-sorter__specimen"), [{ transform: "rotate(0deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(3deg)" }, { transform: "rotate(0deg)" }], "snap");
        ctx.submit(p.categories[i].value);
      };
    });
    setInputEnabled(false);
    ctx.motion.move(ctx.mount.querySelector(".brain-sorter__specimen"), [{ opacity: 0, transform: "translateY(5px)" }, { opacity: 1, transform: "translateY(0)" }], "snap");
  }
  function showFeedback(feedback) {
    setInputEnabled(false);
    ctx.mount.querySelectorAll(".brain-sorter__bin").forEach(function (button, i) { if (item.prompt.categories[i].value === feedback.answer) button.classList.add("is-answer"); });
    var panel = ctx.mount.querySelector(".brain-corrective");
    panel.hidden = false; panel.textContent = item.corrective.join(" / ");
    ctx.announce(item.corrective);
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? 1600 : 2400, resolve); });
  }
  function destroy() { item = null; inputEnabled = false; pending = true; ctx.mount.innerHTML = ""; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "sorter", renderer: "dom", create: create };
