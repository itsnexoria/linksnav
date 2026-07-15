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
      body: 'A hand-curated directory of 620+ genuinely useful websites across 35 categories — plus 43 free browser-based tools. No sign-up, no clutter, no dead links (we check).'
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
      body: 'Head to <strong>Tools</strong> for 43 free utilities — QR codes, password generators, JSON formatters, converters and more. All run instantly in your browser.'
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

  function buildFab() {
    if (document.getElementById('guideFab')) return;
    var btn = document.createElement('button');
    btn.id = 'guideFab';
    btn.className = 'guide-fab';
    btn.setAttribute('aria-label', 'Open site guide');
    btn.setAttribute('title', 'Site guide (press G)');
    btn.innerHTML = '<i data-lucide="compass" class="lucide-ico" aria-hidden="true"></i>';
    btn.addEventListener('click', openGuideModal);
    document.body.appendChild(btn);
    refreshIcons();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('guideModal')) {
      closeGuideModal();
      return;
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
