/* ============================================================
   NexHub — app.js
   ============================================================ */

let allSites      = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = new Set(JSON.parse(localStorage.getItem('nexo_favorites') || '[]'));
let clickCounts    = {};

const PAGE_SIZE    = 12;
let   visibleCount = PAGE_SIZE;

// ---- Boot ----
async function init() {
  try {
    const [sitesRes, statsRes] = await Promise.all([
      fetch('sites.json'),
      fetch('/api/site-stats').catch(() => null)
    ]);

    const data = await sitesRes.json();
    allSites      = data.sites;
    allCategories = data.categories;

    if (statsRes && statsRes.ok) {
      const stats = await statsRes.json();
      stats.forEach(s => { clickCounts[s.site_url] = s.click_count; });
    }

    buildCategoryNav();
    updateFavCount();
    render();
    setupSearch();
    setupScrollArrows();
    setupGridEvents();
  } catch (err) {
    console.error('Failed to load sites.json:', err);
    document.getElementById('cardsGrid').innerHTML =
      '<p style="color:#ff4b8a;font-size:.85rem">⚠ Could not load sites.json</p>';
  }
}

// ---- Favorites ----
function saveFavorites() {
  localStorage.setItem('nexo_favorites', JSON.stringify([...favorites]));
}

function toggleFav(url) {
  if (favorites.has(url)) {
    favorites.delete(url);
  } else {
    favorites.add(url);
  }
  saveFavorites();
  updateFavCount();
  render();
}

function updateFavCount() {
  const badge = document.getElementById('favCount');
  if (badge) {
    badge.textContent = favorites.size;
    badge.style.display = favorites.size > 0 ? 'inline-flex' : 'none';
  }
}

// ---- Click tracking ----
async function trackClick(url) {
  clickCounts[url] = (clickCounts[url] || 0) + 1;
  document.querySelectorAll(`.visit-count[data-url="${CSS.escape(url)}"]`).forEach(el => {
    el.textContent = `↗ ${clickCounts[url]}`;
    el.classList.remove('hidden');
  });

  try {
    const res = await fetch('/api/site-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      const data = await res.json();
      clickCounts[url] = data.click_count;
      document.querySelectorAll(`.visit-count[data-url="${CSS.escape(url)}"]`).forEach(el => {
        el.textContent = `↗ ${data.click_count}`;
      });
    }
  } catch { /* silently fail */ }
}

// ---- Grid event delegation ----
function setupGridEvents() {
  document.getElementById('main').addEventListener('click', e => {
    const favBtn = e.target.closest('.card-fav-btn');
    if (favBtn) {
      e.preventDefault();
      toggleFav(favBtn.dataset.url);
      return;
    }

    const card = e.target.closest('a.card');
    if (card) {
      trackClick(card.getAttribute('href'));
    }
  });
}

// ---- Category nav ----
function buildCategoryNav() {
  const nav = document.getElementById('catNavInner');

  const favBtn = document.createElement('button');
  favBtn.className  = 'cat-btn fav-cat-btn';
  favBtn.dataset.cat = 'favorites';
  favBtn.innerHTML  = `★ Favourites <span id="favCount" class="fav-count-badge" style="display:none">0</span>`;
  favBtn.addEventListener('click', () => {
    activeCategory = 'favorites';
    searchQuery    = '';
    visibleCount   = PAGE_SIZE;
    document.getElementById('searchInput').value = '';
    setActiveBtn(favBtn);
    render();
  });
  nav.appendChild(favBtn);

  allCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className    = 'cat-btn';
    btn.dataset.cat  = cat.id;
    btn.textContent  = `${cat.icon} ${cat.label}`;
    btn.addEventListener('click', () => {
      activeCategory = cat.id;
      searchQuery    = '';
      visibleCount   = PAGE_SIZE;
      document.getElementById('searchInput').value = '';
      setActiveBtn(btn);
      render();
    });
    nav.appendChild(btn);
  });
}

function setActiveBtn(active) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  active.classList.add('active');
}

// ---- Scroll arrows ----
function setupScrollArrows() {
  const inner = document.getElementById('catNavInner');
  const nav   = document.getElementById('catNav');
  const btnL  = document.getElementById('scrollLeft');
  const btnR  = document.getElementById('scrollRight');
  const STEP  = 220;

  function updateArrows() {
    const atStart = inner.scrollLeft <= 2;
    const atEnd   = inner.scrollLeft + inner.clientWidth >= inner.scrollWidth - 2;
    btnL.disabled = atStart;
    btnR.disabled = atEnd;
    nav.classList.toggle('at-start', atStart);
    nav.classList.toggle('at-end',   atEnd);
  }

  btnL.addEventListener('click', () => inner.scrollBy({ left: -STEP, behavior: 'smooth' }));
  btnR.addEventListener('click', () => inner.scrollBy({ left:  STEP, behavior: 'smooth' }));
  inner.addEventListener('scroll', updateArrows, { passive: true });
  updateArrows();
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', () => {
    searchQuery  = input.value.toLowerCase().trim();
    visibleCount = PAGE_SIZE;
    if (searchQuery) {
      activeCategory = 'all';
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');
    }
    render();
  });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ---- "All" button ----
