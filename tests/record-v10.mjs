// Records the V10 flow to docs/video/v10-flow.webm (real run, 20 to 30 s). Server on :8000 first. Env: CHROME, BASE
import { launch } from './pw-v10.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v10/index.html?fresh=1';
const tmp = 'docs/video/.tmp10'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: tmp, size: { width: 1280, height: 900 } } });
const pg = await ctx.newPage(); const t0 = Date.now();
const wait = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
await pg.goto(BASE); await pg.waitForSelector('body[data-ready=true]'); await pg.waitForTimeout(200);
await pg.keyboard.down('Space'); await pg.waitForTimeout(450); await pg.keyboard.up('Space'); await pg.waitForTimeout(450); // a cancelled pen-down
await pg.keyboard.down('Space'); await pg.waitForTimeout(1400); await pg.keyboard.up('Space');
await wait(() => window.__slice.getState().keep >= window.__slice.getState().frames.fNew);
await pg.keyboard.down('c'); await pg.waitForTimeout(1200); await pg.keyboard.up("c");
await wait(() => window.__slice.getState().state === 'HAUNT' && window.__slice.getState().pf > window.__slice.getState().frames.handF + 8, 30000);
await pg.keyboard.press('z'); await pg.waitForTimeout(600);
const wall = (Date.now() - t0) / 1000;
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v10-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', wall.toFixed(1) + ' s wall');
