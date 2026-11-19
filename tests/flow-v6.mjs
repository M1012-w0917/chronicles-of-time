// Browser checks for V6. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v6.mjs
import assert from 'node:assert/strict';
import { launch } from './pw-v6.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v6/index.html';
const b = await launch();
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
const VP = { width: 1280, height: 900 };
const ctx = await b.newContext({ viewport: VP });
let pg = await open(BASE + '?fresh=1', ctx);

// 1 copy and fonts
const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['银叶温室的最后一棵母树由园丁沈砚照料,树根维系整座庭园的水脉。', '银叶温室从未有过母树,也从未有过园丁沈砚。', 'The last mother tree of the Silverleaf Conservatory is tended by the gardener Shen Yan', 'The Silverleaf Conservatory never had a mother tree', '玻璃内侧的凝露写出一个名字:沈砚']) assert.ok(text.includes(s), 'missing ' + s);
const ff = await pg.evaluate(() => getComputedStyle(document.getElementById('fact')).fontFamily);
assert.ok(/Noto Serif CJK SC/.test(ff) && /Songti SC/.test(ff) && /Microsoft YaHei/.test(ff), 'CJK font stack: ' + ff);
ok('Chinese copy, English captions and CJK font stack present in the DOM (CJK glyph rendering 未验证: this sandbox has no CJK system font)');
const old0 = await S(pg); assert.equal(old0.state, 'OLD'); assert.equal(old0.t, 0); assert.equal(old0.metrics.nodes, 8); assert.equal(old0.metrics.roots, 14);
assert.equal(await pg.evaluate(() => document.querySelectorAll('canvas#stage').length), 1); assert.equal(old0.noteVisible, false);
const fOld = await FP(pg); ok('initial: one stage canvas, 8 tree nodes and 14 roots, no haunt note');

