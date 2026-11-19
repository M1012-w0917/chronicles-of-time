// Unit tests for rewrite-v2/core.js plus a syntax check of every V2 script. Usage: node tests/run-v2.mjs
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('../rewrite-v2/core.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

for (const f of ['core.js', 'app.js']) t('node --check rewrite-v2/' + f, () => execSync('node --check rewrite-v2/' + f, { stdio: 'pipe' }));
for (const f of ['run-v2', 'flow-v2', 'record-v2', 'shoot-v2']) t('node --check tests/' + f + '.mjs', () => execSync('node --check tests/' + f + '.mjs', { stdio: 'pipe' }));

t('seeded rng is deterministic', () => { const a = C.rng(7), b = C.rng(7); for (let i = 0; i < 20; i++) assert.equal(a(), b()); });
t('world is deterministic and has all kinds', () => {
  const a = C.buildWorld(1842), b = C.buildWorld(1842);
  assert.deepEqual(a.items.map((i) => [i.kind, i.x, i.y]), b.items.map((i) => [i.kind, i.x, i.y]));
  for (const k of ['ink', 'building', 'person', 'stone', 'tuft']) assert.ok(a.items.some((i) => i.kind === k), k);
  assert.equal(a.items.filter((i) => i.hero).length, 1);
});
t('buildings stay on the city grid and off the text zone', () => {
  for (const i of C.buildWorld().items.filter((i) => i.kind === 'building')) {
    assert.ok(i.x >= -440 && i.x + i.w <= 440 && i.y >= -300 && i.y + i.d <= 205, 'bounds');
    assert.ok(!(i.x < 0 && i.x + i.w > 0), 'crosses gutter');
    assert.ok(i.w > 8 && i.d > 8 && i.h > 8);
  }
});
t('old city at t=0, new world at t=1 (same items)', () => {
  const W = C.buildWorld(); const v = (t) => W.items.map((i) => C.itemValue(i, t));
  const v0 = v(0), v1 = v(1);
  W.items.forEach((i, k) => {
    if (i.kind === 'building') { assert.equal(v0[k], 1); assert.equal(v1[k], 0); }
    if (i.kind === 'person') { assert.equal(v0[k], 0); assert.equal(v1[k], i.hero ? 0 : 1); }
    if (i.kind === 'stone' || i.kind === 'tuft') { assert.equal(v0[k], 0); assert.equal(v1[k], 1); }
    if (i.kind === 'ink') { assert.equal(v0[k], 0); assert.equal(v1[k], 1); }
  });
});
t('transition is monotonic and spreads outward from the printed line', () => {
  const W = C.buildWorld(); const bs = W.items.filter((i) => i.kind === 'building');
  for (const b of bs) { let p = 2; for (let x = 0; x <= 1.0001; x += 0.05) { const k = C.itemValue(b, x); assert.ok(k <= p + 1e-9); p = k; } }
  const near = bs.reduce((a, b) => (b.delay < a.delay ? b : a)), far = bs.reduce((a, b) => (b.delay > a.delay ? b : a));
  assert.ok(C.distN(near.x, near.y) < C.distN(far.x, far.y));
  const mid = bs.map((b) => C.itemValue(b, 0.5)); assert.ok(mid.some((k) => k < 0.5) && mid.some((k) => k > 0.5), 'mid-rewrite mixes old and new');
});
t('the hero never folds', () => { const h = C.buildWorld().items.find((i) => i.hero); for (let x = 0; x <= 1; x += 0.1) assert.equal(C.itemValue(h, x), 0); });
t('hold to write, early release cancels', () => {
  const m = C.createMachine(); m.press(); m.step(500); assert.equal(m.state, 'WRITING'); assert.ok(m.w > 0.2 && m.w < 0.6);
  m.release(); assert.equal(m.state, 'OLD'); for (let i = 0; i < 60; i++) m.step(16); assert.equal(m.w, 0); assert.equal(m.t, 0);
});
t('full hold rewrites over several seconds and persists as NEW', () => {
  const m = C.createMachine(); m.press(); for (let i = 0; i < 100; i++) m.step(16); assert.equal(m.state, 'REWRITING');
  m.release(); assert.equal(m.state, 'REWRITING');
  let ms = 0; while (m.state === 'REWRITING') { m.step(16); ms += 16; } assert.equal(m.state, 'NEW'); assert.ok(ms > 5000, 'rewrite takes seconds: ' + ms);
  assert.equal(m.settled, 'new');
});
t('undo returns to the old world', () => {
  const m = C.createMachine(); m.scrub(1); m.undo(); assert.equal(m.state, 'UNDOING');
  for (let i = 0; i < 400; i++) m.step(16); assert.equal(m.state, 'OLD'); assert.equal(m.t, 0); assert.equal(m.settled, 'old');
});
t('compare shows the old world without changing the stored one', () => {
  const m = C.createMachine(); m.scrub(1); m.setCompare(true); for (let i = 0; i < 200; i++) m.step(16);
  assert.equal(m.view().td, 0); assert.equal(m.t, 1); m.setCompare(false); for (let i = 0; i < 200; i++) m.step(16); assert.equal(m.view().td, 1);
});
t('haunting is caused by the rewrite: only after NEW, reversed by undo', () => {
  const m = C.createMachine(); for (let i = 0; i < 400; i++) m.step(16); assert.equal(m.haunt, 0);
  m.press(); for (let i = 0; i < 100; i++) m.step(16); m.release();
  while (m.state === 'REWRITING') { assert.equal(m.haunt, 0); m.step(16); }
  for (let i = 0; i < 700; i++) m.step(16); assert.ok(m.haunt > 0.9, 'haunt ' + m.haunt);
  m.undo(); for (let i = 0; i < 400; i++) m.step(16); assert.equal(m.haunt, 0);
  const a = C.hauntState(0), b = C.hauntState(1); assert.equal(a.heading, 180); assert.equal(b.heading, 0); assert.equal(a.margin, 0); assert.equal(b.margin, 1);
});
t('reduced motion uses held keyframes only', () => {
  const m = C.createMachine({ reduced: true }); m.press(); for (let i = 0; i < 100; i++) m.step(16);
  const seen = new Set(); let guard = 0;
  while (m.state !== 'NEW' && guard++ < 1000) { m.step(50); seen.add(m.t); }
  assert.deepEqual([...seen].sort(), ['0.5', '1'].map(Number).sort((a, b) => a - b).filter((x) => seen.has(x)));
  for (let i = 0; i < 100; i++) m.step(50); assert.equal(m.haunt, 1);
});
t('text copy is complete', () => { assert.equal(C.FACT.old.zh, '灰堡市建于永昌四十二年。'); assert.equal(C.FACT.neu.zh, '灰堡市从未建立。'); assert.match(C.FACT.neu.en, /never founded/); });
console.log(n + ' passed');
