'use strict';
(() => {
  const N = 4;
  const SAVE_KEY = 'g2048-log', BEST_KEY = 'g2048-best';
  const board = document.getElementById('board');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const scoreNow = document.getElementById('scoreNow');
  const scoreBest = document.getElementById('scoreBest');

  let grid, score, alive, won, newTile;
  let stats = MGZ.load(SAVE_KEY, []);
  let best = MGZ.load(BEST_KEY, 0);

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) cells.push([r, c]);
    return cells;
  }
  function spawn() {
    const cells = emptyCells();
    if (!cells.length) return null;
    const [r, c] = cells[(Math.random() * cells.length) | 0];
    grid[r][c] = Math.random() < .9 ? 2 : 4;
    return [r, c];
  }

  function newGame() {
    grid = Array.from({ length: N }, () => Array(N).fill(0));
    score = 0; alive = true; won = false;
    spawn(); spawn();
    overlay.hidden = true;
    render();
    MGZ.status('방향키로 타일을 미세요');
    MGZ.beep(440, .06, 'square', .06, 660);
  }

  function slide(row) {
    const vals = row.filter(v => v);
    const out = [];
    let gained = 0;
    for (let i = 0; i < vals.length; i++) {
      if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
        out.push(vals[i] * 2); gained += vals[i] * 2; i++;
      } else out.push(vals[i]);
    }
    while (out.length < N) out.push(0);
    return { row: out, gained };
  }

  function move(dx, dy) {
    if (!alive) return;
    let moved = false, gained = 0;
    const next = Array.from({ length: N }, () => Array(N).fill(0));
    if (dx !== 0) {
      for (let r = 0; r < N; r++) {
        const src = dx === 1 ? [...grid[r]].reverse() : grid[r];
        const res = slide(src);
        const merged = dx === 1 ? res.row.reverse() : res.row;
        gained += res.gained;
        for (let c = 0; c < N; c++) { next[r][c] = merged[c]; if (merged[c] !== grid[r][c]) moved = true; }
      }
    } else {
      for (let c = 0; c < N; c++) {
        const line = [];
        for (let r = 0; r < N; r++) line.push(grid[r][c]);
        const src = dy === 1 ? line.reverse() : line;
        const res = slide(src);
        const merged = dy === 1 ? res.row.reverse() : res.row;
        gained += res.gained;
        for (let r = 0; r < N; r++) { next[r][c] = merged[r]; if (merged[r] !== grid[r][c]) moved = true; }
      }
    }
    if (!moved) { MGZ.beep(160, .05, 'square', .04); return; }
    grid = next;
    score += gained;
    if (gained > 0) MGZ.beep(520 + Math.min(600, gained), .05, 'square', .06);
    newTile = spawn();
    if (score > best) { best = score; MGZ.save(BEST_KEY, best); }
    render();
    if (!won && grid.flat().some(v => v >= 2048)) {
      won = true;
      MGZ.status('🎉 2048! 계속 진행할 수 있습니다');
      MGZ.beep(660, .1, 'square', .08, 990); MGZ.beep(880, .1, 'square', .08, 1320, .12);
    } else if (!emptyCells().length && !canMove()) {
      endGame();
    }
  }

  function canMove() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (!grid[r][c]) return true;
      if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return true;
    }
    return false;
  }

  function endGame() {
    alive = false;
    MGZ.beep(200, .3, 'sawtooth', .09, 60);
    const maxTile = Math.max(...grid.flat());
    stats.push({ score, maxTile, at: new Date().toISOString().slice(0, 10) });
    stats.sort((a, b) => b.score - a.score);
    stats = stats.slice(0, 50);
    MGZ.save(SAVE_KEY, stats);
    overlayTitle.textContent = '게임 오버';
    overlayMsg.textContent = `점수 ${score} · 최대 타일 ${maxTile} — 최고 ${best}점`;
    overlay.hidden = false;
    MGZ.status('Enter로 다시 출발');
    renderLog();
  }

  function render() {
    board.innerHTML = '';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const t = document.createElement('div');
      const v = grid[r][c];
      t.className = 'tile' + (v >= 1024 ? ' big' : '');
      if (v) { t.dataset.v = v; t.textContent = v; } else t.dataset.v = '';
      if (newTile && newTile[0] === r && newTile[1] === c) t.classList.add('pop');
      board.appendChild(t);
    }
    newTile = null;
    scoreNow.textContent = score;
    scoreBest.textContent = best;
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !alive) return newGame();
    if ((e.key === 'r' || e.key === 'R')) return newGame();
    if (!alive || !overlay.hidden) return;
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { move(0, -1); e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { move(0, 1); e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { move(-1, 0); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { move(1, 0); e.preventDefault(); }
  });

  let ts = null;
  board.addEventListener('touchstart', e => { ts = e.touches[0]; }, { passive: true });
  board.addEventListener('touchend', e => {
    if (!ts) return;
    const dx = e.changedTouches[0].clientX - ts.clientX;
    const dy = e.changedTouches[0].clientY - ts.clientY;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0);
    else move(0, Math.sign(dy));
    ts = null;
  });

  function renderLog() {
    const body = document.getElementById('logBody');
    document.getElementById('bestLine').textContent = best ? `${best}점` : '—';
    if (!stats.length) { body.innerHTML = '<tr><td colspan="4" class="log-empty">아직 기록이 없습니다</td></tr>'; return; }
    body.innerHTML = stats.slice(0, 10).map((r, i) =>
      `<tr class="rank-${i + 1}"><td>${i + 1}</td><td>${r.score}</td><td>${r.maxTile}</td><td>${r.at}</td></tr>`).join('');
  }

  document.getElementById('startBtn').addEventListener('click', newGame);
  document.getElementById('howBtn').addEventListener('click', () => MGZ.openModal('howModal'));
  document.getElementById('recordsBtn').addEventListener('click', () => { renderLog(); MGZ.openModal('recordsModal'); });
  document.getElementById('clearLog').addEventListener('click', () => { stats = []; MGZ.save(SAVE_KEY, stats); renderLog(); });

  MGZ.wireSwitches();
  MGZ.wireModals();
  renderLog();
  grid = Array.from({ length: N }, () => Array(N).fill(0));
  render();
})();
