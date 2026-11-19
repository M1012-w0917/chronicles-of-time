// Browser checks for V7. Usage (server on :8000 from repo root: python3 -m http.server 8000): node tests/flow-v7.mjs
import assert from 'node:assert/strict';
import { launch } from './pw-v7.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v7/index.html';
const b = await launch();
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
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
let pg = await open(BASE + '?fresh=1', ctx);

const text = await pg.evaluate(() => document.body.textContent);
for (const s of ['长桥织城以七座石拱桥跨越白河,桥上守桥人顾衡夜夜点灯。', '白河从未建桥,织城沿河两岸分隔百年。', 'on seven stone arch bridges', 'No bridge was ever built over the White River', '顾衡', 'Gu Heng']) assert.ok(text.includes(s), 'missing ' + s);
ok('Chinese copy and English captions present in the DOM (CJK glyph rendering 未验证: no CJK system font in this sandbox)');
const s0 = await S(pg); assert.equal(s0.state, 'OLD'); assert.equal(s0.t, 0); assert.equal(s0.extracted, 0);
const snap0 = await pg.evaluate(() => window.__slice.threadSnapshot()); assert.ok(snap0.length >= 200);
const fOld = await FP(pg); ok('initial: OLD, t=0, ' + snap0.length + ' threads');

// early release cancels
await pg.keyboard.down('Space'); await pg.waitForTimeout(500);
const wr = await S(pg); assert.equal(wr.state, 'WRITING'); assert.ok(wr.w > 0.1 && wr.w < 0.8); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'OLD', 5000);
let s = await S(pg); assert.equal(s.t, 0); assert.ok(dist(fOld, await FP(pg)) < 5); ok('early release cancels: back to OLD with t=0 and the same cloth');

// pointer hold 1.2 s on the line
const box = await pg.locator('#fact').boundingBox();
await pg.mouse.move(box.x + 40, box.y + 20); await pg.mouse.down(); await pg.waitForTimeout(500); assert.equal((await S(pg)).state, 'WRITING'); await pg.mouse.up(); await until(pg, () => window.__slice.getState().state === 'OLD', 5000);
await pg.mouse.down(); await pg.waitForTimeout(1500); await pg.mouse.up();
assert.equal((await S(pg)).state, 'RECONSTRUCTING'); ok('pointer press-hold 1.2 s on the line starts the rewrite, early pointer release cancels');
await pg.evaluate(() => window.__slice.setProgress(0)); await pg.waitForTimeout(200);

// keyboard Enter on focused line
await pg.focus('#fact'); await pg.keyboard.down('Enter'); await pg.waitForTimeout(1500); await pg.keyboard.up('Enter');
assert.equal((await S(pg)).state, 'RECONSTRUCTING'); ok('Enter on the focused line also writes');

// mid-rewrite: ids and extraction
await until(pg, () => window.__slice.getState().t > 0.45, 20000);
s = await S(pg); assert.ok(s.extracted > 0, 'extracted ' + s.extracted);
const snapMid = await pg.evaluate(() => window.__slice.threadSnapshot()); assert.ok(snapMid.filter((x) => x.mover && x.z > 0.3).length > 0);
assert.deepEqual(snapMid.map((x) => x.id), snap0.map((x) => x.id)); ok('mid-rewrite: ' + s.extracted + ' threads are lifted out of the cloth, same ids as at t=0');
await until(pg, () => window.__slice.getState().state === 'NEW', 30000);
const snap1 = await pg.evaluate(() => window.__slice.threadSnapshot());
assert.deepEqual(snap1.map((x) => x.id), snap0.map((x) => x.id));
const br = snap0.filter((x) => x.oldRole.startsWith('bridge:')); assert.ok(br.length >= 70);
for (const x of br) { const y = snap1.find((q) => q.id === x.id); assert.ok(!y.role.startsWith('bridge:')); }
ok('NEW: all ' + br.length + ' bridge thread ids survive with new roles');
s = await S(pg); assert.equal(s.t, 1); assert.ok(s.persisted); assert.ok(s.wipe > 0.99);