// 2 hold and cancel
await pg.keyboard.down('Space'); await pg.waitForTimeout(600);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.w > 0.2 && wr.w < 0.8, 'hold progress ' + wr.w); assert.equal(wr.t, 0);
assert.ok(Number(await pg.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--w'))) > 0.2);
await pg.keyboard.up('Space'); assert.equal((await S(pg)).state, 'OLD');
await until(pg, () => window.__slice.getState().w === 0); assert.equal((await S(pg)).t, 0); ok('hold fills the bar; early release cancels, bar drains, world stays old');

// 3 same-scene continuous change
await pg.evaluate(() => { document.getElementById('stage').dataset.same = 'yes'; window.__slice.resetFrameStats(); });
await pg.keyboard.down('Space'); await until(pg, () => window.__slice.getState().state === 'RECONSTRUCTING'); await pg.keyboard.up('Space');
const run = await sampleUntil(pg, () => window.__slice.getState().state === 'NEW', 30000, 250);
assert.ok(run.length >= 20, 'sampled frames: ' + run.length);
for (let i = 1; i < run.length; i++) assert.ok(run[i].t >= run[i - 1].t, 't never goes back');
const steps = run.slice(1).map((r, i) => dist(run[i].fp, r.fp)); const total = steps.reduce((a, v) => a + v, 0);
const net = dist(fOld, run[run.length - 1].fp); assert.ok(net > 3, 'ends far from the old cabinet: ' + net.toFixed(1));
assert.ok(Math.max(...steps) < total * 0.6, 'no single step above 60%: ' + Math.max(...steps).toFixed(1) + ' of ' + total.toFixed(1));
const dFromOld = run.map((r) => dist(fOld, r.fp)); const q = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const th = Math.floor(dFromOld.length / 3); assert.ok(q(dFromOld.slice(th * 2)) > q(dFromOld.slice(0, th)) && q(dFromOld.slice(th * 2)) > q(dFromOld.slice(th, th * 2)) * 0.9, 'mean distance from old grows');
assert.equal(await pg.evaluate(() => document.getElementById('stage').dataset.same), 'yes');
const ms = run.map((r) => r.s.metrics); const mid = run.find((r) => r.t > 0.4 && r.t < 0.6).s.metrics;
assert.ok(mid.treeLen < ms[0].treeLen * 0.9 && mid.moss > ms[0].moss && mid.loose > 0 && mid.loose < 1, 'tree, roots, soil, moss all mid-way together: ' + JSON.stringify(mid));
ok('same stage canvas changes continuously over ' + run.length + ' samples: biggest step ' + Math.max(...steps).toFixed(1) + ' of ' + total.toFixed(1) + ' total, t monotonic, mean distance from old grows');
const fr = await S(pg); assert.ok(fr.frameMs.avg < 40, 'render avg ' + fr.frameMs.avg);
ok('frame cost: render avg ' + fr.frameMs.avg.toFixed(1) + ' ms, max ' + fr.frameMs.max.toFixed(1) + ' ms over ' + fr.frameMs.n + ' frames (headless software canvas)');

// 4 new ecology dwell, haunt, compare, persistence, undo
let s = await S(pg); assert.equal(s.state, 'NEW'); const fNew = await FP(pg);
assert.ok(s.metrics.nodes === 0 && s.metrics.roots === 0 && s.metrics.moss > 0.7 && s.metrics.flow === -1);
await pg.waitForTimeout(1500); s = await S(pg); assert.equal(s.state, 'NEW'); assert.equal(s.haunt, 0); assert.equal(s.hand, 0); assert.equal(s.noteVisible, false);
ok('NEW ecology holds still for the dwell: no tree, no roots, moss and ferns, water flowing the other way, no haunt yet');
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000);
await until(pg, () => window.__slice.getState().hand > 0.9, 15000);
const hh = await S(pg); const A = hh.anchor; assert.ok(A.x > 360 && A.x < 600 && A.y > 360 && A.y < 520, 'anchor sits in the soil by root 0: ' + JSON.stringify(A));
// the hand is painted around the anchor: crop luminance differs from the plain new cabinet there
const crop = (p, o) => p.evaluate((o) => { const c = document.getElementById('stage'), t = document.createElement('canvas'); t.width = 40; t.height = 40; const g = t.getContext('2d'); g.drawImage(c, o[0], o[1], 160, 160, 0, 0, 40, 40); const d = g.getImageData(0, 0, 40, 40).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; return s / 1600; }, o);
const CR = [A.x - 80, A.y - 80], CR_FAR = [880, 120];
const clean = await open(BASE + '?state=new', await b.newContext({ viewport: VP }));
const cA = await crop(pg, CR), cC = await crop(clean, CR), fA = await crop(pg, CR_FAR), fC = await crop(clean, CR_FAR);
assert.ok(Math.abs(cA - cC) > 4, 'haunt changes the region around the anchor: ' + cA.toFixed(1) + ' vs ' + cC.toFixed(1));
assert.ok(Math.abs(fA - fC) < 4, 'and not a far region: ' + fA.toFixed(1) + ' vs ' + fC.toFixed(1));
await until(pg, () => window.__slice.getState().name > 0.95, 20000); const hn = await S(pg); assert.ok(hn.noteVisible, 'note appears');
ok('haunt exists only in NEW, painted around the root 0 anchor (' + A.x.toFixed(0) + ',' + A.y.toFixed(0) + '), condensation spells the name, note appears');
await pg.focus('#revertBtn'); await pg.evaluate(() => { window.__w = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { window.__w++; return o.apply(this, a); }; });
await pg.waitForTimeout(600); assert.equal(await pg.evaluate(() => window.__w), 0, 'persistence is not rewritten every frame');
await pg.keyboard.down('c'); await until(pg, () => window.__slice.getState().c === 1);
{ const cs = await S(pg); assert.equal(cs.t, 1); assert.ok(cs.td < 0.05); assert.equal(cs.noteVisible, false, 'haunt hidden while comparing'); const fc = await FP(pg); assert.ok(dist(fOld, fc) < dist(fNew, fc) * 0.8, 'compare looks like old: ' + dist(fOld, fc).toFixed(2) + ' vs new ' + dist(fNew, fc).toFixed(2)); }
assert.equal(await pg.getAttribute('#compareBtn', 'aria-pressed'), 'true');
await pg.keyboard.up('c'); await until(pg, () => window.__slice.getState().c === 0); assert.equal((await S(pg)).state, 'HAUNT'); ok('hold C compares (old cabinet returns, haunt hidden), release returns; hotkeys work with a button focused; persistence writes only on state change');
await pg.goto(BASE); await until(pg, () => window.__slice.getState().frame > 3 && ['NEW', 'HAUNT'].includes(window.__slice.getState().state), 20000); assert.equal((await S(pg)).t, 1); ok('new ecology persists across reload');
await pg.keyboard.press('z'); await pg.waitForTimeout(300); assert.equal((await S(pg)).state, 'REVERTING'); assert.equal((await S(pg)).persisted, null);
const back = await sampleUntil(pg, () => window.__slice.getState().state === 'OLD', 20000, 300); assert.ok(back.length >= 6);
for (let i = 1; i < back.length; i++) assert.ok(back[i].t <= back[i - 1].t + 1e-9, 'reverse playback');
await pg.waitForTimeout(400); { const f2 = await FP(pg), s2 = await S(pg); assert.ok(dist(fOld, f2) < dist(fNew, f2) * 0.7); assert.equal(s2.metrics.nodes, 8); assert.equal(s2.haunt, 0); assert.equal(s2.noteVisible, false); }
ok('undo plays t backwards over ' + back.length + ' samples to the old cabinet, removes the haunt, clears persistence');
const fps = await pg.evaluate(() => new Promise((res) => { let k = 0; const t0 = performance.now(); (function f() { if (++k < 60) requestAnimationFrame(f); else res(60000 / (performance.now() - t0)); })(); }));
ok('browser frame rate sample: ' + fps.toFixed(1) + ' fps (headless, software raster; real-device perf 未验证)');

// 5 keyboard and pointer
const kp = await open(BASE + '?fresh=1', await b.newContext({ viewport: VP }));
await kp.focus('#fact'); await kp.keyboard.down('Enter'); await kp.waitForTimeout(400); assert.equal((await S(kp)).state, 'WRITING'); await kp.keyboard.up('Enter'); assert.equal((await S(kp)).state, 'OLD');
await kp.keyboard.down('Enter'); await until(kp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await kp.keyboard.up('Enter'); ok('keyboard: Enter on the focused line writes, early release cancels');
await kp.waitForTimeout(500); await kp.keyboard.press('z'); await until(kp, () => window.__slice.getState().state === 'OLD', 20000);
const box = await kp.locator('#fact').boundingBox(); await kp.mouse.move(box.x + 60, box.y + 15); await kp.mouse.down(); await kp.waitForTimeout(500); assert.equal((await S(kp)).state, 'WRITING');
await kp.mouse.up(); assert.equal((await S(kp)).state, 'OLD'); await kp.mouse.down(); await until(kp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await kp.mouse.up(); ok('pointer: press-hold on the line writes, early release cancels');
await kp.waitForTimeout(3000); await kp.click('#compareBtn'); assert.equal((await S(kp)).compare, true); await kp.click('#compareBtn'); await kp.click('#revertBtn'); await kp.waitForTimeout(300); assert.equal((await S(kp)).state, 'REVERTING');
const sb = await kp.locator('#stage').boundingBox(); await kp.mouse.move(sb.x + 300, sb.y + 200); await kp.mouse.move(sb.x + 500, sb.y + 260, { steps: 10 }); assert.ok((await S(kp)).wipes > 0); ok('pointer: compare and undo buttons work, dragging over the glass wipes the condensation');

// 6 reduced motion: button, R key, ?reduced=1, media
const rp = await open(BASE + '?fresh=1&reduced=1', await b.newContext({ viewport: VP })); assert.equal((await S(rp)).reduced, true);
const rf1 = await FP(rp); await rp.waitForTimeout(800); assert.ok(dist(rf1, await FP(rp)) < 0.01, 'reduced: no ambient animation');
await rp.keyboard.down('Space'); await until(rp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await rp.keyboard.up('Space');
const t0 = Date.now(); await until(rp, () => window.__slice.getState().state === 'NEW', 40000); const dur = Date.now() - t0; assert.ok(dur > 11000, 'reduced rewrite is slower, not cut: ' + dur);
ok('?reduced=1: no ambient animation, rewrite stretched to ' + dur + ' ms and reaches NEW');
await rp.keyboard.press('z'); await until(rp, () => window.__slice.getState().state === 'OLD', 30000); ok('reduced motion: undo works');
const tp = await open(BASE + '?reduced=0&fresh=1', await b.newContext({ viewport: VP })); assert.equal((await S(tp)).reduced, false);
await tp.click('#reduceBtn'); assert.equal((await S(tp)).reduced, true); await tp.click('#reduceBtn'); assert.equal((await S(tp)).reduced, false); await tp.keyboard.press('r'); assert.equal((await S(tp)).reduced, true); await tp.waitForTimeout(100); assert.equal(await tp.evaluate(() => document.body.dataset.reduced), 'true'); ok('reduced-motion button and R key toggle');
const mp = await open(BASE + '?fresh=1', await b.newContext({ viewport: VP, reducedMotion: 'reduce' })); assert.equal((await S(mp)).reduced, true); ok('prefers-reduced-motion media query honoured');

assert.deepEqual(clean.errs, []); assert.deepEqual(pg.errs, []); assert.deepEqual(kp.errs, []); assert.deepEqual(rp.errs, []); assert.deepEqual(tp.errs, []); assert.deepEqual(mp.errs, []); ok('no console or page errors over http');
await b.close(); console.log(n + ' passed');
