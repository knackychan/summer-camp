/* Equal sandwich pieces keep the visual denominator identical to the data. */
function create(ctx) {
  var item = null, selected = [], history = [], enabled = false, submitted = false;

  function update() {
    ctx.mount.querySelectorAll(".brain-fractions__piece").forEach(function (button, index) {
      var active = selected.indexOf(index) >= 0;
      button.setAttribute("aria-pressed", String(active));
      button.classList.remove("is-selected");
      if (active) button.classList.add("is-selected");
      button.disabled = !enabled || submitted;
    });
    ctx.mount.querySelector(".brain-fractions__count").textContent = selected.length + " / " + item.prompt.pieces;
    ctx.mount.querySelectorAll("[data-act]").forEach(function (button) {
      button.disabled = !enabled || submitted || (button.dataset.act === "undo" ? !history.length : !selected.length);
    });
  }

  function present(next) {
    item = next; selected = []; history = []; enabled = false; submitted = false;
    var p = item.prompt, left = p.mode === "left", food = p.foodName || ["sandwich", "三明治"];
    ctx.mount.innerHTML = '<div class="brain-fractions" data-food="' + (p.food || "sandwich") + '" data-mode="' + (p.mode || "share") + '">' +
      '<div class="brain-fractions__goal"><span>' + (left ? 'Already shared' : 'Share') + '<span class="zhs">' + (left ? '已分出' : '分出') + '</span></span><strong>' + p.numerator + ' / ' + p.denominator + '</strong></div>' +
      '<div class="brain-fractions__picnic"><div class="brain-fractions__food-name">' + food[0] + ' · ' + p.pieces + ' equal pieces<span class="zhs">' + food[1] + ' · ' + p.pieces + ' 等份</span></div>' +
      '<div class="brain-fractions__sandwich" style="--pieces-across:' + (p.columns || (p.pieces % 4 === 0 ? 4 : p.pieces % 3 === 0 ? 3 : p.pieces === 2 ? 2 : p.pieces === 5 ? 5 : 3)) + '" role="group" aria-label="' + p.pieces + ' equal pieces ' + p.pieces + ' 等份">' +
      Array.from({ length: p.pieces }, function (_, index) {
        return '<button class="brain-fractions__piece" type="button" aria-pressed="false" aria-label="Piece ' + (index + 1) + ' of ' + p.pieces + ' 第 ' + (index + 1) + ' 塊，共 ' + p.pieces + ' 塊"><span aria-hidden="true"></span></button>';
      }).join("") + '</div></div>' +
      '<div class="brain-fractions__selection"><span>' + (left ? 'Part left<span class="zhs">剩下的份量' : 'Your share<span class="zhs">你分出的份量') + '</span></span><output class="brain-fractions__count" aria-live="polite">0 / ' + p.pieces + '</output></div>' +
      '<p class="brain-fractions__hint">' + (left ? 'Tap the pieces left after sharing<span class="zhs">點選分出去之後，剩下的份量' : 'Tap equal pieces to share<span class="zhs">點選要分出的份量') + '</span></p>' +
      '<div class="brain-fractions__actions"><button type="button" class="brain-button" data-act="undo">Undo<span class="zhs">上一步</span></button>' +
      '<button type="button" class="brain-button" data-act="reset">Reset<span class="zhs">重來</span></button>' +
      '<button type="button" class="brain-button brain-button--primary" data-act="share">' + (left ? 'Check<span class="zhs">確認' : 'Share<span class="zhs">分享') + '</span></button></div>' +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelectorAll(".brain-fractions__piece").forEach(function (button, index) {
      button.onclick = function () {
        if (!enabled || submitted) return;
        history.push(selected.slice());
        if (selected.indexOf(index) < 0) selected.push(index);
        else selected.splice(selected.indexOf(index), 1);
        update();
        ctx.motion.move(button, [{ transform: "rotate(0deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(0deg)" }], "snap");
      };
    });
    ctx.mount.querySelectorAll("[data-act]").forEach(function (button) {
      button.onclick = function () {
        if (!enabled || submitted || button.disabled) return;
        if (button.dataset.act === "undo") selected = history.pop();
        else if (button.dataset.act === "reset") { selected = []; history = []; }
        else { submitted = true; update(); ctx.submit(String(selected.length)); return; }
        update();
      };
    });
    update();
  }

  function setInputEnabled(value) { enabled = !!value; if (item) update(); }

  function showFeedback(feedback) {
    setInputEnabled(false);
    var panel = ctx.mount.querySelector(".brain-corrective");
    panel.hidden = false;
    var p = item.prompt, numerator = p.mode === "left" ? p.denominator - p.numerator : p.numerator;
    panel.textContent = feedback.answer + " / " + p.pieces + " = " + numerator + " / " + p.denominator;
    if (!feedback.correct) {
      selected = Array.from({ length: Number(feedback.answer) }, function (_, index) { return index; });
      update();
      ctx.mount.querySelectorAll(".brain-fractions__piece").forEach(function (button, index) {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", String(index < Number(feedback.answer)));
        if (index < Number(feedback.answer)) button.classList.add("is-answer");
      });
    }
    ctx.announce(["Equal shares: " + panel.textContent, "等份分一分：" + panel.textContent]);
    ctx.motion.emphasize(ctx.mount.querySelector(".brain-fractions__sandwich"));
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? ctx.motion.tokens.move : 1100, resolve); });
  }

  function destroy() { item = null; selected = []; history = []; enabled = false; submitted = true; ctx.mount.innerHTML = ""; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "fractions", renderer: "dom", create: create };
