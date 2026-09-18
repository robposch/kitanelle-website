// Pixel-compare live Wix pages against the local static copy.
// Usage: node tools/diff.mjs [page ...]   (serves ./ on :8080 itself)
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { PAGES } from './capture.mjs';

const ORIGIN = 'https://www.kitanelle-coccinelle.de';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'tools', 'out', 'diff');
const PORT = +process.env.PORT || 8080;
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const pages = only.length ? only.map(p => (p === 'home' ? '' : p)) : PAGES;

// minimal static server (folder/index.html, decodes %C3%BC etc.)
const MIME = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', gif: 'image/gif', ico: 'image/x-icon' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(ROOT, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[f.split('.').pop()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

async function shot(browser, url, file, mobile) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 100)));
  page.on('requestfailed', r => { if (!/wix\.com|sentry|panorama/.test(r.url())) errors.push('FAILED ' + r.url().slice(0, 100)); });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(2500);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 900; y += 250) { await page.mouse.wheel(0, 250); await page.waitForTimeout(40); }
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  await ctx.close();
  return errors;
}

function diff(a, b, out) {
  const i1 = PNG.sync.read(fs.readFileSync(a)), i2 = PNG.sync.read(fs.readFileSync(b));
  const w = Math.min(i1.width, i2.width), h = Math.min(i1.height, i2.height);
  const crop = img => { const o = new PNG({ width: w, height: h }); PNG.bitblt(img, o, 0, 0, w, h, 0, 0); return o; };
  const d = new PNG({ width: w, height: h });
  const n = pixelmatch(crop(i1).data, crop(i2).data, d.data, w, h, { threshold: 0.12 });
  fs.writeFileSync(out, PNG.sync.write(d));
  return { pct: +(100 * n / (w * h)).toFixed(2), liveH: i1.height, localH: i2.height };
}

const browser = await chromium.launch();
const rows = [];
for (const slug of pages) {
  for (const mobile of [false, true]) {
    const name = `${slug || 'home'}${mobile ? '-m' : ''}`;
    const live = path.join(OUT, `${name}-live.png`), local = path.join(OUT, `${name}-local.png`);
    const e1 = await shot(browser, `${ORIGIN}/${slug}`, live, mobile);
    const localUrl = `http://localhost:${PORT}${mobile ? '/m' : ''}/${slug ? slug + '/' : ''}`;
    const e2 = await shot(browser, localUrl, local, mobile);
    const r = diff(live, local, path.join(OUT, `${name}-diff.png`));
    rows.push({ page: name, ...r, localErrors: [...new Set(e2)].slice(0, 4) });
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
}
await browser.close();
server.close();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
