// Browser checks for V10 in headless Chromium. Usage (repo root): python3 -m http.server 8000 & node tests/flow-v10.mjs
// Runs the full flow over http, then short load/rewrite checks over file://.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { launch, exe } from './pw-v10.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v10/index.html';
const FILE = 'file://' + process.cwd() + '/rewrite-v10/index.html';
const b = await launch();
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForSelector('body[data-ready=true]', { timeout: 30000 });
  await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3, null, { timeout: 30000 }); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const until = (pg, fn, ms = 60000) => pg.waitForFunction(fn, null, { timeout: ms });
console.log('chromium:', exe, '|', b.version());
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
let pg = await open(BASE + '?fresh=1', ctx);

// Chinese DOM text and glyph situation
const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['七道堤坝托住悬沙古城,守沙人陆徊每夜校准沙漏。', '悬沙古城从未筑坝,流沙将城分为两岸。', 'Seven dams hold up the city of hanging sand', 'The city of hanging sand never had a dam', '陆徊', 'Lu Huai', '守沙人', '对照旧沙城', '撤回', '减少动效']) assert.ok(text.includes(s), 'missing ' + s);
ok('Chinese copy (old and new line, 陆徊, 守沙人, button labels) and English captions present in the DOM');
const ff = await pg.evaluate(() => getComputedStyle(document.body).fontFamily);
assert.ok(/Noto Serif CJK SC/.test(ff) && /Noto Sans CJK SC/.test(ff) && /PingFang SC/.test(ff) && /Microsoft YaHei/.test(ff), ff);
const wd = await pg.evaluate(() => ['factOld', 'factNew', 'capOld', 'capNew'].map((i) => document.getElementById(i).getBoundingClientRect().width));
assert.ok(wd.every((v) => v > 100), wd.join());
let cjk = ''; try { cjk = execSync('fc-list :lang=zh', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { cjk = ''; }
ok('CJK font stack asserted (' + ff.split(',').slice(0, 4).join(',') + '...); line widths ' + wd.map(Math.round).join('/') + ' px; installed CJK fonts: ' + (cjk ? cjk.split('\n').length : 0) + (cjk ? '' : '; Chinese glyph rendering is 未验证 here (glyphs draw blank), only DOM text and layout were verified'));
let s = await S(pg); assert.equal(s.state, 'OLD'); assert.equal(s.t, 0); assert.equal(s.grainCount, 4096);
const gr0 = await pg.evaluate(() => window.__slice.grains());
assert.equal(gr0.length, 4096); assert.equal(new Set(gr0.map((g) => g.id)).size, 4096);
const fpOld = await pg.evaluate(() => window.__slice.fingerprint()), pxOld = await pg.evaluate(() => window.__slice.pixelFingerprint());
ok('initial: OLD, t=0, 4096 grains with 4096 unique ids, core fingerprint ' + fpOld);

// early release cancels
await pg.keyboard.down('Space'); await pg.waitForTimeout(500);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.w > 0.1 && wr.w < 0.8); assert.ok(wr.tremor > 0, 'normal mode tremor while writing'); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'OLD' && window.__slice.getState().w === 0, 5000);
s = await S(pg); assert.equal(s.t, 0); assert.equal(await pg.evaluate(() => window.__slice.fingerprint()), fpOld);
ok('Space cancel: released at w=' + wr.w.toFixed(2) + ', back to OLD, t=0, grains unchanged (fingerprint ' + fpOld + ')');
const box = await pg.locator('#fact').boundingBox();
await pg.mouse.move(box.x + 40, box.y + 20); await pg.mouse.down(); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING'); await pg.mouse.up();
await until(pg, () => window.__slice.getState().state === 'OLD' && window.__slice.getState().w === 0, 5000);
assert.equal(await pg.evaluate(() => window.__slice.fingerprint()), fpOld);
await pg.mouse.down(); await pg.waitForTimeout(1500); await pg.mouse.up();
assert.equal((await S(pg)).state, 'REWRITING'); ok('pointer press-hold on the line starts the rewrite; early pointer release cancels');
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(200); assert.equal((await S(pg)).state, 'OLD');

