// node tests/run.mjs : unit tests for rewrite/core.js plus a syntax check of every JS file.
import { createRequire } from 'node:module';
import { readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const C = require('../rewrite/core.js');
let n = 0;
function test(name, fn) { fn(); n++; console.log('ok -', name); }

test('seeded RNG is deterministic and in [0,1)', () => {
  const a = C.mulberry32(1873), b = C.mulberry32(1873), c = C.mulberry32(1874);
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 50; i++) { sa.push(a()); sb.push(b()); sc.push(c()); }
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, sc);
  assert.ok(sa.every(v => v >= 0 && v < 1));
});

test('erasure curve is monotonic in t, 0 at t=0 and 1 at t=1 for every wave/jitter', () => {
  for (let w = 0; w <= 1.0001; w += 0.1) for (let j = 0; j <= 1.0001; j += 0.25) {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) { const p = C.localProgress(t, w, j); assert.ok(p >= prev - 1e-12); prev = p; }
    assert.equal(C.localProgress(0, w, j), 0);
    assert.equal(C.localProgress(1, w, j), 1);
  }
});

test('wave starts at the pen: near entities change before far ones', () => {
  assert.ok(C.localProgress(0.2, 0.1, 0.5) > C.localProgress(0.2, 0.9, 0.5));
});

test('state machine: OLD -> WRITING -> REWRITING -> NEW -> UNDOING -> OLD', () => {
  const m = C.createMachine({ holdDuration: 1, rewriteDuration: 4, undoDuration: 2 });
  assert.equal(m.state, 'OLD');
  assert.ok(m.startHold()); assert.equal(m.state, 'WRITING');
  m.tick(0.5); assert.equal(m.state, 'WRITING'); assert.ok(Math.abs(m.hold - 0.5) < 1e-9);
  m.tick(0.6); assert.equal(m.state, 'REWRITING');
  m.tick(2); assert.ok(Math.abs(m.t - 0.5) < 1e-9);
  m.tick(3); assert.equal(m.state, 'NEW'); assert.equal(m.t, 1);
  m.tick(1.5); assert.equal(m.newTime, 1.5);
  assert.ok(m.undo()); assert.equal(m.state, 'UNDOING');
  m.tick(1); assert.ok(Math.abs(m.t - 0.5) < 1e-9);
  m.tick(1.5); assert.equal(m.state, 'OLD'); assert.equal(m.t, 0);
});

test('hold released early cancels the write', () => {
  const m = C.createMachine({ holdDuration: 1 });
  m.startHold(); m.tick(0.4); assert.ok(m.releaseHold());
  assert.equal(m.state, 'OLD'); assert.equal(m.hold, 0); assert.equal(m.t, 0);
  assert.equal(m.releaseHold(), false);
});

test('undo mid-rewrite reverses from the current progress; undo is a no-op in OLD', () => {
  const m = C.createMachine({ holdDuration: 0.1, rewriteDuration: 10, undoDuration: 5 });
  assert.equal(m.undo(), false);
  m.startHold(); m.tick(0.2); m.tick(3);
  assert.ok(Math.abs(m.t - 0.3) < 1e-9);
  assert.ok(m.undo()); m.tick(1); assert.ok(Math.abs(m.t - 0.1) < 1e-9);
});

test('scrub produces SCRUB state between ends and settles at OLD/NEW', () => {
  const m = C.createMachine();
  m.scrub(0.4); assert.equal(m.state, 'SCRUB'); m.tick(5); assert.equal(m.t, 0.4);
  m.scrub(1); assert.equal(m.state, 'NEW'); m.scrub(0); assert.equal(m.state, 'OLD');
});

test('reduced-motion stages use three held keyframes', () => {
  assert.deepEqual(C.KEYFRAMES, [0, 0.5, 1]);
  const s0 = C.reducedStages(0.1), s1 = C.reducedStages(0.25), s2 = C.reducedStages(0.9);
  assert.equal(s0.a, 0); assert.equal(s0.mix, 0);
  assert.equal(s1.a, 0); assert.equal(s1.b, 0.5); assert.ok(s1.mix > 0.4 && s1.mix < 0.6);
  assert.equal(s2.a, 0.5); assert.equal(s2.b, 1); assert.equal(C.reducedStages(1).mix, 1);
});

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    if (f === '.git' || f === 'node_modules') continue;
    const p = d + '/' + f;
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(m?js)$/.test(f)) out.push(p);
  }
  return out;
}
test('node --check passes for all JS files', () => {
  const files = walk(new URL('..', import.meta.url).pathname.replace(/\/$/, ''));
  assert.ok(files.length >= 5);
  for (const f of files) execFileSync(process.execPath, ['--check', f]);
});
console.log(`\n${n} tests passed`);
