// Captures BEFORE shots from the old tree (2be68e1) for the same-composition before/after pair.
// Usage: git archive 2be68e1 rewrite-book-shadow | tar -x -C <dir>; serve <dir> on :8001; node tests/shoot-before-bs.mjs
import { launch } from './pw-bs.mjs';
const BASE = process.env.OLD_BASE || 'http://localhost:8001/rewrite-book-shadow/index.html';
const shots = { first: '?t=0', 'first-lit': '?t=0&lit=1', world: '?state=new', haunt: '?state=new&haunt=1&lx=520&ly=330' };
const b = await launch();
for (const [vw, vh, tag] of [[1600, 900, ''], [390, 844, '390-']]) {
  const pg = await (await b.newContext({ viewport: { width: vw, height: vh } })).newPage();
  for (const [n, qs] of Object.entries(shots)) { await pg.goto(BASE + qs); await pg.waitForTimeout(1200); await pg.screenshot({ path: `docs/screenshots/bs-before-${tag}${n}.jpg`, type: 'jpeg', quality: 82 }); console.log('bs-before-' + tag + n); }
}
await b.close();
