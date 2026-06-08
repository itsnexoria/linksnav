/* ============================================================
   NexHub — app.js  v6
   Perf: parallel JSON fetch → DocumentFragment render → rAF stagger
   ============================================================ */
'use strict';

/* ── STATE ──────────────────────────────────────────────────── */
let allSites      = [];
let allCategories = [];
let activeCategory = 'all';
let searchQuery    = '';
let favorites      = loadFavs();
const PAGE_SIZE    = 24;
let  visibleCount  = PAGE_SIZE;

/* ── CATEGORY MANIFEST ──────────────────────────────────────── */
const CATS = [
  {id:'ai',          label:'AI',          icon:'🤖'},
  {id:'anime',       label:'Anime',        icon:'🧸'},
  {id:'business',    label:'Business',     icon:'🏢'},
  {id:'design',      label:'Design',       icon:'🎨'},
  {id:'dev-tools',   label:'Dev Tools',    icon:'🛠️'},
  {id:'downloads',   label:'Downloads',    icon:'⬇️'},
  {id:'finance',     label:'Finance',      icon:'💳'},
  {id:'gaming',      label:'Gaming',       icon:'🎮'},
  {id:'google',      label:'Google',       icon:'🔵'},
  {id:'hosting',     label:'Hosting',      icon:'☁️'},
  {id:'learning',    label:'Learning',     icon:'📚'},
  {id:'minecraft',   label:'Minecraft',    icon:'⛏️'},
  {id:'movies',      label:'Movies',       icon:'🎬'},
  {id:'music',       label:'Music',        icon:'🎵'},
  {id:'my-sites',    label:'My Sites',     icon:'🌐'},
  {id:'news',        label:'News',         icon:'📰'},
  {id:'productivity',label:'Productivity', icon:'📋'},
  {id:'security',    label:'Security',     icon:'🔒'},
  {id:'shopping',    label:'Shopping',     icon:'🛒'},
  {id:'social',      label:'Social',       icon:'📱'},
  {id:'storage',     label:'Storage',      icon:'📁'},
  {id:'streaming',   label:'Streaming',    icon:'📺'},
  {id:'tools',       label:'Tools',        icon:'⚙️'},
];

/* ── FAVOURITES (localStorage) ──────────────────────────────── */
function loadFavs(){
  try{return new Set(JSON.parse(localStorage.getItem('nexhub_favs')||'[]'))}
  catch{return new Set()}
}
function saveFavs(){ localStorage.setItem('nexhub_favs',JSON.stringify([...favorites])) }
function toggleFav(url,e){
  e.preventDefault();e.stopPropagation();
  favorites.has(url)?favorites.delete(url):favorites.add(url);
  saveFavs();
  /* micro-bounce on card wrap */
  const wrap = e.currentTarget.closest('.card-wrap');
  if(wrap){ wrap.style.transform='scale(1.04)'; setTimeout(()=>wrap.style.transform='',150) }
  render();
}

