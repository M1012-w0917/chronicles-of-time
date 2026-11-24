// Unit tests for rewrite-v3/core.js plus a syntax check of every V3 script. Usage: node tests/run-v3.mjs
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
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
t('held compare settles at 1 and stays there (no step past the target)', () => {
  const m = C.createMachine(); m.scrub(1); m.setCompare(true); run(m, 1000);
  for (let i = 0; i < 60; i++) { m.step(16); assert.equal(m.c, 1, 'step ' + i); }
  m.setCompare(false); run(m, 1000); for (let i = 0; i < 60; i++) { m.step(16); assert.equal(m.c, 0, 'step ' + i); }
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
t('fibre direction field is deterministic, coherent and drives bleed paths along the grain', () => {
  assert.equal(C.fibreDir(300, 200), C.fibreDir(300, 200)); assert.deepEqual(C.fibrePath(10, 20, 30, 1), C.fibrePath(10, 20, 30, 1));
  let near = 0, far = 0; for (let i = 0; i < 200; i++) { const x = i * 7.3, y = i * 3.1; near += Math.abs(C.fibreDir(x, y) - C.fibreDir(x + 4, y + 4)); far += Math.abs(C.fibreDir(x, y) - C.fibreDir(x + 900, y + 700)); }
  assert.ok(near < far * 0.5, 'neighbouring points share a direction');
  const p = C.fibrePath(100, 100, 40, 1), q = C.fibrePath(100, 100, 40, -1); assert.ok(p[4][0] !== q[4][0]); assert.ok(Math.hypot(p[4][0] - 100, p[4][1] - 100) > 30, 'creeps outward along the field');
  for (let i = 0; i < 300; i++) assert.ok(Math.abs(C.seep(i * 5.7, i * 2.3)) <= 0.5);
});
t('ink types: light wash is soft, dry is hard bristles, wet is tagged for fibre creep', () => {
  const pts = [[0, 0], [150, 0], [300, 0]], light = C.stroke(pts, { w: 16, a: 0.5, light: 1 }, C.rng(3)), wet = C.stroke(pts, { w: 16, a: 0.9, wet: 1 }, C.rng(3)), dry = C.stroke(pts, { w: 16, a: 0.9, dry: 0.5 }, C.rng(3));
  assert.ok(light.every((s) => s.k === 0) && light.some((s) => s.a < 0.1), 'light: soft sprites with a faint wide halo'); assert.ok(wet.every((s) => s.k === 1 && s.wt === 1), 'wet'); assert.ok(dry.every((s) => s.k === 1 && s.r < 2.5 && !s.wt), 'dry');
  const blunt = C.stroke(pts, { w: 20, a: 1, blunt: 1, ta: 0, tb: 0.85 }, C.rng(4)); assert.ok(blunt[0].r > blunt[Math.floor(blunt.length / 2)].r * 0.95 && blunt[blunt.length - 1].r < blunt[0].r * 0.4, '起笔 lands full width and tapers');
});
t('the epilogue path shares the old gate geometry with the city (one definition, two uses)', () => {
  assert.equal(C.CITY.gate.x, C.VANISHED.x); assert.equal(C.CITY.gate.base, C.VANISHED.y);
  const src = readFileSync(new URL('../rewrite-v3/paint.js', import.meta.url), 'utf8');
  const body = (name) => src.slice(src.indexOf('function ' + name + '('), src.indexOf('function ', src.indexOf('function ' + name + '(') + 10));
  for (const fn of ['paintCity', 'cutPath']) for (const h of ['roofPath', 'archPath', 'crenelXs']) assert.ok(new RegExp(h).test(fn === 'paintCity' ? src.slice(src.indexOf('function roof('), src.indexOf('function cutPath')) : body(fn)), fn + ' uses ' + h);
  assert.ok(/C\.CITY/.test(body('cutPath')));
  assert.equal(C.hauntState(0).path, 0); assert.equal(C.hauntState(1).path, 1);
});
t('reduced motion holds keyframes only', () => {
  const m = C.createMachine({ reduced: true }); m.press(); run(m, 1700); const seen = new Set(); let g = 0;
  while (m.state !== 'NEW' && g++ < 1000) { m.step(50); seen.add(m.t); }
  assert.deepEqual([...seen].sort(), [0.5, 1]); run(m, 6000); assert.equal(m.haunt, 1);
});
t('text copy is complete', () => { assert.equal(C.FACT.old.zh, '灰堡市建于永昌四十二年。'); assert.equal(C.FACT.neu.zh, '灰堡市从未建立。'); assert.match(C.FACT.neu.en, /never founded/); });
console.log(n + ' passed');
