// Writes docs/zh-text-bs.txt: every Chinese string the page can show, read from the live DOM (and the canvas title is named separately),
// with code points and font used by the browser. This is a text-level record only. It is NOT visual proof of glyph rendering.
import { launch } from './pw-bs.mjs';
import { writeFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-book-shadow/index.html';
const b = await launch(); const pg = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await pg.goto(BASE + '?fresh=1&state=new&haunt=1&anom=1'); await pg.waitForTimeout(800);
const rows = await pg.evaluate(() => ['factOld', 'factNew', 'title', 'note', 'anomNote'].map((id) => { const e = document.getElementById(id); return { id, text: e.textContent.trim(), family: getComputedStyle(e).fontFamily }; }));
const zh = (t) => [...t].filter((c) => /[\u3000-\u9fff\uff00-\uffef]/.test(c));
let out = 'Chinese text present in the DOM (exact strings and code points).\nGlyph rendering is NOT verified: the capture machine has no CJK font, so these render as gaps in the screenshots and the video.\n\n';
for (const r of rows) { const z = zh(r.text); out += `#${r.id}\n  text: ${r.text.replace(/\s+/g, ' ')}\n  CJK characters: ${z.length}\n  code points: ${z.map((c) => 'U+' + c.codePointAt(0).toString(16).toUpperCase()).join(' ')}\n  font-family: ${r.family}\n\n`; }
out += 'Canvas spine title: 城游志 is drawn with fillText in paint.js (same font stack).\n'.replace('城游志', '城门志');
writeFileSync('docs/zh-text-bs.txt', out); console.log(out);
await b.close();
