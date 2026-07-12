/* ============================================================
   Nexo Hub — app.js  v8
   + Drag & drop reorder (per-category, saved to localStorage)
   + Sort bar (Default / A→Z / Z→A / Most Visited)
   + Font: Inter
   ============================================================ */
'use strict';

/* ── CONSTANTS ──────────────────────────────────────────────── */
const CLICKS_KEY = 'nexhub_clicks';
const FAVS_KEY   = 'nexhub_favs';
const ORDER_KEY  = 'nexhub_order';
const RECENTS_KEY = 'nexhub_recents';
const MAX_RECENTS = 24;
/* Bump this any time you need to bust the browser/CDN cache on app.js/style.css. */
const BUILD_VERSION = '20260626-1';

/* ── ANIMATIONS INIT ─────────────────────────────────────────── */
(function initAnimations(){
  /* Header scroll glass effect */
  const header = document.querySelector('.header');
  if(header){
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Skeleton placeholders while sites load */
  const siteGridEl2 = document.getElementById('siteGrid');
  if(siteGridEl2 && !siteGridEl2.children.length){
    siteGridEl2.innerHTML = Array.from({length: 12}, () => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line" style="width:85%"></div>
        <div class="skeleton skeleton-short"></div>
      </div>`).join('');
  }

  /* Smooth scroll for category nav arrows */
  document.querySelectorAll('.scroll-arrow').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = document.getElementById('catNavInner');
      if(!nav) return;
      const dir = btn.dataset.dir === 'right' ? 1 : -1;
      nav.scrollBy({ left: dir * 220, behavior: 'smooth' });
    });
  });

  /* Ripple on card clicks */
  const siteGridEl = document.getElementById('siteGrid');
  if(siteGridEl){
    siteGridEl.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if(!card) return;
      const r = document.createElement('span');
      r.className = 'ripple-circle';
      const rect = card.getBoundingClientRect();
      r.style.left = (e.clientX - rect.left) + 'px';
      r.style.top  = (e.clientY - rect.top) + 'px';
      card.style.position = 'relative';
      card.style.overflow = 'hidden';
      card.appendChild(r);
      r.addEventListener('animationend', () => r.remove());
    });

    /* 3D tilt on mouse move */
    siteGridEl.addEventListener('mousemove', e => {
      const wrap = e.target.closest('.card-wrap');
      if(!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  - .5) * 7;
      const y = ((e.clientY - rect.top)  / rect.height - .5) * -7;
      wrap.style.transform = `translateY(-4px) rotateX(${y}deg) rotateY(${x}deg)`;
    });
    siteGridEl.addEventListener('mouseleave', e => {
      const wrap = e.target.closest('.card-wrap');
      if(wrap) wrap.style.transform = '';
    }, true);
  }
})();
const SUPABASE_URL = 'https://tiupkpabwuefclbrpaef.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ut5Qh9mJNfK3qaltXgCH6g_Phryct7r';
function sbHeaders(extra={}){
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

/* ── STATE ──────────────────────────────────────────────────── */
let allSites       = [];
let allCategories  = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = loadFavs();
let currentSort    = 'default';
let currentPrice   = 'all';
let currentTag     = '';
const PAGE_SIZE    = 24;
let visibleCount   = PAGE_SIZE;

/* ── CATEGORY MANIFEST ──────────────────────────────────────── */
/* Fallback icons in case the categories table is briefly unreachable.
   The DB is still the source of truth — these are just visual fallbacks. */
const CAT_ICON_FALLBACK = {
  'ai':'🤖','anime':'🧸','business':'🏢','design':'🎨','dev-tools':'🛠️',
  'downloads':'⬇️','finance':'💳','gaming':'🎮','google':'🔵','hosting':'☁️',
  'learning':'📚','minecraft':'⛏️','movies':'🎬','music':'🎵','my-sites':'🌐',
  'news':'📰','productivity':'📋','security':'🔒','shopping':'🛒','social':'📱',
  'storage':'📁','streaming':'📺','tools':'⚙️'
};

/* ── FAVOURITES ─────────────────────────────────────────────── */
function loadFavs(){ try{return new Set(JSON.parse(localStorage.getItem(FAVS_KEY)||'[]'))}catch{return new Set()} }
function saveFavs(){ localStorage.setItem(FAVS_KEY,JSON.stringify([...favorites])) }
function toggleFav(url,e){
  e.preventDefault();e.stopPropagation();
  favorites.has(url)?favorites.delete(url):favorites.add(url);
  saveFavs();
  const wrap=e.currentTarget.closest('.card-wrap');
  if(wrap){wrap.style.transform='scale(1.04)';setTimeout(()=>wrap.style.transform='',150)}
  render();
}

/* ── ORDER (drag-and-drop persistence) ──────────────────────── */
function loadOrder(){try{return JSON.parse(localStorage.getItem(ORDER_KEY)||'{}')}catch{return{}}}
function saveOrder(catId,urls){const o=loadOrder();o[catId]=urls;localStorage.setItem(ORDER_KEY,JSON.stringify(o))}
function getOrder(catId){return loadOrder()[catId]||null}

/* Apply saved order to a site array for a given category */
function applyOrder(sites,catId){
  const saved=getOrder(catId);
  if(!saved||!saved.length)return sites;
  const map=new Map(sites.map(s=>[s.url,s]));
  const ordered=saved.map(u=>map.get(u)).filter(Boolean);
  const extras=sites.filter(s=>!saved.includes(s.url));
  return [...ordered,...extras];
}

/* ── CLICK COUNTER ──────────────────────────────────────────── */
function loadClicks(){try{return JSON.parse(localStorage.getItem(CLICKS_KEY)||'{}')}catch{return{}}}
function saveClicks(m){localStorage.setItem(CLICKS_KEY,JSON.stringify(m))}
function getCount(url){return loadClicks()[url]||0}
function bumpCount(url){const m=loadClicks();m[url]=(m[url]||0)+1;saveClicks(m);return m[url]}
function fmtCount(n){return n>=1000?(n/1000).toFixed(1)+'k':n||0}
function timeAgo(iso){
  const diffMs=Date.now()-new Date(iso).getTime();
  const mins=Math.round(diffMs/60000);
  if(mins<1)return'just now';
  if(mins<60)return mins+'m ago';
  const hrs=Math.round(mins/60);
  if(hrs<24)return hrs+'h ago';
  return Math.round(hrs/24)+'d ago';
}

/* ── RECENTLY VISITED ───────────────────────────────────────── */
function loadRecents(){try{return JSON.parse(localStorage.getItem(RECENTS_KEY)||'[]')}catch{return[]}}
function saveRecents(arr){localStorage.setItem(RECENTS_KEY,JSON.stringify(arr.slice(0,MAX_RECENTS)))}
function addRecent(url){
  let arr=loadRecents().filter(u=>u!==url);
  arr.unshift(url);
  saveRecents(arr);
}

/* ── PAGINATED FETCH ────────────────────────────────────────────
   PostgREST caps unpaginated responses at 1000 rows by default. We're
   under that today, but this pages through in batches so the directory
   can grow past it without silently truncating results. */
async function fetchAllSites(){
  const PAGE_SIZE = 500;
  let offset = 0;
  let out = [];
  while(true){
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sites?select=*&status=eq.approved&order=name.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: sbHeaders() }
    );
    if(!res.ok) throw new Error('Supabase fetch failed');
    const page = await res.json();
    out = out.concat(page);
    if(page.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }
  return out;
}

/* ── BOOT ───────────────────────────────────────────────────── */
async function init(){
  try {
    const [catsRes, sites] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,label,icon,sort_order&order=sort_order.asc`, { headers: sbHeaders() }),
      fetchAllSites()
    ]);

    if (!catsRes.ok) throw new Error('Supabase fetch failed');

    const cats = await catsRes.json();

    allCategories = cats.map(c => ({ id: c.id, label: c.label, icon: c.icon || CAT_ICON_FALLBACK[c.id] || '🔗' }));
    allSites = sites.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      description: s.description,
      category: s.category,
      tags: s.tags || [],
      tag_colors: s.tag_colors || {},
      color: s.color || '#4f7fff',
      created_at: s.created_at,
      slug: s.slug,
      health_status: s.health_status,
      http_status: s.http_status,
      last_checked_at: s.last_checked_at
    }));
  } catch (err) {
    console.error('Failed to load sites from Supabase:', err);
    allCategories = [];
    allSites = [];
    const empty = document.getElementById('emptyState');
    const grid = document.getElementById('cardsGrid');
    if (grid) grid.style.display = 'none';
    if (empty) {
      empty.style.display = 'block';
      const q = document.getElementById('emptyQuery');
      if (q) q.textContent = 'sites right now — please refresh or try again shortly';
    }
  }

  buildNav();
  render();
  setupSearch();
  setupScrollArrows();
  populateTagFilter();
  rollCount(0, allSites.length);
  recordVisit();
}

