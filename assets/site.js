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

  // --- Slide-show galleries + lightbox (Wix rendered slides on demand; data injected by tools/galleries.mjs) ---
  var galleryData = null; try { var gd = document.getElementById('kn-galleries'); galleryData = gd && JSON.parse(gd.textContent); } catch (e) {}
  var lightbox = null;
  function openLightbox(items, index) {
    if (!lightbox) {
      lightbox = document.createElement('div'); lightbox.id = 'kn-lightbox'; lightbox.setAttribute('role', 'dialog'); lightbox.setAttribute('aria-modal', 'true');
      lightbox.innerHTML = '<div class="kn-lb-backdrop"></div><div class="kn-lb-stage"><img class="kn-lb-img" alt=""></div>' +
        '<button type="button" class="kn-lb-close" aria-label="Schließen"><svg viewBox="0 0 180 180"><path d="M5 5 L175 175 M175 5 L5 175"/></svg></button>' +
        '<button type="button" class="kn-lb-prev" aria-label="Zurück"><svg viewBox="0 0 180 310"><path d="M170 10 L10 161 M10 150 L170 300"/></svg></button>' +
        '<button type="button" class="kn-lb-next" aria-label="Weiter"><svg viewBox="0 0 180 310"><path d="M10 10 L170 161 M170 150 L10 300"/></svg></button>';
      document.body.appendChild(lightbox);
      lightbox.querySelector('.kn-lb-close').addEventListener('click', closeLightbox);
      lightbox.querySelector('.kn-lb-backdrop').addEventListener('click', closeLightbox);
      lightbox.querySelector('.kn-lb-prev').addEventListener('click', function () { stepLightbox(-1); });
      lightbox.querySelector('.kn-lb-next').addEventListener('click', function () { stepLightbox(1); });
      document.addEventListener('keydown', function (e) { if (!lightbox.classList.contains('kn-open')) return; if (e.key === 'Escape') closeLightbox(); else if (e.key === 'ArrowLeft') stepLightbox(-1); else if (e.key === 'ArrowRight') stepLightbox(1); });
      var sx = null; lightbox.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      lightbox.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) stepLightbox(dx < 0 ? 1 : -1); }, { passive: true });
    }
    lightbox.knItems = items; lightbox.knIndex = index; renderLightbox();
    lightbox.classList.add('kn-open'); document.documentElement.classList.add('kn-lightbox-open'); lightbox.querySelector('.kn-lb-close').focus();
  }
  function renderLightbox() { var it = lightbox.knItems[lightbox.knIndex]; var img = lightbox.querySelector('.kn-lb-img'); img.src = it.zoom; img.alt = it.alt || it.title || ''; lightbox.querySelector('.kn-lb-prev').style.display = lightbox.querySelector('.kn-lb-next').style.display = lightbox.knItems.length > 1 ? '' : 'none'; }
  function stepLightbox(d) { var n = lightbox.knItems.length; lightbox.knIndex = (lightbox.knIndex + d + n) % n; renderLightbox(); }
  function closeLightbox() { lightbox.classList.remove('kn-open'); document.documentElement.classList.remove('kn-lightbox-open'); }

  if (galleryData) Object.keys(galleryData).forEach(function (id) {
    var g = document.getElementById(id); var items = galleryData[id]; if (!g || !items || !items.length) return;
    var tpl = g.querySelector('[data-testid="gallery-item-item"]') || g.querySelector('.wixui-gallery__item'); if (!tpl) return;
    var track = tpl.parentElement; var counter = g.querySelector('[data-testid="gallery-counter"]');
    var slides = items.map(function (it, i) {
      var el = tpl.cloneNode(true); el.setAttribute('data-testid', 'gallery-item-item'); el.removeAttribute('data-has-transition');
      var img = el.querySelector('img'); if (img) { img.src = it.thumb; img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.removeAttribute('fetchpriority'); img.alt = it.alt || it.title || ''; }
      var wi = el.querySelector('wow-image'); if (wi) { wi.removeAttribute('data-image-info'); wi.id = 'kn-img-' + id + '-' + i; }
      var t = el.querySelector('[data-testid="gallery-item-title"]'); if (t) t.textContent = it.title || '';
      var d = el.querySelector('[data-testid="gallery-item-description"]'); if (d) d.textContent = it.desc || '';
      el.style.transition = 'opacity .45s ease'; el.style.opacity = '0'; el.style.visibility = 'hidden';
      var zone = el.querySelector('[data-testid="gallery-item-click-action-image-zoom"]') || el;
      zone.addEventListener('click', function (e) { e.preventDefault(); openLightbox(items, i); });
      zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(items, i); } });
      return el;
    });
    while (track.firstChild) track.removeChild(track.firstChild);
    slides.forEach(function (s) { track.appendChild(s); });
    var cur = 0;
    function show(i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, j) { var on = j === cur; s.style.visibility = on ? 'visible' : 'hidden'; s.style.opacity = on ? '1' : '0'; s.setAttribute('aria-hidden', on ? 'false' : 'true'); });
      if (counter) counter.textContent = (cur + 1) + '/' + slides.length;
    }
    show(0);
    var prev = g.querySelector('[data-testid="gallery-prevButton"]'), next = g.querySelector('[data-testid="gallery-nextButton"]');
    if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show(cur - 1); });
    if (next) next.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show(cur + 1); });
    var x0 = null;
    g.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    g.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) show(dx < 0 ? cur + 1 : cur - 1); }, { passive: true });
  });

  // --- Anchor links inside the page ---
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1); var t = id && document.getElementById(id);
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
