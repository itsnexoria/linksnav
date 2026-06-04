/* ============================================================
   NexHub — app.js
   Loads sites.json, renders cards, handles search & filtering.
   ============================================================ */

let allSites = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery = '';

// ---- Boot ----
async function init() {
  try {
    const res = await fetch('sites.json');
    const data = await res.json();
    allSites = data.sites;
    allCategories = data.categories;
    buildCategoryNav();
    render();
    setupSearch();
  } catch (err) {
    console.error('Failed to load sites.json:', err);
    document.getElementById('cardsGrid').innerHTML =
      '<p style="color:#ff4b8a;font-size:.85rem">⚠ Could not load sites.json</p>';
  }
}

// ---- Category nav ----
function buildCategoryNav() {
  const nav = document.querySelector('.cat-nav-inner');
  allCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat.id;
    btn.textContent = `${cat.icon} ${cat.label}`;
    btn.addEventListener('click', () => {
      activeCategory = cat.id;
      searchQuery = '';
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

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', () => {
    searchQuery = input.value.toLowerCase().trim();
    if (searchQuery) {
      activeCategory = 'all';
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.cat-btn[data-cat="all"]').classList.add('active');
    }
    render();
  });

  // Ctrl+K shortcut
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

// ---- Filter logic ----
function getFiltered() {
  return allSites.filter(site => {
    const matchCat = activeCategory === 'all' || site.category === activeCategory;
    if (!searchQuery) return matchCat;
    const haystack = `${site.name} ${site.description} ${site.category} ${site.tags.join(' ')}`.toLowerCase();
    return matchCat && haystack.includes(searchQuery);
  });
}

// ---- Render ----
function render() {
  const grid = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');
  const label = document.getElementById('sectionLabel');
  const countEl = document.getElementById('siteCount');

  const filtered = getFiltered();

  // Update label
  if (searchQuery) {
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
    document.getElementById('emptyQuery').textContent = searchQuery || activeCategory;
    return;
  }

  empty.style.display = 'none';

  // Rebuild cards (trigger re-animation by replacing innerHTML)
  grid.innerHTML = filtered.map((site, i) => renderCard(site, i)).join('');
}

function renderCard(site, index) {
  const color = site.color || '#7c5cfc';
  const tags = site.tags.map(t => `<span class="tag tag-${t}">${t}</span>`).join('');

  return `
    <a class="card" href="${escHtml(site.url)}" target="_blank" rel="noopener"
       style="--card-color:${color}">
      <div class="card-top">
        <div class="card-dot"></div>
        <span class="card-name">${escHtml(site.name)}</span>
        <span class="card-arrow">↗</span>
      </div>
      <p class="card-desc">${escHtml(site.description)}</p>
      <div class="card-footer">${tags}</div>
    </a>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- All button handler ----
document.querySelector('.cat-btn[data-cat="all"]').addEventListener('click', function () {
  activeCategory = 'all';
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  setActiveBtn(this);
  render();
});

// ---- Go ----
init();
