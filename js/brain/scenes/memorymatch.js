/* Pixel symbols also identify Pattern Echo pads without relying on colour. */
export function memorySymbol(id) {
  var paths = [
    'M6 0h4v4h6v4h-4v4h2v4h-4v-2H6v2H2v-4h2V8H0V4h6Z',
    'M2 2h4v2h4V2h4v2h2v6h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V4h2Z',
    'M8 0h8v8h-2v2h-2v2H6v2H4v2H0v-4h4V6h2V2h2Z',
    'M4 0h6v2H8v2H6v6h2v2h6v-2h2v4h-4v2H4v-2H2v-2H0V4h2V2h2Z',
    'M6 0h4v2H6ZM0 6h2v4H0ZM14 6h2v4h-2ZM6 14h4v2H6ZM4 4h8v8H4Z',
    'M6 0h4v4h2v2h2v4h2v2h-2v2h-2v2H4v-2H2v-2H0v-2h2V6h2V4h2Z'
  ];
  return '<svg class="brain-memory__symbol brain-memory__symbol--' + id + '" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="' + paths[id] + '"/></svg>';
}

function create(ctx) {
  var current = null, selected = [], enabled = false, studying = false, revealed = false, pending = false;
  var cancelStudy = null, resolveStudy = null, cancelMismatch = null, matched = [], mistakes = 0;
  function stopStudy() {
    if (cancelMismatch) cancelMismatch();
    cancelMismatch = null;
    if (cancelStudy) cancelStudy();
    cancelStudy = null;
    if (resolveStudy) { var done = resolveStudy; resolveStudy = null; done(); }
  }
  function renderCards() {
    if (!current) return;
    var p = current.prompt;
    ctx.mount.querySelectorAll('.brain-memory__card').forEach(function (button, index) {
      var found = matched.indexOf(index) >= 0;
      var visible = studying || revealed || found || selected.indexOf(index) >= 0;
      button.innerHTML = '<small>' + (index + 1) + '</small>' + (visible ? memorySymbol(p.cards[index]) : '<span class="brain-memory__back">?</span>');
      button.setAttribute('aria-label', 'Card ' + (index + 1) + ' 第 ' + (index + 1) + ' 張' + (visible ? ': ' + p.symbols[p.cards[index]].join(' ') : ''));
      button.setAttribute('aria-pressed', String(selected.indexOf(index) >= 0));
      button.disabled = !enabled || studying || pending || found || selected.indexOf(index) >= 0;
      if (found || (revealed && (p.mode === 'all' || p.cards[index] === p.target))) button.classList.add('is-answer');
    });
    var progress = ctx.mount.querySelector('.brain-memory__pairs');
    if (progress) progress.textContent = p.mode === 'all' ? 'Pairs ' + matched.length/2 + '/' + p.cards.length/2 + ' 配對' : '';
  }
  function finishPair() {
    if (current.prompt.mode !== 'all') {
      ctx.submit(selected.map(function (i) { return i + 1; }).sort(function (a,b) { return a-b; }).join(','));
      return;
    }
    var cards = current.prompt.cards;
    if (cards[selected[0]] === cards[selected[1]]) {
      matched = matched.concat(selected); selected = [];
      pending = matched.length === cards.length;
      renderCards();
      ctx.announce(['Pair found. ' + matched.length/2 + ' pairs.', '找到一組了，共 ' + matched.length/2 + ' 組。']);
      if (pending) ctx.submit(mistakes ? 'needs-practice' : current.answer);
    } else {
      mistakes++;
      ctx.announce(['Different pictures. Remember both positions.', '圖片不同，記住這兩個位置。']);
      cancelMismatch = ctx.scheduler.after(850, function () {
        cancelMismatch = null; selected = []; pending = false; renderCards();
      });
    }
  }
  function present(item) {
    stopStudy(); current = item; selected = []; matched = []; mistakes = 0; enabled = false; studying = true; revealed = false; pending = false;
    var p = item.prompt;
    ctx.mount.innerHTML = '<div class="brain-memory">' +
      '<div class="brain-memory__instruction" role="status">Remember the pictures<span class="zhs">記住圖片的位置</span></div>' +
      '<div class="brain-memory__target-slot"><div class="brain-memory__target" hidden>' + (p.mode === 'all' ? '<span>Find every matching pair<span class="zhs">找出全部相同的圖片配對</span></span>' : memorySymbol(p.target) + '<span>Find both ' + p.symbols[p.target][0] + ' cards<span class="zhs">找出兩張' + p.symbols[p.target][1] + '卡片</span></span>') + '</div></div>' +
      '<div class="brain-memory__board" style="--memory-columns:' + (p.cards.length === 6 ? 3 : 4) + '">' +
        p.cards.map(function (_, i) { return '<button type="button" class="brain-key brain-memory__card" data-card="' + i + '"></button>'; }).join('') + '</div>' +
      '<div class="brain-memory__pairs" role="status"></div><div class="brain-corrective" hidden role="status"></div></div>';
    ctx.mount.querySelectorAll('.brain-memory__card').forEach(function (button, index) {
      button.onclick = function () {
        if (!enabled || studying || pending || matched.indexOf(index) >= 0 || selected.indexOf(index) >= 0) return;
        selected.push(index);
        ctx.audio.play('token-pick', {});
        ctx.motion.emphasize(button);
        if (selected.length === 2) pending = true;
        renderCards();
        if (pending) finishPair();
      };
    });
    renderCards();
    return new Promise(function (resolve) {
      resolveStudy = resolve;
      cancelStudy = ctx.scheduler.after(p.studyMs, function () {
        cancelStudy = null; studying = false;
        ctx.mount.querySelector('.brain-memory__instruction').innerHTML = 'Where were they?<span class="zhs">剛才在哪裡？</span>';
        ctx.mount.querySelector('.brain-memory__target').hidden = false;
        renderCards();
        ctx.announce(p.mode === 'all' ? ['Find every matching pair.', '找出全部相同的圖片配對。'] : ['Find both ' + p.symbols[p.target][0] + ' cards.', '找出兩張' + p.symbols[p.target][1] + '卡片。']);
        var done = resolveStudy; resolveStudy = null; done();
      });
    });
  }
  function setInputEnabled(value) { enabled = !!value; renderCards(); }
  function showFeedback(feedback) {
    enabled = false; revealed = true; renderCards();
    var panel = ctx.mount.querySelector('.brain-corrective');
    panel.hidden = false; panel.textContent = current.corrective.join(' ');
    if (feedback.correct) ctx.mount.querySelector('.brain-memory').classList.add('is-success');
    return new Promise(function (resolve) { ctx.scheduler.after(feedback.correct ? 320 : 1000, resolve); });
  }
  function destroy() { stopStudy(); current = null; enabled = false; ctx.mount.innerHTML = ''; }
  return { present: present, setInputEnabled: setInputEnabled, showFeedback: showFeedback, destroy: destroy };
}
export default { id: 'memorymatch', renderer: 'dom', create: create };
