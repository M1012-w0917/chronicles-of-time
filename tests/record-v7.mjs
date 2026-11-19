// Records the V7 flow to docs/video/v7-flow.webm (real run). Server on :8000 first. Env: CHROME, BASE
import { launch } from './pw-v7.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v7/index.html?fresh=1';
const tmp = 'docs/video/.tmp7'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: tmp, size: { width: 1280, height: 900 } } });
const pg = await ctx.newPage(); const t0 = Date.now();
const wait = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
await pg.goto(BASE); await pg.waitForTimeout(1500);
await pg.keyboard.down('Space'); await pg.waitForTimeout(500); await pg.keyboard.up('Space'); await pg.waitForTimeout(500); // a cancelled pen-down
await pg.keyboard.down('Space'); await pg.waitForTimeout(1500); await pg.keyboard.up('Space');
await wait(() => window.__slice.getState().state === 'NEW');
await pg.keyboard.down('c'); await pg.waitForTimeout(1000); await pg.keyboard.up('c'); await pg.waitForTimeout(500);
await wait(() => window.__slice.getState().hand > 0.5, 30000); await pg.waitForTimeout(800);
await pg.keyboard.press('z'); await wait(() => window.__slice.getState().state === 'OLD', 30000); await pg.waitForTimeout(600);
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v7-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s wall');
