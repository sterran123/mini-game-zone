'use strict';
(() => {
  const ROUND_S = 30;
  const SAVE_KEY = 'whack-log', BEST_KEY = 'whack-best';
  const boardEl = document.getElementById('whackBoard');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const scoreNow = document.getElementById('scoreNow');
  const timeLeft = document.getElementById('timeLeft');

  let holes, score, hits, alive, endAt, spawnTimer, hideTimer, tickTimer, current, runId = 0;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, 0);

  boardEl.innerHTML = '';
  holes = Array.from({ length: 9 }, (_, i) => {
    const b = document.createElement('button');
    b.className = 'hole'; b.dataset.i = i;
    b.setAttribute('aria-label', `구멍 ${i + 1}`);
    b.innerHTML = '<span class="mole"></span>';
    b.addEventListener('pointerdown', () => whack(i));
    boardEl.appendChild(b);
    return b;
  });

  function pop() {
    if (!alive) return;
    const id = runId;
    const elapsed = 1 - (endAt - performance.now()) / (ROUND_S * 1000);
    const speedUp = Math.min(1, Math.max(0, elapsed));
    const gap = 950 - speedUp * 380;
    const show = 700 - speedUp * 260;
    spawnTimer = setTimeout(() => {
      if (!alive || id !== runId) return;
      current = (Math.random() * 9) | 0;
      const gold = Math.random() < .12;
      holes[current].classList.add('up');
      holes[current].querySelector('.mole').textContent = gold ? '⭐' : '🐹';
      holes[current].dataset.gold = gold ? '1' : '';
      hideTimer = setTimeout(() => {
        if (current >= 0) { holes[current].classList.remove('up'); holes[current].dataset.gold = ''; current = -1; }
      }, show);
      pop();
    }, gap);
  }

  function whack(i) {
    if (!alive || i !== current || !holes[i].classList.contains('up')) return;
    const gold = holes[i].dataset.gold === '1';
    const pts = gold ? 5 : 1;
    score += pts; hits++;
    holes[i].classList.remove('up'); holes[i].dataset.gold = '';
    current = -1;
    clearTimeout(hideTimer);
    scoreNow.textContent = score;
    MGZ.status(gold ? `황금 두더지! +${pts}점` : `+${pts}점`);
    MGZ.beep(gold ? 990 : 640, .05, 'square', .07, gold ? 1480 : null);
  }

  function tick() {
    const left = Math.max(0, (endAt - performance.now()) / 1000);
    timeLeft.textContent = left.toFixed(1);
    if (left <= 0) endGame();
  }

  function newGame() {
    runId++;
    score = 0; hits = 0; current = -1; alive = true;
    endAt = performance.now() + ROUND_S * 1000;
    scoreNow.textContent = '0'; timeLeft.textContent = ROUND_S.toFixed(1);
    clearInterval(tickTimer); tickTimer = setInterval(tick, 90);
    holes.forEach(h => { h.classList.remove('up'); h.dataset.gold = ''; });
    overlay.hidden = true;
    MGZ.status('두더지를 잡으세요!');
    MGZ.beep(440, .06, 'square', .06, 660);
    pop();
  }

  function endGame() {
    alive = false;
    runId++;
    clearTimeout(spawnTimer); clearTimeout(hideTimer); clearInterval(tickTimer);
    if (current >= 0) { holes[current].classList.remove('up'); holes[current].dataset.gold = ''; current = -1; }
    MGZ.beep(300, .2, 'square', .07, 150); MGZ.beep(660, .12, 'square', .08, 990, .15);
    stats.push({ score, hits, at: new Date().toISOString().slice(0, 10) });
    stats.sort((a, b) => b.score - a.score);
    stats = stats.slice(0, 50);
    MGZ.save(SAVE_KEY, stats);
    if (score > best) { best = score; MGZ.save(BEST_KEY, best); }
    overlayTitle.textContent = '시간 끝!';
    overlayMsg.textContent = `점수 ${score} · ${hits}마리 잡음 — 최고 ${best}점`;
    overlay.hidden = false;
    MGZ.status('Enter로 다시 출발');
    renderLog();
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !alive) return newGame();
    if (e.key === 'r' || e.key === 'R') return alive ? endGame() : newGame();
  });

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best ? `${best}점` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="4" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${i + 1}</td><td>${r.score}</td><td>${r.hits}</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('howBtn').addEventListener('click', () => MGZ.openModal('howModal'));
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });
  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });

  MGZ.trackPlay('whack');
  MGZ.wireSwitches();
  MGZ.wireModals();
  renderLog();
})();
