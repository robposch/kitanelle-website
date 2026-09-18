// Kitanelle static snapshot: the few behaviours Wix's runtime provided.
(function () {
  'use strict';
  var BASE = '';
  var pathNoBase = location.pathname.slice(BASE.length);
  var isMobile = /^\/m(\/|$)/.test(pathNoBase);
  var prefix = BASE + (isMobile ? '/m' : '');

  // --- Language selector (DE / FR) ---
  function goToLanguage(lang) {
    var rest = pathNoBase.replace(/^\/m(?=\/)/, '').replace(/^\/fr(?=\/|$)/, '');
    location.href = prefix + (lang === 'de' ? (rest || '/') : '/fr' + (rest === '/' ? '/' : rest || '/'));
  }
  document.querySelectorAll('[data-testid="languages-dropdown-handle"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });
  document.querySelectorAll('[role="menuitem"][data-testid^="dropdown-option-"]').forEach(function (opt) {
    opt.addEventListener('click', function () {
      goToLanguage(opt.getAttribute('data-testid').replace('dropdown-option-', ''));
    });
  });
  // Mobile: Wix overlays an invisible native <select> on the language button
  document.querySelectorAll('[data-testid="language-selector-container"] select').forEach(function (sel) {
    var current = /^\/fr(\/|$)/.test(pathNoBase.replace(/^\/m(?=\/)/, '')) ? 'fr' : 'de';
    sel.value = current;
    sel.addEventListener('change', function () { goToLanguage(sel.value); });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-testid="languages-dropdown-handle-container"]')) {
      document.querySelectorAll('[data-testid="languages-dropdown-handle"][aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    }
  });

  // --- Mobile hamburger menu (class names as Wix sets them) ---
  var toggle = document.getElementById('MENU_AS_CONTAINER_TOGGLE');
  var menu = document.getElementById('MENU_AS_CONTAINER');
  if (toggle && menu) {
    var overlay = document.getElementById('overlay-MENU_AS_CONTAINER');
    var container = document.getElementById('container-MENU_AS_CONTAINER');
    var inner = toggle.querySelector('.vlJDcR');
    var bars = toggle.querySelector('.pp3XSB');
    function setOpen(open) {
      menu.classList.toggle('I_VSKP', open);
      menu.setAttribute('data-undisplayed', open ? 'false' : 'true');
      menu.style.display = open ? 'block' : '';
      menu.style.visibility = open ? 'visible' : '';
      if (overlay) { overlay.style.opacity = open ? '1' : ''; overlay.style.visibility = open ? 'inherit' : ''; }
      if (container) container.style.visibility = open ? 'inherit' : '';
      toggle.classList.toggle('d0L2ow', open);
      if (inner) inner.classList.toggle('d0L2ow', open);
      if (bars) bars.classList.toggle('sqDofR', open);
      toggle.setAttribute('aria-label', open ? 'Navigationsmenü schließen' : 'Navigationsmenü öffnen');
      document.body.classList.toggle('siteScrollingBlockedIOSFix', open);
      document.body.classList.toggle('kn-menu-open', open);
    }
    toggle.addEventListener('click', function () { setOpen(!menu.classList.contains('I_VSKP')); });
    toggle.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.click(); } });
    menu.querySelectorAll('a[href]').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  }

  // --- Skip-to-content button (Wix bound this in JS) ---
  var skip = document.getElementById('SKIP_TO_CONTENT_BTN');
  var main = document.getElementById('PAGES_CONTAINER');
  if (skip && main) skip.addEventListener('click', function (e) { e.preventDefault(); main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); main.scrollIntoView(); });

  // --- Parallax: drive the media by its section's view timeline, as Wix did ---
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var layer = el.closest('[data-motion-part^="BG_LAYER"]'); var section = layer && layer.parentElement;
    if (section) section.setAttribute('data-parallax-section', '');
  });

  // --- Entrance animations ---
  var animated = document.querySelectorAll('[data-motion-enter]');
  if (animated.length && 'IntersectionObserver' in window) {
    animated.forEach(function (el) { if (el.getBoundingClientRect().top > window.innerHeight) el.classList.add('kn-hidden'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove('kn-hidden'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    animated.forEach(function (el) { io.observe(el); });
    // safety net: never leave content hidden (e.g. if the observer misbehaves)
    setTimeout(function () { animated.forEach(function (el) { el.classList.remove('kn-hidden'); }); }, 4000);
  }

  // --- Anchor links inside the page ---
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1); var t = id && document.getElementById(id);
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
