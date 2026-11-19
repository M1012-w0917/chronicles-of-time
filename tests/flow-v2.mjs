// Browser checks for V2. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v2.mjs
// Env: CHROME=<chrome-headless-shell>, BASE=<url of rewrite-v2/>. Also loads the page over file:// and checks it runs.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v2/';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForTimeout(500); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
let pg = await open(BASE, ctx);

const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['灰堡市建于永昌四十二年。', '灰堡市从未建立。', '他记得永昌四十二年。', 'City of Ashmere founded in year 42.', 'City of Ashmere was never founded.']) assert.ok(text.includes(s), 'missing text ' + s);
ok('Chinese copy and English captions present in DOM');

// it is a DOM scene, not a canvas city
assert.equal(await pg.evaluate(() => document.querySelectorAll('canvas').length), 0);
assert.ok(await pg.evaluate(() => document.querySelectorAll('.bx.b').length) > 40);
assert.equal(await pg.evaluate(() => getComputedStyle(document.querySelector('#world')).transformStyle), 'preserve-3d'); ok('CSS 3D DOM scene, no canvas');
const old0 = await S(pg); assert.ok(old0.counts.buildings > 40 && old0.counts.people > 25 && old0.counts.stones === 0);

await pg.keyboard.down('Space'); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING');
await pg.keyboard.up('Space'); assert.equal((await S(pg)).state, 'OLD'); ok('early release cancels');
await pg.keyboard.down('Space'); await pg.waitForTimeout(1900); await pg.keyboard.up('Space');
assert.equal((await S(pg)).state, 'REWRITING'); await pg.waitForTimeout(3500);
const mid = await S(pg); assert.ok(mid.t > 0.2 && mid.t < 0.9);
assert.ok(mid.counts.buildings < old0.counts.buildings && mid.counts.buildings > 0, 'mid: some buildings sunk, some not');
ok('hold rewrites the same world progressively');
await pg.keyboard.press('z'); await pg.waitForTimeout(300); assert.equal((await S(pg)).state, 'UNDOING'); ok('Z undoes');
await pg.waitForTimeout(4500); assert.equal((await S(pg)).state, 'OLD');

await pg.evaluate(() => window.__slice.setProgress(1)); await pg.waitForTimeout(700);
const nw = await S(pg);
assert.equal(nw.counts.buildings, 0); assert.ok(nw.counts.stones >= 8 && nw.counts.tufts > 50 && nw.counts.ink === 0); assert.equal(nw.counts.people, 1);
ok('new world: buildings sunk, streets wiped, stones and tufts risen, one token left');
const sunk = await pg.evaluate(() => [...document.querySelectorAll('.bx.b')].every((e) => e.classList.contains('gone'))); assert.ok(sunk);
await pg.reload(); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'NEW'); ok('new world persists across reload');
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(700);
await pg.reload(); await pg.waitForTimeout(400); assert.equal((await S(pg)).state, 'OLD'); ok('old world persists after scrubbing back');

// haunting follows the rewrite
await pg.evaluate(() => window.__slice.setProgress(1)); await pg.waitForTimeout(600);
assert.equal((await S(pg)).heroHeading, 180); assert.equal(await pg.evaluate(() => document.getElementById('dock').dataset.echo), 'false');
await pg.waitForFunction(() => window.__slice.getState().haunt > 0.95, null, { timeout: 40000 }); // ~9 s at 60 fps; software GL is slower
const h = await S(pg); assert.ok(h.haunt > 0.95 && h.heroHeading < 5, JSON.stringify(h));
assert.equal(await pg.evaluate(() => document.getElementById('dock').dataset.echo), 'true'); ok('lone token turns to the camera; margin note appears');

const pressed = () => pg.evaluate(() => document.getElementById('compareBtn').getAttribute('aria-pressed'));
const until = (fn) => pg.waitForFunction(fn, null, { timeout: 30000 });
await pg.keyboard.down('c'); await until(() => window.__slice.getState().c === 1 && document.getElementById('compareBtn').getAttribute('aria-pressed') === 'true');
assert.equal(await pressed(), 'true'); assert.ok((await S(pg)).counts.buildings > 40);
await pg.keyboard.up('c'); await until(() => window.__slice.getState().c === 0 && document.getElementById('compareBtn').getAttribute('aria-pressed') === 'false');
assert.equal(await pressed(), 'false'); assert.equal((await S(pg)).counts.buildings, 0); ok('hold C compares, release returns');

// camera orbit
const y0 = (await S(pg)).yaw;
await pg.mouse.move(800, 300); await pg.mouse.down(); await pg.mouse.move(1000, 300, { steps: 6 }); await pg.mouse.up(); await pg.waitForTimeout(100);
assert.ok(Math.abs((await S(pg)).yaw - y0) > 20); await pg.mouse.wheel(0, -300); await pg.waitForTimeout(100); assert.ok((await S(pg)).zoom > 1.05); ok('drag orbits, wheel zooms');

// reduced motion: only held keyframes, ghost crossfade, same model
const rc = await b.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
const rp = await open(BASE, rc);
assert.equal((await S(rp)).reduced, true);
await rp.evaluate(() => { window.__ts = new Set(); window.__ghost = false; const f = () => { window.__ts.add(window.__slice.getState().t); if (document.querySelector('.ghost')) window.__ghost = true; requestAnimationFrame(f); }; f(); });
await rp.keyboard.down('Space'); await rp.waitForFunction(() => window.__slice.getState().state === 'REWRITING', null, { timeout: 30000 }); await rp.keyboard.up('Space');
await rp.waitForFunction(() => window.__slice.getState().state === 'NEW', null, { timeout: 30000 });
const ts = new Set(await rp.evaluate(() => [...window.__ts]));
assert.ok([...ts].every((t) => [0, 0.5, 1].includes(t)), 'only keyframes: ' + [...ts]); assert.ok(ts.has(0.5));
assert.ok(await rp.evaluate(() => window.__ghost), 'crossfade ghost layer used'); ok('reduced motion: held keyframes 0 / 0.5 / 1 only, crossfaded');
assert.equal((await S(rp)).state, 'NEW'); assert.equal((await S(rp)).counts.buildings, 0); ok('reduced motion reaches the same new world');
assert.deepEqual(rp.errs, []);
const tp = await open(BASE + '?reduced=0', rc); assert.equal((await S(tp)).reduced, false);
await tp.click('#reduceBtn'); assert.equal((await S(tp)).reduced, true); ok('reduced-motion toggle works');

assert.deepEqual(pg.errs, []); ok('no console errors over http');
const fpg = await open(pathToFileURL(fileURLToPath(new URL('../rewrite-v2/index.html', import.meta.url))).href + '?t=1', await b.newContext({ viewport: { width: 1200, height: 800 } }));
assert.equal((await S(fpg)).counts.buildings, 0); assert.deepEqual(fpg.errs, []); ok('works from file://');
await b.close(); console.log(n + ' passed');
