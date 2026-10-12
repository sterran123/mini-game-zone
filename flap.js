'use strict';
(() => {
  const W = 480, H = 640;
  const SAVE_KEY = 'flap-log', BEST_KEY = 'flap-best';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const canvasArea = document.getElementById('canvasArea');

  const BIRD_X = 110, BIRD_R = 11, GRAV = 1400, FLAP = -420, PIPE_W = 70, GAP = 150;
  let bird, pipes, score, alive, paused, spawnT;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, 0);

  function newGame() {
    bird = { y: H / 2, vy: 0 };
    pipes = []; score = 0; spawnT = 0;
    alive = true; paused = false;
    overlay.hidden = true;
    MGZ.status('탭해서 날으세요');
    flap();
  }

  function flap() {
    if (!alive) return;
    bird.vy = FLAP;
    MGZ.beep(620, .05, 'square', .06, 900);
  }

  function endGame() {
    alive = false;
    canvasArea.classList.add('shake');
    setTimeout(() => canvasArea.classList.remove('shake'), 350);
    MGZ.beep(200, .28, 'sawtooth', .09, 55);
    const rec = { score, at: new Date().toISOString().slice(0, 10), name: '' };
    stats.push(rec);
    stats.sort((a, b) => b.score - a.score);
    stats = stats.slice(0, 50);
    MGZ.save(SAVE_KEY, stats);
    if (score > best) { best = score; MGZ.save(BEST_KEY, best); }
    overlayTitle.textContent = '게임 오버';
    overlayMsg.textContent = `${score}개 통과 — 최고 ${best}개`;
    overlay.hidden = false;
    MGZ.status('Enter로 다시 출발');
    renderLog();
    MGZ.offerName(document.querySelector('#overlay .overlay-card'), stats, rec, persist);
  }

  function update(dt) {
    bird.vy += GRAV * dt;
    bird.y += bird.vy * dt;
    spawnT -= dt;
    if (spawnT <= 0) {
      const gapY = 100 + Math.random() * (H - 280);
      pipes.push({ x: W, gapY, passed: false });
      spawnT = 1.4;
    }
    const speed = 170 + score * 3;
    for (const p of pipes) {
      p.x -= speed * dt;
      if (!p.passed && p.x + PIPE_W < BIRD_X) { p.passed = true; score++; MGZ.beep(980, .05, 'square', .07); MGZ.status(`${score}개 통과`); }
    }
    pipes = pipes.filter(p => p.x + PIPE_W > -10);
    if (bird.y - BIRD_R <= 0 || bird.y + BIRD_R >= H) return endGame();
    for (const p of pipes) {
      const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
      const inGap = bird.y - BIRD_R > p.gapY && bird.y + BIRD_R < p.gapY + GAP;
      if (inX && !inGap) return endGame();
    }
  }

  function draw() {
    ctx.fillStyle = '#17141F';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(139,124,255,.12)';
    for (let i = 0; i < 4; i++) { const cx = (i * 140 + (performance.now() / 40) % 140) % (W + 140) - 70; ctx.fillRect(cx, 60 + i * 90, 60, 14); }
    for (const p of pipes) {
      ctx.fillStyle = '#5CE0B3';
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
      ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - p.gapY - GAP);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(p.x, p.gapY - 6, PIPE_W, 6);
      ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, 6);
    }
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(Math.max(-.5, Math.min(.9, bird.vy / 500)));
    ctx.fillStyle = '#FFD166';
    ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17141F';
    ctx.fillRect(4, -4, 3, 3);
    ctx.restore();
    ctx.fillStyle = 'rgba(244,239,250,.9)';
    ctx.font = '700 26px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(score, W / 2, 60);
    if (paused && alive) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFD166';
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(.033, (now - last) / 1000); last = now;
    if (alive && !paused) update(dt);
    draw();
  }

  function pauseGame() { if (alive && !paused) { paused = true; MGZ.status('일시정지 — P로 재개'); } }
  function resumeGame() { if (alive && paused) { paused = false; last = performance.now(); MGZ.status(`${score}개 통과`); } }

  canvas.addEventListener('pointerdown', () => { if (alive) flap(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !alive) return newGame();
    if ((e.key === 'r' || e.key === 'R') && alive) return endGame();
    if ((e.key === 'r' || e.key === 'R') && !alive) return newGame();
    if (e.key === 'p' || e.key === 'P') return paused ? resumeGame() : pauseGame();
    if (e.key === ' ' || e.key === 'ArrowUp') { flap(); e.preventDefault(); }
  });

  const persist = () => { MGZ.save(SAVE_KEY, stats); renderLog(); };

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best ? `${best}개` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="4" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${MGZ.medal(i)}</td><td>${MGZ.esc(r.name) || '—'}</td><td>${r.score}</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('howBtn').addEventListener('click', () => MGZ.openModal('howModal'));
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });
  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });

  MGZ.trackPlay('flap');
  MGZ.wireSwitches();
  MGZ.wireModals();
  MGZ.autoPause(pauseGame);
  bird = { y: H / 2, vy: 0 }; pipes = []; score = 0; alive = false; paused = false;
  renderLog();
  requestAnimationFrame(loop);
})();
