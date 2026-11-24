// Builds before|after side-by-side images (3200x900) in rewrite-v2/evidence/compare/ using a plain HTML page screenshot (ffmpeg here has no hstack/overlay).
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url'; import path from 'node:path';
const root = execSync('npm root -g').toString().trim(); const require = createRequire(root + '/');
const { chromium } = require(root + '/@playwright/mcp/node_modules/playwright-core');
const exe = process.env.CHROME || execSync('ls -d /inner_container/opt/playwright/chromium_headless_shell-*/*/chrome-headless-shell').toString().trim();
const ev = path.resolve('rewrite-v2/evidence'); fs.mkdirSync(ev + '/compare', { recursive: true });
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const pg = await (await b.newContext({ viewport: { width: 3200, height: 900 } })).newPage();
for (const f of fs.readdirSync(ev + '/after').filter((x) => x.endsWith('.jpg'))) {
  const html = `<body style="margin:0;display:flex;background:#000"><img src="${pathToFileURL(`${ev}/before/${f}`)}" width=1600 height=900><img src="${pathToFileURL(`${ev}/after/${f}`)}" width=1600 height=900></body>`;
  fs.writeFileSync(ev + '/compare/.tmp.html', html); await pg.goto(pathToFileURL(ev + '/compare/.tmp.html').href); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${ev}/compare/${f}`, type: 'jpeg', quality: 80 }); console.log(f);
}
fs.rmSync(ev + '/compare/.tmp.html'); await b.close();
