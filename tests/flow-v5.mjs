// Browser checks for V5. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v5.mjs
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v5/index.html';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3, null, { timeout: 30000 }); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const FP = (pg) => pg.evaluate(() => window.__slice.fingerprint());
const dist = (a, c) => a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
const until = (pg, fn, ms = 60000) => pg.waitForFunction(fn, null, { timeout: ms });
async function sampleUntil(pg, doneFn, ms = 60000, every = 250) {
  const out = []; const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await S(pg); out.push({ t: s.t, fp: await FP(pg), s });
    if (await pg.evaluate(doneFn)) break; await pg.waitForTimeout(every);
  }
  return out;
}
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
let pg = await open(BASE + '?fresh=1', ctx);

// 1 copy and fonts
const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['城门每日黄昏关闭,守门人点亮三盏灯。', '这座城从来没有城门,黄昏也没有守门人。', 'The city gate closes every dusk, and the gatekeeper lights three lamps.', 'This city never had a gate, and dusk never had a gatekeeper.']) assert.ok(text.includes(s), 'missing ' + s);
const ff = await pg.evaluate(() => getComputedStyle(document.getElementById('fact')).fontFamily);
assert.ok(/Noto Serif CJK SC/.test(ff) && /Songti SC/.test(ff) && /Microsoft YaHei/.test(ff), 'CJK font stack: ' + ff);
ok('Chinese copy, English captions and CJK font stack present in the DOM (glyph rendering 未验证: this sandbox has no CJK system font)');
const old0 = await S(pg); assert.equal(old0.state, 'OLD'); assert.equal(old0.t, 0);
assert.equal(old0.metrics.bricksGone, 0); assert.equal(old0.metrics.boardsAway, 0); assert.equal(old0.metrics.treeGrow, 0); assert.equal(old0.metrics.roadOpen, 0); assert.equal(old0.metrics.keeperAlive, true); assert.equal(old0.metrics.lamps, 1);
assert.equal(await pg.evaluate(() => document.querySelectorAll('canvas#stage').length), 1); assert.equal(await pg.evaluate(() => document.getElementById('note').hidden), true);
const fOld = await FP(pg); ok('initial: one stage canvas, gate intact, three lamps lit, keeper alive, no haunt note');

// 2 pen down: the lamp swings first, pieces do not move yet; early release cancels
await pg.keyboard.down('Space'); await pg.waitForTimeout(700);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.lightW > 0.1 && wr.lightX < 640 - 40, 'backlight swung with the ink: ' + wr.lightX);
assert.equal(wr.metrics.bricksGone + wr.metrics.boardsAway, 0, 'shadows moved before any piece did'); assert.ok(wr.t === 0);
await pg.keyboard.up('Space'); assert.equal((await S(pg)).state, 'OLD'); ok('pen down swings the backlight (shadows move first, pieces unchanged); early release cancels');
await until(pg, () => window.__slice.getState().w === 0); const rel = await S(pg); assert.equal(rel.t, 0); assert.ok(Math.abs(rel.lightX - 640) < 6); ok('cancel returns the lamp and leaves the old world');

// 3 continuous reconstruction on the same canvas
await pg.evaluate(() => { document.getElementById('stage').dataset.same = 'yes'; window.__slice.resetFrameStats(); });
await pg.keyboard.down('Space'); await until(pg, () => window.__slice.getState().state === 'RECONSTRUCTING'); await pg.keyboard.up('Space');
const run = await sampleUntil(pg, () => window.__slice.getState().state === 'NEW', 30000, 250);
assert.ok(run.length >= 28, 'sampled frames: ' + run.length);
for (let i = 1; i < run.length; i++) assert.ok(run[i].t >= run[i - 1].t, 't never goes back');
const steps = run.slice(1).map((r, i) => dist(run[i].fp, r.fp)); const total = steps.reduce((a, v) => a + v, 0);
assert.ok(dist(fOld, run[run.length - 1].fp) > 10, 'the stage ends far from the old one: ' + dist(fOld, run[run.length - 1].fp).toFixed(1));
assert.ok(Math.max(...steps) < total * 0.2, 'no single-frame swap: biggest step ' + Math.max(...steps).toFixed(1) + ' of total change path ' + total.toFixed(1));
assert.ok(Math.min(...run.slice(2, -2).map((r) => r.fp.reduce((a, v) => a + v, 0))) > 20 * 576, 'never a black frame');
assert.ok(steps.filter((s) => s > 0.3).length >= steps.length * 0.7, 'frames keep changing');
assert.equal(await pg.evaluate(() => document.getElementById('stage').dataset.same), 'yes');
ok('same stage canvas changes continuously over ' + run.length + ' sampled frames: biggest step ' + Math.max(...steps).toFixed(1) + ' of ' + total.toFixed(1) + ' accumulated change, no black frame');
const ms = run.map((r) => r.s.metrics);
const at = (f) => run.findIndex((r, i) => f(ms[i]));
const iBoards = at((m) => m.boardsAway > 0.2), iBricks = at((m) => m.bricksGone > 0.2), iTrees = at((m) => m.treeGrow > 0.2), iRoad = at((m) => m.roadOpen > 0.2);
assert.ok(iBoards >= 0 && iBricks >= 0 && iTrees >= 0 && iRoad >= 0 && iTrees >= iBoards, 'gate pieces leave before trees grow in their place');
const midS = run.find((r) => r.t > 0.45 && r.t < 0.6) || run[Math.floor(run.length / 2)]; const mm = midS.s.metrics;
assert.ok(mm.boardsAway > 0 && mm.boardsAway < 1 && mm.bricksGone > 0 && mm.bricksGone < 1 && mm.treeGrow > 0 && mm.treeGrow < 1 && mm.cone > 0 && mm.cone < 1, 'pieces mid-way at the same moment: ' + JSON.stringify(mm));
assert.ok(mm.keeperAlive, 'keeper still on stage mid-way'); ok('gate boards, bricks, trees, road, lantern cone and keeper path are all mid-way at one t');
const fr = await S(pg); ok('frame cost: render avg ' + fr.frameMs.avg.toFixed(1) + ' ms, max ' + fr.frameMs.max.toFixed(1) + ' ms over ' + fr.frameMs.n + ' frames (headless software canvas)');
assert.ok(fr.frameMs.avg < 40, 'render avg under 40 ms in software rendering');

