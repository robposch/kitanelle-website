// Collect every slide of every Wix slide-show gallery by driving the live site (Wix renders slides on
// demand, so the captured HTML only holds 3-4 of them), download the images, and inject the slide data
// into the captured pages as <script type="application/json" id="kn-galleries">. assets/site.js renders
// the carousel + lightbox from that data.
// Usage: node tools/galleries.mjs            (run after capture.mjs)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ORIGIN = 'https://www.kitanelle-coccinelle.de';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(ROOT, 'tools', 'out', 'assets.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

// find captured pages that contain a slide-show gallery
function* walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!['node_modules', 'dist', 'tools', 'docs', '.git', '.github', 'export', 'assets'].includes(e.name)) yield* walk(p); } else if (e.name === 'index.html') yield p; } }
const targets = [...walk(ROOT)].filter(f => fs.readFileSync(f, 'utf8').includes('data-testid="slide-show-gallery"'));

async function download(url) {
  if (manifest[url]) return manifest[url];
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = (r.headers.get('content-type') || '').includes('png') ? 'png' : (r.headers.get('content-type') || '').includes('webp') ? 'webp' : (r.headers.get('content-type') || '').includes('avif') ? 'avif' : 'jpg';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
  const base = decodeURIComponent(url.split('/media/')[1]?.split('/')[0] || 'img').replace(/[^\w.-]+/g, '_').replace(/\.[^.]+$/, '').slice(0, 40);
  const rel = `/assets/media/${base}-${hash}.${ext}`;
  fs.writeFileSync(path.join(ROOT, rel.slice(1)), buf); manifest[url] = rel; return rel;
}

async function collect(browser, file) {
  const rel = path.relative(ROOT, path.dirname(file)); // e.g. '', 'gruppen', 'm/gruppen', 'm/fr/gruppen'
  const mobile = rel === 'm' || rel.startsWith('m/');
  const slug = rel.replace(/^m\/?/, '');
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/${slug}`, { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(3000);
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid="slide-show-gallery"]')].map(g => g.id));
  const data = {};
  for (const id of ids) {
    await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center' }), id); await page.waitForTimeout(600);
    const items = []; const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const cur = await page.evaluate(id => {
        const g = document.getElementById(id); const it = g.querySelector('[data-testid="gallery-item-item"]') || [...g.querySelectorAll('.wixui-gallery__item')].find(e => getComputedStyle(e).visibility === 'visible');
        if (!it) return null;
        const wi = it.querySelector('wow-image'); const info = wi ? JSON.parse(wi.getAttribute('data-image-info') || '{}') : {}; const img = it.querySelector('img');
        return { uri: info.imageData?.uri, w: info.imageData?.width, h: info.imageData?.height, src: img ? (img.currentSrc || img.src) : null, alt: img?.alt || '', title: it.querySelector('[data-testid="gallery-item-title"]')?.textContent.trim() || '', desc: it.querySelector('[data-testid="gallery-item-description"]')?.textContent.trim() || '', counter: g.querySelector('[data-testid="gallery-counter"]')?.textContent.trim() || '' };
      }, id);
      if (!cur || !cur.uri) break;
      const total = +(cur.counter.split('/')[1] || 0);
      const pos = +(cur.counter.split('/')[0] || 0);
      if (items.length && pos === items[items.length - 1].pos) { // slide did not advance yet: wait and retry (up to 3x)
        if ((cur.retry = (items[items.length - 1].retry || 0) + 1) > 3) break; items[items.length - 1].retry = cur.retry; await page.waitForTimeout(1500); continue; }
      cur.pos = pos; items.push(cur);
      if (total && items.length >= total) break;
      if (!total && seen.has(cur.uri)) { items.pop(); break; } seen.add(cur.uri);
      await page.click(`#${id} [data-testid="gallery-nextButton"]`, { force: true }); await page.waitForTimeout(1500);
    }
    // localise images: the rendered thumbnail and a large version for the lightbox
    for (const it of items) {
      it.thumb = await download(it.src);
      it.zoom = await download(`https://static.wixstatic.com/media/${it.uri}/v1/fit/w_1600,h_1600,q_85/${it.uri}`);
      delete it.src; delete it.counter; delete it.pos; delete it.retry;
    }
    data[id] = items;
    console.log(`${rel || 'home'} ${id}: ${items.length} slides`);
  }
  await ctx.close();
  // inject
  let html = fs.readFileSync(file, 'utf8').replace(/<script type="application\/json" id="kn-galleries">[\s\S]*?<\/script>\n?/, '');
  html = html.replace('</head>', `<script type="application/json" id="kn-galleries">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n</head>`);
  fs.writeFileSync(file, html);
}

const browser = await chromium.launch();
for (const f of targets) await collect(browser, f);
await browser.close();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log('done:', targets.map(f => path.relative(ROOT, f)).join(', '));
