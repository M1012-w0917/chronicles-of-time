// V3 round 5 screenshots at 1920x1080 (one viewport for every frame). Server on :8000 first.
// Writes docs/screenshots/v3e-01-before .. v3e-07-undo (real keyboard session), v3e-before-after (same composition, old | new),
// v3e-old-vs-new-first / -end (previous round recording frame | this round). Older v3-* and v3d-* images are kept untouched.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { readFileSync, writeFileSync } from 'node:fs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v3/index.html';
const OPT = { type: 'jpeg', quality: 86 };
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const pg = await ctx.newPage();
const until = (fn, ms = 90000) => pg.waitForFunction(fn, null, { timeout: ms });
const shot = async (n) => { await pg.screenshot({ path: `docs/screenshots/${n}.jpg`, ...OPT }); console.log('shot', n, JSON.stringify(await pg.evaluate(() => { const s = window.__slice.getState(); return { state: s.state, t: +s.t.toFixed(2), w: +s.w.toFixed(2), c: s.c, haunt: +s.haunt.toFixed(2), pathCut: +s.pathCut.toFixed(2), vp: [innerWidth, innerHeight] }; }))); };
const join = async (files, out, w, h) => { // side by side, each scaled to w x h
  const data = files.map((f) => readFileSync(f).toString('base64'));
  const j = await pg.evaluate(async ([d, w, h]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/jpeg;base64,' + s; });
    const im = await Promise.all(d.map(load)); const cv = document.createElement('canvas'); cv.width = w * im.length + 4 * (im.length - 1); cv.height = h; const x = cv.getContext('2d');
    im.forEach((i, k) => x.drawImage(i, k * (w + 4), 0, w, h)); x.fillStyle = '#fff'; for (let k = 1; k < im.length; k++) x.fillRect(k * (w + 4) - 4, 0, 4, h);
    return cv.toDataURL('image/jpeg', 0.88).split(',')[1];
  }, [data, w, h]);
  writeFileSync(out, Buffer.from(j, 'base64')); console.log(out);
};

// same composition, no pointer: parallax at rest
await pg.goto(BASE + '?t=0'); await pg.waitForTimeout(1800); await pg.screenshot({ path: 'docs/screenshots/.tmp-old.jpg', ...OPT });
await pg.goto(BASE + '?state=new'); await pg.waitForTimeout(1800); await pg.screenshot({ path: 'docs/screenshots/.tmp-new.jpg', ...OPT });
await join(['docs/screenshots/.tmp-old.jpg', 'docs/screenshots/.tmp-new.jpg'], 'docs/screenshots/v3e-before-after.jpg', 1920, 1080);

// real session, keyboard only, fresh storage
await pg.goto(BASE + '?fresh=1'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
await pg.waitForFunction(() => window.__slice && window.__slice.getState().totalStamps > 0); await pg.waitForTimeout(1800);
await shot('v3e-01-before');
await pg.keyboard.down('Space'); await pg.waitForTimeout(900); await shot('v3e-02-pen-down');
await pg.keyboard.up('Space'); await pg.waitForTimeout(500);
await pg.keyboard.down('Space'); await until(() => window.__slice.getState().state === 'REWRITING'); await pg.keyboard.up('Space');
await until(() => window.__slice.getState().t > 0.42); await shot('v3e-03-rebuild');
await until(() => window.__slice.getState().state === 'NEW'); await pg.mouse.move(960, 540); await pg.waitForTimeout(2500); await shot('v3e-04-new-dwell');
await until(() => window.__slice.getState().haunt > 0.97); await pg.mouse.move(960, 300); await pg.waitForTimeout(1400); await shot('v3e-05-haunt'); // pointer and brush kept clear of the margin note
await pg.keyboard.down('c'); await until(() => window.__slice.getState().c === 1); await pg.waitForTimeout(500); await shot('v3e-06-compare'); await pg.keyboard.up('c');
await until(() => window.__slice.getState().c === 0);
await pg.keyboard.press('z'); await until(() => window.__slice.getState().state === 'OLD'); await pg.waitForTimeout(800); await shot('v3e-07-undo');

// old recording frame | this round, first screen and ending
await join(['docs/screenshots/old-v3-deep-first.jpg', 'docs/screenshots/v3e-01-before.jpg'], 'docs/screenshots/v3e-old-vs-new-first.jpg', 1280, 720);
await join(['docs/screenshots/old-v3-deep-end.jpg', 'docs/screenshots/v3e-05-haunt.jpg'], 'docs/screenshots/v3e-old-vs-new-end.jpg', 1280, 720);
await b.close();
(await import('node:fs')).rmSync('docs/screenshots/.tmp-old.jpg'); (await import('node:fs')).rmSync('docs/screenshots/.tmp-new.jpg');