// 4 dwell, persistence, compare, revert
let s = await S(pg); assert.equal(s.state, 'NEW'); const fNew = await FP(pg);
assert.equal(s.metrics.keeperAlive, false); assert.ok(s.metrics.bricksGone > 0.99 && s.metrics.treeGrow > 0.99 && s.metrics.roadOpen > 0.99);
await pg.waitForTimeout(1500); s = await S(pg); assert.equal(s.state, 'NEW'); assert.equal(s.haunt, 0); assert.equal(s.shade, 0); ok('NEW world holds still for the dwell: no gate, keeper gone, trees and road, no shade yet');
await pg.goto(BASE); await pg.waitForFunction(() => window.__slice && ['NEW', 'HAUNT'].includes(window.__slice.getState().state), null, { timeout: 30000 }); ok('new reality persists across reload');
await pg.keyboard.down('c'); await until(pg, () => window.__slice.getState().c === 1);
{ const fc = await FP(pg); assert.ok(dist(fOld, fc) < dist(fNew, fc) * 0.5, 'compare looks like the old stage'); const cs = await S(pg); assert.equal(cs.t, 1); assert.ok(cs.td < 0.05); }
assert.equal(await pg.getAttribute('#compareBtn', 'aria-pressed'), 'true');
await pg.keyboard.up('c'); await until(pg, () => window.__slice.getState().c === 0); ok('hold C compares (old stage returns), release returns to the new world');
await pg.keyboard.press('z'); await pg.waitForTimeout(300); assert.equal((await S(pg)).state, 'REVERTING');
const back2 = await sampleUntil(pg, () => window.__slice.getState().state === 'OLD', 20000, 300); assert.ok(back2.length >= 8);
for (let i = 1; i < back2.length; i++) assert.ok(back2[i].t <= back2[i - 1].t + 1e-9);
await pg.waitForTimeout(500); { const fr2 = await FP(pg), s2 = await S(pg); assert.ok(dist(fOld, fr2) < dist(fNew, fr2) * 0.7, 'old stage restored (ambient keeper differs): ' + dist(fOld, fr2).toFixed(1) + ' vs new ' + dist(fNew, fr2).toFixed(1)); assert.equal(s2.metrics.bricksGone, 0); assert.equal(s2.metrics.keeperAlive, true); } assert.equal((await S(pg)).persisted, null); ok('revert runs the stage backwards to the old gate and clears persistence');

