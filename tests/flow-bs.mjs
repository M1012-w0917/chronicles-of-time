// Book+Shadow flow test. Server on :8000 from repo root first. Exit code 1 on any failed assertion.
import { launch } from './pw-bs.mjs';
const BASE = process.env.BASE || 'http://localhost:8000/rewrite-book-shadow/index.html';
let pass = 0, fail = 0;
const ok = (c, msg, extra) => { if (c) { pass++; console.log('PASS', msg); } else { fail++; console.log('FAIL', msg, extra === undefined ? '' : JSON.stringify(extra)); } };
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const S = () => pg.evaluate(() => window.__bs.getState());
const FP = () => pg.evaluate(() => window.__bs.fingerprint());
const dist = (a, c) => a.reduce((s, v, i) => s + Math.abs(v - c[i]), 0) / a.length;
const until = (fn, arg, to = 30000) => pg.waitForFunction(fn, arg, { timeout: to });
const fresh = async (qs = '') => { await pg.goto(BASE + '?fresh=1' + qs); await pg.waitForTimeout(500); };

console.log('--- 1 before');
await fresh();
let s = await S();
ok(s.state === 'OLD' && s.t === 0 && s.glow < 0.1, 'before: OLD, world dark', { state: s.state, glow: s.glow });
ok((await pg.textContent('#factOld')) === '城门每日黄昏关闭,守门人点亮三盏灯。', 'DOM old text exact');
ok((await pg.textContent('#factNew')) === '这座城从来没有城门,黄昏也没有守门人。', 'DOM new text exact');
ok(+s.factOld > 0.99 && +s.factNew < 0.01, 'old text visible, new hidden');
ok(await pg.evaluate(() => document.documentElement.lang === 'zh-CN' && /Noto|Songti|SimSun/.test(getComputedStyle(document.body).fontFamily)), 'CJK font stack and lang zh-CN');
const fpBefore = await FP();

console.log('--- 2 hold to write, early release cancels');
const box = await pg.locator('#fact').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.waitForTimeout(500);
s = await S(); ok(s.state === 'WRITING' && s.w > 0.2 && s.w < 0.7, 'holding 0.5 s: WRITING partway', { w: s.w });
ok(s.glow > 0.1, 'candle brightens while writing', s.glow);
await pg.mouse.up(); await pg.waitForTimeout(700);
s = await S(); ok(s.state === 'OLD' && s.w === 0 && s.t === 0, 'early release cancels back to OLD', { state: s.state, w: s.w });
ok(+s.factOld > 0.99, 'text unchanged after cancel');

console.log('--- 3 full hold, continuous reconstruction in the same camera');
await pg.mouse.down();
await until(() => window.__bs.getState().state === 'RECON');
const fps = [await FP()]; const ts = []; let prev = fps[0], maxJump = 0, tPrev = 0, monotone = true, states = new Set();
const t0 = Date.now();
while (true) {
  const st = await S(); states.add(st.state); if (st.t < tPrev - 1e-9) monotone = false; tPrev = st.t;
  const f = await FP(); maxJump = Math.max(maxJump, dist(prev, f)); prev = f; fps.push(f); ts.push(st.t);
  if (st.state !== 'RECON' && st.state !== 'WRITING') break; if (Date.now() - t0 > 20000) break; await pg.waitForTimeout(120);
}
await pg.mouse.up();
ok(monotone, 'progress t never goes backwards during reconstruction');
ok(ts.length >= 12 && ts.filter((t) => t > 0.05 && t < 0.95).length >= 10, 'many intermediate frames sampled', ts.length);
ok(maxJump < 9, 'continuity: no cut between consecutive frames (mean luma delta)', maxJump.toFixed(2));
const fpNew = fps[fps.length - 1];
ok(dist(fpBefore, fpNew) > 3, 'start and end fingerprints differ', dist(fpBefore, fpNew).toFixed(2));
s = await S(); ok(s.state === 'NEW' || s.state === 'HAUNT', 'reaches new world', s.state);
ok(+s.factNew > 0.99 && +s.factOld < 0.01, 'text swapped to new fact in the same place');
ok(s.persisted === 'new', 'new world persisted');

