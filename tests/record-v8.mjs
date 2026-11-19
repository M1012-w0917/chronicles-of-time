// Records the V8 flow to docs/video/v8-flow.webm (real run, about 20 to 30 s). Server on :8000 first. Env: CHROME, BASE
import { launch } from './pw-v8.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v8/index.html?fresh=1';
const tmp = 'docs/video/.tmp8'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: tmp, size: { width: 1280, height: 900 } } });
const pg = await ctx.newPage(); const t0 = Date.now();
const wait = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
await pg.goto(BASE); await pg.waitForSelector('body[data-ready=true]'); await pg.waitForTimeout(1000);
await pg.keyboard.down('Space'); await pg.waitForTimeout(500); await pg.keyboard.up('Space'); await pg.waitForTimeout(500); // a cancelled pen-down
await pg.keyboard.down('Space'); await pg.waitForTimeout(1500); await pg.keyboard.up('Space');
await wait(() => window.__slice.getState().state === 'NEW');
await pg.keyboard.down('c'); await pg.waitForTimeout(900); await pg.keyboard.up('c'); await pg.waitForTimeout(300);
await wait(() => window.__slice.getState().handPos && window.__slice.getState().haunt > 0.4, 30000); await pg.waitForTimeout(500);
await pg.keyboard.press('z'); await wait(() => window.__slice.getState().state === 'OLD', 30000); await pg.waitForTimeout(500);
const wall = (Date.now() - t0) / 1000;
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v8-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', wall.toFixed(1) + ' s wall');