/* Populate the tag filter dropdown from the get_all_tags RPC, falling back
   to deriving tags client-side from allSites if the call fails. */
async function populateTagFilter(){
  const sel = document.getElementById('tagSelect');
  if(!sel) return;
  let tags = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_tags`, { headers: sbHeaders() });
    if(res.ok) tags = await res.json();
  } catch {}
  if(!tags.length){
    const counts = {};
    allSites.forEach(s => (s.tags||[]).forEach(t => counts[t] = (counts[t]||0)+1));
    tags = Object.entries(counts).map(([tag,site_count])=>({tag,site_count})).sort((a,b)=>b.site_count-a.site_count);
  }
  /* Skip the price tags since they already have their own dedicated dropdown */
  const priceTags = new Set(['free','freemium','paid']);
  const frag = document.createDocumentFragment();
  tags.filter(t=>!priceTags.has(t.tag)).forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t.tag;
    opt.textContent = `${t.tag} (${t.site_count})`;
    frag.appendChild(opt);
  });
  sel.appendChild(frag);
}

/* Fire-and-forget visit counter — never blocks rendering, never throws */
function recordVisit(){
  try {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/record_visit`, {
      method: 'POST',
      headers: sbHeaders(),
      body: '{}'
    }).catch(()=>{});
  } catch {}
  pingPresence();
}

/* Presence heartbeat — lets admin panel show live active user count */
(function setupPresence(){
  let _sessionId = sessionStorage.getItem('nexhub_sid');
  if(!_sessionId){
    _sessionId = Math.random().toString(36).slice(2)+Date.now().toString(36);
    sessionStorage.setItem('nexhub_sid', _sessionId);
  }
  window._nexhubSid = _sessionId;
})();

function pingPresence(){
  try{
    fetch(`${SUPABASE_URL}/rest/v1/rpc/ping_visitor`, {
      method:'POST', headers: sbHeaders(),
      body: JSON.stringify({ p_session_id: window._nexhubSid||'anon', p_page:'/' })
    }).catch(()=>{});
    // Re-ping every 30s to maintain presence
    setInterval(()=>{
      fetch(`${SUPABASE_URL}/rest/v1/rpc/ping_visitor`, {
        method:'POST', headers: sbHeaders(),
        body: JSON.stringify({ p_session_id: window._nexhubSid||'anon', p_page:'/' })
      }).catch(()=>{});
    }, 30000);
  }catch{}
}

