/* ============================================================
   NexHub — app.js  v8
   + Drag & drop reorder (per-category, saved to localStorage)
   + Sort bar (Default / A→Z / Z→A / Most Visited)
   + Font: Inter
   ============================================================ */
'use strict';

/* ── CONSTANTS ──────────────────────────────────────────────── */
const CLICKS_KEY = 'nexhub_clicks';
const FAVS_KEY   = 'nexhub_favs';
const ORDER_KEY  = 'nexhub_order';

/* ── STATE ──────────────────────────────────────────────────── */
let allSites       = [];
let allCategories  = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = loadFavs();
let currentSort    = 'default';
const PAGE_SIZE    = 24;
let visibleCount   = PAGE_SIZE;

/* ── CATEGORY MANIFEST ──────────────────────────────────────── */
const CATS = [
  {id:'ai',          label:'AI',          icon:'🤖'},
  {id:'anime',       label:'Anime',       icon:'🧸'},
  {id:'business',    label:'Business',    icon:'🏢'},
  {id:'design',      label:'Design',      icon:'🎨'},
  {id:'dev-tools',   label:'Dev Tools',   icon:'🛠️'},
  {id:'downloads',   label:'Downloads',   icon:'⬇️'},
  {id:'finance',     label:'Finance',     icon:'💳'},
  {id:'gaming',      label:'Gaming',      icon:'🎮'},
  {id:'google',      label:'Google',      icon:'🔵'},
  {id:'hosting',     label:'Hosting',     icon:'☁️'},
  {id:'learning',    label:'Learning',    icon:'📚'},
  {id:'minecraft',   label:'Minecraft',   icon:'⛏️'},
  {id:'movies',      label:'Movies',      icon:'🎬'},
  {id:'music',       label:'Music',       icon:'🎵'},
  {id:'my-sites',    label:'My Sites',    icon:'🌐'},
  {id:'news',        label:'News',        icon:'📰'},
  {id:'productivity',label:'Productivity',icon:'📋'},
  {id:'security',    label:'Security',    icon:'🔒'},
  {id:'shopping',    label:'Shopping',    icon:'🛒'},
  {id:'social',      label:'Social',      icon:'📱'},
  {id:'storage',     label:'Storage',     icon:'📁'},
  {id:'streaming',   label:'Streaming',   icon:'📺'},
  {id:'tools',       label:'Tools',       icon:'⚙️'},
];

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

/* ── BOOT ───────────────────────────────────────────────────── */
async function init(){
  const settled=await Promise.allSettled(
    CATS.map(cat=>
      fetch(`json/${cat.id}.json`,{cache:'force-cache'})
        .then(r=>r.ok?r.json().then(sites=>({cat,sites})):null)
        .catch(()=>null)
    )
  );
  allCategories=[];allSites=[];
  for(const {value} of settled){
    if(!value)continue;
    allCategories.push(value.cat);
    allSites.push(...value.sites);
  }
  buildNav();
  render();
  setupSearch();
  setupScrollArrows();
  rollCount(0,allSites.length);
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
  });
}

