'use strict';
(() => {
  const W = 480, H = 640;
  const SAVE_KEY = 'breakout-log', BEST_KEY = 'breakout-best';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const canvasArea = document.getElementById('canvasArea');

  const ROW_COLORS = ['#FF6B5E', '#FFD166', '#8B7CFF', '#5CE0B3', '#B9AFD0', '#FF9F6E', '#7CC9FF', '#FFB3C7'];
  let paddle, ball, bricks, score, lives, level, alive, paused, serving;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, 0);

  function buildBricks(lv) {
    const cols = 6, rows = Math.min(4 + lv, 8), gap = 6, margin = 24, top = 90;
    const bw = (W - margin * 2 - gap * (cols - 1)) / cols, bh = 22;
    const list = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        list.push({ x: margin + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, color: ROW_COLORS[r % ROW_COLORS.length], pts: (rows - r) * 10, hit: false });
    return list;
  }

  function resetServe() {
    paddle = { x: W / 2 - 45, w: 90, h: 12, y: H - 40 };
    ball = { x: W / 2, y: H - 60, vx: 0, vy: 0, r: 6, speed: 320 + level * 40 };
    serving = true;
  }

  function launch() {
    if (!serving) return;
    serving = false;
    const a = -Math.PI / 2 + (Math.random() - .5) * .8;
    ball.vx = Math.cos(a) * ball.speed;
    ball.vy = Math.sin(a) * ball.speed;
    MGZ.beep(520, .06, 'square', .07, 780);
  }

  function newGame() {
    score = 0; lives = 3; level = 1;
    bricks = buildBricks(level);
    resetServe();
    alive = true; paused = false;
    overlay.hidden = true;
    MGZ.status('클릭하면 공이 출발합니다');
  }

  function nextLevel() {
    level++;
    bricks = buildBricks(level);
    resetServe();
    MGZ.status(`LV${level} — 클릭하면 공이 출발합니다`);
    MGZ.beep(660, .08, 'square', .07, 990);
  }

  function endGame() {
    alive = false;
    canvasArea.classList.add('shake');
    setTimeout(() => canvasArea.classList.remove('shake'), 350);
    MGZ.beep(180, .3, 'sawtooth', .09, 50);
    const rec = { score, level, lives, at: new Date().toISOString().slice(0, 10), name: '' };
    stats.push(rec);
    stats.sort((a, b) => b.score - a.score);
    stats = stats.slice(0, 50);
    MGZ.save(SAVE_KEY, stats);
    if (score > best) { best = score; MGZ.save(BEST_KEY, best); }
    overlayTitle.textContent = '게임 오버';
    overlayMsg.textContent = `점수 ${score} · LV${level} 도달 — 최고 ${best}점`;
    overlay.hidden = false;
    MGZ.status('Enter로 다시 출발');
    renderLog();
    MGZ.offerName(document.querySelector('#overlay .overlay-card'), stats, rec, persist);
  }

  function update(dt) {
    if (serving) { ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r - 2; return; }
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); MGZ.beep(300, .03, 'square', .04); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); MGZ.beep(300, .03, 'square', .04); }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); MGZ.beep(300, .03, 'square', .04); }
    if (ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h && ball.x >= paddle.x && ball.x <= paddle.x + paddle.w && ball.vy > 0) {
      const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
      const a = -Math.PI / 2 + rel * 1.05;
      ball.vx = Math.cos(a) * ball.speed; ball.vy = Math.sin(a) * ball.speed;
      ball.y = paddle.y - ball.r - 1;
      MGZ.beep(440, .04, 'square', .05);
    }
    for (const b of bricks) {
      if (b.hit) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.hit = true; score += b.pts;
        const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
        const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
        if (overlapX < overlapY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
        MGZ.beep(500 + b.pts * 4, .04, 'square', .06);
        MGZ.status(`점수 ${score} · 목숨 ${lives} · LV${level}`);
        break;
      }
    }
    if (bricks.every(b => b.hit)) return nextLevel();
    if (ball.y - ball.r > H) {
      lives--;
      if (lives <= 0) return endGame();
      resetServe();
      MGZ.status(`목숨 ${lives}개 — 클릭하면 공이 출발합니다`);
      MGZ.beep(240, .18, 'sawtooth', .08, 120);
    }
  }

  function draw() {
    ctx.fillStyle = '#17141F';
    ctx.fillRect(0, 0, W, H);
    for (const b of bricks) {
      if (b.hit) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    }
    ctx.fillStyle = '#5CE0B3';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = '#FFD166';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(244,239,250,.85)';
    ctx.font = '600 14px Pretendard, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`점수 ${score}   LV${level}   ♥×${lives}`, 16, 30);
    ctx.textAlign = 'right';
    ctx.fillText(`BEST ${best}`, W - 16, 30);
    if (paused && alive) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFD166';
      ctx.font = '20px "Press Start 2P", monospace'; ctx.textAlign = 'center';
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
  function resumeGame() { if (alive && paused) { paused = false; last = performance.now(); MGZ.status(`점수 ${score}`); } }

  function movePaddle(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width * W;
    paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
  }

  canvas.addEventListener('mousemove', e => { if (alive) movePaddle(e.clientX); });
  canvas.addEventListener('touchmove', e => { if (alive) { movePaddle(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
  canvas.addEventListener('click', () => { if (alive) launch(); });
  canvas.addEventListener('touchstart', () => { if (alive) launch(); }, { passive: true });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !alive) return newGame();
    if ((e.key === 'r' || e.key === 'R') && alive) return endGame();
    if (e.key === 'p' || e.key === 'P') return paused ? resumeGame() : pauseGame();
    if (!alive) return;
    if (e.key === ' ') { launch(); e.preventDefault(); return; }
    const step = 34;
    if (e.key === 'ArrowLeft') { paddle.x = Math.max(0, paddle.x - step); e.preventDefault(); }
    if (e.key === 'ArrowRight') { paddle.x = Math.min(W - paddle.w, paddle.x + step); e.preventDefault(); }
  });

  const persist = () => { MGZ.save(SAVE_KEY, stats); renderLog(); };

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best ? `${best}점` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="6" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${MGZ.medal(i)}</td><td>${MGZ.esc(r.name) || '—'}</td><td>${r.score}</td><td>${r.level}</td><td>${r.lives}</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('howBtn').addEventListener('click', () => MGZ.openModal('howModal'));
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });
  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });

  MGZ.trackPlay('breakout');
  MGZ.wireSwitches();
  MGZ.wireModals();
  MGZ.autoPause(pauseGame);
  MGZ.wirePause({ pause: pauseGame, resume: resumeGame, isPaused: () => paused, isActive: () => alive });
  score = 0; lives = 3; level = 1; alive = false; paused = false;
  bricks = buildBricks(level);
  resetServe();
  renderLog();
  requestAnimationFrame(loop);
})();
