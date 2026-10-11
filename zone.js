'use strict';
/* ===== MINI GAME ZONE — 허브: 검색 · 장르 태그 · 자주 플레이한 게임 ===== */
(() => {
  const PLAYS_KEY = 'mgz-plays';
  const list = document.getElementById('gameList');
  const cards = [...list.querySelectorAll('.game-card')].map(el => ({
    el,
    id: el.dataset.id,
    name: el.dataset.name || el.querySelector('h2').textContent,
    genres: (el.dataset.genres || '').split(/\s+/).filter(Boolean),
    desc: el.querySelector('.game-desc')?.textContent || '',
    external: el.dataset.external === '1'
  }));
  const searchInput = document.getElementById('gameSearch');
  const tagRow = document.getElementById('tagRow');
  const noResult = document.getElementById('noResult');
  const popTitle = document.getElementById('popTitle');
  const popList = document.getElementById('popList');

  let plays = {};
  try { plays = JSON.parse(localStorage.getItem(PLAYS_KEY)) || {}; } catch { plays = {}; }
  const savePlays = () => localStorage.setItem(PLAYS_KEY, JSON.stringify(plays));

  let activeTag = 'all';
  let query = '';

  function applyFilter() {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const c of cards) {
      const tagOk = activeTag === 'all' || c.genres.includes(activeTag);
      const textOk = !q || c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.genres.join(' ').includes(q);
      const ok = tagOk && textOk;
      c.el.hidden = !ok;
      if (ok) shown++;
    }
    noResult.hidden = shown > 0;
  }

  searchInput.addEventListener('input', () => { query = searchInput.value; applyFilter(); });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { searchInput.value = ''; query = ''; applyFilter(); }
  });

  tagRow.addEventListener('click', e => {
    const btn = e.target.closest('.tag');
    if (!btn) return;
    activeTag = btn.dataset.tag;
    tagRow.querySelectorAll('.tag').forEach(t => t.classList.toggle('on', t === btn));
    applyFilter();
  });

  list.addEventListener('click', e => {
    const card = e.target.closest('.game-card');
    if (!card || card.classList.contains('locked') || card.dataset.external !== '1') return;
    const id = card.dataset.id;
    const entry = plays[id] || { n: 0, last: null };
    entry.n++; entry.last = new Date().toISOString().slice(0, 10);
    plays[id] = entry;
    savePlays();
  });

  function chipHtml(c) {
    const ext = c.external ? ' target="_blank" rel="noopener"' : '';
    const n = plays[c.id]?.n > 0 ? `<span class="pop-n">${plays[c.id].n}회</span>` : '';
    return `<a class="pop-chip" href="${c.el.getAttribute('href')}"${ext}>${c.name}${n}</a>`;
  }

  function renderPopular() {
    const played = cards.filter(c => plays[c.id]?.n > 0).sort((a, b) => plays[b.id].n - plays[a.id].n).slice(0, 4);
    if (played.length) {
      popTitle.textContent = '🔥 자주 플레이한 게임';
      popList.innerHTML = played.map(chipHtml).join('');
    } else {
      popTitle.textContent = '⭐ 추천 게임';
      popList.innerHTML = cards.filter(c => c.el.getAttribute('href')).slice(0, 3).map(chipHtml).join('');
    }
    popList.addEventListener('click', e => {
      const chip = e.target.closest('.pop-chip');
      if (!chip) return;
      const card = cards.find(c => c.el.getAttribute('href') === chip.getAttribute('href'));
      if (!card || !card.external) return;
      const entry = plays[card.id] || { n: 0, last: null };
      entry.n++; entry.last = new Date().toISOString().slice(0, 10);
      plays[card.id] = entry;
      savePlays();
    });
  }

  renderPopular();
})();