console.log('--- 4 dwell in the new world');
await pg.waitForTimeout(1500);
const d1 = await FP(); await pg.waitForTimeout(800); const d2 = await FP();
s = await S(); ok((s.state === 'NEW' || s.state === 'HAUNT') && s.t === 1, 'stays in new world, no auto revert', s.state);
ok(dist(d1, d2) < 3, 'dwell: image is stable (only candle flicker)', dist(d1, d2).toFixed(2));
ok(await pg.locator('#capNew').evaluate((e) => +getComputedStyle(e).opacity > 0.99), 'English caption for new fact visible');

await pg.waitForTimeout(5000);
s = await S(); ok(s.state === 'NEW' && s.haunt === 0, 'still in the new world 7+ s after it finished (no auto shade)', s.state);
ok(await pg.evaluate(() => document.getElementById('fact').getAttribute('aria-labelledby') === 'factNew'), 'accessible name of the fact line is the current (new) sentence');
ok(await pg.locator('#waitBtn').isEnabled(), 'Look at the back button enabled in NEW');

console.log('--- 5 haunt on the back of the paper');
await pg.keyboard.press('h');
await until(() => window.__bs.getState().haunt > 0.95, null, 40000);
s = await S(); ok(s.state === 'HAUNT' && s.noteVisible, 'HAUNT with roll note visible');
ok((await pg.textContent('#note')).includes('守门人名册 0'), 'note text: roll 0, shade 1');
s = await S(); ok(s.anomaly === 0 && !s.anomVisible, 'anomaly: none before the candle has moved');
await pg.evaluate(() => window.__bs.setLight(1000, 300, true)); await pg.waitForTimeout(250);
s = await S(); ok(s.anomaly === 0, 'anomaly: a short candle move (140 px) does not trigger it', s.anomaly);
await pg.evaluate(() => window.__bs.setLight(200, 300, true)); await pg.waitForTimeout(350);
s = await S(); ok(s.anomaly === 1 && s.anomVisible, 'anomaly 1: a long candle move makes the shade answer the wrong way, caption shown', { an: s.anomaly, vis: s.anomVisible });
ok(s.shade.toward.x < -0.5 && s.shade.castX > 5 && s.shade.lean > 0, 'anomaly: candle is on the left yet the cast and the lean go right (reverse response)', { c: s.shade.castX, l: s.shade.lean });
ok((await pg.textContent('#anomNote')).includes('影子答错了方向') && (await pg.textContent('#anomNote')).includes('The shade answers the wrong way'), 'anomaly caption in Chinese and English');
ok((await pg.textContent('#sr')).includes('wrong way'), 'anomaly announced in the status region');
await until(() => window.__bs.getState().anomaly === 2, null, 4000); s = await S(); ok(!s.anomVisible && s.anomK === 0, 'anomaly 2: settles, caption gone');
await pg.evaluate(() => window.__bs.setLight(1000, 300, true)); await pg.waitForTimeout(250); const a = (await S()).shade;
await pg.evaluate(() => window.__bs.setLight(200, 300, true)); await pg.waitForTimeout(250); const c2 = (await S()).shade;
ok(a && c2 && a.toward.x > 0.5 && c2.toward.x < -0.5, 'shade casts toward the candle on both sides (anomalous: real shadows fall away)', { a: a && a.toward, c: c2 && c2.toward });
ok(a.castX > 5 && c2.castX < -5, 'cast offset follows light direction', [a.castX, c2.castX]);
ok(a.lean > 0 && c2.lean < 0, 'shade leans toward the light', [a.lean, c2.lean]);
ok(a.x === c2.x && a.y === c2.y, 'shade stays pinned on the paper while light moves');
ok((await S()).anomaly === 2, 'the anomaly happens once per haunt session, later moves follow the normal rule');
ok(await pg.locator('#turnBtn').isEnabled(), 'turn page enabled in HAUNT');
await pg.keyboard.press('p'); await pg.waitForTimeout(500);
const mid = await S(); ok(mid.flip > 0.1 && mid.shade.arm > 0.2, 'page turn: leaf lifts and shade raises its lantern', { flip: mid.flip, arm: mid.shade.arm });
ok(mid.shade.x === a.x, 'shade does not move with the turning leaf');
await until(() => { const e = window.__bs.getState().shade; return e && e.echo; }, null, 6000);
const em = await S(), sb = em.shade.bounds, eb = em.shade.echo;
ok(Math.abs((sb.y1 - sb.y0) - (eb.y1 - eb.y0)) < 0.5 && eb.y0 === sb.y0, 'page turn: the outline emerging from the leaf back has the same height and position as the shade', { sb, eb });
ok(Math.abs((eb.x1 - 640) / eb.k - (640 - sb.x0)) < 1 && Math.abs((eb.x0 - 640) / eb.k - (640 - sb.x1)) < 1, 'page turn: the emerging outline is the same silhouette mirrored across the spine', { sb, eb });
await until(() => window.__bs.getState().turns === 1, null, 8000); ok(true, 'page turn completes (turns=1)');
const af = await S(); ok(af.shade && af.shade.echo === null && af.shade.bounds.x0 === sb.x0 && af.shade.bounds.y1 === sb.y1, 'shade remains in place after the page turn');

