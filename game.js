// ===== 30초 던전 — 미니 로그라이크 =====
// 난이도 값은 여기만 바꾸면 됩니다 (20회 기록 비교는 한 값씩!)
const CONFIG = { size: 9, timeMs: 30000, slimes: 3, traps: 4, wallRatio: 0.14 };

const $ = (id) => document.getElementById(id);
const board = $('board'), overlay = $('overlay'), overlayTitle = $('overlayTitle'),
      overlayMsg = $('overlayMsg'), startBtn = $('startBtn'),
      timerFill = $('timerFill'), timerNum = $('timerNum'),
      keyState = $('keyState'), moveCount = $('moveCount'), scoreLine = $('scoreLine'),
      statusLine = $('statusLine'), bestLine = $('bestLine'), logBody = $('logBody');

// ----- 저장: 보존할 값(전적·최고기록·판 기록) / 현재 판 값은 초기화 대상 -----
const SAVE_KEY = 'dungeon30';
const DEFAULT_STATS = { wins: 0, losses: 0, bestMs: null, plays: [] };

function loadStats() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const s = JSON.parse(raw);
    if (typeof s.wins !== 'number' || typeof s.losses !== 'number' || !Array.isArray(s.plays)) {
      return { ...DEFAULT_STATS };        // 손상된 형식 → 기본값으로 복구
    }
    return { wins: s.wins, losses: s.losses, bestMs: typeof s.bestMs === 'number' ? s.bestMs : null, plays: s.plays.slice(-50) };
  } catch {
    return { ...DEFAULT_STATS };          // 깨진 JSON → 기본값으로 복구
  }
}
let stats = loadStats();
function saveStats() { localStorage.setItem(SAVE_KEY, JSON.stringify(stats)); }

// ----- 소리 (WebAudio — 파일 없이 생성) -----
let audioEnabled = localStorage.getItem('dungeon30-sound') !== '0';
let ac = null, bgmTimer = null, bgmStep = 0;
function ctx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function beep(freq, dur = .07, type = 'square', vol = .07, slideTo = null, delay = 0) {
  if (!audioEnabled) return;
  const a = ctx(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + .02);
}
const sfx = {
  move:  () => beep(220, .05, 'square', .04),
  bump:  () => beep(90, .08, 'square', .06),
  key:   () => { beep(660, .08); beep(880, .1, 'square', .07, null, .08); },
  win:   () => [523, 659, 784, 1047].forEach((f, i) => beep(f, .12, 'square', .08, null, i * .09)),
  lose:  () => beep(220, .3, 'sawtooth', .08, 90),
  start: () => beep(440, .08, 'triangle', .07, 660),
};
const BGM_NOTES = [130.8, 164.8, 196, 164.8, 146.8, 196, 220, 196]; // C3 E3 G3 ... 저음 아르페지오
function bgmStart() {
  bgmStop(); bgmStep = 0;
  bgmTimer = setInterval(() => {
    if (!audioEnabled || state.phase !== 'playing') return;
    beep(BGM_NOTES[bgmStep++ % BGM_NOTES.length], .18, 'triangle', .035);
  }, 320);
}
function bgmStop() { clearInterval(bgmTimer); bgmTimer = null; }

// ----- 게임 상태 -----
const state = { phase: 'title', map: [], px: 0, py: 0, hasKey: false, moves: 0, moveTick: 0,
                slimes: [], key: null, stairs: null, remaining: CONFIG.timeMs, deadline: 0, tickTimer: null };

const EMPTY = 0, WALL = 1, TRAP = 2;
const key = (x, y) => y * CONFIG.size + x;