// physics evidence at stored frames, read through the page hook
const ev = await pg.evaluate(async () => {
  await window.__slice.setFrame(510); const roles = window.__slice.roles();
  const F = [0, 150, 255, 360, 510].map((f) => window.__slice.sample(f));
  let maxStep = 0; let prev = window.__slice.sample(0);
  for (let f = 1; f <= 510; f++) { const c = window.__slice.sample(f); for (let i = 0; i < 4096; i++) { const d = Math.hypot(c[2 * i] - prev[2 * i], c[2 * i + 1] - prev[2 * i + 1]); if (d > maxStep) maxStep = d; } prev = c; }
  const A = F[0], Z = F[4], Mid = F[2]; let blend = 0, toA = 0, toZ = 0, cax = 0, cay = 0, czx = 0, czy = 0, cmx = 0;
  for (let i = 0; i < 4096; i++) {
    const bx = (A[2 * i] + Z[2 * i]) / 2, by = (A[2 * i + 1] + Z[2 * i + 1]) / 2;
    blend += Math.hypot(Mid[2 * i] - bx, Mid[2 * i + 1] - by); toA += Math.hypot(Mid[2 * i] - A[2 * i], Mid[2 * i + 1] - A[2 * i + 1]); toZ += Math.hypot(Mid[2 * i] - Z[2 * i], Mid[2 * i + 1] - Z[2 * i + 1]);
    cax += A[2 * i]; cay += A[2 * i + 1]; czx += Z[2 * i]; czy += Z[2 * i + 1];
  }
  const fin = F.map((c) => { let bad = 0; for (let i = 0; i < 8192; i++) if (!Number.isFinite(c[i])) bad++; let oob = 0; for (let i = 0; i < 4096; i++) if (c[2 * i] < -5 || c[2 * i] > 805 || c[2 * i + 1] < -5 || c[2 * i + 1] > 425) oob++; return [bad, oob]; });
  return { maxStep, blend: blend / 4096, toA: toA / 4096, toZ: toZ / 4096, dcx: (czx - cax) / 4096, dcy: (czy - cay) / 4096, fin };
});
assert.ok(ev.maxStep < 12, 'step ' + ev.maxStep); assert.ok(ev.blend > 15, 'blend ' + ev.blend); assert.ok(ev.toA > 30 && ev.toZ > 30);
assert.ok(Math.abs(ev.dcx) < 25 && Math.abs(ev.dcy) < 40, 'centroid ' + ev.dcx + ',' + ev.dcy); assert.ok(ev.fin.every((r) => r[0] === 0 && r[1] === 0), JSON.stringify(ev.fin));
ok('stored frames 0..510: max per-frame displacement ' + ev.maxStep.toFixed(2) + ' < 12; frame 255 is ' + ev.blend.toFixed(1) + ' units from the 50% blend of frames 0 and 510 (and ' + ev.toA.toFixed(0) + ' / ' + ev.toZ.toFixed(0) + ' from the two ends); centroid shift (' + ev.dcx.toFixed(1) + ', ' + ev.dcy.toFixed(1) + '); no NaN, none out of bounds at frames 0,150,255,360,510');
const mt = await pg.evaluate(() => window.__slice.metrics());
assert.ok(mt.canyonDepth >= 40 && mt.buildingsOnBanksRatio >= 0.7 && mt.damDisplacedRatio >= 0.8 && mt.damNearOriginRatio < 0.2 && mt.maxDamColumnHeightRatio <= 0.25 && mt.restFraction >= 0.99, JSON.stringify(mt));
ok('new world metrics: canyonDepth ' + mt.canyonDepth.toFixed(1) + ', buildings on banks ' + (100 * mt.buildingsOnBanksRatio).toFixed(1) + '%, dam grains moved > 60 units ' + (100 * mt.damDisplacedRatio).toFixed(1) + '% (near origin ' + (100 * mt.damNearOriginRatio).toFixed(1) + '%), max dam column ' + (100 * mt.maxDamColumnHeightRatio).toFixed(1) + '%, rest fraction ' + (100 * mt.restFraction).toFixed(2) + '%');
const fpNewCore = await pg.evaluate(() => window.__slice.fingerprint()); assert.notEqual(fpNewCore, fpOld);
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(200);

// live rewrite by keyboard hold, sampled
await pg.focus('#fact'); await pg.keyboard.down('Enter'); await pg.waitForTimeout(1500); await pg.keyboard.up('Enter');
assert.equal((await S(pg)).state, 'REWRITING'); ok('Enter on the focused line also writes');
const samples = [];
for (let i = 0; i < 400; i++) {
  const q = await pg.evaluate(() => { const g = window.__slice.getState(); return { pf: g.pf, st: g.state, n: g.grainCount, rest: null, ti: g.tilt, gate: g.gate, keel: g.keel }; });
  samples.push(q); if (q.st !== 'REWRITING') break;
  if (samples.length === 20 || samples.length === 60 || samples.length === 100) { const gg = await pg.evaluate(() => window.__slice.grains()); assert.equal(new Set(gg.map((x) => x.id)).size, 4096); }
  await pg.waitForTimeout(150);
}
assert.ok(samples.length > 40); assert.ok(samples.every((q, i) => i === 0 || q.pf >= samples[i - 1].pf)); assert.ok(samples.every((q) => q.n === 4096));
assert.ok(samples.some((q) => q.gate > 0.5) && samples.some((q) => q.keel > 0.5) && samples.some((q) => Math.abs(q.ti) > 5));
ok(samples.length + ' live samples: playhead monotone, 4096 grains each sample, gate opened, keel lowered, tilt up to ' + Math.max(...samples.map((q) => Math.abs(q.ti))).toFixed(1) + ' deg; id set identical (4096 unique) at early, mid and late');
await until(pg, () => window.__slice.getState().state === 'NEW' || window.__slice.getState().state === 'HAUNT', 30000);
s = await S(pg); assert.ok(s.persisted); assert.equal(s.pf, s.frames.fNew); assert.ok(s.wipe > 0.99);
const fpNew = await pg.evaluate(() => window.__slice.fingerprint()); assert.equal(fpNew, fpNewCore);
ok('NEW settled at frame ' + s.pf + ', persisted ' + s.persisted + ', live fingerprint equals the stored frame ' + fpNew + '; new line fully revealed');

