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
  // Lightbox: Wix's own ImageZoom (desktop) / TouchMediaZoom (mobile) markup and stylesheet, driven by our script
  var lightbox = null, lbItems = null, lbIndex = 0, lbCssLoaded = false;
  // Wix shows the touch lightbox on any touch device (phones and tablets), regardless of the page layout
  var isTouch = isMobile || (navigator.maxTouchPoints > 0) || ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  function ensureLightboxCss() { if (lbCssLoaded) return; lbCssLoaded = true; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + '/assets/css/wix-imagezoom.css'; document.head.appendChild(l); }
  var SVG_CLOSE = '<path d="M5 5 L175 175 M175 5 L5 175"></path>', SVG_NEXT = '<path d="M10 10 L170 161 M170 150 L10 300"></path>', SVG_PREV = '<path d="M170 10 L10 161 M10 150 L170 300"></path>';
  function buildLightbox() {
    var d = document.createElement('div'); d.id = 'imageZoomComp'; d.setAttribute('tabindex', '0'); d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('data-testid', 'root');
    if (isTouch) {
      d.className = 'imageZoomComp c8MB3Z zwdzEv';
      d.innerHTML = '<div class="UOelX6"><wow-image class="Qh0lWW"><img alt="" fetchpriority="high"></wow-image></div>' +
        '<div class="BNGB3e" data-testid="close"><svg viewBox="0 0 180 180" class="MyPUn_" tabindex="0" role="button" aria-label="close" data-testid="closeIcon">' + SVG_CLOSE + '</svg></div>' +
        '<div class="IUNMZY" data-testid="next"><svg viewBox="0 0 180 310" class="EAex_q" tabindex="0" role="button" aria-label="next" data-testid="nextIcon">' + SVG_NEXT + '</svg></div>' +
        '<div class="tVi4X8" data-testid="prev"><svg viewBox="0 0 180 310" class="EAex_q" tabindex="0" role="button" aria-label="previous" data-testid="prevIcon">' + SVG_PREV + '</svg></div>';
    } else {
      d.className = 'TqRdRn';
      d.innerHTML = '<div class="XBjG2Z"><wow-image class="Qh0lWW EpV4Qx"><img alt="" fetchpriority="high"></wow-image><div class="fIgtHO"></div></div>' +
        '<div class="y3XiZp" data-testid="close"><svg viewBox="0 0 180 180" class="lGoczQ" tabindex="0" role="button" aria-label="close" data-testid="closeIcon">' + SVG_CLOSE + '</svg></div>' +
        '<div class="D2s5n3" data-testid="next"><svg viewBox="0 0 180 310" class="_Sh7SY" tabindex="0" role="button" aria-label="next" data-testid="nextIcon">' + SVG_NEXT + '</svg></div>' +
        '<div class="lQgw3h" data-testid="prev"><svg viewBox="0 0 180 310" class="_Sh7SY" tabindex="0" role="button" aria-label="previous" data-testid="prevIcon">' + SVG_PREV + '</svg></div>';
    }
    d.querySelector('[data-testid="close"]').addEventListener('click', closeLightbox);
    d.querySelector('[data-testid="next"]').addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(1); });
    d.querySelector('[data-testid="prev"]').addEventListener('click', function (e) { e.stopPropagation(); stepLightbox(-1); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); else if (e.key === 'ArrowLeft') stepLightbox(-1); else if (e.key === 'ArrowRight') stepLightbox(1); });
    var sx = null; d.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    d.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) stepLightbox(dx < 0 ? 1 : -1); }, { passive: true });
    return d;
  }
  function sizeLightbox() {
    if (!lightbox) return; var it = lbItems[lbIndex]; var img = lightbox.querySelector('img'); var vw = window.innerWidth, vh = window.innerHeight;
    if (isTouch) { img.style.cssText = 'width:' + vw + 'px;height:' + vh + 'px;object-fit:contain;object-position:center center'; return; }
    var nw = it.w || img.naturalWidth || 4, nh = it.h || img.naturalHeight || 3; var aspect = nw / nh;
    var h = Math.min(vh - 135, nh), w = Math.round(h * aspect);
    if (w > vw - 100) { w = vw - 100; h = Math.round(w / aspect); }
    var wrap = lightbox.querySelector('.XBjG2Z');
    wrap.style.cssText = 'max-width:' + w + 'px;max-height:' + (vh - 30) + 'px;margin-top:15px;--width:' + w + 'px;--height:' + h + 'px';
    img.style.cssText = 'width:' + w + 'px;height:' + h + 'px;object-fit:contain;object-position:center center';
  }
  function renderLightbox() { var it = lbItems[lbIndex]; var img = lightbox.querySelector('img'); img.src = it.zoom; img.alt = it.alt || it.title || ''; lightbox.setAttribute('data-testselectedimageindex', lbIndex); sizeLightbox(); }
  function openLightbox(items, index) {
    ensureLightboxCss(); lbItems = items; lbIndex = index;
    if (!lightbox) { lightbox = buildLightbox(); document.body.appendChild(lightbox); }
    renderLightbox(); document.documentElement.classList.add('kn-lightbox-open'); lightbox.focus();
  }
  function stepLightbox(d) { var n = lbItems.length; lbIndex = (lbIndex + d + n) % n; renderLightbox(); }
  function closeLightbox() { if (lightbox) { lightbox.remove(); lightbox = null; } document.documentElement.classList.remove('kn-lightbox-open'); }
  window.addEventListener('resize', sizeLightbox);

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