/* ── BOOT ───────────────────────────────────────────────────── */
async function init(){
  /* Fire ALL fetches at once — zero sequential waterfall */
  const settled = await Promise.allSettled(
    CATS.map(cat =>
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

/* Rolling count animation */
function rollCount(from,to){
  const el = document.getElementById('siteCount');
  if(!el)return;
  const dur=900, t0=performance.now();
  const tick=now=>{
    const p=Math.min((now-t0)/dur,1);
    const e=1-Math.pow(1-p,3);
    el.textContent=`${Math.round(from+(to-from)*e)} sites`;
    if(p<1){requestAnimationFrame(tick)}
    else{
      el.textContent=`${to} sites`;
      el.classList.add('updated');
      setTimeout(()=>el.classList.remove('updated'),1200);
    }
  };
  requestAnimationFrame(tick);
}

/* ── CATEGORY NAV ───────────────────────────────────────────── */
function buildNav(){
  const inner = document.getElementById('catNavInner');

  /* Favourites pill — insert after "All" */
  const favBtn = mkBtn('cat-btn cat-btn-fav','__favorites__','★ Favorites');
  inner.querySelector('[data-cat="all"]').insertAdjacentElement('afterend',favBtn);

  /* One DocumentFragment so we do a single DOM insertion */
  const frag = document.createDocumentFragment();
  allCategories.forEach(cat=>{
    frag.appendChild(mkBtn('cat-btn',cat.id,`${cat.icon} ${cat.label}`));
  });
  inner.appendChild(frag);
}

function mkBtn(cls,catId,label){
  const b = document.createElement('button');
  b.className=cls; b.dataset.cat=catId;
  b.setAttribute('role','tab');
  b.setAttribute('aria-selected','false');
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
  document.querySelectorAll('.cat-btn').forEach(b=>{
    b.classList.remove('active');b.setAttribute('aria-selected','false');
  });
  btn.classList.add('active');btn.setAttribute('aria-selected','true');
}

/* all-btn wired in HTML; re-wire here so it uses switchCat */
document.querySelector('.cat-btn[data-cat="all"]').addEventListener('click',function(){switchCat('all',this)});

/* ── SCROLL ARROWS ──────────────────────────────────────────── */
function setupScrollArrows(){
  const inner=document.getElementById('catNavInner');
  const nav  =document.getElementById('catNav');
  const L    =document.getElementById('scrollLeft');
  const R    =document.getElementById('scrollRight');
  const STEP =240;
  function sync(){
    const atS=inner.scrollLeft<=2;
    const atE=inner.scrollLeft+inner.clientWidth>=inner.scrollWidth-2;
    L.disabled=atS;R.disabled=atE;
    nav.classList.toggle('at-start',atS);nav.classList.toggle('at-end',atE);
  }
  L.addEventListener('click',()=>inner.scrollBy({left:-STEP,behavior:'smooth'}));
  R.addEventListener('click',()=>inner.scrollBy({left: STEP,behavior:'smooth'}));
  inner.addEventListener('scroll',sync,{passive:true});
  sync();
}

/* ── SEARCH ─────────────────────────────────────────────────── */
function setupSearch(){
  const inp = document.getElementById('searchInput');
  let t;
  inp.addEventListener('input',()=>{
    clearTimeout(t);
    t=setTimeout(()=>{
      searchQuery=inp.value.toLowerCase().trim();
      visibleCount=PAGE_SIZE;
      if(searchQuery){
        activeCategory='all';
        const all=document.querySelector('.cat-btn[data-cat="all"]');
        setActive(all);
      }
      render();
    },130);
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();inp.focus();inp.select()}
    if(e.key==='Escape'&&document.activeElement===inp){
      inp.blur();inp.value='';searchQuery='';visibleCount=PAGE_SIZE;render();
    }
  });
}

/* ── FILTER ─────────────────────────────────────────────────── */
function getFiltered(){
  if(activeCategory==='__favorites__') return allSites.filter(s=>favorites.has(s.url));
  return allSites.filter(s=>{
    if(activeCategory!=='all'&&s.category!==activeCategory)return false;
    if(!searchQuery)return true;
    return `${s.name} ${s.description} ${s.category} ${(s.tags||[]).join(' ')}`.toLowerCase().includes(searchQuery);
  });
}

/* ── FAVICON ────────────────────────────────────────────────── */
function fav(url){
  try{const {hostname}=new URL(url);return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
  catch{return ''}
}

/* ── RENDER ─────────────────────────────────────────────────── */
function render(){
  const filtered = getFiltered();
  const label    = document.getElementById('sectionLabel');
  const countEl  = document.getElementById('siteCount');
  const grid     = document.getElementById('cardsGrid');
  const empty    = document.getElementById('emptyState');

  /* Section label */
  if(activeCategory==='__favorites__')     label.textContent='★ Favorites';
  else if(searchQuery)                     label.textContent=`Results for "${searchQuery}"`;
  else if(activeCategory==='all')          label.textContent='All Sites';
  else{
    const c=allCategories.find(c=>c.id===activeCategory);
    label.textContent=c?`${c.icon} ${c.label}`:activeCategory;
  }
  countEl.textContent=`${filtered.length} site${filtered.length!==1?'s':''}`;

  /* Clean up extras */
  document.getElementById('pinnedHeader')?.remove();
  document.getElementById('dividerRow')?.remove();
  document.getElementById('loadMoreWrap')?.remove();

  if(filtered.length===0){
    grid.innerHTML='';grid.style.display='none';empty.style.display='block';
    document.getElementById('emptyQuery').textContent=
      activeCategory==='__favorites__'?'your favorites yet — star any card!':(searchQuery||activeCategory);
    return;
  }
  empty.style.display='none';grid.style.display='';

  const showPinned = activeCategory==='all'&&!searchQuery&&favorites.size>0;

  if(showPinned){
    const pinned = allSites.filter(s=>favorites.has(s.url));
    const rest   = filtered.filter(s=>!favorites.has(s.url));
    /* Pinned header */
    const hdr=document.createElement('div');
    hdr.id='pinnedHeader';hdr.className='pinned-header';
    hdr.innerHTML=`<span>★</span> Pinned Favorites <span class="pinned-header-count">${pinned.length}</span>`;
    grid.insertAdjacentElement('beforebegin',hdr);

    const slice = rest.slice(0,visibleCount);
    const frag  = buildFrag([...pinned,{_divider:true},...slice]);
    grid.replaceChildren(frag);
    if(visibleCount<rest.length)mkLoadMore(rest.length,rest.length-visibleCount);
  } else {
    grid.replaceChildren(buildFrag(filtered.slice(0,visibleCount)));
    if(visibleCount<filtered.length)mkLoadMore(filtered.length,filtered.length-visibleCount);
  }
}

/* Build a DocumentFragment from site array (fast, single reflow) */
function buildFrag(sites){
  const frag = document.createDocumentFragment();
  sites.forEach(s=>{
    if(s._divider){
      const div=document.createElement('div');
      div.id='dividerRow';div.className='grid-divider-cell';
      div.innerHTML='<div class="grid-divider"><span>All Sites</span></div>';
      frag.appendChild(div);
      return;
    }
    const tmp=document.createElement('div');
    tmp.innerHTML=cardHTML(s);
    frag.appendChild(tmp.firstElementChild);
  });
  return frag;
}

function cardHTML(s){
  const color    = s.color||'#7c5cfc';
  const isFav    = favorites.has(s.url);
  const tagHTML  = (s.tags||[]).map(t=>{
    const bg=(s.tag_colors||{})[t]||'#6b7280';
    return `<span class="tag" style="--tag-bg:${esc(bg)}">${esc(t)}</span>`;
  }).join('');
  const imgSrc = fav(s.url);
  const imgTag = imgSrc?`<img class="card-favicon" src="${esc(imgSrc)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'" width="22" height="22">`:'';

  return `<div class="card-wrap${isFav?' card-wrap--fav':''}">
    <a class="card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"
       style="--card-color:${color}" aria-label="${esc(s.name)}">
      <div class="card-top">
        ${imgTag}
        <span class="card-name">${esc(s.name)}</span>
        <span class="card-arrow" aria-hidden="true">↗</span>
      </div>
      <p class="card-desc">${esc(s.description)}</p>
      <div class="card-footer">${tagHTML}</div>
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

/* ── UTIL ───────────────────────────────────────────────────── */
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