console.log('--- 6 compare (hold C) and revert (Z)');
const fpHaunt = await FP();
await pg.keyboard.down('c'); await pg.waitForTimeout(700);
s = await S(); ok(s.compare && !s.noteVisible, 'compare in HAUNT hides the roll note (no contradiction with the old keeper)');
const fpHc = await FP(); ok(dist(fpHc, fpHaunt) > 3, 'compare in HAUNT removes the shade from the image', dist(fpHc, fpHaunt).toFixed(2));
await pg.keyboard.up('c'); await pg.waitForTimeout(800);
s = await S(); ok(s.noteVisible, 'note returns after releasing C');
await pg.keyboard.down('c'); await pg.waitForTimeout(800);
s = await S(); ok(s.compare && s.c > 0.9 && s.td < 0.1, 'C shows the old world in the same camera', { c: s.c, td: s.td });
ok(+s.factOld > 0.9, 'old text shown while comparing');
const fpCmp = await FP(); ok(dist(fpCmp, fpNew) > 3, 'compare image differs from new world', dist(fpCmp, fpNew).toFixed(2));
await pg.keyboard.up('c'); await pg.waitForTimeout(700);
s = await S(); ok(!s.compare && s.c < 0.05 && s.t === 1, 'release C returns to new world');
await pg.keyboard.press('z');
await until(() => window.__bs.getState().state === 'OLD', null, 15000);
s = await S(); ok(s.t === 0 && s.haunt === 0 && s.persisted === null, 'Z reverts to OLD, haunt cleared, persistence cleared', s);
await pg.waitForTimeout(300); const fpRev = await FP(); ok(dist(fpRev, fpBefore) < 4, 'reverted image matches the original first screen', dist(fpRev, fpBefore).toFixed(2));