function genMap() {
  const S = CONFIG.size;
  while (true) {
    const map = new Array(S * S).fill(EMPTY);
    for (let i = 0; i < S; i++) { map[i] = map[(S - 1) * S + i] = map[i * S] = map[i * S + S - 1] = WALL; }
    for (let i = 0; i < S * S; i++) {
      if (map[i] === EMPTY && Math.random() < CONFIG.wallRatio) map[i] = WALL;
    }
    const open = () => { const c = []; for (let i = 0; i < S * S; i++) if (map[i] === EMPTY) c.push(i); return c; };
    const pickFar = (from, minDist, cells) => cells.filter(i => Math.abs(i % S - from % S) + Math.abs((i / S | 0) - (from / S | 0)) >= minDist);
    let cells = open();
    const p = cells.splice(Math.floor(Math.random() * cells.length), 1)[0];
    cells = open();
    const kCand = pickFar(p, 6, cells); if (!kCand.length) continue;
    const k = kCand.splice(Math.floor(Math.random() * kCand.length), 1)[0];
    const dCand = pickFar(k, 5, cells); if (!dCand.length) continue;
    const d = dCand[Math.floor(Math.random() * dCand.length)];
    // 함정 배치
    let trapCells = pickFar(p, 2, cells.filter(i => i !== d));
    const traps = [];
    for (let n = 0; n < CONFIG.traps && trapCells.length; n++) {
      const t = trapCells.splice(Math.floor(Math.random() * trapCells.length), 1)[0];
      map[t] = TRAP; traps.push(t);
    }
    // 탈출 가능한지 BFS 확인 (벽·함정은 못 지나감, 슬라임은 움직이니 제외)
    const bfs = (a, b) => {
      const seen = new Set([a]), q = [a];
      while (q.length) {
        const c = q.shift(); if (c === b) return true;
        const cx = c % S, cy = c / S | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy, ni = key(nx, ny);
          if (nx < 0 || ny < 0 || nx >= S || ny >= S || seen.has(ni) || map[ni] !== EMPTY) continue;
          seen.add(ni); q.push(ni);
        }
      }
      return false;
    };
    if (!bfs(p, k) || !bfs(k, d)) continue;
    // 슬라임 배치 (플레이어와 4칸 이상, 열쇠·계단 칸 제외)
    const sCand = pickFar(p, 4, cells.filter(i => map[i] === EMPTY && i !== k && i !== d));
    const slimes = [];
    for (let n = 0; n < CONFIG.slimes && sCand.length; n++) {
      slimes.push(sCand.splice(Math.floor(Math.random() * sCand.length), 1)[0]);
    }
    return { map, p, k, d, slimes };
  }
}

// ----- 렌더 -----
const GLYPH = { player: '🐱', key: '🔑', stairs: '🚪', slime: '🟢', trap: '🔥' };
let cellEls = [];
function buildBoard() {
  board.innerHTML = '';
  cellEls = [];
  for (let i = 0; i < CONFIG.size * CONFIG.size; i++) {
    const c = document.createElement('div');
    c.className = 'cell floor';
    board.appendChild(c);
    cellEls.push(c);
  }
}
function render() {
  const { map, px, py, hasKey } = state;
  for (let i = 0; i < cellEls.length; i++) {
    const el = cellEls[i];
    const t = map[i];
    el.className = 'cell ' + (t === WALL ? 'wall' : 'floor');
    let g = '';
    if (t === WALL) g = '🧱';
    else if (t === TRAP) g = GLYPH.trap;
    if (state.key === i && !hasKey) g = GLYPH.key;
    if (state.stairs === i) g = GLYPH.stairs;
    if (state.slimes.includes(i)) g = GLYPH.slime;
    if (i === key(px, py)) g = GLYPH.player;
    el.textContent = g;
  }
  keyState.textContent = hasKey ? '🔑 있음!' : '없음';
  moveCount.textContent = state.moves;
}
function setStatus(msg) { statusLine.textContent = msg; }
function hud() {
  const r = Math.max(0, state.remaining) / CONFIG.timeMs;
  timerFill.style.width = (r * 100) + '%';
  timerFill.classList.toggle('low', r < .3);
  timerNum.textContent = (Math.max(0, state.remaining) / 1000).toFixed(1);
  scoreLine.textContent = `${stats.wins}승 ${stats.losses}패`;
  bestLine.textContent = stats.bestMs ? (stats.bestMs / 1000).toFixed(1) + '초' : '—';
}

