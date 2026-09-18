// Capture the live Wix site as static HTML with all assets localised.
// Usage: node tools/capture.mjs [page ...]   (default: all pages, desktop + mobile)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ORIGIN = 'https://www.kitanelle-coccinelle.de';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DE_PAGES = ['', 'unser-ansatz', 'gruppen', 'about-3', 'über-uns', 'anmeldung', 'jobs', 'kontakt', 'sponsoren', 'impressum'];
export const PAGES = [...DE_PAGES, ...DE_PAGES.map(p => p ? 'fr/' + p : 'fr')];
const MOBILE_BREAKPOINT = 767;
const GOOGLE_FORM_URL = ''; // e.g. https://docs.google.com/forms/d/e/.../viewform?embedded=true

// Commercial fonts Wix licenses on the site's behalf. Not copied; aliased in assets/site.css.
const LICENSED_FONT_RE = /brandon|futura|avenir|din-next|helvetica|proxima|gotham|frutiger/i;

const only = process.argv.slice(2);
const pages = only.length ? only.map(p => (p === 'home' ? '' : p)) : PAGES;

const assetsDir = path.join(ROOT, 'assets');
const manifestPath = path.join(ROOT, 'tools', 'out', 'assets.json');
fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

function extFor(url, contentType) {
  const m = url.match(/\.(woff2|woff|ttf|otf|png|jpe?g|gif|svg|webp|avif|css|ico)(?:$|[?/])/i);
  if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
  const ct = (contentType || '').split(';')[0];
  return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif',
    'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'text/css': 'css', 'image/x-icon': 'ico' }[ct] || 'bin';
}

