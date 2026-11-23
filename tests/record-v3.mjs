// Records a real keyboard/pointer session to docs/video/v3-deep-flow.webm. Server on :8000 first. Env: CHROME, BASE
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/inner_container/opt/playwright';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v3/index.html?fresh=1';
const tmp = 'docs/video/.tmp3'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage();
const until = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
await pg.goto(BASE); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(3000);
await pg.keyboard.down('Space'); await pg.waitForTimeout(600); await pg.keyboard.up('Space'); await pg.waitForTimeout(1500); // early release cancels
await pg.keyboard.down('Space'); await until(() => window.__slice.getState().state === 'REWRITING'); await pg.keyboard.up('Space'); // full hold
await until(() => window.__slice.getState().state === 'NEW');
await pg.mouse.move(300, 300); await pg.mouse.move(1000, 400, { steps: 20 }); await pg.waitForTimeout(2000); // dwell
await until(() => window.__slice.getState().haunt > 0.95); await pg.waitForTimeout(1500); // haunt
await pg.keyboard.down('c'); await pg.waitForTimeout(2000); await pg.keyboard.up('c'); await pg.waitForTimeout(1500); // compare
await pg.keyboard.press('z'); await until(() => window.__slice.getState().state === 'OLD'); await pg.waitForTimeout(1500); // undo
await pg.click('#reduceBtn'); await pg.waitForTimeout(1000); // reduced motion toggle
await pg.keyboard.down('Space'); await until(() => window.__slice.getState().state === 'REWRITING'); await pg.keyboard.up('Space');
await until(() => window.__slice.getState().state === 'NEW'); await pg.waitForTimeout(2000);
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v3-deep-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB');
