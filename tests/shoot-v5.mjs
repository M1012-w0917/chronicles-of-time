// Deterministic V5 screenshots into docs/screenshots/v5-*.jpg. Server on :8000 from repo root first.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v5/index.html';
const shots = { 'v5-01-initial': '?t=0', 'v5-02-penDown': '?w=0.8', 'v5-03-reconstructing': '?t=0.5', 'v5-04-new': '?state=new', 'v5-05-haunt': '?state=new&haunt=1', 'v5-06-compare': '?state=new&compare=1', 'v5-07-reduced-mid': '?t=0.3&reduced=1' };
const only = process.argv[2];
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
for (const [n, qs] of Object.entries(shots)) {
  if (only && !n.includes(only)) continue;
  await pg.goto(BASE + qs); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 80 }); console.log(n);
}
if (errs.length) { console.log('ERRORS', errs); process.exitCode = 1; }
await b.close();
