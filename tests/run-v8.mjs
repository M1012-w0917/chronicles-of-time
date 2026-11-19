// Unit tests for rewrite-v8/core.js plus a syntax check of every V8 script. Usage: node tests/run-v8.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('../rewrite-v8/core.js');
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
const step = (m, ms, dt = 50) => { for (let t = 0; t < ms; t += dt) m.step(dt); };

for (const f of readdirSync(new URL('../rewrite-v8/', import.meta.url)).filter((x) => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', new URL('../rewrite-v8/' + f, import.meta.url).pathname]);
ok('node --check passes for every rewrite-v8 script');

for (const k of ['old', 'neu']) assert.ok(/[\u4e00-\u9fff]/.test(C.FACT[k].zh) && /^[A-Z]/.test(C.FACT[k].en));
assert.equal(C.FACT.old.zh, '七座石桥连接两岸,守桥人陶砚夜夜在桥心守灯。');
assert.equal(C.FACT.neu.zh, '此地从来没有桥,只有断裂峡湾。');
ok('both sentences exist verbatim in Chinese with English captions');

const t0 = Date.now(); C.ensure(); const ms = Date.now() - t0;
ok('deterministic precompute of ' + C.FRAMES + ' snapshots on a ' + C.NX + 'x' + C.NY + ' grid took ' + ms + ' ms in node');
const S = C.snapshots();
assert.equal(S.H.length, C.FRAMES);
for (const nm of ['H', 'G', 'T', 'U']) for (const a of S[nm]) for (let k = 0; k < C.NC; k += 7) assert.ok(Number.isFinite(a[k]), nm + ' finite');
for (const a of S.G) for (let k = 0; k < C.NC; k++) assert.ok(a[k] >= 0, 'glaze thickness never negative');
ok('all four fields are finite and the glaze thickness stays non-negative in every snapshot');

// volume conservation against the ledger of added settlement mass
let worst = 0; for (let f = 0; f <= 60; f++) worst = Math.max(worst, C.metrics(f / 60).volumeErr);
assert.ok(worst < 1e-6, 'volume error ' + worst);
ok('volume conservation: max |V - V0 - added| / V0 over 61 samples is ' + worst.toExponential(2) + ' (tolerance 1e-6)');

// bridge height monotone non-increasing, fjord monotone non-decreasing (tolerance stated)
let up = 0, back = 0, prev = C.metrics(0);
const mb0 = prev.maxBridge, fw0 = prev.fjordWidth;
for (let f = 1; f <= 120; f++) { const m = C.metrics(f / 120); up = Math.max(up, m.maxBridge - prev.maxBridge); back = Math.max(back, prev.fjordWidth - m.fjordWidth); prev = m; }
assert.ok(up <= 1e-9, 'bridge rose by ' + up);
assert.ok(back < 0.5, 'fjord narrowed by ' + back);
const m1 = C.metrics(1);
assert.ok(m1.maxBridge < 0.02 * mb0 && fw0 === 0 && m1.fjordWidth > 40);
ok('max bridge height is monotone non-increasing (largest rise ' + up.toExponential(1) + '): ' + mb0.toFixed(4) + ' at t=0 to ' + m1.maxBridge.toFixed(4) + ' at t=1');
ok('fjord width is non-decreasing within a 0.5 cell tolerance (largest narrowing ' + back.toFixed(3) + ' cells, late settling): ' + fw0.toFixed(1) + ' to ' + m1.fjordWidth.toFixed(1) + ' cells of ' + C.NX);
for (let b = 0; b < 7; b++) assert.ok(C.metrics(0).bridges[b] > 0.04 && C.metrics(0.6).bridges[b] < C.metrics(0).bridges[b] * 0.2, 'bridge ' + b);
ok('each of the seven arches stands at t=0 and has sagged below 20% of its height at t=0.6');

// continuity: bounded per-cell change between adjacent samples (1/60 of t = 150 ms of rewrite)
const step1 = {};
for (const nm of ['H', 'G']) { let mx = 0; for (let f = 1; f < C.FRAMES; f++) for (let k = 0; k < C.NC; k++) mx = Math.max(mx, Math.abs(S[nm][f][k] - S[nm][f - 1][k])); step1[nm] = mx; }
assert.ok(step1.H < 0.05 && step1.G < 0.08, JSON.stringify(step1));
ok('max per-cell step between adjacent samples: H ' + step1.H.toFixed(4) + ' (bound 0.05, arch height ' + mb0.toFixed(3) + '), G ' + step1.G.toFixed(4) + ' (bound 0.08, G0 ' + C.G0 + ')');
const fa = C.fieldsAt(0.5), mid = new Float32Array(C.NC); let dm = 0, ds = 0;
for (let k = 0; k < C.NC; k++) { mid[k] = 0.5 * (S.H[0][k] + S.H[60][k]); dm += Math.abs(fa.H[k] - mid[k]); ds += Math.abs(S.H[60][k] - S.H[0][k]); }
assert.ok(dm / ds > 0.15);
ok('H at t=0.5 differs from the 50% mix of t=0 and t=1 by ' + (100 * dm / ds).toFixed(1) + '% of the total t=0 to t=1 change (not a cross-fade)');

// glaze flow follows the thermal gradient: correlate the vertical glaze centroid velocity with the vertical mean temperature gradient while heating
const xs = [], ys = [];
for (let f = 6; f <= 40; f++) { const m = C.metrics(f / 60); xs.push(m.gradT[1]); ys.push(m.glazeFlow[1]); }
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, mx = mean(xs), my = mean(ys);
const r = xs.reduce((s, v, i) => s + (v - mx) * (ys[i] - my), 0) / Math.sqrt(xs.reduce((s, v) => s + (v - mx) ** 2, 0) * ys.reduce((s, v) => s + (v - my) ** 2, 0));
assert.ok(r < -0.5, 'correlation ' + r);
ok('glaze flow vs thermal gradient: Pearson r = ' + r.toFixed(3) + ' over t=0.10..0.67 (negative: glaze runs from hot toward cold, peak centroid speed ' + Math.min(...ys).toFixed(2) + ' cells per unit t)');

// state machine
let m = C.createMachine();
m.press(); step(m, 500); assert.equal(m.state, 'WRITING'); assert.ok(m.w > 0.3 && m.w < 0.5); m.release(); step(m, 600);
assert.equal(m.state, 'OLD'); assert.equal(m.w, 0); assert.equal(m.t, 0);
ok('hold to write: early release cancels and drains back to old, t stays 0');
m = C.createMachine(); let settled = 0; m.onSettle = () => settled++;
m.press(); step(m, 1300); assert.equal(m.state, 'RECONSTRUCTING');
const ts = []; for (let i = 0; i < 20; i++) { step(m, 200); ts.push(m.t); }
assert.ok(ts.every((v, i) => i === 0 || v > ts[i - 1]) && ts[0] < 0.05);
step(m, 600); assert.ok(m.t > 0.4 && m.t < 0.6); step(m, 5000); assert.equal(m.state, 'NEW'); assert.equal(settled, 1);
step(m, 4100); assert.equal(m.state, 'HAUNT'); step(m, 13000); assert.equal(m.haunt, 1); assert.equal(settled, 1);
ok('hold 1.2 s starts a continuous 9 s rewrite (t strictly increasing), NEW settles once, haunt starts after 4 s and runs 12 s');

// haunt path
const bx = 0.72, hp = C.hauntPath(bx);
for (const [x, y] of hp.pts.slice(0, -1)) { const j = Math.round(y); assert.ok(C.BR_ROWS.includes(j), 'row ' + j); assert.ok(Math.abs(Math.abs(x - C.XC[j]) - (C.HW[j] + 1)) < 1e-4); }
const end = hp.pts[hp.pts.length - 1]; assert.ok(Math.abs(end[0] / (C.NX - 1) - bx) < 1e-6 && end[1] === C.NY - 5);
const h1 = C.hauntAt(1, bx), h0 = C.hauntAt(0, bx);
assert.ok(Math.abs(h1.fx - bx) < 1e-6 && h1.scorch === 1 && h1.name === 1 && h0.amp === 0);
for (let b = 0; b + 1 < 7; b++) assert.ok(hp.pts[2 * b][1] < hp.pts[2 * b + 2][1]);
ok('hauntAt path: 14 waypoints on the old deck lines of the seven bridges (far to near), endpoint at the book line x=' + (bx * (C.NX - 1)).toFixed(1) + ', scorch and name complete at h=1');
const pal = C.applyPalm(C.fieldsAt(1), 0.5, bx); const base = C.fieldsAt(1); let dH = 0, dG = 0;
for (let k = 0; k < C.NC; k++) { dH = Math.max(dH, pal.fields.H[k] - base.H[k]); dG = Math.max(dG, base.G[k] - pal.fields.G[k]); }
assert.ok(dH > 0.04 && dG > 0);
ok('palm is a real height bump: H raised by up to ' + dH.toFixed(3) + ', glaze thinned by up to ' + dG.toFixed(4));

m.setCompare(true); step(m, 600); assert.ok(m.c === 1 && m.t === 1 && m.view().hd === 0 && m.view().td === 0);
m.setCompare(false); step(m, 600); assert.ok(m.view().td === 1 && m.view().hd > 0.9);
ok('compare pulls the shown t and the haunt to old without touching real t, and releases back');
m.revert(); assert.equal(m.state, 'REVERTING'); step(m, 1600); assert.equal(m.haunt, 0); step(m, 2600); assert.equal(m.state, 'OLD'); assert.equal(m.t, 0);
ok('undo removes the haunt first and plays t in reverse to old in about 4 s');
let cleared = 0; m = C.createMachine(); m.onRevert = () => cleared++; m.revert(); assert.equal(cleared, 0); m.setProgress(1); m.revert(); assert.equal(cleared, 1);
ok('undo is a no-op before anything is written and fires the clear hook once otherwise');
m = C.createMachine({ reduced: true }); m.press(); step(m, 1300); step(m, 9000); assert.ok(m.t > 0.4 && m.t < 0.65 && m.state === 'RECONSTRUCTING');
ok('reduced motion stretches the same continuous t (x1.8) instead of cutting it');
console.log(n + ' passed');
