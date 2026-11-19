// Records the V6 flow to docs/video/v6-flow.webm (about 25 s, real run). Server on :8000 first. Env: CHROME, BASE
import { launch } from './pw-v6.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v6/index.html?fresh=1';
const tmp = 'docs/video/.tmp6'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage();
const t0 = Date.now();
const wait = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
await pg.goto(BASE); await pg.waitForTimeout(1200);
await pg.keyboard.down('Space'); await pg.waitForTimeout(500); await pg.keyboard.up('Space'); await pg.waitForTimeout(500); // a cancelled pen-down
await pg.keyboard.down('Space'); await pg.waitForTimeout(1500); await pg.keyboard.up('Space');
await wait(() => window.__slice.getState().state === 'NEW');
await pg.waitForTimeout(400); await pg.keyboard.down('c'); await pg.waitForTimeout(1200); await pg.keyboard.up('c');
await wait(() => window.__slice.getState().name > 0.9); await pg.waitForTimeout(700);
await pg.keyboard.press('z'); await wait(() => window.__slice.getState().state === 'OLD', 30000); await pg.waitForTimeout(500);
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v6-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s wall');
