// ===== 메테오 런 — 회피 서바이벌 =====
// 난이도 값은 여기만 바꾸면 됩니다 (20회 기록 비교는 한 값씩!)
const CONFIG = {
  baseInterval: 700,   // 운석 생성 간격(ms) — 시간이 지날수록 줄어듦
  ramp: 8,             // 매 초 간격 감소폭(ms)
  minInterval: 240,
  fallBase: 180,       // 기본 낙하 속도(px/s)
  fallRamp: 14,        // 레벨당 추가 속도
  playerSpeed: 420,    // 키보드 이동 속도
  starInterval: 3200,  // 별 생성 간격
  levelUpMs: 12000,    // 레벨업 주기 — 5의 배수 레벨에서 보스 출현
};

const W = 480, H = 640;
const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas'), ctx2d = canvas.getContext('2d');
const overlay = $('overlay'), overlayTitle = $('overlayTitle'), overlayMsg = $('overlayMsg'),
      startBtn = $('startBtn'), statusLine = $('statusLine'),
      timeNum = $('timeNum'), starNum = $('starNum'), levelNum = $('levelNum'),
      bestNum = $('bestNum'), bestLine = $('bestLine'), logBody = $('logBody');
ctx2d.imageSmoothingEnabled = false;

// ----- 스프라이트 -----
const SPR = 'assets/sprites/';
const imgs = {};
for (const n of ['rocket', 'meteor', 'star', 'cloud', 'boss']) {
  imgs[n] = new Image(); imgs[n].src = SPR + n + '.svg';
}

// ----- 저장: 보존할 값(최고기록·판 기록) / 현재 판 값은 초기화 대상 -----
const SAVE_KEY = 'meteorrun';
const DEFAULT_STATS = { best: 0, plays: [] };
function loadStats() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const s = JSON.parse(raw);
    if (typeof s.best !== 'number' || !Array.isArray(s.plays)) return { ...DEFAULT_STATS };
    return { best: s.best, plays: s.plays.slice(-50) };
  } catch { return { ...DEFAULT_STATS }; }
}
let stats = loadStats();
function saveStats() { localStorage.setItem(SAVE_KEY, JSON.stringify(stats)); }

// ----- 소리 (WebAudio — 파일 없이 생성) -----
let audioEnabled = localStorage.getItem('meteor-sound') !== '0';
let ac = null, bgmTimer = null, bgmStep = 0, drone = null;
function actx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function beep(freq, dur = .07, type = 'square', vol = .07, slideTo = null, delay = 0) {
  if (!audioEnabled) return;
  const a = actx(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + .02);
}
const sfx = {
  whoosh: () => beep(300, .12, 'sawtooth', .03, 900),
  star:   () => { beep(880, .07, 'square', .06); beep(1174, .09, 'square', .06, null, .06); },
  boom:   () => { beep(160, .35, 'sawtooth', .1, 45); beep(80, .4, 'square', .08, 30, .05); },
  shoot:  () => beep(720, .03, 'square', .02),
  item:   () => { beep(520, .07, 'square', .06, 900); beep(780, .08, 'square', .05, null, .07); },
  shieldHit:() => beep(300, .12, 'triangle', .08, 500),
  bossHit:() => beep(1200, .04, 'square', .05, 700),
  alarm:  () => [330, 330, 330].forEach((f, i) => beep(f, .14, 'square', .08, null, i * .18)),
  bossDown:() => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, .12, 'square', .08, null, i * .08)),
  levelUp:() => [523, 784, 1047].forEach((f, i) => beep(f, .1, 'square', .07, null, i * .07)),
  start:  () => beep(330, .1, 'triangle', .07, 660),
};
const BGM = [98, 123.5, 147, 123.5, 110, 147, 165, 147];
function bgmStart() {
  bgmStop(); bgmStep = 0;
  const rate = Math.max(180, 340 - state.level * 30);
  bgmTimer = setInterval(() => {
    if (!audioEnabled || state.phase !== 'playing') return;
    beep(BGM[bgmStep++ % BGM.length], .18, 'triangle', .032);
  }, rate);
  // 엔진 드론
  const a = actx();
  drone = { o: a.createOscillator(), g: a.createGain() };
  drone.o.type = 'sawtooth'; drone.o.frequency.value = 49;
  drone.g.gain.value = audioEnabled ? .012 : 0;
  drone.o.connect(drone.g).connect(a.destination);
  drone.o.start();
}
function bgmStop() {
  clearInterval(bgmTimer); bgmTimer = null;
  if (drone) { drone.o.stop(); drone = null; }
}

