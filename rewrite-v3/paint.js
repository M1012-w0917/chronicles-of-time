// V3 paint: canvas 2D drawing helpers (brush sprites, xuan paper, the old city, mist, seal, the lone figure).
// Everything is procedural. World coordinates are 1600x900; callers set the transform.
(function (root) {
  'use strict';
  const C = root.V3Core;
  const INK = '34,31,28';
  const PAPER = '233,224,200';
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---- brush sprites: 0 soft wash dab, 1 firm dab with a slightly ragged edge ----
  let sprites = null;
  function makeSprites() {
    if (sprites) return sprites;
    const soft = mk(64, 64), sc = soft.getContext('2d');
    let g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + INK + ',1)'); g.addColorStop(0.35, 'rgba(' + INK + ',0.55)'); g.addColorStop(0.7, 'rgba(' + INK + ',0.14)'); g.addColorStop(1, 'rgba(' + INK + ',0)');
    sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
    const hard = mk(32, 32), hc = hard.getContext('2d');
    g = hc.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(' + INK + ',1)'); g.addColorStop(0.72, 'rgba(' + INK + ',0.92)'); g.addColorStop(1, 'rgba(' + INK + ',0)');
    hc.fillStyle = g; hc.fillRect(0, 0, 32, 32);
    const r = C.rng(5);
    hc.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) { hc.fillStyle = 'rgba(0,0,0,' + (0.3 + r() * 0.5) + ')'; const a = r() * 6.283; hc.beginPath(); hc.arc(16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, 1 + r() * 2.2, 0, 6.283); hc.fill(); }
    sprites = [soft, hard];
    return sprites;
  }
  function drawStamps(ctx, list, from, to) {
    const sp = makeSprites();
    for (let i = from || 0, n = to == null ? list.length : to; i < n; i++) {
      const s = list[i];
      if (s.r < 0.45) continue;
      ctx.globalAlpha = s.a;
      ctx.drawImage(sp[s.k], s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
  }
  const line = (ctx, pts, o, rnd) => drawStamps(ctx, C.stroke(pts, o, rnd));

  // ---- xuan paper: warm base with cloudy mottling, plus a separate fibre layer drawn over the ink ----
  function paintPaper(paper, fibre, seed) {
    const W = paper.width, H = paper.height, r = C.rng(seed || 3), ctx = paper.getContext('2d');
    ctx.fillStyle = 'rgb(' + PAPER + ')'; ctx.fillRect(0, 0, W, H);
    const gw = Math.ceil(W / 10), gh = Math.ceil(H / 10), low = mk(gw, gh), lc = low.getContext('2d'), id = lc.createImageData(gw, gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const n = C.fbm(x / 9, y / 9, 7, 4), k = (y * gw + x) * 4;
      id.data[k] = 120; id.data[k + 1] = 90; id.data[k + 2] = 40; id.data[k + 3] = Math.max(0, (n - 0.35)) * 90;
    }
    lc.putImageData(id, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.drawImage(low, 0, 0, W, H);
    const fc = fibre.getContext('2d');
    fc.clearRect(0, 0, W, H);
    for (let i = 0; i < W * H / 900; i++) { // fibres
      const x = r() * W, y = r() * H, a = r() * 6.283, l = 6 + r() * 22, dark = r() < 0.45;
      fc.strokeStyle = dark ? 'rgba(90,70,40,' + (0.04 + r() * 0.07) + ')' : 'rgba(255,250,235,' + (0.1 + r() * 0.2) + ')';
      fc.lineWidth = 0.5 + r() * 0.8;
      fc.beginPath(); fc.moveTo(x, y); fc.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); fc.stroke();
    }
    for (let i = 0; i < W * H / 9000; i++) { fc.fillStyle = 'rgba(70,50,30,' + (0.05 + r() * 0.1) + ')'; fc.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5); }
  }

  // ---- persistent layers: sky with a moon hole, and the foreground pine and rocks that survive the rewrite ----
  function paintSky(ctx) {
    const g = ctx.createLinearGradient(0, -50, 0, 420);
    g.addColorStop(0, 'rgba(' + INK + ',0.2)'); g.addColorStop(0.6, 'rgba(' + INK + ',0.05)'); g.addColorStop(1, 'rgba(' + INK + ',0)');
    ctx.fillStyle = g; ctx.fillRect(-80, -50, 1760, 480);
    ctx.globalCompositeOperation = 'destination-out';
    const mg = ctx.createRadialGradient(300, 160, 40, 300, 160, 86);
    mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.75, 'rgba(0,0,0,0.9)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(300, 160, 90, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const r = C.rng(12);
    for (let i = 0; i < 6; i++) { const x = 650 + i * 26 + r() * 10, y = 120 + Math.abs(i - 2.5) * 12 + r() * 6; line(ctx, [[x - 11, y - 5], [x, y], [x + 11, y - 6]], { w: 2.6, a: 0.6, ta: 0.3, tb: 0.5 }, r); }
  }
  function paintForeground(ctx) {
    const r = C.rng(21);
    const rock = (cx, cy, rx, ry, a) => {
      for (let i = 0; i < 60; i++) { const t = r() * 6.283, d = Math.sqrt(r()); drawStamps(ctx, [{ x: cx + Math.cos(t) * d * rx, y: cy + Math.sin(t) * d * ry, r: 22 + r() * 32, a: a, k: 0 }]); }
      for (let i = 0; i < 26; i++) { const x = cx + (r() - 0.5) * rx * 1.5, y = cy - ry * 0.5 + r() * ry; line(ctx, [[x, y], [x + (r() - 0.5) * 20, y + 25 + r() * 40], [x + (r() - 0.5) * 30, y + 60 + r() * 50]], { w: 5 + r() * 4, a: 0.5, dry: 0.5, ta: 0.1, tb: 0.5 }, r); }
      line(ctx, [[cx - rx, cy + ry * 0.5], [cx - rx * 0.6, cy - ry * 0.7], [cx, cy - ry], [cx + rx * 0.7, cy - ry * 0.5], [cx + rx, cy + ry * 0.4]], { w: 8, a: 0.7, dry: 0.3, ta: 0.05, tb: 0.1 }, r);
    };
    rock(150, 835, 210, 110, 0.14);
    rock(1500, 905, 160, 60, 0.12);
    // gnarled pine leaning in from the left
    const trunk = [[130, 880], [95, 760], [150, 650], [120, 540], [190, 450], [310, 400]];
    line(ctx, trunk, { w: 38, a: 0.8, dry: 0.28, ta: 0.02, tb: 0.5, jit: 0.2 }, r);
    line(ctx, trunk.map((p) => [p[0] + 6, p[1]]), { w: 16, a: 0.45, ta: 0.02, tb: 0.5 }, r);
    const branches = [[[190, 450], [250, 470], [370, 480], [470, 450]], [[150, 650], [250, 610], [340, 600], [420, 560]], [[310, 400], [400, 370], [500, 345], [610, 340]], [[120, 540], [60, 500], [20, 470]]];
    branches.forEach((b) => {
      line(ctx, b, { w: 15, a: 0.8, dry: 0.3, ta: 0.02, tb: 0.7 }, r);
      const e = b[b.length - 1];
      for (let i = 0; i < 28; i++) { // needle fan
        const a = -2.6 + r() * 2.1, l = 26 + r() * 38;
        line(ctx, [[e[0] + (r() - 0.5) * 20, e[1] + (r() - 0.5) * 12], [e[0] + Math.cos(a) * l * 0.5, e[1] + Math.sin(a) * l * 0.5 + 6], [e[0] + Math.cos(a) * l, e[1] + Math.sin(a) * l + 14]], { w: 3, a: 0.8, ta: 0.05, tb: 0.5, jit: 0.05 }, r);
      }
      drawStamps(ctx, [{ x: e[0] + 4, y: e[1] + 6, r: 52, a: 0.2, k: 0 }]);
    });
  }

  // ---- the old walled river city (plane 2) and its river life (plane 3) ----
  const fillPoly = (ctx, pts, a) => { ctx.fillStyle = 'rgba(' + INK + ',' + a + ')'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); };
  // a hip roof with up-swept eaves, centre x, eave y, half width, height
  function roof(ctx, r, cx, y, hw, h, a) {
    const L = cx - hw, R = cx + hw;
    ctx.fillStyle = 'rgba(' + INK + ',' + a + ')';
    ctx.beginPath(); ctx.moveTo(L - hw * 0.12, y - h * 0.15); ctx.quadraticCurveTo(L + hw * 0.3, y + h * 0.05, cx - hw * 0.35, y - h); ctx.lineTo(cx + hw * 0.35, y - h);
    ctx.quadraticCurveTo(R - hw * 0.3, y + h * 0.05, R + hw * 0.12, y - h * 0.15); ctx.quadraticCurveTo(cx, y + h * 0.28, L - hw * 0.12, y - h * 0.15); ctx.fill();
    line(ctx, [[L - hw * 0.14, y - h * 0.18], [cx, y + h * 0.16], [R + hw * 0.14, y - h * 0.18]], { w: 3, a: 0.75, ta: 0.05, tb: 0.1, jit: 0.05 }, r);
  }
  function paintCity(ctx) {
    const r = C.rng(41);
    const house = (x, base, w, h, a) => {
      ctx.fillStyle = 'rgba(' + INK + ',' + (a * 0.18) + ')'; ctx.fillRect(x, base - h * 0.55, w, h * 0.55);
      roof(ctx, r, x + w / 2, base - h * 0.5, w * 0.62, h * 0.55, a);
      for (let k = 1; k < 4; k++) line(ctx, [[x + w * k / 4, base - h * 0.45], [x + w * k / 4, base]], { w: 1.4, a: 0.3, ta: 0.1, tb: 0.1 }, r);
    };
    // distant rows of houses, then nearer ones
    [[540, 24, 52, 0.4], [570, 30, 60, 0.5], [600, 38, 74, 0.62]].forEach(([base, w0, h0, a], row) => {
      for (let x = 240 + (row * 17) % 40; x < 1140; x += w0 + 10 + r() * 14) {
        const w = w0 + r() * 22; if (x > 830 && x < 1030 && row < 2) continue; // room for the pagoda
        house(x, base + r() * 8, w, h0 + r() * 20, a);
        if (r() < 0.35) drawStamps(ctx, [{ x: x + w * 0.5, y: base - h0 - 18, r: 7 + r() * 8, a: 0.35, k: 1 }, { x: x + w * 0.2, y: base - h0 - 10, r: 12, a: 0.22, k: 0 }]);
      }
    });
    // pagoda
    for (let i = 0; i < 5; i++) { const w = 62 - i * 7, y = 585 - i * 52; ctx.fillStyle = 'rgba(' + INK + ',0.2)'; ctx.fillRect(930 - w * 0.55, y - 38, w * 1.1, 38); roof(ctx, r, 930, y - 30, w, 34, 0.82); }
    line(ctx, [[930, 330], [930, 296]], { w: 3.4, a: 0.8 }, r); drawStamps(ctx, [{ x: 930, y: 292, r: 5, a: 0.8, k: 1 }]);
    // wall
    ctx.fillStyle = 'rgba(' + INK + ',0.2)'; ctx.fillRect(200, 600, 990, 56);
    for (let x = 200; x < 1190; x += 15) { ctx.fillStyle = 'rgba(' + INK + ',0.6)'; ctx.fillRect(x, 591, 9, 9); }
    for (let x = 206; x < 1190; x += 22 + r() * 14) line(ctx, [[x, 604], [x + (r() - 0.5) * 4, 654]], { w: 1.6, a: 0.28, ta: 0.1, tb: 0.1 }, r);
    line(ctx, [[196, 600], [700, 599], [1194, 600]], { w: 6, a: 0.7, dry: 0.15, ta: 0.02, tb: 0.04 }, r);
    line(ctx, [[196, 657], [700, 658], [1194, 656]], { w: 9, a: 0.55, dry: 0.3, ta: 0.02, tb: 0.04 }, r);
    // gate tower
    ctx.fillStyle = 'rgba(' + INK + ',0.5)'; ctx.fillRect(510, 548, 140, 108);
    ctx.fillStyle = 'rgba(' + INK + ',0.9)'; ctx.beginPath(); ctx.moveTo(550, 656); ctx.lineTo(550, 620); ctx.arc(580, 620, 30, Math.PI, 0); ctx.lineTo(610, 656); ctx.fill();
    roof(ctx, r, 580, 552, 105, 52, 0.85); roof(ctx, r, 580, 492, 70, 44, 0.88);
    // trees along the wall
    for (let i = 0; i < 14; i++) { const x = 230 + r() * 950; for (let k = 0; k < 7; k++) drawStamps(ctx, [{ x: x + (r() - 0.5) * 36, y: 595 - r() * 26, r: 5 + r() * 9, a: 0.3 + r() * 0.2, k: 1 }]); }
    // smoke
    [[360, 520], [760, 508], [1090, 522]].forEach(([x, y]) => { for (let i = 0; i < 9; i++) drawStamps(ctx, [{ x: x + i * 5 + Math.sin(i) * 6, y: y - i * 24, r: 14 + i * 5, a: 0.12, k: 0 }]); });
  }
  function paintRiver(ctx) {
    const r = C.rng(52);
    // reflection of wall and gate, broken by ripples
    for (let i = 0; i < 40; i++) { const x = 220 + r() * 960; drawStamps(ctx, [{ x, y: 676 + r() * 60, r: 18 + r() * 30, a: 0.07, k: 0 }]); }
    for (let i = 0; i < 70; i++) { const x = r() * 1600, y = 690 + r() * 210; line(ctx, [[x, y], [x + 40 + r() * 120, y + (r() - 0.5) * 3]], { w: 2 + r() * 1.5, a: 0.12 + r() * 0.2, dry: 0.4, ta: 0.3, tb: 0.5 }, r); }
    for (let i = 0; i < 20; i++) { const x = 520 + r() * 130, y = 664 + r() * 70; line(ctx, [[x, y], [x + 14 + r() * 34, y]], { w: 3, a: 0.14, ta: 0.2, tb: 0.5 }, r); }
    // wharf
    ctx.fillStyle = 'rgba(' + INK + ',0.5)'; ctx.fillRect(540, 650, 90, 7);
    for (let i = 0; i < 6; i++) line(ctx, [[546 + i * 16, 656], [546 + i * 16, 690]], { w: 3, a: 0.5, ta: 0.1, tb: 0.1 }, r);
    // boats
    [[330, 770, 1], [740, 722, 0.8], [1060, 800, 1.1]].forEach(([x, y, s], bi) => {
      line(ctx, [[x, y], [x + 40 * s, y + 10 * s], [x + 120 * s, y + 10 * s], [x + 160 * s, y - 4 * s]], { w: 9 * s, a: 0.85, dry: 0.12, ta: 0.05, tb: 0.1 }, r);
      line(ctx, [[x + 56 * s, y + 2], [x + 56 * s, y - 94 * s]], { w: 3, a: 0.8 }, r);
      if (bi !== 1) fillPoly(ctx, [[x + 60 * s, y - 90 * s], [x + 112 * s, y - 70 * s], [x + 108 * s, y - 14 * s], [x + 60 * s, y - 8 * s]], 0.2);
      else line(ctx, [[x + 40 * s, y - 2], [x + 84 * s, y - 22 * s], [x + 126 * s, y - 2]], { w: 10 * s, a: 0.8, ta: 0.1, tb: 0.1 }, r);
      for (let k = 1; k < 4; k++) line(ctx, [[x + 60 * s, y - 90 * s + k * 20], [x + 110 * s, y - 70 * s + k * 15]], { w: 1.3, a: 0.4 }, r);
      line(ctx, [[x - 10, y + 22 * s], [x + 80 * s, y + 24 * s], [x + 170 * s, y + 22 * s]], { w: 3, a: 0.2, dry: 0.45, ta: 0.2, tb: 0.3 }, r);
      drawStamps(ctx, [{ x: x + 100 * s, y: y - 4, r: 4.5, a: 0.9, k: 1 }, { x: x + 114 * s, y: y - 2, r: 4, a: 0.85, k: 1 }]);
    });
  }

  // ---- mist: paper-coloured soft strips, seamless horizontally, drawn between the planes ----
  function paintMist(canvas, seed) {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, r = C.rng(seed);
    const soft = mk(64, 64), sc = soft.getContext('2d'), g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + PAPER + ',1)'); g.addColorStop(0.5, 'rgba(' + PAPER + ',0.45)'); g.addColorStop(1, 'rgba(' + PAPER + ',0)');
    sc.fillStyle = g; sc.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = H * (0.3 + r() * 0.4), w = W * (0.08 + r() * 0.16), h = H * (0.1 + r() * 0.22);
      ctx.globalAlpha = 0.18 + r() * 0.3;
      for (const dx of [-W, 0, W]) ctx.drawImage(soft, x - w / 2 + dx, y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
  }

  // ---- vermilion seal, cut like a carved stone: abstract strokes, not font glyphs ----
  function paintSeal(size) {
    const c = mk(size, size), ctx = c.getContext('2d'), r = C.rng(66);
    ctx.fillStyle = '#b3271d'; ctx.fillRect(2, 2, size - 4, size - 4);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(0,0,0,' + (0.2 + r() * 0.6) + ')'; ctx.fillRect(r() * size, r() * size, 1 + r() * 3, 1 + r() * 3); } // chipped
    ctx.strokeStyle = '#000'; ctx.lineWidth = size * 0.07; ctx.lineCap = 'square';
    const cell = size / 2;
    for (let i = 0; i < 4; i++) { // four carved characters in a 2x2 grid
      const x0 = (i % 2) * cell + cell * 0.2, y0 = Math.floor(i / 2) * cell + cell * 0.2, s = cell * 0.6;
      ctx.beginPath();
      if (i === 0) { ctx.moveTo(x0, y0 + s * 0.2); ctx.lineTo(x0 + s, y0 + s * 0.2); ctx.moveTo(x0 + s / 2, y0); ctx.lineTo(x0 + s / 2, y0 + s); ctx.moveTo(x0, y0 + s); ctx.lineTo(x0 + s, y0 + s); }
      if (i === 1) { ctx.rect(x0, y0 + s * 0.1, s, s * 0.8); ctx.moveTo(x0, y0 + s / 2); ctx.lineTo(x0 + s, y0 + s / 2); }
      if (i === 2) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + s, y0 + s); ctx.moveTo(x0 + s, y0); ctx.lineTo(x0, y0 + s); ctx.moveTo(x0 + s / 2, y0); ctx.lineTo(x0 + s / 2, y0 + s); }
      if (i === 3) { ctx.moveTo(x0, y0 + s * 0.3); ctx.lineTo(x0 + s, y0 + s * 0.3); ctx.moveTo(x0, y0 + s * 0.7); ctx.lineTo(x0 + s, y0 + s * 0.7); ctx.moveTo(x0 + s * 0.3, y0); ctx.lineTo(x0 + s * 0.3, y0 + s); }
      ctx.stroke();
    }
    return c;
  }

  // ---- the lone figure: not painted at all, but left blank. Drawn by cutting the painting back to paper. ----
  // Called with the scene transform already set to world space; paper is the paper canvas (device space).
  function cutFigure(ctx, paper, x, y, h, headingDeg, alpha, eyes) {
    const rad = headingDeg * Math.PI / 180, cs = Math.cos(rad);
    const sx = (cs < 0 ? -1 : 1) * Math.max(0.2, Math.abs(cs));
    const back = headingDeg > 100;
    const P = (px, py) => [x + px * sx * h / 170, y + py * h / 170];
    ctx.save();
    ctx.beginPath();
    let q;
    q = P(-36, -118); ctx.moveTo(q[0], q[1]); q = P(0, -150); ctx.lineTo(q[0], q[1]); q = P(36, -118); ctx.lineTo(q[0], q[1]); // bamboo hat
    q = P(14, -112); ctx.lineTo(q[0], q[1]); q = P(22, -100); ctx.lineTo(q[0], q[1]); // shoulder
    q = P(40, -20); ctx.lineTo(q[0], q[1]); q = P(44, 0); ctx.lineTo(q[0], q[1]); q = P(-44, 0); ctx.lineTo(q[0], q[1]); q = P(-40, -20); ctx.lineTo(q[0], q[1]);
    q = P(-22, -100); ctx.lineTo(q[0], q[1]); q = P(-14, -112); ctx.lineTo(q[0], q[1]); ctx.closePath();
    if (back) { q = P(-6, -104); ctx.moveTo(q[0], q[1]); q = P(6, -104); ctx.lineTo(q[0], q[1]); q = P(10, -62); ctx.lineTo(q[0], q[1]); q = P(0, -50); ctx.lineTo(q[0], q[1]); q = P(-8, -64); ctx.lineTo(q[0], q[1]); ctx.closePath(); }
    const s0 = P(52, -96), s1 = P(60, 0); // staff, always on the side the figure turns toward
    ctx.moveTo(s0[0] - 2.5, s0[1]); ctx.lineTo(s0[0] + 2.5, s0[1]); ctx.lineTo(s1[0] + 2.5, s1[1]); ctx.lineTo(s1[0] - 2.5, s1[1]); ctx.closePath();
    ctx.globalAlpha = alpha;
    const T = ctx.getTransform();
    ctx.save(); ctx.clip('nonzero'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(paper, 0, 0); ctx.restore();
    ctx.setTransform(T);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(' + INK + ',' + (0.22 * alpha) + ')'; ctx.stroke();
    if (eyes > 0.02) { // facing the viewer: two small dark slits appear in the blank hat shadow
      ctx.fillStyle = 'rgba(' + INK + ',' + (0.85 * eyes) + ')';
      [-1, 1].forEach((d) => { const e = P(d * 9, -108); ctx.fillRect(e[0] - 4 * h / 170, e[1], 8 * h / 170, 2.4 * h / 170); });
    }
    ctx.restore();
  }

  root.V3Paint = { mk, makeSprites, drawStamps, line, paintPaper, paintSky, paintForeground, paintCity, paintRiver, paintMist, paintSeal, cutFigure, INK, PAPER };
})(typeof self !== 'undefined' ? self : this);
