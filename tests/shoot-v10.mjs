// Deterministic V10 screenshots into docs/screenshots/v10-*.jpg (1280x900). Server on :8000 from repo root first.
import { launch } from './pw-v10.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v10/index.html';
const shots = {
  'v10-00-blind': '?t=0&blind=1', 'v10-01-old': '?t=0', 'v10-02-write': '?w=0.8', 'v10-03a-rewrite-early': '?t=0.3', 'v10-03b-rewrite-mid': '?t=0.5', 'v10-03c-rewrite-late': '?t=0.7',
  'v10-04-new': '?state=new', 'v10-05-haunt': '?haunt=0.33', 'v10-05b-haunt-name': '?haunt=0.55', 'v10-06-compare': '?state=new&compare=1', 'v10-07-reduced': '?t=0.5&reduced=1', 'v10-08-mobile': '?t=0.5',
};
const only = process.argv[2];
const b = await launch();
const errs = [];
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  const mobile = n.includes('mobile');
  const pg = await (await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } })).newPage();
  pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await pg.goto(BASE + qs); await pg.waitForSelector('body[data-ready=true]', { timeout: 30000 }); await pg.waitForFunction(() => window.__slice.getState().frame > 3);
  if (qs.includes('blind=1')) await pg.addStyleTag({ content: '#deskrow, #cmpTag, #loading { visibility: hidden !important; }' });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 82 }); console.log(n);
  await pg.close();
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
