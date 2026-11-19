// Browser checks for V8. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v8.mjs
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { launch } from './pw-v8.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v8/index.html';
const b = await launch();
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForSelector('body[data-ready=true]', { timeout: 30000 });
  await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3, null, { timeout: 30000 }); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const FP = (pg) => pg.evaluate(() => window.__slice.fingerprint());
const dist = (a, c) => a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
const until = (pg, fn, ms = 60000) => pg.waitForFunction(fn, null, { timeout: ms });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
let pg = await open(BASE + '?fresh=1', ctx);

const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['七座石桥连接两岸,守桥人陶砚夜夜在桥心守灯。', '此地从来没有桥,只有断裂峡湾。', 'Seven stone bridges join the two banks', 'There has never been a bridge here, only a broken fjord.', '陶砚', 'Tao Yan']) assert.ok(text.includes(s), 'missing ' + s);
ok('Chinese copy and English captions present in the DOM');
const ff = await pg.evaluate(() => getComputedStyle(document.body).fontFamily);
assert.ok(/Noto Serif CJK SC/.test(ff) && /SimSun/.test(ff) && /Songti SC/.test(ff), ff);
let cjk = ''; try { cjk = execSync('fc-list :lang=zh', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { cjk = ''; }
ok('CJK font stack asserted: ' + ff.split(',').slice(0, 4).join(',') + '...; installed CJK fonts: ' + (cjk ? cjk.split('\n').length : 0) + (cjk ? '' : ' so Chinese glyph rendering is 未验证 in this sandbox (glyphs draw blank)'));
let s = await S(pg); assert.equal(s.state, 'OLD'); assert.equal(s.t, 0); assert.equal(s.ready, true);
const fOld = await FP(pg);
ok('initial: OLD, t=0, ready after precompute (' + (await pg.evaluate(() => window.__slice.precomputeMs)).toFixed(0) + ' ms in the page)');

// early release cancels
await pg.keyboard.down('Space'); await pg.waitForTimeout(500);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.w > 0.1 && wr.w < 0.8); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'OLD', 5000);
s = await S(pg); assert.equal(s.t, 0); const dOld = dist(fOld, await FP(pg)); assert.ok(dOld < 5, 'fingerprint drift ' + dOld);
ok('Space cancel: released at w=' + wr.w.toFixed(2) + ', back to OLD with t=0, fingerprint drift ' + dOld.toFixed(2));

// pointer hold
const box = await pg.locator('#fact').boundingBox();
await pg.mouse.move(box.x + 40, box.y + 20); await pg.mouse.down(); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING'); await pg.mouse.up(); await until(pg, () => window.__slice.getState().state === 'OLD', 5000);
await pg.mouse.down(); await pg.waitForTimeout(1500); await pg.mouse.up();
assert.equal((await S(pg)).state, 'RECONSTRUCTING'); ok('pointer press-hold 1.2 s on the line starts the rewrite, early pointer release cancels');
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(200);

// Enter
await pg.focus('#fact'); await pg.keyboard.down('Enter'); await pg.waitForTimeout(1500); await pg.keyboard.up('Enter');
assert.equal((await S(pg)).state, 'RECONSTRUCTING'); ok('Enter on the focused line also writes');

// real mid-rewrite sample with real metrics
await until(pg, () => window.__slice.getState().t > 0.3, 20000);
s = await S(pg); assert.ok(s.metrics.maxBridge < 0.045 && s.metrics.maxBridge > 0.01 && s.metrics.fjordWidth === 0, JSON.stringify(s.metrics));
ok('live rewrite at t=' + s.t.toFixed(2) + ': arches sagging (max bridge ' + s.metrics.maxBridge.toFixed(4) + ' of 0.1016), volume error ' + s.metrics.volumeErr.toExponential(1));
await until(pg, () => window.__slice.getState().t > 0.6, 20000);
s = await S(pg); assert.ok(s.metrics.fjordWidth > 20); ok('live rewrite at t=' + s.t.toFixed(2) + ': fjord width ' + s.metrics.fjordWidth.toFixed(1) + ' cells');
await until(pg, () => window.__slice.getState().state === 'NEW', 30000);
s = await S(pg); assert.equal(s.t, 1); assert.ok(s.persisted); assert.ok(s.wipe > 0.99);
const dry = await pg.evaluate(() => window.__slice.fieldSample(0.5, 0.5)); ok('NEW settled once and persisted ' + s.persisted + '; centre fjord H=' + dry.H.toFixed(3) + ' (floor -0.2)');

// continuity: mid-rewrite stills vs the 50% mix of t=0 and t=1 (frozen page so nothing advances)
const fp = await open(BASE + '?t=0', ctx);
const at = async (t) => { await fp.evaluate((v) => window.__slice.setProgress(v), t); await fp.waitForTimeout(250); return FP(fp); };
const f0 = await at(0), f1 = await at(1), full = dist(f0, f1);
const out = [];
for (const t of [0.25, 0.5, 0.75]) { const f = await at(t), mix = f0.map((v, i) => 0.5 * (v + f1[i])), dm = dist(f, mix), d0 = dist(f, f0), d1 = dist(f, f1); out.push(`t=${t}: |frame-mix|=${dm.toFixed(2)} |frame-t0|=${d0.toFixed(2)} |frame-t1|=${d1.toFixed(2)}`); if (t === 0.5) assert.ok(dm > 3, 'mid frame looks like a cross-fade: ' + dm); }
const fe = await at(0.25), fm = await at(0.5), fl = await at(0.75); assert.ok(dist(fe, fm) > 2 && dist(fm, fl) > 2 && dist(fe, fl) > 2);
ok('mid-rewrite fingerprints (32x12 luma, |t0-t1|=' + full.toFixed(2) + ') are not a 50% mix: ' + out.join('; ') + '; early/mid/late pairwise ' + dist(fe, fm).toFixed(2) + ', ' + dist(fm, fl).toFixed(2) + ', ' + dist(fe, fl).toFixed(2));
await fp.close();

