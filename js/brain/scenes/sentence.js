/* Word carriages retain their source index so repeated words stay distinct. */
function create(ctx) {
  var item = null, selected = [], enabled = false, submitted = false;

  function update() {
    ctx.mount.querySelectorAll('.brain-sentence__word').forEach(function (button, index) {
      var used = selected.indexOf(index) >= 0;
      button.disabled = !enabled || submitted || used;
      button.setAttribute('aria-pressed', String(used));
    });
    ctx.mount.querySelectorAll('.brain-sentence__slot').forEach(function (button, index) {
      var source = selected[index];
      button.textContent = source == null ? String(index + 1) : item.prompt.tokens[source];
      button.disabled = !enabled || submitted || source == null;
      button.setAttribute('aria-label', source == null ? 'Empty carriage ' + (index + 1) + ' 空車廂' : 'Remove ' + item.prompt.tokens[source] + ' 移回單字');
      button.classList[source == null ? 'remove' : 'add']('is-filled');
    });
    ctx.mount.querySelector('[data-act="check"]').disabled = !enabled || submitted || selected.length !== item.prompt.tokens.length;
    ctx.mount.querySelector('[data-act="clear"]').disabled = !enabled || submitted || !selected.length;
  }

  function present(next) {
    item = next; selected = []; enabled = false; submitted = false;
    ctx.mount.innerHTML = '<div class="brain-sentence">' +
      '<div class="brain-task-card brain-sentence__clue"><span class="brain-language__picture" aria-hidden="true"></span>' +
        '<p class="brain-sentence__meaning"><span class="brain-sentence__meaning-en"></span><span class="zhs brain-sentence__meaning-zh"></span></p><p>Tap words to build the sentence.<span class="zhs">點單字排句子，點車廂就能移回。</span></p></div>' +
      '<div class="brain-sentence__track" role="group" aria-label="Your sentence 你的句子"></div>' +
      '<div class="brain-sentence__words" role="group" aria-label="Word carriages 單字車廂"></div>' +
      '<div class="brain-language__actions"><button class="brain-key" type="button" data-act="clear">Clear<span class="zhs">重排</span></button>' +
        '<button class="brain-key" type="button" data-act="check">Check sentence<span class="zhs">確認句子</span></button></div>' +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    ctx.mount.querySelector('.brain-language__picture').textContent = item.prompt.picture;
    ctx.mount.querySelector('.brain-sentence__meaning-en').textContent = item.prompt.meaning[0];
    ctx.mount.querySelector('.brain-sentence__meaning-zh').textContent = item.prompt.meaning[1];
    var track = ctx.mount.querySelector('.brain-sentence__track'), words = ctx.mount.querySelector('.brain-sentence__words');
    item.prompt.tokens.forEach(function (word, index) {
      var slot = document.createElement('button');
      slot.type = 'button'; slot.className = 'brain-key brain-sentence__slot';
      slot.onclick = function () {
        if (!enabled || submitted || selected[index] == null) return;
        var removed = selected.splice(index, 1)[0]; update();
        ctx.mount.querySelectorAll('.brain-sentence__word')[removed].focus({ preventScroll: true });
      };
      track.appendChild(slot);
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'brain-key brain-sentence__word'; button.textContent = word;
      button.onclick = function () {
        if (!enabled || submitted || selected.indexOf(index) >= 0) return;
        selected.push(index); update(); ctx.audio.play('token-pick', {});
        ctx.motion.emphasize(ctx.mount.querySelectorAll('.brain-sentence__slot')[selected.length - 1]);
        if (selected.length === item.prompt.tokens.length) ctx.mount.querySelector('[data-act="check"]').focus({ preventScroll: true });
        else Array.from(ctx.mount.querySelectorAll('.brain-sentence__word')).find(function (wordButton) { return !wordButton.disabled; }).focus({ preventScroll: true });
      };
      words.appendChild(button);
    });
    ctx.mount.querySelector('[data-act="clear"]').onclick = function () {
      if (enabled && !submitted) { selected = []; update(); ctx.mount.querySelector('.brain-sentence__word').focus({ preventScroll: true }); }
    };
    ctx.mount.querySelector('[data-act="check"]').onclick = function () {
      if (!enabled || submitted || selected.length !== item.prompt.tokens.length) return;
      submitted = true; update();
      ctx.submit(selected.map(function (index) { return item.prompt.tokens[index]; }).join(' '));
    };
    update();
  }

  function setInputEnabled(value) { enabled = !!value; if (item) update(); }
  function showFeedback(feedback) {
    setInputEnabled(false);
    var panel = ctx.mount.querySelector('.brain-corrective');
    panel.hidden = false;
    panel.textContent = (feedback.correct ? 'Ready to roll! 出發囉！ ' : 'Read this sentence. 看看這個句子。 ') +
      (item.lesson ? item.lesson.explanation.join(' ') : item.answer + ' ' + item.prompt.meaning[1]);
    ctx.mount.querySelector('.brain-sentence__track').classList.add(feedback.correct ? 'is-success' : 'is-hint');
    ctx.announce([item.answer, item.prompt.meaning[1]]);
    ctx.sayPair([item.answer, item.prompt.meaning[1]]);
    return new Promise(function (resolve) { ctx.scheduler.after(1100, resolve); });
  }
  function destroy() { enabled = false; submitted = true; item = null; selected = []; ctx.mount.innerHTML = ''; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: 'sentence', renderer: 'dom', create: create };
