// Headless screenshot helper. Usage: node tests/shoot.mjs <name> <query> [wait_ms] [w] [h]
// Needs a Chromium (PLAYWRIGHT_CHROMIUM or the sandbox install) and a server on :8000 (python3 -m http.server 8000).
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const root = execSync('npm root -g').toString().trim();
const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const [name, query = '', wait = '600', w = '1600', h = '900'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: +w, height: +h }, reducedMotion: query.includes('reduced') ? 'reduce' : 'no-preference' });
const errs = [];
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
await pg.goto('http://localhost:8000/rewrite/?' + query);
if (process.env.HOLD) { const bb = await pg.locator('#holdBtn').boundingBox(); await pg.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(+process.env.HOLD); }
if (process.env.MOVE) { const [mx, my] = process.env.MOVE.split(',').map(Number); await pg.mouse.move(mx, my); }
await pg.waitForTimeout(+wait);
await pg.screenshot({ path: `docs/screenshots/${name}.jpg` });
console.log(name, errs.length ? errs.join('\n') : 'no console errors');
await b.close();
