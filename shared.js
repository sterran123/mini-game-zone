/* ===== MINI GAME ZONE — 게임 공통 헬퍼 (신규 게임용) ===== */
window.MGZ = (() => {
  'use strict';
  let ac = null;
  const soundEnabled = () => localStorage.getItem('mgz-sound') !== '0';
  function actx() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    return ac;
  }
  function beep(freq, dur = .07, type = 'square', vol = .07, slideTo = null, delay = 0) {
    if (!soundEnabled()) return;
    try {
      const c = actx(), t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.0008, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + .02);
    } catch { /* 오디오 불가 환경은 무시 */ }
  }
  function wireSwitches() {
    const s = document.getElementById('soundSwitch');
    const m = document.getElementById('motionSwitch');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('mgz-motion') === '1') {
      document.documentElement.classList.add('reduce-motion');
    }
    if (s) {
      s.setAttribute('aria-checked', String(soundEnabled()));
      s.addEventListener('click', () => {
        const on = !soundEnabled();
        localStorage.setItem('mgz-sound', on ? '1' : '0');
        s.setAttribute('aria-checked', String(on));
        if (on) beep(660, .05);
      });
    }
    if (m) {
      m.setAttribute('aria-checked', String(document.documentElement.classList.contains('reduce-motion')));
      m.addEventListener('click', () => {
        const on = !document.documentElement.classList.contains('reduce-motion');
        document.documentElement.classList.toggle('reduce-motion', on);
        localStorage.setItem('mgz-motion', on ? '1' : '0');
        m.setAttribute('aria-checked', String(on));
      });
    }
  }
  function autoPause(fn) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) fn(); });
    window.addEventListener('blur', fn);
  }
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
    catch { return fallback; }
  }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function trackPlay(gameId) {
    try {
      const plays = load('mgz-plays', {});
      const entry = plays[gameId] || { n: 0, last: null };
      entry.n++;
      entry.last = new Date().toISOString().slice(0, 10);
      plays[gameId] = entry;
      save('mgz-plays', plays);
    } catch { /* 저장 불가 환경은 무시 */ }
  }
  function status(msg) { const el = document.getElementById('statusLine'); if (el) el.textContent = msg; }
  // ----- 순위표 공통: 메달·이스케이프·닉네임 입력 -----
  const MEDALS = ['🥇', '🥈', '🥉'];
  function medal(i) { return MEDALS[i] ?? i + 1; }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // 기록이 상위 10위 안이면 닉네임 입력 행을 host에 붙인다.
  // stats는 이미 좋은 순으로 정렬된 배열, rec는 방금 넣은 기록 객체.
  // onSaved()에서 게임이 localStorage 저장 + 표 다시 그리기를 한다.
  function offerName(host, stats, rec, onSaved) {
    host.querySelector('.name-entry')?.remove();
    const rank = stats.indexOf(rec);
    if (rank < 0 || rank >= 10) return;
    const box = document.createElement('div');
    box.className = 'name-entry';
    box.innerHTML =
      `<p class="name-hint">${rank + 1}위 진입! 이름을 남기세요</p>` +
      '<div class="name-row">' +
      `<input class="name-input" maxlength="8" placeholder="이름" autocomplete="off" value="${esc(localStorage.getItem('mgz-name') || '')}">` +
      '<button class="btn-ghost" type="button">등록</button></div>';
    const input = box.querySelector('input');
    const save = () => {
      rec.name = input.value.trim().slice(0, 8) || '익명';
      try { localStorage.setItem('mgz-name', rec.name); } catch { /* 저장 불가 환경은 무시 */ }
      box.remove();
      onSaved();
      status(`${rec.name} — ${rank + 1}위에 기록됨`);
    };
    box.querySelector('button').addEventListener('click', save);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') save(); });
    host.insertBefore(box, host.querySelector('.overlay-btns'));
  }
  // 모바일용 일시정지 버튼 — 키보드(P)가 없는 환경에서도 누를 수 있게 화면에 둔다.
  // pause/resume/isPaused/isActive는 게임이 넘기고, 250ms마다 상태를 맞춰 표시를 동기화한다.
  function wirePause({ pause, resume, isPaused, isActive }) {
    const btn = document.getElementById('pauseBtn');
    if (!btn) return;
    const sync = () => {
      const playing = isActive(), stopped = isPaused();
      btn.hidden = !playing && !stopped;
      btn.textContent = stopped ? '▶ 재개' : '⏸ 일시정지';
      btn.setAttribute('aria-pressed', String(stopped));
    };
    btn.addEventListener('click', () => { (isPaused() ? resume : pause)(); sync(); });
    setInterval(sync, 250);
    sync();
  }
  function openModal(id) {
    document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
    const m = document.getElementById(id);
    if (m) m.hidden = false;
  }
  function closeModals() { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); }
  function wireModals() {
    document.querySelectorAll('.modal [data-close]').forEach(b => b.addEventListener('click', closeModals));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });
  }
  return { beep, wireSwitches, autoPause, load, save, status, openModal, closeModals, wireModals, trackPlay, medal, esc, offerName, wirePause };
})();
