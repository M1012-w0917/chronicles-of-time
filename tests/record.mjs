// Records the full V1 flow to docs/video/v1-flow.webm. Server on :8000 from repo root first.
// Needs ffmpeg: PLAYWRIGHT_BROWSERS_PATH is set below to the sandbox install if unset.
//   node tests/record.mjs      Env: CHROME, BASE
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/inner_container/opt/playwright';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite/';
const tmp = 'docs/video/.tmp'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage();
await pg.goto(BASE); await pg.waitForTimeout(3000);               // old city
await pg.keyboard.down('Space'); await pg.waitForTimeout(1800);   // pen down
await pg.keyboard.up('Space'); await pg.waitForTimeout(9000);     // rewriting
await pg.mouse.move(300, 300); await pg.waitForTimeout(6000);     // new city
await pg.mouse.move(900, 350); await pg.waitForTimeout(6000);     // haunting figure gazes
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v1-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB');
