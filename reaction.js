'use strict';
(() => {
  const ROUNDS = 5;
  const SAVE_KEY = 'reaction-log', BEST_KEY = 'reaction-best';
  const pad = document.getElementById('pad');
  const padMain = document.getElementById('padMain');
  const padText = document.getElementById('padText');
  const padSub = document.getElementById('padSub');

  let phase = 'idle', results = [], waitTimer = null, goAt = 0;
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
    setPad('wait', '??, '湲곕떎由ъ꽭?붴?, `${results.length + 1} / ${ROUNDS}?뚯감`);
    MGZ.status('珥덈줉?쇰줈 諛붾뚮㈃ ?대┃!');
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => {
      phase = 'go';
      goAt = performance.now();
      setPad('go', '??, '吏湲??대┃!', `${results.length + 1} / ${ROUNDS}?뚯감`);
      MGZ.beep(880, .07, 'square', .09, 1320);
    }, 1200 + Math.random() * 2400);
  }

  function press() {
    if (phase === 'idle' || phase === 'summary') { startRun(); return; }
    if (phase === 'result') { nextRound(); return; }
    if (phase === 'wait') {
      clearTimeout(waitTimer);
      phase = 'wait';
      setPad('too-soon', '?쁾', '?덈Т 鍮⑤씪??', '珥덈줉?????ㅼ뿉 ?꾨Ⅴ?몄슂 ???ㅼ떆 湲곕떎由쎈땲??);
      MGZ.beep(200, .15, 'sawtooth', .08, 90);
      waitTimer = setTimeout(() => {
        phase = 'go';
        goAt = performance.now();
        setPad('go', '??, '吏湲??대┃!', `${results.length + 1} / ${ROUNDS}?뚯감`);
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
        setPad('result', '?뢾', `?됯퇏 ${avg}ms`, `5?? ${results.join(' 쨌 ')}ms`);
        stats.push({ avg, min, at: new Date().toISOString().slice(0, 10) });
        stats.sort((a, b) => a.avg - b.avg);
        stats = stats.slice(0, 50);
        MGZ.save(SAVE_KEY, stats);
        if (best === null || avg < best) { best = avg; MGZ.save(BEST_KEY, best); }
        MGZ.status(`?됯퇏 ${avg}ms ??理쒓퀬 ${best}ms 쨌 ?대┃?섎㈃ ?ㅼ떆`);
        renderLog();
        MGZ.beep(660, .1, 'square', .08, 990); MGZ.beep(880, .12, 'square', .08, 1320, .12);
      } else {
        phase = 'result';
        setPad('result', '?몘', `${ms}ms`, `${results.length}???꾨즺 ???대┃?섎㈃ ?ㅼ쓬 ?뚯감`);
        MGZ.status(`${ms}ms ???대┃?섎㈃ ${results.length + 1}?뚯감`);
      }
      return;
    }
  }

  pad.addEventListener('click', press);
  document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { press(); e.preventDefault(); }
    if (e.key === 'r' || e.key === 'R') { clearTimeout(waitTimer); results = []; phase = 'idle'; setPad('idle', '??, '?대┃?댁꽌 ?쒖옉', '5??痢≪젙 ???됯퇏??湲곕줉?⑸땲??); MGZ.status('?⑤뱶瑜??대┃?섎㈃ ?쒖옉'); }
  });

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best !== null ? `${best}ms` : '??;
    if (!stats.length) { body.innerHTML = '<tr><td colspan="4" class="log-empty">?꾩쭅 湲곕줉???놁뒿?덈떎</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${i + 1}</td><td>${r.avg}ms</td><td>${r.min}ms</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });

  MGZ.trackPlay('reaction');
  MGZ.wireSwitches();
  MGZ.wireModals();
  renderLog();
})();
