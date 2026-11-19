// Unit tests for rewrite-v6/core.js plus a syntax check of every V6 script. Usage: node tests/run-v6.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const C = require('../rewrite-v6/core.js');
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };

for (const f of readdirSync(new URL('../rewrite-v6/', import.meta.url)).filter((x) => x.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', new URL('../rewrite-v6/' + f, import.meta.url).pathname]);
}
ok('node --check passes for every rewrite-v6 script');

// copy: every Chinese line has an English caption
for (const k of ['old', 'neu']) assert.ok(/[\u4e00-\u9fff]/.test(C.FACT[k].zh) && /^[A-Z]/.test(C.FACT[k].en));
assert.ok(C.FACT.old.zh.includes('沈砚') && !C.FACT.neu.zh.includes('母树,树根'));
ok('fact lines exist in Chinese with English captions');

// one parameter drives everything: every metric moves monotonically from old to new
const ts = Array.from({ length: 101 }, (_, i) => i / 100);
const M = ts.map((t) => C.metrics(t));
for (const k of ['treeLen', 'nodes', 'leaves', 'rootLen', 'roots']) for (let i = 1; i < M.length; i++) assert.ok(M[i][k] <= M[i - 1][k] + 1e-6, k + ' never grows back at t=' + ts[i]);
for (const k of ['moss', 'mycelium', 'ferns', 'herbs', 'loose', 'relics']) for (let i = 1; i < M.length; i++) assert.ok(M[i][k] >= M[i - 1][k] - 1e-6, k + ' never shrinks at t=' + ts[i]);
for (let i = 1; i < M.length; i++) assert.ok(M[i].flow <= M[i - 1].flow + 1e-6);
assert.ok(M[0].nodes === 8 && M[0].roots === 14 && M[100].nodes === 0 && M[100].roots === 0 && M[100].treeLen < 1 && M[100].rootLen < 1);
assert.ok(M[0].moss < 0.2 && M[100].moss > 0.7 && M[0].flow === 1 && M[100].flow === -1);
ok('tree, roots, leaves, soil, vein flow, moss, ferns and relics all follow one t monotonically (8 nodes and 14 roots at 0, none at 1; flow reverses)');

// no big jumps: continuous in t
for (const k of ['treeLen', 'rootLen', 'leaves', 'moss', 'ferns', 'loose']) { const tot = Math.abs(M[100][k] - M[0][k]) || 1; for (let i = 1; i < M.length; i++) assert.ok(Math.abs(M[i][k] - M[i - 1][k]) < tot * 0.15, k + ' step at ' + ts[i]); }
ok('no metric jumps more than 15% of its range between t steps of 0.01');

// retraction order: tips before trunk, deep roots before the main root
const tl = (t) => C.treeGeometry(t);
assert.ok(tl(0.2)[6].len < tl(0.2)[0].len * 0.2 && tl(0.2)[0].k === 1);
assert.ok(C.rootGeometry(0.3)[10].k < 0.5 && C.rootGeometry(0.3)[0].k === 1);
assert.ok(C.rootGeometry(0.5)[0].k > 0.9 && C.treeGeometry(0.5)[0].k > 0.9 && C.treeGeometry(0.5)[6].len < 1);
ok('retraction order: twig tips and deep roots leave first, trunk and main root last');

// geometry is reproducible
assert.deepEqual(C.treeGeometry(0.4), C.treeGeometry(0.4)); assert.equal(C.hash(5, 9), C.hash(5, 9));
// anchor is on root 0 at t=0 and the haunt hand is centred on it
const r0 = C.rootGeometry(0)[0]; let best = 1e9; for (let u = 0; u <= 1; u += 0.01) { const p = C.bez(r0.S, r0.C, r0.E, u); best = Math.min(best, Math.hypot(p[0] - C.anchor.x, p[1] - C.anchor.y)); }
assert.ok(best < 1, 'anchor lies on root 0: ' + best);
const hx = C.HAND.reduce((s, h) => s + h.x, 0) / C.HAND.length, hy = C.HAND.reduce((s, h) => s + h.y, 0) / C.HAND.length;
assert.ok(Math.hypot(hx - C.anchor.x, hy - C.anchor.y) < 80, 'hand centred near anchor');
const nb = C.nameBox(0); assert.ok(nb.x > C.anchor.x && Math.abs(nb.y - C.anchor.y) < 80);
ok('haunt anchor lies on root 0 and the handprint is centred on it; the name sits on the old vein');

// haunt phases are ordered causally
const hs = (h) => C.hauntState(h);
assert.ok(hs(0).hand === 0 && hs(0.1).hand > 0 && hs(0.1).gather === 0 && hs(0.3).run === 0 && hs(0.5).name === 0 && hs(1).name === 1 && hs(0.61).note === 0 && hs(0.7).note === 1);
ok('haunt order: hand, then condensation gathers, then a bead runs, then the name, then the note');

// machine
const mk = (o) => C.createMachine(o); const run = (m, ms, st = 16) => { for (let t = 0; t < ms; t += st) m.step(st); };
let m = mk(); m.press(); assert.equal(m.state, 'WRITING'); run(m, 600); assert.ok(m.w > 0.4 && m.w < 0.6); m.release(); assert.equal(m.state, 'OLD'); run(m, 500); assert.equal(m.w, 0); assert.equal(m.t, 0);
ok('hold to write: early release cancels and drains back to old, t stays 0');
m = mk(); m.press(); run(m, 1300); assert.equal(m.state, 'RECONSTRUCTING'); m.release(); assert.equal(m.state, 'RECONSTRUCTING');
let last = 0; while (m.state === 'RECONSTRUCTING') { m.step(16); assert.ok(m.t >= last); last = m.t; } assert.equal(m.state, 'NEW'); assert.equal(m.t, 1);
run(m, 4100); assert.equal(m.state, 'HAUNT'); assert.ok(m.haunt < 0.05); run(m, 10100); assert.equal(m.haunt, 1);
ok('hold 1.2 s starts a 9 s reconstruction, then NEW dwell (4 s), then HAUNT progress 0..1 over 10 s');
m.revert(); assert.equal(m.state, 'REVERTING'); assert.equal(m.haunt, 0); last = 1; while (m.state === 'REVERTING') { m.step(16); assert.ok(m.t <= last); last = m.t; } assert.equal(m.state, 'OLD'); assert.equal(m.t, 0); assert.equal(m.haunt, 0);
ok('undo plays t in reverse to old and clears the haunt');
m = mk(); m.press(); m.revert(); assert.equal(m.state, 'WRITING'); m = mk(); m.revert(); assert.equal(m.state, 'OLD');
m = mk(); m.setProgress(1); m.setCompare(true); run(m, 600); const v = m.view(); assert.ok(v.td < 0.01 && v.t === 1 && m.t === 1); m.setCompare(false); run(m, 600); assert.equal(m.view().td, 1);
ok('compare pulls the shown t to old without touching real t; undo is a no-op before anything is written');
const a = mk({ reduced: true }), b = mk(); a.press(); b.press(); run(a, 1300); run(b, 1300); let ta = 0, tb = 0; run(a, 3000); run(b, 3000); assert.ok(a.t < b.t);
ok('reduced motion stretches the rewrite instead of cutting it');
console.log(n + ' passed');
