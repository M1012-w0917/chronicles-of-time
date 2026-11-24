// Records one uninterrupted 1920x1080 run driven only by real mouse and keyboard input (a single goto at the start, no setProgress).
// Writes docs/video/bs-flow.webm. Server on :8000 first. Env: CHROME, BASE
import { launch } from './pw-bs.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-book-shadow/index.html?fresh=1';
const tmp = 'docs/video/.tmpbs'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } } });
const pg = await ctx.newPage(); const t0 = Date.now(); const log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', m);
const wait = (fn, to = 60000) => pg.waitForFunction(fn, null, { timeout: to });
await pg.goto(BASE); await pg.waitForTimeout(2500); log('first screen');
const sb = await pg.locator('#stage').boundingBox(), at = (x, y) => [sb.x + x / 1280 * sb.width, sb.y + y / 720 * sb.height];
const fb = await pg.locator('#fact').boundingBox(), fx = fb.x + fb.width / 2, fy = fb.y + fb.height / 2;
await pg.mouse.move(...at(560, 260), { steps: 25 }); await pg.waitForTimeout(700);
await pg.mouse.move(fx, fy, { steps: 15 }); await pg.mouse.down(); await pg.waitForTimeout(500); await pg.mouse.up(); await pg.waitForTimeout(1300); log('cancelled hold');
await pg.mouse.down(); await pg.waitForTimeout(1500); await pg.mouse.up(); log('full hold');
await pg.mouse.move(...at(700, 300), { steps: 40 }); await pg.mouse.move(...at(900, 330), { steps: 40 }); await pg.mouse.move(...at(600, 280), { steps: 40 });
await wait(() => window.__bs.getState().state === 'NEW'); log('new world'); await pg.waitForTimeout(3500);
await pg.keyboard.down('c'); await pg.waitForTimeout(2000); await pg.keyboard.up('c'); await pg.waitForTimeout(1500); log('compare');
await pg.keyboard.press('h'); await wait(() => window.__bs.getState().haunt > 0.95); await pg.waitForTimeout(1200); log('haunt');
await pg.mouse.move(...at(900, 330), { steps: 30 }); await pg.waitForTimeout(800);
await pg.mouse.move(...at(520, 330), { steps: 30 }); await wait(() => window.__bs.getState().anomaly >= 1, 8000); log('anomaly'); await pg.waitForTimeout(2600);
await pg.mouse.move(...at(900, 300), { steps: 30 }); await pg.waitForTimeout(1200); await pg.mouse.move(...at(480, 330), { steps: 30 }); await pg.waitForTimeout(1200); log('normal rule again');
await pg.click('#turnBtn'); await wait(() => window.__bs.getState().turns === 1, 10000); await pg.waitForTimeout(1500); log('page turn');
await pg.keyboard.press('z'); await wait(() => window.__bs.getState().state === 'OLD', 30000); await pg.waitForTimeout(3500); log('reverted, rest on first screen');
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/bs-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s wall');
