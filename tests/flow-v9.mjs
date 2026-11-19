// Browser checks for V9 in headless Chromium. Usage (repo root): python3 -m http.server 8000 & node tests/flow-v9.mjs
// Runs the full flow over http, then a short load/rewrite check over file://.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { launch, exe } from './pw-v9.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v9/index.html';
const FILE = 'file://' + process.cwd() + '/rewrite-v9/index.html';
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
const D = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1]);
console.log('chromium:', exe, '|', b.version());
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
let pg = await open(BASE + '?fresh=1', ctx);

// Chinese DOM text and glyph situation
const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['北辰七星引航,归港者循第七星的方位穿越迷雾海。', '北辰从来只有六星,第七颗星从未存在。', 'Seven stars of the North Star guide the ships', 'The North Star has only ever had six stars. The seventh star never existed.', '沈归舟', 'Shen Guizhou', '引航者', '对照旧星象', '撤回', '减少动效']) assert.ok(text.includes(s), 'missing ' + s);
ok('Chinese copy (old and new line, 沈归舟, 引航者, button labels) and English captions present in the DOM');
const ff = await pg.evaluate(() => getComputedStyle(document.body).fontFamily);
assert.ok(/Noto Serif CJK SC/.test(ff) && /SimSun/.test(ff) && /Songti SC/.test(ff), ff);
let cjk = ''; try { cjk = execSync('fc-list :lang=zh', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { cjk = ''; }
ok('CJK font stack asserted (' + ff.split(',').slice(0, 3).join(',') + '...); installed CJK fonts: ' + (cjk ? cjk.split('\n').length : 0) + (cjk ? '' : '; Chinese glyph rendering is 未验证 here (glyphs draw blank), only DOM text was verified'));
let s = await S(pg); assert.equal(s.state, 'OLD'); assert.equal(s.t, 0); assert.equal(s.drawnWorlds, 1);
const fOld = await FP(pg);
ok('initial: OLD, t=0, one world drawn per frame (drawnWorlds=1, ' + s.worldPasses + ' colour passes of the same geometry)');

// early release cancels
await pg.keyboard.down('Space'); await pg.waitForTimeout(500);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.w > 0.1 && wr.w < 0.8); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'OLD' && window.__slice.getState().w === 0, 5000);
s = await S(pg); assert.equal(s.t, 0); const dOld = dist(fOld, await FP(pg)); assert.ok(dOld < 5, 'fingerprint drift ' + dOld);
assert.deepEqual(s.rings.theta, [72, 52, 23, 0]);
ok('Space cancel: released at w=' + wr.w.toFixed(2) + ', back to OLD, t=0, ring angles unchanged [72,52,23,0], fingerprint drift ' + dOld.toFixed(2));
const box = await pg.locator('#fact').boundingBox();
await pg.mouse.move(box.x + 40, box.y + 20); await pg.mouse.down(); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING'); await pg.mouse.up();
await until(pg, () => window.__slice.getState().state === 'OLD' && window.__slice.getState().w === 0, 5000);
await pg.mouse.down(); await pg.waitForTimeout(1500); await pg.mouse.up();
assert.equal((await S(pg)).state, 'REWRITING'); ok('pointer press-hold 1.2 s on the line starts the rewrite; early pointer release cancels');
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(200);

