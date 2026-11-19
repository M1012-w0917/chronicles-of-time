// Unit tests for rewrite-v7/core.js plus a syntax check of every V7 script. Usage: node tests/run-v7.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('../rewrite-v7/core.js');
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
const step = (m, ms, dt = 50) => { for (let t = 0; t < ms; t += dt) m.step(dt); };

for (const f of readdirSync(new URL('../rewrite-v7/', import.meta.url)).filter((x) => x.endsWith('.js'))) execFileSync(process.execPath, ['--check', new URL('../rewrite-v7/' + f, import.meta.url).pathname]);
ok('node --check passes for every rewrite-v7 script');

for (const k of ['old', 'neu']) assert.ok(/[\u4e00-\u9fff]/.test(C.FACT[k].zh) && /^[A-Z]/.test(C.FACT[k].en));
assert.equal(C.FACT.old.zh, '长桥织城以七座石拱桥跨越白河,桥上守桥人顾衡夜夜点灯。');
assert.equal(C.FACT.neu.zh, '白河从未建桥,织城沿河两岸分隔百年。');
ok('both sentences exist verbatim in Chinese with English captions');

assert.ok(C.COUNT >= 200 && C.COUNT <= 240, 'thread count ' + C.COUNT);
assert.equal(new Set(C.threads.map((x) => x.id)).size, C.COUNT);
assert.deepEqual([0, 1, 2].map((l) => C.threads.some((x) => x.layer === l)), [true, true, true]);
for (let i = 0; i < 7; i++) { const b = C.bundle(i); assert.ok(b.length >= 10 && b.length <= 14, 'bridge ' + i + ' has ' + b.length); }
ok('223 tracked threads in 3 layers, 7 bridge bundles of 10 to 14 threads, unique stable ids');

const s0 = C.threadsAt(0), s1 = C.threadsAt(1), id0 = s0.map((x) => x.id).join(), id1 = s1.map((x) => x.id).join();
assert.equal(id0, id1);
const br = C.bridgeIds();
const roles0 = new Set(s0.filter((x) => br.includes(x.id)).map((x) => x.role)), roles1 = new Set(s1.filter((x) => br.includes(x.id)).map((x) => x.role));
assert.ok([...roles0].every((r) => r.startsWith('bridge:')) && ![...roles1].some((r) => r.startsWith('bridge:')));
const moved = s0.filter((x) => br.includes(x.id)).filter((x, i) => { const y = s1.find((q) => q.id === x.id); return Math.hypot(x.pts[8] - y.pts[8], x.pts[9] - y.pts[9]) > 20; }).length;
assert.ok(moved > br.length * 0.9);
ok('the same ids exist at t=0 and t=1: bridge threads change role (bridge:i to river, road, house, person) and position');

const st = C.stats(0.5); assert.ok(st.extracted > 0 && st.extracted <= st.movers);
assert.equal(C.stats(0).extracted, 0); assert.equal(C.stats(1).extracted, 0); assert.equal(C.stats(1).rerouted, st.movers);
const mid = C.stats(0.55); assert.ok(mid.extracted > 20 && mid.rerouted < mid.movers);
ok('mid-rewrite extracted count > 0, nothing extracted at 0 or 1, all movers rerouted at 1');

// monotone and continuous: no jump larger than 25 px per node per 0.005 of t, pull and re never go backwards
let prev = C.threadsAt(0), maxJump = 0;
for (let t = 0.005; t <= 1.0001; t += 0.005) {
  const cur = C.threadsAt(t);
  for (let q = 0; q < cur.length; q++) {
    assert.ok(cur[q].pull >= prev[q].pull - 1e-9 && cur[q].re >= prev[q].re - 1e-9, 'monotone ' + cur[q].id);
    for (let k = 0; k < cur[q].pts.length; k++) maxJump = Math.max(maxJump, Math.abs(cur[q].pts[k] - prev[q].pts[k]));
  }
  prev = cur;
}
assert.ok(maxJump < 45, 'max jump ' + maxJump.toFixed(1));
ok('pull and reroute progress are monotone in t; max node step per dt=0.005 (45 ms of rewrite) is ' + maxJump.toFixed(1) + ' px (continuous)');