// ----- 게임 상태 -----
const state = { phase: 'title', t: 0, lt: 0, px: W / 2, meteors: [], stars: [], parts: [], clouds: [],
                bgStars: [], spawnT: 0, starT: 0, level: 1, dodged: 0, starCount: 0,
                last: 0, raf: 0, keyL: false, keyR: false, targetX: null, tilt: 0,
                boss: null, bossAt: 0, bullets: [], shots: [], shotT: 0,
                items: [], itemT: 0, buffs: { double: 0, rapid: 0, shield: 0 } };
for (let i = 0; i < 40; i++) state.bgStars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + .5, tw: Math.random() * 6.28 });

const PSIZE = 46, PY = H - 84;
const rand = (a, b) => a + Math.random() * (b - a);
const levelAt = (t) => Math.min(99, 1 + Math.floor(t / CONFIG.levelUpMs));
const spawnInterval = (t) => Math.max(CONFIG.minInterval, CONFIG.baseInterval - (t / 1000) * CONFIG.ramp);

function newGame() {
  Object.assign(state, {
    phase: 'playing', t: 0, lt: 0, px: W / 2, meteors: [], stars: [], parts: [],
    bullets: [], shots: [], boss: null, bossAt: 0, shotT: 0,
    items: [], itemT: 0, buffs: { double: 0, rapid: 0, shield: 0 },
    spawnT: 600, starT: 1200, level: 1, dodged: 0, starCount: 0, targetX: null, tilt: 0,
    clouds: state.clouds.length ? state.clouds : [{ x: 60, y: 90, s: 1.2, v: 14 }, { x: 340, y: 200, s: .9, v: 20 }],
  });
  overlay.hidden = true;
  setStatus('출발! 운석을 피하세요');
  sfx.start(); bgmStart();
  state.last = performance.now();
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(loop);
}

