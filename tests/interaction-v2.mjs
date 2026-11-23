// Measured full interaction (asserts). Server on :8000 first. Env: CHROME, BASE
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { runScenario } from './scenario-v2.mjs';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-v2/index.html';
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const t0 = Date.now(); let n = 0;
await runScenario(b, BASE, { log: (m) => { n++; console.log(m + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + 's)'); } });
await b.close(); console.log(n + ' passed');