// hold rewrite with keyboard, sample the live rewrite: same world, continuous
await pg.focus('#fact'); await pg.keyboard.down('Enter'); await pg.waitForTimeout(1500); await pg.keyboard.up('Enter');
assert.equal((await S(pg)).state, 'REWRITING'); ok('Enter on the focused line also writes');
const samples = [];
for (let i = 0; i < 400; i++) {
  const q = await pg.evaluate(() => { const g = window.__slice.getState(), a = window.__slice.anchors(), o = {}; a.forEach((x) => { o[x.id] = x.client; }); return { t: g.t, th: g.rings.theta, lens: g.lens.x, dw: g.drawnWorlds, st: g.state, ph: o.pier7, lh: o.lighthouse, n: a.length, sink7: g.sink7 }; });
  samples.push(q); if (q.st !== 'REWRITING') break; await pg.waitForTimeout(150);
}
assert.ok(samples.length > 25, 'samples ' + samples.length);
assert.ok(samples.every((q) => q.dw === 1 && q.n === 91));
assert.ok(samples.every((q, i) => i === 0 || (q.t >= samples[i - 1].t && Math.abs(q.th[0] - samples[i - 1].th[0]) < 8 && D(q.lh, samples[i - 1].lh) < 60)));
const first = samples[0], lastS = samples[samples.length - 1];
const turned = first.th.map((v, i) => Math.abs(lastS.th[i] - v)); assert.ok(turned.filter((d) => d > 15).length >= 2, turned.join());
assert.ok(D(first.lh, lastS.lh) > 100); assert.ok(samples.some((q) => q.t > 0.3 && q.t < 0.7 && q.lh));
ok(samples.length + ' live samples during the 9 s rewrite: t monotone, 91 anchors every sample, 1 world drawn each frame, no jump above 60 px for the lighthouse, ring angle changes ' + turned.map((d) => d.toFixed(0)).join('/') + ' deg, lighthouse travelled ' + D(first.lh, lastS.lh).toFixed(0) + ' px');
await until(pg, () => window.__slice.getState().state === 'NEW', 30000);
s = await S(pg); assert.equal(s.t, 1); assert.ok(s.persisted); assert.equal(s.sink7, 1); assert.equal(s.star7, 0); assert.deepEqual(s.rings.theta.map(Math.round), [34, 25, 0, 14]);
ok('NEW settled and persisted ' + s.persisted + '; ring angles [34,25,0,14], pier VII sunk (sink7=1), star VII aperture closed');
const nameVis = await pg.evaluate(() => document.getElementById('factNew').getBoundingClientRect().width > 0 && getComputedStyle(document.getElementById('factNew')).clipPath);
assert.ok(s.wipe > 0.99); ok('rewritten sentence fully revealed (wipe ' + s.wipe.toFixed(2) + ', clip-path ' + nameVis + ')');

// continuity from rendered pixels: mid frames are not a 50% mix of t=0 and t=1
const fp = await open(BASE + '?t=0', ctx);
const at = async (t) => { await fp.evaluate((v) => window.__slice.setProgress(v), t); await fp.waitForTimeout(250); return FP(fp); };
const f0 = await at(0), f1 = await at(1), full = dist(f0, f1); let out = [];
for (const t of [0.25, 0.5, 0.75]) { const f = await at(t), mix = f0.map((v, i) => 0.5 * (v + f1[i])), dm = dist(f, mix); out.push(`t=${t}: |frame-mix|=${dm.toFixed(2)}`); if (t === 0.5) assert.ok(dm > 2, 'mid frame looks like a cross-fade: ' + dm); }
const fe = await at(0.25), fm = await at(0.5), fl = await at(0.75); assert.ok(dist(fe, fm) > 1.5 && dist(fm, fl) > 1.5 && dist(fe, fl) > 2);
// ring angles at those t differ from both ends (same orrery, different pose)
const th = []; for (const t of [0, 0.25, 0.5, 0.75, 1]) { await fp.evaluate((v) => window.__slice.setProgress(v), t); th.push((await S(fp)).rings.theta); }
for (let i = 1; i < th.length; i++) assert.notDeepEqual(th[i], th[i - 1]);
ok('pixel fingerprints (32x18 luma, |t0-t1|=' + full.toFixed(2) + ') at mid are not a 50% mix: ' + out.join('; ') + '; early/mid/late pairwise ' + dist(fe, fm).toFixed(2) + ', ' + dist(fm, fl).toFixed(2) + ', ' + dist(fe, fl).toFixed(2) + '; ring angles differ at each of 5 stops');
await fp.close();

