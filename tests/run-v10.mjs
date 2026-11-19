// Unit tests for rewrite-v10/core.js plus node --check of every V10 script. Usage: node tests/run-v10.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const C = createRequire(import.meta.url)('../rewrite-v10/core.js');
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
const num = (v, d = 2) => Number(v).toFixed(d);

// syntax
for (const f of readdirSync('rewrite-v10').filter((x) => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', 'rewrite-v10/' + f]);
ok('node --check passes for every rewrite-v10/*.js');

// feasibility gate: bare solver at the designed N
assert.equal(C.N, 4096);
const g = C.createSim(); const tg = Date.now(); g.simulate(-C.PREROLL, 100); const msStep = (Date.now() - tg) / (C.PREROLL + 100);
console.log('  feasibility: N=' + C.N + ' grains, ' + num(msStep, 2) + ' ms/step (gate 3 ms), bonds ' + g.nBonds);
assert.ok(msStep <= 3, 'ms/step ' + msStep);
ok('feasibility gate: ' + C.N + ' grains at ' + num(msStep, 2) + ' ms/step (<= 3 ms), N not reduced');

// old world: at rest, dams standing, exact layout counts
const old = C.buildOld();
assert.ok(old.maxSpeed() < 0.1, 'old world max speed ' + old.maxSpeed());
const cnt = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < C.N; i++) cnt[old.role[i]]++;
assert.equal(cnt[C.ROLE.keeper], C.L.nKeeper); assert.equal(cnt[C.ROLE.reserve], C.L.nReserve); assert.equal(old.damX.length, 7);
assert.equal(cnt.reduce((a, b) => a + b, 0), C.N);
ok('old world after ' + C.PREROLL + ' pre-roll steps is at rest (max speed ' + num(old.maxSpeed(), 4) + ' u/step); roles bed/dam/deck/bld/keeper/reserve = ' + cnt.join('/') + ', seven dams');

// precompute (twice, for determinism). Measure time and memory.
const t0 = Date.now(); const jobA = C.precomputeSync(); const secA = (Date.now() - t0) / 1000;
const jobB = C.precomputeSync(); const A = jobA.store, B = jobB.store;
const MB = A.data.byteLength / 1048576;
console.log('  precompute: ' + num(secA, 2) + ' s for ' + C.T_END + ' steps (' + num(secA * 1000 / (C.T_END + 0), 2) + ' ms/step incl. snapshots), frames ' + A.F + ', snapshots ' + num(MB, 1) + ' MB');
assert.ok(secA <= 8, 'precompute ' + secA); assert.ok(MB <= 40);
ok('precompute ' + num(secA, 2) + ' s (<= 8 s), snapshots ' + num(MB, 1) + ' MB (<= 40 MB)');
assert.equal(A.data.length, B.data.length);
let same = true; for (let i = 0; i < A.data.length; i++) if (A.data[i] !== B.data[i]) { same = false; break; }
assert.ok(same); for (const f of [0, 100, 300, A.fNew, A.F - 1]) assert.equal(C.fingerprint(A, f), C.fingerprint(B, f));
ok('determinism: two independent runs give bit-identical Int16 snapshots (fingerprint at frame ' + A.fNew + ' = ' + C.fingerprint(A, A.fNew) + ')');

// id continuity, bounds, no NaN at every stored frame
{
  let bad = 0; const d = A.data, lim = Math.round(C.W / A.Q), limY = Math.round(C.H / A.Q);
  for (let f = 0; f < A.F; f++) { const o = f * A.N * 2; for (let i = 0; i < A.N; i++) { const x = d[o + 2 * i], y = d[o + 2 * i + 1]; if (!(x >= 0 && x <= lim && y >= 0 && y <= limY)) bad++; } }
  assert.equal(bad, 0); assert.equal(A.role.length, C.N); assert.equal(A.N, 4096); assert.equal(A.filled, A.F);
  const buf = C.frameAt(A, 123.37); for (let i = 0; i < buf.length; i++) assert.ok(Number.isFinite(buf[i]));
  ok('id continuity: all ' + A.F + ' stored frames hold ' + A.N + ' fixed-id grains (id = index), no NaN, all in the glass bounds; the role list is fixed');
}
// mass/count conservation, centroid sanity
{
  const x0 = C.frameAt(A, 0), x1 = C.frameAt(A, A.fNew);
  let cy0 = 0, cy1 = 0; for (let i = 0; i < A.N; i++) { cy0 += x0[2 * i + 1]; cy1 += x1[2 * i + 1]; }
  assert.ok(cy1 > cy0, 'the centroid must move down (mass settles)'); assert.ok(cy1 / A.N < C.H);
  const cnt2 = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < A.N; i++) cnt2[A.role[i]]++; assert.deepEqual(cnt2, cnt);
  ok('mass/count conserved: 4096 grains of mass 1 at all times; centroid height drops by ' + num((cy1 - cy0) / A.N, 1) + ' units from old to new world');
}
// per-step max displacement (separate run, every step)
{
  const s = C.createSim(); let mx = 0; const px = new Float64Array(C.N), py = new Float64Array(C.N);
  for (let k = -C.PREROLL; k < C.T_END; k++) { px.set(s.x); py.set(s.y); s.step(); for (let i = 0; i < C.N; i++) { const d = Math.hypot(s.x[i] - px[i], s.y[i] - py[i]); if (d > mx) mx = d; } }
  assert.ok(mx < 12, 'max step ' + mx);
  ok('per-step max displacement of any grain over all ' + (C.T_END + C.PREROLL) + ' steps is ' + num(mx, 2) + ' units, bound 12');
}

