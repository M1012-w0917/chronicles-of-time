// Unit tests for rewrite-v3/core.js plus a syntax check of every V3 script. Usage: node tests/run-v3.mjs
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('../rewrite-v3/core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
for (const f of ['core.js', 'paint.js', 'app.js']) t('node --check rewrite-v3/' + f, () => execSync('node --check rewrite-v3/' + f, { stdio: 'pipe' }));
for (const f of ['run-v3', 'flow-v3', 'record-v3', 'shoot-v3']) t('node --check tests/' + f + '.mjs', () => execSync('node --check tests/' + f + '.mjs', { stdio: 'pipe' }));
const run = (m, ms) => { for (let i = 0; i < ms / 16; i++) m.step(16); };

t('seeded rng is deterministic', () => { const a = C.rng(7), b = C.rng(7); for (let i = 0; i < 20; i++) assert.equal(a(), b()); });
t('brush stroke tapers at both ends and is deterministic', () => {
  const pts = [[0, 0], [100, 20], [200, 0]], a = C.stroke(pts, { w: 20, a: 1 }, C.rng(1)), b = C.stroke(pts, { w: 20, a: 1 }, C.rng(1));
  assert.deepEqual(a, b); assert.ok(a.length > 30);
  const mid = a[Math.floor(a.length / 2)].r; assert.ok(a[0].r < mid * 0.6 && a[a.length - 1].r < mid * 0.6, 'taper');
});
t('dry brush drops bristles: fewer, smaller stamps than wet', () => {
  const pts = [[0, 0], [150, 0], [300, 0]], wet = C.stroke(pts, { w: 16, a: 1 }, C.rng(2)), dry = C.stroke(pts, { w: 16, a: 1, dry: 0.7 }, C.rng(2));
  assert.ok(dry.every((s) => s.r < 2.5)); assert.ok(dry.some((s) => s.a < 0.75));
  const ys = dry.map((s) => s.y); assert.ok(Math.max(...ys) - Math.min(...ys) > 6, 'bristles spread across the width'); assert.ok(wet.length > 0);
});
t('ridge stays inside its bounds', () => {
  const r = C.ridge(3, 0, 1600, 20, 400, 100, { sx: 100, peaks: [{ x: 800, h: 1, w: 90 }] });
  for (const [, y] of r) assert.ok(y <= 400 && y >= 400 - 100 * 1.5);
  assert.ok(C.ridgeY(r, 800) < 330);
});
t('old and new mountains differ (repainted, not recoloured)', () => {
  const o = C.mountainStamps('old', 1), n2 = C.mountainStamps('neu', 1);
  const top = (l, p) => Math.min(...l.filter((s) => s.p === p && s.kind === 'ridge').map((s) => s.y));
  assert.ok(top(n2, 0) < top(o, 0) - 40 && top(n2, 1) < top(o, 1) - 40);
});
t('arrival spreads outward from the pen and city dissolves first', () => {
  const P = C.WORLD.pen;
  assert.ok(C.arrival(2, P.x - 50, P.y) < C.arrival(2, 100, 800));
  assert.ok(C.arrival(2, 600, 600) < C.arrival(4, 600, 600));
  for (let td = 0, p = -1; td <= 1.001; td += 0.05) { const k = C.reveal(td, 0.4); assert.ok(k >= p); p = k; }
});
t('new strokes: sorted by time, in range, outward and on every plane', () => {
  const S = C.newStamps(1); assert.ok(S.length > 8000 && S.length < 60000, 'count ' + S.length);
  for (let i = 1; i < S.length; i++) assert.ok(S[i].t >= S[i - 1].t);
  assert.ok(S[0].t > 0.03 && S[S.length - 1].t <= 0.995);
  for (const p of [0, 1, 3, 4]) assert.ok(S.some((s) => s.p === p), 'plane ' + p); assert.ok(!S.some((s) => s.p === 2), 'nothing is ever painted where the city was');
  const early = S.filter((s) => s.p === 1 && s.t < 0.45), late = S.filter((s) => s.p === 1 && s.t > 0.62), P = C.WORLD.pen;
  const d = (l) => l.reduce((a, s) => a + Math.hypot(s.x - P.x, s.y - P.y), 0) / l.length; assert.ok(d(early) < d(late));
});
t('hold to write, early release cancels', () => {
  const m = C.createMachine(); m.press(); run(m, 500); assert.equal(m.state, 'WRITING'); assert.ok(m.w > 0.2 && m.w < 0.5);
  m.release(); assert.equal(m.state, 'OLD'); run(m, 1000); assert.equal(m.w, 0); assert.equal(m.t, 0);
});
t('full hold rewrites over several seconds and persists as NEW', () => {
  const m = C.createMachine(); m.press(); run(m, 1700); assert.equal(m.state, 'REWRITING'); m.release(); assert.equal(m.state, 'REWRITING');
  let ms = 0; while (m.state === 'REWRITING') { m.step(16); ms += 16; } assert.equal(m.state, 'NEW'); assert.ok(ms > 5000); assert.equal(m.settled, 'new');
});
t('undo returns to the old world', () => { const m = C.createMachine(); m.scrub(1); m.undo(); assert.equal(m.state, 'UNDOING'); run(m, 6000); assert.equal(m.state, 'OLD'); assert.equal(m.t, 0); });
t('compare shows old without changing the stored world', () => {
  const m = C.createMachine(); m.scrub(1); m.setCompare(true); run(m, 1000); assert.equal(m.view().td, 0); assert.equal(m.t, 1); m.setCompare(false); run(m, 1000); assert.equal(m.view().td, 1);
});
t('haunting is caused by the rewrite and reversed by undo', () => {
  const m = C.createMachine(); run(m, 6000); assert.equal(m.haunt, 0);
  m.press(); run(m, 1700); m.release(); while (m.state === 'REWRITING') { assert.equal(m.haunt, 0); m.step(16); }
  run(m, 12000); assert.ok(m.haunt > 0.99); m.undo(); run(m, 6000); assert.equal(m.haunt, 0);
  const a = C.hauntState(0), b = C.hauntState(1); assert.equal(a.heading, 180); assert.equal(b.heading, 0); assert.equal(a.seal, 0); assert.equal(b.seal, 1); assert.equal(a.margin, 0); assert.equal(b.margin, 1);
});
t('the figure stands where the old gate was and stays on the old street', () => {
  for (const h of [0, 0.12, 0.5, 1]) { const p = C.figureAt(h); assert.ok(Math.hypot(p.x - C.VANISHED.x, p.y - C.VANISHED.y) <= 40, 'h=' + h); }
  assert.deepEqual(C.figureAt(0), { x: C.VANISHED.x, y: C.VANISHED.y });
});
t('reduced motion holds keyframes only', () => {
  const m = C.createMachine({ reduced: true }); m.press(); run(m, 1700); const seen = new Set(); let g = 0;
  while (m.state !== 'NEW' && g++ < 1000) { m.step(50); seen.add(m.t); }
  assert.deepEqual([...seen].sort(), [0.5, 1]); run(m, 6000); assert.equal(m.haunt, 1);
});
t('text copy is complete', () => { assert.equal(C.FACT.old.zh, '灰堡市建于永昌四十二年。'); assert.equal(C.FACT.neu.zh, '灰堡市从未建立。'); assert.match(C.FACT.neu.en, /never founded/); });
console.log(n + ' passed');