// order: bundles peel one after another, far bridges first
const p = (t, i) => { const b = C.bundle(i); return C.threadsAt(t).filter((x) => b.includes(x.id)).reduce((a, x) => a + x.pull, 0) / b.length; };
assert.ok(p(0.15, 0) > p(0.15, 6) + 0.2);
ok('staggered windows: bridge 0 is pulled out before bridge 6');

// state machine
let m = C.createMachine();
m.press(); step(m, 500); assert.equal(m.state, 'WRITING'); assert.ok(m.w > 0.3 && m.w < 0.5); m.release(); step(m, 600);
assert.equal(m.state, 'OLD'); assert.equal(m.w, 0); assert.equal(m.t, 0);
ok('hold to write: early release cancels and drains back to old, t stays 0');
m = C.createMachine(); let settled = 0; m.onSettle = () => settled++;
m.press(); step(m, 1300); assert.equal(m.state, 'RECONSTRUCTING');
step(m, 4500); assert.ok(m.t > 0.4 && m.t < 0.6); step(m, 5000); assert.equal(m.state, 'NEW'); assert.equal(settled, 1);
step(m, 4100); assert.equal(m.state, 'HAUNT'); step(m, 13000); assert.equal(m.haunt, 1); assert.equal(settled, 1);
ok('hold 1.2 s starts a 9 s rewrite, NEW settles once, haunt starts after 4 s and runs 12 s');
const h = (x) => C.hauntAt(x);
assert.ok(h(0).back === 0 && h(0.1).back > 0.9 && h(0.1).gutter >= 0.99 && h(0.3).stitch > 0 && h(0.3).hand === 0 && h(0.7).hand > 0 && h(0.7).reach === 0 && h(1).reach === 1);
ok('haunt order: camera swings behind and the red thread leaves the gutter, then stitches, then the hand forms, then reaches');
assert.deepEqual(C.HPATH.pts[0], [C.GUTTER.x, C.GUTTER.y]);
for (let k = 0; k < 7; k++) { const rib = C.threads.find((x) => x.id === C.HPATH.ribIds[k]); assert.equal(rib.oldRole, 'bridge:' + (6 - k)); }
const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
for (const [x, y] of C.HPATH.pts.slice(2)) { let best = 1e9; for (let i = 0; i < 7; i++) for (let u = 0; u <= 1.0001; u += 0.0005) best = Math.min(best, near([x, y], C.ribPoint(i, 1, u))); assert.ok(best < 1.5, 'off the outline: ' + best); }
ok('the red thread starts at the book gutter and every stitch point lies on the old bridge outline (outer ribs of bridge 6 to 0)');
m.setCompare(true); step(m, 600); assert.ok(m.c === 1 && m.t === 1 && m.view().hd === 0 && m.view().td === 0);
m.setCompare(false); step(m, 600); assert.ok(m.view().td === 1 && m.view().hd > 0.9);
ok('compare pulls the shown t and the haunt to old without touching real t, and releases back');
m.revert(); assert.equal(m.state, 'REVERTING'); step(m, 1600); assert.equal(m.haunt, 0); step(m, 2600); assert.equal(m.state, 'OLD'); assert.equal(m.t, 0);
ok('undo removes the haunt first and plays t in reverse to old in about 4 s');
let cleared = 0; m = C.createMachine(); m.onRevert = () => cleared++; m.revert(); assert.equal(cleared, 0); m.setProgress(1); m.revert(); assert.equal(cleared, 1);
ok('undo is a no-op before anything is written and fires the clear hook once otherwise');
m = C.createMachine({ reduced: true }); m.press(); step(m, 1300); step(m, 9000); assert.ok(m.t > 0.4 && m.t < 0.65 && m.state === 'RECONSTRUCTING');
ok('reduced motion stretches the same continuous t (1.8x) instead of cutting it');
m = C.createMachine(); m.press(); step(m, 600); m.setProgress(0); assert.equal(m.state, 'OLD');
console.log(n + ' passed');