// frame 0 is the old world: at rest and the dams stand
{
  const m0 = C.metrics(A, 0), x0 = C.frameAt(A, 0);
  assert.ok(m0.maxDamColumnHeightRatio > 0.6, 'dams not standing ' + m0.maxDamColumnHeightRatio);
  assert.ok(m0.damDisplacedRatio === 0);
  const sp = C.speeds(A, 1); let mv = 0; for (const v of sp) if (v > 0.1) mv++; assert.ok(mv / C.N < 0.01, 'frame 1 moving fraction ' + mv / C.N);
  // every dam keeps its footprint columns: grains of dam i within 6 units of its x
  A.damX.forEach((xc, gi) => { let c = 0; for (let i = 0; i < A.N; i++) if (A.role[i] === C.ROLE.dam && A.grp[i] === gi && Math.abs(x0[2 * i] - xc) < 6) c++; assert.ok(c >= 2, 'dam ' + gi + ' has ' + c); });
  ok('old world at frame 0: seven dams standing (equivalent height ratio ' + num(m0.maxDamColumnHeightRatio) + ' of the tallest), nothing has moved');
}

// the rewrite result at the settled new world
const FN = A.fNew, mN = C.metrics(A, FN); console.log('  new world metrics at frame ' + FN + ': ' + JSON.stringify(mN));
assert.ok(mN.canyonDepth >= 40, 'canyon depth ' + mN.canyonDepth);
ok('canyon depth ' + num(mN.canyonDepth, 1) + ' units (>= 40): mean bank surface minus central surface');
assert.ok(mN.buildingsOnBanksRatio >= 0.7, 'banks ' + mN.buildingsOnBanksRatio);
ok(num(mN.buildingsOnBanksRatio * 100, 1) + ' % of building grains end on the banks (|x - centre| > 70), >= 70 %');
assert.ok(mN.damDisplacedRatio >= 0.8, 'dam moved ' + mN.damDisplacedRatio); assert.ok(mN.damNearOriginRatio < 0.2);
ok(num(mN.damDisplacedRatio * 100, 1) + ' % of dam grains moved more than 60 units, ' + num(mN.damNearOriginRatio * 100, 1) + ' % are within 60 of their origin (< 20 %)');
assert.ok(mN.maxDamColumnHeightRatio <= 0.25, 'dam column ' + mN.maxDamColumnHeightRatio);
ok('no dam column left standing: tallest remnant is ' + num(mN.maxDamColumnHeightRatio * 100, 1) + ' % of the tallest original dam (<= 25 %)');
assert.ok(mN.restFraction >= 0.99, 'rest ' + mN.restFraction);
ok('new world is at rest: ' + num(mN.restFraction * 100, 2) + ' % of grains slower than 0.1 u/step at the end of settling, max speed ' + num(mN.maxSpeed, 3));
// settling curve (reported): rest fraction during the 3 s settle phase
{ const pts = [A.fRewrite, A.fRewrite + 30, A.fRewrite + 60, FN].map((f) => num(C.metrics(A, f).restFraction * 100, 2) + '%@' + f); ok('settle phase rest fraction ' + pts.join(' ')); }