console.log('--- 6b idle timer, pointer capture, readability, narrow viewport');
const live = async (qs = '') => { await pg.goto(BASE + '?fresh=1'); await pg.evaluate(() => localStorage.setItem('bs.world', 'new')); await pg.goto(BASE + (qs ? '?' + qs : '')); await pg.waitForTimeout(400); };
await live(); await pg.waitForTimeout(300);
for (let i = 0; i < 4; i++) { await pg.mouse.move(300 + i * 100, 300); await pg.waitForTimeout(400); }
s = await S(); ok(s.state === 'NEW', 'moving the candle keeps the new world (idle timer reset)');
await live('reduced=1'); await pg.waitForTimeout(2500); s = await S(); ok(s.state === 'NEW', 'reduced motion also waits (no 1.2 s auto shade)', s.state);
await fresh(); const fb = await pg.locator('#fact').boundingBox();
await pg.mouse.move(fb.x + 20, fb.y + fb.height / 2); await pg.mouse.down(); await pg.mouse.move(fb.x + 200, fb.y - 200, { steps: 6 }); await pg.waitForTimeout(300);
s = await S(); ok(s.state === 'WRITING' && s.w > 0.1, 'dragging off the line during the hold keeps writing (pointer capture)', { state: s.state, w: s.w });
await pg.mouse.up(); await pg.waitForTimeout(600);
for (const id of ['meta', 'cap', 'note', 'cmpTag', 'fact']) {
  const px = await pg.evaluate((i) => parseFloat(getComputedStyle(document.getElementById(i)).fontSize), id); ok(px >= 12, `font floor: #${id} is ${px.toFixed(1)}px at 1280 wide`);
}
await pg.setViewportSize({ width: 640, height: 360 }); await pg.waitForTimeout(300);
for (const id of ['cap', 'cmpTag', 'fact']) {
  const px = await pg.evaluate((i) => parseFloat(getComputedStyle(document.getElementById(i)).fontSize), id); ok(px >= 12, `font floor: #${id} is ${px.toFixed(1)}px at 640 wide`);
}
await pg.setViewportSize({ width: 1280, height: 720 });