// compare
const fNew = await FP(pg);
await pg.keyboard.down('c'); await pg.waitForTimeout(900);
s = await S(pg); assert.equal(s.compare, true); assert.equal(s.t, 1); assert.ok(s.td < 0.01); const fCmp = await FP(pg); assert.ok(dist(fNew, fCmp) > 3);
await pg.keyboard.up('c'); await pg.waitForTimeout(900); s = await S(pg); assert.ok(s.td > 0.999 && s.compare === false && dist(fNew, await FP(pg)) < dist(fNew, fCmp));
ok('hold C shows the old porcelain (shown t 0, fingerprint change ' + dist(fNew, fCmp).toFixed(1) + ') while real t stays 1, release returns to the new one');

// haunt: palm moves along the path and ends at the book line
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000);
const path = [];
for (let i = 0; i < 40; i++) { const q = await S(pg); if (q.handPos && q.handPos.amp > 0.5) path.push({ x: q.handPos.px, y: q.handPos.py, tr: q.handPos.travel, sc: q.scorch, nm: q.name }); if (q.haunt >= 1) break; await pg.waitForTimeout(400); }
await pg.keyboard.down('c'); await pg.waitForTimeout(800); s = await S(pg); assert.equal(s.hauntShown, 0); await pg.keyboard.up('c');
await until(pg, () => window.__slice.getState().haunt >= 1, 30000); await pg.waitForTimeout(900);
const qe = await S(pg), fb = await pg.locator('#fact').boundingBox();
assert.ok(path.length > 8, 'samples ' + path.length);
assert.ok(path.every((p, i) => i === 0 || p.tr >= path[i - 1].tr) && path[path.length - 1].tr > path[0].tr + 0.3);
const travelled = path.reduce((a, p, i) => a + (i ? Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) : 0), 0);
assert.ok(travelled > 300, 'screen travel ' + travelled);
const hx = qe.handPos.px, fcx = fb.x + fb.width / 2; assert.ok(Math.abs(hx - fcx) < 70, `palm x ${hx} vs line centre ${fcx}`);
assert.ok(qe.handPos.py < fb.y && qe.scorch > 0.95 && qe.name > 0.95 && await pg.evaluate(() => document.body.dataset.erased) === 'true');
ok('haunt: palm moved ' + travelled.toFixed(0) + ' px over ' + path.length + ' samples with monotone path progress, ends at x=' + hx.toFixed(0) + ' (line centre ' + fcx.toFixed(0) + '), scorch ' + qe.scorch.toFixed(2) + ', keeper name erased; hidden while comparing');
await pg.keyboard.press('z'); await until(pg, () => window.__slice.getState().state === 'OLD', 20000);
s = await S(pg); assert.equal(s.t, 0); assert.equal(s.haunt, 0); assert.equal(s.persisted, null);
ok('Z reverses: haunt removed, t back to 0, storage cleared');
assert.deepEqual(pg.errs, []); await pg.close();

// persistence and reload
pg = await open(BASE + '?fresh=1', ctx); await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'NEW', 30000); assert.ok((await S(pg)).persisted);
await pg.goto(BASE); await pg.waitForSelector('body[data-ready=true]'); await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3);
s = await S(pg); assert.ok(s.t === 1 && (s.state === 'NEW' || s.state === 'HAUNT')); await until(pg, () => window.__slice.getState().state === 'HAUNT', 10000);
ok('reload keeps the new world (t=1) and replays the haunt'); await pg.close();

// reduced motion
pg = await open(BASE + '?fresh=1&reduced=1', ctx);
const a = await FP(pg); await pg.waitForTimeout(700); const dr = dist(a, await FP(pg)); assert.ok(dr < 0.01, 'ambient motion in reduced mode ' + dr);
await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space'); await pg.waitForTimeout(3000);
const r1 = await S(pg); await pg.waitForTimeout(1000); const r2 = await S(pg); assert.ok(r2.t > r1.t && r2.reduced);
const rate = (r2.t - r1.t) / ((await Promise.resolve(1000)) / 1000);
const nb = await open(BASE + '?fresh=1', ctx); const a2 = await FP(nb); await nb.waitForTimeout(700); const dn = dist(a2, await FP(nb)); assert.ok(dn > 0.01, 'normal mode should have ambient motion ' + dn); await nb.close();
ok('reduced motion: idle drift ' + dr.toFixed(4) + ' vs ' + dn.toFixed(3) + ' in normal mode; t advances continuously at about ' + rate.toFixed(3) + ' per s (normal 0.111, x1.8 slower is 0.062)');
assert.equal(r2.reduced, true); assert.deepEqual(pg.errs, []); await pg.close();

// still params + frame cost
pg = await open(BASE + '?t=0.5', ctx); await pg.waitForTimeout(800); s = await S(pg); assert.equal(s.t, 0.5); assert.ok(s.frameMs.avg < 40, 'frame ms ' + s.frameMs.avg);
ok('?t=0.5 still renders, average draw ' + s.frameMs.avg.toFixed(1) + ' ms, max ' + s.frameMs.max.toFixed(1) + ' ms over ' + s.frameMs.n + ' frames (headless software rendering; GPU 未验证)'); await pg.close();
pg = await open('file://' + process.cwd() + '/rewrite-v8/index.html?state=new', ctx); assert.equal((await S(pg)).t, 1); assert.deepEqual(pg.errs, []); ok('opens from file:// with no console errors'); await pg.close();
console.log(n + ' passed, 0 console errors'); await b.close();
