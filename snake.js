'use strict';
(() => {
  const CELL = 20, COLS = 24, ROWS = 24, W = 480, H = 480;
  const SAVE_KEY = 'snake-log', BEST_KEY = 'snake-best';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const canvasArea = document.getElementById('canvasArea');

  let snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
  let dir = { x: 1, y: 0 }, pending = [], food = { x: 16, y: 12 };
  let score = 0, alive = false, paused = false, acc = 0, stepMs = 150, startedAt = 0;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, 0);

  function placeFood() {
    while (true) {
      const f = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };
      if (!snake.some(s => s.x === f.x && s.y === f.y)) return f;
    }
  }

  function newGame() {
    snake = [{ x: 12, y: 12 }, { x: 11, y: 12 }, { x: 10, y: 12 }];
    dir = { x: 1, y: 0 };
    pending = [];
    food = placeFood();
    score = 0; stepMs = 150; acc = 0;
    alive = true; paused = false;
    startedAt = performance.now();
    overlay.hidden = true;
    MGZ.status('먹이를 먹으세요');
    MGZ.beep(440, .06, 'square', .06, 660);
  }

  function setDir(x, y) {
    if (!alive) return;
    const last = pending.length ? pending[pending.length - 1] : dir;
    if (x === -last.x && y === -last.y) return;
    pending.push({ x, y });
    if (pending.length > 3) pending.shift();
  }

  function step() {
    if (pending.length) dir = pending.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || snake.some(s => s.x === head.x && s.y === head.y)) {
      endGame(head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ? '벽' : '내 몸');
      return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      stepMs = Math.max(70, 150 - score * 3);
      food = placeFood();
      MGZ.beep(880, .05, 'square', .07, 1320);
      MGZ.status(`먹이 ${score}개 · 길이 ${snake.length}`);
    } else {
      snake.pop();
    }
  }

  function endGame(cause) {
    alive = false;
    canvasArea.classList.add('shake');
    setTimeout(() => canvasArea.classList.remove('shake'), 350);
    MGZ.beep(220, .25, 'sawtooth', .09, 60);
    const secs = Math.round((performance.now() - startedAt) / 1000);
    stats.push({ score, len: snake.length, secs, cause, at: new Date().toISOString().slice(0, 10) });
    stats.sort((a, b) => b.score - a.score);
    stats = stats.slice(0, 50);
    MGZ.save(SAVE_KEY, stats);
    if (score > best) { best = score; MGZ.save(BEST_KEY, best); }
    overlayTitle.textContent = `${cause}에 부딪힘!`;
    overlayMsg.textContent = `먹이 ${score}개 · 길이 ${snake.length} · ${secs}초 생존 — 최고 ${best}개`;
    overlay.hidden = false;
    MGZ.status('Enter로 다시 출발');
    renderLog();
  }

  function draw() {
    ctx.fillStyle = '#17141F';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    for (let i = 1; i < COLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, H); ctx.stroke(); }
    for (let i = 1; i < ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(W, i * CELL); ctx.stroke(); }
    ctx.fillStyle = '#FF6B5E';
    ctx.fillRect(food.x * CELL + 3, food.y * CELL + 3, CELL - 6, CELL - 6);
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#5CE0B3' : `rgba(92,224,179,${Math.max(.35, 1 - i * .04)})`;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
    if (paused && alive) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFD166';
      ctx.font = '20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!alive || paused) { draw(); return; }
    acc += now - last; last = now;
    while (acc >= stepMs && alive) { acc -= stepMs; step(); }
    draw();
  }

  function pauseGame() { if (alive && !paused) { paused = true; MGZ.status('일시정지 — P로 재개'); } }
  function resumeGame() { if (alive && paused) { paused = false; last = performance.now(); MGZ.status('먹이를 먹으세요'); } }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !alive) return newGame();
    if (e.key === 'r' || e.key === 'R') { if (!alive) return newGame(); return endGame('재시작'); }
    if (e.key === 'p' || e.key === 'P') return paused ? resumeGame() : pauseGame();
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { setDir(0, -1); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { setDir(0, 1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { setDir(-1, 0); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { setDir(1, 0); e.preventDefault(); }
  });

  let ts = null;
  canvas.addEventListener('touchstart', e => { ts = e.touches[0]; }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!ts) return;
    const dx = e.changedTouches[0].clientX - ts.clientX;
    const dy = e.changedTouches[0].clientY - ts.clientY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(Math.sign(dx), 0);
    else setDir(0, Math.sign(dy));
    ts = null;
  });

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best ? `${best}개` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="5" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${i + 1}</td><td>${r.score}</td><td>${r.len}</td><td>${r.secs}s</td><td>${r.cause}</td></tr>`).join('');
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('howBtn').addEventListener('click', () => MGZ.openModal('howModal'));
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });
  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });

  MGZ.trackPlay('snake');
  MGZ.wireSwitches();
  MGZ.wireModals();
  MGZ.autoPause(pauseGame);
  renderLog();
  requestAnimationFrame(loop);
})();