/* Rolling count */
function rollCount(from,to){
  const el=document.getElementById('siteCount');
  if(!el)return;
  const dur=900,t0=performance.now();
  const tick=now=>{
    const p=Math.min((now-t0)/dur,1),e=1-Math.pow(1-p,3);
    el.textContent=`${Math.round(from+(to-from)*e)} sites`;
    if(p<1)requestAnimationFrame(tick);
    else{el.textContent=`${to} sites`;el.classList.add('updated');setTimeout(()=>el.classList.remove('updated'),1200)}
  };
  requestAnimationFrame(tick);
}

/* ── CATEGORY NAV ───────────────────────────────────────────── */
function buildNav(){
  const inner=document.getElementById('catNavInner');
  const favBtn=mkBtn('cat-btn cat-btn-fav','__favorites__','★ Favorites');
  inner.querySelector('[data-cat="all"]').insertAdjacentElement('afterend',favBtn);
  const recentBtn=mkBtn('cat-btn cat-btn-recent','__recent__','🕓 Recent');
  favBtn.insertAdjacentElement('afterend',recentBtn);
  const frag=document.createDocumentFragment();
  allCategories.forEach(cat=>frag.appendChild(mkBtn('cat-btn',cat.id,`${cat.icon} ${cat.label}`)));
  inner.appendChild(frag);
}
function mkBtn(cls,catId,label){
  const b=document.createElement('button');
  b.className=cls;b.dataset.cat=catId;
  b.setAttribute('role','tab');b.setAttribute('aria-selected','false');
  b.textContent=label;
  b.addEventListener('click',()=>switchCat(catId,b));
  return b;
}
function switchCat(id,btn){
  activeCategory=id;searchQuery='';visibleCount=PAGE_SIZE;
  const inp=document.getElementById('searchInput');
  if(inp)inp.value='';
  hideSuggestions();
  /* Reset price filter */
  const ps=document.getElementById('priceSelect');
  if(ps){ps.value='all';currentPrice='all';}
  setActive(btn);render();
}
function setActive(btn){
  document.querySelectorAll('.cat-btn').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false')});
  btn.classList.add('active');btn.setAttribute('aria-selected','true');
}
document.querySelector('.cat-btn[data-cat="all"]').addEventListener('click',function(){switchCat('all',this)});

/* ── SCROLL ARROWS ──────────────────────────────────────────── */
function setupScrollArrows(){
  const inner=document.getElementById('catNavInner');
  const nav=document.getElementById('catNav');
  const L=document.getElementById('scrollLeft');
  const R=document.getElementById('scrollRight');
  const STEP=240;
  function sync(){
    const atS=inner.scrollLeft<=2,atE=inner.scrollLeft+inner.clientWidth>=inner.scrollWidth-2;
    L.disabled=atS;R.disabled=atE;
    nav.classList.toggle('at-start',atS);nav.classList.toggle('at-end',atE);
  }
  L.addEventListener('click',()=>inner.scrollBy({left:-STEP,behavior:'smooth'}));
  R.addEventListener('click',()=>inner.scrollBy({left:STEP,behavior:'smooth'}));
  inner.addEventListener('scroll',sync,{passive:true});
  sync();
}

/* ── SEARCH ─────────────────────────────────────────────────── */
let logSearchTimer;
function logSearchQuery(q, resultCount){
  clearTimeout(logSearchTimer);
  logSearchTimer=setTimeout(()=>{
    fetch(`${SUPABASE_URL}/rest/v1/rpc/log_search`, {
      method:'POST',
      headers: sbHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({ p_query: q, p_result_count: resultCount })
    }).catch(()=>{});
  },900);
}
/* ── SEARCH AUTOCOMPLETE ────────────────────────────────────── */
let ssActiveIndex=-1, ssItems=[];
function favSmall(url){ try{ return 'https://www.google.com/s2/favicons?domain='+new URL(url).hostname+'&sz=32'; }catch{ return ''; } }
function renderSuggestions(query){
  const box=document.getElementById('searchSuggest');
  const inp=document.getElementById('searchInput');
  if(!box) return;
  if(!query){ hideSuggestions(); return; }
  const q=query.toLowerCase();
  const starts=[], contains=[];
  for(const s of allSites){
    const name=(s.name||'').toLowerCase();
    if(name.startsWith(q)) starts.push(s);
    else if(name.includes(q)) contains.push(s);
    if(starts.length+contains.length>=40) break;
  }
  ssItems=[...starts,...contains].slice(0,6);
  ssActiveIndex=-1;
  if(!ssItems.length){ hideSuggestions(); return; }
  box.innerHTML=ssItems.map((s,i)=>{
    const cat=allCategories.find(c=>c.id===s.category);
    const catLabel=cat?`${cat.icon} ${cat.label}`:s.category;
    return `<div class="ss-item" role="option" data-idx="${i}" data-href="${s.slug?('/site/'+s.slug+'/'):s.url}">
      <img class="ss-fav" src="${favSmall(s.url)}" alt="" onerror="this.style.visibility='hidden'"/>
      <div class="ss-info"><div class="ss-name">${(s.name||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div><div class="ss-cat">${catLabel}</div></div>
    </div>`;
  }).join('');
  box.hidden=false;
  inp.setAttribute('aria-expanded','true');
  box.querySelectorAll('.ss-item').forEach(el=>{
    el.addEventListener('mousedown', e=>{ e.preventDefault(); window.location.href = el.dataset.href; });
    el.addEventListener('mouseenter', ()=>{ setSsActive(parseInt(el.dataset.idx,10)); });
  });
}
function setSsActive(idx){
  const box=document.getElementById('searchSuggest');
  if(!box) return;
  ssActiveIndex=idx;
  box.querySelectorAll('.ss-item').forEach(el=>el.classList.toggle('ss-active', parseInt(el.dataset.idx,10)===idx));
}
function hideSuggestions(){
  const box=document.getElementById('searchSuggest');
  const inp=document.getElementById('searchInput');
  if(box){ box.hidden=true; box.innerHTML=''; }
  if(inp) inp.setAttribute('aria-expanded','false');
  ssItems=[]; ssActiveIndex=-1;
}

