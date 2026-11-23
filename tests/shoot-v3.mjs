// V3 screenshots. Server on :8000 first. Writes docs/screenshots/v3-*.jpg (deterministic, old set) and
// v3d-*.jpg (real keyboard session, stages in order) plus v3d-before-after.jpg (same composition side by side).
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v3/index.html';
const OPT = { type: 'jpeg', quality: 78 };
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const pg = await ctx.newPage();
const S = () => pg.evaluate(() => window.__slice.getState());
const shot = async (n) => { await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, ...OPT }); console.log('shot', n, JSON.stringify(await pg.evaluate(() => { const s = window.__slice.getState(); return { state: s.state, t: +s.t.toFixed(2), w: +s.w.toFixed(2), c: s.c, haunt: +s.haunt.toFixed(2), figurePos: s.figurePos, vanished: s.vanished }; }))); };
const until = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });

// Old deterministic set (kept)
const shots = { 'v3-01-initial': '?t=0', 'v3-02-penDown': '?w=0.6', 'v3-03-mid': '?t=0.42', 'v3-04-new': '?state=new', 'v3-05-haunt': '?state=new&haunt=1', 'v3-06-reduced': '?reduced=1&state=new&haunt=1' };
for (const [n, qs] of Object.entries(shots)) { await pg.goto(BASE + qs); await pg.waitForTimeout(1500); await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, ...OPT }); console.log(n); }

// Same-composition before/after (identical viewport, same frame, no pointer so parallax is at rest)
await pg.goto(BASE + '?t=0'); await pg.waitForTimeout(1500); const before = (await pg.screenshot(OPT)).toString('base64');
await pg.goto(BASE + '?state=new'); await pg.waitForTimeout(1500); const after = (await pg.screenshot(OPT)).toString('base64');
const joined = await pg.evaluate(async ([a, c]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + s; });
  const [ia, ic] = await Promise.all([load(a), load(c)]);
  const cv = document.createElement('canvas'); cv.width = 3200; cv.height = 900; const x = cv.getContext('2d');
  x.drawImage(ia, 0, 0); x.drawImage(ic, 1600, 0); x.fillStyle = '#fff'; x.fillRect(1598, 0, 4, 900);
  return cv.toDataURL('image/jpeg', 0.8).split(',')[1];
}, [before, after]);
(await import('node:fs')).writeFileSync('docs/screenshots/v3d-before-after.jpg', Buffer.from(joined, 'base64')); console.log('v3d-before-after');

// Real session: fresh storage, keyboard only
await pg.goto(BASE + '?fresh=1'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
await pg.waitForFunction(() => window.__slice && window.__slice.getState().totalStamps > 0); await pg.waitForTimeout(1500);
await shot('v3d-01-before');
await pg.keyboard.down('Space'); await pg.waitForTimeout(500); await shot('v3d-02-hold');
await pg.keyboard.up('Space'); await pg.waitForTimeout(300);
await pg.keyboard.down('Space'); await until(() => window.__slice.getState().state === 'REWRITING'); await pg.keyboard.up('Space');
await until(() => window.__slice.getState().t > 0.45); await shot('v3d-03-rebuild');
await until(() => window.__slice.getState().state === 'NEW'); await pg.mouse.move(800, 450); await pg.waitForTimeout(2500); await shot('v3d-04-new-dwell');
await until(() => window.__slice.getState().haunt > 0.97); await pg.waitForTimeout(800); await shot('v3d-05-haunt');
await pg.keyboard.down('c'); await until(() => window.__slice.getState().c === 1); await pg.waitForTimeout(500); await shot('v3d-06-compare'); await pg.keyboard.up('c');
await until(() => window.__slice.getState().c === 0);
await pg.keyboard.press('z'); await until(() => window.__slice.getState().state === 'OLD'); await pg.waitForTimeout(800); await shot('v3d-07-undo');
await b.close();
