// Deterministic V2 screenshots into docs/screenshots/v2-*.jpg. Server on :8000 first.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v2/index.html';
const shots = { 'v2-01-initial': '?t=0', 'v2-02-penDown': '?w=0.55', 'v2-03-mid': '?t=0.45', 'v2-04-new': '?state=new', 'v2-05-haunt': '?state=new&haunt=1', 'v2-06-reduced': '?reduced=1&state=new&haunt=1' };
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
for (const [n, qs] of Object.entries(shots)) {
  await pg.goto(BASE + qs); await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, type: 'jpeg', quality: 78 }); console.log(n);
}
await b.close();
