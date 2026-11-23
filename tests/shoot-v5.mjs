// Deterministic V5 screenshots into docs/screenshots/v5-*.jpg. Server on :8000 from repo root first.
// Before/after pair: set BEFORE to a server of the previous commit (e.g. `git archive 65a5581 | tar -x -C <tmp>` served on :8001,
// BEFORE=http://localhost:8001/rewrite-v5/index.html). Same viewport, same state, same camera. Without BEFORE the pair is skipped.
// All shots force the stroke-glyph surtitle (?cjk=strokes) so the Chinese is readable on systems without a CJK font.
import { launch } from './pw-v5.mjs';
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v5/index.html';
const BEFORE = process.env.BEFORE || '';
const PAIR = '?state=new&haunt=1';
const shots = {
  'v5-01-initial': '?t=0', 'v5-02-penDown': '?w=0.8', 'v5-03-reconstructing': '?t=0.5', 'v5-04-new': '?state=new', 'v5-05-haunt': '?state=new&haunt=1',
  'v5-06-compare': '?state=new&compare=1', 'v5-07-reduced-mid': '?t=0.3&reduced=1',
};
const only = process.argv[2];
const b = await launch();
const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
async function shot(url, path) { await pg.goto(url); await pg.waitForTimeout(1200); await pg.screenshot({ path, type: 'jpeg', quality: 80 }); }
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  await shot(BASE + qs + '&cjk=strokes', `docs/screenshots/${n}.jpg`); console.log(n, qs + '&cjk=strokes');
}
if (BEFORE && (!only || 'v5-08 v5-09 v5-10'.includes(only))) {
  await shot(BEFORE + PAIR, 'docs/screenshots/v5-08-before.jpg'); console.log('v5-08-before', BEFORE + PAIR);
  await shot(BASE + PAIR + '&cjk=strokes', 'docs/screenshots/v5-09-after.jpg'); console.log('v5-09-after', BASE + PAIR + '&cjk=strokes');
  // side by side, composed in a blank page from the two files
  const uri = (p) => 'data:image/jpeg;base64,' + readFileSync(p).toString('base64');
  const sb = await b.newPage({ viewport: { width: 1600, height: 500 } });
  await sb.setContent('<body style="margin:0;background:#140903"><canvas id="c" width="1600" height="500"></canvas></body>');
  await sb.evaluate(async ([a, c, la, lc]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [ia, ic] = await Promise.all([load(a), load(c)]); const g = document.getElementById('c').getContext('2d');
    g.drawImage(ia, 0, 0, 1600, 900, 0, 50, 796, 448); g.drawImage(ic, 0, 0, 1600, 900, 804, 50, 796, 448);
    g.fillStyle = '#f0d8a0'; g.font = '22px Georgia, serif'; g.textBaseline = 'middle'; g.fillText(la, 16, 25); g.fillText(lc, 820, 25);
  }, [uri('docs/screenshots/v5-08-before.jpg'), uri('docs/screenshots/v5-09-after.jpg'), 'Before: commit 65a5581, ' + PAIR, 'After: this round, ' + PAIR]);
  await sb.screenshot({ path: 'docs/screenshots/v5-10-before-after.jpg', type: 'jpeg', quality: 82 }); console.log('v5-10-before-after'); await sb.close();
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
