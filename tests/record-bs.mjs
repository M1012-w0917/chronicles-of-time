// Records a real pointer/keyboard run to docs/video/bs-flow.webm. Server on :8000 first. Env: CHROME, BASE
import { launch } from './pw-bs.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-book-shadow/index.html?fresh=1';
const tmp = 'docs/video/.tmpbs'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage(); const t0 = Date.now();
const st = () => pg.evaluate(() => window.__bs.getState());
await pg.goto(BASE); await pg.waitForTimeout(1800);
const bx = await pg.locator('#fact').boundingBox(), x = bx.x + bx.width / 2, y = bx.y + bx.height / 2;
await pg.mouse.move(x - 150, y - 200, { steps: 15 }); await pg.waitForTimeout(500);
await pg.mouse.move(x, y, { steps: 10 }); await pg.mouse.down(); await pg.waitForTimeout(500); await pg.mouse.up(); await pg.waitForTimeout(900); // cancelled pen-down
await pg.mouse.down(); await pg.waitForTimeout(1500); await pg.mouse.up(); // full pen-down
await pg.mouse.move(x + 100, y - 200, { steps: 40 });
await pg.waitForFunction(() => window.__bs.getState().state === 'NEW', null, { timeout: 60000 }); await pg.waitForTimeout(1800);
await pg.keyboard.down('c'); await pg.waitForTimeout(1500); await pg.keyboard.up('c'); await pg.waitForTimeout(900);
await pg.waitForFunction(() => window.__bs.getState().haunt > 0.95, null, { timeout: 60000 });
await pg.mouse.move(x + 380, y - 220, { steps: 30 }); await pg.waitForTimeout(900); await pg.mouse.move(x - 480, y - 220, { steps: 40 }); await pg.waitForTimeout(1200);
await pg.click('#turnBtn'); await pg.waitForFunction(() => window.__bs.getState().turns === 1, null, { timeout: 10000 }); await pg.waitForTimeout(900);
await pg.keyboard.press('z'); await pg.waitForFunction(() => window.__bs.getState().state === 'OLD', null, { timeout: 30000 }); await pg.waitForTimeout(1200);
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/bs-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s wall');