console.log('--- 6c layout zones at four sizes, with real CJK widths simulated');
// The capture machine has no CJK font, so each fact character is replaced by a 1em wide box while measuring. DOM text is restored afterwards.
const layout = async (w, h) => {
  await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(250);
  return pg.evaluate(() => {
    const keep = {}; ['factOld', 'factNew'].forEach((id) => { const e = document.getElementById(id); keep[id] = e.textContent; e.innerHTML = [...keep[id]].map((c) => '<b style="display:inline-block;width:1em;overflow:hidden;font-weight:400">' + c + '</b>').join(''); });
    ['note', 'anomNote'].forEach((id) => { document.getElementById(id).hidden = false; });
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const out = { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, ids: {}, stage: R(document.getElementById('stage')) };
    ['title', 'meta', 'note', 'anomNote', 'fact', 'holdBar', 'cap'].forEach((id) => { const e = document.getElementById(id); if (getComputedStyle(e).display !== 'none') out.ids[id] = R(e); });
    out.hint = R(document.getElementById('hint')); out.controls = R(document.getElementById('controls'));
    out.factText = ['factOld', 'factNew'].map((id) => { const e = document.getElementById(id); return Object.assign(R(e), { sw: e.scrollWidth, cw: e.clientWidth }); });
    out.capText = ['capOld', 'capNew'].map((id) => R(document.getElementById(id)));
    out.fontPx = parseFloat(getComputedStyle(document.getElementById('fact')).fontSize);
    ['factOld', 'factNew'].forEach((id) => { document.getElementById(id).textContent = keep[id]; });
    ['note', 'anomNote'].forEach((id) => { document.getElementById(id).hidden = true; });
    return out;
  });
};
const hit = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
for (const [w, h] of [[1600, 900], [1280, 720], [640, 360], [390, 844]]) {
  await fresh(); const L = await layout(w, h), tag = `${w}x${h}`;
  const items = Object.assign({}, L.ids, { hint: L.hint, controls: L.controls });
  ok(L.sw <= w, `${tag}: no horizontal scroll`, L.sw);
  ok(Object.entries(items).every(([, r]) => r.l >= -0.5 && r.r <= w + 0.5), `${tag}: every overlay, hint and control row is inside the viewport`, items);
  const names = Object.keys(items), clash = [];
  for (let i = 0; i < names.length; i++) for (let k = i + 1; k < names.length; k++) if (hit(items[names[i]], items[names[k]])) clash.push(names[i] + '/' + names[k]);
  ok(clash.length === 0, `${tag}: fact line, hold bar, caption, notes, hint and controls do not overlap each other`, clash);
  ok(L.factText.every((f) => f.sw <= f.cw + 1 && f.b <= L.ids.fact.b + 1), `${tag}: 19 CJK characters at ${L.fontPx.toFixed(1)}px wrap inside the fact box`, L.factText);
  ok(L.fontPx >= 12, `${tag}: fact font floor`, L.fontPx);
  if (w > 700) {
    const sc = (L.stage.r - L.stage.l) / 1280, Z = (x0, y0, x1, y1) => ({ l: L.stage.l + x0 * sc, t: L.stage.t + y0 * sc, r: L.stage.l + x1 * sc, b: L.stage.t + y1 * sc });
    const zones = { puppet: Z(520, 150, 800, 470), shadeZone: Z(200, 380, 500, 520) };
    const bad = []; for (const [n, r] of Object.entries(L.ids)) for (const [zn, z] of Object.entries(zones)) if (hit(r, z)) bad.push(n + ' in ' + zn);
    ok(bad.length === 0, `${tag}: no text overlay enters the gate/keeper zone or the shade zone`, bad);
  } else {
    ok(L.ids.fact.t >= L.stage.b - 0.5 && L.ids.cap.t >= L.ids.fact.b - 0.5, `${tag}: stacked, book canvas above, fact line below it, caption below the fact line`, { stageB: L.stage.b, fact: L.ids.fact });
  }
  if (w === 390) {
    ok(L.controls.b <= h && L.hint.b <= h, '390: hint and controls fully inside the viewport vertically', { hint: L.hint, controls: L.controls });
    console.log('MEASURE 390x844', JSON.stringify({ fact: L.ids.fact, factOldScrollW: L.factText[0].sw, factNewScrollW: L.factText[1].sw, factBoxW: L.factText[0].cw, cap: L.ids.cap, hint: L.hint, controls: L.controls, docScrollWidth: L.sw }));
    await fresh(); const fb2 = await pg.locator('#fact').boundingBox();
    await pg.mouse.move(fb2.x + fb2.width / 2, fb2.y + fb2.height / 2); await pg.mouse.down(); await pg.waitForTimeout(500);
    s = await S(); ok(s.state === 'WRITING' && s.w > 0.2, '390: holding the fact line writes', s.w); await pg.mouse.up(); await pg.waitForTimeout(600);
  }
}


await pg.setViewportSize({ width: 1280, height: 720 });
console.log('--- 6d pierced holes, page-curl warp, gather trail, reduced anomaly');
await fresh('&t=0&lit=1&lx=790&ly=300');
const pr = await pg.evaluate(() => window.__bs.probe()); ok(pr.hole > pr.body + 10, 'pierced hole passes more light than the leather body (pixel probe)', { hole: pr.hole.toFixed(1), body: pr.body.toFixed(1) });
s = await S(); ok(s.warp.spine < s.warp.mid - 0.2, 'warp: paper squeezes horizontally at the spine compared with mid page', s.warp);
ok(s.warp.spot > 0.95, 'warp: candle spot mid page is not squeezed', s.warp.spot);
await fresh('&t=0&lit=1&lx=640&ly=300'); s = await S(); ok(s.warp.spot < 0.8, 'warp: candle spot on the spine is squeezed to under 80% width', s.warp.spot);
const tr = [];
for (const t of [0.05, 0.3, 0.6, 0.8, 0.95, 1]) { await fresh('&t=' + t); tr.push((await S()).trail); }
ok(tr[1] > 0.3 && tr[2] > 0.8 && tr[3] > 0.5, 'gather trail visible at t 0.3, 0.6, 0.8', tr);
ok(tr[5] === 0 && tr[4] < 0.15, 'gather trail fades by t=1', tr);
await fresh('&t=0.3&lx=700&ly=330'); const trA = await FP(); await fresh('&t=0.6&lx=700&ly=330'); const trB = await FP(); ok(dist(trA, trB) > 2, 'gathering shows as continuous change between t=0.3 and 0.6', dist(trA, trB).toFixed(2));
await fresh('&state=new&haunt=1&reduced=1&lx=700&ly=330&anom=1'); s = await S();
ok(s.anomaly === 1 && s.anomK === 1 && s.shade.lean === 0 && s.shade.castX < -5 && s.anomVisible, 'reduced motion: anomaly is one static reversed cast with the caption, no lean', { k: s.anomK, c: s.shade.castX, l: s.shade.lean });
const ra = await FP(); await pg.waitForTimeout(400); ok(dist(ra, await FP()) < 0.01, 'reduced anomaly is frozen (no movement)');