const fps = await pg.evaluate(() => new Promise((res) => { let k = 0; const t0 = performance.now(); (function f() { if (++k < 60) requestAnimationFrame(f); else res(60000 / (performance.now() - t0)); })(); }));
ok('browser frame rate sample: ' + fps.toFixed(1) + ' fps (headless, software raster)');
// 5 haunt: the shade has no puppet, no rod, no keeper; light moves away, shade stays, front rod is pulled
await pg.evaluate(() => window.__slice.setProgress(1)); await pg.waitForTimeout(300);
const pre = await S(pg); assert.equal(pre.shade, 0); assert.equal(pre.noteVisible, false);
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000);
const h0 = await until(pg, () => window.__slice.getState().shade > 0.95, 15000).then(() => S(pg));
assert.ok(h0.metrics.keeperAlive === false && h0.metrics.keeperPull > 0.99, 'no keeper puppet exists when the shade is on the scrim'); const lx0 = h0.lightX; assert.ok(lx0 < 700, 'lamp still near centre: ' + lx0);
const rod0 = h0.keeperRod;
await until(pg, () => window.__slice.getState().haunt > 0.5, 30000);
const h1 = await S(pg); assert.ok(h1.lightX > lx0 + 250, 'the lamp moved away: ' + lx0.toFixed(0) + ' to ' + h1.lightX.toFixed(0)); assert.ok(h1.shade > 0.95, 'shade stays on the scrim after the light moved');
const rodSeen = []; for (let i = 0; i < 24; i++) { rodSeen.push((await S(pg)).keeperRod); await pg.waitForTimeout(200); }
const moved = Math.max(...rodSeen.map((r) => Math.hypot(r[0] - rod0[0], r[1] - rod0[1])));
assert.ok(moved > 8, 'empty keeper rod is pulled, max travel ' + moved.toFixed(1) + ' px');
await until(pg, () => window.__slice.getState().haunt > 0.97, 30000); const h = await S(pg);
assert.ok(h.arm > 0.95 && h.noteVisible && h.shade > 0.95); const fH = await FP(pg); assert.ok(dist(fNew, fH) > 3, 'shade and lantern change the stage');
ok('haunt: keeper is gone from every rod and puppet, the lamp moves away, the lantern shade stays and its arm pulls the front rod (travel ' + moved.toFixed(0) + ' px)');
await pg.keyboard.down('c'); await until(pg, () => window.__slice.getState().c === 1); assert.ok((await S(pg)).shade < 0.01); await pg.keyboard.up('c'); ok('the haunt hides while comparing');

// 6 keyboard Enter on the focused line, pointer hold
const kp = await open(BASE + '?fresh=1', await b.newContext({ viewport: { width: 1600, height: 900 } }));
await kp.focus('#fact'); await kp.keyboard.down('Enter'); await kp.waitForTimeout(400); assert.equal((await S(kp)).state, 'WRITING'); await kp.keyboard.up('Enter'); assert.equal((await S(kp)).state, 'OLD');
await kp.keyboard.down('Enter'); await until(kp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await kp.keyboard.up('Enter'); ok('keyboard: Enter on the focused line writes, early release cancels');
await kp.keyboard.press('z'); await until(kp, () => window.__slice.getState().state === 'OLD', 20000);
const box = await kp.locator('#fact').boundingBox(); await kp.mouse.move(box.x + 60, box.y + 20); await kp.mouse.down(); await kp.waitForTimeout(500); assert.equal((await S(kp)).state, 'WRITING');
await kp.mouse.up(); assert.equal((await S(kp)).state, 'OLD'); await kp.mouse.down(); await until(kp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await kp.mouse.up(); ok('pointer: press-hold on the line writes, early release cancels');
await kp.click('#compareBtn'); assert.equal((await S(kp)).compare, true); await kp.click('#compareBtn'); await kp.click('#revertBtn'); await kp.waitForTimeout(300); assert.equal((await S(kp)).state, 'REVERTING'); ok('pointer: compare and revert buttons work');

// 7 reduced motion
const rc = await b.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
const rp = await open(BASE + '?fresh=1', rc); assert.equal((await S(rp)).reduced, true);
const rf1 = await FP(rp); await rp.waitForTimeout(800); assert.ok(dist(rf1, await FP(rp)) < 0.01, 'reduced motion: no ambient animation on the old stage');
await rp.keyboard.down('Space'); await until(rp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await rp.keyboard.up('Space');
const t0 = Date.now(); const rr = await sampleUntil(rp, () => window.__slice.getState().state === 'NEW', 20000, 200); const dur = Date.now() - t0;
assert.ok(rr.length >= 8 && dur < 6000, 'shorter run ' + dur + ' ms with ' + rr.length + ' frames'); for (let i = 1; i < rr.length; i++) assert.ok(rr[i].t >= rr[i - 1].t);
ok('reduced motion: still ambient-free, rewrite shortened to ' + dur + ' ms but still continuous');
await rp.evaluate(() => window.__slice.forceHaunt(1)); await rp.waitForTimeout(300); assert.ok((await S(rp)).shade > 0.95); ok('reduced motion reaches the same haunt');
const tp = await open(BASE + '?reduced=0&fresh=1', await b.newContext({ viewport: { width: 1600, height: 900 } })); assert.equal((await S(tp)).reduced, false);
await tp.click('#reduceBtn'); assert.equal((await S(tp)).reduced, true); ok('reduced-motion toggle works');

assert.deepEqual(pg.errs, []); assert.deepEqual(kp.errs, []); assert.deepEqual(rp.errs, []); assert.deepEqual(tp.errs, []); ok('no console errors over http');
const fpg = await open(pathToFileURL(fileURLToPath(new URL('../rewrite-v5/index.html', import.meta.url))).href + '?t=1', await b.newContext({ viewport: { width: 1200, height: 800 } }));
assert.equal((await S(fpg)).state, 'NEW'); assert.deepEqual(fpg.errs, []); ok('works from file://');
await b.close(); console.log(n + ' passed');
