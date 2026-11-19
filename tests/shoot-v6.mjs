// Deterministic V6 screenshots into docs/screenshots/v6-*.jpg (1280x900). Server on :8000 from repo root first.
import { launch } from './pw-v6.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v6/index.html';
const shots = { 'v6-01-old': '?t=0', 'v6-02-penDown': '?w=0.8', 'v6-03-reconstruct': '?t=0.5', 'v6-04-new': '?state=new', 'v6-05-haunt': '?state=new&haunt=1', 'v6-06-compare': '?state=new&compare=1', 'v6-07-reduced': '?t=0.5&reduced=1' };
const only = process.argv[2];
const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  await pg.goto(BASE + qs); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 82 }); console.log(n);
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