// ----- 업데이트 -----
function loop(now) {
  const dt = Math.min(.05, (now - state.last) / 1000);
  state.last = now;
  if (state.phase === 'playing') { update(dt); }
  draw();
  state.raf = requestAnimationFrame(loop);
}
function update(dt) {
  state.t += dt * 1000;
  // 레벨용 시간은 보스전 중엔 멈춤 (점수용 t는 계속 흐름)
  if (!state.boss) state.lt += dt * 1000;
  // 레벨업 (보스전 중엔 레벨 고정)
  const lv = levelAt(state.lt);
  if (lv !== state.level && !state.boss) {
    state.level = lv;
    sfx.levelUp(); bgmStart();      // 배경음 빨라짐
    flash('LEVEL ' + lv + '!');
  }
  // 보스 등장: 5의 배수 레벨
  if (!state.boss && state.level % 5 === 0 && state.level > 0 && state.bossAt !== state.level) {
    spawnBoss(state.level);
  }
  // 플레이어 이동: 포인터 목표 > 키 속도
  if (state.targetX !== null) {
    const dx = state.targetX - state.px;
    state.px += Math.sign(dx) * Math.min(Math.abs(dx), CONFIG.playerSpeed * 1.6 * dt);
  }
  if (state.keyL) state.px -= CONFIG.playerSpeed * dt;
  if (state.keyR) state.px += CONFIG.playerSpeed * dt;
  state.px = Math.max(PSIZE / 2, Math.min(W - PSIZE / 2, state.px));
  // 기울임: 이동 방향으로 로켓이 살짝 기울어짐
  const tiltTarget = ((state.keyR ? 1 : 0) - (state.keyL ? 1 : 0)) * .3
    + (state.targetX !== null ? Math.sign(state.targetX - state.px) * Math.min(.2, Math.abs(state.targetX - state.px) / 300) : 0);
  state.tilt += (Math.max(-.35, Math.min(.35, tiltTarget)) - state.tilt) * Math.min(1, dt * 12);
  // 운석 생성 (보스전 중엔 잠시 멈춤)
  state.spawnT -= dt * 1000;
  if (state.spawnT <= 0 && !state.boss) {
    state.spawnT = spawnInterval(state.lt) * rand(.7, 1.3);
    state.meteors.push({ x: rand(24, W - 24), y: -40, r: rand(15, 24),
      vy: CONFIG.fallBase + state.level * CONFIG.fallRamp + rand(0, 60),
      vx: rand(-24, 24), rot: rand(0, 6.28), spin: rand(-2.5, 2.5), passed: false });
  }
  // 보스전
  if (state.boss) updateBoss(dt);
  // 별 생성
  state.starT -= dt * 1000;
  if (state.starT <= 0) {
    state.starT = CONFIG.starInterval * rand(.8, 1.4);
    state.stars.push({ x: rand(20, W - 20), y: -20, vy: 120 + state.level * 10, tw: 0 });
  }
  // 운석 이동 + 충돌
  const px = state.px, pw = PSIZE / 2;
  for (const m of state.meteors) {
    m.y += m.vy * dt; m.x += m.vx * dt; m.rot += m.spin * dt;
    if (m.x < m.r) { m.x = m.r; m.vx *= -1; }
    if (m.x > W - m.r) { m.x = W - m.r; m.vx *= -1; }
    if (!m.passed && m.y > PY + PSIZE / 2) { m.passed = true; state.dodged++; }
    // 근접 스침 사운드
    if (!m.whooshed && m.y > PY - 90 && Math.abs(m.x - px) < m.r + pw + 18) { m.whooshed = true; sfx.whoosh(); }
    // 원형 충돌
    const dx = m.x - px, dy = m.y - PY;
    if (dx * dx + dy * dy < (m.r + pw - 6) ** 2) { hit('운석'); return; }
  }
  state.meteors = state.meteors.filter(m => m.y < H + 60);
  // 별 줍기
  for (const s of state.stars) {
    s.y += s.vy * dt; s.tw += dt * 6;
    const dx = s.x - px, dy = s.y - PY;
    if (Math.abs(dx) < pw + 12 && Math.abs(dy) < pw + 12) {
      s.got = true; state.starCount++; sfx.star(); sparkle(s.x, s.y);
      state.parts.push({ x: s.x, y: s.y - 14, vx: 0, vy: -60, life: .8, c: '#FFD166', txt: '+1' });
    }
  }
  state.stars = state.stars.filter(s => !s.got && s.y < H + 30);
  // 구름·파티클·배경별
  for (const c of state.clouds) { c.x += c.v * dt; if (c.x - 140 > W) c.x = -140; }
  for (const p of state.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.life -= dt; }
  state.parts = state.parts.filter(p => p.life > 0);
  hud();
}
// ----- 보스 -----
function spawnBoss(lv) {
  const tier = lv / 5;
  state.boss = { tier, hp: 18 + tier * 10, maxHp: 18 + tier * 10,
                 x: W / 2, y: -70, t: 0, aimT: 1400, fanT: 2200, ringT: 3000, eva: 0 };
  state.shotT = 400;
  flash('⚠ WARNING ⚠'); sfx.alarm();
  setStatus(`보스 출현! 탄막을 피하면서 총알을 맞히세요`);
}
function updateBoss(dt) {
  const b = state.boss, pw = PSIZE / 2;
  b.t += dt;
  // 등장 후 좌우 사인 이동 + 상하 살랑
  b.y += (90 + Math.sin(b.t * .7) * 16 - b.y) * Math.min(1, dt * 2.2);
  // 회피 AI: 올라오는 총알이 가까우면 반대쪽으로 도망
  let threat = false;
  for (const s of state.shots) {
    if (!s.got && s.y > b.y && s.y - b.y < 260 && Math.abs(s.x - b.x) < 64) {
      threat = true;
      b.eva += (b.x < state.px ? -1 : 1) * (200 + b.tier * 40) * dt;
    }
  }
  if (!threat) b.eva *= 1 - Math.min(1, dt * 1.6);   // 위협 없으면 중앙으로 복귀
  b.eva = Math.max(-140, Math.min(140, b.eva));
  const bx = W / 2 + Math.sin(b.t * (.5 + b.tier * .14)) * (140 + b.tier * 10) + b.eva;
  b.x = Math.max(48, Math.min(W - 48, bx));
  // 플레이어 자동 사격 (연사 버프 = 간격 절반, 더블샷 = 두 갈래)
  state.shotT -= dt * 1000;
  if (state.shotT <= 0 && b.y > 0) {
    state.shotT = state.buffs.rapid > 0 ? 140 : 280;
    const y = PY - PSIZE / 2 - 4;
    state.shots.push({ x: state.px, y, vy: -560 });
    if (state.buffs.double > 0) {
      state.shots.push({ x: state.px - 14, y, vy: -560 });
      state.shots.push({ x: state.px + 14, y, vy: -560 });
    }
    sfx.shoot();
  }
  // 버프 타이머
  state.buffs.double = Math.max(0, state.buffs.double - dt);
  state.buffs.rapid = Math.max(0, state.buffs.rapid - dt);
  // 파워업 스폰: 보스전 중 4.5초마다
  state.itemT -= dt * 1000;
  if (state.itemT <= 0) {
    state.itemT = 4500;
    state.items.push({ x: rand(30, W - 30), y: -18, vy: 95,
      type: ['double', 'rapid', 'shield'][Math.floor(Math.random() * 3)], tw: 0 });
  }
  for (const it of state.items) {
    it.y += it.vy * dt; it.tw += dt * 5;
    const dx = it.x - state.px, dy = it.y - PY;
    if (Math.abs(dx) < PSIZE / 2 + 14 && Math.abs(dy) < PSIZE / 2 + 14) {
      it.got = true;
      if (it.type === 'shield') { state.buffs.shield = 1; setStatus('🛡️ 실드 획득! 탄 1발 차단'); }
      else if (it.type === 'double') { state.buffs.double = 8; setStatus('🔮 더블샷 8초!'); }
      else { state.buffs.rapid = 8; setStatus('⚡ 연사 8초!'); }
      sfx.item(); sparkle(it.x, it.y);
    }
  }
  state.items = state.items.filter(it => !it.got && it.y < H + 20);
  // 보스 패턴: 티어가 오를수록 패턴이 늘고 빨라짐
  if (b.t > 1) {
    b.aimT -= dt * 1000;
    if (b.aimT <= 0) { b.aimT = Math.max(420, 950 - b.tier * 90); fireAimed(b); }
  }
  if (b.tier >= 2 && b.t > 1.5) {
    b.fanT -= dt * 1000;
    if (b.fanT <= 0) { b.fanT = Math.max(850, 1400 - b.tier * 130); fireFan(b); }
  }
  if (b.tier >= 3 && b.t > 2) {
    b.ringT -= dt * 1000;
    if (b.ringT <= 0) { b.ringT = Math.max(1250, 2100 - b.tier * 160); fireRing(b); }
  }
  // 내 총알 → 보스 명중
  for (const s of state.shots) {
    s.y += s.vy * dt;
    if (!s.got && Math.abs(s.x - b.x) < 34 && Math.abs(s.y - b.y) < 24) {
      s.got = true; b.hp--; sfx.bossHit();
      state.parts.push({ x: s.x, y: s.y, vx: rand(-80, 80), vy: rand(-100, -20), life: .3, c: '#5CE0B3' });
    }
  }
  state.shots = state.shots.filter(s => !s.got && s.y > -20);
  // 보스 탄 → 플레이어 충돌
  for (const bl of state.bullets) {
    bl.x += bl.vx * dt; bl.y += bl.vy * dt;
    const dx = bl.x - state.px, dy = bl.y - PY;
    if (dx * dx + dy * dy < (bl.r + pw - 6) ** 2) {
      if (state.buffs.shield > 0) {         // 실드가 탄을 차단
        state.buffs.shield = 0; bl.got = true;
        sfx.shieldHit(); sparkle(state.px, PY);
        setStatus('실드가 막았습니다!');
        continue;
      }
      hit('보스탄'); return;
    }
  }
  state.bullets = state.bullets.filter(bl => !bl.got && bl.y < H + 30 && bl.y > -30 && bl.x > -30 && bl.x < W + 30);
  if (b.hp <= 0) killBoss();
}
function fireAimed(b) {   // 플레이어를 향한 단발
  const dx = state.px - b.x, dy = PY - b.y, len = Math.hypot(dx, dy) || 1;
  const sp = 170 + b.tier * 22;
  state.bullets.push({ x: b.x, y: b.y + 16, vx: dx / len * sp, vy: dy / len * sp, r: 5 });
}
function fireFan(b) {     // 플레이어 방향 3방향 팬
  const base = Math.atan2(PY - b.y, state.px - b.x), sp = 150 + b.tier * 16;
  for (const a of [-.38, 0, .38]) {
    state.bullets.push({ x: b.x, y: b.y + 14, vx: Math.cos(base + a) * sp, vy: Math.sin(base + a) * sp, r: 5 });
  }
}
function fireRing(b) {    // 원형 탄환
  const n = 10, sp = 120 + b.tier * 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + b.t;
    state.bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5 });
  }
}
function killBoss() {
  const b = state.boss;
  explode(b.x, b.y); explode(b.x - 26, b.y + 8); explode(b.x + 26, b.y - 6);
  state.starCount += 3;                      // 격파 보너스 ⭐3
  state.bossAt = state.level;
  state.boss = null;
  state.bullets = []; state.shots = []; state.items = [];
  state.buffs = { double: 0, rapid: 0, shield: 0 };   // 버프는 보스전 한정 — 남겨두지 않음
  state.spawnT = 900;
  flash('BOSS DOWN!'); sfx.bossDown();
  setStatus('보스 격파! ⭐+3 — 계속 버티세요');
}
function sparkle(x, y) {
  for (let i = 0; i < 6; i++) state.parts.push({ x, y, vx: rand(-90, 90), vy: rand(-140, -30), life: .45, c: '#FFD166' });
}
function hit(cause) {
  explode(state.px, PY);
  endGame(cause);
}
function explode(x, y) {
  if (reduceMotion()) { state.parts.push({ x, y, vx: 0, vy: 0, life: .3, c: '#FF6B5E' }); return; }
  const cs = ['#FF6B5E', '#FFB84D', '#FFE08A', '#9B8AA8'];
  for (let i = 0; i < 22; i++) {
    const a = rand(0, 6.28), v = rand(60, 260);
    state.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rand(.4, .9), c: cs[i % cs.length] });
  }
}
function flash(msg) {
  if (reduceMotion()) return;
  const el = document.createElement('div');
  el.className = 'level-flash'; el.innerHTML = `<span>${msg}</span>`;
  $('canvasArea').appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ----- 그리기 -----
function draw() {
  // 하늘
  const g = ctx2d.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#14111D'); g.addColorStop(.7, '#221D31'); g.addColorStop(1, '#2A2438');
  ctx2d.fillStyle = g; ctx2d.fillRect(0, 0, W, H);
  // 배경 별
  ctx2d.fillStyle = '#fff';
  for (const s of state.bgStars) {
    ctx2d.globalAlpha = .25 + .35 * (0.5 + 0.5 * Math.sin(state.t / 600 + s.tw));
    ctx2d.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx2d.globalAlpha = .3;
  for (const c of state.clouds) ctx2d.drawImage(imgs.cloud, c.x, c.y, 110 * c.s, 66 * c.s);
  ctx2d.globalAlpha = 1;
  // 별 아이템
  for (const s of state.stars) {
    const sc = 28 + Math.sin(s.tw) * 3;
    ctx2d.drawImage(imgs.star, s.x - sc / 2, s.y - sc / 2, sc, sc);
  }
  // 보스 탄환·내 총알
  for (const bl of state.bullets) {
    ctx2d.fillStyle = '#FF5EA0';
    ctx2d.beginPath(); ctx2d.arc(bl.x, bl.y, bl.r, 0, 6.28); ctx2d.fill();
    ctx2d.fillStyle = '#FFD6EC';
    ctx2d.beginPath(); ctx2d.arc(bl.x, bl.y, bl.r * .4, 0, 6.28); ctx2d.fill();
  }
  for (const s of state.shots) {
    ctx2d.fillStyle = '#5CE0B3';
    ctx2d.fillRect(s.x - 2, s.y - 8, 4, 12);
    ctx2d.fillStyle = '#D8FFF0';
    ctx2d.fillRect(s.x - 1, s.y - 8, 2, 12);
  }
  // 파워업 캡슐 (보스전 전용) — 색깔+알파벳으로 구분
  const ITEM_STYLE = { double: ['#8B7CFF', 'D'], rapid: ['#FFD166', 'R'], shield: ['#5CE0B3', 'S'] };
  for (const it of state.items) {
    const [c, letter] = ITEM_STYLE[it.type];
    const bob = Math.sin(it.tw) * 2;
    ctx2d.save();
    ctx2d.shadowColor = c; ctx2d.shadowBlur = 10;
    ctx2d.fillStyle = c;
    ctx2d.beginPath();
    ctx2d.roundRect(it.x - 13, it.y - 13 + bob, 26, 26, 6);
    ctx2d.fill();
    ctx2d.shadowBlur = 0;
    ctx2d.fillStyle = '#17141F';
    ctx2d.font = '700 14px "Press Start 2P", monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(letter, it.x, it.y + 5 + bob);
    ctx2d.restore();
  }
  // 보스 + HP 바
  if (state.boss) {
    const b = state.boss;
    ctx2d.save();
    ctx2d.filter = `hue-rotate(${(b.tier - 1) * 55}deg)`;
    ctx2d.drawImage(imgs.boss, b.x - 42, b.y - 30, 84, 60);
    ctx2d.restore();
    const bw = 200, bh = 8, bx = W / 2 - bw / 2, by = 48;
    ctx2d.fillStyle = 'rgba(0,0,0,.55)'; ctx2d.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    ctx2d.fillStyle = '#453D5C'; ctx2d.fillRect(bx, by, bw, bh);
    ctx2d.fillStyle = '#FF6B5E'; ctx2d.fillRect(bx, by, bw * Math.max(0, b.hp) / b.maxHp, bh);
    ctx2d.font = '700 9px "Press Start 2P", monospace';
    ctx2d.textAlign = 'center'; ctx2d.fillStyle = '#FF6B5E';
    ctx2d.fillText('BOSS', W / 2, by - 7);
  }
  // 운석 + 불꽃 꼬리
  for (const m of state.meteors) {
    if (!reduceMotion()) {
      const tail = ctx2d.createLinearGradient(m.x, m.y - m.r - 30, m.x, m.y);
      tail.addColorStop(0, 'rgba(255,107,94,0)'); tail.addColorStop(1, 'rgba(255,140,60,.5)');
      ctx2d.fillStyle = tail;
      ctx2d.fillRect(m.x - m.r * .6, m.y - m.r - 32, m.r * 1.2, m.r + 30);
    }
    ctx2d.save();
    ctx2d.translate(m.x, m.y); ctx2d.rotate(m.rot);
    ctx2d.drawImage(imgs.meteor, -m.r, -m.r, m.r * 2, m.r * 2);
    ctx2d.restore();
  }
  // 로켓 + 불꽃
  if (state.phase !== 'over') {
    const fx = state.px, flick = 10 + Math.sin(state.t / 40) * 4;
    ctx2d.save();
    ctx2d.translate(fx, PY); ctx2d.rotate(state.tilt);
    ctx2d.fillStyle = '#FF8C42';
    ctx2d.beginPath();
    ctx2d.moveTo(-9, PSIZE / 2 - 4); ctx2d.lineTo(9, PSIZE / 2 - 4);
    ctx2d.lineTo(0, PSIZE / 2 + flick); ctx2d.fill();
    ctx2d.fillStyle = '#FFE08A';
    ctx2d.beginPath();
    ctx2d.moveTo(-4, PSIZE / 2 - 4); ctx2d.lineTo(4, PSIZE / 2 - 4);
    ctx2d.lineTo(0, PSIZE / 2 + flick * .55); ctx2d.fill();
    ctx2d.drawImage(imgs.rocket, -PSIZE / 2, -PSIZE / 2, PSIZE, PSIZE);
    // 실드 버블
    if (state.buffs.shield > 0) {
      ctx2d.strokeStyle = 'rgba(92,224,179,.85)';
      ctx2d.lineWidth = 2.5;
      ctx2d.beginPath(); ctx2d.arc(0, 0, PSIZE / 2 + 8 + Math.sin(state.t / 120) * 2, 0, 6.28); ctx2d.stroke();
    }
    ctx2d.restore();
  }
  // 파티클 (+1 텍스트 포함)
  for (const p of state.parts) {
    ctx2d.globalAlpha = Math.min(1, p.life * 2);
    if (p.txt) {
      ctx2d.font = '700 16px "Press Start 2P", monospace';
      ctx2d.fillStyle = p.c;
      ctx2d.textAlign = 'center';
      ctx2d.fillText(p.txt, p.x, p.y);
    } else {
      ctx2d.fillStyle = p.c;
      ctx2d.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
  }
  ctx2d.globalAlpha = 1;
  // 캔버스 안 점수: 생존 시간(중앙)·LV(우상단) — 시선이 캔버스에 머물도록
  if (state.phase === 'playing' || state.phase === 'paused') {
    ctx2d.font = '700 20px "Press Start 2P", monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillStyle = 'rgba(244,239,250,.92)';
    ctx2d.fillText((state.t / 1000).toFixed(1), W / 2, 34);
    ctx2d.font = '700 12px "Press Start 2P", monospace';
    ctx2d.textAlign = 'right';
    ctx2d.fillStyle = 'rgba(92,224,179,.9)';
    ctx2d.fillText('LV' + state.level, W - 12, 26);
    // 활성 버프 표시 (LV 아래)
    let by = 42;
    for (const [k, c, label] of [['double', '#8B7CFF', 'DBL'], ['rapid', '#FFD166', 'RPD'], ['shield', '#5CE0B3', 'SHD']]) {
      if (state.buffs[k] > 0) {
        ctx2d.fillStyle = c;
        ctx2d.fillText(k === 'shield' ? label : `${label} ${state.buffs[k].toFixed(0)}s`, W - 12, by);
        by += 15;
      }
    }
    ctx2d.textAlign = 'left';
  }
}

// ----- 종료 -----
function endGame(cause = '운석') {
  state.phase = 'over';
  bgmStop(); sfx.boom();
  if (!reduceMotion()) $('canvasArea').classList.add('shake');
  setTimeout(() => $('canvasArea').classList.remove('shake'), 400);
  const ms = Math.round(state.t);
  const isBest = ms > stats.best;
  if (isBest) stats.best = ms;
  stats.plays.push({ ms, stars: state.starCount, level: state.level, cause, cfg: `i${CONFIG.baseInterval}f${CONFIG.fallBase}` });
  saveStats(); renderLog(); hud();
  document.querySelector('.overlay-mascot').textContent = '💥';
  overlayTitle.textContent = isBest ? '신기록!' : '추락…';
  overlayMsg.innerHTML = `${(ms / 1000).toFixed(1)}초 생존 · ⭐ ${state.starCount}개 · LV ${state.level} 도달${isBest ? ' <b style="color:var(--gold)">NEW BEST</b>' : ''}<br>Enter 또는 버튼으로 다시 출발.`;
  startBtn.textContent = '다시 출발 (Enter)';
  overlay.hidden = false;
  setStatus(`추락 — ${(ms / 1000).toFixed(1)}초 버팀`);
}

// ----- 일시정지 -----
function pauseGame() {
  if (state.phase !== 'playing') return;
  state.phase = 'paused'; bgmStop();
  document.querySelector('.overlay-mascot').textContent = '⏸️';
  overlayTitle.textContent = '일시정지';
  overlayMsg.innerHTML = 'P 또는 버튼으로 재개 — 시간은 멈춰 있습니다.';
  startBtn.textContent = '재개 (P)';
  overlay.hidden = false;
  setStatus('일시정지 중');
}
function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
  state.last = performance.now();
  overlay.hidden = true;
  bgmStart();
  setStatus('재개! 계속 피하세요.');
}

// ----- 입력 -----
const held = { l: false, r: false };
function nudge(dir) {   // 탭 한 번 = 한 발짝 (짧게 눌러도 반응)
  state.px = Math.max(PSIZE / 2, Math.min(W - PSIZE / 2, state.px + dir * 26));
}
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') { e.preventDefault(); if (!e.repeat && !state.keyL && state.phase === 'playing') nudge(-1); held.l = state.keyL = true; return; }
  if (k === 'arrowright' || k === 'd') { e.preventDefault(); if (!e.repeat && !state.keyR && state.phase === 'playing') nudge(1); held.r = state.keyR = true; return; }
  if (k === 'p' || k === 'escape') { state.phase === 'playing' ? pauseGame() : resumeGame(); return; }
  if (k === 'r' && state.phase !== 'title') { newGame(); return; }
  if (k === 'enter' && state.phase !== 'playing') { state.phase === 'paused' ? resumeGame() : newGame(); }
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') held.l = state.keyL = false;
  if (k === 'arrowright' || k === 'd') held.r = state.keyR = false;
});
// 포인터: 마우스 호버·터치 드래그 모두 목표 위치로
function toGameX(clientX) {
  const r = canvas.getBoundingClientRect();
  return (clientX - r.left) / r.width * W;
}
canvas.addEventListener('pointermove', (e) => {
  if (state.phase !== 'playing') return;
  if (e.pointerType === 'touch' && e.buttons === 0) return;   // 터치는 누른 채 이동만
  state.targetX = toGameX(e.clientX);
});
canvas.addEventListener('pointerdown', (e) => {
  if (state.phase === 'playing') { state.targetX = toGameX(e.clientX); canvas.setPointerCapture(e.pointerId); }
});
canvas.addEventListener('pointerleave', () => { state.targetX = null; });
startBtn.addEventListener('click', () => state.phase === 'paused' ? resumeGame() : newGame());
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('blur', pauseGame);

