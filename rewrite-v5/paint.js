// V5 paint: procedural leather shadow-puppet stage on one 2D canvas (1280x720). No external assets.
// Three scrims (far, middle, near). Each layer is drawn twice per frame: first as a flat silhouette onto a low-res buffer
// that is stretched back as a soft shadow on its own scrim (softer the farther the layer is from the viewer),
// then as translucent tinted leather (multiply) with cutouts, engraving and rivets. The backlight x shifts each layer
// by a different parallax, so a moving lamp moves shadows. Rods are collected while drawing and drawn last, in front.
const V5Paint = (function () {
  'use strict';
  const C = V5Core, TAU = Math.PI * 2;
  const W = 1280, H = 720, WIN = { x: 120, y: 56, w: 1040, h: 520 };
  const GROUND = 470;
  const SLOTS = { LL: 250, LT: 420, K: 600, RL: 1000, X1: 330, X2: 800, X3: 1100 };
  const PARK_Y = 512;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const rgb = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')';
  const lerp = C.lerp, span = C.span, hash = C.hash;

  // ---- static textures ----
  const grain = mk(256, 256);
  (function () {
    const g = grain.getContext('2d');
    for (let i = 0; i < 1400; i++) {
      const x = hash(i, 91) * 256, y = hash(i, 92) * 256, l = 4 + hash(i, 93) * 22, h = hash(i, 94) > 0.5;
      g.strokeStyle = hash(i, 95) > 0.5 ? 'rgba(90,40,10,0.07)' : 'rgba(255,240,200,0.09)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(h ? x + l : x + 0.8, h ? y + 0.8 : y + l); g.stroke();
    }
  })();
  const sg = mk(Math.ceil(W * 0.26) + 2, Math.ceil(H * 0.26) + 2), sgx = sg.getContext('2d');
  const SHRES = [0.09, 0.15, 0.26];            // far scrim: softest shadow, near scrim: sharpest

  // ---- per-frame state ----
  let F = null;
  const pt = (g, x, y) => { const m = g.getTransform(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; };

  // ---- path helpers ----
  function rr(g, x, y, w, h, r) {
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  const circ = (g, x, y, r) => { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); g.closePath(); };
  const dia = (g, x, y, r) => { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); };
  function poly(g, a) { g.moveTo(a[0], a[1]); for (let i = 2; i < a.length; i += 2) g.lineTo(a[i], a[i + 1]); g.closePath(); }
  // modes: 'm' main leather, 's' silhouette for soft shadows, 'h' solid haunt shade
  function skin(g, mode, tint, rule) {
    if (mode !== 'm') { g.fillStyle = mode === 'h' ? 'rgb(14,8,22)' : '#000'; g.fill(rule || 'evenodd'); return; }
    g.globalCompositeOperation = 'multiply'; g.fillStyle = rgb(tint); g.fill(rule || 'evenodd');
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(40,16,8,0.72)'; g.stroke();
    g.globalCompositeOperation = 'screen'; g.fillStyle = 'rgba(255,170,90,0.05)'; g.fill(rule || 'evenodd'); g.globalCompositeOperation = 'source-over'; // light leaking through the hide
  }
  function engrave(g, mode, fn) { if (mode !== 'm') return; g.beginPath(); fn(); g.lineWidth = 1; g.strokeStyle = 'rgba(70,26,10,0.5)'; g.stroke(); }
  function rivet(g, mode, x, y, r) {
    if (mode !== 'm') return; r = r || 3;
    g.beginPath(); circ(g, x, y, r); g.fillStyle = 'rgb(48,22,10)'; g.fill();
    g.beginPath(); circ(g, x - r * 0.3, y - r * 0.3, r * 0.4); g.fillStyle = 'rgba(255,210,140,0.85)'; g.fill();
  }
  function holes(g, kind, w, h, seed) {
    if (kind === 'lattice') { for (let cy = 12; cy < h - 8; cy += 15) for (let cx = 14; cx < w - 8; cx += 16) dia(g, cx + ((cy / 15) & 1 ? 8 : 0), cy, 4.4); }
    else if (kind === 'coin') { for (let cy = 14; cy < h - 8; cy += 20) for (let cx = 16; cx < w - 8; cx += 22) circ(g, cx, cy, Math.min(6, h * 0.16)); }
    else if (kind === 'brick') { if (hash(seed, 8) > 0.45) circ(g, w * 0.5, h * 0.5, 3.2); else dia(g, w * 0.5, h * 0.5, 4.5); }
    else if (kind === 'back') { dia(g, w * 0.3, h * 0.5, Math.min(5, h * 0.2)); dia(g, w * 0.7, h * 0.5, Math.min(5, h * 0.2)); }
  }
  // a rectangular leather tile that flips about its horizontal axis (flip 0..1 = 180 degrees)
  function tile(g, mode, w, h, flip, kind, tint, back, seed) {
    const c = Math.cos(Math.PI * flip), face = c >= 0, sy = Math.max(0.07, Math.abs(c));
    g.save(); g.translate(0, h / 2); g.scale(1, sy); g.translate(0, -h / 2);
    g.beginPath(); rr(g, 0, 0, w, h, Math.min(5, h / 4));
    if (mode !== 'h') holes(g, face ? kind : 'back', w, h, seed);
    skin(g, mode, face ? tint : back);
    engrave(g, mode, () => { g.moveTo(3, 3); g.lineTo(w - 3, 3); g.lineTo(w - 3, h - 3); g.lineTo(3, h - 3); g.closePath(); });
    if (kind !== 'brick') { rivet(g, mode, 7, h / 2, 2.6); rivet(g, mode, w - 7, h / 2, 2.6); }
    g.restore();
  }
  function addRod(id, x, y, gone) { if (F.mode === 'm') { F.att[id] = [x, y]; F.gone[id] = gone; } }
  function addLine(x1, y1, x2, y2, w) { if (F.mode === 'm') F.lines.push([x1, y1, x2, y2, w]); }

  // ---- far scrim ----
  function mountain(g, mode, base, amp, seed, tint, notch, cut) {
    const pts = [];
    for (let x = 90; x <= 1190; x += 40) {
      let y = base - amp * (0.5 + 0.5 * Math.sin(x * 0.0105 + seed)) - hash(x / 40, seed * 7) * 24;
      if (notch) { const k = Math.max(0, 1 - Math.abs(x - 660) / 110); y = lerp(y, 408, k * k * (3 - 2 * k)); }
      pts.push(x, y);
    }
    g.beginPath(); g.moveTo(90, 520); for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.lineTo(1190, 520); g.closePath();
    if (mode !== 'h') for (let i = 0; i < 7; i++) { const x = 160 + hash(i, seed * 3) * 900, y = base + 20 + hash(i, seed * 5) * 60; if (!notch || Math.abs(x - 660) > 130) { circ(g, x, y, 11 + hash(i, 4) * 8); circ(g, x, y, 4); } }
    skin(g, mode, tint);
    if (cut && mode === 'm') engrave(g, mode, () => { for (let i = 0; i < 9; i++) { const x = 130 + i * 120; g.moveTo(x, base + 90); g.quadraticCurveTo(x + 30, base + 60, x + 70, base + 100); } });
  }
  function drawL0(g, mode) {
    const td = F.td, tm = F.time, sk = C.sky(td);
    // sun / moon disc
    g.beginPath(); circ(g, 900, 250, 62); if (mode !== 'h') { for (let a = 0; a < 12; a++) circ(g, 900 + Math.cos(a * TAU / 12) * 40, 250 + Math.sin(a * TAU / 12) * 40, 5.5); circ(g, 900, 250, 14); }
    skin(g, mode, mixc([236, 70, 36], [250, 238, 190], sk));
    // clouds
    for (let i = 0; i < 3; i++) {
      const x = 240 + i * 360 + ((tm * (5 + i * 2)) % 1300) * 0.0 + Math.sin(tm * 0.1 + i * 2) * 40, y = 130 + i * 38;
      g.beginPath(); g.moveTo(x - 100, y + 22); for (let k = 0; k < 5; k++) { const cx = x - 76 + k * 38, r = 22 + (k === 2 ? 12 : 0) - (k & 1) * 4; g.quadraticCurveTo(cx - 6, y - r * 1.5, cx + 19, y - r * 0.9); }
      g.quadraticCurveTo(x + 120, y + 4, x + 100, y + 22); g.closePath(); if (mode !== 'h') { circ(g, x - 30, y + 6, 4); circ(g, x + 20, y + 4, 4); circ(g, x + 60, y + 9, 3.4); }
      skin(g, mode, mixc([238, 128, 84], [160, 205, 190], sk));
    }
    mountain(g, mode, 360, 150, 1.0, mixc([196, 138, 150], [96, 150, 158], sk), false, true);
    mountain(g, mode, 408, 90, 2.6, mixc([168, 100, 100], [70, 124, 106], sk), true, true);
    // the shut pass: a leather ridge hinged at its foot, folds down as the pass opens
    const open = C.ridge(td);
    g.save(); g.translate(660, 408); g.scale(1, Math.max(0.02, 1 - open)); g.translate(-660, -408);
    g.beginPath(); poly(g, [548, 410, 590, 360, 622, 340, 660, 306, 700, 338, 734, 352, 772, 410]);
    if (mode !== 'h') { for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) dia(g, 622 + c * 24 + r * 12, 372 + r * 11, 5); }
    skin(g, mode, mixc([104, 54, 66], [64, 100, 90], open)); rivet(g, mode, 600, 396, 2.6); rivet(g, mode, 720, 396, 2.6);
    g.restore();
    // far pines on the ridge
    for (let i = 0; i < 4; i++) { const x = [300, 392, 928, 1020][i], gy = [392, 396, 392, 396][i]; drawTree(g, mode, x, gy, 76, 0.5, C.tree(i, td), i + 10, true); }
  }

  // ---- trees (grow from the gate position, branches unfold on joints) ----
  function leaf(g, mode, len, seed) {
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.55, -len * 0.28, len, 0); g.quadraticCurveTo(len * 0.55, len * 0.28, 0, 0); g.closePath();
    if (mode !== 'h') { g.moveTo(len * 0.25, 0); g.quadraticCurveTo(len * 0.5, -2.2, len * 0.7, 0); g.quadraticCurveTo(len * 0.5, 2.2, len * 0.25, 0); g.closePath(); }
    skin(g, mode, [78 + hash(seed, 21) * 60, 140 + hash(seed, 22) * 40, 56 + hash(seed, 23) * 40]);
  }
  function cluster(g, mode, size, seed, k) {
    if (k <= 0.01) return; g.save(); g.scale(k, k);
    for (let i = 0; i < 7; i++) { g.save(); g.rotate(-Math.PI / 2 + (i - 3) * 0.55 + Math.sin(F.time * 0.9 + i + seed) * 0.03); leaf(g, mode, size * (0.8 + 0.4 * hash(i + seed, 31)), seed * 7 + i); g.restore(); }
    g.restore();
  }
  function drawTree(g, mode, x, gy, Ht, s, st, seed, small) {
    const hh = Ht * st.grow; if (hh < 3) return;
    g.save(); g.translate(x, gy);
    const bend = (hash(seed, 41) - 0.5) * 26 * s;
    g.beginPath(); g.moveTo(-11 * s, 0); g.quadraticCurveTo(-8 * s + bend, -hh * 0.5, -3 * s + bend * 0.6, -hh); g.lineTo(3 * s + bend * 0.6, -hh); g.quadraticCurveTo(8 * s + bend, -hh * 0.5, 11 * s, 0); g.closePath();
    if (mode !== 'h' && !small) for (let i = 0; i < 4; i++) { const yy = -hh * (0.15 + i * 0.2); if (hh > 60) { g.moveTo(-1 * s, yy); g.quadraticCurveTo(2.5 * s, yy - 7, -1 * s, yy - 17); g.quadraticCurveTo(-3.5 * s, yy - 7, -1 * s, yy); } }
    skin(g, mode, mixc([138, 74, 36], [112, 66, 38], hash(seed, 2)));
    for (let b = 0; b < 3; b++) {
      const fr = [0.4, 0.6, 0.78][b], side = (b + seed) & 1 ? 1 : -1, u = span(st.unfold, b * 0.18, 0.5 + b * 0.2);
      if (hh * fr < 8) continue;
      const ang = side * lerp(2.9, 1.0 + b * 0.12, u), L = (small ? 38 : 76) * s * (0.4 + 0.6 * st.grow);
      g.save(); g.translate(bend * fr * 0.6, -hh * fr); g.rotate(ang);
      g.beginPath(); poly(g, [-3 * s, 0, -1.5 * s, -L, 1.5 * s, -L, 3 * s, 0]); skin(g, mode, [118, 62, 30]);
      g.translate(0, -L); g.rotate(-ang * 0.55); cluster(g, mode, (small ? 26 : 46) * s, seed + b, u); rivet(g, mode, 0, L, 2); g.restore();
    }
    g.save(); g.translate(bend * 0.6, -hh); cluster(g, mode, (small ? 34 : 62) * s, seed + 9, st.unfold); g.restore();
    rivet(g, mode, 0, -hh * 0.22, 2.4);
    g.restore();
  }

  // ---- middle scrim: road, trees, gate ----
  const roadPt = (u) => ({ x: 640 + Math.sin(u * 5.2 + 0.4) * (1 - u * 0.6) * 95, y: 578 - 200 * u, w: lerp(220, 26, Math.pow(u, 0.85)) });
  function drawRoad(g, mode) {
    for (let j = 0; j < 8; j++) {
      const k = C.roadSeg(j, F.td); if (k < 0.02) continue;
      const a = roadPt(j / 8), b0 = roadPt((j + 1) / 8), b = { x: lerp(a.x, b0.x, k), y: lerp(a.y, b0.y, k), w: lerp(a.w, b0.w, k) };
      g.beginPath(); poly(g, [a.x - a.w / 2, a.y, a.x + a.w / 2, a.y, b.x + b.w / 2, b.y, b.x - b.w / 2, b.y]);
      if (mode !== 'h') {
        for (let p = 0; p < 4; p++) { const f = 0.15 + hash(j * 4 + p, 51) * 0.7, px = lerp(a.x - a.w * 0.35, a.x + a.w * 0.35, hash(j * 4 + p, 52)), py = lerp(a.y, b.y, f); circ(g, lerp(px, b.x, f * 0.3), py, Math.max(1.5, a.w * 0.025 * (1 + hash(p, 9)))); }
        const f1 = 0.2, f2 = 0.8; poly(g, [lerp(a.x, b.x, f1) - a.w * 0.12, lerp(a.y, b.y, f1), lerp(a.x, b.x, f1) - a.w * 0.1 + 2, lerp(a.y, b.y, f1), lerp(a.x, b.x, f2) - b.w * 0.1 + 2, lerp(a.y, b.y, f2), lerp(a.x, b.x, f2) - b.w * 0.12, lerp(a.y, b.y, f2)]);
      }
      skin(g, mode, mixc([240, 204, 128], [226, 190, 118], hash(j, 3)));
      rivet(g, mode, a.x - a.w * 0.44, a.y - 4, 2.2); rivet(g, mode, a.x + a.w * 0.44, a.y - 4, 2.2);
    }
  }
  const TREES = [[470, 478, 190, 0.85], [560, 484, 250, 1.05], [720, 484, 282, 1.15], [830, 478, 205, 0.9], [395, 474, 150, 0.7]];
  function drawGate(g, mode) {
    const td = F.td, tm = F.time;
    // ground
    g.beginPath(); g.moveTo(WIN.x - 20, 590); g.lineTo(WIN.x - 20, GROUND + 6);
    for (let x = WIN.x; x <= WIN.x + WIN.w + 20; x += 40) g.lineTo(x, GROUND + Math.sin(x * 0.02) * 5 + (hash(x, 3) - 0.5) * 6);
    g.lineTo(WIN.x + WIN.w + 20, 590); g.closePath();
    if (mode !== 'h') for (let i = 0; i < 18; i++) { const x = 150 + i * 58 + hash(i, 6) * 24, y = GROUND + 20 + hash(i, 7) * 40; poly(g, [x, y, x + 3, y - 14, x + 6, y]); poly(g, [x + 10, y, x + 13, y - 10, x + 16, y]); }
    skin(g, mode, mixc([170, 112, 56], [110, 140, 66], C.sky(td)));
    drawRoad(g, mode);
    TREES.forEach((t, i) => drawTree(g, mode, t[0], t[1], t[2], t[3], C.tree(i, td), i, false));
    // brick wings: individual leather tiles, flipped then hauled up on cords
    for (let i = 0; i < 60; i++) {
      const wing = i < 30 ? 0 : 1, j = i % 30, row = Math.floor(j / 10), col = j % 10, b = C.brick(i, td);
      if (b.away > 0.995) continue;
      const bx = wing ? 784 + col * 37 : 130 + col * 37, by = GROUND - 38 * (row + 1), hh = hash(i, 4);
      const ox = (hh - 0.5) * 70 * b.away, oy = -b.away * (560 + hash(i, 6) * 160), rot = (hh - 0.5) * 2.4 * b.away;
      g.save(); g.translate(bx + 18 + ox, by + 19 + oy); g.rotate(rot); g.translate(-18, -19);
      tile(g, mode, 35, 36, b.flip, 'brick', mixc([196, 104, 62], [176, 116, 70], hh), [88, 52, 48], i);
      if (b.flip > 0.03 && b.away < 0.97) { const p = pt(g, 17, 0); addLine(p[0], WIN.y, p[0], p[1], 1.1); }
      g.restore();
    }
    // posts (clipped at the ground so they sink into it)
    g.save(); g.beginPath(); g.rect(0, 0, W, GROUND); g.clip();
    for (let i = 0; i < 2; i++) {
      const p = C.post(i, td); if (p.sink > 0.995) continue;
      g.save(); g.translate(i ? 765 : 515, GROUND + p.sink * 270); g.rotate((i ? 1 : -1) * p.lean * 0.55);
      g.beginPath(); rr(g, -15, -222, 30, 222, 3); rr(g, -23, -242, 46, 24, 4);
      if (mode !== 'h') { for (let k = 0; k < 4; k++) rr(g, -3, -200 + k * 48, 6, 30, 3); circ(g, 0, -230, 5); }
      skin(g, mode, [178, 50, 32]); engrave(g, mode, () => { g.moveTo(-9, -216); g.lineTo(-9, -6); g.moveTo(9, -216); g.lineTo(9, -6); });
      rivet(g, mode, 0, -150, 3); rivet(g, mode, 0, -70, 3); g.restore();
    }
    g.restore();
    // leaves: three jointed boards each, hinged on the posts
    for (let i = 0; i < 6; i++) {
      const left = i < 3, k = i % 3, b = C.board(i, td), dir = left ? 1 : -1; if (b.away > 0.995) continue;
      const sx = Math.max(0.12, Math.cos(b.swing * 1.45)), y0 = 250 + k * 74;
      const ox = -dir * b.away * 580, oy = -Math.sin(b.away * Math.PI) * 60 + b.away * 40 * (k - 1), rot = -dir * b.away * (0.25 + 0.16 * k);
      g.save(); g.translate((left ? 530 : 750) + ox, y0 + oy); g.translate(0, 37); g.rotate(rot); g.translate(0, -37); g.scale(dir * sx, 1);
      tile(g, mode, 110, 72, b.flip, k === 1 ? 'coin' : 'lattice', k === 1 ? [150, 44, 28] : [196, 84, 36], [112, 58, 40], i);
      if (mode === 'm') { rivet(g, mode, 8, 36, 3); }
      if (k === 1) addRod(left ? 'LL' : 'RL', ...pt(g, 55, 36), b.away);
      else if (b.swing > 0.02 && b.away < 0.97) { const p = pt(g, 55, 36); addLine(p[0], p[1], left ? 270 : 980, 706, 2); }
      g.restore();
    }
    // lintel with the three gate lamps
    const L = C.lintel(td);
    if (L.rise < 0.995) {
      g.save(); g.translate(640 + (L.tilt * -30), 258 - L.rise * 520 + L.tilt * 14); g.rotate(-L.tilt * 0.42 - L.rise * 0.1);
      g.beginPath(); poly(g, [-240, -6, -192, -12, -122, -60, -42, -86, 0, -92, 42, -86, 122, -60, 192, -12, 240, -6, 200, 14, -200, 14]);
      if (mode !== 'h') { for (let k = -5; k <= 5; k++) circ(g, k * 34, -38 + Math.abs(k) * 4, 7); }
      skin(g, mode, [160, 40, 28]); engrave(g, mode, () => { g.moveTo(-200, 8); g.lineTo(200, 8); });
      g.beginPath(); rr(g, -175, 14, 350, 28, 3); if (mode !== 'h') for (let k = 0; k < 11; k++) dia(g, -150 + k * 30, 28, 6);
      skin(g, mode, [156, 68, 36]); rivet(g, mode, -165, 28, 3); rivet(g, mode, 165, 28, 3);
      addRod('LT', ...pt(g, 0, 40), L.rise);
      for (let i = 0; i < 3; i++) {
        const lp = C.lamp(i, td), lx = (i - 1) * 96, ly = 42 + 50 - lp.pull * 56, sc = 1 - lp.pull * 0.5;
        g.save(); g.translate(lx, ly); g.scale(sc, sc);
        g.beginPath(); rr(g, -16, 0, 32, 42, 12); if (mode !== 'h') { circ(g, 0, 14, 5); rr(g, -8, 26, 16, 5, 2); }
        skin(g, mode, [230, 58, 34]); engrave(g, mode, () => { g.moveTo(-16, 21); g.lineTo(16, 21); });
        if (mode === 'm') { g.beginPath(); g.moveTo(0, -ly + 42); g.lineTo(0, 0); g.lineWidth = 1; g.strokeStyle = 'rgba(40,16,8,0.7)'; g.stroke(); F.lights.push([...pt(g, 0, 20), 120 * lp.glow * (0.94 + 0.06 * Math.sin(tm * 9 + i * 2)), 0.42 * lp.glow]); }
        g.restore();
      }
      g.restore();
    }
  }

  // ---- keeper puppet and the shade that outlives it ----
  function limb(g, x0, y0, ang, len, w0, w1) {
    const dx = Math.sin(ang), dy = Math.cos(ang), x1 = x0 + dx * len, y1 = y0 + dy * len, nx = dy, ny = -dx;
    g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.closePath();
    return [x1, y1];
  }
  const KT = [210, 128, 62], KD = [150, 78, 44];
  // feet at (0,0), height about 200. pose: ph walk phase, arm 0..1 lantern lift, slack 0..1 limbs gone limp, reach = [x,y] tip for the far arm or null
  function keeperFig(g, mode, pose) {
    const sl = pose.slack, sw = 1 - sl;
    const leg = (k) => { const ph = pose.ph + k * Math.PI, th = Math.sin(ph) * 0.5 * sw + sl * (k ? 0.5 : -0.35), kn = Math.max(0, Math.sin(ph - 1)) * 0.7 * sw + sl * 0.6; g.beginPath(); const e = limb(g, k ? 7 : -7, -72, th, 36, 7, 5); const f = limb(g, e[0], e[1], th - kn, 36, 5, 4); circ(g, f[0] + 5, f[1] - 1, 4.5); skin(g, mode, KD); rivet(g, mode, e[0], e[1], 2.2); };
    leg(1); leg(0);
    // robe with hem curve, sash and wave cutouts
    g.beginPath(); g.moveTo(-17, -136); g.lineTo(17, -136); g.lineTo(26, -52); g.quadraticCurveTo(0, -44, -26, -52); g.closePath();
    if (mode !== 'h') { for (let i = 0; i < 5; i++) circ(g, -16 + i * 8, -66 + (i & 1) * 6, 2.8); for (let i = 0; i < 4; i++) dia(g, -12 + i * 8, -112, 3); }
    skin(g, mode, [208, 62, 38]);
    engrave(g, mode, () => { g.moveTo(-18, -100); g.lineTo(18, -100); g.moveTo(0, -136); g.lineTo(0, -48); });
    // far arm
    const fa = pose.reach; g.beginPath();
    if (fa) { const sx = -10, sy = -128, tx = lerp(sx, fa[0], 0.97), ty = lerp(sy + 40, fa[1], 0.97); const mx = (sx + tx) / 2 - 18, my = (sy + ty) / 2; limb(g, sx, sy, Math.atan2(mx - sx, my - sy), Math.hypot(mx - sx, my - sy), 5, 4); limb(g, mx, my, Math.atan2(tx - mx, ty - my), Math.hypot(tx - mx, ty - my), 4, 1.6); }
    else { const e = limb(g, -10, -128, -0.3 * Math.sin(pose.ph) * sw + sl * -0.5, 32, 5, 4); limb(g, e[0], e[1], -0.2 * Math.sin(pose.ph) * sw - sl * 0.4, 30, 4, 3.4); }
    skin(g, mode, KD);
    // head and bamboo hat
    g.beginPath(); g.ellipse(0, -152, 12, 15, 0, 0, TAU); if (mode !== 'h') circ(g, 5, -154, 1.6); skin(g, mode, [236, 168, 104]);
    g.beginPath(); g.moveTo(-40, -162); g.quadraticCurveTo(-18, -170, 0, -200); g.quadraticCurveTo(18, -170, 40, -162); g.quadraticCurveTo(0, -156, -40, -162); g.closePath();
    if (mode !== 'h') { dia(g, 0, -176, 3.4); dia(g, -12, -166, 2.6); dia(g, 12, -166, 2.6); } skin(g, mode, [180, 98, 46]); rivet(g, mode, 0, -162, 2.2);
    // near arm holds the lantern
    const ua = lerp(0.45 + 0.18 * Math.sin(pose.ph), 2.7, pose.arm) + sl * 0.5, fb = lerp(1.45, 3.0, pose.arm) - sl * 0.4;
    g.beginPath(); const e = limb(g, 10, -128, ua, 33, 5.4, 4.4); const hnd = limb(g, e[0], e[1], fb, 30, 4.4, 3.4); skin(g, mode, KT); rivet(g, mode, 10, -128, 2.4); rivet(g, mode, e[0], e[1], 2.2);
    const lx = hnd[0] + Math.sin(0.2) * 6, ly = hnd[1] + 16;
    g.beginPath(); g.moveTo(hnd[0], hnd[1]); g.lineTo(lx, ly); g.lineWidth = 1.2; if (mode === 'm') { g.strokeStyle = 'rgba(40,16,8,0.8)'; g.stroke(); } else { g.strokeStyle = mode === 'h' ? 'rgb(14,8,22)' : '#000'; g.stroke(); }
    g.beginPath(); rr(g, lx - 10, ly, 20, 26, 8); if (mode !== 'h') circ(g, lx, ly + 12, 4); skin(g, mode, [236, 64, 34]);
    if (mode === 'm' || mode === 'h') pose.lantern = pt(g, lx, ly + 13);
    if (pose.torso !== undefined && mode === 'm') pose.torso = pt(g, 0, -98);
  }
  function keeperPlace(td, tm) {
    const k = C.keeper(td), uf = 0.5 + 0.46 * Math.sin(tm * 0.32 - 0.6), face = Math.cos(tm * 0.32 - 0.6) >= 0 ? 1 : -1;
    const fx = lerp(290, 1000, uf), r = roadPt(k.road), rs = lerp(1, 0.34, k.road);
    let x = lerp(fx, r.x, k.mix), y = lerp(548, r.y + 4, k.mix), s = lerp(1, rs, k.mix);
    x = lerp(x, 600, k.pull); y = lerp(y, 770, k.pull); s = lerp(s, 1, k.pull * 0.8);
    return { x, y, s, face: k.mix > 0.5 ? 1 : face, ph: tm * 3.4 + x * 0.045, slack: k.pull, rot: k.pull * 0.9 };
  }
  function drawL2(g, mode) {
    const td = F.td, tm = F.time;
    // front hills with grass blades
    for (let side = 0; side < 2; side++) {
      g.beginPath(); const x0 = side ? 880 : 110, x1 = side ? 1170 : 400;
      g.moveTo(x0, 590); g.lineTo(x0, 548); for (let i = 0; i <= 8; i++) { const x = lerp(x0, x1, i / 8); g.lineTo(x, 540 + Math.sin(i * 1.3 + side * 2) * 10 + (side ? i : 8 - i) * 2); } g.lineTo(x1, 590); g.closePath();
      if (mode !== 'h') for (let i = 0; i < 9; i++) { const x = lerp(x0 + 10, x1 - 10, i / 9), y = 572; poly(g, [x, y, x + 2, y - 16, x + 5, y]); }
      skin(g, mode, mixc([110, 62, 36], [78, 84, 46], C.sky(td)));
    }
    // slabs of the old patrol path, flipped and dragged out through the stage lip
    for (let i = 0; i < 10; i++) {
      const s = C.slab(i, td); if (s.away > 0.995) continue;
      g.save(); g.translate(250 + i * 78 + 37, 534 + 17 + s.away * 260); g.transform(1, 0, -0.28, 1, 0, 0); g.translate(-37, -17);
      tile(g, mode, 74, 34, s.flip, 'coin', [150, 110, 64], [70, 48, 40], i);
      if (s.flip > 0.03 && s.away < 0.97) { const p = pt(g, 37, 17); addLine(p[0], p[1], 250 + i * 78 + 37, 706, 1.4); }
      g.restore();
    }
    if (C.keeperAlive(td)) {
      const p = keeperPlace(td, tm), pose = { ph: p.ph, arm: 0, slack: p.slack, reach: null, torso: 0 };
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot * 0.5); g.scale(p.s * p.face, p.s);
      keeperFig(g, mode, pose); g.restore();
      if (mode === 'm') { const a = pose.torso || [p.x, p.y - 90 * p.s]; addRod('K', a[0], a[1], p.slack); F.keeper = { lantern: pose.lantern, s: p.s, y: p.y, cone: C.cone(td) * (1 - p.slack) }; }
    }
  }

  // ---- composition ----
  const LAYERS = [drawL0, drawGate, drawL2];
  const PAR = [0.16, 0.09, 0.04];
  function paper(g, i) {
    const td = F.td, sk = C.sky(td);
    if (i === 0) {
      const gr = g.createLinearGradient(0, WIN.y, 0, GROUND + 60);
      gr.addColorStop(0, rgb(mixc([226, 112, 56], [138, 178, 160], sk))); gr.addColorStop(0.55, rgb(mixc([255, 190, 96], [240, 222, 150], sk))); gr.addColorStop(1, rgb(mixc([255, 226, 140], [250, 236, 170], sk)));
      g.fillStyle = gr; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    } else { g.fillStyle = 'rgba(255,214,150,0.07)'; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h); }
    g.save(); g.globalAlpha = 0.9; g.fillStyle = g.createPattern(grain, 'repeat'); g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h); g.restore();
    if (i === 0) { // backlight hotspot on the paper
      const hg = g.createRadialGradient(F.LX, 330, 10, F.LX, 330, 620); hg.addColorStop(0, 'rgba(255,246,200,0.7)'); hg.addColorStop(0.3, 'rgba(255,214,130,0.3)'); hg.addColorStop(1, 'rgba(255,170,70,0)');
      g.fillStyle = hg; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    }
  }
  function applyLayer(g, i, ox, oy) { g.translate(640 + ox - (F.LX - 640) * PAR[i], 330 + oy); g.translate(-640, -330); }
  function glow(g, x, y, r, a, col) {
    if (r < 2 || a <= 0.005) return; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + (col || '255,196,96') + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + (col || '255,196,96') + ',0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalCompositeOperation = 'source-over';
  }
  function shadeFigure(g, mode, hv) {
    const s = 1.2, sx = 600, sy = 552, reachTipX = 600 + 26 * hv.tug, reachTipY = PARK_Y - 40 * Math.abs(hv.tug);
    const pose = { ph: Math.sin(F.time * 0.7) * 0.3, arm: hv.arm, slack: 0, torso: undefined, reach: hv.arm > 0.05 ? [(reachTipX - sx) / s, (lerp(-60, reachTipY - sy, hv.arm)) / s] : null };
    if (pose.reach) pose.reach = [lerp(-14, (reachTipX - sx) / s, hv.arm), lerp(-100, (reachTipY - sy) / s, hv.arm)];
    g.save(); g.translate(sx, sy); g.scale(s, s); keeperFig(g, mode, pose); g.restore();
    return pose;
  }

  function draw(g, S) {
    const td = S.td, hv = S.haunt;
    F = { td, time: S.time, LX: 640 - 270 * S.lightW + 340 * hv.lightMove + (S.reduced ? 0 : Math.sin(S.time * 3.1) * 3), lights: [], att: {}, gone: {}, lines: [], mode: 'm', keeper: null };
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1a0b05'; g.fillRect(0, 0, W, H);
    g.save(); g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
    for (let i = 0; i < 3; i++) {
      F.mode = 'm'; paper(g, i);
      // soft cast shadow of this layer on its scrim, resolution (blur) set by depth
      const r = SHRES[i]; sgx.setTransform(1, 0, 0, 1, 0, 0); sgx.clearRect(0, 0, sg.width, sg.height); sgx.setTransform(r, 0, 0, r, 0, 0);
      F.mode = 's'; sgx.save(); applyLayer(sgx, i, -(F.LX - 640) * [0.1, 0.07, 0.05][i] + [8, 12, 16][i], [16, 12, 9][i]); LAYERS[i](sgx, 's'); sgx.restore();
      g.save(); g.globalAlpha = [0.3, 0.34, 0.4][i]; g.imageSmoothingEnabled = true; g.drawImage(sg, 0, 0, W * r, H * r, 0, 0, W, H); g.restore();
      F.mode = 'm'; g.save(); applyLayer(g, i, 0, 0); LAYERS[i](g, 'm'); g.restore();
      if (i === 1) { F.lights.forEach((l) => glow(g, l[0], l[1], l[2], l[3])); }
    }
    // keeper lantern cone on the near scrim
    if (F.keeper && F.keeper.lantern && F.keeper.cone > 0.01) {
      const k = F.keeper, lx = k.lantern[0] - (F.LX - 640) * PAR[2], ly = k.lantern[1], c = k.cone, s = Math.max(0.5, k.s);
      glow(g, lx, ly, 150 * c * s + 30, 0.6 * c); glow(g, lx, Math.min(556, ly + 60), 170 * c * s, 0.28 * c);
      g.save(); g.globalCompositeOperation = 'lighter'; const bg = g.createLinearGradient(0, ly, 0, 560); bg.addColorStop(0, 'rgba(255,200,110,' + (0.3 * c) + ')'); bg.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = bg; g.beginPath(); g.moveTo(lx - 5, ly); g.lineTo(lx + 120 * c * s, 560); g.lineTo(lx - 120 * c * s, 560); g.closePath(); g.fill(); g.restore();
    }
    // the shade: in screen space, parallax 0, so the moving lamp does not carry it. No rod, no keeper.
    let shadePose = null;
    if (hv.shade > 0.01) {
      F.mode = 'h'; const r = 0.26; sgx.setTransform(1, 0, 0, 1, 0, 0); sgx.clearRect(0, 0, sg.width, sg.height); sgx.setTransform(r, 0, 0, r, 0, 0);
      shadeFigure(sgx, 's', hv);
      g.save(); g.globalAlpha = 0.55 * hv.shade; g.drawImage(sg, 0, 0, W * r, H * r, 0, 0, W, H); g.restore();
      g.save(); g.globalAlpha = 0.72 * hv.shade; shadePose = shadeFigure(g, 'h', hv); g.restore();
      const lan = shadePose.lantern; if (lan) { glow(g, lan[0], lan[1], 170 * hv.shade, 0.7 * hv.shade); glow(g, lan[0], lan[1] + 70, 160 * hv.shade, 0.22 * hv.shade); }
      F.mode = 'm';
    }
    // bloom and vignette
    glow(g, F.LX, 330, 520, 0.06, '255,236,190');
    const vg = g.createRadialGradient(640, 320, 220, 640, 320, 760); vg.addColorStop(0, 'rgba(40,12,0,0)'); vg.addColorStop(1, 'rgba(40,12,0,0.5)');
    g.fillStyle = vg; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    g.restore();
    frame(g, S);
    rods(g, S, hv);
    return { LX: F.LX, shade: !!shadePose };
  }

  function frame(g, S) {
    // proscenium
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(WIN.x, WIN.y, WIN.w, WIN.h);
    const wood = g.createLinearGradient(0, 0, W, 0); wood.addColorStop(0, '#2c130a'); wood.addColorStop(0.5, '#3a1a0d'); wood.addColorStop(1, '#2a1209');
    g.fillStyle = wood; g.fill('evenodd'); g.restore();
    g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip('evenodd');
    g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 70; i++) { const x = hash(i, 71) * W; g.lineWidth = 1 + hash(i, 72) * 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (hash(i, 73) - 0.5) * 30, H); g.stroke(); }
    glow(g, F.LX, 330, 700, 0.1, '255,180,90'); // lamp spill on the lacquer
    // red lacquer pillars with gilt studs
    [[20, 80], [W - 100, 80]].forEach((p) => { const gr = g.createLinearGradient(p[0], 0, p[0] + p[1], 0); gr.addColorStop(0, '#5a110c'); gr.addColorStop(0.5, '#9c2216'); gr.addColorStop(1, '#4a0e0a'); g.fillStyle = gr; g.fillRect(p[0], 40, p[1], 560);
      for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(p[0] + p[1] / 2, 80 + k * 60, 4, 0, TAU); g.fillStyle = '#d8a850'; g.fill(); } });
    g.restore();
    // inner bevel
    g.strokeStyle = '#8a5a26'; g.lineWidth = 5; g.strokeRect(WIN.x - 3, WIN.y - 3, WIN.w + 6, WIN.h + 6); g.strokeStyle = 'rgba(255,200,120,0.4)'; g.lineWidth = 1.5; g.strokeRect(WIN.x + 1.5, WIN.y + 1.5, WIN.w - 3, WIN.h - 3);
    // valance: scalloped red leather with cutouts, swaying slightly
    g.save(); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 40);
    for (let x = W; x > 0; x -= 80) { g.quadraticCurveTo(x - 40, 84 + (S.reduced ? 0 : Math.sin(S.time * 1.1 + x * 0.02) * 2), x - 80, 40); }
    g.closePath(); const vgr = g.createLinearGradient(0, 0, 0, 80); vgr.addColorStop(0, '#5a0f0a'); vgr.addColorStop(1, '#a8281a'); g.fillStyle = vgr; g.fill(); g.strokeStyle = '#d8a850'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(255,210,140,0.35)'; for (let x = 40; x < W; x += 80) { g.beginPath(); g.arc(x, 44, 7, 0, TAU); g.fill(); g.beginPath(); g.arc(x, 44, 2.5, 0, TAU); g.fillStyle = '#d8a850'; g.fill(); g.fillStyle = 'rgba(255,210,140,0.35)'; }
    g.restore();
    // lip: dark stage edge with rod sockets
    const lip = g.createLinearGradient(0, 576, 0, H); lip.addColorStop(0, '#4a2412'); lip.addColorStop(0.08, '#2a1209'); lip.addColorStop(1, '#170a05');
    g.fillStyle = lip; g.fillRect(0, 576, W, H - 576);
    g.fillStyle = 'rgba(255,190,110,0.55)'; g.fillRect(WIN.x - 6, 574, WIN.w + 12, 3);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (let i = 0; i < 30; i++) { const y = 586 + hash(i, 74) * 130; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + (hash(i, 75) - 0.5) * 6); g.stroke(); }
    Object.keys(SLOTS).forEach((k) => { g.beginPath(); g.ellipse(SLOTS[k], 704, 15, 6, 0, 0, TAU); g.fillStyle = '#0a0503'; g.fill(); g.strokeStyle = '#8a5a26'; g.lineWidth = 1.5; g.stroke(); });
  }

  function rodLine(g, x1, y1, x2, y2, w) {
    g.lineCap = 'round'; g.strokeStyle = 'rgb(34,16,8)'; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = 'rgba(214,150,84,0.5)'; g.lineWidth = Math.max(0.8, w * 0.28); g.beginPath(); g.moveTo(x1 - 0.8, y1); g.lineTo(x2 - 0.8, y2); g.stroke();
  }
  function rods(g, S, hv) {
    F.lines.forEach((l) => rodLine(g, l[0], l[1], l[2], l[3], l[4]));
    const out = {};
    Object.keys(SLOTS).forEach((id) => {
      const sx = SLOTS[id], park = [sx + (sx < 640 ? 14 : -14), PARK_Y]; let tip = park;
      if (F.att[id]) {
        const a = F.att[id], gone = span(F.gone[id], 0.55, 1), ax = Math.min(WIN.x + WIN.w - 20, Math.max(WIN.x + 20, a[0])), ay = Math.min(570, Math.max(WIN.y + 20, a[1]));
        tip = [lerp(ax, park[0], gone), lerp(ay, park[1], gone)];
      }
      if (id === 'K' && hv.shade > 0.5) tip = [park[0] + 26 * hv.tug - 14, PARK_Y - 40 * Math.abs(hv.tug)]; // the empty keeper rod is pulled from the scrim
      out[id] = tip;
      rodLine(g, sx, 706, tip[0], tip[1], 3.6);
      g.beginPath(); g.arc(sx, 706, 8, 0, TAU); g.fillStyle = '#5a3016'; g.fill(); g.strokeStyle = '#1a0b05'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.arc(tip[0], tip[1], 3.4, 0, TAU); g.fillStyle = '#2a1208'; g.fill();
    });
    F.rodTips = out;
  }

  return { W, H, WIN, mk, draw, rodTips: () => (F && F.rodTips) || null };
})();
