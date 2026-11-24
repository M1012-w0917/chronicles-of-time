// Records one uninterrupted real keyboard/pointer session at 1920x1080 to docs/video/v3-round5-flow.webm. Server on :8000 first. Env: CHROME, BASE
// Order: early release cancels, full hold, rewrite, dwell, haunt, hold C compare, Z undo, a second full rewrite, dwell, and a held ending on the haunt state.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/inner_container/opt/playwright';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v3/index.html?fresh=1';
const tmp = 'docs/video/.tmp5'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } } });
const pg = await ctx.newPage();
const until = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
const st = (s) => until(`window.__slice.getState().state === '${s}'`);
await pg.goto(BASE); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(3500); // the old painting rests on a folded page
await pg.mouse.move(700, 500); await pg.mouse.move(1200, 520, { steps: 30 }); await pg.waitForTimeout(1500);
await pg.keyboard.down('Space'); await pg.waitForTimeout(600); await pg.keyboard.up('Space'); await pg.waitForTimeout(2000); // early release cancels
await pg.keyboard.down('Space'); await st('REWRITING'); await pg.keyboard.up('Space'); // full hold
await st('NEW');
await pg.mouse.move(400, 500, { steps: 30 }); await pg.mouse.move(1500, 500, { steps: 60 }); await pg.waitForTimeout(1500); // dwell in the new world
await until(() => window.__slice.getState().haunt > 0.97); await pg.waitForTimeout(3000); // haunt
await pg.keyboard.down('c'); await until(() => window.__slice.getState().c === 1); await pg.waitForTimeout(2500); await pg.keyboard.up('c'); await pg.waitForTimeout(2000); // compare
await pg.keyboard.press('z'); await st('OLD'); await pg.waitForTimeout(2500); // undo
await pg.keyboard.down('Space'); await st('REWRITING'); await pg.keyboard.up('Space'); // second rewrite after undo
await st('NEW'); await pg.mouse.move(600, 520, { steps: 40 }); await pg.waitForTimeout(1500);
await until(() => window.__slice.getState().haunt > 0.97); await pg.waitForTimeout(9000); // ending: hold the haunt state so the sentence, the cut gate and the seal are readable
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v3-round5-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB');
