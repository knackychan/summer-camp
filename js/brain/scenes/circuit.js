/* Series switches share one path; parallel switches provide alternative paths.
   The bulb and any material always remain on the common return path. */
function create(ctx) {
  var item = null, switches = [], material = -1, inputEnabled = false, pending = false, revealed = false;

  function update() {
    if (!item) return;
    var p = item.prompt;
    var predicting = p.mode === "predict", visible = !predicting || revealed;
    var connected = p.layout === "parallel" ? switches.some(Boolean) : switches.every(Boolean);
    var powered = connected && (!p.materials.length || (material >= 0 && p.materials[material].conducts));
    var board = ctx.mount.querySelector(".brain-circuit__board");
    board.setAttribute("data-powered", visible ? String(powered) : "unknown");
    ctx.mount.querySelectorAll(".brain-circuit__branch").forEach(function (branch, i) { branch.setAttribute("data-flow", String(visible && powered && switches[i])); });
    ctx.mount.querySelector(".brain-circuit__status").textContent = !visible ? "Trace the paths, then predict / 沿著路徑想一想，再預測" : powered ? "Bulb on / 燈泡亮了" : "Bulb off / 燈泡熄滅";
    ctx.mount.querySelectorAll(".brain-circuit__switch").forEach(function (button, i) {
      button.setAttribute("aria-pressed", String(switches[i]));
      button.setAttribute("aria-label", "Switch " + String.fromCharCode(65 + i) + (switches[i] ? " closed / 開關閉合" : " open / 開關斷開"));
      button.querySelector("path").setAttribute("d", switches[i] ? "M4 18H44" : "M4 18L40 4");
      button.querySelector(".brain-circuit__switch-label").textContent = String.fromCharCode(65 + i) + (switches[i] ? " · Closed 閉合" : " · Open 斷開");
      button.disabled = !inputEnabled || pending || predicting;
    });
    ctx.mount.querySelectorAll(".brain-circuit__material").forEach(function (button, i) {
      button.setAttribute("aria-pressed", String(i === material));
      button.disabled = !inputEnabled || pending;
    });
    var bridge = ctx.mount.querySelector(".brain-circuit__bridge");
    if (bridge) bridge.textContent = material < 0 ? "Choose below / 選擇材料" : p.materials[material].name.join(" / ");
    var check = ctx.mount.querySelector(".brain-circuit__check");
    if (check) check.disabled = !inputEnabled || pending || (p.materials.length > 0 && material < 0);
    ctx.mount.querySelectorAll(".brain-circuit__prediction").forEach(function (button) { button.disabled = !inputEnabled || pending; });
  }

  function wobble(button) {
    ctx.audio.play("token-pick", {});
    ctx.motion.move(button, [{ transform: "rotate(0deg)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(3deg)" }, { transform: "rotate(0deg)" }], "snap");
  }

  function present(next) {
    item = next; switches = next.prompt.switches.slice(); material = next.prompt.mode === "predict" && next.prompt.materialIndex != null ? next.prompt.materialIndex : -1;
    inputEnabled = false; pending = false; revealed = false;
    var p = next.prompt;
    var predicting = p.mode === "predict", parallel = p.layout === "parallel";
    var instruction = p.instruction || [p.en, p.zh];
    var wire = parallel ? 'M30 100V35H70 M290 35H330V98 M330 142V185H' : 'M30 80V35H' + (switches.length === 2 ? '84 M156 35H204 M276 35' : '144 M216 35') + 'H330V68 M330 112V145H';
    wire += p.materials.length ? '240 M120 ' + (parallel ? '185' : '145') + 'H30' : '30';
    wire += 'V' + (parallel ? '116' : '96');
    ctx.mount.innerHTML = '<div class="brain-circuit">' +
      '<div class="brain-science__instruction">' + instruction[0] + '<span class="zhs">' + instruction[1] + '</span></div>' +
      (switches.length > 1 ? '<div class="brain-circuit__layout">' + (parallel ? 'Parallel: two paths<span class="zhs">並聯：兩條路徑</span>' : 'Series: one path<span class="zhs">串聯：一條路徑</span>') + '</div>' : '') +
      '<div class="brain-circuit__board' + (parallel ? ' brain-circuit__board--parallel' : '') + '" data-powered="unknown">' +
        '<svg class="brain-circuit__diagram" viewBox="0 0 360 ' + (parallel ? '220' : '180') + '" aria-hidden="true">' +
          '<path class="brain-circuit__wire" d="' + wire + '"/>' +
          (parallel ? '<path class="brain-circuit__branch" d="M70 35H144 M216 35H290"/><path class="brain-circuit__branch" d="M70 35V105H144 M216 105H290V35"/><path class="brain-circuit__junction" d="M67 32H73V38H67Z M287 32H293V38H287Z"/>' : '') +
          '<g transform="translate(0 ' + (parallel ? '20' : '0') + ')"><path class="brain-circuit__battery" d="M18 80H42 M23 96H37"/><path class="brain-circuit__battery-label" d="M14 64H22 M18 60V68 M14 112H22"/></g>' +
          '<g transform="translate(0 ' + (parallel ? '30' : '0') + ')"><path class="brain-circuit__bulb" d="M314 68H346V76H354V100H346V112H314V100H306V76H314Z"/>' +
          '<path class="brain-circuit__filament" d="M320 78L340 102 M340 78L320 102"/><text class="brain-circuit__question" x="330" y="98" text-anchor="middle">?</text></g>' +
        '</svg>' +
        '<span class="brain-circuit__battery-caption">Battery<span class="zhs">電池</span></span>' +
        switches.map(function (_, i) { return '<button class="brain-key brain-circuit__switch" type="button" style="left:' + (parallel ? '50' : switches.length === 2 ? (i ? '66.6667' : '33.3333') : '50') + '%;top:' + (parallel ? (i ? '47.7273' : '15.9091') : '19.4444') + '%" aria-pressed="false">' +
          '<svg viewBox="0 0 48 24" aria-hidden="true"><path d="M4 18L40 4"/><rect x="2" y="16" width="4" height="4"/><rect x="42" y="16" width="4" height="4"/></svg><span class="brain-circuit__switch-label"></span></button>'; }).join("") +
        (p.materials.length ? '<div class="brain-circuit__bridge"></div>' : '') +
      '</div>' +
      '<div class="brain-circuit__status" role="status" aria-live="polite"></div>' +
      (p.materials.length && !predicting ? '<div class="brain-circuit__materials" role="group" aria-label="Test a material 測試材料">' + p.materials.map(function (m) {
        return '<button class="brain-key brain-circuit__material" type="button" aria-pressed="false">' + m.name[0] + '<span class="zhs">' + m.name[1] + '</span></button>';
      }).join("") + '</div>' : '') +
      (predicting ? '<div class="brain-circuit__predictions" role="group" aria-label="Predict the bulb 預測燈泡">' + next.choices.map(function (choice) { var label = choice.split(' / '); return '<button class="brain-key brain-circuit__prediction" type="button">' + label[0] + '<span class="zhs">' + label[1] + '</span></button>'; }).join('') + '</div>' : '<button class="brain-button brain-button--primary brain-circuit__check" type="button">Check circuit<span class="zhs">確認電路</span></button>') +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelectorAll(".brain-circuit__switch").forEach(function (button, i) {
      button.onclick = function () {
        if (!item || !inputEnabled || pending || predicting) return;
        switches[i] = !switches[i]; update(); wobble(button);
      };
    });
    ctx.mount.querySelectorAll(".brain-circuit__material").forEach(function (button, i) {
      button.onclick = function () {
        if (!item || !inputEnabled || pending) return;
        material = i; update(); wobble(button);
      };
    });
    ctx.mount.querySelectorAll(".brain-circuit__prediction").forEach(function (button, i) {
      button.onclick = function () {
        if (!item || !inputEnabled || pending) return;
        pending = true; update(); wobble(button); ctx.submit(next.choices[i]);
      };
    });
    var check = ctx.mount.querySelector(".brain-circuit__check");
    if (check) check.onclick = function () {
      if (!item || !inputEnabled || pending || (p.materials.length && material < 0)) return;
      var selected = p.configurations.find(function (c) { return c.material === material && c.switches.every(function (value, i) { return value === switches[i]; }); });
      if (!selected) return;
      pending = true; update(); ctx.submit(selected.value);
    };
    update();
    ctx.motion.move(ctx.mount.querySelector(".brain-circuit__board"), [{ opacity: 0 }, { opacity: 1 }], "snap");
  }

  function setInputEnabled(enabled) { inputEnabled = !!enabled; update(); }
  function showFeedback(feedback) {
    setInputEnabled(false);
    revealed = true;
    var answer = item.prompt.mode === "predict" ? null : item.prompt.configurations.find(function (c) { return c.value === feedback.answer; });
    if (answer) { switches = answer.switches.slice(); material = answer.material; }
    update();
    ctx.mount.querySelectorAll(".brain-circuit__prediction").forEach(function (button, i) { if (item.choices[i] === feedback.answer) button.classList.add("is-answer"); });
    var panel = ctx.mount.querySelector(".brain-corrective");
    panel.hidden = false;
    panel.textContent = item.corrective.join(" / ");
    ctx.announce(item.corrective);
    ctx.motion.emphasize(ctx.mount.querySelector(".brain-circuit__board"));
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? 1600 : 2400, resolve); });
  }
  function destroy() { item = null; switches = []; inputEnabled = false; pending = true; ctx.mount.innerHTML = ""; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: "circuit", renderer: "dom", create: create };