/* ── SORT ───────────────────────────────────────────────────── */
window.setSort=function(mode,btn){
  currentSort=mode;visibleCount=PAGE_SIZE;
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const hint=document.getElementById('dragHint');
  if(hint)hint.classList.toggle('visible',mode==='default'&&!searchQuery);
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
  } else {
    base=allSites.filter(s=>{
      if(activeCategory!=='all'&&s.category!==activeCategory)return false;
      if(!searchQuery)return true;
      return `${s.name} ${s.description} ${s.category} ${(s.tags||[]).join(' ')}`.toLowerCase().includes(searchQuery);
    });
  }
  /* Apply saved drag order only in default sort and no search */
  if(currentSort==='default'&&!searchQuery&&activeCategory!=='__favorites__'){
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
  else if(searchQuery) label.textContent=`Results for "${searchQuery}"`;
  else if(activeCategory==='all') label.textContent='All Sites';
  else{const c=allCategories.find(c=>c.id===activeCategory);label.textContent=c?`${c.icon} ${c.label}`:activeCategory}
  countEl.textContent=`${filtered.length} site${filtered.length!==1?'s':''}`;

  document.getElementById('pinnedHeader')?.remove();
  document.getElementById('dividerRow')?.remove();
  document.getElementById('loadMoreWrap')?.remove();

  /* Show drag hint only when sort=default, no search, not fav */
  const canDrag=currentSort==='default'&&!searchQuery&&activeCategory!=='__favorites__';
  if(hint)hint.classList.toggle('visible',canDrag&&filtered.length>1);

  if(filtered.length===0){
    grid.innerHTML='';grid.style.display='none';empty.style.display='block';
    document.getElementById('emptyQuery').textContent=
      activeCategory==='__favorites__'?'your favorites yet — star any card!':(searchQuery||activeCategory);
    return;
  }
  empty.style.display='none';grid.style.display='';

  const showPinned=activeCategory==='all'&&!searchQuery&&favorites.size>0&&currentSort==='default';

  if(showPinned){
    const pinned=allSites.filter(s=>favorites.has(s.url));
    const rest=filtered.filter(s=>!favorites.has(s.url));
    const hdr=document.createElement('div');
    hdr.id='pinnedHeader';hdr.className='pinned-header';
    hdr.innerHTML=`<span>★</span> Pinned Favorites <span class="pinned-header-count">${pinned.length}</span>`;
    grid.insertAdjacentElement('beforebegin',hdr);
    const slice=rest.slice(0,visibleCount);
    grid.replaceChildren(buildFrag([...pinned,{_divider:true},...slice],canDrag));
    if(visibleCount<rest.length)mkLoadMore(rest.length,rest.length-visibleCount);
  } else {
    grid.replaceChildren(buildFrag(filtered.slice(0,visibleCount),canDrag));
    if(visibleCount<filtered.length)mkLoadMore(filtered.length,filtered.length-visibleCount);
  }

  if(canDrag)initDrag(grid);
  observeFavicons(grid);
}

/* ── BUILD FRAGMENT ─────────────────────────────────────────── */
function buildFrag(sites,draggable=false){
  const frag=document.createDocumentFragment();
  sites.forEach(s=>{
    if(s._divider){
      const div=document.createElement('div');
      div.id='dividerRow';div.className='grid-divider-cell';
      div.innerHTML='<div class="grid-divider"><span>All Sites</span></div>';
      frag.appendChild(div);return;
    }
    const tmp=document.createElement('div');
    tmp.innerHTML=cardHTML(s,draggable);
    frag.appendChild(tmp.firstElementChild);
  });
  return frag;
}

function cardHTML(s,draggable=false){
  const color=s.color||'#7c5cfc';
  const isFav=favorites.has(s.url);
  const tagHTML=(s.tags||[]).map(t=>{
    const bg=(s.tag_colors||{})[t]||'#6b7280';
    return `<span class="tag" style="--tag-bg:${esc(bg)}">${esc(t)}</span>`;
  }).join('');
  const imgSrc=fav(s.url);
  const imgTag=imgSrc?`<img class="card-favicon" data-src="${esc(imgSrc)}" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=" alt="" decoding="async" onerror="this.style.display='none'" width="22" height="22">`:'';
  const dragAttr=draggable?'draggable="true"':'';
  const handleHTML=draggable?'<span class="drag-handle" aria-hidden="true">⠿</span>':'';

  return `<div class="card-wrap${isFav?' card-wrap--fav':''}" data-url="${esc(s.url)}" ${dragAttr}>
    ${handleHTML}
    <a class="card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"
       style="--card-color:${color}" aria-label="${esc(s.name)}">
      <div class="card-top">
        ${imgTag}
        <span class="card-name">${esc(s.name)}</span>
        <span class="card-arrow" aria-hidden="true">↗</span>
      </div>
      <p class="card-desc">${esc(s.description)}</p>
      <div class="card-footer">${tagHTML}</div>
      <div class="click-count" aria-label="Visit count"><span aria-hidden="true">👁</span><span class="click-count-num">${fmtCount(getCount(s.url))}</span></div>
    </a>
    <button class="fav-btn${isFav?' fav-btn--active':''}"
            onclick="toggleFav('${esc(s.url)}',event)"
            aria-label="${isFav?'Remove from':'Add to'} favorites">
      ${isFav?'★ Saved':'☆ Save'}
    </button>
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
  const badge=card.querySelector('.click-count-num');
  if(badge){
    badge.textContent=fmtCount(count);
    const wrap=card.querySelector('.click-count');
    if(wrap){wrap.classList.remove('cc-bump');void wrap.offsetWidth;wrap.classList.add('cc-bump')}
  }
});

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

init();
