// Deterministic Book+Shadow screenshots into docs/screenshots/bs-*.jpg. Server on :8000 from repo root first.
import { launch } from './pw-bs.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-book-shadow/index.html';
const shots = {
  'bs-01-before': '?t=0', 'bs-02-pen-down': '?w=0.85', 'bs-03-reconstructing': '?t=0.45', 'bs-04-new-world': '?state=new', 'bs-05-haunt': '?state=new&haunt=1&lx=520&ly=330',
  'bs-compare-before': '?t=0&lit=1', 'bs-compare-after': '?state=new', 'bs-reduced-mid': '?t=0.4&reduced=1',
};
const only = process.argv[2];
const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  await pg.goto(BASE + qs); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 82 }); console.log(n);
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
