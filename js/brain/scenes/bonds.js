/* Number Bonds: pick two distinct tiles. The canonical pair string uses the
   shared grader and survives JSON round saves without a custom grade closure. */
export function pairAnswer(values) {
  return values.slice().sort(function (a, b) { return a - b; }).join(" + ");
}

function create(ctx) {
  var currentItem = null;
  var selected = [];
  var inputEnabled = false;
  var pendingSubmit = false;

  function updateSelection() {
    ctx.mount.querySelectorAll(".brain-bonds__tile").forEach(function (button, index) {
      var active = selected.indexOf(index) >= 0;
      button.setAttribute("aria-pressed", String(active));
      button.classList.remove("is-selected");
      if (active) button.classList.add("is-selected");
      button.disabled = !inputEnabled || pendingSubmit;
    });
    ctx.mount.querySelectorAll(".brain-bonds__slot").forEach(function (slot, index) {
      slot.textContent = selected[index] == null ? "?" : String(currentItem.prompt.tiles[selected[index]]);
      slot.classList.remove("is-filled");
      if (selected[index] != null) slot.classList.add("is-filled");
    });
  }

  function choose(index, button) {
    if (!inputEnabled || pendingSubmit || !currentItem) return;
    if (selected.indexOf(index) >= 0) selected = [];
    else selected.push(index);
    ctx.audio.play("token-pick", {});
    ctx.motion.move(button, [
      { transform: "rotate(0deg) scale(1)" },
      { transform: "rotate(-5deg) scale(1.07)" },
      { transform: "rotate(3deg) scale(1.02)" },
      { transform: "rotate(0deg) scale(1)" }
    ], "snap");
    if (selected.length === 2) pendingSubmit = true;
    updateSelection();
    if (pendingSubmit) {
      ctx.submit(pairAnswer(selected.map(function (i) { return currentItem.prompt.tiles[i]; })));
    } else if (selected.length) {
      var first = currentItem.prompt.tiles[selected[0]];
      ctx.announce([first + " selected. Pick its partner.", "選了 " + first + "，找出它的好朋友。"]);
    }
  }

  function present(item) {
    currentItem = item;
    selected = [];
    inputEnabled = false;
    pendingSubmit = false;
    ctx.mount.innerHTML = '<div class="brain-bonds">' +
      '<div class="brain-bonds__target"><span>Make<span class="zhs">合起來是</span></span><strong>' + item.prompt.target + '</strong></div>' +
      '<div class="brain-bonds__equation" aria-live="polite" aria-label="Your pair 你的配對">' +
        '<span class="brain-bonds__slot">?</span><span>+</span><span class="brain-bonds__slot">?</span>' +
        '<span>=</span><strong>' + item.prompt.target + '</strong></div>' +
      '<div class="brain-bonds__hint">Tap two number friends<span class="zhs">點兩個數字好朋友</span></div>' +
      '<div class="brain-bonds__choices" role="group" aria-label="Number tiles 數字方塊">' +
        item.prompt.tiles.map(function (n) {
          return '<button class="brain-key brain-bonds__tile" type="button" aria-pressed="false" aria-label="' + n + '">' +
            '<strong>' + n + '</strong>' + (ctx.tier === "tot" ? '<span class="brain-bonds__dots" aria-hidden="true">' + '<i></i>'.repeat(n) + '</span>' : '') + '</button>';
        }).join("") + '</div>' +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelectorAll(".brain-bonds__tile").forEach(function (button, index) {
      button.disabled = true;
      button.onclick = function () { choose(index, button); };
    });
    ctx.motion.move(ctx.mount.querySelector(".brain-bonds__target"), [
      { transform: "translateY(6px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }
    ], "snap");
  }

  function setInputEnabled(enabled) {
    inputEnabled = !!enabled;
    if (currentItem) updateSelection();
  }

  function showFeedback(feedback) {
    setInputEnabled(false);
    var panel = ctx.mount.querySelector(".brain-corrective");
    panel.hidden = false;
    panel.textContent = feedback.answer + " = " + currentItem.prompt.target;
    if (feedback.correct) {
      ctx.mount.querySelector(".brain-bonds").classList.add("is-success");
      ctx.motion.emphasize(ctx.mount.querySelector(".brain-bonds__equation"));
      ctx.announce(["Number friends! " + panel.textContent, "找到好朋友！" + panel.textContent]);
    } else {
      var pair = feedback.answer.split(" + ").map(Number);
      ctx.mount.querySelectorAll(".brain-bonds__tile").forEach(function (button, index) {
        if (pair.indexOf(currentItem.prompt.tiles[index]) >= 0) button.classList.add("is-answer");
      });
      ctx.announce(["Try these friends: " + panel.textContent, "看看這對好朋友：" + panel.textContent]);
    }
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? ctx.motion.tokens.move : 900, resolve); });
  }

  function destroy() {
    currentItem = null;
    selected = [];
    inputEnabled = false;
    pendingSubmit = true;
    ctx.mount.innerHTML = "";
  }

  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "crunch", renderer: "dom", create: create };
