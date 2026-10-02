(function(){
  var KEY='nexhub_tools_recent',MAX=6,path=location.pathname.replace(/index\.html$/,'');
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return[]}}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  var m=path.match(/^\/tools\/([^\/]+)\/$/);
  if(m){
    var ic=document.querySelector('.tools-hero-icon [data-lucide]');
    var item={p:path,n:document.title.split(/\s[—-]\s/)[0].trim(),i:(ic&&ic.getAttribute('data-lucide'))||'wrench'};
    try{var l=load().filter(function(x){return x.p!==path});l.unshift(item);localStorage.setItem(KEY,JSON.stringify(l.slice(0,MAX)))}catch(e){}
  } else if(path==='/tools/'){
    var box=document.getElementById('recentTools'),list=load();
    if(!box||!list.length)return;
    box.innerHTML='<h2 style="font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 12px">Recently used</h2>'+
      '<div class="tools-hub-grid" style="margin-bottom:28px">'+list.map(function(x){
        return '<a href="'+esc(x.p)+'" class="tools-hub-card"><span class="thc-icon"><i data-lucide="'+esc(x.i)+'" class="lucide-ico" aria-hidden="true"></i></span><h2>'+esc(x.n)+'</h2></a>'}).join('')+'</div>';
    function icons(){if(window.lucide)lucide.createIcons()}
    icons();window.addEventListener('load',icons);
  }
})();
