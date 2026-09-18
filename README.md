# Kitanelle Coccinelle – Website

Static copy of www.kitanelle-coccinelle.de, captured from the former Wix site and hosted on GitHub Pages.

- `index.html`, `<page>/index.html` – desktop pages; `m/…` – mobile layout (a tiny script redirects by viewport width); `fr/…` – French pages.
- `assets/` – images, fonts and the captured Wix CSS; `assets/site.css` + `assets/site.js` – our additions (font aliases, parallax, menus).
- `tools/capture.mjs` – re-captures pages from the live Wix site; `tools/diff.mjs` – pixel-compares live vs local; `tools/build.mjs` – builds `dist/` for deployment.

Deployment: every push to `main` runs `.github/workflows/pages.yml`. Add a `CNAME` file containing `www.kitanelle-coccinelle.de` to go live on the domain.
