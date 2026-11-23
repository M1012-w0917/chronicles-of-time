// Records a real keyboard run of V5 to docs/video/v5-flow.webm (about 35 s). Server on :8000 first. Env: CHROME, BASE
// Order: before the rewrite, a pen-down released early (cancel), a full hold, the continuous rebuild, the new-world dwell,
// the haunt, hold C to compare, release, Z to revert. ?cjk=strokes keeps the surtitle Chinese readable without a CJK font.
import { launch } from './pw-v5.mjs';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v5/index.html?fresh=1&cjk=strokes';
const tmp = 'docs/video/.tmp5'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: tmp, size: { width: 1280, height: 720 } } });
const pg = await ctx.newPage();
const t0 = Date.now(); const mark = (s) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5) + ' s', s, JSON.stringify(Object.values(pg.__last || {})));
const st = async () => (pg.__last = await pg.evaluate(() => { const s = window.__slice.getState(); return { state: s.state, t: +s.t.toFixed(2), sur: s.sur.zh }; }));
await pg.goto(BASE); await pg.waitForTimeout(2200); await st(); mark('before the rewrite');
await pg.keyboard.down('Space'); await pg.waitForTimeout(550); await st(); mark('pen down (Space held)'); await pg.keyboard.up('Space'); await pg.waitForTimeout(120); await st(); mark('released early: cancelled');
await pg.waitForTimeout(1000);
await pg.keyboard.down('Space'); await pg.waitForTimeout(1500); await pg.keyboard.up('Space'); await st(); mark('held 1.5 s: rewrite starts');
await pg.waitForFunction(() => window.__slice.getState().t > 0.5, null, { timeout: 30000 }); await st(); mark('rebuilding');
await pg.waitForFunction(() => window.__slice.getState().state === 'NEW', null, { timeout: 90000 }); await st(); mark('new world, dwell');
await pg.waitForFunction(() => window.__slice.getState().haunt > 0.7, null, { timeout: 60000 }); await st(); mark('haunt');
await pg.waitForTimeout(1500);
await pg.keyboard.down('c'); await pg.waitForTimeout(1600); await st(); mark('C held: compare'); await pg.keyboard.up('c'); await pg.waitForTimeout(1200);
await pg.keyboard.press('z'); await pg.waitForTimeout(200); await st(); mark('Z: revert');
await pg.waitForFunction(() => window.__slice.getState().state === 'OLD', null, { timeout: 30000 }); await pg.waitForTimeout(1200); await st(); mark('back in the old world');
const v = pg.video(); await ctx.close(); await b.close();
const out = 'docs/video/v5-flow.webm'; renameSync(await v.path(), out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB', ((Date.now() - t0) / 1000).toFixed(1) + ' s wall');
