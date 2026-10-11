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
  return { beep, wireSwitches, autoPause, load, save, status, openModal, closeModals, wireModals, trackPlay };
})();
