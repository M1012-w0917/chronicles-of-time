// V3 app: one painting, five parallax planes, one model. Window.__slice exposes setProgress/getState for tests.
(function () {
  'use strict';
  const C = V3Core, P = V3Paint, W = C.WORLD, SH = W.sheet;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const scene = $('scene'), sctx = scene.getContext('2d'), ghost = $('ghost'), gctx = ghost.getContext('2d');
  const slip = $('slip'), card = $('card'), strike = $('strike'), brush = $('brush'), dock = $('dock');
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };

  const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  const reducedParam = q.get('reduced');
  const m = C.createMachine({ reduced: reducedParam != null ? reducedParam === '1' : !!(mq && mq.matches) });
  const frozen = ['t', 'w', 'state', 'haunt'].some((k) => q.has(k)); // debug params make a deterministic still
  const NEW = C.newStamps(1);
  let HAUNT_FIG = { h: 178 }, SEAL_AT = { x: 560, y: 612, s: 76 };

  let saved = store.get('v3ink.settled');
  // initial state
  if (q.has('t')) m.scrub(parseFloat(q.get('t')));
  else if (q.get('state') === 'new' || (!frozen && store.get('v3ink.settled') === 'new' && !q.has('autoplay'))) m.scrub(1);
  if (q.has('w')) { m.state = 'WRITING'; m.w = parseFloat(q.get('w')); }
  if (q.has('haunt')) m.forceHaunt(parseFloat(q.get('haunt')));

  // ---- layout and layers (rebuilt on resize) ----
  let sc = 1, cover = 1, offX = 0, offY = 0, R = 1, SW = 0, SHT = 0, GW = 176, GH = 100;
  let paper, fibre, planes = [], mist = [], sealImg, tmp, fields = [], penStamps = [];
  let cursor = 0, tmax = 0, lastStamp = null, lastStampAt = 0;
  const maskC = [P.mk(GW, GH), P.mk(GW, GH), P.mk(GW, GH), P.mk(GW, GH)];
  const maskD = maskC.map((c) => c.getContext('2d').createImageData(GW, GH));
  const planeCtxT = (c) => { const x = c.getContext('2d'); x.setTransform(R, 0, 0, R, -SH.x * R, -SH.y * R); return x; };

  function build() {
    const vw = innerWidth, vh = innerHeight;
    sc = Math.min(1, 1600 / vw);
    scene.width = ghost.width = Math.round(vw * sc); scene.height = ghost.height = Math.round(vh * sc);
    cover = Math.max(scene.width / W.w, scene.height / W.h); R = Math.min(1, cover);
    offX = (scene.width - W.w * cover) / 2; offY = (scene.height - W.h * cover) / 2;
    SW = Math.round(SH.w * R); SHT = Math.round(SH.h * R);
    paper = P.mk(scene.width, scene.height); fibre = P.mk(scene.width, scene.height); P.paintPaper(paper, fibre, 3);
    tmp = P.mk(SW, SHT);
    planes = [];
    for (let p = 0; p < C.PLANES; p++) planes.push({ old: P.mk(SW, SHT), oldF: p === 2 ? P.mk(SW, SHT) : null, oldL: p === 2 ? P.mk(SW, SHT) : null, nw: P.mk(SW, SHT), cur: P.mk(SW, SHT), base: p === 0 || p === 4 ? P.mk(SW, SHT) : null, key: '', minA: 1, maxA: 0 });
    const oct = (p) => planeCtxT(planes[p].old);
    const mt = C.mountainStamps('old', 1);
    [0, 1].forEach((p) => P.drawStamps(oct(p), mt.filter((s) => s.p === p)));
    P.paintCity(planeCtxT(planes[2].oldF), planeCtxT(planes[2].oldL)); // fills and lines apart, so the old outline can retreat last
    { const o2 = planes[2].old.getContext('2d'); o2.drawImage(planes[2].oldF, 0, 0); o2.drawImage(planes[2].oldL, 0, 0); }
    P.paintRiver(oct(3));
    penStamps = C.stroke([[1252, 250], [1228, 298], [1182, 360], [1118, 412]], { w: 30, a: 0.9, blunt: 1, ta: 0, tb: 0.85, wet: 1, bleed: 0.3 }, C.rng(77));
    P.paintSky(planeCtxT(planes[0].base)); P.paintForeground(planeCtxT(planes[4].base));
    // arrival fields at low resolution (the same numbers decide old erasure and new strokes)
    fields = [];
    for (let p = 0; p < C.PLANES; p++) {
      const F = new Float32Array(GW * GH);
      let mn = 1, mx = 0;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const wx = SH.x + (x + 0.5) / GW * SH.w, wy = SH.y + (y + 0.5) / GH * SH.h;
        const a = C.arrival(p, wx, wy) + C.SEEP_AMP * C.seep(wx, wy); // the front fingers along the paper fibres
        F[y * GW + x] = a; if (a < mn) mn = a; if (a > mx) mx = a;
      }
      fields.push(F); planes[p].minA = mn; planes[p].maxA = mx;
    }
    mist = [];
    for (let j = 0; j < 4; j++) { const c = P.mk(Math.round(W.w * R), Math.round(360 * R)); P.paintMist(c, 90 + j); mist.push(c); }
    sealImg = P.paintSeal(128);
    cursor = 0; const keep = tmax; tmax = 0; lastStamp = null;
    paintTo(keep);
    buildStrike(); layoutSlip();
    dirty = true;
  }

  function paintTo(td) {
    if (td <= tmax && cursor > 0) return;
    const ctxs = planes.map((p) => planeCtxT(p.nw)), sp = P.makeSprites();
    let n = 0;
    while (cursor < NEW.length && NEW[cursor].t <= td) {
      const s = NEW[cursor++];
      if (s.r >= 0.45) { const c = ctxs[s.p]; c.globalAlpha = s.a; c.drawImage(sp[s.k], s.x - s.r, s.y - s.r, s.r * 2, s.r * 2); }
      lastStamp = s; n++;
    }
    if (n) lastStampAt = performance.now();
    tmax = Math.max(tmax, td);
  }
  function resetNew() {
    planes.forEach((p) => { const c = p.nw.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, p.nw.width, p.nw.height); p.key = ''; });
    cursor = 0; tmax = 0; lastStamp = null;
  }

  // ---- composite one plane for progress td: old ink eroded by the front, new strokes laid on ----
  const LINE_LAG = 0.08, tail = (p) => (p === 2 ? LINE_LAG : 0); // the city's outlines outlast its fills
  function planeImage(p, td) {
    const P_ = planes[p];
    if (td < P_.minA - 0.03) return P_.old;
    if (td >= P_.maxA + 0.17 + tail(p) && td >= tmax - 1e-4) return P_.nw;
    const key = td.toFixed(4) + '|' + cursor + '|' + tmax.toFixed(4);
    if (P_.key === key) return P_.cur;
    P_.key = key;
    const F = fields[p], E = maskD[0].data, Rg = maskD[1].data, N = maskD[2].data, D = maskD[3].data;
    const masked = td < tmax - 1e-4;
    for (let i = 0, k = 0; i < F.length; i++, k += 4) {
      const A = F[i], e = C.reveal(td, A, 0.1), x = (td - A - 0.03) / 0.06;
      E[k + 3] = e * 255; if (p === 2) D[k + 3] = C.reveal(td, A + LINE_LAG, 0.1) * 255;
      Rg[k] = 34; Rg[k + 1] = 31; Rg[k + 2] = 28; Rg[k + 3] = Math.abs(x) < 5 ? 105 * Math.exp(-x * x) + 34 * Math.exp(-x * x / 5) : 0; // sharp wet edge plus a wide seep halo
      if (masked) N[k + 3] = C.reveal(td, A + C.NEW_LAG * 0.9, 0.1) * 255;
    }
    for (let j = 0; j < (masked ? 3 : 2); j++) maskC[j].getContext('2d').putImageData(maskD[j], 0, 0);
    const c = P_.cur.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, SW, SHT);
    if (p === 2) { // fills first, then the outline: roofs and wall lose their body, the line is the last to go
      maskC[3].getContext('2d').putImageData(maskD[3], 0, 0);
      c.drawImage(P_.oldF, 0, 0); c.globalCompositeOperation = 'destination-out'; c.drawImage(maskC[0], 0, 0, SW, SHT);
      const t = tmp.getContext('2d'); t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, SW, SHT); t.drawImage(P_.oldL, 0, 0);
      t.globalCompositeOperation = 'destination-out'; t.drawImage(maskC[3], 0, 0, SW, SHT);
      c.globalCompositeOperation = 'source-over'; c.drawImage(tmp, 0, 0);
      c.globalCompositeOperation = 'destination-out';
    } else { c.drawImage(P_.old, 0, 0); c.globalCompositeOperation = 'destination-out'; c.drawImage(maskC[0], 0, 0, SW, SHT); }
    c.globalCompositeOperation = 'source-over'; c.drawImage(maskC[1], 0, 0, SW, SHT);
    if (masked) {
      const t = tmp.getContext('2d');
      t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, SW, SHT); t.drawImage(P_.nw, 0, 0);
      t.globalCompositeOperation = 'destination-in'; t.drawImage(maskC[2], 0, 0, SW, SHT);
      c.drawImage(tmp, 0, 0);
    } else c.drawImage(P_.nw, 0, 0);
    return P_.cur;
  }
  const planeMode = (p, td) => (td < planes[p].minA - 0.03 ? 'old' : td >= planes[p].maxA + 0.17 + tail(p) && td >= tmax - 1e-4 ? 'new' : 'mix');

  // ---- the struck line on the slip: brush stamps along a zig-zag across the old column ----
  let strikeStamps = [], strikeDrawn = 0;
  function buildStrike() {
    const w = card.offsetWidth || 130, h = card.offsetHeight || 346;
    strike.width = w; strike.height = h; strikeDrawn = 0;
    const r = C.rng(8), k = w / 130, pts = [];
    const x0 = w - 14 - 17 * k, ys = [h * 0.07, h * 0.5, h * 0.93, h * 0.45, h * 0.12];
    ys.forEach((y, i) => pts.push([x0 + (i % 2 ? 11 : -11) * k + (r() - 0.5) * 5, y]));
    strikeStamps = C.stroke(pts, { w: 17 * k, a: 0.9, dry: 0.2, ta: 0.04, tb: 0.1, bleed: 0.25 }, r);
  }
  function drawStrike(wv) {
    const n = Math.floor(strikeStamps.length * C.clamp(wv)), x = strike.getContext('2d');
    if (n < strikeDrawn) { x.clearRect(0, 0, strike.width, strike.height); strikeDrawn = 0; }
    P.drawStamps(x, strikeStamps, strikeDrawn, n); strikeDrawn = n;
    return strikeStamps[Math.max(0, n - 1)];
  }

  const toScreen = (x, y, dx) => [(offX + (x + (dx || 0)) * cover) / sc, (offY + y * cover) / sc];
  function layoutSlip() {
    const [px, py] = toScreen(W.pen.x, W.pen.y);
    slip.style.left = px + 'px'; slip.style.top = Math.max(86, py - 130) + 'px';
  }

  // ---- input ----
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, moved: 0 };
  addEventListener('pointermove', (e) => { ptr.tx = e.clientX / innerWidth; ptr.ty = e.clientY / innerHeight; ptr.moved = performance.now(); });
  const down = new Set();
  const press = () => { m.press(); setStatus(); }, release = () => { m.release(); setStatus(); };
  addEventListener('keydown', (e) => {
    if (e.repeat || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); press(); }
    else if (e.key === 'c' || e.key === 'C') { m.setCompare(true); setStatus(); }
    else if (e.key === 'z' || e.key === 'Z') { m.undo(); setStatus(); }
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space') release();
    else if (e.key === 'c' || e.key === 'C') { m.setCompare(false); setStatus(); }
  });
  const hold = (el, on, off) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, off)); };
  hold($('holdBtn'), press, release); hold(card, press, release);
  hold($('compareBtn'), () => { m.setCompare(true); setStatus(); }, () => { m.setCompare(false); setStatus(); });
  $('undoBtn').addEventListener('click', () => { m.undo(); setStatus(); });
  $('reduceBtn').addEventListener('click', () => { m.reduced = !m.reduced; dirty = true; setStatus(); });
  $('scrub').addEventListener('input', (e) => { m.scrub(parseFloat(e.target.value)); dirty = true; setStatus(); });
  let rto = 0; addEventListener('resize', () => { clearTimeout(rto); rto = setTimeout(build, 200); });

  function setStatus() {
    const s = { OLD: 'The city stands. Hold Space to strike the line.', WRITING: 'Keep holding. The brush is on the page.', REWRITING: 'The ink is spreading outward from the line.', UNDOING: 'Undoing: the old city comes back.', NEW: m.haunt > 0.95 && C.hauntState(m.haunt).margin ? 'The gate that stood here was struck from the record. Someone still walks its road.' : 'The city was never founded. The river runs where it ran.', SCRUB: 'Between the two paintings.' }[m.state];
    $('status').textContent = m.compare ? 'Comparing: this is the city before the rewrite.' : s;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare));
    $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    $('reduceBtn').textContent = 'Reduced motion: ' + (m.reduced ? 'on' : 'off');
    $('holdBtn').setAttribute('aria-pressed', String(m.state === 'WRITING'));
  }

  // ---- frame ----
  let last = performance.now(), clock = 0, dirty = true, lastSig = '', ghostA = 0, bx = 0, by = 0, bang = 40, bz = 0, lastTd = -1, lastHaunt = -1, offs = [0, 0, 0, 0, 0], mistA = [0, 0, 0, 0], hv = C.hauntState(0), hvis = 0;
  const FX = { x: 0, y: 0 };
  let lastEcho = false;
  let mistHeld = false; // test hook: pin the mist drift so fingerprints taken at different times compare the paintings, not the mist phase

  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { m.step(dt); clock += dt; }
    const v = m.view(), td = v.td;
    if (td > tmax) paintTo(td);
    if (m.state === 'OLD' && td === 0 && m.c === 0 && tmax > 0 && m.w === 0) resetNew();
    if (m.settled !== saved && (m.state === 'OLD' || m.state === 'NEW')) { saved = m.settled; store.set('v3ink.settled', saved); }

    hv = C.hauntState(m.haunt); hvis = C.smooth((td - 0.92) / 0.08);
    const reduced = m.reduced;
    if (!reduced) {
      ptr.x += (ptr.tx - ptr.x) * (1 - Math.exp(-dt / 220)); ptr.y += (ptr.ty - ptr.y) * (1 - Math.exp(-dt / 220));
    } else { ptr.x = ptr.y = 0.5; }
    const depth = C.smooth((td - 0.6) / 0.4);
    const amp = reduced ? 0 : 0.1 + 0.9 * depth;
    const sway = frozen || reduced || now - ptr.moved < 2500 ? 0 : Math.sin(clock / 2600) * 0.35; // an inhabited landscape breathes a little
    for (let p = 0; p < C.PLANES; p++) offs[p] = -((ptr.x - 0.5) * 2 + sway) * C.PARALLAX[p] * amp;
    const bump = Math.exp(-Math.pow((td - 0.45) / 0.25, 2));
    for (let j = 0; j < 4; j++) mistA[j] = C.clamp(0.28 + 0.4 * depth + 0.55 * bump, 0, 0.95);

    const sig = [td.toFixed(4), m.haunt.toFixed(3), v.w.toFixed(3), reduced ? 1 : 0, tmax.toFixed(3)].join('|');
    if (reduced && sig === lastSig && !dirty) { domSync(v, now, dt); return requestAnimationFrame(frame); }
    if (reduced && (Math.abs(td - lastTd) > 0.01 || Math.abs(m.haunt - lastHaunt) > 0.01) && lastTd >= 0) { // staged change: short crossfade from the held frame
      gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.drawImage(scene, 0, 0); ghostA = 1; ghost.classList.add('on');
    }
    lastSig = sig; lastTd = td; lastHaunt = m.haunt; dirty = false;
    render(v, td, now, reduced);
    domSync(v, now, dt);
    requestAnimationFrame(frame);
  }

  const FIGURE_PLANE = 3;
  function drawPlane(img, dx) {
    sctx.setTransform(cover, 0, 0, cover, offX + dx * cover, offY + dx * 0.4 * cover);
    sctx.drawImage(img, SH.x, SH.y, SH.w, SH.h);
  }
  function render(v, td, now, reduced) {
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1;
    sctx.drawImage(paper, 0, 0);
    for (let p = 0; p < C.PLANES; p++) {
      if (planes[p].base) drawPlane(planes[p].base, offs[p]);
      drawPlane(planeImage(p, td), offs[p]);
      if (p < 4) { // drifting mist between planes, thickest while the old city dissolves
        const sp = [14, 22, 34, 50][p], mx = reduced || mistHeld ? 0 : (clock / 1000 * sp * (0.4 + 0.6 * C.smooth(td * 3))) % W.w, cy = [430, 560, 690, 800][p];
        sctx.globalAlpha = mistA[p];
        for (const x0 of [-mx, W.w - mx]) { sctx.setTransform(cover, 0, 0, cover, offX + (offs[p] + x0) * cover, offY + (cy - 180) * cover); sctx.drawImage(mist[p], 0, 0, W.w, 360); }
        sctx.globalAlpha = 1;
      }
    }
    // the lone absence and the seal on the wrong place
    const fa = hv.figure * hvis, pa = hv.path * hvis;
    if (pa > 0.01 || fa > 0.01) sctx.setTransform(cover, 0, 0, cover, offX + offs[FIGURE_PLANE] * cover, offY + offs[FIGURE_PLANE] * 0.4 * cover);
    if (pa > 0.01) P.cutPath(sctx, paper, pa, Math.max(fa, 0.6)); // the old gate's own shapes, cut back to paper along its road
    if (fa > 0.01) {
      sctx.setTransform(cover, 0, 0, cover, offX + offs[FIGURE_PLANE] * cover, offY + offs[FIGURE_PLANE] * 0.4 * cover); // the dark bank under the figure is painted on plane 3, so the figure rides plane 3
      const fp = C.figureAt(m.haunt);
      P.cutFigure(sctx, paper, fp.x, fp.y, HAUNT_FIG.h, hv.heading, fa, 1 - C.smooth(hv.heading / 45));
    }
    const sa = hv.seal * hvis;
    if (sa > 0.01) {
      const s = SEAL_AT.s * (1 + 0.45 * (1 - hv.seal));
      sctx.setTransform(cover, 0, 0, cover, offX + (offs[2] + SEAL_AT.x) * cover, offY + (offs[2] * 0.4 + SEAL_AT.y) * cover);
      sctx.rotate(-0.15); sctx.globalCompositeOperation = 'multiply'; sctx.globalAlpha = 0.93 * sa; sctx.drawImage(sealImg, -s / 2, -s / 2, s, s);
      sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1;
    }
    // 起笔: the brush tip lands beside the slip as a blunt dark start that drags and tapers, then retreats into the wash as the rewrite takes over
    const nib = (1 - C.smooth(td / 0.22)) * (1 - C.smooth(m.c)), nibN = Math.floor(penStamps.length * C.smooth(C.clamp(v.w * 1.5)));
    if (nib > 0.01 && nibN > 0) { sctx.setTransform(cover, 0, 0, cover, offX, offY); P.drawStamps(sctx, penStamps, 0, nibN, nib); }
    // the ink drop at the pen point while the brush is down
    const bloom = v.w * (1 - C.smooth(td / 0.18)) * (1 - C.smooth(m.c)); // compare shows the old city as it was, without the brush-down drop
    if (bloom > 0.01) {
      const sp = P.makeSprites()[0], r = C.rng(4);
      sctx.setTransform(cover, 0, 0, cover, offX, offY);
      for (let i = 0; i < 9; i++) { const a = r() * 6.283, d = r() * 40 * bloom, rr = (24 + r() * 50) * (0.35 + bloom); sctx.globalAlpha = 0.5 * bloom; sctx.drawImage(sp, W.pen.x + Math.cos(a) * d - rr, W.pen.y + 20 + Math.sin(a) * d - rr, rr * 2, rr * 2); }
      sctx.globalAlpha = 1;
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.drawImage(fibre, 0, 0);
  }

  function domSync(v, now, dt) {
    const struck = v.w * (1 - C.smooth(m.c));
    slip.style.setProperty('--w', struck.toFixed(3));
    slip.style.setProperty('--sa', Math.max(struck, 0).toFixed(3));
    slip.style.setProperty('--old', (1 - 0.82 * struck * C.smooth(0.2 + 0.8 * v.w)).toFixed(3));
    slip.style.setProperty('--r', C.smooth((v.td - 0.04) / 0.3).toFixed(3));
    const echo = hv.margin * hvis > 0.5;
    if (echo !== lastEcho) { lastEcho = echo; setStatus(); }
    slip.dataset.echo = dock.dataset.echo = String(echo);
    drawStrike(m.state === 'WRITING' || m.state === 'OLD' ? v.w : (v.w > 0 ? 1 : 0));
    if (ghostA > 0) { ghostA = Math.max(0, ghostA - dt / 650); ghost.style.setProperty('--ga', ghostA.toFixed(3)); if (ghostA === 0) ghost.classList.remove('on'); }
    // brush: strikes the slip, then follows the newest stroke across the painting, otherwise rests
    let tx = innerWidth - 120, ty = innerHeight - 96, ta = 64;
    const cr = card.getBoundingClientRect();
    if (m.state === 'WRITING' && strikeStamps.length) {
      const s = strikeStamps[Math.max(0, Math.min(strikeStamps.length - 1, Math.floor(strikeStamps.length * v.w)))];
      tx = cr.left + (s.x / strike.width) * cr.width; ty = cr.top + (s.y / strike.height) * cr.height; ta = 16;
    } else if (!m.reduced && (m.state === 'REWRITING' || m.state === 'UNDOING') && lastStamp && now - lastStampAt < 1500) {
      const [sx, sy] = toScreen(lastStamp.x, lastStamp.y, offs[lastStamp.p]); tx = sx; ty = sy; ta = 24 + Math.sin(now / 90) * 4;
    } else if (m.state === 'REWRITING' || (m.state === 'NEW' && hv.margin < 0.05)) { // once the margin note appears the brush rests in the corner, off the note
      tx = cr.left + cr.width * 0.4; ty = cr.bottom + 52; ta = 28; }
    const k = frozen ? 1 : 1 - Math.exp(-dt / 120);
    bx += (tx - bx) * k; by += (ty - by) * k; bang += (ta - bang) * k;
    brush.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px) rotate(' + bang.toFixed(1) + 'deg) translate(-50%,-100%)';
    $('scrub').value = String(v.td.toFixed(2));
  }

  // ---- public hooks for tests and screenshots ----
  function foldFlags() { // the folded-leaf furniture is in the DOM and not hidden
    const on = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; };
    return { frame: on('#folio .frame'), crease: on('#folio .crease'), foreEdge: on('.roller.right'), fishTail: on('#folio .tail.t') && on('#folio .tail.b'), margin: on('#folio .margin') };
  }
  function fingerprint() { // 8x4 grid of mean luminance of what is on screen
    const w = 8, h = 4, c = P.mk(w, h), x = c.getContext('2d'); x.drawImage(scene, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, out = [];
    for (let i = 0; i < w * h; i++) out.push(Math.round((d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11)));
    return out;
  }
  window.__slice = {
    setProgress(v) { m.scrub(v); dirty = true; setStatus(); },
    holdMist(b) { mistHeld = !!b; dirty = true; },
    getState() {
      const v = m.view();
      return {
        state: m.state, settled: m.settled, t: m.t, td: v.td, w: m.w, c: m.c, haunt: m.haunt, reduced: m.reduced,
        figurePlane: FIGURE_PLANE, heroHeading: hv.heading, figurePos: C.figureAt(m.haunt), vanished: { x: C.VANISHED.x, y: C.VANISHED.y }, seal: hv.seal * hvis, figure: hv.figure * hvis, margin: hv.margin,
        painted: cursor, totalStamps: NEW.length, tmax, planes: planes.map((_, p) => planeMode(p, v.td)), offsets: offs.slice(), mist: mistA.slice(),
        pathCut: hv.path * hvis, cutShapes: Object.assign({}, P.cutLog), fibre: { seed: 91, dirAt: C.fibreDir(800, 450) },
        foldVisible: foldFlags(),
        brush: { x: bx, y: by }, strikeDrawn, strikeTotal: strikeStamps.length,
      };
    },
    // luminance grid (cols x rows) of a world rectangle on the figure plane, read back from the composed scene, for pixel assertions
    regionLum(x, y, w, h, cols, rows) {
      const c = P.mk(cols, rows), cx = c.getContext('2d'), k = cover;
      cx.drawImage(scene, offX + (x + offs[FIGURE_PLANE]) * k, offY + (y + offs[FIGURE_PLANE] * 0.4) * k, w * k, h * k, 0, 0, cols, rows);
      const d = cx.getImageData(0, 0, cols, rows).data, out = [];
      for (let i = 0; i < cols * rows; i++) out.push(d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11);
      return out;
    },
    fingerprint, machine: m,
  };

  build(); setStatus();
  if (q.get('autoplay') === '1') setTimeout(() => { press(); setTimeout(() => { release(); }, 99999); }, 900);
  requestAnimationFrame(frame);
})();
