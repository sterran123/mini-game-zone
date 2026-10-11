'use strict';
(() => {
  const ICONS = ['🚀', '🌟', '👾', '🍎', '🎮', '🧩', '🎲', '🎯'];
  const SAVE_KEY = 'memory-log', BEST_KEY = 'memory-best';
  const boardEl = document.getElementById('memBoard');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const movesNow = document.getElementById('movesNow');
  const timeNow = document.getElementById('timeNow');

  let deck, open, matched, moves, lockTimer, startedAt, timerId, alive;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, null);

  function newGame() {
    deck = [...ICONS, ...ICONS].sort(() => Math.random() - .5);
    open = []; matched = 0; moves = 0; lockTimer = null;
    alive = true; startedAt = null;
    boardEl.innerHTML = '';
    deck.forEach((icon, i) => {
      const b = document.createElement('button');
      b.className = 'mem-card'; b.dataset.i = i; b.dataset.icon = icon;
      b.setAttribute('role', 'gridcell');
      b.setAttribute('aria-label', `카드 ${i + 1}`);
      b.addEventListener('click', () => flip(b));
      boardEl.appendChild(b);
    });
    overlay.hidden = true;
    updateHud(0);
    clearInterval(timerId);
    MGZ.status('카드를 뒤집어 짝을 찾으세요');
    MGZ.beep(440, .06, 'square', .06, 660);
  }

  function updateHud(elapsed) {
    movesNow.textContent = moves;
    timeNow.textContent = elapsed ?? timeNow.textContent;
  }

  function tick() { updateHud(((performance.now() - startedAt) / 1000).toFixed(1)); }

  function flip(card) {
    if (!alive || lockTimer || card.classList.contains('up') || card.classList.contains('done')) return;
    if (!startedAt) { startedAt = performance.now(); timerId = setInterval(tick, 100); }
    card.classList.add('up');
    card.textContent = card.dataset.icon;
    MGZ.beep(500, .04, 'square', .05);
    open.push(card);
    if (open.length < 2) return;
    moves++;
    const [a, b] = open; open = [];
    if (a.dataset.icon === b.dataset.icon) {
      a.classList.add('done'); b.classList.add('done');
      matched += 2;
      MGZ.beep(700, .06, 'square', .07, 1050);
      updateHud();
      if (matched === deck.length) return endGame();
    } else {
      MGZ.beep(260, .05, 'square', .05);
      updateHud();
      lockTimer = setTimeout(() => {
        a.classList.remove('up'); b.classList.remove('up');
        a.textContent = ''; b.textContent = '';
        lockTimer = null;
      }, 620);
    }
  }

  function endGame() {
    alive = false;
    clearInterval(timerId);
    const secs = ((performance.now() - startedAt) / 1000).toFixed(1);
    stats.push({ moves, secs: +secs, at: new Date().toISOString().slice(0, 10) });
    stats.sort((x, y) => x.moves - y.moves || x.secs - y.secs);
    stats = stats.slice(0, 50);
    MGZ.save(SAVE_KEY, stats);
    if (!best || moves < best.moves || (moves === best.moves && +secs < best.secs)) { best = { moves, secs: +secs }; MGZ.save(BEST_KEY, best); }
    overlayTitle.textContent = '클리어!';
    overlayMsg.textContent = `뒤집기 ${moves}회 · ${secs}초 — 최고 ${best.moves}회 / ${best.secs}초`;
    overlay.hidden = false;
    MGZ.status('Enter로 다시 출발');
    renderLog();
    MGZ.beep(660, .1, 'square', .08, 990); MGZ.beep(880, .12, 'square', .08, 1320, .12);
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !alive) return newGame();
    if (e.key === 'r' || e.key === 'R') return newGame();
  });

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best ? `${best.moves}회 / ${best.secs}s` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="4" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${i + 1}</td><td>${r.moves}</td><td>${r.secs}s</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('howBtn').addEventListener('click', () => MGZ.openModal('howModal'));
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });
  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });

  MGZ.trackPlay('memory');
  MGZ.wireSwitches();
  MGZ.wireModals();
  MGZ.autoPause(() => { /* 타이머는 elapsed 실측이라 일시정지 불필요 */ });
  renderLog();
})();
