/* nexo-prefs.js — applies saved user preferences on every page.
   Runs synchronously in <head> so there's no flash of unstyled content. */
(function(){
  try{
    var t = localStorage.getItem('nexhub_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);

    var p = JSON.parse(localStorage.getItem('nexhub_prefs') || '{}');
    if(p.accent){
      var r = document.documentElement.style;
      r.setProperty('--accent', p.accent);
      r.setProperty('--accent2', p.accent2 || p.accent);
      r.setProperty('--accent-dim', p.accent + '22');
      r.setProperty('--accent-hover', p.accent);
    }
    if(p.compact) document.documentElement.classList.add('compact-cards');
    if(p.animations === false) document.documentElement.classList.add('no-animations');
  }catch(e){}
})();
