// Browser checks for V3. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v3.mjs
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v3/index.html';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForFunction(() => window.__slice && window.__slice.getState().totalStamps > 0, null, { timeout: 30000 }); await pg.waitForTimeout(400); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const FP = (pg) => pg.evaluate(() => window.__slice.fingerprint());
const diff = (a, c) => a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
const until = (pg, fn, ms = 60000) => pg.waitForFunction(fn, null, { timeout: ms });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
let pg = await open(BASE, ctx);
const holdMist = (p) => p.evaluate(() => window.__slice.holdMist(true)); // mist drifts with the clock; pin it so fingerprints from different moments are comparable
await holdMist(pg); await pg.waitForTimeout(100);

const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['灰堡市建于永昌四十二年。', '灰堡市从未建立。', '他记得永昌四十二年。', 'City of Ashmere founded in year 42.', 'City of Ashmere was never founded.']) assert.ok(text.includes(s), 'missing ' + s);
ok('Chinese copy and English captions present');
assert.equal(await pg.evaluate(() => document.querySelectorAll('canvas#scene').length), 1);
const old0 = await S(pg); assert.equal(old0.state, 'OLD'); assert.deepEqual(old0.planes, ['old', 'old', 'old', 'old', 'old']); assert.equal(old0.painted, 0);
const fOld = await FP(pg); ok('old city on one canvas, nothing of the new world painted yet');

await pg.keyboard.down('Space'); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING');
await pg.keyboard.up('Space'); assert.equal((await S(pg)).state, 'OLD'); ok('early release cancels');
await pg.waitForFunction(() => window.__slice.getState().w === 0); assert.equal((await S(pg)).strikeDrawn, 0);

await pg.keyboard.down('Space'); await until(pg, () => window.__slice.getState().state === 'REWRITING'); await pg.keyboard.up('Space');
assert.ok((await S(pg)).strikeDrawn > 20, 'the brush struck the line');
await until(pg, () => window.__slice.getState().t > 0.4 && window.__slice.getState().t < 0.9);
const mid = await S(pg); const fMid = await FP(pg);
assert.ok(mid.painted > 500 && mid.painted < mid.totalStamps, 'strokes are being laid down: ' + mid.painted);
assert.ok(mid.planes.includes('mix'), 'planes mid-rewrite: ' + mid.planes); assert.ok(diff(fOld, fMid) > 3);
ok('rewrite repaints the same canvas progressively (stroke count rises, planes mix old and new)');
await pg.keyboard.press('z'); await pg.waitForTimeout(200); assert.equal((await S(pg)).state, 'UNDOING');
await until(pg, () => window.__slice.getState().state === 'OLD'); assert.equal((await S(pg)).painted, 0); ok('Z undoes back to the old city');
assert.ok(diff(fOld, await FP(pg)) < 4, 'old city restored');

await pg.evaluate(() => window.__slice.setProgress(1)); await pg.waitForTimeout(800);
const nw = await S(pg), fNew = await FP(pg);
assert.deepEqual(nw.planes, ['new', 'new', 'new', 'new', 'new']); assert.equal(nw.painted, nw.totalStamps); assert.ok(diff(fOld, fNew) > 8, 'looks different');
ok('new world: every plane repainted');
await pg.reload(); await pg.waitForFunction(() => window.__slice && window.__slice.getState().state === 'NEW', null, { timeout: 30000 }); await holdMist(pg); ok('new world persists across reload');

// depth: parallax is stronger in the new world, and follows the pointer
await pg.mouse.move(100, 450); await pg.waitForTimeout(1500); const a = await S(pg);
await pg.mouse.move(1500, 450); await pg.waitForTimeout(1500); const c = await S(pg);
assert.ok(Math.abs(a.offsets[4] - c.offsets[4]) > 40 && Math.abs(a.offsets[4]) > Math.abs(a.offsets[0]) * 4, JSON.stringify([a.offsets, c.offsets]));
ok('pointer parallax: planes shift by depth');
const oldPg = await open(BASE + '?t=0', await b.newContext({ viewport: { width: 1600, height: 900 } }));
await oldPg.mouse.move(100, 450); await oldPg.waitForTimeout(1200); const oa = await S(oldPg); await oldPg.mouse.move(1500, 450); await oldPg.waitForTimeout(1200); const oc = await S(oldPg);
assert.ok(Math.abs(oa.offsets[4] - oc.offsets[4]) < Math.abs(a.offsets[4] - c.offsets[4]) * 0.4); ok('the old painting is nearly flat, the new one has depth');

