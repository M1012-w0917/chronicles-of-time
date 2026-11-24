// Deterministic Book+Shadow screenshots into docs/screenshots/bs-*.jpg. Server on :8000 from repo root first.
// Old-code shots (bs-before-*) come from tests/shoot-before-bs.mjs. bs-05-haunt is taken with real mouse input while the anomaly flag is 1.
import { launch } from './pw-bs.mjs';
import { copyFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-book-shadow/index.html';
const shots = {
  'bs-01-before': '?t=0', 'bs-02-pen-down': '?w=0.85', 'bs-03-reconstructing': '?t=0.45&lx=700&ly=330',
  'bs-03a-reconstructing-early': '?t=0.3&lx=700&ly=330', 'bs-03b-reconstructing-late': '?t=0.65&lx=700&ly=330',
  'bs-04-new-world': '?state=new', 'bs-after-first-lit': '?t=0&lit=1', 'bs-compare-after': '?state=new', 'bs-after-haunt': '?state=new&haunt=1&lx=520&ly=330',
  'bs-reduced-mid': '?t=0.4&reduced=1', 'bs-anomaly-reduced': '?state=new&haunt=1&reduced=1&lx=700&ly=330&anom=1',
};
const only = process.argv[2];
const b = await launch();
const errs = [];
const mkPage = async (w, h) => { const pg = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text())); return pg; };
let pg = await mkPage(1600, 900);
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  await pg.goto(BASE + qs); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 86 }); console.log(n);
}
if (!only || 'bs-05-haunt'.includes(only)) {
  await pg.goto(BASE + '?fresh=1'); await pg.evaluate(() => localStorage.setItem('bs.world', 'new')); await pg.goto(BASE); await pg.waitForTimeout(600);
  const r = await pg.locator('#stage').boundingBox(), at = (x, y) => [r.x + x / 1280 * r.width, r.y + y / 720 * r.height];
  await pg.keyboard.press('h'); await pg.waitForFunction(() => window.__bs.getState().haunt > 0.95, null, { timeout: 40000 });
  await pg.mouse.move(...at(900, 300)); await pg.waitForTimeout(500);
  await pg.mouse.move(...at(560, 330), { steps: 12 });
  await pg.waitForFunction(() => window.__bs.getState().anomaly === 1, null, { timeout: 5000 }); await pg.waitForTimeout(450);
  const st = await pg.evaluate(() => { const s = window.__bs.getState(); return { anomaly: s.anomaly, anomK: s.anomK, castX: s.shade.castX }; }); console.log('bs-05-haunt state', JSON.stringify(st));
  await pg.screenshot({ path: 'docs/screenshots/bs-05-haunt.jpg', type: 'jpeg', quality: 86 }); console.log('bs-05-haunt');
  if (st.anomaly !== 1) { console.log('ANOMALY NOT CAPTURED'); process.exitCode = 1; }
}
copyFileSync('docs/screenshots/bs-before-world.jpg', 'docs/screenshots/bs-compare-before.jpg');
pg = await mkPage(390, 844);
for (const [n, qs] of Object.entries({ 'bs-390-first': '?t=0', 'bs-390-world': '?state=new', 'bs-390-haunt': '?state=new&haunt=1&lx=520&ly=330&anom=1' })) {
  if (only && !n.includes(only)) continue;
  await pg.goto(BASE + qs); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 86, fullPage: true }); console.log(n);
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
