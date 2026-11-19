// Deterministic V7 screenshots into docs/screenshots/v7-*.jpg (1280x900). Server on :8000 from repo root first.
import { launch } from './pw-v7.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v7/index.html';
const shots = { 'v7-01-old': '?t=0', 'v7-02-write': '?w=0.8', 'v7-03-rewrite': '?t=0.5', 'v7-03b-rewrite-early': '?t=0.3', 'v7-03c-rewrite-late': '?t=0.7', 'v7-04-new': '?state=new', 'v7-05-haunt': '?state=new&haunt=0.85', 'v7-05b-haunt-stitch': '?state=new&haunt=0.4', 'v7-06-compare': '?state=new&compare=1', 'v7-07-reduced': '?t=0.5&reduced=1' };
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
