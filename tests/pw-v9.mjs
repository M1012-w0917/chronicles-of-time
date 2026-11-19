// Shared launcher for the V9 test scripts. Resolves playwright-core and a Chromium binary without assuming one sandbox layout.
// playwright-core: env PLAYWRIGHT_CORE (package dir), else global npm root (playwright-core or @playwright/mcp's copy), else local node_modules.
// browser: env CHROME (executable), else the first chrome-headless-shell / chrome found under PLAYWRIGHT_BROWSERS_PATH, ~/.cache/ms-playwright, /inner_container/opt/playwright.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs'; import { homedir } from 'node:os'; import { join } from 'node:path';

function findCore() {
  const tried = [];
  const attempt = (label, fn) => { try { return fn(); } catch (e) { tried.push(label); return null; } };
  const cands = [
    () => process.env.PLAYWRIGHT_CORE && createRequire(import.meta.url)(process.env.PLAYWRIGHT_CORE),
    () => createRequire(join(process.cwd(), 'noop.js'))('playwright-core'),
    () => { const r = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); const rq = createRequire(join(r, 'noop.js')); try { return rq('playwright-core'); } catch (e) { return rq(join(r, '@playwright/mcp/node_modules/playwright-core')); } },
  ];
  for (const [i, c] of cands.entries()) { const m = attempt(['PLAYWRIGHT_CORE', 'local node_modules', 'global npm root'][i], c); if (m && m.chromium) return m; }
  throw new Error('playwright-core not found (tried ' + tried.join(', ') + '). Set PLAYWRIGHT_CORE to the playwright-core package directory.');
}

function walk(dir, depth, hit) {
  if (depth < 0 || !existsSync(dir)) return null;
  let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  for (const e of ents) { const p = join(dir, e.name); if (e.isFile() && hit(e.name)) return p; }
  for (const e of ents) { if (e.isDirectory()) { const r = walk(join(dir, e.name), depth - 1, hit); if (r) return r; } }
  return null;
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache/ms-playwright'), '/inner_container/opt/playwright'].filter(Boolean);
  for (const names of [['chrome-headless-shell'], ['chrome']]) for (const r of roots) { const p = walk(r, 4, (n) => names.includes(n)); if (p) return p; }
  throw new Error('No Chromium found. Set CHROME to an executable, or PLAYWRIGHT_BROWSERS_PATH to a Playwright browser cache.');
}

// Video recording needs Playwright's ffmpeg: point PLAYWRIGHT_BROWSERS_PATH at the first cache that has one.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  for (const r of [join(homedir(), '.cache/ms-playwright'), '/inner_container/opt/playwright']) {
    try { if (readdirSync(r).some((n) => n.startsWith('ffmpeg'))) { process.env.PLAYWRIGHT_BROWSERS_PATH = r; break; } } catch (e) { /* not there */ }
  }
}
export const { chromium } = findCore();
export const exe = findChrome();
export const launch = () => chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });

// Smoke run: `node tests/pw-v9.mjs` launches headless Chromium on a data: page and exits 0 on success.
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const b = await launch();
  const p = await b.newPage();
  await p.goto('data:text/html,<title>v9</title><h1 id=a>orrery</h1>');
  const r = await p.evaluate(() => document.getElementById('a').textContent + ' | ' + document.title);
  console.log('smoke ok:', r, '| chrome:', exe);
  await b.close();
  if (r !== 'orrery | v9') { console.error('unexpected result'); process.exit(1); }
}
