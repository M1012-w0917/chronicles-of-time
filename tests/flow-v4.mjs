// Browser checks for V4. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v4.mjs
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v4/index.html';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
let n = 0; const ok = (m) => { n++; console.log('ok -', m); };
async function open(url, ctx) {
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(url); await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3, null, { timeout: 30000 }); pg.errs = errs; return pg;
}
const S = (pg) => pg.evaluate(() => window.__slice.getState());
const FP = (pg) => pg.evaluate(() => window.__slice.fingerprint());
const dist = (a, c) => a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
const until = (pg, fn, ms = 60000) => pg.waitForFunction(fn, null, { timeout: ms });
// sample the monitor while a condition holds: one sample per ~250 ms
async function sampleUntil(pg, doneFn, ms = 60000) {
  const out = []; const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await S(pg); out.push({ t: s.t, fp: await FP(pg), s });
    if (await pg.evaluate(doneFn)) break; await pg.waitForTimeout(250);
  }
  return out;
}
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
let pg = await open(BASE + '?fresh=1', ctx);

// 1 initial state: all evidence agrees
const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['陈守拙是灰堡市渡口的守闸人。', '渡口从未设闸,陈守拙从未存在。', '查无此人', 'The ferry never had a lock. Chen Shouzhuo never existed.', 'CAM-07']) assert.ok(text.includes(s), 'missing ' + s);
ok('Chinese copy and English captions present');
const old0 = await S(pg); assert.equal(old0.state, 'OLD'); assert.equal(old0.t, 0); assert.equal(old0.gateOpen, 0); assert.equal(old0.warehouse, 1);
assert.ok(old0.log.every((l) => /陈守拙|人员 1/.test(l)), 'log is the old log: ' + old0.log);
assert.equal(await pg.evaluate(() => document.querySelectorAll('canvas#cam').length), 1);
for (const id of ['ph1', 'ph2', 'ph3', 'map']) assert.equal(await pg.evaluate((i) => !!document.getElementById(i), id), true);
const fOld = await FP(pg); ok('initial: one monitor, photos, map, card and log all show the old world');

// 2 pen down: early release cancels, jitter ties to pen
await pg.keyboard.down('Space'); await pg.waitForTimeout(500);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.jitter > 0.2, 'monitor tracking jitter while writing: ' + wr.jitter);
await pg.keyboard.up('Space'); assert.equal((await S(pg)).state, 'OLD'); ok('pen down jitters the monitor, early release cancels');
await until(pg, () => window.__slice.getState().w === 0); assert.equal((await S(pg)).t, 0);

// 3 continuous reconstruction on the same camera
await pg.evaluate(() => { document.getElementById('cam').dataset.same = 'yes'; });
await pg.keyboard.down('Space'); await until(pg, () => window.__slice.getState().state === 'RECONSTRUCTING'); await pg.keyboard.up('Space');
const run = await sampleUntil(pg, () => window.__slice.getState().state === 'NEW', 30000);
assert.ok(run.length >= 20, 'sampled frames: ' + run.length);
for (let i = 1; i < run.length; i++) assert.ok(run[i].t >= run[i - 1].t, 't never goes back');
const d = run.map((r) => dist(fOld, r.fp));
let back = 0; for (let i = 1; i < d.length; i++) back = Math.max(back, d[i - 1] - d[i]);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length; const q4 = Math.floor(d.length / 4);
const qa = [0, 1, 2, 3].map((k) => avg(d.slice(k * q4, k === 3 ? d.length : (k + 1) * q4)));
assert.ok(qa[0] < qa[1] && qa[1] < qa[2] && qa[2] < qa[3] && qa[3] > qa[0] * 2, 'distance grows quarter by quarter: ' + qa.map((v) => v.toFixed(1)));
assert.ok(back < 2.5, 'distance from the old frame grows (largest dip, from tracking jitter ' + back.toFixed(2) + ')');
const steps = run.slice(1).map((r, i) => dist(run[i].fp, r.fp)); const total = Math.max(...d);
assert.ok(total > 5, 'the frame ends far from the old one: ' + total.toFixed(1));
assert.ok(Math.max(...steps) < total * 0.6, 'no single-frame swap: biggest step ' + Math.max(...steps).toFixed(1) + ' of ' + total.toFixed(1));
assert.ok(steps.filter((s) => s > 0.15).length >= steps.length * 0.7, 'frames keep changing');
assert.equal(await pg.evaluate(() => document.getElementById('cam').dataset.same), 'yes');
ok('same CAM-07 canvas changes continuously over ' + run.length + ' sampled frames (no swap)');
const mid = run.find((r) => r.t > 0.4 && r.t < 0.8) || run[Math.floor(run.length / 2)];
assert.ok(mid.s.gateOpen > 0 && mid.s.gateOpen < 1 && mid.s.warehouse > 0 && mid.s.warehouse < 1, 'gate and warehouse mid-way');
const rewritten = mid.s.log.filter((l) => /无闸|0 艘|无人|人员 0/.test(l)).length; assert.ok(rewritten >= 1 && rewritten < 4, 'log lines rewrite one by one: ' + rewritten);
assert.ok(parseFloat(mid.s.factNew) > 0 && parseFloat(mid.s.factNew) < 1); assert.ok(parseFloat(mid.s.cardStrike) > 0);
ok('photos, map, card strike, fact line and log are mid-rewrite at the same moment');

