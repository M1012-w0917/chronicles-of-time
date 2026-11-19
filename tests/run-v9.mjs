// Unit tests for rewrite-v9/core.js plus node --check of every V9 script. Usage: node tests/run-v9.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const C = createRequire(import.meta.url)('../rewrite-v9/core.js');
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const sweep = []; for (let i = 0; i <= 100; i++) sweep.push(i / 100);
const at = (t) => { const o = {}; C.anchorsAt(t, true).forEach((a) => { o[a.id] = a; }); return o; };

// syntax
for (const f of readdirSync('rewrite-v9').filter((x) => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', 'rewrite-v9/' + f]);
ok('node --check passes for every rewrite-v9/*.js');

// determinism
assert.deepEqual(C.anchorsAt(0.37, true), C.anchorsAt(0.37, true));
assert.deepEqual(C.stateAt(0.62), C.stateAt(0.62));
assert.deepEqual(C.layout(C.stateAt(0.5), 0), C.layout(C.stateAt(0.5), 0));
ok('stateAt, anchorsAt and layout are deterministic (no randomness in the world)');

// anchor id stability
const ids0 = C.anchorsAt(0).map((a) => a.id);
assert.equal(ids0.length, 91); assert.equal(new Set(ids0).size, 91);
for (const t of sweep) assert.deepEqual(C.anchorsAt(t).map((a) => a.id), ids0);
for (const id of ['lighthouse', 'pier1', 'pier7', 'pier7.root', 'coast0', 'coast16', 'route0', 'route11', 'district0', 'district7.c3', 'star7']) assert.ok(ids0.includes(id), id);
ok('91 unique anchor ids, identical list at all 101 sampled t, required ids present');

// bounded step displacement, and no teleporting
let maxStep = 0, worst = '';
for (let i = 0; i < 100; i++) { const a = at(i / 100), b = at((i + 1) / 100); for (const id of ids0) { const d = D(a[id].scr, b[id].scr); if (d > maxStep) { maxStep = d; worst = id + '@' + (i / 100); } } }
assert.ok(maxStep < 12, 'max step ' + maxStep + ' ' + worst);
ok('per 0.01 step max screen displacement of any anchor is ' + maxStep.toFixed(2) + ' px (' + worst + '), bound 12 px');
// an anchor can only be moved this far because it travels; total travel must be real
let moved = 0; { const a = at(0), b = at(1); for (const id of ids0) if (D(a[id].scr, b[id].scr) > 8) moved++; }
assert.ok(moved > 60, 'only ' + moved + ' anchors moved more than 8 px'); ok(moved + ' of 91 anchors end more than 8 px from their start');

// ring angles continuous, at least two change by > 15 deg
let maxDa = 0; for (let i = 0; i < 100; i++) { const a = C.stateAt(i / 100).theta, b = C.stateAt((i + 1) / 100).theta; a.forEach((v, k) => { maxDa = Math.max(maxDa, Math.abs(v - b[k])); }); }
assert.ok(maxDa < 2, 'angle step ' + maxDa);
const s0 = C.stateAt(0), s1 = C.stateAt(1), dth = s1.theta.map((v, i) => Math.abs(v - s0.theta[i]));
assert.ok(dth.filter((d) => d > 15).length >= 2, dth.join());
assert.ok(Math.abs(s0.theta[2] - 23) < 1e-9 && Math.abs(s1.theta[2]) < 1e-9, 'R3 folds 23 -> 0');
ok('ring angles continuous (max step ' + maxDa.toFixed(2) + ' deg per 0.01); changes ' + dth.map((d) => d.toFixed(1)).join('/') + ' deg; R3 tilt 23 -> 0');
// rings turn at different times (staggered ease windows)
const early = C.stateAt(0.3).e, late = C.stateAt(0.9).e; assert.ok(early[0] > early[3] + 0.2 && late[3] < 1 && late[0] === 1);
ok('rings are staggered: at t=0.3 R1 e=' + early[0].toFixed(2) + ' vs R4 e=' + early[3].toFixed(2));

// lens: thin lens formula 1/f = 1/do + 1/di, M = di/do = f/(f-do) in the virtual-image convention
for (const t of [0, 0.3, 0.5, 0.8, 1]) {
  const st = C.stateAt(t), L = st.lens, DO = C.LENS.DO;
  const di = (L.f * DO) / (DO - L.f); // 1/di = 1/f - 1/do; negative = virtual image
  assert.ok(Math.abs(1 / L.f - (1 / DO + 1 / di)) < 1e-9);
  assert.ok(Math.abs(L.M - (-di / DO)) < 1e-9, 'M ' + L.M + ' vs ' + (-di / DO));
  assert.ok(Math.abs(L.M - L.f / (L.f - DO)) < 1e-9);
}
ok('lens magnification M equals the thin-lens value f/(f-do) at five t');
// the mapping from ring point to dome pixel is exactly lens.s/(1+k r^2) about the lens axis
for (const t of [0, 0.5, 1]) {
  const st = C.stateAt(t), L = st.lens;
  for (const id of ['lighthouse', 'pier3', 'route5', 'district2.c1']) {
    const a = at(t)[id], dx = a.ring[0] - L.x, dy = a.ring[1], sc = L.s / (1 + L.k * (dx * dx + dy * dy));
    const qx = L.x + dx * sc, qy = dy * sc + L.sy;
    assert.ok(D(a.lens, [qx, qy]) < 1e-12, id);
    assert.ok(D(a.scr, [C.DOME.cx + qx * C.DOME.k * C.DOME.rx, C.DOME.cy + qy * C.DOME.k * C.DOME.ry]) < 1e-9);
  }
}
ok('anchor lens point and dome pixel match the closed-form lens mapping (s/(1+k r^2), decenter, dome scale)');
// the chain: p0 on the unit hemisphere, each step a rotation (length preserved), chain end = ring point
for (const a of C.anchorsAt(0.5, true)) {
  assert.equal(a.chain.length, 5);
  const r0 = Math.hypot(...a.chain[0]); for (const p of a.chain) assert.ok(Math.abs(Math.hypot(p[0], p[1], p[2]) - r0) < 1e-9, a.id); // rotations keep length
  if (Math.hypot(a.base[0], a.base[1]) <= 1) assert.ok(Math.abs(r0 - 1) < 1e-9, a.id);
  assert.ok(Math.abs(a.chain[4][0] - a.ring[0]) < 1e-12 && Math.abs(a.chain[4][1] - a.ring[1]) < 1e-12);
}
ok('every anchor has a 5-point rotation chain (rotations preserve length, unit length inside the disc) ending at its ring point');
// a ring really drives its anchors: changing only R3 moves pier7 but not pier2
{ const st = C.stateAt(0.5), alt = Object.assign({}, st, { delta: st.delta.slice() }); alt.delta[2] = 0; const p7 = C.mapBase(C.BYID.pier7.base, C.BYID.pier7.bind, st, 0), q7 = C.mapBase(C.BYID.pier7.base, C.BYID.pier7.bind, alt, 0), p2 = C.mapBase(C.BYID.pier2.base, C.BYID.pier2.bind, st, 0), q2 = C.mapBase(C.BYID.pier2.base, C.BYID.pier2.bind, alt, 0);
  assert.ok(D(p7.scr, q7.scr) > 10 && D(p2.scr, q2.scr) < 1e-9); }
ok('ring R3 alone moves pier VII (by more than 10 px) and leaves pier II untouched: anchors are bound to rings');

// no crossfade: positions at 0.5 lie between the endpoints in the sense of path length, and are not the midpoint of the endpoints
const A0 = at(0), A5 = at(0.5), A1 = at(1); let between = 0, notMid = 0, tot = 0;
for (const id of ids0) { const d01 = D(A0[id].scr, A1[id].scr); if (d01 < 25) continue; tot++; const d0 = D(A0[id].scr, A5[id].scr), d1 = D(A5[id].scr, A1[id].scr); if (d0 + d1 < d01 * 1.6 + 20 && d0 < d01 * 1.2 + 10 && d1 < d01 * 1.2 + 10) between++; const mid = [(A0[id].scr[0] + A1[id].scr[0]) / 2, (A0[id].scr[1] + A1[id].scr[1]) / 2]; if (D(mid, A5[id].scr) > 3) notMid++; }
assert.ok(tot > 30 && between / tot > 0.9, 'between ' + between + '/' + tot);
assert.ok(notMid / tot > 0.5, 'positions look linearly mixed: ' + notMid + '/' + tot);
ok('t=0.5: ' + between + '/' + tot + ' travelling anchors sit between their endpoints, ' + notMid + ' are off the straight midpoint (one world on a curved path, not a blend)');
// there is no second world to blend: every anchor has exactly one position per t
assert.equal(C.anchorsAt(0.5).length, 91);

// reversibility
for (const t of [0.13, 0.5, 0.91]) { let fwd = t; const up = C.anchorsAt(fwd), dn = C.anchorsAt(fwd); assert.deepEqual(up, dn); }
{ const m = C.createMachine(); m.setProgress(0.4); const f = C.anchorsAt(m.t).map((a) => a.scr);
  m.state = 'REWRITING'; for (let i = 0; i < 100; i++) m.step(100); const up = m.t; m.revert(); for (let i = 0; i < 200; i++) m.step(100);
  assert.equal(up, 1); assert.equal(m.t, 0); assert.equal(m.state, 'OLD'); assert.deepEqual(C.anchorsAt(m.t).map((a) => a.scr), C.anchorsAt(0).map((a) => a.scr));
  // scrubbing back to the same t gives the same layout
  m.setProgress(0.4); assert.deepEqual(C.anchorsAt(m.t).map((a) => a.scr), f); }
ok('t runs forward and back: same t gives identical layout, undo returns exactly to t=0 (OLD)');

// pier7 submerged, lighthouse moved
{ const o = at(0), nw = at(1), root7 = (a) => a['pier7'].scr[1] - a['pier7.root'].scr[1];
  const st0 = C.stateAt(0), st1 = C.stateAt(1); assert.ok(st0.sink7 === 0 && st1.sink7 === 1 && st0.star7 === 1 && st1.star7 === 0);
  assert.ok(D(o.lighthouse.scr, nw.lighthouse.scr) > 80, 'lighthouse moved ' + D(o.lighthouse.scr, nw.lighthouse.scr));
  assert.ok(nw.lighthouse.scr[0] < o.lighthouse.scr[0] - 60, 'lighthouse should end west (smaller x)');
  const p7 = D(o.pier7.scr, nw.pier7.scr), p2 = D(o.pier2.scr, nw.pier2.scr); assert.ok(p7 > 60 && p7 > p2, p7 + ' ' + p2);
  assert.ok(nw.route0.scr[0] !== o.route0.scr[0]); void root7;
  ok('pier VII sink7 0 -> 1 and star7 1 -> 0; lighthouse moves ' + D(o.lighthouse.scr, nw.lighthouse.scr).toFixed(0) + ' px west; pier VII travels ' + p7.toFixed(0) + ' px vs pier II ' + p2.toFixed(0)); }

// hand, chart and beam: causal data
{ const mir = C.CHART[6], s7 = C.STARS[6]; assert.ok(Math.abs(mir[0] + s7[0] * 1.2) < 1e-12);
  C.STARS.forEach((s, i) => assert.ok(Math.abs(C.CHART[i][0] + 1.2 * s[0]) < 1e-12)); // left-right mirror of the sky chart
  const path = C.chartPath(); assert.deepEqual(path[path.length - 1], mir);
  const end = C.hauntAt(1), mid = C.hauntAt(0.5), none = C.hauntAt(0);
  assert.ok(Math.abs(end.tip.x - mir[0]) < 1e-9 && Math.abs(end.tip.y - mir[1]) < 1e-9, 'the hand ends on the seventh star position');
  assert.ok(none.hand === 0 && none.beam === 0 && none.scorch === 0 && none.name === 0);
  const e2 = C.hauntAt(0.98); assert.ok(e2.beam === 1 && e2.scorch > 0.9 && e2.name === 1 && e2.glow7 === 1);
  // causal order: name struck, glow, beam, scorch
  const first = (k) => { for (let i = 0; i <= 200; i++) if (C.hauntAt(i / 200)[k] > 0.05) return i; return 999; };
  assert.ok(first('name') <= first('glow7') && first('glow7') < first('beam') && first('beam') < first('scorch'), [first('name'), first('glow7'), first('beam'), first('scorch')].join());
  ok('haunt: chart is the left-right mirror of the stars, the hand path ends exactly on star VII, name struck, then glow, beam, scorch in that order'); }

// state machine: early release cancels, hold 1.2 s starts, compare keeps t
{ const m = C.createMachine(); m.press(); m.step(500); assert.equal(m.state, 'WRITING'); assert.ok(m.w > 0.3 && m.w < 0.5); m.release(); for (let i = 0; i < 20; i++) m.step(100);
  assert.equal(m.state, 'OLD'); assert.equal(m.w, 0); assert.equal(m.t, 0);
  m.press(); for (let i = 0; i < 11; i++) m.step(100); assert.equal(m.state, 'WRITING'); m.step(100); m.step(100); assert.equal(m.state, 'REWRITING');
  for (let i = 0; i < 40; i++) m.step(100); const t = m.t; m.setCompare(true); for (let i = 0; i < 10; i++) m.step(100); assert.ok(m.t > t && m.view().td < 0.01 + (1 - m.c));
  const r = C.createMachine({ reduced: true }); r.setProgress(0.2); r.state = 'REWRITING'; const a = C.createMachine(); a.setProgress(0.2); a.state = 'REWRITING';
  r.step(1000); a.step(1000); assert.ok(r.t > 0.2 && (r.t - 0.2) * 1.8 - (a.t - 0.2) < 1e-9, 'reduced is 1.8x slower'); }
ok('machine: release at 0.5 s cancels to OLD t=0; hold 1.2 s reaches REWRITING; compare shows t=0 while real t keeps running; reduced motion is 1.8x slower and still continuous');

console.log(n + ' passed');
