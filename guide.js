/* guide.js — sitewide "How Nexo Hub works" guide.
   Auto-opens on a visitor's first visit to the site, and can be reopened
   any time by pressing G (or tapping the floating guide button).
   Loaded on every page — self-contained, no dependency on app.js. */
(function () {
  var SEEN_KEY = 'nexhub_guide_seen';

  var SECTIONS = [
    {
      icon: 'compass',
      title: 'What is Nexo Hub?',
      body: 'A hand-curated directory of 677+ genuinely useful websites across 42 categories — plus 44 free browser-based tools. No sign-up, no clutter, no dead links (we check).'
    },
    {
      icon: 'search',
      title: 'Find something fast',
      body: 'Start typing to search, or press <kbd>Ctrl</kbd><span class="guide-plus">+</span><kbd>K</kbd> to jump straight into the search box. Use the category tabs — or <kbd>[</kbd> / <kbd>]</kbd> — to browse by topic.'
    },
    {
      icon: 'heart',
      title: 'Save your favourites',
      body: 'Click the heart on any site card to save it. Press <kbd>F</kbd> anytime to jump to your Favourites tab.'
    },
    {
      icon: 'dices',
      title: 'Feeling lucky?',
      body: 'Press <kbd>R</kbd> or hit the dice icon in the search bar to open a random site from the directory.'
    },
    {
      icon: 'wrench',
      title: 'Free Web Tools',
      body: 'Head to <strong>Tools</strong> for 44 free utilities — QR codes, password generators, JSON formatters, converters and more. All run instantly in your browser.'
    },
    {
      icon: 'plus-circle',
      title: 'Know a site that belongs here?',
      body: 'Hit <strong>Submit</strong> in the header to suggest a site. Every submission is reviewed by hand before it goes live.'
    },
    {
      icon: 'sliders-horizontal',
      title: 'Make it yours',
      body: 'Open <strong>Settings</strong> to switch themes, pick an accent colour, and tweak how site cards look.'
    }
  ];

  function isTyping() {
    var el = document.activeElement;
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function refreshIcons() {
    if (window.lucide) { try { window.lucide.createIcons(); } catch (e) {} }
  }

  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  }

  function hasSeen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return true; }
  }

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.id = 'guideModal';
    overlay.className = 'guide-overlay';
    overlay.innerHTML =
      '<div class="guide-modal" role="dialog" aria-modal="true" aria-label="Nexo Hub guide">' +
        '<div class="guide-header">' +
          '<span class="guide-title"><i data-lucide="compass" class="lucide-ico" aria-hidden="true"></i> Welcome to Nexo Hub</span>' +
          '<button class="guide-close" id="guideCloseBtn" aria-label="Close guide"><i data-lucide="x" class="lucide-ico" aria-hidden="true"></i></button>' +
        '</div>' +
        '<div class="guide-body">' +
          SECTIONS.map(function (s) {
            return '<div class="guide-row">' +
              '<span class="guide-row-icon"><i data-lucide="' + s.icon + '" class="lucide-ico" aria-hidden="true"></i></span>' +
              '<div class="guide-row-text"><div class="guide-row-title">' + s.title + '</div><p class="guide-row-desc">' + s.body + '</p></div>' +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="guide-footer">Press <kbd>G</kbd> anytime to reopen this guide &middot; <kbd>Esc</kbd> to close</div>' +
      '</div>';
    document.body.appendChild(overlay);
    refreshIcons();
    requestAnimationFrame(function () { overlay.classList.add('show'); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeGuideModal();
    });
    document.getElementById('guideCloseBtn').addEventListener('click', closeGuideModal);
  }

  function openGuideModal() {
    if (document.getElementById('guideModal')) return;
    buildModal();
    markSeen();
  }
  function closeGuideModal() {
    var m = document.getElementById('guideModal');
    if (!m) return;
    m.classList.remove('show');
    setTimeout(function () { m.remove(); }, 200);
  }
  window.openGuideModal = openGuideModal;
  window.closeGuideModal = closeGuideModal;

  var NETWORK_LINKS = [
    { icon: 'globe', label: 'Nexo Realm', desc: 'The main Nexo network hub', href: 'https://nexorealm.org' },
    { icon: 'rocket', label: 'Nexo Boost', desc: 'Boost & growth tools', href: 'https://boost.nexorealm.org' },
    { icon: 'layout-grid', label: 'NexoSites', desc: 'Where Nexo Hub lives', href: 'https://nexosites.xyz' },
    { icon: 'clapperboard', label: 'Watch Log', desc: 'Track what you watch', href: 'https://list.nexosites.xyz' }
  ];
  var DISCORD_LINK = { icon: 'message-square', label: 'Join our Discord', desc: 'Chat with the community', href: 'https://discord.gg/NTFhj44pXR' };

  function fabEnabled() {
    try {
      var p = JSON.parse(localStorage.getItem('nexhub_prefs') || '{}');
      return p.fabEnabled !== false;
    } catch (e) { return true; }
  }

  function closeNetworkMenu() {
    var m = document.getElementById('nexoNetworkMenu');
    var fab = document.getElementById('nexoFab');
    if (m) m.classList.remove('show');
    if (fab) { fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); }
    setTimeout(function () { if (m) m.remove(); }, 180);
    document.removeEventListener('click', onOutsideClick, true);
  }

  function onOutsideClick(e) {
    var m = document.getElementById('nexoNetworkMenu');
    var fab = document.getElementById('nexoFab');
    if (!m) return;
    if (m.contains(e.target) || (fab && fab.contains(e.target))) return;
    closeNetworkMenu();
  }

  function linkRow(item, extraClass) {
    return '<a class="nexo-menu-row' + (extraClass ? ' ' + extraClass : '') + '" href="' + item.href + '" target="_blank" rel="noopener">' +
      '<span class="nexo-menu-row-icon"><i data-lucide="' + item.icon + '" class="lucide-ico" aria-hidden="true"></i></span>' +
      '<span class="nexo-menu-row-text"><span class="nexo-menu-row-label">' + item.label + '</span><span class="nexo-menu-row-desc">' + item.desc + '</span></span>' +
      '<i data-lucide="arrow-up-right" class="lucide-ico nexo-menu-row-go" aria-hidden="true"></i>' +
    '</a>';
  }

  function openNetworkMenu() {
    if (document.getElementById('nexoNetworkMenu')) return;
    var menu = document.createElement('div');
    menu.id = 'nexoNetworkMenu';
    menu.className = 'nexo-network-menu';
    menu.innerHTML =
      '<div class="nexo-menu-title">Nexo Network</div>' +
      '<button class="nexo-menu-row nexo-menu-guide" id="nexoMenuGuideBtn" type="button">' +
        '<span class="nexo-menu-row-icon"><i data-lucide="compass" class="lucide-ico" aria-hidden="true"></i></span>' +
        '<span class="nexo-menu-row-text"><span class="nexo-menu-row-label">Site Guide</span><span class="nexo-menu-row-desc">How Nexo Hub works</span></span>' +
      '</button>' +
      '<div class="nexo-menu-divider"></div>' +
      NETWORK_LINKS.map(function (i) { return linkRow(i); }).join('') +
      '<div class="nexo-menu-divider"></div>' +
      linkRow(DISCORD_LINK, 'nexo-menu-discord');
    document.body.appendChild(menu);
    refreshIcons();
    requestAnimationFrame(function () { menu.classList.add('show'); });

    document.getElementById('nexoMenuGuideBtn').addEventListener('click', function () {
      closeNetworkMenu();
      openGuideModal();
    });
    setTimeout(function () { document.addEventListener('click', onOutsideClick, true); }, 0);

    var fab = document.getElementById('nexoFab');
    if (fab) { fab.classList.add('open'); fab.setAttribute('aria-expanded', 'true'); }
  }

  function toggleNetworkMenu() {
    if (document.getElementById('nexoNetworkMenu')) closeNetworkMenu();
    else openNetworkMenu();
  }

  function buildFab() {
    if (document.getElementById('nexoFab')) return;
    if (!fabEnabled()) return;
    var btn = document.createElement('button');
    btn.id = 'nexoFab';
    btn.className = 'guide-fab';
    btn.setAttribute('aria-label', 'Nexo network');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('title', 'Nexo Network');
    btn.innerHTML = '<i data-lucide="boxes" class="lucide-ico" aria-hidden="true"></i>';
    btn.addEventListener('click', toggleNetworkMenu);
    document.body.appendChild(btn);
    refreshIcons();
  }

  function removeFab() {
    var fab = document.getElementById('nexoFab');
    if (fab) fab.remove();
    closeNetworkMenu();
  }

  window.nexoSetFabEnabled = function (val) {
    if (val) buildFab(); else removeFab();
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.getElementById('nexoNetworkMenu')) { closeNetworkMenu(); return; }
      if (document.getElementById('guideModal')) { closeGuideModal(); return; }
    }
    if ((e.key === 'g' || e.key === 'G') && !isTyping() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openGuideModal();
    }
  });

  function init() {
    buildFab();
    if (!hasSeen()) {
      setTimeout(openGuideModal, 700);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