// compare keeps t
const fNew = await FP(pg);
await pg.keyboard.down('c'); await pg.waitForTimeout(900);
s = await S(pg); assert.equal(s.compare, true); assert.equal(s.t, 1); assert.ok(s.td < 0.01); const fCmp = await FP(pg); assert.ok(dist(fNew, fCmp) > 3);
assert.ok(await pg.evaluate(() => document.getElementById('cmpTag') && getComputedStyle(document.getElementById('cmpTag')).opacity !== '0'), 'compare tag hidden');
await pg.keyboard.up('c'); await pg.waitForTimeout(900); s = await S(pg); assert.ok(s.td > 0.999 && s.compare === false && dist(fNew, await FP(pg)) < dist(fNew, fCmp));
ok('hold C shows the old orrery (shown t 0, fingerprint change ' + dist(fNew, fCmp).toFixed(1) + ') while real t stays 1; release returns to the new one');

// haunt, causal
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000);
const path = [];
for (let i = 0; i < 60; i++) { const q = await S(pg); if (q.handTip && q.haunt > 0.02) path.push({ x: q.handTip[0], y: q.handTip[1], h: q.haunt }); if (q.haunt >= 1) break; await pg.waitForTimeout(250); }
await pg.keyboard.down('c'); await pg.waitForTimeout(800); s = await S(pg); assert.equal(s.hauntShown, 0); await pg.keyboard.up('c');
await until(pg, () => window.__slice.getState().haunt >= 1, 30000); await pg.waitForTimeout(900);
const qe = await S(pg), fb = await pg.locator('#fact').boundingBox(), sb = await pg.locator('#stage').boundingBox(), k = sb.width / 960;
assert.ok(path.length > 12, 'samples ' + path.length);
const travelled = path.reduce((a, p, i) => a + (i ? Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) : 0), 0); assert.ok(travelled > 200, 'hand travel ' + travelled);
assert.ok(D(qe.handTip, [qe.lensStar7[0] * k + sb.x, qe.lensStar7[1] * k + sb.y]) < 3, 'hand does not end on the star VII position');
assert.ok(qe.beamEnd[0] > fb.x && qe.beamEnd[0] < fb.x + fb.width && Math.abs(qe.beamEnd[1] - fb.y) < 60, `beam end ${qe.beamEnd} vs line ${JSON.stringify(fb)}`);
assert.ok(qe.scorch > 0.95 && qe.name > 0.95 && await pg.evaluate(() => document.body.dataset.erased) === 'true');
assert.equal(qe.holes.length, 7);
ok('haunt: hand travelled ' + travelled.toFixed(0) + ' px over ' + path.length + ' samples, ended on the mirrored star VII position, beam end (' + qe.beamEnd.map((v) => v.toFixed(0)) + ') lands on the rewritten line (x ' + fb.x.toFixed(0) + '..' + (fb.x + fb.width).toFixed(0) + ', top y ' + fb.y.toFixed(0) + '), register name struck (erased=true), scorch ' + qe.scorch.toFixed(2) + '; hidden while comparing');
const striked = await pg.evaluate(() => { const cs = getComputedStyle(document.querySelector('#keeper'), '::after'); return cs.width; }); assert.ok(parseFloat(striked) > 20, 'strike width ' + striked); ok('strike-through under 沈归舟 is ' + striked + ' wide');
// causality: before NEW there is no haunt; the haunt only exists with t=1
const pre = await open(BASE + '?t=0.6', ctx); const ps = await pre.evaluate(() => ({ g: window.__slice.getState(), e: document.body.dataset.erased })); assert.equal(ps.g.hauntShown, 0); assert.equal(ps.e, 'false'); await pre.close();
ok('no haunt at t=0.6 (the anomaly appears only after the new world has settled)');

// Z undo
await pg.keyboard.press('z'); await until(pg, () => window.__slice.getState().state === 'OLD', 20000);
s = await S(pg); assert.equal(s.t, 0); assert.equal(s.haunt, 0); assert.equal(s.persisted, null); assert.deepEqual(s.rings.theta, [72, 52, 23, 0]);
ok('Z reverses: haunt removed, t back to 0, ring angles back to [72,52,23,0], storage cleared');
assert.deepEqual(pg.errs, []); await pg.close();

