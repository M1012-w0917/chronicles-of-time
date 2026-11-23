// Same-composition evidence shots. Usage (server on :8000): node tests/evidence-v2.mjs before|after
// Fixed viewport 1600x900 and camera yaw=-12 pitch=54 zoom=1. Output: rewrite-v2/evidence/<dir>/*.jpg
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import fs from 'node:fs';
const dir = process.argv[2]; if (!['before', 'after'].includes(dir)) { console.error('usage: node tests/evidence-v2.mjs before|after'); process.exit(2); }
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v2/index.html';
const cam = '?yaw=-12&pitch=54&zoom=1';
const shots = { '01-before-rewrite': '&t=0', '02-pen-down': '&w=0.55', '03-mid-rewrite': '&t=0.45', '04-new-world': '&state=new', '05-haunt': '&state=new&haunt=1' };
const out = `rewrite-v2/evidence/${dir}`; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
for (const [n, qs] of Object.entries(shots)) {
  await pg.goto(BASE + cam + qs); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 82 }); console.log(n);
}
await b.close();
