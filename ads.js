(function () {
  var HOST = 'https://www.highrevenueformat.com/';
  var mobile = window.matchMedia('(max-width:767px)').matches;
  var FORMATS = {
    banner: mobile
      ? { key: 'f2f74bb3449e06ce018e1529d353e2ca', w: 320, h: 50 }
      : { key: 'f73d3b990bc247074d0cfc8266738ae8', w: 728, h: 90 },
    rect: { key: 'd512fec36b214a4e83f4b5622f34ca83', w: 300, h: 250 }
  };

  var css = document.createElement('style');
  css.textContent =
    '.nx-ad{margin:28px auto;text-align:center;max-width:100%;overflow:hidden}' +
    '.nx-ad small{display:block;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#8a93a8);opacity:.7;margin-bottom:6px}' +
    '.nx-ad-box{margin:0 auto;display:flex;justify-content:center;align-items:center;max-width:100%}';
  document.head.appendChild(css);

  function makeSlot(type) {
    var f = FORMATS[type];
    var el = document.createElement('aside');
    el.className = 'nx-ad';
    el.setAttribute('aria-label', 'Advertisement');
    el.innerHTML = '<small>Advertisement</small><div class="nx-ad-box" style="width:' + f.w + 'px;min-height:' + f.h + 'px"></div>';
    el._fmt = f;
    return el;
  }

  var main = document.querySelector('main');
  if (!main) return;

  var top = makeSlot('banner');
  var anchor = main.querySelector('.tool-page-layout, #cardsGrid, .cards-grid');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(top, anchor);
  else if (main.children[1]) main.insertBefore(top, main.children[1]);
  else main.appendChild(top);

  var bottom = makeSlot('rect');
  main.appendChild(bottom);

  // Ad scripts read a global atOptions, so load them one at a time.
  var queue = [], busy = false;
  function next() {
    if (busy || !queue.length) return;
    busy = true;
    var slot = queue.shift(), f = slot._fmt, box = slot.querySelector('.nx-ad-box');
    window.atOptions = { key: f.key, format: 'iframe', height: f.h, width: f.w, params: {} };
    var s = document.createElement('script');
    var done = function () {
      busy = false;
      setTimeout(function () {
        if (!box.querySelector('iframe')) slot.style.display = 'none';
      }, 4000);
      next();
    };
    s.onload = s.onerror = done;
    s.src = HOST + f.key + '/invoke.js';
    box.appendChild(s);
  }

  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); next(); }
        });
      }, { rootMargin: '300px' })
    : null;
  [top, bottom].forEach(function (s) {
    if (io) io.observe(s); else { queue.push(s); next(); }
  });
})();