// trajectories are not straight lines: no blend of the first and the last frame
{
  const x0 = C.frameAt(A, 0), x1 = C.frameAt(A, FN); const path = new Float64Array(A.N); let prev = x0;
  for (let f = 1; f <= FN; f++) { const cur = C.frameAt(A, f); for (let i = 0; i < A.N; i++) path[i] += Math.hypot(cur[2 * i] - prev[2 * i], cur[2 * i + 1] - prev[2 * i + 1]); prev = cur; }
  let sum = 0, m = 0; for (let i = 0; i < A.N; i++) { const d = Math.hypot(x1[2 * i] - x0[2 * i], x1[2 * i + 1] - x0[2 * i + 1]); if (d > 20) { sum += d / path[i]; m++; } }
  const straight = sum / m; assert.ok(straight < 0.9, 'straightness ' + straight);
  const fr = [0.25, 0.5, 0.75].map((u) => Math.round(u * A.fRewrite)); let off = 0, tot = 0;
  for (const f of fr) { const mid = C.frameAt(A, f), u = f / A.fRewrite; for (let i = 0; i < A.N; i++) { const d = Math.hypot(x1[2 * i] - x0[2 * i], x1[2 * i + 1] - x0[2 * i + 1]); if (d <= 20) continue; tot++; const lx = x0[2 * i] + (x1[2 * i] - x0[2 * i]) * u, ly = x0[2 * i + 1] + (x1[2 * i + 1] - x0[2 * i + 1]) * u; if (Math.hypot(mid[2 * i] - lx, mid[2 * i + 1] - ly) > 5) off++; } }
  assert.ok(off / tot >= 0.3, 'off-line fraction ' + off / tot);
  ok('mid-rewrite frames are not a blend: mean path straightness ' + num(straight, 3) + ' (< 0.9), ' + num(off / tot * 100, 1) + ' % of moving grains are more than 5 units off the straight start-end line at 25/50/75 %');
}
// continuity of the collapse and no alpha/lifetime: every grain exists in every frame (already shown); per-frame displacement is bounded
{
  let mx = 0; let prev = C.frameAt(A, 0);
  for (let f = 1; f < A.F; f++) { const cur = C.frameAt(A, f); for (let i = 0; i < A.N; i++) { const d = Math.hypot(cur[2 * i] - prev[2 * i], cur[2 * i + 1] - prev[2 * i + 1]); if (d > mx) mx = d; } prev = cur; }
  assert.ok(mx < 12); ok('stored-frame to stored-frame max displacement is ' + num(mx, 2) + ' units (< 12)');
}