function localise(url, buf, contentType) {
  if (manifest[url]) return manifest[url];
  const ext = extFor(url, contentType);
  const sub = /woff|ttf|otf/.test(ext) ? 'fonts' : ext === 'css' ? 'css' : 'media';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  let base = decodeURIComponent(url.split('?')[0].split('/').filter(Boolean).pop() || 'asset').replace(/[^\w.-]+/g, '_').replace(/\.[^.]+$/, '').slice(0, 40);
  const rel = `/assets/${sub}/${base}-${hash}.${ext}`;
  fs.mkdirSync(path.join(assetsDir, sub), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel.slice(1)), buf);
  manifest[url] = rel;
  return rel;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function capture(browser, slug, mobile) {
  const url = `${ORIGIN}/${slug}`;
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const captured = new Map(); // url -> {buf, ct}
  page.on('response', async (r) => {
    const t = r.request().resourceType();
    if (!['stylesheet', 'font', 'image', 'media'].includes(t)) return;
    if (r.status() !== 200) return;
    try { captured.set(r.url(), { buf: await r.body(), ct: r.headers()['content-type'] || '' }); } catch {}
  });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(3000);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 900; y += 250) { await page.mouse.wheel(0, 250); await page.waitForTimeout(60); }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);

  const html = await page.evaluate(() => {
    // 1. pin images to what the browser actually chose
    document.querySelectorAll('img').forEach(img => { if (img.currentSrc) { img.setAttribute('src', img.currentSrc); img.removeAttribute('srcset'); img.removeAttribute('sizes'); } });
    document.querySelectorAll('picture source').forEach(s => s.remove());
    // 2. tag scroll-driven (parallax) animations
    document.getAnimations().forEach(a => {
      const t = a.effect?.target; if (!t) return;
      if (a.timeline && a.timeline.constructor.name === 'ViewTimeline') {
        const kf = a.effect.getKeyframes().map(k => k.transform).filter(Boolean);
        t.setAttribute('data-parallax', JSON.stringify(kf));
      }
    });
    // 3. remove scripts and loader hints
    const d = document.cloneNode(true);
    d.querySelectorAll('script, noscript, link[rel="preload"], link[rel="modulepreload"], link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="prefetch"], link[rel="stylesheet"][href*="siteassets"]').forEach(e => e.remove());
    d.querySelectorAll('meta[http-equiv="X-Wix-Meta-Site-Id"], meta[http-equiv="X-Wix-Published-Version"], meta[http-equiv="X-Wix-Application-Instance-Id"], meta[http-equiv="etag"]').forEach(e => e.remove());
    return '<!DOCTYPE html>' + d.documentElement.outerHTML;
  });
  const title = await page.title();
  await ctx.close();

  // --- localise assets ---
  let out = html;
  const fontDrops = [];
  for (const [u, { buf, ct }] of captured) {
    const isFont = /font/.test(ct) || /\.(woff2?|ttf|otf)(\?|$)/i.test(u);
    if (isFont && LICENSED_FONT_RE.test(u)) { fontDrops.push(u); continue; }
    if (/wix\.com|frog\.wix|panorama|sentry/.test(u) && !/wixstatic|parastorage/.test(u)) continue;
    const rel = localise(u, buf, ct);
    const noProto = u.replace(/^https?:/, '');
    for (const variant of [u, noProto, u.replace(/&/g, '&amp;'), noProto.replace(/&/g, '&amp;'), u.replace(/%7E/gi, '~'), u.replace(/~/g, '%7E')]) out = out.split(variant).join(rel);
  }
  // any remaining Wix media URL in the HTML that was not fetched (e.g. favicon variants): fetch now
  const leftovers = [...new Set(out.match(/https:\/\/static\.wixstatic\.com\/media\/[^"' )]+/g) || [])];
  for (const u of leftovers) {
    const clean = u.replace(/&amp;/g, '&');
    try { const r = await fetch(clean, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) { const rel = localise(clean, Buffer.from(await r.arrayBuffer()), r.headers.get('content-type')); out = out.split(u).join(rel); } } catch {}
  }
  // strip inline-style provenance attributes and sourcemap comments (metadata only, no requests)
  out = out.replace(/ data-(?:href|url)="https:\/\/static\.parastorage\.com[^"]*"/g, '').replace(/\/\*# sourceMappingURL=[^*]*\*\//g, '');
  // drop @font-face blocks that still point at Wix (licensed fonts, or unused weights); site.css aliases the licensed families
  out = out.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
    if (!/parastorage/.test(block)) return block;
    // keep only src entries that were localised; drop the block if none remain
    const fixed = block.replace(/src:\s*([^;}]+)/g, (m, list) => {
      const kept = list.split(',').map(x => x.trim()).filter(x => !/parastorage/.test(x));
      return kept.length ? 'src:' + kept.join(',') : '';
    }).replace(/;;+/g, ';');
    return /src:/.test(fixed) ? fixed : '';
  });

  // --- Anmeldung: replace the Wix form with an embedded Google Form (placeholder until the link exists) ---
  if (/(^|\/)anmeldung$/.test(slug)) {
    out = out.replace(/<form\b[^>]*class="[^"]*wixui-form[^"]*"[^>]*>[\s\S]*?<\/form>/, () => GOOGLE_FORM_URL
      ? `<iframe id="kn-google-form" src="${GOOGLE_FORM_URL}" title="Anmeldeformular" style="width:100%;height:${mobile ? 2600 : 2200}px;border:0" loading="lazy">Wird geladen…</iframe>`
      : `<div id="kn-google-form" style="padding:40px 24px;font-family:brandon-grot-w01-light,sans-serif;font-size:18px;line-height:1.6;text-align:center;border:1px solid #ddd">Das Anmeldeformular wird gerade umgezogen. Bitte schreibt uns in der Zwischenzeit an die im Impressum genannte E-Mail-Adresse.</div>`);
  }

  // --- rewrite internal links ---
  const prefix = mobile ? '/m' : '';
  out = out.replace(new RegExp(`(href|content|action)="${esc(ORIGIN)}(/[^"#?]*)?([^"]*)"`, 'g'), (m, attr, p, rest) => {
    if (attr === 'content') return m; // og:url etc. keep absolute
    const pth = (p || '/').replace(/\/$/, '') || '/';
    return `${attr}="${prefix}${pth === '/' ? (mobile ? '/' : '/') : pth + '/'}${rest}"`;
  });
  out = out.replace(/href="\/m\/\/"/g, 'href="/m/"');
  out = out.replace(/(<link rel="alternate"[^>]*hreflang=[^>]*href=")\/m\//g, '$1/').replace(/(<link rel="alternate"[^>]*href=")\/m\/([^"]*"[^>]*hreflang)/g, '$1/$2');
  // canonical / alternate
  const desktopPath = slug ? `/${slug}/` : '/';
  out = out.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${ORIGIN}${desktopPath}">`);
  const head = [
    `<meta name="generator" content="kitanelle static snapshot ${new Date().toISOString().slice(0, 10)}">`,
    `<script>(function(){var m=location.pathname.indexOf('/m/')===0;var w=window.innerWidth<=${MOBILE_BREAKPOINT};if(w&&!m)location.replace('/m'+location.pathname+location.search+location.hash);else if(!w&&m)location.replace(location.pathname.slice(2)+location.search+location.hash);})();</script>`,
    mobile ? '' : `<link rel="alternate" media="only screen and (max-width: ${MOBILE_BREAKPOINT}px)" href="/m${desktopPath}">`,
    `<link rel="stylesheet" href="/assets/site.css">`,
    `<script src="/assets/site.js" defer></script>`,
  ].filter(Boolean).join('\n');
  out = out.replace('</head>', head + '\n</head>');

  const dir = path.join(ROOT, mobile ? 'm' : '', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), out);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  return { slug: slug || 'home', mobile, title, assets: captured.size, droppedFonts: fontDrops.length, bytes: out.length };
}

if (process.argv[1] && process.argv[1].endsWith('capture.mjs')) {
const browser = await chromium.launch();
for (const slug of pages) {
  for (const mobile of [false, true]) {
    const r = await capture(browser, slug, mobile);
    console.log(JSON.stringify(r));
  }
}
await browser.close();
}
