// Shared full-interaction scenario for tests/interaction-v2.mjs (asserts) and tests/record-v2.mjs (video).
// Waits on state, never on wall clock, because software-GL headless is slow. `hold(ms)` is a short visual dwell only.
import assert from 'node:assert/strict';
export async function runScenario(b, BASE, { video, log = () => {}, viewport = { width: 1280, height: 720 }, dwell = 0 } = {}) {
  const ctx = await b.newContext({ viewport, ...(video ? { recordVideo: { dir: video, size: viewport } } : {}) });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const S = () => pg.evaluate(() => window.__slice.getState());
  const until = (fn, arg) => pg.waitForFunction(fn, arg, { timeout: 60000 });
  const stateIs = (s) => until((s) => window.__slice.getState().state === s, s);
  const hold = (ms) => pg.waitForTimeout(dwell ? ms : 0);
  const step = (m) => log('ok - ' + m);
  await pg.goto(BASE); await until(() => window.__slice && window.__slice.getState().counts.buildings > 40); await hold(3000);
  const old0 = await S(); assert.equal(old0.state, 'OLD'); step('1 before rewrite: old city, ' + old0.counts.buildings + ' buildings');

  // 2 hold, early release cancels
  await pg.keyboard.down('Space'); await until(() => window.__slice.getState().w > 0.3); await hold(500);
  assert.equal((await S()).state, 'WRITING'); await pg.keyboard.up('Space');
  await until(() => window.__slice.getState().w === 0); const c1 = await S();
  assert.equal(c1.state, 'OLD'); assert.equal(c1.t, 0); assert.equal(c1.counts.buildings, old0.counts.buildings); step('2 pen down, early release cancels, world unchanged'); await hold(1200);

  // 3 hold full, rewrite begins; undo mid-way; rewrite again (chain 1)
  await pg.keyboard.down('Space'); await stateIs('REWRITING'); await pg.keyboard.up('Space');
  await until(() => { const s = window.__slice.getState(); return s.counts.footprints > 5 && s.counts.buildings > 5; }); await hold(800);
  const mid = await S(); assert.ok(mid.counts.buildings < old0.counts.buildings && mid.counts.buildings > 0 && mid.counts.footprints > 0, JSON.stringify(mid)); step('3 hold full: mid-rewrite, ' + mid.counts.buildings + ' buildings left, ' + mid.counts.footprints + ' footprints');
  await pg.keyboard.press('z'); await stateIs('UNDOING'); await stateIs('OLD'); assert.equal((await S()).t, 0); step('4 undo mid-rewrite returns to the old city'); await hold(800);
  await pg.keyboard.down('Enter'); await stateIs('REWRITING'); await pg.keyboard.up('Enter'); step('5 chained rewrite #2 started with Enter');
  await stateIs('NEW'); const nw = await S(); assert.equal(nw.counts.buildings, 0); assert.equal(nw.counts.people, 1); assert.ok(nw.counts.footprints > 0 && nw.counts.folds > 0); step('6 new world reached: ' + nw.counts.footprints + ' footprints, ' + nw.counts.folds + ' folds');

  // 4 dwell then haunt
  await hold(2500); await until(() => window.__slice.getState().haunt > 0.95); const h = await S(); assert.ok(h.heroHeading < 5);
  assert.equal(await pg.evaluate(() => document.getElementById('dock').dataset.echo), 'true'); step('7 dwell then haunt: hero turned to camera, margin note shown'); await hold(2500);

  // 5 compare (C key)
  await pg.keyboard.down('c'); await until(() => window.__slice.getState().c === 1); assert.ok((await S()).counts.buildings > 40); await hold(1800);
  await pg.keyboard.up('c'); await until(() => window.__slice.getState().c === 0); assert.equal((await S()).counts.buildings, 0); step('8 compare shows old, release returns to new'); await hold(1000);

  // 6 undo from the settled new world, then chained rewrite #3 by keyboard
  await pg.keyboard.press('z'); await stateIs('UNDOING'); await stateIs('OLD'); step('9 undo from new world returns to old');
  await pg.keyboard.down('Space'); await stateIs('REWRITING'); await pg.keyboard.up('Space'); await stateIs('NEW'); step('10 chained rewrite #3 completes'); await hold(1500);

  // 7 keyboard focus path: Tab reaches the pen button
  await pg.keyboard.press('Tab'); const f1 = await pg.evaluate(() => document.activeElement && document.activeElement.id); assert.ok(f1, 'Tab focuses a control');
  const seen = [f1]; for (let i = 0; i < 6; i++) { await pg.keyboard.press('Tab'); seen.push(await pg.evaluate(() => document.activeElement.id)); }
  for (const id of ['penBtn', 'undoBtn', 'compareBtn', 'scrub', 'reduceBtn']) assert.ok(seen.includes(id), 'Tab reaches ' + id + ' in ' + seen);
  step('11 Tab reaches pen, undo, compare, scrub, reduce controls: ' + seen.join(' > '));
  assert.deepEqual(errs, []);

  // 8 reduced motion (R key), keyframes only
  await pg.evaluate(() => document.activeElement && document.activeElement.blur());
  await pg.keyboard.press('z'); await stateIs('UNDOING'); await stateIs('OLD');
  await pg.keyboard.press('r'); assert.equal((await S()).reduced, true); await hold(800);
  await pg.evaluate(() => { window.__ts = new Set(); const f = () => { window.__ts.add(window.__slice.getState().t); requestAnimationFrame(f); }; f(); });
  await pg.keyboard.down('Space'); await stateIs('REWRITING'); await pg.keyboard.up('Space'); await hold(900); await stateIs('NEW');
  const ts = await pg.evaluate(() => [...window.__ts]); assert.ok(ts.every((t) => [0, 0.5, 1].includes(t)) && ts.includes(0.5), 'keyframes ' + ts);
  assert.equal((await S()).counts.buildings, 0); step('12 reduced motion: only keyframes ' + ts.sort().join('/') + ', same new world'); await hold(2500);
  assert.deepEqual(errs, []); step('13 no console errors');
  await pg.keyboard.press('r'); // leave reduced
  const v = pg.video(); await ctx.close();
  return v ? await v.path() : null;
}
