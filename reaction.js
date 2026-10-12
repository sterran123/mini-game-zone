'use strict';
(() => {
  const ROUNDS = 5;
  const SAVE_KEY = 'reaction-log', BEST_KEY = 'reaction-best';
  const pad = document.getElementById('pad');
  const padMain = document.getElementById('padMain');
  const padText = document.getElementById('padText');
  const padSub = document.getElementById('padSub');

  let phase = 'idle', results = [], waitTimer = null, goAt = 0, paused = false;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, null);

  function setPad(cls, main, text, sub) {
    pad.className = `pad ${cls}`;
    padMain.textContent = main;
    padText.textContent = text;
    padSub.textContent = sub;
  }

  function startRun() {
    results = [];
    nextRound();
  }

  function nextRound() {
    phase = 'wait';
    setPad('wait', '✋', '기다리세요…', `${results.length + 1} / ${ROUNDS}회차`);
    MGZ.status('초록으로 바뀌면 클릭!');
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => {
      phase = 'go';
      goAt = performance.now();
      setPad('go', '⚡', '지금 클릭!', `${results.length + 1} / ${ROUNDS}회차`);
      MGZ.beep(880, .07, 'square', .09, 1320);
    }, 1200 + Math.random() * 2400);
  }

  function pauseGame() {
    if (paused || phase !== 'wait') return;
    paused = true;
    clearTimeout(waitTimer);
    setPad('wait', '⏸️', '일시정지', '버튼을 누르면 이어서 대기합니다');
    MGZ.status('일시정지 중');
  }

  function resumeGame() {
    if (!paused) return;
    paused = false;
    nextRound();   // 대기 단계를 처음부터 다시 잡는다 — 시간은 속이지 않음
    MGZ.status('재개 — 초록으로 바뀌면 클릭!');
  }

  function press() {
    if (paused) return;
    if (phase === 'idle' || phase === 'summary') { startRun(); return; }
    if (phase === 'result') { nextRound(); return; }
    if (phase === 'wait') {
      clearTimeout(waitTimer);
      phase = 'wait';
      setPad('too-soon', '😅', '너무 빨라요!', '초록이 된 뒤에 누르세요 — 다시 기다립니다');
      MGZ.beep(200, .15, 'sawtooth', .08, 90);
      waitTimer = setTimeout(() => {
        phase = 'go';
        goAt = performance.now();
        setPad('go', '⚡', '지금 클릭!', `${results.length + 1} / ${ROUNDS}회차`);
        MGZ.beep(880, .07, 'square', .09, 1320);
      }, 1400 + Math.random() * 2000);
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - goAt);
      results.push(ms);
      MGZ.beep(520 + Math.min(500, ms), .05, 'square', .07);
      if (results.length >= ROUNDS) {
        const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
        const min = Math.min(...results);
        phase = 'summary';
        setPad('result', '🏁', `평균 ${avg}ms`, `5회: ${results.join(' · ')}ms`);
        const rec = { avg, min, at: new Date().toISOString().slice(0, 10), name: '' };
        stats.push(rec);
        stats.sort((a, b) => a.avg - b.avg);
        stats = stats.slice(0, 50);
        MGZ.save(SAVE_KEY, stats);
        if (best === null || avg < best) { best = avg; MGZ.save(BEST_KEY, best); }
        MGZ.status(`평균 ${avg}ms — 최고 ${best}ms · 클릭하면 다시`);
        renderLog();
        MGZ.offerName(document.querySelector('.pad-area'), stats, rec, persist);
        MGZ.beep(660, .1, 'square', .08, 990); MGZ.beep(880, .12, 'square', .08, 1320, .12);
      } else {
        phase = 'result';
        setPad('result', '👆', `${ms}ms`, `${results.length}회 완료 — 클릭하면 다음 회차`);
        MGZ.status(`${ms}ms — 클릭하면 ${results.length + 1}회차`);
      }
      return;
    }
  }

  pad.addEventListener('click', press);
  document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (e.target.closest('button') || document.querySelector('.modal:not([hidden])')) return;
      press(); e.preventDefault();
    }
    if (e.key === 'r' || e.key === 'R') { clearTimeout(waitTimer); results = []; paused = false; phase = 'idle'; setPad('idle', '⚡', '클릭해서 시작', '5회 측정 후 평균이 기록됩니다'); MGZ.status('패드를 클릭하면 시작'); }
    if (e.key === 'p' || e.key === 'P') return paused ? resumeGame() : pauseGame();
  });

  const persist = () => { MGZ.save(SAVE_KEY, stats); renderLog(); };

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best !== null ? `${best}ms` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="5" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${MGZ.medal(i)}</td><td>${MGZ.esc(r.name) || '—'}</td><td>${r.avg}ms</td><td>${r.min}ms</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });

  MGZ.trackPlay('reaction');
  MGZ.wireSwitches();
  MGZ.wireModals();
  MGZ.autoPause(pauseGame);
  MGZ.wirePause({ pause: pauseGame, resume: resumeGame, isPaused: () => paused, isActive: () => phase === 'wait' });
  renderLog();
})();
