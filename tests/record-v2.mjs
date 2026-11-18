// Records the V2 flow to docs/video/v2-flow.webm. Server on :8000 first. Env: CHROME, BASE
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/inner_container/opt/playwright';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v2/index.html';
const tmp = 'docs/video/.tmp2'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage();
await pg.goto(BASE); await pg.waitForTimeout(3500);                 // old city, camera drifting
await pg.keyboard.down('Space'); await pg.waitForTimeout(1900);    // pen down
await pg.keyboard.up('Space'); await pg.waitForTimeout(10000);     // rewriting
await pg.waitForTimeout(3000);                                      // new world
await pg.keyboard.down('c'); await pg.waitForTimeout(1500); await pg.keyboard.up('c'); await pg.waitForTimeout(1500); // compare
await pg.waitForTimeout(6500);                                      // haunting
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v2-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB');