document.querySelector('.cat-btn[data-cat="all"]').addEventListener('click', function () {
  activeCategory = 'all';
  searchQuery    = '';
  visibleCount   = PAGE_SIZE;
  document.getElementById('searchInput').value = '';
  setActiveBtn(this);
  render();
});

// ---- Filter logic ----
function getFiltered() {
  if (activeCategory === 'favorites') {
    return allSites.filter(site => {
      if (!favorites.has(site.url)) return false;
      if (!searchQuery) return true;
      const haystack = `${site.name} ${site.description} ${site.category} ${(site.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  return allSites.filter(site => {
    const matchCat = activeCategory === 'all' || site.category === activeCategory;
    if (!searchQuery) return matchCat;
    const haystack = `${site.name} ${site.description} ${site.category} ${(site.tags || []).join(' ')}`.toLowerCase();
    return matchCat && haystack.includes(searchQuery);
  });
}

// ---- Favicon helper ----
function faviconUrl(siteUrl) {
  try {
    const { hostname } = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

// ---- Render ----
function render() {
  const pinnedSection = document.getElementById('pinnedSection');
  const pinnedGrid    = document.getElementById('pinnedGrid');
  const grid          = document.getElementById('cardsGrid');
  const empty         = document.getElementById('emptyState');
  const label         = document.getElementById('sectionLabel');
  const countEl       = document.getElementById('siteCount');
  const filtered      = getFiltered();

  // Section label
  if (activeCategory === 'favorites') {
    label.textContent = '★ Favourites';
  } else if (searchQuery) {
    label.textContent = `Results for "${searchQuery}"`;
  } else if (activeCategory === 'all') {
    label.textContent = 'All Sites';
  } else {
    const cat = allCategories.find(c => c.id === activeCategory);
    label.textContent = cat ? `${cat.icon} ${cat.label}` : activeCategory;
  }

  countEl.textContent = `${filtered.length} site${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    grid.innerHTML        = '';
    pinnedGrid.innerHTML  = '';
    pinnedSection.style.display = 'none';
    empty.style.display   = 'block';
    document.getElementById('emptyQuery').textContent = searchQuery || activeCategory;
    removePagination();
    return;
  }

  empty.style.display = 'none';

  if (activeCategory === 'favorites') {
    pinnedSection.style.display = 'none';
    pinnedGrid.innerHTML = '';
    const visible = filtered.slice(0, visibleCount);
    grid.innerHTML = visible.map(renderCard).join('');

    if (visibleCount < filtered.length) {
      renderLoadMore(filtered.length);
    } else {
      removePagination();
    }
  } else {
    const pinned = filtered.filter(s => favorites.has(s.url));
    const rest   = filtered.filter(s => !favorites.has(s.url));

    if (pinned.length > 0) {
      pinnedSection.style.display = 'block';
      pinnedGrid.innerHTML = pinned.map(renderCard).join('');
    } else {
      pinnedSection.style.display = 'none';
      pinnedGrid.innerHTML = '';
    }

    const visible = rest.slice(0, visibleCount);
    grid.innerHTML = visible.map(renderCard).join('');

    if (visibleCount < rest.length) {
      renderLoadMore(rest.length);
    } else {
      removePagination();
    }
  }
}

function renderCard(site) {
  const color    = site.color || '#7c5cfc';
  const tags     = (site.tags || []).map(t =>
    `<span class="tag tag-${escHtml(t)}">${escHtml(t)}</span>`
  ).join('');
  const icon     = faviconUrl(site.url);
  const iconHtml = icon
    ? `<img class="card-favicon" src="${escHtml(icon)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';
  const isFav  = favorites.has(site.url);
  const count  = clickCounts[site.url] || 0;

  return `
    <a class="card" href="${escHtml(site.url)}" target="_blank" rel="noopener" style="--card-color:${color}">
      <div class="card-top">
        ${iconHtml}
        <span class="card-name">${escHtml(site.name)}</span>
        <button class="card-fav-btn${isFav ? ' active' : ''}"
                data-url="${escHtml(site.url)}"
                title="${isFav ? 'Remove from favourites' : 'Add to favourites'}"
                aria-label="${isFav ? 'Remove from favourites' : 'Add to favourites'}">★</button>
      </div>
      <p class="card-desc">${escHtml(site.description)}</p>
      <div class="card-footer">
        ${tags}
        <span class="visit-count${count > 0 ? '' : ' hidden'}" data-url="${escHtml(site.url)}">↗ ${count || 0}</span>
      </div>
    </a>`;
}

// ---- Load More ----
function renderLoadMore(total) {
  removePagination();
  const remaining = total - visibleCount;
  const wrap = document.createElement('div');
  wrap.id = 'loadMoreWrap';
  wrap.className = 'load-more-wrap';
  wrap.innerHTML = `
    <button class="load-more-btn" id="loadMoreBtn">
      Load more <span class="load-more-count">${remaining} remaining</span>
    </button>`;
  document.getElementById('main').appendChild(wrap);
  document.getElementById('loadMoreBtn').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    render();
    const cards = document.querySelectorAll('#cardsGrid .card');
    if (cards.length > visibleCount - PAGE_SIZE) {
      cards[visibleCount - PAGE_SIZE]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function removePagination() {
  const existing = document.getElementById('loadMoreWrap');
  if (existing) existing.remove();
}

// ---- Escape HTML ----
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