// 4 new world dwell, persistence, compare, revert
let s = await S(pg); assert.equal(s.state, 'NEW'); const fNew = await FP(pg);
assert.deepEqual((await S(pg)).log.every((l) => /无闸|0 艘|无人|人员 0/.test(l)), true);
await pg.waitForTimeout(1500); s = await S(pg); assert.equal(s.state, 'NEW'); assert.equal(s.haunt, 0); ok('NEW world holds still for the dwell, no haunt yet');
await pg.goto(BASE); await pg.waitForFunction(() => window.__slice && ['NEW', 'HAUNT'].includes(window.__slice.getState().state), null, { timeout: 30000 }); ok('new reality persists across reload');
await pg.keyboard.down('c'); await until(pg, () => window.__slice.getState().c === 1);
{ const fc = await FP(pg); assert.ok(dist(fOld, fc) < dist(fNew, fc) * 0.5, 'compare looks like the old frame'); const cs = await S(pg); assert.equal(cs.t, 1); assert.ok(cs.td < 0.05); }
assert.equal(await pg.getAttribute('#compareBtn', 'aria-pressed'), 'true');
await pg.keyboard.up('c'); await until(pg, () => window.__slice.getState().c === 0); assert.ok(dist(fNew, await FP(pg)) < 20); ok('hold C compares (old on every document), release returns to the new world');
await pg.keyboard.press('z'); await pg.waitForTimeout(300); assert.equal((await S(pg)).state, 'REVERTING');
const back2 = await sampleUntil(pg, () => window.__slice.getState().state === 'OLD', 20000); assert.ok(back2.length >= 5);
for (let i = 1; i < back2.length; i++) assert.ok(back2[i].t <= back2[i - 1].t + 1e-9);
assert.ok(dist(fOld, await FP(pg)) < 4, 'old frame restored'); assert.equal((await S(pg)).persisted, null); ok('revert runs the world backwards to the old frame and clears persistence');

// 5 haunt
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(600); assert.equal((await S(pg)).tape, 0);
await pg.evaluate(() => window.__slice.setProgress(1)); await pg.waitForTimeout(300);
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000); assert.equal((await S(pg)).heading, 180);
await until(pg, () => window.__slice.getState().haunt > 0.97, 30000);
const h = await S(pg); assert.ok(h.heading < 8 && h.tape > 0.95 && h.mismatch === 1, JSON.stringify(h));
assert.equal(await pg.evaluate(() => document.querySelectorAll('#log li.bad').length), 1);
assert.ok((await pg.evaluate(() => document.querySelector('#log li.bad').textContent)).includes('人员登记 0 / 画面检测 1'));
assert.ok(dist(fNew, await FP(pg)) > 3, 'tape corner and detection box are on the monitor');
ok('haunt: old-dated tape figure turns to the lens, log shows 0 registered / 1 detected');
await pg.keyboard.down('c'); await until(pg, () => window.__slice.getState().c === 1);
assert.equal(await pg.evaluate(() => document.querySelectorAll('#log li.bad').length), 0); await pg.keyboard.up('c'); ok('the haunt hides while comparing');

// 6 reduced motion
const rc = await b.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
const rp = await open(BASE + '?fresh=1', rc); assert.equal((await S(rp)).reduced, true);
await rp.keyboard.down('Space'); await rp.waitForTimeout(400); assert.equal((await S(rp)).jitter, 0); await until(rp, () => window.__slice.getState().state === 'RECONSTRUCTING'); await rp.keyboard.up('Space');
const rr = await sampleUntil(rp, () => window.__slice.getState().state === 'NEW', 20000);
assert.ok(rr.length >= 6 && rr.every((r) => r.s.jitter === 0), 'no jitter, still continuous: ' + rr.length);
for (let i = 1; i < rr.length; i++) assert.ok(rr[i].t >= rr[i - 1].t); ok('reduced motion: shorter, jitter-free, still continuous t');
await rp.evaluate(() => window.__slice.forceHaunt(1)); await rp.waitForTimeout(300); assert.equal((await S(rp)).heading, 0); ok('reduced motion reaches the same haunt');
const tp = await open(BASE + '?reduced=0&fresh=1', await b.newContext({ viewport: { width: 1600, height: 900 } })); assert.equal((await S(tp)).reduced, false);
await tp.click('#reduceBtn'); assert.equal((await S(tp)).reduced, true); ok('reduced-motion toggle works');

assert.deepEqual(pg.errs, []); assert.deepEqual(rp.errs, []); assert.deepEqual(tp.errs, []); ok('no console errors over http');
const fpg = await open(pathToFileURL(fileURLToPath(new URL('../rewrite-v4/index.html', import.meta.url))).href + '?t=1', await b.newContext({ viewport: { width: 1200, height: 800 } }));
assert.equal((await S(fpg)).state, 'NEW'); assert.deepEqual(fpg.errs, []); ok('works from file://');
await b.close(); console.log(n + ' passed');