function setupSearch(){
  const inp=document.getElementById('searchInput');
  let t;
  inp.addEventListener('input',()=>{
    clearTimeout(t);
    t=setTimeout(()=>{
      searchQuery=inp.value.toLowerCase().trim();
      visibleCount=PAGE_SIZE;
      if(searchQuery){activeCategory='all';setActive(document.querySelector('.cat-btn[data-cat="all"]'))}
      render();
      renderSuggestions(inp.value.trim());
      if(searchQuery){
        const matchCount=allSites.filter(s=>`${s.name} ${s.description} ${s.category} ${(s.tags||[]).join(' ')}`.toLowerCase().includes(searchQuery)).length;
        logSearchQuery(searchQuery, matchCount);
      }
    },130);
  });
  inp.addEventListener('blur',()=>{ setTimeout(hideSuggestions,120); });
  inp.addEventListener('focus',()=>{ if(inp.value.trim()) renderSuggestions(inp.value.trim()); });
  document.addEventListener('click',e=>{
    const box=document.getElementById('searchSuggest');
    if(box && !box.hidden && !box.contains(e.target) && e.target!==inp) hideSuggestions();
  });
  document.addEventListener('keydown',e=>{
    const typing = document.activeElement===inp || document.activeElement.tagName==='SELECT' || document.activeElement.tagName==='TEXTAREA' || document.activeElement.isContentEditable;
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();inp.focus();inp.select()}
    if(document.activeElement===inp && ssItems.length && !document.getElementById('searchSuggest').hidden){
      if(e.key==='ArrowDown'){e.preventDefault();setSsActive((ssActiveIndex+1)%ssItems.length);return;}
      if(e.key==='ArrowUp'){e.preventDefault();setSsActive((ssActiveIndex-1+ssItems.length)%ssItems.length);return;}
      if(e.key==='Enter' && ssActiveIndex>=0){e.preventDefault();const s=ssItems[ssActiveIndex];window.location.href=s.slug?('/site/'+s.slug+'/'):s.url;return;}
    }
    if(e.key==='Escape'){
      if(document.getElementById('shortcutsModal')){closeShortcutsModal();return;}
      if(document.activeElement===inp && ssItems.length && !document.getElementById('searchSuggest').hidden){ hideSuggestions(); return; }
      if(document.activeElement===inp){inp.blur();inp.value='';searchQuery='';visibleCount=PAGE_SIZE;render();hideSuggestions();}
    }
    if(e.key==='?'&&!typing){e.preventDefault();openShortcutsModal();return;}
    /* [ and ] cycle through category tabs when not typing */
    if((e.key==='['||e.key===']')&&!typing){
      e.preventDefault();
      const btns=[...document.querySelectorAll('.cat-btn')];
      const curIdx=btns.findIndex(b=>b.classList.contains('active'));
      let nextIdx=e.key===']'?curIdx+1:curIdx-1;
      if(nextIdx<0)nextIdx=btns.length-1;
      if(nextIdx>=btns.length)nextIdx=0;
      btns[nextIdx]?.click();
      btns[nextIdx]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    }
    if(e.key==='r'&&!typing){document.getElementById('randomBtn')?.click();}
    if(e.key==='f'&&!typing){
      const favBtn=document.querySelector('.cat-btn[data-cat="favs"]');
      if(favBtn){favBtn.click();favBtn.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});}
    }
  });
}

