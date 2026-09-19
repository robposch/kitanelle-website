// Interaction diff: "test like a human" by clicking everything.
// For every page, enumerate all interactive elements on the REFERENCE (live Wix), click each one,
// record what changed (URL, DOM mutations, screenshot pixels). Then do the same on the LOCAL copy.
// Anything that changes on the reference but not on the copy is reported.
// Usage: node tools/interaction-diff.mjs [--mobile] [page ...]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { PAGES } from './capture.mjs';

const REF = 'https://www.kitanelle-coccinelle.de';
const LOCAL = process.env.LOCAL || 'https://poschenrieder.io/kitanelle-website';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'tools', 'out', 'interaction'); fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2); const mobile = args.includes('--mobile');
const pages = args.filter(a => !a.startsWith('--')).map(p => (p === 'home' ? '' : p));
const list = pages.length ? pages : PAGES;

const SELECTOR = 'a[href], button, [role="button"], [role="menuitem"], [role="tab"], [role="switch"], [role="checkbox"], input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [onclick], [data-testid*="arrow" i], [data-testid*="next" i], [data-testid*="prev" i], [data-testid*="dot" i], [class*="arrow" i], [class*="nav-dot" i], [aria-label]';

function describe(el) {
  const r = el.getBoundingClientRect();
  return { tag: el.tagName, id: el.id, testid: el.getAttribute('data-testid'), aria: el.getAttribute('aria-label'), href: el.getAttribute('href'), text: (el.innerText || '').trim().slice(0, 30), cls: el.className.toString().slice(0, 40), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height), docY: Math.round(r.top + window.scrollY) };
}

async function enumerate(page) {
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h + 900; y += 400) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(80); }
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  return page.evaluate(([sel, describeSrc]) => {
    const describe = new Function('el', describeSrc.slice(describeSrc.indexOf('{') + 1, describeSrc.lastIndexOf('}')));
    const seen = new Set(); const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('#MENU_AS_CONTAINER') && getComputedStyle(el.closest('#MENU_AS_CONTAINER')).visibility === 'hidden') continue;
      const d = describe(el); const key = [d.tag, d.id, d.testid, d.aria, d.href, d.text, d.docY].join('|'); if (seen.has(key)) continue; seen.add(key); out.push(d);
    }
    return out;
  }, [SELECTOR, describe.toString()]);
}

const BASE_RE = new RegExp('^' + LOCAL.replace(/^https?:\/\/[^/]+/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
function normHref(h) { if (!h) return ''; let x = h.replace(/^https?:\/\/[^/]+/, ''); x = x.replace(BASE_RE, ''); x = x.replace(/^\/m(?=\/|$)/, ''); try { x = decodeURIComponent(x); } catch {} return (x.replace(/\/$/, '') || '/'); }
function key(d) { return [d.tag, d.testid || '', d.aria || '', normHref(d.href), d.text].join('|'); }

async function snapshot(page) {
  const buf = await page.screenshot({ fullPage: false });
  const state = await page.evaluate(() => ({ url: location.href, scrollY: window.scrollY, html: document.body.innerHTML.length, visible: [...document.querySelectorAll('[role=dialog], [aria-modal=true]')].filter(e => getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').length }));
  return { buf, state };
}
function pixels(a, b) { const i1 = PNG.sync.read(a), i2 = PNG.sync.read(b); const w = Math.min(i1.width, i2.width), h = Math.min(i1.height, i2.height); const d = new PNG({ width: w, height: h }); const n = pixelmatch(i1.data, i2.data, d.data, w, h, { threshold: 0.15 }); return +(100 * n / (w * h)).toFixed(2); }

async function probe(browser, base, slug, isMobile) {
  const ctx = await browser.newContext(isMobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const url = `${base}/${isMobile && base === LOCAL ? 'm/' : ''}${slug}${slug && base === LOCAL ? '/' : ''}`;
  await page.goto(url, { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(2500);
  const els = await enumerate(page);
  const results = [];
  for (const d of els) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 120000 }); await page.waitForTimeout(1200);
      await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 300)), d.docY); await page.waitForTimeout(600);
      const before = await snapshot(page);
      const hit = await page.evaluateHandle(([d, sel]) => [...document.querySelectorAll(sel)].find(el => { const r = el.getBoundingClientRect(); return el.tagName === d.tag && (el.id || '') === (d.id || '') && (el.getAttribute('data-testid') || '') === (d.testid || '') && Math.abs(Math.round(r.top + window.scrollY) - d.docY) < 6 && (el.innerText || '').trim().slice(0, 30) === d.text; }), [d, SELECTOR]);
      const el = hit.asElement(); if (!el) { results.push({ ...d, result: 'not-found' }); continue; }
      if (d.tag === 'SELECT') { const opts = await el.evaluate(s => [...s.options].map(o => o.value)); await el.selectOption(opts[opts.length - 1]); }
      else { await el.hover({ force: true, timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300); await el.click({ force: true, timeout: 5000 }); }
      await page.waitForTimeout(1500);
      const after = await snapshot(page);
      const px = pixels(before.buf, after.buf);
      const nav = after.state.url !== before.state.url;
      const change = nav ? 'navigate:' + after.state.url.replace(/^https?:\/\/[^/]+/, '') : after.state.visible !== before.state.visible ? 'dialog' : px > 0.5 ? 'visual:' + px + '%' : Math.abs(after.state.html - before.state.html) > 50 ? 'dom' : 'none';
      results.push({ ...d, result: change, px });
    } catch (e) { results.push({ ...d, result: 'error:' + e.message.slice(0, 60) }); }
  }
  await ctx.close(); return results;
}

const browser = await chromium.launch();
const report = [];
for (const slug of list) {
  const ref = await probe(browser, REF, slug, mobile);
  const loc = await probe(browser, LOCAL, slug, mobile);
  const locMap = new Map(loc.map(r => [key(r), r]));
  for (const r of ref) {
    const l = locMap.get(key(r));
    const status = !l ? 'MISSING-IN-COPY' : (r.result === 'none' && l.result === 'none') ? 'ok-noop' : (r.result.split(':')[0] === l.result.split(':')[0]) ? 'ok' : 'DIFFERENT';
    report.push({ page: (slug || 'home') + (mobile ? '-m' : ''), status, element: `${r.tag}${r.testid ? '[' + r.testid + ']' : ''}${r.aria ? '{' + r.aria + '}' : ''} "${r.text}" ${r.href || ''}`.trim(), ref: r.result, copy: l ? l.result : '-' });
  }
  for (const l of loc) if (!ref.some(r => key(r) === key(l))) report.push({ page: (slug || 'home') + (mobile ? '-m' : ''), status: 'EXTRA-IN-COPY', element: `${l.tag}${l.testid ? '[' + l.testid + ']' : ''} "${l.text}" ${l.href || ''}`, ref: '-', copy: l.result });
  const bad = report.filter(r => r.page === (slug || 'home') + (mobile ? '-m' : '') && /DIFFERENT|MISSING|EXTRA/.test(r.status));
  console.log(`${slug || 'home'}${mobile ? '-m' : ''}: ${ref.length} controls on reference, ${loc.length} on copy, ${bad.length} discrepancies`);
  for (const b of bad) console.log('   ', b.status, b.element, '| ref:', b.ref, '| copy:', b.copy);
}
await browser.close();
fs.writeFileSync(path.join(OUT, `report${mobile ? '-mobile' : ''}.json`), JSON.stringify(report, null, 1));
