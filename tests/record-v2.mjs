// Records the full V2 interaction (same scenario as tests/interaction-v2.mjs) to rewrite-v2/evidence/video/v2-interaction.webm.
process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/inner_container/opt/playwright";
// Server on :8000 first. Env: CHROME, BASE. Viewport 1280x720.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { renameSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { runScenario } from './scenario-v2.mjs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v2/index.html';
const tmp = 'rewrite-v2/evidence/video/.tmp'; rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const src = await runScenario(b, BASE, { video: tmp, dwell: 1, log: console.log });
await b.close();
const out = 'rewrite-v2/evidence/video/v2-interaction.webm'; renameSync(src, out); rmSync(tmp, { recursive: true, force: true });
console.log(out, (statSync(out).size / 1e6).toFixed(2) + ' MB');
