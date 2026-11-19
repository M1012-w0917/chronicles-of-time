// Deterministic V3 screenshots into docs/screenshots/v3-*.jpg. Server on :8000 first.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v3/index.html';
const shots = { 'v3-01-initial': '?t=0', 'v3-02-penDown': '?w=0.6', 'v3-03-mid': '?t=0.42', 'v3-04-new': '?state=new', 'v3-05-haunt': '?state=new&haunt=1', 'v3-06-reduced': '?reduced=1&state=new&haunt=1' };
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
for (const [n, qs] of Object.entries(shots)) {
  await pg.goto(BASE + qs); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 78 }); console.log(n);
}
await b.close();