// compare
const fNew = await FP(pg);
await pg.keyboard.down('c'); await pg.waitForTimeout(900);
s = await S(pg); assert.equal(s.compare, true); assert.equal(s.t, 1); assert.ok(s.td < 0.01); const fCmp = await FP(pg); assert.ok(dist(fNew, fCmp) > 3);
await pg.keyboard.up('c'); await pg.waitForTimeout(900); s = await S(pg); assert.ok(s.td > 0.999 && s.compare === false && dist(fNew, await FP(pg)) < dist(fNew, fCmp));
ok('hold C shows the old cloth (shown t 0) while real t stays 1, release returns to the new one');

// haunt
await until(pg, () => window.__slice.getState().state === 'HAUNT', 15000);
await until(pg, () => window.__slice.getState().stitch > 0.3, 15000);
s = await S(pg); assert.ok(s.back > 0.9 && s.gutterLen > 5 && s.name > 0.3);
await pg.keyboard.down('c'); await pg.waitForTimeout(800); s = await S(pg); assert.equal(s.hauntShown, 0); assert.equal(s.gutterLen, 0); await pg.keyboard.up('c');
ok('haunt exists in NEW: camera behind, red thread from the gutter, name leaving the register; hidden while comparing');
await until(pg, () => window.__slice.getState().hand > 0.9, 30000);
await pg.keyboard.press('z'); await until(pg, () => window.__slice.getState().state === 'OLD', 20000);
s = await S(pg); assert.equal(s.t, 0); assert.equal(s.haunt, 0); assert.equal(s.persisted, null); assert.equal(s.gutterLen, 0);
ok('Z reverses: haunt removed, t back to 0, storage cleared');
assert.deepEqual(pg.errs, []); await pg.close();

// persistence and reload
pg = await open(BASE + '?fresh=1', ctx); await pg.evaluate(() => window.__slice.setProgress(0)); await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space');
await until(pg, () => window.__slice.getState().state === 'NEW', 30000); assert.ok((await S(pg)).persisted);
await pg.goto(BASE); await pg.waitForFunction(() => window.__slice && window.__slice.getState().frame > 3);
s = await S(pg); assert.ok(s.t === 1 && (s.state === 'NEW' || s.state === 'HAUNT')); await until(pg, () => window.__slice.getState().state === 'HAUNT', 10000);
ok('reload keeps the new world and replays the haunt'); await pg.close();

// reduced motion
pg = await open(BASE + '?fresh=1&reduced=1', ctx);
const a = await FP(pg); await pg.waitForTimeout(700); assert.ok(dist(a, await FP(pg)) < 0.01, 'ambient motion in reduced mode');
await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space'); await pg.waitForTimeout(3000);
const r1 = await S(pg); await pg.waitForTimeout(1000); const r2 = await S(pg); assert.ok(r2.t > r1.t && r2.reduced);
const nb = await open(BASE + '?fresh=1', ctx); const a2 = await FP(nb); await nb.waitForTimeout(700); assert.ok(dist(a2, await FP(nb)) > 0.01, 'normal mode should have ambient motion'); await nb.close();
ok('reduced motion: static when idle, t still advances continuously (slower); normal mode has ambient sway');
const rt = await S(pg); assert.equal(rt.reduced, true); assert.deepEqual(pg.errs, []); await pg.close();

// still params + frame cost
pg = await open(BASE + '?t=0.5', ctx); s = await S(pg); assert.equal(s.t, 0.5); assert.ok(s.frameMs.avg < 40, 'frame ms ' + s.frameMs.avg); ok('?t=0.5 still renders, average draw ' + s.frameMs.avg.toFixed(1) + ' ms (headless software rendering)'); await pg.close();
pg = await open('file://' + process.cwd() + '/rewrite-v7/index.html?state=new', ctx); assert.equal((await S(pg)).t, 1); assert.deepEqual(pg.errs, []); ok('opens from file:// with no console errors'); await pg.close();
console.log(n + ' passed'); await b.close();
