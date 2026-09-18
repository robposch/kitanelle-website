# Wix snapshot migration — design (2026-09-18)

## Goal
Replace www.kitanelle-coccinelle.de (Wix) with a free static copy that is pixel-identical
on desktop and mobile, hosted on GitHub Pages, without depending on Wix servers.
Clean rebuild and CMS come later; this is the quick replacement.

## Approach (option 1, approved)
Capture each published page in a headless browser after scrolling (so lazy images and
entrance animations are in final state), strip all scripts, download every external asset
(CSS, fonts, images) into `assets/`, rewrite URLs, and re-add the few behaviours that Wix
JavaScript provided.

## Pages
`/`, `/unser-ansatz`, `/gruppen`, `/about-3`, `/über-uns`, `/anmeldung`, `/jobs`, `/kontakt`,
`/sponsoren`, `/impressum`, `/fr`. Same paths as today (folder + index.html).

## Mobile
Wix serves a separate mobile layout by user agent. We capture it with a mobile UA and
publish it under `/m/<page>/`. A tiny inline script on every page redirects by viewport
width (desktop → /m/ when ≤ 767px, and back). Mobile pages carry `rel=canonical` to the
desktop URL.

## Behaviours re-added (small vanilla JS/CSS in `assets/site.js`, `assets/site.css`)
- language selector DE/FR (dropdown → navigates)
- mobile hamburger menu (open/close)
- parallax on Gruppen backgrounds (CSS scroll-driven animation from extracted keyframes)
- entrance fade-in for `data-motion-enter` elements (IntersectionObserver)
- Anmeldung: Wix form replaced by an embedded Google Form (placeholder until link provided)

## Fonts
Google Fonts served locally where free (Cormorant Garamond, Caudex). Commercial fonts
(Brandon Grotesque Light, Futura Light) replaced by Josefin Sans / Jost via one CSS
`@font-face` alias each; licensed files can be dropped in later.

## Verification
`tools/diff.mjs` screenshots live vs local for every page, desktop and mobile UA, and reports
pixel-difference percentage. Target: < 1 % on desktop; mobile as close as the font swap allows.

## Hosting
Public repo `robposch/kitanelle-website`, GitHub Pages from `main`, `CNAME` =
www.kitanelle-coccinelle.de. DNS switch at Squarespace Domains is a manual step by Robert;
MX records untouched. Wix stays live until compared and cancelled.

## Out of scope
CMS, form backend, French pages beyond `/fr`, SEO redirects (paths are unchanged).
