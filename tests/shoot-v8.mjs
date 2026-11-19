// Deterministic V8 screenshots into docs/screenshots/v8-*.jpg (1280x900). Server on :8000 from repo root first.
// Every still waits for body[data-ready=true] (end of the roughly 1 s precompute) and two frames.
import { launch } from './pw-v8.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v8/index.html';
const shots = {
  'v8-00-blind': '?t=0&blind=1', 'v8-01-old': '?t=0', 'v8-02-write': '?w=0.8', 'v8-03a-rewrite-early': '?t=0.25', 'v8-03b-rewrite-mid': '?t=0.5', 'v8-03c-rewrite-late': '?t=0.75',
  'v8-04-new': '?state=new', 'v8-05-haunt': '?state=new&haunt=0.9', 'v8-05b-haunt-late': '?state=new&haunt=0.97', 'v8-06-compare': '?state=new&compare=1', 'v8-07-reduced': '?t=0.5&reduced=1',
};
const only = process.argv[2];
const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  await pg.goto(BASE + qs); await pg.waitForSelector('body[data-ready=true]', { timeout: 30000 }); await pg.waitForFunction(() => window.__slice.getState().frame > 3);
  if (qs.includes('blind=1')) await pg.addStyleTag({ content: '#deskrow, #cmpTag, #loading { visibility: hidden !important; } body { background: #0a0504 !important; }' });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 82 }); console.log(n);
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
