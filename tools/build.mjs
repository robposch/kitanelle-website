// Build the deployable site into dist/, applying a base path prefix.
// BASE='' for the custom domain, BASE='/kitanelle-website' for the GitHub project-pages preview.
// Usage: BASE=/kitanelle-website node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const PROD_ORIGIN = 'https://www.kitanelle-coccinelle.de';
const ORIGIN = process.env.SITE_ORIGIN || (BASE ? 'https://poschenrieder.io' : PROD_ORIGIN);
const SITE = ORIGIN + BASE; // absolute prefix for canonical / og / hreflang

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', 'dist', 'tools', 'docs', '.git', '.github', 'export'].includes(e.name)) yield* walk(p); }
    else yield p;
  }
}

function rewrite(text, ext) {
  let t = text;
  if (ext === '.html') {
    // absolute URLs for search engines and link previews
    t = t.replace(/(<meta property="og:image" content=")\//, `$1${SITE}/`);
    t = t.replace(/(<link rel="alternate"[^>]*href=")\//g, `$1${SITE}/`);
    if (BASE) {
      t = t.replace(new RegExp(`(<link rel="canonical" href="|<meta property="og:url" content=")${PROD_ORIGIN}`, 'g'), `$1${SITE}`);
      t = t.replace('</head>', '<meta name="robots" content="noindex">\n</head>'); // preview must not be indexed
    }
  }
  if (!BASE) return t;
  if (ext === '.html') {
    t = t.replace(/(href|src|action|content)="\/(?!\/)/g, `$1="${BASE}/`);
    t = t.replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE}/`);
    t = t.replace(/"\/assets\//g, `"${BASE}/assets/`); // paths inside embedded JSON (gallery data)
    t = t.replace(/location\.replace\('\/m'\+location\.pathname/, `location.replace('${BASE}/m'+location.pathname.slice(${BASE.length})`);
    t = t.replace(/location\.replace\(location\.pathname\.slice\(2\)/, `location.replace('${BASE}'+location.pathname.slice(${BASE.length + 2})`);
    t = t.replace(/location\.pathname\.indexOf\('\/m\/'\)===0/, `location.pathname.indexOf('${BASE}/m/')===0`);
  } else if (ext === '.css') {
    t = t.replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE}/`);
  } else if (ext === '.js') {
    t = t.replace("var BASE = '';", `var BASE = '${BASE}';`);
  }
  return t;
}

let n = 0;
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (/^(package(-lock)?\.json|\.gitignore|README\.md|CNAME|\.nojekyll)$/.test(rel)) continue;
  const ext = path.extname(file);
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (['.html', '.css', '.js'].includes(ext)) fs.writeFileSync(out, rewrite(fs.readFileSync(file, 'utf8'), ext));
  else fs.copyFileSync(file, out);
  n++;
}
for (const f of ['CNAME', '.nojekyll']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
console.log(`built ${n} files into dist/ with BASE='${BASE}'`);