// ----- 판 흐름 -----
function newGame() {
  const { map, p, k, d, slimes } = genMap();
  Object.assign(state, {
    phase: 'playing', map, px: p % CONFIG.size, py: p / CONFIG.size | 0,
    hasKey: false, moves: 0, moveTick: 0, slimes, key: k, stairs: d,
    remaining: CONFIG.timeMs, deadline: performance.now() + CONFIG.timeMs,
  });
  clearInterval(state.tickTimer);
  state.tickTimer = setInterval(tick, 100);
  overlay.hidden = true;
  render(); hud();
  setStatus('던전 입장! 열쇠를 찾아 계단으로 — 30초!');
  sfx.start(); bgmStart();
}
function tick() {
  state.remaining = state.deadline - performance.now();
  hud();
  if (state.remaining <= 0) endGame(false, '시간 초과');
}
function endGame(win, cause) {
  clearInterval(state.tickTimer); bgmStop();
  state.phase = win ? 'won' : 'lost';
  const elapsed = CONFIG.timeMs - Math.max(0, state.remaining);
  stats.plays.push({
    result: win ? 'win' : 'lose', ms: Math.round(elapsed), cause,
    moves: state.moves, cfg: `s${CONFIG.slimes}t${CONFIG.traps}@${CONFIG.timeMs / 1000}s`,
  });
  if (win) { stats.wins++; if (!stats.bestMs || elapsed < stats.bestMs) stats.bestMs = Math.round(elapsed); }
  else stats.losses++;
  saveStats(); renderLog(); hud();
  board.classList.remove('shake', 'flash-win');
  if (win) { sfx.win(); if (!reduceMotion()) board.classList.add('flash-win'); }
  else { sfx.lose(); if (!reduceMotion()) board.classList.add('shake'); }
  overlayTitle.textContent = win ? '탈출 성공!' : '던전에서 쓰러졌다…';
  overlayMsg.innerHTML = win
    ? `⏱ ${(elapsed / 1000).toFixed(1)}초 만에 탈출! 이동 ${state.moves}번.<br>Enter 또는 버튼으로 다음 던전.`
    : `원인: ${cause} · 이동 ${state.moves}번<br>Enter 또는 버튼으로 다시 도전.`;
  startBtn.textContent = '다시 시작 (Enter)';
  overlay.hidden = false;
  setStatus(win ? '탈출 성공! 🎉' : `실패 — ${cause}`);
}

// ----- 이동 -----
function tryMove(dx, dy) {
  if (state.phase !== 'playing') return;
  const nx = state.px + dx, ny = state.py + dy;
  const ni = key(nx, ny);
  const t = state.map[ni];
  if (t === WALL || nx < 0 || ny < 0 || nx >= CONFIG.size || ny >= CONFIG.size) {
    sfx.bump();
    cellEls[ni]?.classList.add('bump');
    setTimeout(() => cellEls[ni]?.classList.remove('bump'), 130);
    return;
  }
  state.px = nx; state.py = ny; state.moves++;
  if (t === TRAP) { render(); endGame(false, '함정 🔥'); return; }
  if (state.slimes.includes(ni)) { render(); endGame(false, '슬라임 🟢'); return; }
  if (ni === state.key && !state.hasKey) {
    state.hasKey = true; sfx.key(); setStatus('열쇠 획득! 계단으로!');
  } else sfx.move();
  if (ni === state.stairs && state.hasKey) { render(); endGame(true, '탈출'); return; }
  if (ni === state.stairs && !state.hasKey) setStatus('계단이 잠겨 있다 — 열쇠가 필요해!');
  // 슬라임 이동 (2수건마다 1칸)
  state.moveTick++;
  if (state.moveTick % 2 === 0) moveSlimes();
  render(); hud();
}
function moveSlimes() {
  const S = CONFIG.size;
  const blocked = (i, ignoreIdx) =>
    state.map[i] === WALL || state.map[i] === TRAP ||
    i === state.key || i === state.stairs ||
    state.slimes.some((s, j) => j !== ignoreIdx && s === i);
  for (let si = 0; si < state.slimes.length; si++) {
    const i = state.slimes[si], sx = i % S, sy = i / S | 0;
    const dx = Math.sign(state.px - sx), dy = Math.sign(state.py - sy);
    const tries = Math.abs(state.px - sx) > Math.abs(state.py - sy)
      ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const [mx, my] of tries) {
      if (!mx && !my) continue;
      const ni = key(sx + mx, sy + my);
      if (sx + mx < 0 || sy + my < 0 || sx + mx >= S || sy + my >= S || blocked(ni, si)) continue;
      state.slimes[si] = ni;
      if (ni === key(state.px, state.py)) { render(); endGame(false, '슬라임 🟢'); return; }
      break;
    }
  }
}

