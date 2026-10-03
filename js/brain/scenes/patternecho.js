import { memorySymbol } from './memorymatch.js';

function create(ctx) {
  var item = null, entry = [], enabled = false, playing = false, pending = false;
  var cancelStep = null, resolvePlayback = null;
  function stopPlayback() {
    if (cancelStep) cancelStep();
    cancelStep = null;
    if (resolvePlayback) { var done = resolvePlayback; resolvePlayback = null; done(); }
    playing = false;
  }
  function render() {
    ctx.mount.querySelectorAll('.brain-echo__pad').forEach(function (button) { button.disabled = !enabled || playing || pending || (item && entry.length === item.prompt.sequence.length); });
    var replay = ctx.mount.querySelector('[data-replay]');
    if (replay) replay.disabled = !enabled || playing || pending;
    var clear = ctx.mount.querySelector('[data-clear]');
    if (clear) clear.disabled = !enabled || playing || pending || entry.length === 0;
    var undo = ctx.mount.querySelector('[data-undo]');
    if (undo) undo.disabled = !enabled || playing || pending || entry.length === 0;
    var check = ctx.mount.querySelector('[data-check]');
    if (check) check.disabled = !enabled || playing || pending || !item || entry.length !== item.prompt.sequence.length;
    var slots = ctx.mount.querySelectorAll('.brain-echo__slot');
    slots.forEach(function (slot,i) { slot.textContent = entry[i] || '·'; });
  }
  function play() {
    stopPlayback(); playing = true; entry = []; render();
    var sequence = item.prompt.sequence, index = 0;
    return new Promise(function (resolve) {
      resolvePlayback = resolve;
      function next() {
        if (!item) return;
        if (index === sequence.length) {
          playing = false; cancelStep = null; render();
          ctx.mount.querySelector('.brain-echo__instruction').textContent = item.prompt.reverse ? 'Last tap first! 從最後倒著點！' : 'Your turn! 換你了！';
          ctx.announce(item.prompt.reverse ? ['Repeat backwards. Last tap first.', '倒著重複，從最後一個開始點。'] : ['Your turn. Repeat the pattern.', '換你了，照順序點一次。']);
          var done = resolvePlayback; resolvePlayback = null; done(); return;
        }
        var value = sequence[index++];
        var button = ctx.mount.querySelector('[data-pad="' + value + '"]');
        button.classList.add('is-lit');
        ctx.mount.querySelector('.brain-echo__instruction').textContent = 'Watch ' + index + '/' + sequence.length + ' 看順序';
        ctx.audio.play('token-pick', { rate: .8 + value * .15 });
        cancelStep = ctx.scheduler.after(item.prompt.stepMs, function () {
          button.classList.remove('is-lit');
          cancelStep = ctx.scheduler.after(200, next);
        });
      }
      cancelStep = ctx.scheduler.after(350, next);
    });
  }
  function present(nextItem) {
    stopPlayback(); item = nextItem; enabled = false; pending = false; entry = [];
    ctx.mount.innerHTML = '<div class="brain-echo">' +
      '<div class="brain-echo__instruction" role="status">Watch the pattern<span class="zhs">看看亮起來的順序</span></div>' +
      (nextItem.prompt.reverse ? '<div class="brain-echo__rule">Watch, then repeat backwards<span class="zhs">看完後，從最後倒著點</span></div>' : '') +
      '<div class="brain-echo__board">' + [1,2,3,4].map(function (n) {
        return '<button type="button" class="brain-key brain-echo__pad" data-pad="' + n + '" aria-label="Pad ' + n + ' 第 ' + n + ' 個按鈕">' + memorySymbol(n-1) + '<b>' + n + '</b></button>';
      }).join('') + '</div>' +
      '<div class="brain-echo__entry" aria-label="Your pattern 你的順序" aria-live="polite">' + nextItem.prompt.sequence.map(function () {return '<span class="brain-echo__slot">·</span>';}).join('') + '</div>' +
      '<div class="brain-echo__actions"><button type="button" class="brain-button" data-replay>Watch again<span class="zhs">再看一次</span></button><button type="button" class="brain-button" data-clear>Clear taps<span class="zhs">重新輸入</span></button>' +
      (nextItem.prompt.confirm ? '<button type="button" class="brain-button" data-undo>Undo<span class="zhs">上一步</span></button><button type="button" class="brain-button brain-button--primary" data-check>Check pattern<span class="zhs">確認順序</span></button>' : '') + '</div>' +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelectorAll('.brain-echo__pad').forEach(function (button) {
      button.onclick = function () {
        if (!enabled || playing || pending || entry.length >= item.prompt.sequence.length) return;
        var value = Number(button.dataset.pad); entry.push(value);
        ctx.audio.play('token-pick', { rate: .8 + value * .15 });
        ctx.motion.emphasize(button);
        if (entry.length === item.prompt.sequence.length && !item.prompt.confirm) pending = true;
        render();
        if (pending) ctx.submit(entry.join(','));
      };
    });
    ctx.mount.querySelector('[data-replay]').onclick = function () { if (enabled && !playing && !pending) play(); };
    ctx.mount.querySelector('[data-clear]').onclick = function () { if (enabled && !playing && !pending) { entry = []; render(); } };
    if (nextItem.prompt.confirm) {
      ctx.mount.querySelector('[data-undo]').onclick = function () { if (enabled && !playing && !pending) { entry.pop(); render(); } };
      ctx.mount.querySelector('[data-check]').onclick = function () {
        if (!enabled || playing || pending || entry.length !== item.prompt.sequence.length) return;
        pending = true; render(); ctx.submit(entry.join(','));
      };
    }
    return play();
  }
  function setInputEnabled(value) { enabled = !!value; render(); }
  function showFeedback(feedback) {
    enabled = false; render();
    var panel = ctx.mount.querySelector('.brain-corrective');
    panel.hidden = false; panel.textContent = item.corrective.join(' ');
    if (feedback.correct) ctx.mount.querySelector('.brain-echo').classList.add('is-success');
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? 320 : 1000, resolve); });
  }
  function destroy() { stopPlayback(); item = null; enabled = false; ctx.mount.innerHTML = ''; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}
export default { id: 'patternecho', renderer: 'dom', create: create };
