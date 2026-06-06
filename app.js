/* ============================================================
   NexHub — app.js  (v4 — per-category JSON files)
   ============================================================ */

let allSites      = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = loadFavorites();

const PAGE_SIZE    = 24;
let   visibleCount = PAGE_SIZE;

// Categories metadata — icons/labels defined here so we don't need
// to keep a separate categories array in every JSON file.
const CATEGORIES_META = [
  { id: 'ai',           label: 'AI',           icon: '🤖' },
  { id: 'anime',        label: 'Anime',         icon: '🧸' },
  { id: 'apis',         label: 'APIs',           icon: '🔌' },
  { id: 'business',     label: 'Business',       icon: '🏢' },
  { id: 'crypto',       label: 'Crypto',         icon: '💰' },
  { id: 'databases',    label: 'Databases',      icon: '🗄️' },
  { id: 'design',       label: 'Design',         icon: '🎨' },
  { id: 'dev-tools',    label: 'Dev Tools',      icon: '🛠️' },
  { id: 'downloads',    label: 'Downloads',      icon: '⬇️' },
  { id: 'finance',      label: 'Finance',        icon: '💳' },
  { id: 'gaming',       label: 'Gaming',         icon: '🎮' },
  { id: 'google',       label: 'Google',         icon: '🔵' },
  { id: 'hosting',      label: 'Hosting',        icon: '☁️' },
  { id: 'jobs',         label: 'Jobs',           icon: '💼' },
  { id: 'learning',     label: 'Learning',       icon: '📚' },
  { id: 'minecraft',    label: 'Minecraft',      icon: '⛏️' },
  { id: 'movies',       label: 'Movies',         icon: '🎬' },
  { id: 'music',        label: 'Music',          icon: '🎵' },
  { id: 'my-sites',     label: 'My Sites',       icon: '🌐' },
  { id: 'news',         label: 'News',           icon: '📰' },
  { id: 'os',           label: 'OS Files',       icon: '💻' },
  { id: 'productivity', label: 'Productivity',   icon: '📋' },
  { id: 'search',       label: 'Search',         icon: '🔍' },
  { id: 'security',     label: 'Security',       icon: '🔒' },
  { id: 'shopping',     label: 'Shopping',       icon: '🛒' },
  { id: 'social',       label: 'Social',         icon: '📱' },
  { id: 'storage',      label: 'Storage',        icon: '📁' },
  { id: 'streaming',    label: 'Streaming',      icon: '📺' },
  { id: 'tools',        label: 'Tools',          icon: '⚙️' },
];

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
    // Discover which category JSON files actually exist by trying to fetch each one.
    // We filter CATEGORIES_META to only those with a matching json/ file.
    const fetches = CATEGORIES_META.map(cat =>
      fetch(`json/${cat.id}.json`)
        .then(r => r.ok ? r.json().then(sites => ({ cat, sites })) : null)
        .catch(() => null)
    );

    const results = await Promise.all(fetches);

    allCategories = [];
    allSites = [];

    for (const result of results) {
      if (!result) continue;
      allCategories.push(result.cat);
      allSites.push(...result.sites);
    }

    buildCategoryNav();
    render();
    setupSearch();
    setupScrollArrows();
  } catch (err) {
    console.error('Failed to load category JSON files:', err);
    document.getElementById('cardsGrid').innerHTML =
      '<p style="color:#ff4b8a;font-size:.85rem">⚠ Could not load site data from json/ folder</p>';
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

  const grid  = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');

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

  const showPinned = activeCategory === 'all' && !searchQuery && favorites.size > 0;

  if (showPinned) {
    const pinned = allSites.filter(s => favorites.has(s.url));
    const rest   = filtered.filter(s => !favorites.has(s.url));

    const hdr = document.createElement('div');
    hdr.id = 'pinnedHeader';
    hdr.className = 'pinned-header';
    hdr.innerHTML = `<span class="pinned-header-icon">★</span> Pinned Favorites <span class="pinned-header-count">${pinned.length}</span>`;
    grid.insertAdjacentElement('beforebegin', hdr);

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