/* ── KEYBOARD SHORTCUTS MODAL ──────────────────────────────── */
function openShortcutsModal(){
  if(document.getElementById('shortcutsModal')) return;
  const SHORTCUTS = [
    ['Ctrl K', 'Open search'],
    ['?', 'Show this panel'],
    ['R', 'Open a random site'],
    ['F', 'Jump to Favourites'],
    ['[ ]', 'Cycle categories left / right'],
    ['Escape', 'Close panel / clear search'],
  ];
  const overlay = document.createElement('div');
  overlay.id = 'shortcutsModal';
  overlay.className = 'shortcuts-overlay';
  overlay.innerHTML = `
    <div class="shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div class="shortcuts-header">
        <span class="shortcuts-title">⌨️ Keyboard Shortcuts</span>
        <button class="shortcuts-close" onclick="closeShortcutsModal()" aria-label="Close">✕</button>
      </div>
      <div class="shortcuts-list">
        ${SHORTCUTS.map(([key,desc])=>`
          <div class="shortcuts-row">
            <div class="shortcuts-keys">${key.split(' ').map(k=>`<kbd>${esc(k)}</kbd>`).join('<span class="shortcuts-plus">+</span>')}</div>
            <span class="shortcuts-desc">${esc(desc)}</span>
          </div>`).join('')}
      </div>
      <div class="shortcuts-footer">Press <kbd>Esc</kbd> or <kbd>?</kbd> to close</div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('show'));
  overlay.addEventListener('click',e=>{ if(e.target===overlay) closeShortcutsModal(); });
}
function closeShortcutsModal(){
  const m=document.getElementById('shortcutsModal');
  if(!m) return;
  m.classList.remove('show');
  setTimeout(()=>m.remove(), 200);
}
window.closeShortcutsModal = closeShortcutsModal;

/* ── SORT & PRICE FILTER HANDLERS ───────────────────────────── */
window.onSortChange = function(mode) {
  currentSort = mode; visibleCount = PAGE_SIZE;
  const hint = document.getElementById('dragHint');
  if (hint) hint.classList.toggle('visible', mode === 'default' && !searchQuery);
  render();
};

window.onPriceChange = function(price) {
  currentPrice = price; visibleCount = PAGE_SIZE;
  render();
};

window.onTagChange = function(tag) {
  currentTag = tag; visibleCount = PAGE_SIZE;
  render();
};

function sortSites(sites){
  if(currentSort==='az') return [...sites].sort((a,b)=>a.name.localeCompare(b.name));
  if(currentSort==='za') return [...sites].sort((a,b)=>b.name.localeCompare(a.name));
  if(currentSort==='visits') return [...sites].sort((a,b)=>getCount(b.url)-getCount(a.url));
  return sites; /* default — preserves drag order */
}

/* ── FILTER ─────────────────────────────────────────────────── */
function getFiltered(){
  let base;
  if(activeCategory==='__favorites__'){
    base=allSites.filter(s=>favorites.has(s.url));
  } else if(activeCategory==='__recent__'){
    const recents=loadRecents();
    const map=new Map(allSites.map(s=>[s.url,s]));
    base=recents.map(u=>map.get(u)).filter(Boolean);
  } else {
    base=allSites.filter(s=>{
      if(activeCategory!=='all'&&s.category!==activeCategory)return false;
      if(!searchQuery)return true;
      return `${s.name} ${s.description} ${s.category} ${(s.tags||[]).join(' ')}`.toLowerCase().includes(searchQuery);
    });
  }

  /* Price filter — match against tags array */
  if(currentPrice!=='all'){
    base=base.filter(s=>{
      const tags=(s.tags||[]).map(t=>t.toLowerCase());
      if(currentPrice==='free')    return tags.includes('free');
      if(currentPrice==='freemium')return tags.includes('freemium');
      if(currentPrice==='paid')    return tags.includes('paid');
      return true;
    });
  }

  /* General tag filter (anything in the tags array, not just price tags) */
  if(currentTag){
    base=base.filter(s=>(s.tags||[]).includes(currentTag));
  }

  /* Apply saved drag order only in default sort and no search (favorites included, recent excluded) */
  if(currentSort==='default'&&!searchQuery&&activeCategory!=='__recent__'){
    base=applyOrder(base,activeCategory);
  }
  return sortSites(base);
}

/* ── FAVICON ────────────────────────────────────────────────── */
function fav(url){try{const{hostname}=new URL(url);return'https://www.google.com/s2/favicons?domain='+hostname+'&sz=64'}catch{return''}}
const _favObs=(typeof IntersectionObserver!=='undefined')
  ?new IntersectionObserver((entries,obs)=>{
      entries.forEach(en=>{
        if(!en.isIntersecting)return;
        const img=en.target;
        if(img.dataset.src){img.src=img.dataset.src;delete img.dataset.src}
        obs.unobserve(img);
      });
    },{rootMargin:'300px'})
  :null;
function observeFavicons(container){
  if(!_favObs)return;
  container.querySelectorAll('img.card-favicon[data-src]').forEach(img=>_favObs.observe(img));
}

/* ── RENDER ─────────────────────────────────────────────────── */
function render(){
  const filtered=getFiltered();
  const label=document.getElementById('sectionLabel');
  const countEl=document.getElementById('siteCount');
  const grid=document.getElementById('cardsGrid');
  const siteGrid=document.getElementById('siteGrid');
  const empty=document.getElementById('emptyState');
  const hint=document.getElementById('dragHint');
  /* Clear skeleton placeholders on first real render */
  if(siteGrid) siteGrid.querySelectorAll('.skeleton-card').forEach(s=>s.remove());

  if(activeCategory==='__favorites__') label.textContent='★ Favorites';
  else if(activeCategory==='__recent__') label.textContent='🕓 Recently Visited';
  else if(searchQuery) label.textContent=`Results for "${searchQuery}"`;
  else if(activeCategory==='all') label.textContent='All Sites';
  else{const c=allCategories.find(c=>c.id===activeCategory);label.textContent=c?`${c.icon} ${c.label}`:activeCategory}
  countEl.textContent=`${filtered.length} site${filtered.length!==1?'s':''}`;

  document.getElementById('loadMoreWrap')?.remove();

  /* Show drag hint only when sort=default, no search, no price filter, not recent tab */
  const canDrag=currentSort==='default'&&!searchQuery&&currentPrice==='all'&&!currentTag&&activeCategory!=='__recent__';
  if(hint)hint.classList.toggle('visible',canDrag&&filtered.length>1);

  const clearBtn=document.getElementById('clearRecentsBtn');
  if(clearBtn)clearBtn.style.display=(activeCategory==='__recent__'&&filtered.length>0)?'inline-block':'none';

  if(filtered.length===0){
    grid.innerHTML='';grid.style.display='none';empty.style.display='block';
    document.getElementById('emptyQuery').textContent=
      activeCategory==='__favorites__'?'your favorites yet — star any card!':
      activeCategory==='__recent__'?'sites visited yet — click any card to start tracking':
      (searchQuery||activeCategory);
    return;
  }
  empty.style.display='none';grid.style.display='';

  grid.replaceChildren(buildFrag(filtered.slice(0,visibleCount),canDrag));
  if(visibleCount<filtered.length)mkLoadMore(filtered.length,filtered.length-visibleCount);

  if(canDrag)initDrag(grid);
  observeFavicons(grid);
}

/* ── BUILD FRAGMENT ─────────────────────────────────────────── */
function buildFrag(sites,draggable=false){
  const frag=document.createDocumentFragment();
  sites.forEach(s=>{
    const tmp=document.createElement('div');
    tmp.innerHTML=cardHTML(s,draggable);
    frag.appendChild(tmp.firstElementChild);
  });
  return frag;
}

function cardHTML(s,draggable=false){
  const color=s.color||'#7c5cfc';
  const isFav=favorites.has(s.url);
  const isDown=s.health_status==='down';
  const tagHTML=(s.tags||[]).map(t=>{
    const bg=(s.tag_colors||{})[t]||'#6b7280';
    return `<span class="tag" style="--tag-bg:${esc(bg)}">${esc(t)}</span>`;
  }).join('');
  const imgSrc=fav(s.url);
  const imgTag=imgSrc?`<img class="card-favicon" data-src="${esc(imgSrc)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=" alt="${esc(s.name)} favicon" decoding="async" onerror="this.style.display='none'" width="22" height="22">`:'';
  const dragAttr=draggable?'draggable="true"':'';
  const handleHTML=draggable?'<span class="drag-handle" aria-hidden="true">⠿</span>':'';
  const downBadge=isDown?`<span class="health-badge" title="This site failed its last automatic health check${s.last_checked_at?' ('+timeAgo(s.last_checked_at)+')':''} and may be temporarily down.">⚠ May be down</span>`:'';

  return `<div class="card-wrap${isFav?' card-wrap--fav':''}${isDown?' card-wrap--down':''}" data-url="${esc(s.url)}" data-id="${esc(s.id||'')}" ${dragAttr}>
    ${handleHTML}
    <a class="card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"
       style="--card-color:${color}" aria-label="${esc(s.name)}">
      <div class="card-top">
        ${imgTag}
        <span class="card-name">${esc(s.name)}</span>
        <span class="card-arrow" aria-hidden="true">↗</span>
      </div>
      <p class="card-desc">${esc(s.description)}</p>
      <div class="card-footer">${tagHTML}${downBadge}</div>
      <div class="click-count" aria-label="Visit count"><span aria-hidden="true">👁</span><span class="click-count-num">${fmtCount(getCount(s.url))}</span></div>
    </a>
    <div class="card-actions">
      <button class="fav-btn${isFav?' fav-btn--active':''}"
              onclick="toggleFav('${esc(s.url)}',event)"
              aria-label="${isFav?'Remove from':'Add to'} favorites">
        ${isFav?'★ Saved':'☆ Save'}
      </button>
      ${s.id?`<button class="info-btn" onclick="openSiteModal('${esc(s.id)}',event)" aria-label="More info about ${esc(s.name)}">ⓘ Info</button>`:''}
    </div>
  </div>`;
}

/* ── LOAD MORE ──────────────────────────────────────────────── */
function mkLoadMore(total,rem){
  document.getElementById('loadMoreWrap')?.remove();
  const wrap=document.createElement('div');
  wrap.id='loadMoreWrap';wrap.className='load-more-wrap';
  wrap.innerHTML=`<button class="load-more-btn">Load more <span class="load-more-count">${rem} remaining</span></button>`;
  wrap.querySelector('button').addEventListener('click',()=>{visibleCount+=PAGE_SIZE;render()});
  document.getElementById('main').appendChild(wrap);
}

/* ── DRAG & DROP ────────────────────────────────────────────── */
let dragSrc=null;

function initDrag(grid){
  grid.querySelectorAll('.card-wrap[draggable="true"]').forEach(wrap=>{
    wrap.addEventListener('dragstart',onDragStart,{passive:true});
    wrap.addEventListener('dragend',onDragEnd,{passive:true});
    wrap.addEventListener('dragover',onDragOver);
    wrap.addEventListener('dragleave',onDragLeave,{passive:true});
    wrap.addEventListener('drop',onDrop);
  });
}

function onDragStart(e){
  dragSrc=this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',this.dataset.url);
}

function onDragEnd(){
  this.classList.remove('dragging');
  document.querySelectorAll('.card-wrap.drag-over').forEach(el=>el.classList.remove('drag-over'));
  dragSrc=null;
}

function onDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  if(dragSrc&&dragSrc!==this){
    document.querySelectorAll('.card-wrap.drag-over').forEach(el=>{if(el!==this)el.classList.remove('drag-over')});
    this.classList.add('drag-over');
  }
}

function onDragLeave(){
  this.classList.remove('drag-over');
}

function onDrop(e){
  e.preventDefault();e.stopPropagation();
  this.classList.remove('drag-over');
  if(!dragSrc||dragSrc===this)return;

  const grid=document.getElementById('cardsGrid');
  const wraps=[...grid.querySelectorAll('.card-wrap[draggable="true"]')];
  const fromIdx=wraps.indexOf(dragSrc);
  const toIdx=wraps.indexOf(this);
  if(fromIdx<0||toIdx<0)return;

  /* Reorder in DOM */
  if(fromIdx<toIdx) this.insertAdjacentElement('afterend',dragSrc);
  else              this.insertAdjacentElement('beforebegin',dragSrc);

  /* Persist new order */
  const newOrder=[...grid.querySelectorAll('.card-wrap[draggable="true"]')].map(el=>el.dataset.url);
  saveOrder(activeCategory,newOrder);

  /* Also reorder in allSites so future renders respect it */
  const catKey=activeCategory;
  persistOrderToAllSites(newOrder,catKey);

  /* Micro bounce */
  dragSrc.style.transform='scale(1.03)';
  setTimeout(()=>dragSrc.style.transform='',200);
}

/* Update allSites order so getFiltered/applyOrder sees new order immediately */
function persistOrderToAllSites(orderedUrls,catId){
  const map=new Map(allSites.map(s=>[s.url,s]));
  const catSites=orderedUrls.map(u=>map.get(u)).filter(Boolean);
  const others=allSites.filter(s=>!orderedUrls.includes(s.url));
  if(catId==='all') allSites=[...catSites,...others];
  else allSites=[...catSites,...others]; /* order within category preserved via applyOrder */
}

/* ── CLICK TRACKING ─────────────────────────────────────────── */
document.getElementById('cardsGrid').addEventListener('click',e=>{
  const card=e.target.closest('a.card');
  if(!card)return;
  const count=bumpCount(card.href);
  addRecent(card.href);
  const badge=card.querySelector('.click-count-num');
  if(badge){
    badge.textContent=fmtCount(count);
    const wrap=card.querySelector('.click-count');
    if(wrap){wrap.classList.remove('cc-bump');void wrap.offsetWidth;wrap.classList.add('cc-bump')}
  }
});

/* ── CLEAR RECENTS ─────────────────────────────────────────────── */
window.clearRecents=function(){
  saveRecents([]);
  if(activeCategory==='__recent__')render();
};

/* ── COPY LINK ──────────────────────────────────────────────────── */
let _toastTimer;
function showToast(msg, isError=false){
  const t=document.getElementById('toast');
  if(!t)return;
  clearTimeout(_toastTimer);
  t.textContent=msg;
  t.className='toast show'+(isError?' error':'');
  _toastTimer=setTimeout(()=>t.classList.remove('show'),1800);
}
window.copyCardLink=function(url,e){
  e.preventDefault();e.stopPropagation();
  const btn=e.currentTarget;
  function onSuccess(){
    showToast('Link copied!');
    btn.classList.remove('copied');void btn.offsetWidth;btn.classList.add('copied');
  }
  function legacyCopy(){
    try{
      const ta=document.createElement('textarea');
      ta.value=url;
      ta.setAttribute('readonly','');
      ta.style.position='fixed';
      ta.style.top='0';
      ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);
      const ok=document.execCommand('copy');
      document.body.removeChild(ta);
      ok?onSuccess():showToast('Could not copy link',true);
    }catch{
      showToast('Could not copy link',true);
    }
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(onSuccess).catch(legacyCopy);
  }else{
    legacyCopy();
  }
};


/* ── SITE DETAIL MODAL ───────────────────────────────────────── */
window.openSiteModal = function(siteId, e){
  if(e){ e.preventDefault(); e.stopPropagation(); }
  const site = allSites.find(s=>s.id===siteId);
  if(!site) return;

  /* Remove existing modal if any */
  document.getElementById('siteModal')?.remove();

  const tagHTML = (site.tags||[]).map(t=>{
    const bg=(site.tag_colors||{})[t]||'#6b7280';
    return `<span class="tag" style="--tag-bg:${esc(bg)}">${esc(t)}</span>`;
  }).join('');
  const cat = allCategories.find(c=>c.id===site.category);
  const catLabel = cat?`${cat.icon} ${cat.label}`:site.category;
  const faviconUrl = fav(site.url);
  const healthHTML = (()=>{
    if(!site.last_checked_at) return `<span class="modal-health unknown">○ Not checked</span>`;
    const ago = timeAgo(site.last_checked_at);
    if(site.health_status==='up') return `<span class="modal-health up">● Healthy · ${esc(ago)}</span>`;
    return `<span class="modal-health down">⚠ May be down · ${esc(ago)}</span>`;
  })();

  const overlay = document.createElement('div');
  overlay.id = 'siteModal';
  overlay.className = 'site-modal-overlay';
  overlay.innerHTML = `
    <div class="site-modal" role="dialog" aria-modal="true" aria-label="${esc(site.name)} details">
      <button class="site-modal-close" aria-label="Close">✕</button>
      <div class="site-modal-header">
        ${faviconUrl?`<img class="site-modal-favicon" src="${esc(faviconUrl)}" alt="${esc(site.name)} favicon" onerror="this.style.display='none'"/>`:''}
        <div>
          <div class="site-modal-name">${esc(site.name)}</div>
          <a class="site-modal-url" href="${esc(site.url)}" target="_blank" rel="noopener noreferrer">${esc(site.url)}</a>
          <div class="site-modal-badges">
            <span class="detail-cat-badge">${esc(catLabel)}</span>
            ${healthHTML}
          </div>
        </div>
      </div>
      <p class="site-modal-desc">${esc(site.description)}</p>
      ${tagHTML?`<div class="site-modal-tags">${tagHTML}</div>`:''}
      <div class="site-modal-actions">
        <a class="site-modal-visit" href="${esc(site.url)}" target="_blank" rel="noopener noreferrer" onclick="bumpCount('${esc(site.url)}');addRecent('${esc(site.url)}')">↗ Visit Site</a>
        ${site.slug ? `<a class="site-modal-btn" href="/site/${esc(site.slug)}/">📄 Details</a>` : ''}
        <button class="site-modal-btn" id="smFavBtn" onclick="toggleFav('${esc(site.url)}',event);this.textContent=favorites.has('${esc(site.url)}')?'★ Saved':'☆ Save'">
          ${favorites.has(site.url)?'★ Saved':'☆ Save'}
        </button>
        <button class="site-modal-btn" id="smCopyBtn" onclick="smCopyLink('${esc(site.url)}')">🔗 Copy Link</button>
        <button class="site-modal-btn" onclick="smShareTwitter('${esc(site.url)}','${esc(site.name)}')">𝕏 Share</button>
        <button class="site-modal-btn" onclick="smShareWhatsApp('${esc(site.url)}','${esc(site.name)}')">💬 WhatsApp</button>
        <button class="site-modal-btn site-modal-btn--danger" id="smReportBtn" onclick="smToggleReport()">⚠ Report</button>
      </div>

      <!-- Inline report form — hidden until Report is clicked -->
      <div class="sm-report-form" id="smReportForm" style="display:none">
        <div class="sm-report-label">What's the issue?</div>
        <div class="sm-report-reasons">
          <button class="sm-reason-btn" data-reason="broken_link" onclick="smSelectReason(this)">🔗 Broken link</button>
          <button class="sm-reason-btn" data-reason="wrong_info" onclick="smSelectReason(this)">📝 Wrong info</button>
          <button class="sm-reason-btn" data-reason="spam_or_scam" onclick="smSelectReason(this)">🚫 Spam/scam</button>
          <button class="sm-reason-btn" data-reason="duplicate" onclick="smSelectReason(this)">📋 Duplicate</button>
          <button class="sm-reason-btn" data-reason="site_down" onclick="smSelectReason(this)">⛔ Site is down</button>
          <button class="sm-reason-btn" data-reason="other" onclick="smSelectReason(this)">❓ Other</button>
        </div>
        <textarea class="sm-report-note" id="smReportNote" placeholder="Optional details… (max 500 chars)" maxlength="500"></textarea>
        <button class="sm-report-submit" id="smReportSubmit" onclick="smSubmitReport('${esc(site.id)}')" disabled>Submit Report</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(()=>overlay.classList.add('show'));

  overlay.querySelector('.site-modal-close').onclick = closeModal;
  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
  document.addEventListener('keydown', _escClose);
};

