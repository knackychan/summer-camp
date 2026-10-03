/* This is a number comparison: the pan positions describe numeric equality. */
export function leftValue(prompt, value) {
  var left = prompt.missing === "left" ? value : prompt.a;
  var right = prompt.missing === "left" ? prompt.a : value;
  return prompt.op === "+" ? left + right : prompt.op === "−" ? left - right : prompt.op === "÷" ? (right ? left / right : null) : left * right;
}

function create(ctx) {
  var item = null, selected = null, history = [], enabled = false, submitted = false;

  function update() {
    var p = item.prompt, value = selected == null ? null : leftValue(p, selected);
    ctx.mount.querySelector(".brain-balance__slot").textContent = selected == null ? "?" : String(selected);
    ctx.mount.querySelector(".brain-balance__left-value").textContent = value == null ? "?" : String(value);
    ctx.mount.querySelector(".brain-balance__relation").textContent = value == null ? "?" : value === p.target ? "=" : value < p.target ? "<" : ">";
    ctx.mount.querySelector(".brain-balance__scale").setAttribute("data-state", value == null ? "empty" : value === p.target ? "equal" : value < p.target ? "less" : "more");
    ctx.mount.querySelectorAll(".brain-balance__block").forEach(function (button) {
      var active = Number(button.dataset.value) === selected;
      button.setAttribute("aria-pressed", String(active));
      button.classList.remove("is-selected");
      if (active) button.classList.add("is-selected");
      button.disabled = !enabled || submitted;
    });
    ctx.mount.querySelectorAll("[data-act]").forEach(function (button) {
      button.disabled = !enabled || submitted || (button.dataset.act === "undo" ? !history.length : selected == null);
    });
  }

  function present(next) {
    item = next; selected = null; history = []; enabled = false; submitted = false;
    var p = item.prompt;
    var slot = '<strong class="brain-balance__slot">?</strong>', known = '<strong>' + p.a + '</strong>';
    ctx.mount.innerHTML = '<div class="brain-balance">' +
      '<div class="brain-balance__equation" aria-live="polite">' + (p.missing === "left" ? slot : known) + '<span>' + p.op + '</span>' + (p.missing === "left" ? known : slot) + '<span>=</span><strong>' + p.target + '</strong></div>' +
      '<div class="brain-balance__scale" data-state="empty" role="group" aria-label="Number scale 數字天平">' +
      '<div class="brain-balance__pan brain-balance__pan--left"><span>Left<span class="zhs">左邊</span></span><output class="brain-balance__left-value">?</output></div>' +
      '<output class="brain-balance__relation" aria-live="polite">?</output>' +
      '<div class="brain-balance__pan brain-balance__pan--right"><span>Right<span class="zhs">右邊</span></span><strong>' + p.target + '</strong></div>' +
      '<div class="brain-balance__beam" aria-hidden="true"></div><div class="brain-balance__stand" aria-hidden="true"></div></div>' +
      '<p class="brain-balance__hint">Choose a block to make equal numbers<span class="zhs">選一個數字方塊，讓兩邊一樣大</span></p>' +
      '<div class="brain-balance__blocks" role="group" aria-label="Number blocks 數字方塊">' + p.blocks.map(function (n) {
        return '<button type="button" class="brain-key brain-balance__block" data-value="' + n + '" aria-pressed="false">' + n + '</button>';
      }).join("") + '</div>' +
      '<div class="brain-balance__actions"><button type="button" class="brain-button" data-act="undo">Undo<span class="zhs">上一步</span></button>' +
      '<button type="button" class="brain-button" data-act="reset">Reset<span class="zhs">重來</span></button>' +
      '<button type="button" class="brain-button brain-button--primary" data-act="check">Check<span class="zhs">確認</span></button></div>' +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelectorAll(".brain-balance__block").forEach(function (button) {
      button.onclick = function () {
        if (!enabled || submitted || selected === Number(button.dataset.value)) return;
        history.push(selected); selected = Number(button.dataset.value); update();
        ctx.motion.move(ctx.mount.querySelector(".brain-balance__slot"), [{ transform: "translateY(-5px) rotate(-4deg)" }, { transform: "translateY(0) rotate(0deg)" }], "snap");
        ctx.announce(["Left " + leftValue(item.prompt, selected) + ", right " + item.prompt.target, "左邊 " + leftValue(item.prompt, selected) + "，右邊 " + item.prompt.target]);
      };
    });
    ctx.mount.querySelectorAll("[data-act]").forEach(function (button) {
      button.onclick = function () {
        if (!enabled || submitted || button.disabled) return;
        if (button.dataset.act === "undo") selected = history.pop();
        else if (button.dataset.act === "reset") { selected = null; history = []; }
        else { submitted = true; update(); ctx.submit(String(selected)); return; }
        update();
      };
    });
    update();
  }

  function setInputEnabled(value) { enabled = !!value; if (item) update(); }

  function showFeedback(feedback) {
    setInputEnabled(false);
    selected = Number(feedback.answer); update();
    var panel = ctx.mount.querySelector(".brain-corrective");
    panel.hidden = false;
    var p = item.prompt;
    panel.textContent = (p.missing === "left" ? feedback.answer : p.a) + " " + p.op + " " + (p.missing === "left" ? p.a : feedback.answer) + " = " + p.target;
    ctx.announce(["Both sides are equal: " + panel.textContent, "兩邊一樣大：" + panel.textContent]);
    ctx.motion.emphasize(ctx.mount.querySelector(".brain-balance__equation"));
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? ctx.motion.tokens.move : 1100, resolve); });
  }

  function destroy() { item = null; selected = null; history = []; enabled = false; submitted = true; ctx.mount.innerHTML = ""; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "balance", renderer: "dom", create: create };
