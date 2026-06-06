/* ============================================================
   NexHub — app.js  (v2 — with Favorites)
   ============================================================ */

let allSites      = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = loadFavorites();

const PAGE_SIZE    = 12;
let   visibleCount = PAGE_SIZE;

// ---- Favorites persistence ----
function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem('nexhub_favorites') || '[]'));
  } catch { return new Set(); }
}

function saveFavorites() {
  localStorage.setItem('nexhub_favorites', JSON.stringify([...favorites]));
}

function toggleFavorite(url, e) {
  e.preventDefault();
  e.stopPropagation();
  if (favorites.has(url)) {
    favorites.delete(url);
  } else {
    favorites.add(url);
  }
  saveFavorites();
  render();
}

// ---- Boot ----
async function init() {
  try {
    const res  = await fetch('sites.json');
    const data = await res.json();
    allSites      = data.sites;
    allCategories = data.categories;
    buildCategoryNav();
    render();
    setupSearch();
    setupScrollArrows();
  } catch (err) {
    console.error('Failed to load sites.json:', err);
    document.getElementById('cardsGrid').innerHTML =
      '<p style="color:#ff4b8a;font-size:.85rem">⚠ Could not load sites.json</p>';
  }
}

// ---- Category nav ----
function buildCategoryNav() {
  const nav = document.getElementById('catNavInner');
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

  // Add Favorites button
  const favBtn = document.createElement('button');
  favBtn.className   = 'cat-btn cat-btn-fav';
  favBtn.dataset.cat = '__favorites__';
  favBtn.innerHTML   = '★ Favorites';
  favBtn.addEventListener('click', () => {
    activeCategory = '__favorites__';
    searchQuery    = '';
    visibleCount   = PAGE_SIZE;
    document.getElementById('searchInput').value = '';
    setActiveBtn(favBtn);
    render();
  });
  nav.appendChild(favBtn);
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
    searchQuery    = input.value.toLowerCase().trim();
    visibleCount   = PAGE_SIZE;
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
  if (activeCategory === '__favorites__') {
    return allSites.filter(site => favorites.has(site.url));
  }
  return allSites.filter(site => {
    const matchCat = activeCategory === 'all' || site.category === activeCategory;
    if (!searchQuery) return matchCat;
    const haystack = `${site.name} ${site.description} ${site.category} ${(site.tags || []).join(' ')}`.toLowerCase();
    return matchCat && haystack.includes(searchQuery);
  });
}

// ---- Sort: favorites pinned on top ----
function getSorted(sites) {
  if (activeCategory === '__favorites__') return sites;
  const favs = sites.filter(s => favorites.has(s.url));
  const rest  = sites.filter(s => !favorites.has(s.url));
  return [...favs, ...rest];
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
  const grid     = document.getElementById('cardsGrid');
  const empty    = document.getElementById('emptyState');
  const label    = document.getElementById('sectionLabel');
  const countEl  = document.getElementById('siteCount');
  const filtered = getFiltered();
  const sorted   = getSorted(filtered);

  // Section label
  if (activeCategory === '__favorites__') {
    label.textContent = `★ Favorites`;
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
    grid.innerHTML = '';
    empty.style.display = 'block';
    if (activeCategory === '__favorites__') {
      document.getElementById('emptyQuery').textContent = 'your favorites yet — click ★ on any card!';
    } else {
      document.getElementById('emptyQuery').textContent = searchQuery || activeCategory;
    }
    removePagination();
    removeFavsSection();
    return;
  }

  empty.style.display = 'none';

  // Split: pinned favorites section + rest (only on "All" view)
  const showPinnedSection = activeCategory === 'all' && !searchQuery && favorites.size > 0;

  if (showPinnedSection) {
    const pinnedSites = allSites.filter(s => favorites.has(s.url));
    const restSites   = sorted.filter(s => !favorites.has(s.url)).slice(0, visibleCount);

    let html = '';

    // Pinned favorites banner
    html += `<div class="favorites-section-header">
      <span class="fav-section-icon">★</span>
      <span>Pinned Favorites</span>
      <span class="fav-section-count">${pinnedSites.length}</span>
    </div>`;
    html += `<div class="cards-grid favorites-row" id="favsRow">`;
    html += pinnedSites.map(s => renderCard(s, true)).join('');
    html += `</div>`;

    html += `<div class="section-divider"></div>`;
    html += `<div class="rest-grid" id="restGrid">`;
    html += restSites.map(s => renderCard(s, false)).join('');
    html += `</div>`;

    grid.innerHTML = html;

    const total = allSites.filter(s => !favorites.has(s.url)).length;
    if (visibleCount < total) {
      renderLoadMore(total);
    } else {
      removePagination();
    }
  } else {
    const visible = sorted.slice(0, visibleCount);
    grid.innerHTML = visible.map(s => renderCard(s, false)).join('');

    if (visibleCount < sorted.length) {
      renderLoadMore(sorted.length);
    } else {
      removePagination();
    }
  }
}

function removeFavsSection() {
  const el = document.getElementById('favsSectionWrap');
  if (el) el.remove();
}

function renderCard(site, pinned = false) {
  const color     = site.color || '#7c5cfc';
  const isFav     = favorites.has(site.url);
  const tagColors = site.tag_colors || {};
  const tags      = (site.tags || []).map(t => {
    const bg = tagColors[t] || '#6b7280';
    return `<span class="tag" style="--tag-bg:${escHtml(bg)}">${escHtml(t)}</span>`;
  }).join('');

  const icon = faviconUrl(site.url);
  const iconHtml = icon
    ? `<img class="card-favicon" src="${escHtml(icon)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';

  const favClass = isFav ? 'fav-btn fav-btn--active' : 'fav-btn';
  const favTitle = isFav ? 'Remove from favorites' : 'Add to favorites';
  const pinnedBadge = pinned ? '' : (isFav ? '<span class="pinned-badge">★ Pinned</span>' : '');

  return `
    <div class="card-wrap${isFav && !pinned ? ' card-wrap--fav' : ''}">
      <a class="card" href="${escHtml(site.url)}" target="_blank" rel="noopener" style="--card-color:${color}">
        <div class="card-top">
          ${iconHtml}
          <span class="card-name">${escHtml(site.name)}</span>
          ${pinnedBadge}
          <span class="card-arrow">↗</span>
        </div>
        <p class="card-desc">${escHtml(site.description)}</p>
        <div class="card-footer">${tags}</div>
      </a>
      <button class="${favClass}" title="${favTitle}" onclick="toggleFavorite('${escHtml(site.url)}', event)">
        ${isFav ? '★' : '☆'}
      </button>
    </div>`;
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