function _escClose(e){ if(e.key==='Escape') closeModal(); }
function closeModal(){
  const m = document.getElementById('siteModal');
  if(!m) return;
  m.classList.remove('show');
  document.removeEventListener('keydown', _escClose);
  setTimeout(()=>{ m.remove(); document.body.style.overflow=''; }, 220);
}

window.smShareTwitter = function(url, name){
  const text = `🔗 Just found "${name}" on Nexo Hub — check it out`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400,noopener');
};
window.smShareWhatsApp = function(url, name){
  const text = `🔗 Check out "${name}" — ${url}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
};
window.smCopyLink = function(url){
  const btn = document.getElementById('smCopyBtn');
  function onCopied(){ showToast('Link copied!'); if(btn){ btn.textContent='✓ Copied'; setTimeout(()=>btn.textContent='🔗 Copy Link',2000); } }
  if(navigator.clipboard){ navigator.clipboard.writeText(url).then(onCopied).catch(()=>legacyCopy(url,onCopied)); }
  else legacyCopy(url, onCopied);
  function legacyCopy(u,cb){ const ta=document.createElement('textarea');ta.value=u;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);cb(); }
};

window.smToggleReport = function(){
  const form = document.getElementById('smReportForm');
  const btn = document.getElementById('smReportBtn');
  const open = form.style.display === 'none';
  form.style.display = open ? 'block' : 'none';
  btn.classList.toggle('active', open);
};

window.smSelectReason = function(btn){
  document.querySelectorAll('.sm-reason-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('smReportSubmit').disabled = false;
};

window.smSubmitReport = async function(siteId){
  const reason = document.querySelector('.sm-reason-btn.selected')?.dataset.reason;
  if(!reason) return;
  const note = document.getElementById('smReportNote')?.value.trim() || null;
  const btn = document.getElementById('smReportSubmit');
  btn.disabled = true; btn.textContent = 'Sending…';
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_report`, {
      method:'POST', headers: sbHeaders(),
      body: JSON.stringify({ input_site_id: siteId, input_reason: reason, input_note: note })
    });
    if(!res.ok) throw new Error();
    document.getElementById('smReportForm').innerHTML = '<div class="sm-report-success">✓ Thanks — we\'ll look into it.</div>';
    showToast('Report submitted — thank you!');
  }catch{
    btn.disabled = false; btn.textContent = 'Submit Report';
    showToast('Failed to send report — please try again.', true);
  }
};