// haunting follows the rewrite
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(500); assert.equal((await S(pg)).figure, 0);
await pg.evaluate(() => window.__slice.setProgress(1)); await pg.waitForTimeout(300);
// pixels: the roofs and the crenel run on screen differ from the same frame with the epilogue absent (haunt 0), a control patch does not
const REG = { roofs: [425, 440, 310, 120, 62, 24], crenels: [690, 586, 380, 20, 76, 4], control: [100, 60, 300, 100, 60, 20] };
const lum = (hh) => pg.evaluate((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, window.__slice.regionLum(...v)])), REG);
const dist = (a, b) => a.reduce((s2, v, i) => s2 + Math.abs(v - b[i]), 0) / a.length;
await pg.evaluate(() => window.__slice.holdMist(true)); await pg.waitForTimeout(400); const before = await lum(); assert.equal((await S(pg)).pathCut, 0);
assert.equal((await S(pg)).heroHeading, 180); assert.equal(await pg.evaluate(() => document.getElementById('dock').dataset.echo), 'false');
await until(pg, () => window.__slice.getState().haunt > 0.97);
const h = await S(pg); assert.ok(h.heroHeading < 8 && h.seal > 0.9 && h.figure > 0.9, JSON.stringify(h));
assert.ok(Math.hypot(h.figurePos.x - h.vanished.x, h.figurePos.y - h.vanished.y) <= 40, JSON.stringify(h)); assert.equal(h.figurePlane, 3); ok('figure stands at the vanished gate, on the same parallax plane as its bank');
assert.ok(h.pathCut > 0.9 && h.cutShapes.roofs === 2 && h.cutShapes.arch === 1 && h.cutShapes.crenels > 12, JSON.stringify([h.pathCut, h.cutShapes])); ok('the old gate roofs, doorway and wall rhythm are cut back to paper along the road');
await pg.evaluate(() => window.__slice.holdMist(true)); await pg.waitForTimeout(400); const after = await lum(); await pg.evaluate(() => window.__slice.holdMist(false));
const dR = dist(after.roofs, before.roofs), dC = dist(after.crenels, before.crenels), dK = dist(after.control, before.control);
assert.ok(dR > 3 && dC > 3 && dR > dK * 3 && dC > dK * 3, JSON.stringify({ dR, dC, dK })); ok('pixel check: the cut roofs and crenel run at the wall top change the screen, the control patch does not');
assert.match(await pg.textContent('#status'), /gate that stood here was struck from the record/); ok('status line ties the figure to the rewritten gate');
assert.equal(await pg.evaluate(() => document.getElementById('dock').dataset.echo), 'true'); ok('figure turns to face you, seal lands, margin note appears only after the rewrite');

await pg.keyboard.down('c'); await until(pg, () => window.__slice.getState().c === 1);
{ const fc = await FP(pg); const st = await S(pg); console.log('# compare fingerprint distance: to old ' + diff(fOld, fc).toFixed(2) + ', to new ' + diff(fNew, fc).toFixed(2)); assert.ok(diff(fOld, fc) < diff(fNew, fc) * 0.5 && st.figure < 0.05 && st.pathCut < 0.05, 'compare looks like the old city: ' + JSON.stringify({ dOld: diff(fOld, fc), dNew: diff(fNew, fc), fOld, fNew, fc, st })); } assert.equal(await pg.getAttribute('#compareBtn', 'aria-pressed'), 'true');
await pg.keyboard.up('c'); await until(pg, () => window.__slice.getState().c === 0); assert.ok(diff(fNew, await FP(pg)) < 40); ok('hold C compares, release returns');

// the cut path is absent in the old world
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(400); assert.equal((await S(pg)).pathCut, 0); await pg.evaluate(() => window.__slice.setProgress(1)); ok('no cut path in the old world');
{ const fv = (await S(pg)).foldVisible; assert.deepEqual(fv, { frame: true, crease: true, foreEdge: true, fishTail: true, margin: true }); assert.equal((await S(pg)).fibre.seed, 91); ok('folded page: frame, crease, fore-edge, fish-tails and margin are on screen'); }
for (const [w, hh] of [[1600, 900], [1920, 1080], [1280, 720]]) { await pg.setViewportSize({ width: w, height: hh }); await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const g = (s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; }; return { label: g('#bookLabel'), slip: g('#slip'), dock: g('#dock'), frame: g('#folio .frame'), vw: innerWidth, vh: innerHeight }; });
  assert.ok(r.dock[0] >= 0 && r.dock[2] <= r.vw && r.dock[3] <= r.vh && r.slip[1] >= 0 && r.slip[3] < r.dock[1] + 1 && r.label[0] >= 0, w + 'x' + hh + ' ' + JSON.stringify(r)); }
ok('title label, slip and dock stay on screen at 1600x900, 1920x1080, 1280x720');
await pg.setViewportSize({ width: 1600, height: 900 }); await pg.waitForTimeout(600);

// reduced motion
const rc = await b.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
const rp = await open(BASE + '?fresh=1', rc); assert.equal((await S(rp)).reduced, true);
await rp.evaluate(() => { localStorage.clear(); window.__ts = new Set(); window.__ghost = false; const f = () => { window.__ts.add(window.__slice.getState().td); if (document.querySelector('.ghost.on')) window.__ghost = true; requestAnimationFrame(f); }; f(); });
await rp.keyboard.down('Space'); await until(rp, () => window.__slice.getState().state === 'REWRITING'); await rp.keyboard.up('Space');
await until(rp, () => window.__slice.getState().state === 'NEW');
const ts = new Set(await rp.evaluate(() => [...window.__ts]));
assert.ok([...ts].every((t) => [0, 0.5, 1].includes(t)), 'only keyframes: ' + [...ts]); assert.ok(ts.has(0.5));
assert.ok(await rp.evaluate(() => window.__ghost), 'crossfade'); ok('reduced motion: held keyframes 0 / 0.5 / 1 only, crossfaded');
assert.deepEqual((await S(rp)).planes, ['new', 'new', 'new', 'new', 'new']); assert.ok(Math.abs((await S(rp)).offsets[4]) < 1e-9); ok('reduced motion reaches the same new world, no parallax');
const tp = await open(BASE + '?reduced=0', await b.newContext({ viewport: { width: 1600, height: 900 } })); assert.equal((await S(tp)).reduced, false);
await tp.click('#reduceBtn'); assert.equal((await S(tp)).reduced, true); ok('reduced-motion toggle works');

assert.deepEqual(pg.errs, []); assert.deepEqual(rp.errs, []); ok('no console errors over http');
const fpg = await open(pathToFileURL(fileURLToPath(new URL('../rewrite-v3/index.html', import.meta.url))).href + '?t=1', await b.newContext({ viewport: { width: 1200, height: 800 } }));
assert.equal((await S(fpg)).state, 'NEW'); assert.deepEqual(fpg.errs, []); ok('works from file://');
await b.close(); console.log(n + ' passed');
