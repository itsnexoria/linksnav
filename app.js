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

/* ── SUPABASE CONFIG ────────────────────────────────────────── */
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

/* ── BOOT ───────────────────────────────────────────────────── */
async function init(){
  try {
    const [catsRes, sitesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/categories?select=id,label,icon,sort_order&order=sort_order.asc`, { headers: sbHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/sites?select=*&status=eq.approved&order=name.asc`, { headers: sbHeaders() })
    ]);

    if (!catsRes.ok || !sitesRes.ok) throw new Error('Supabase fetch failed');

    const cats = await catsRes.json();
    const sites = await sitesRes.json();

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
    },130);
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();inp.focus();inp.select()}
    if(e.key==='Escape'&&document.activeElement===inp){inp.blur();inp.value='';searchQuery='';visibleCount=PAGE_SIZE;render()}
    /* [ and ] cycle through category tabs when not typing in an input */
    if((e.key==='['||e.key===']')&&document.activeElement!==inp&&document.activeElement.tagName!=='SELECT'){
      e.preventDefault();
      const btns=[...document.querySelectorAll('.cat-btn')];
      const curIdx=btns.findIndex(b=>b.classList.contains('active'));
      let nextIdx=e.key===']'?curIdx+1:curIdx-1;
      if(nextIdx<0)nextIdx=btns.length-1;
      if(nextIdx>=btns.length)nextIdx=0;
      btns[nextIdx]?.click();
      btns[nextIdx]?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    }
    /* r = open a random site (when not typing) */
    if(e.key==='r'&&document.activeElement!==inp&&document.activeElement.tagName!=='SELECT'){
      document.getElementById('randomBtn')?.click();
    }
  });
}

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
  const empty=document.getElementById('emptyState');
  const hint=document.getElementById('dragHint');

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
  const imgTag=imgSrc?`<img class="card-favicon" data-src="${esc(imgSrc)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=" alt="" decoding="async" onerror="this.style.display='none'" width="22" height="22">`:'';
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
    <button class="fav-btn${isFav?' fav-btn--active':''}"
            onclick="toggleFav('${esc(s.url)}',event)"
            aria-label="${isFav?'Remove from':'Add to'} favorites">
      ${isFav?'★ Saved':'☆ Save'}
    </button>
    ${s.id?`<button class="info-btn" onclick="openSiteDetail('${esc(s.id)}',event)" aria-label="More info about ${esc(s.name)}" title="More info"><span class="info-btn-label">Info</span></button>`:''}
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

/* ── SITE DETAIL MODAL ────────────────────────────────────────────── */
let _currentDetailSiteId = null;
let _currentDetailReason = null;

function esc2(s){ return esc(s); } // alias for clarity in template strings below