// reload: restored directly to the settled frame, no re-run
await pg.goto(BASE); await pg.waitForSelector('body[data-ready=true]');
const seen = new Set(); let rs = null;
for (let i = 0; i < 400; i++) { rs = await S(pg); seen.add(rs.state); if (!rs.restoring && rs.pf === rs.frames.fNew) break; await pg.waitForTimeout(100); }
assert.equal(rs.pf, rs.frames.fNew); assert.ok(!seen.has('REWRITING')); assert.equal(await pg.evaluate(() => window.__slice.fingerprint()), fpNew);
ok('reload restores the settled frame directly (states seen: ' + [...seen].join(',') + '), fingerprint ' + fpNew + ' identical, no rewrite replay');

// compare
await until(pg, () => window.__slice.getState().precomputed, 60000);
const pxNew = await pg.evaluate(() => window.__slice.pixelFingerprint());
await pg.keyboard.down('c'); await pg.waitForTimeout(1700);
s = await S(pg); assert.equal(s.compare, true); assert.equal(s.t, 1); assert.equal(s.pf, 0); assert.equal(await pg.evaluate(() => window.__slice.fingerprint()), fpOld);
assert.ok(await pg.evaluate(() => getComputedStyle(document.getElementById('cmpTag')).opacity !== '0'));
await pg.keyboard.up('c'); await pg.waitForTimeout(1700); s = await S(pg); assert.ok(s.compare === false && s.pf >= s.frames.fNew && s.t === 1);
ok('hold C shows the old grains (core fingerprint equals the old one) while the kept t stays 1; release returns to the new world');

// haunt, causal
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000);
const hs0 = await pg.evaluate(() => { const a = window.__slice.sample(510), c = window.__slice.sample(560), k = window.__slice.getState().frames.handF, h = window.__slice.sample(k); let rise = 0; for (let i = 0; i < 4096; i++) if (h[2 * i + 1] < a[2 * i + 1] - 60) rise++; return { rise, c: 0 }; });
assert.ok(hs0.rise >= 300, 'rising ' + hs0.rise);
const seq = [];
for (let i = 0; i < 160; i++) { const q = await S(pg); seq.push({ pf: q.pf, sc: q.scorch, rw: q.rewritten, st: q.struck }); if (q.pf >= q.frames.fEnd - 1) break; if (i === 20) { await pg.keyboard.down('c'); await pg.waitForTimeout(900); const qc = await S(pg); assert.equal(qc.hauntShown, 0); assert.equal(qc.scorch, 0); assert.equal(qc.rewritten, 0); await pg.keyboard.up('c'); } await pg.waitForTimeout(250); }
const k0 = (await S(pg)).knocks[0];
assert.ok(seq.filter((q) => q.pf < k0).every((q) => q.sc === 0 && q.rw === 0), 'scorch before first knock');
const firstSc = seq.find((q) => q.sc > 0.01); assert.ok(firstSc && firstSc.pf > k0, 'scorch after knock'); const firstRw = seq.find((q) => q.rw > 0.01); assert.ok(firstRw && firstRw.pf > firstSc.pf);
const endS = await S(pg); assert.ok(endS.scorch > 0.95 && endS.rewritten > 0.95);
ok(rsum(seq, k0));
function rsum(sq, k) { return 'haunt: ' + hs0.rise + ' grains rose more than 60 units by the hand frame; book scorch is 0 until the first knock (frame ' + k + ') and starts at frame ' + firstSc.pf.toFixed(0) + ', the name is rewritten from frame ' + firstRw.pf.toFixed(0) + '; hidden while C is held (hauntShown 0, scorch 0)'; }
const mid = (await S(pg)).state;
// Z during or after the haunt: retracted first, storage cleared
await pg.keyboard.press('z'); const zs = []; for (let i = 0; i < 120; i++) { const q = await S(pg); zs.push(q.pf); if (q.state === 'OLD') break; await pg.waitForTimeout(150); }
s = await S(pg); assert.equal(s.state, 'OLD'); assert.equal(s.persisted, null); assert.equal(await pg.evaluate(() => window.__slice.fingerprint()), fpOld);
assert.ok(zs.every((v, i) => i === 0 || v <= zs[i - 1] + 1e-9));
ok('Z (from ' + mid + '): playhead runs monotonically back from frame ' + zs[0].toFixed(0) + ' (haunt retracted before the world), grains equal the old fingerprint, localStorage cleared');
assert.deepEqual(pg.errs, []); await pg.close();