/* ── RANDOM SITE ────────────────────────────────────────────────── */
(function setupRandomBtn(){
  const btn=document.getElementById('randomBtn');
  if(!btn)return;
  btn.addEventListener('click',()=>{
    if(!allSites.length)return;
    btn.classList.remove('rolling');void btn.offsetWidth;btn.classList.add('rolling');
    const pick=allSites[Math.floor(Math.random()*allSites.length)];
    bumpCount(pick.url);
    addRecent(pick.url);
    setTimeout(()=>window.open(pick.url,'_blank','noopener,noreferrer'),180);
  });
})();

/* ── THEME ──────────────────────────────────────────────────── */
(function initTheme(){
  const saved=localStorage.getItem('nexhub_theme')||'dark';
  document.documentElement.setAttribute('data-theme',saved);
})();
document.getElementById('themeToggle')?.addEventListener('click',()=>{
  const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  localStorage.setItem('nexhub_theme',next);
});

/* ── HAMBURGER ──────────────────────────────────────────────── */
(function setupHamburger(){
  const ham=document.getElementById('hamburger');
  const menu=document.getElementById('mobileMenu');
  const ov=document.getElementById('navOverlay');
  if(!ham||!menu||!ov)return;
  const open=()=>{ham.classList.add('is-open');menu.classList.add('is-open');ov.classList.add('is-open');ham.setAttribute('aria-expanded','true');menu.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'};
  const close=()=>{ham.classList.remove('is-open');menu.classList.remove('is-open');ov.classList.remove('is-open');ham.setAttribute('aria-expanded','false');menu.setAttribute('aria-hidden','true');document.body.style.overflow=''};
  ham.addEventListener('click',()=>ham.classList.contains('is-open')?close():open());
  ov.addEventListener('click',close);
  menu.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();

/* ── UTIL ───────────────────────────────────────────────────── */
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── ADMIN SIDEBAR LINK ─────────────────────────────────────────
   If a valid admin key is already stored in this browser (from a
   previous login on /pages/admin/), quietly reveal an Admin link in
   the sidebar. Public visitors who've never logged in never see it —
   we verify the key against the server rather than trusting its mere
   presence, so a stale/cleared key won't show a dead link. */
(async function revealAdminLinkIfAuthenticated(){
  const link = document.getElementById('adminNavLink');
  if(!link) return;
  const key = sessionStorage.getItem('nexohub_admin_key') || localStorage.getItem('nexohub_admin_key');
  if(!key) return;
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_admin_key_status`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ input_key: key })
    });
    if(res.ok){
      const ok = await res.json();
      if(ok === true) link.style.display = '';
    }
  }catch{}
})();

init();
