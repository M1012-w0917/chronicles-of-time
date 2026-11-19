// Records the V5 flow to docs/video/v5-flow.webm (about 28 s, real run). Server on :8000 first. Env: CHROME, BASE
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/inner_container/opt/playwright';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v5/index.html?fresh=1';
const tmp = 'docs/video/.tmp5'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage();
const t0 = Date.now();
await pg.goto(BASE); await pg.waitForTimeout(1500);
await pg.keyboard.down('Space'); await pg.waitForTimeout(500); await pg.keyboard.up('Space'); await pg.waitForTimeout(600); // a cancelled pen-down
await pg.keyboard.down('Space'); await pg.waitForTimeout(1500); await pg.keyboard.up('Space');
await pg.waitForFunction(() => window.__slice.getState().state === 'NEW', null, { timeout: 90000 });
await pg.waitForTimeout(600); await pg.keyboard.down('c'); await pg.waitForTimeout(1400); await pg.keyboard.up('c');
await pg.waitForFunction(() => window.__slice.getState().haunt > 0.75, null, { timeout: 60000 }); await pg.waitForTimeout(800);
await pg.keyboard.press('z'); await pg.waitForFunction(() => window.__slice.getState().state === 'OLD', null, { timeout: 30000 }); await pg.waitForTimeout(600);
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v5-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s wall');
