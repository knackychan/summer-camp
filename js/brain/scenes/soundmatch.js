function create(ctx) {
  var item = null, enabled = false, submitted = false, heard = false;

  function speak() {
    if (!item || !enabled || submitted) return;
    heard = true;
    ctx.sayPair(item.prompt.speech || (item.prompt.script === 'bpmf' ? ['', item.prompt.word[1]] : [item.prompt.word[0], '']));
    ctx.motion.emphasize(ctx.mount.querySelector('.brain-sound__listen'));
  }

  function present(next) {
    item = next; enabled = false; submitted = false; heard = false;
    ctx.mount.innerHTML = '<div class="brain-sound">' +
      '<div class="brain-task-card brain-sound__speaker"><span class="brain-sound__speaker-art" aria-hidden="true">♪</span>' +
        '<p class="brain-sound__instruction"><span class="brain-sound__instruction-en"></span><span class="zhs brain-sound__instruction-zh"></span></p>' +
        '<button class="brain-key brain-sound__listen" type="button">Listen again<span class="zhs">再聽一次</span></button>' +
        '<button class="brain-key brain-sound__reveal" type="button" aria-expanded="false">No sound? Show word<span class="zhs">沒有聲音？顯示單字</span></button>' +
        '<div class="brain-sound__clue" role="status" hidden></div></div>' +
      '<div class="brain-sound__choices" role="group" aria-label="Word choices 單字選項"></div>' +
      '<div class="brain-corrective" role="status" hidden></div></div>';
    var instruction = item.prompt.instruction || ['Listen, then choose the match.', '聽一聽，再選出相同的單字。'];
    ctx.mount.querySelector('.brain-sound__instruction-en').textContent = instruction[0];
    ctx.mount.querySelector('.brain-sound__instruction-zh').textContent = instruction[1];
    var choices = ctx.mount.querySelector('.brain-sound__choices');
    item.prompt.options.forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'brain-key brain-sound__choice';
      button.dataset.value = option.value;
      button.setAttribute('aria-label', option.label.join(' ') + ' ' + option.value);
      if (item.prompt.pictures) {
        var picture = document.createElement('span'); picture.className = 'brain-language__picture';
        picture.setAttribute('aria-hidden', 'true'); picture.textContent = option.picture; button.appendChild(picture);
      }
      if (item.prompt.spelling) {
        var label = document.createElement('span'); label.textContent = option.value; button.appendChild(label);
      }
      button.onclick = function () {
        if (!enabled || submitted) return;
        submitted = true; button.classList.add('is-selected'); setInputEnabled(false); ctx.submit(option.value);
      };
      choices.appendChild(button);
    });
    ctx.mount.querySelector('.brain-sound__listen').onclick = speak;
    ctx.mount.querySelector('.brain-sound__reveal').onclick = function () {
      if (!enabled || submitted) return;
      var clue = ctx.mount.querySelector('.brain-sound__clue');
      clue.hidden = false;
      var cue = item.prompt.cue || item.prompt.word;
      clue.textContent = item.prompt.clue + ' · ' + cue[1];
      ctx.mount.querySelector('.brain-sound__reveal').setAttribute('aria-expanded', 'true');
      ctx.announce(['Visual clue: ' + item.prompt.clue, '文字提示：' + cue[1]]);
    };
    setInputEnabled(false);
  }

  function setInputEnabled(value) {
    enabled = !!value;
    ctx.mount.querySelectorAll('button').forEach(function (button) { button.disabled = !enabled || submitted; });
    if (enabled && !heard) speak();
  }

  function showFeedback(feedback) {
    setInputEnabled(false);
    ctx.mount.querySelectorAll('.brain-sound__choice').forEach(function (button) {
      if (button.dataset.value === item.answer) button.classList.add('is-answer');
    });
    var panel = ctx.mount.querySelector('.brain-corrective'); panel.hidden = false;
    panel.textContent = item.prompt.picture + ' ' + item.answer + ' · ' + item.prompt.word[1] +
      (item.lesson ? ' ' + item.lesson.explanation.join(' ') : '');
    ctx.announce([feedback.correct ? 'You found it! ' + item.prompt.word[0] : 'The word is ' + item.prompt.word[0], '這個單字是：' + item.prompt.word[1]]);
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? 500 : 1100, resolve); });
  }
  function destroy() { enabled = false; submitted = true; item = null; ctx.mount.innerHTML = ''; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}

export default { id: 'soundmatch', renderer: 'dom', create: create };