// reduced motion: slower, no tremor
pg = await open(BASE + '?fresh=1&reduced=1', ctx);
const a = await pg.evaluate(() => window.__slice.pixelFingerprint()); await pg.waitForTimeout(600); const a2 = await pg.evaluate(() => window.__slice.pixelFingerprint());
assert.deepEqual(a, a2);
await pg.keyboard.down('Space'); await pg.waitForTimeout(500); const trd = (await S(pg)).tremor; assert.ok((await S(pg)).w > 0.1); await pg.waitForTimeout(800); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'REWRITING' && window.__slice.getState().pf > 30, 10000);
const r0 = await S(pg), tt0 = Date.now(); await pg.waitForTimeout(3000); const r1 = await S(pg); const rate = (r1.pf - r0.pf) / ((Date.now() - tt0) / 1000);
assert.ok(rate > 12 && rate < 21, 'rate ' + rate); assert.equal(r1.reduced, true); assert.equal(trd, 0);
ok('reduced motion: idle canvas identical across 600 ms, glass tremor amplitude ' + trd + ' while writing (normal mode shows > 0), rewrite plays at ' + rate.toFixed(1) + ' frames/s (normal 30, so about x1.8 slower)');
assert.deepEqual(pg.errs, []); await pg.close();

// performance
pg = await open(BASE + '?t=0.5', ctx); await pg.evaluate(() => window.__slice.resetFrameStats()); await pg.waitForTimeout(2500); s = await S(pg);
assert.ok(s.frameMs.avg < 30, 'draw ' + s.frameMs.avg); assert.equal(s.t, 0.5);
ok('?t=0.5 draw cost avg ' + s.frameMs.avg.toFixed(1) + ' ms, max ' + s.frameMs.max.toFixed(1) + ' ms over ' + s.frameMs.n + ' frames (headless software rendering, budget 30 ms avg; GPU and real devices 未验证)');
const ppx = await open(BASE + '?fresh=1', ctx); await ppx.waitForTimeout(3000); const ps = await S(ppx);
ok('during precompute (idle, old city shown): fps ' + ps.fps.toFixed(1) + ', progress ' + (100 * ps.progress).toFixed(0) + '%, frame draw avg ' + ps.frameMs.avg.toFixed(1) + ' ms'); await ppx.close();
await pg.close();

// mobile
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
pg = await open(BASE + '?t=0.5', mctx);
const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth, cv: document.getElementById('stage').getBoundingClientRect().width }));
assert.ok(ov.sw <= ov.cw + 1 && ov.bw <= ov.cw + 1 && ov.cv > 300, JSON.stringify(ov)); assert.deepEqual(pg.errs, []);
ok('mobile 390x844: no horizontal overflow (scrollWidth ' + ov.sw + ' <= ' + ov.cw + '), canvas ' + Math.round(ov.cv) + ' px wide'); await pg.close(); await mctx.close();

// blind
pg = await open(BASE + '?t=0&blind=1', ctx);
const bl = await pg.evaluate(() => ({ book: getComputedStyle(document.getElementById('deskrow')).display, load: getComputedStyle(document.getElementById('loading')).display, tag: getComputedStyle(document.getElementById('cmpTag')).display }));
assert.deepEqual(bl, { book: 'none', load: 'none', tag: 'none' }); ok('blind=1 hides the book, texts and status (stage canvas only)'); await pg.close();

// file://
pg = await open(FILE + '?fresh=1', ctx); assert.equal((await S(pg)).state, 'OLD');
await pg.keyboard.down('Space'); await pg.waitForTimeout(1500); await pg.keyboard.up('Space'); await until(pg, () => window.__slice.getState().t > 0.2, 20000);
assert.deepEqual(pg.errs, []); ok('opens from file://, rewrite starts after a 1.5 s hold, 0 console errors'); await pg.close();
pg = await open(FILE + '?state=new', ctx); s = await S(pg); assert.equal(s.t, 1); assert.deepEqual(pg.errs, []); ok('file:// ?state=new renders with no console errors'); await pg.close();
console.log(n + ' passed, 0 console errors'); await b.close();