function openDetailModal(){
  document.getElementById('detailOverlay').classList.add('show');
  document.getElementById('detailModal').classList.add('show');
  document.getElementById('detailOverlay').setAttribute('aria-hidden','false');
  document.getElementById('detailModal').setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeDetailModal(){
  document.getElementById('detailOverlay').classList.remove('show');
  document.getElementById('detailModal').classList.remove('show');
  document.getElementById('detailOverlay').setAttribute('aria-hidden','true');
  document.getElementById('detailModal').setAttribute('aria-hidden','true');
  document.body.style.overflow='';
  _currentDetailSiteId=null;
  _currentDetailReason=null;
}

window.openSiteDetail = async function(siteId, e){
  if(e){e.preventDefault();e.stopPropagation();}
  const site = allSites.find(s=>s.id===siteId);
  if(!site) return;
  _currentDetailSiteId = siteId;

  const body = document.getElementById('detailBody');
  body.innerHTML = `<div class="detail-loading"><span class="loading-spin"></span></div>`;
  openDetailModal();

  const tagHTML = (site.tags||[]).map(t=>{
    const bg=(site.tag_colors||{})[t]||'#6b7280';
    return `<span class="tag" style="--tag-bg:${esc(bg)}">${esc(t)}</span>`;
  }).join('');
  const cat = allCategories.find(c=>c.id===site.category);
  const catLabel = cat ? `${cat.icon} ${cat.label}` : site.category;
  const faviconUrl = fav(site.url);
  const healthHTML = (()=>{
    if(!site.last_checked_at) return `<span class="detail-health-badge detail-health-badge--unknown">○ Not checked yet</span>`;
    const ago = timeAgo(site.last_checked_at);
    if(site.health_status==='up') return `<span class="detail-health-badge detail-health-badge--up" title="HTTP ${site.http_status||'—'}">● Healthy — checked ${esc(ago)}</span>`;
    return `<span class="detail-health-badge detail-health-badge--down" title="HTTP ${site.http_status||'no response'}">⚠ May be down — checked ${esc(ago)}</span>`;
  })();

  body.innerHTML = `
    <div class="detail-header">
      <img class="detail-favicon" src="${esc(faviconUrl)}" alt="" onerror="this.style.display='none'"/>
      <div class="detail-title-wrap">
        <div class="detail-name">${esc(site.name)}</div>
        <span class="detail-cat-badge">${catLabel}</span>
        ${healthHTML}
      </div>
    </div>
    <p class="detail-desc">${esc(site.description)}</p>
    <div class="detail-tags">${tagHTML}</div>
    <a class="detail-visit-btn" href="${esc(site.url)}" target="_blank" rel="noopener noreferrer" onclick="bumpCount('${esc(site.url)}');addRecent('${esc(site.url)}')">
      Visit Site ↗
    </a>
    <div class="detail-action-row">
      <button class="detail-action-btn" onclick="copyCardLink('${esc(site.url)}', event)">🔗 Copy Link</button>
      <button class="detail-action-btn" onclick="toggleFav('${esc(site.url)}', event); this.textContent = favorites.has('${esc(site.url)}') ? '★ Saved' : '☆ Save'">${favorites.has(site.url)?'★ Saved':'☆ Save'}</button>
      <button class="detail-action-btn danger" onclick="toggleReportForm()">⚠️ Report</button>
    </div>

    <div class="report-form" id="reportForm">
      <div class="detail-section-label">What's wrong with this site?</div>
      <div class="report-reason-grid">
        <button class="report-reason-btn" data-reason="broken_link" onclick="selectReportReason(this)">🔗 Broken link</button>
        <button class="report-reason-btn" data-reason="wrong_info" onclick="selectReportReason(this)">📝 Wrong info</button>
        <button class="report-reason-btn" data-reason="spam_or_scam" onclick="selectReportReason(this)">🚫 Spam/scam</button>
        <button class="report-reason-btn" data-reason="duplicate" onclick="selectReportReason(this)">📋 Duplicate</button>
        <button class="report-reason-btn" data-reason="other" onclick="selectReportReason(this)" style="grid-column:1/-1">❓ Other</button>
      </div>
      <textarea class="report-note" id="reportNote" placeholder="Optional details…" maxlength="500"></textarea>
      <button class="report-submit-btn" id="reportSubmitBtn" onclick="submitSiteReport()" disabled>Submit Report</button>
    </div>

    <div class="detail-section-label" style="margin-top:24px">You might also like</div>
    <div class="similar-grid" id="similarGrid">
      <div style="grid-column:1/-1;text-align:center;padding:14px 0"><span class="loading-spin"></span></div>
    </div>
  `;

  loadSimilarSites(siteId);
};

async function loadSimilarSites(siteId){
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_similar_sites`, {
      method:'POST', headers: sbHeaders(),
      body: JSON.stringify({ input_site_id: siteId, result_limit: 4 })
    });
    const grid = document.getElementById('similarGrid');
    if(!grid) return; // modal may have closed already
    if(!res.ok){ grid.innerHTML=''; return; }
    const similar = await res.json();
    if(!similar.length){ grid.innerHTML = `<p style="grid-column:1/-1;color:var(--muted);font-size:.78rem">No similar sites found.</p>`; return; }
    grid.innerHTML = similar.map(s => `
      <a class="similar-card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" onclick="bumpCount('${esc(s.url)}')">
        <img class="similar-card-favicon" src="${esc(fav(s.url))}" alt="" onerror="this.style.display='none'"/>
        <span class="similar-card-name">${esc(s.name)}</span>
      </a>
    `).join('');
  }catch{
    const grid = document.getElementById('similarGrid');
    if(grid) grid.innerHTML = '';
  }
}

window.toggleReportForm = function(){
  document.getElementById('reportForm').classList.toggle('show');
};
window.selectReportReason = function(btn){
  document.querySelectorAll('.report-reason-btn').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  _currentDetailReason = btn.dataset.reason;
  document.getElementById('reportSubmitBtn').disabled = false;
};
window.submitSiteReport = async function(){
  if(!_currentDetailSiteId || !_currentDetailReason) return;
  const btn = document.getElementById('reportSubmitBtn');
  const note = document.getElementById('reportNote').value.trim();
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_report`, {
      method:'POST', headers: sbHeaders(),
      body: JSON.stringify({ input_site_id: _currentDetailSiteId, input_reason: _currentDetailReason, input_note: note||null })
    });
    if(!res.ok) throw new Error();
    document.getElementById('reportForm').innerHTML = `<div class="report-success">✓ Thanks — we'll take a look.</div>`;
    showToast('Report submitted — thank you!');
  }catch{
    btn.disabled = false;
    btn.textContent = 'Submit Report';
    showToast('Failed to submit report', true);
  }
};

document.getElementById('detailClose')?.addEventListener('click', closeDetailModal);
document.getElementById('detailOverlay')?.addEventListener('click', closeDetailModal);
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDetailModal(); });

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