// ----- 일시정지 -----
function pauseGame() {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  state.remaining = state.deadline - performance.now();
  clearInterval(state.tickTimer); bgmStop();
  overlayTitle.textContent = '일시정지';
  overlayMsg.innerHTML = 'P 또는 버튼으로 재개 — 타이머는 멈춰 있습니다.';
  startBtn.textContent = '재개 (P)';
  overlay.hidden = false;
  setStatus('일시정지 중');
}
function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
  state.deadline = performance.now() + state.remaining;
  state.tickTimer = setInterval(tick, 100);
  overlay.hidden = true;
  bgmStart();
  setStatus('재개! 계속 이동하세요.');
}

// ----- 입력 -----
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  const dir = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
                arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
  if (dir) { e.preventDefault(); tryMove(dir[0], dir[1]); return; }
  if (k === 'p' || k === 'escape') { state.phase === 'playing' ? pauseGame() : resumeGame(); return; }
  if (k === 'r' && state.phase !== 'title') { newGame(); return; }
  if (k === 'enter' && state.phase !== 'playing') {
    state.phase === 'paused' ? resumeGame() : newGame();
  }
});
document.querySelectorAll('.dpad button').forEach(b =>
  b.addEventListener('click', () => tryMove(+b.dataset.dx, +b.dataset.dy)));
startBtn.addEventListener('click', () => state.phase === 'paused' ? resumeGame() : newGame());

// 창이 가려지면 자동 일시정지 (C14)
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', pauseGame);

// ----- 기록 패널 -----
function renderLog() {
  const rows = stats.plays.slice(-10).reverse();
  logBody.innerHTML = rows.length
    ? rows.map((p, i) => `<tr><td>${stats.plays.length - i}</td>` +
        `<td class="${p.result === 'win' ? 'win' : 'lose'}">${p.result === 'win' ? '승' : '패'}</td>` +
        `<td>${(p.ms / 1000).toFixed(1)}s</td><td>${p.cause}</td><td>${p.moves}</td></tr>`).join('')
    : '<tr><td colspan="5" class="log-empty">아직 기록이 없습니다</td></tr>';
}
$('copyLog').addEventListener('click', async () => {
  const lines = stats.plays.map((p, i) =>
    `${i + 1},${p.result},${(p.ms / 1000).toFixed(1)}s,${p.cause},${p.moves},${p.cfg}`);
  try {
    await navigator.clipboard.writeText('회차,결과,시간,원인,이동,설정\n' + lines.join('\n'));
    setStatus('기록을 복사했습니다 📋');
  } catch { setStatus('복사 실패 — 수동으로 적어주세요'); }
});
$('clearLog').addEventListener('click', () => {
  stats = { ...DEFAULT_STATS }; saveStats(); renderLog(); hud();
  setStatus('기록을 초기화했습니다');
});

// ----- 스위치 -----
const soundSwitch = $('soundSwitch'), motionSwitch = $('motionSwitch');
function reduceMotion() { return document.documentElement.classList.contains('reduce-motion'); }
function applySound() {
  soundSwitch.setAttribute('aria-checked', String(audioEnabled));
  if (!audioEnabled) bgmStop(); else if (state.phase === 'playing') bgmStart();
  localStorage.setItem('dungeon30-sound', audioEnabled ? '1' : '0');
}
function applyMotion(on) {
  document.documentElement.classList.toggle('reduce-motion', on);
  motionSwitch.setAttribute('aria-checked', String(on));
  localStorage.setItem('dungeon30-motion', on ? '1' : '0');
}
soundSwitch.addEventListener('click', () => { audioEnabled = !audioEnabled; applySound(); });
motionSwitch.addEventListener('click', () => applyMotion(!reduceMotion()));
// OS 설정 반영: 저장값 > 시스템 설정
applyMotion(localStorage.getItem('dungeon30-motion') !== null
  ? localStorage.getItem('dungeon30-motion') === '1'
  : matchMedia('(prefers-reduced-motion: reduce)').matches);
applySound();

// ----- 시작 -----
buildBoard();
renderLog(); hud();
board.focus?.();
