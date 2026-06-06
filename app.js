/* ============================================================
   NexHub — app.js  (v3 — fixed favorites layout)
   ============================================================ */

let allSites      = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = loadFavorites();

const PAGE_SIZE    = 24;
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

  // Favorites button — FIRST (after "All")
  const favBtn = document.createElement('button');
  favBtn.className   = 'cat-btn cat-btn-fav';
  favBtn.dataset.cat = '__favorites__';
  favBtn.textContent = '★ Favorites';
  favBtn.addEventListener('click', () => {
    activeCategory = '__favorites__';
    searchQuery    = '';
    visibleCount   = PAGE_SIZE;
    document.getElementById('searchInput').value = '';
    setActiveBtn(favBtn);
    render();
  });
  const allBtn = nav.querySelector('[data-cat="all"]');
  allBtn.insertAdjacentElement('afterend', favBtn);

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
  const main     = document.getElementById('main');
  const label    = document.getElementById('sectionLabel');
  const countEl  = document.getElementById('siteCount');
  const filtered = getFiltered();

  // Section label
  if (activeCategory === '__favorites__') {
    label.textContent = '★ Favorites';
  } else if (searchQuery) {
    label.textContent = `Results for "${searchQuery}"`;
  } else if (activeCategory === 'all') {
    label.textContent = 'All Sites';
  } else {
    const cat = allCategories.find(c => c.id === activeCategory);
    label.textContent = cat ? `${cat.icon} ${cat.label}` : activeCategory;
  }

  countEl.textContent = `${filtered.length} site${filtered.length !== 1 ? 's' : ''}`;

  // Clear everything below the label inside main
  const grid  = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');

  // Remove any previously injected pinned header or load-more
  document.getElementById('pinnedHeader')?.remove();
  document.getElementById('dividerRow')?.remove();
  document.getElementById('loadMoreWrap')?.remove();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    empty.style.display = 'block';
    document.getElementById('emptyQuery').textContent =
      activeCategory === '__favorites__'
        ? 'your favorites yet — click ★ on any card!'
        : (searchQuery || activeCategory);
    return;
  }

  empty.style.display = 'none';
  grid.style.display  = '';

  // On "All" view: show pinned favorites at top as a separate labeled row
  const showPinned = activeCategory === 'all' && !searchQuery && favorites.size > 0;

  if (showPinned) {
    const pinned = allSites.filter(s => favorites.has(s.url));
    const rest   = filtered.filter(s => !favorites.has(s.url));

    // Inject pinned header BEFORE cardsGrid
    const hdr = document.createElement('div');
    hdr.id = 'pinnedHeader';
    hdr.className = 'pinned-header';
    hdr.innerHTML = `<span class="pinned-header-icon">★</span> Pinned Favorites <span class="pinned-header-count">${pinned.length}</span>`;
    grid.insertAdjacentElement('beforebegin', hdr);

    // Render pinned + divider + rest ALL as flat card-wraps inside the ONE grid
    const restSlice = rest.slice(0, visibleCount);
    grid.innerHTML =
      pinned.map(s => renderCard(s)).join('') +
      `<div id="dividerRow" class="grid-divider-cell"><div class="grid-divider"><span>All Sites</span></div></div>` +
      restSlice.map(s => renderCard(s)).join('');

    if (visibleCount < rest.length) {
      renderLoadMore(rest.length, rest.length - visibleCount);
    }
  } else {
    const slice = filtered.slice(0, visibleCount);
    grid.innerHTML = slice.map(s => renderCard(s)).join('');

    if (visibleCount < filtered.length) {
      renderLoadMore(filtered.length, filtered.length - visibleCount);
    }
  }
}

function renderCard(site) {
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
  const favTitle = isFav ? 'Unfavorite' : 'Favorite';
  const favLabel = isFav ? '★ Saved' : '☆ Save';

  return `<div class="card-wrap${isFav ? ' card-wrap--fav' : ''}">
    <a class="card" href="${escHtml(site.url)}" target="_blank" rel="noopener" style="--card-color:${color}">
      <div class="card-top">
        ${iconHtml}
        <span class="card-name">${escHtml(site.name)}</span>
        <span class="card-arrow">↗</span>
      </div>
      <p class="card-desc">${escHtml(site.description)}</p>
      <div class="card-footer">${tags}</div>
    </a>
    <button class="${favClass}" title="${favTitle}" onclick="toggleFavorite('${escHtml(site.url)}', event)">${escHtml(favLabel)}</button>
  </div>`;
}

// ---- Load More ----
function renderLoadMore(total, remaining) {
  document.getElementById('loadMoreWrap')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'loadMoreWrap';
  wrap.className = 'load-more-wrap';
  wrap.innerHTML = `<button class="load-more-btn" id="loadMoreBtn">
    Load more <span class="load-more-count">${remaining} remaining</span>
  </button>`;
  document.getElementById('main').appendChild(wrap);
  document.getElementById('loadMoreBtn').addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    render();
  });
}

// ---- Escape HTML ----
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

init();