// ----- HUD·기록 -----
function setStatus(msg) { statusLine.textContent = msg; }
function hud() {
  timeNum.textContent = (state.t / 1000).toFixed(1) + 's';
  starNum.textContent = state.starCount;
  levelNum.textContent = state.level;
  bestNum.textContent = stats.best ? (stats.best / 1000).toFixed(1) + 's' : '—';
  bestLine.textContent = stats.best ? (stats.best / 1000).toFixed(1) + '초' : '—';
  $('canvasArea').classList.toggle('danger', state.phase === 'playing' && state.level >= 4);
}
function renderLog() {
  const rows = stats.plays.slice(-10).reverse();
  logBody.innerHTML = rows.length
    ? rows.map((p, i) => `<tr><td>${stats.plays.length - i}</td>` +
        `<td class="${p.ms >= stats.best && stats.best ? 'win' : ''}">${(p.ms / 1000).toFixed(1)}s</td>` +
        `<td>${p.stars}</td><td>${p.level}</td><td>${p.cause ?? '운석'}</td></tr>`).join('')
    : '<tr><td colspan="5" class="log-empty">아직 기록이 없습니다</td></tr>';
}
$('copyLog').addEventListener('click', async () => {
  const lines = stats.plays.map((p, i) =>
    `${i + 1},${(p.ms / 1000).toFixed(1)}s,${p.stars},${p.level},${p.cause ?? '운석'},${p.cfg}`);
  try {
    await navigator.clipboard.writeText('회차,생존,별,레벨,원인,설정\n' + lines.join('\n'));
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
  if (drone) drone.g.gain.value = audioEnabled ? .012 : 0;
  if (!audioEnabled) bgmStop(); else if (state.phase === 'playing') bgmStart();
  localStorage.setItem('meteor-sound', audioEnabled ? '1' : '0');
}
function applyMotion(on) {
  document.documentElement.classList.toggle('reduce-motion', on);
  motionSwitch.setAttribute('aria-checked', String(on));
  localStorage.setItem('meteor-motion', on ? '1' : '0');
}
soundSwitch.addEventListener('click', () => { audioEnabled = !audioEnabled; applySound(); });
motionSwitch.addEventListener('click', () => applyMotion(!reduceMotion()));
applyMotion(localStorage.getItem('meteor-motion') !== null
  ? localStorage.getItem('meteor-motion') === '1'
  : matchMedia('(prefers-reduced-motion: reduce)').matches);
applySound();
hud(); renderLog(); draw();