// haunt
{
  const H = A.haunt; assert.ok(H && H.ids.length === 400, 'haunt ids ' + (H && H.ids.length));
  const ev = C.events(); const fh = (s) => ev.hauntStart.f + s * 30; let keepers = 0; H.ids.forEach((i) => { if (A.role[i] === C.ROLE.keeper) keepers++; });
  assert.equal(keepers, 96);
  const x0 = C.frameAt(A, FN), xh = C.frameAt(A, fh(3.0)); let dy = 0, up = 0; H.ids.forEach((i) => { dy += xh[2 * i + 1] - x0[2 * i + 1]; if (xh[2 * i + 1] < x0[2 * i + 1] - 20) up++; });
  assert.ok(dy / H.ids.length < -50, 'mean rise ' + dy / H.ids.length); assert.ok(up / H.ids.length > 0.9);
  ok('haunt: 400 grains (96 keeper + 304 sampled pile grains) rise against gravity, mean net displacement ' + num(dy / H.ids.length, 1) + ' units along the gravity axis (negative = up), ' + num(up / H.ids.length * 100, 1) + ' % rise more than 20 units');
  const err = (s) => { const xy = C.frameAt(A, fh(s)); let sum = 0, within = 0; H.ids.forEach((id, q) => { const hp = H.hand[H.handOf[q]], np = H.name[H.nameOf[q]]; const w = Math.min(1, Math.max(0, (s - C.HP.nameStart - C.HP.nameSpan * H.nameOf[q] / H.ids.length) / 0.8)); const t = [hp[0] + (np[0] - hp[0]) * w, hp[1] + (np[1] - hp[1]) * w]; const d = Math.hypot(xy[2 * id] - t[0], xy[2 * id + 1] - t[1]); sum += d; if (d < 14) within++; }); return { mean: sum / H.ids.length, within: within / H.ids.length }; };
  const eh = err(3.0), en = err(8.3);
  assert.ok(eh.mean < 16 && eh.within > 0.6, 'hand ' + JSON.stringify(eh)); assert.ok(en.mean < 16 && en.within > 0.6, 'name ' + JSON.stringify(en));
  ok('haunt targets reached: hand print mean error ' + num(eh.mean, 1) + ' units (' + num(eh.within * 100, 0) + ' % within 14), mirrored name 陆徊 mean error ' + num(en.mean, 1) + ' (' + num(en.within * 100, 0) + ' % within 14)');
  assert.equal(ev.knocks.length, 3); assert.ok(ev.knocks[0].f > ev.hauntStart.f && ev.knocks[2].f < ev.nameStart.f && ev.nameStart.f < ev.hauntRelease.f && ev.hauntRelease.f < ev.end.f);
  ok('haunt event list: three knocks at frames ' + ev.knocks.map((k) => Math.round(k.f)).join(', ') + ', name at ' + Math.round(ev.nameStart.f) + ', release at ' + Math.round(ev.hauntRelease.f) + ', end ' + Math.round(ev.end.f));
  const mEnd = C.metrics(A, A.F - 1); assert.ok(mEnd.restFraction >= 0.97, 'end rest ' + mEnd.restFraction);
  const xe = C.frameAt(A, A.F - 1); let still = 0; H.ids.forEach((i) => { if (xe[2 * i + 1] > 150) still++; }); assert.ok(still / H.ids.length > 0.9);
  ok('after release the haunt grains fall back under normal gravity: ' + num(still / H.ids.length * 100, 1) + ' % below y = 150; rest fraction at the end ' + num(mEnd.restFraction * 100, 2) + ' %, conservation holds (checked at every frame above)');
}

// reversibility: frameAt over the whole range reversed equals the forward frames
{
  const fs = []; for (let f = 0; f <= A.F - 1; f += 0.37) fs.push(f);
  const fwd = fs.map((f) => Array.from(C.frameAt(A, f).slice(0, 64)));
  const rev = fs.slice().reverse().map((f) => Array.from(C.frameAt(A, f).slice(0, 64))).reverse();
  assert.deepEqual(rev, fwd);
  const a = C.frameAt(A, 200), b = C.frameAt(A, 201), m = C.frameAt(A, 200.5); for (let i = 0; i < 40; i++) assert.ok(Math.abs(m[i] - (a[i] + b[i]) / 2) < 1e-3);
  assert.equal(C.fingerprint(A, 0), C.fingerprint(B, 0)); assert.equal(C.frameOfT(0), 0); assert.equal(C.frameOfT(1), A.fNew);
  ok('reversibility: ' + fs.length + ' playhead positions replayed backwards give the forward frames exactly; linear interpolation is exact at half frames; t=0 is the old world, t=1 the settled new world');
}

// structural: no per-grain target in the rewrite phase (roles never produce a force)
{
  const src = (await import('node:fs')).readFileSync('rewrite-v10/core.js', 'utf8');
  const a = src.indexOf('sim.step = function'), b = src.indexOf('sim.simulate = function'), body = src.slice(a, b), hb = body.indexOf('if (h && !h.released)'), he = body.indexOf('setColliders(k + 1)');
  const outside = body.slice(0, hb) + body.slice(he);
  assert.ok(!/role\[/.test(outside) && !/grp\[/.test(outside) && !/hauntTarget/.test(outside), 'roles or targets used outside the haunt block');
    ok('targets exist only inside the haunt block (if (h && !h.released)); the rewrite phase uses gravity, contacts, bonds and the two machines only');
}

console.log(n + ' passed');