// persistence and reload
pg = await open(BASE + '?fresh=1', ctx); await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'NEW', 30000); assert.ok((await S(pg)).persisted);
await pg.goto(BASE); await pg.waitForSelector('body[data-ready=true]'); await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3);
s = await S(pg); assert.ok(s.t === 1 && (s.state === 'NEW' || s.state === 'HAUNT')); await until(pg, () => window.__slice.getState().state === 'HAUNT', 10000);
ok('reload keeps the new world (t=1) and replays the haunt'); await pg.close();

// reduced motion: continuous, slower, no flicker
pg = await open(BASE + '?fresh=1&reduced=1', ctx);
const a = await FP(pg); await pg.waitForTimeout(700); const dr = dist(a, await FP(pg)); assert.ok(dr < 0.01, 'ambient motion in reduced mode ' + dr);
await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space');
const rs = []; for (let i = 0; i < 12; i++) { const q = await S(pg); rs.push({ t: q.t, th: q.rings.theta[0], at: Date.now() }); await pg.waitForTimeout(250); }
assert.ok(rs.every((q, i) => i === 0 || (q.t >= rs[i - 1].t && Math.abs(q.th - rs[i - 1].th) < 3)) && rs[rs.length - 1].t > rs[0].t + 0.05, 'reduced rewrite not continuous');
const rate = (rs[rs.length - 1].t - rs[0].t) / ((rs[rs.length - 1].at - rs[0].at) / 1000); assert.ok(rate < 0.09 && rate > 0.03, 'rate ' + rate);
const nb = await open(BASE + '?fresh=1', ctx); const a2 = await FP(nb); await nb.waitForTimeout(700); const dn = dist(a2, await FP(nb)); assert.ok(dn > 0.01, 'normal mode should have ambient motion ' + dn); await nb.close();
assert.equal((await S(pg)).reduced, true); assert.deepEqual(pg.errs, []);
ok('reduced motion: idle drift ' + dr.toFixed(4) + ' vs ' + dn.toFixed(3) + ' in normal mode; the rewrite still runs continuously (t monotone, ring step < 3 deg per 250 ms) at about ' + rate.toFixed(3) + ' t/s (normal 0.111, x1.8 slower is 0.062)');
await pg.close();

// performance
pg = await open(BASE + '?t=0.5', ctx); await pg.evaluate(() => window.__slice.resetFrameStats()); await pg.waitForTimeout(2500); s = await S(pg); assert.equal(s.t, 0.5); assert.ok(s.frameMs.avg < 40, 'frame ms ' + s.frameMs.avg);
ok('?t=0.5 draw cost avg ' + s.frameMs.avg.toFixed(1) + ' ms, max ' + s.frameMs.max.toFixed(1) + ' ms over ' + s.frameMs.n + ' frames (headless software rendering, budget 40 ms; GPU and real devices 未验证)'); await pg.close();

// mobile
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
pg = await open(BASE + '?t=0.5', mctx);
const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
assert.ok(ov.sw <= ov.cw + 1 && ov.bw <= ov.cw + 1, JSON.stringify(ov)); assert.deepEqual(pg.errs, []);
ok('mobile 390x844: no horizontal overflow (scrollWidth ' + ov.sw + ' <= ' + ov.cw + ')'); await pg.close(); await mctx.close();

// file://
pg = await open(FILE + '?fresh=1', ctx); assert.equal((await S(pg)).state, 'OLD');
await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space'); await until(pg, () => window.__slice.getState().t > 0.3, 20000); assert.ok((await S(pg)).drawnWorlds === 1);
assert.deepEqual(pg.errs, []); ok('opens from file://, rewrite starts after a 1.4 s hold, 0 console errors'); await pg.close();
pg = await open(FILE + '?state=new', ctx); assert.equal((await S(pg)).t, 1); assert.deepEqual(pg.errs, []); ok('file:// ?state=new renders with no console errors'); await pg.close();
console.log(n + ' passed, 0 console errors'); await b.close();
