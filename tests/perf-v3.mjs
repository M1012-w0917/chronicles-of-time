// V3 frame-time probe for the rewrite phase (app frame() callback time while state is REWRITING). Server on :8000 first.
// Usage: node tests/perf-v3.mjs <tag>. The fibres A/B in docs/test-logs/perf-fibres.log was made by temporarily replacing the bleed() call in paint.js drawStamps with `if (false)`.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const tag = process.argv[2];
for (let i = 0; i < 2; i++) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__cb = []; window.requestAnimationFrame = (f) => raf((t) => { const s = performance.now(); f(t); const st = window.__slice && window.__slice.getState(); if (f.name === 'frame' && st && st.state === 'REWRITING') window.__cb.push(performance.now() - s); }); });
  const pg = await ctx.newPage(); await pg.goto('http://localhost:8000/rewrite-v3/index.html?fresh=1');
  await pg.waitForFunction(() => window.__slice && window.__slice.getState().totalStamps > 0, null, { timeout: 30000 });
  await pg.evaluate(() => localStorage.clear()); await pg.keyboard.down('Space');
  await pg.waitForFunction(() => window.__slice.getState().state === 'REWRITING'); await pg.keyboard.up('Space');
  await pg.waitForFunction(() => window.__slice.getState().state === 'NEW', null, { timeout: 60000 });
  const cb = (await pg.evaluate(() => window.__cb)).sort((a, c) => a - c);
  const mean = cb.reduce((s, v) => s + v, 0) / cb.length, p = (q) => cb[Math.floor(q * (cb.length - 1))];
  console.log(tag, 'run' + i, 'frames', cb.length, 'mean_ms', mean.toFixed(2), 'p50', p(0.5).toFixed(2), 'p95', p(0.95).toFixed(2), 'max', cb[cb.length - 1].toFixed(2));
  if (i === 0 && tag === 'fibres') for (const [w, h] of [[1600, 900], [800, 700]]) {
    await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(1500);
    console.log('layout', w + 'x' + h, JSON.stringify(await pg.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom].map(Math.round); }; return { label: r('#bookLabel'), span: r('#bookLabel span'), slip: r('#slip'), dock: r('#dock'), status: r('#status') }; })));
  }
  await ctx.close();
}
await b.close();
