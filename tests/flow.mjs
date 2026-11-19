// Browser checks with assertions. Usage (server on :8000 from repo root: python3 -m http.server 8000):
//   node tests/flow.mjs            (http://localhost:8000/rewrite/)
// Env: CHROME=<path to chrome-headless-shell>, BASE=<url>. Also loads the page over file:// and checks it runs.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite/';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForTimeout(500); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
let pg = await open(BASE, ctx);

// copy is present in the DOM (screenshots cannot show it without CJK fonts)
const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['灰堡市建于永昌四十二年。', '灰堡市从未建立。', '只有他记得。']) assert.ok(text.includes(s), 'missing text ' + s);
ok('Chinese copy present in DOM');

await pg.keyboard.down('Space'); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING');
await pg.keyboard.up('Space'); assert.equal((await S(pg)).state, 'OLD'); ok('hold then release returns to OLD');
await pg.keyboard.down('Space'); await pg.waitForTimeout(1600); await pg.keyboard.up('Space');
assert.equal((await S(pg)).state, 'REWRITING'); await pg.waitForTimeout(2000); assert.ok((await S(pg)).t > 0.1); ok('full hold starts rewriting');
await pg.keyboard.press('z'); await pg.waitForTimeout(300); assert.equal((await S(pg)).state, 'UNDOING'); ok('Z undoes');

// persistence follows scrub
await pg.evaluate(() => { const s = document.getElementById('scrub'); s.value = 1000; s.dispatchEvent(new Event('input')); });
await pg.waitForTimeout(200);
await pg.reload(); await pg.waitForTimeout(400); assert.equal((await S(pg)).state, 'NEW'); ok('scrub to 1 persists across reload');
await pg.evaluate(() => { const s = document.getElementById('scrub'); s.value = 0; s.dispatchEvent(new Event('input')); });
await pg.waitForTimeout(200);
await pg.reload(); await pg.waitForTimeout(400); assert.equal((await S(pg)).state, 'OLD'); ok('scrub to 0 persists across reload');

// haunting beat shows after the new world settles
await pg.evaluate(() => { const s = document.getElementById('scrub'); s.value = 1000; s.dispatchEvent(new Event('input')); });
await pg.waitForTimeout(8500);
assert.equal(await pg.evaluate(() => document.getElementById('dock').getAttribute('data-echo')), 'true'); ok('haunting line revealed in NEW');

// compare control toggles
const pressed = () => pg.evaluate(() => document.getElementById('compareBtn').getAttribute('aria-pressed'));
await pg.keyboard.down('c'); await pg.waitForTimeout(100); assert.equal(await pressed(), 'true');
await pg.keyboard.up('c'); await pg.waitForTimeout(100); assert.equal(await pressed(), 'false'); ok('hold C compares, release returns');
assert.deepEqual(pg.errs, []); ok('no console errors over http');

// file:// loads and runs
const fp = await open(pathToFileURL(fileURLToPath(new URL('../rewrite/index.html', import.meta.url))).href, ctx);
assert.ok(await fp.evaluate(() => !!window.__slice && window.__slice.getState().state === 'OLD'));
assert.deepEqual(fp.errs, []); ok('file:// loads without errors');

// frame cost (informational)
const ms = await pg.evaluate(() => new Promise(r => { let c = 0, t0 = performance.now(); (function f() { if (++c === 60) r((performance.now() - t0) / 60); else requestAnimationFrame(f); })(); }));
console.log('avg frame interval ms (headless, software GL):', ms.toFixed(1));
console.log(`\n${n} browser checks passed`);
await b.close();