console.log('--- 7 keyboard path');
await fresh(); await pg.focus('#fact'); await pg.keyboard.down('Space'); await pg.waitForTimeout(400); await pg.keyboard.up('Space'); await pg.waitForTimeout(600);
s = await S(); ok(s.state === 'OLD', 'keyboard Space early release cancels');
await pg.keyboard.down('Enter'); await pg.waitForTimeout(1500); await pg.keyboard.up('Enter');
s = await S(); ok(s.state === 'RECON' || s.state === 'NEW', 'keyboard Enter hold writes', s.state);
await until(() => ['NEW', 'HAUNT'].includes(window.__bs.getState().state), null, 20000);
await pg.keyboard.press('ArrowLeft'); await pg.waitForTimeout(600); s = await S(); ok(s.light.x < 860, 'arrow keys move the candle', s.light);
await pg.keyboard.press('z'); await until(() => window.__bs.getState().state === 'OLD', null, 15000); ok(true, 'keyboard Z reverts');
await pg.focus('#compareBtn'); ok(await pg.evaluate(() => document.activeElement.id === 'compareBtn'), 'buttons are focusable');

console.log('--- 8 reduced motion');
await fresh('&reduced=1&t=0.5'); s = await S();
ok(s.reduced && s.state === 'RECON', 'reduced=1 honoured');
const r1 = await FP(); await pg.waitForTimeout(400); const r2 = await FP(); ok(dist(r1, r2) < 0.01, 'reduced: frozen mid-state has no sway or flicker', dist(r1, r2));
await fresh('&state=new&haunt=1&reduced=1&lx=300&ly=300'); s = await S(); ok(s.shade && s.shade.lean === 0, 'reduced: shade does not lean', s.shade && s.shade.lean);
await pg.emulateMedia({ reducedMotion: 'reduce' }); await pg.goto(BASE + '?fresh=1'); await pg.waitForTimeout(300);
s = await S(); ok(s.reduced, 'prefers-reduced-motion media query turns reduced on');
await pg.mouse.move(cx, cy); await pg.mouse.down(); await until(() => window.__bs.getState().state === 'RECON'); await pg.mouse.up();
const rs = []; for (let i = 0; i < 6; i++) { rs.push(await FP()); await pg.waitForTimeout(150); }
await until(() => window.__bs.getState().state === 'NEW' || window.__bs.getState().state === 'HAUNT', null, 10000); ok(true, 'reduced reconstruction completes quickly (crossfade)');
await pg.emulateMedia({ reducedMotion: 'no-preference' });

console.log('--- 9 runtime');
s = await S(); ok(s.frameMs.avg < 40, 'average render time per frame under 40 ms', s.frameMs);
ok(errs.length === 0, 'no console or page errors', errs);
await b.close();
console.log(`\nRESULT ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
