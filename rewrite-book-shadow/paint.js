// Book + Shadow painter. The page is the stage: an overhead camera on an open thread-bound book.
// Puppets are drawn on an offscreen layer, carved by paper fibres, masked by candle light from behind the leaf, then multiplied into the paper.
(function () {
  'use strict';
  const C = BSCore, { smooth, span, hash, clamp } = C;
  const W = 1280, H = 720, GY = 450, SPINE = 640;
  const PAGE = { x0: 112, x1: 1168, y0: 52, y1: 620 };
  const SHADE = { x: 350, y: 480 };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const poly = (g, pts, fill, stroke) => {
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
  };

  // ---- fibre texture (alpha only) used to carve puppets out of the paper ----
  const fibre = mk(W, H);
  (function () {
    const g = fibre.getContext('2d'); g.lineCap = 'round';
    for (let i = 0; i < 4200; i++) {
      const x = hash(i, 1) * W, y = hash(i, 2) * H, a = hash(i, 3) * Math.PI, l = 5 + hash(i, 4) * 20;
      g.strokeStyle = 'rgba(255,255,255,' + (0.25 + hash(i, 5) * 0.7).toFixed(2) + ')'; g.lineWidth = 0.6 + hash(i, 6) * 1.2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + hash(i, 7) * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  })();

  // ---- static book: spine band, cover, thick fore-edge, gutter, paper, impression marks ----
  const book = mk(W, H);
  function dent(g, fn) { // a pressed (debossed) mark: dark lower-right lip, light upper-left lip
    g.save(); g.translate(1, 1); g.globalAlpha = 0.32; fn('#3a2812'); g.restore();
    g.save(); g.translate(-1, -1); g.globalAlpha = 0.55; fn('#fff6dc'); g.restore();
    g.save(); g.globalAlpha = 0.16; fn('#5a4222'); g.restore();
  }
  (function () {
    const g = book.getContext('2d');
    // table
    let gr = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 800); gr.addColorStop(0, '#2c1f16'); gr.addColorStop(1, '#0d0907'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { g.strokeStyle = 'rgba(255,220,170,' + (0.012 + hash(i, 9) * 0.02) + ')'; g.beginPath(); const y = hash(i, 8) * H; g.moveTo(0, y); g.bezierCurveTo(300, y + 6, 900, y - 6, W, y + 2); g.stroke(); }
    // cover boards (leather) peeking around the page block
    g.fillStyle = '#4a2a1a'; g.beginPath(); g.roundRect(46, 26, 1188, 650, 14); g.fill();
    gr = g.createLinearGradient(0, 26, 0, 676); gr.addColorStop(0, 'rgba(255,200,140,0.18)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = gr; g.fill();
    for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(' + (hash(i, 11) > 0.5 ? '255,210,160' : '0,0,0') + ',' + (0.03 + hash(i, 12) * 0.05).toFixed(3) + ')'; g.fillRect(46 + hash(i, 13) * 1188, 26 + hash(i, 14) * 650, 2, 1.2); }
    g.strokeStyle = 'rgba(210,160,70,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(56, 36, 1168, 630, 10); g.stroke();
    // spine band along the top: raised cords and a gilt title
    gr = g.createLinearGradient(0, 8, 0, 54); gr.addColorStop(0, '#2a150c'); gr.addColorStop(0.45, '#6a3d22'); gr.addColorStop(1, '#2e180e'); g.fillStyle = gr; g.beginPath(); g.roundRect(40, 8, 1200, 46, 12); g.fill();
    for (let i = 0; i < 6; i++) { const x = 140 + i * 200; gr = g.createLinearGradient(x - 8, 0, x + 8, 0); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.5, 'rgba(255,200,130,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(x - 8, 8, 16, 46); }
    g.fillStyle = '#d9a94e'; g.font = '600 15px "Noto Serif CJK SC","Source Han Serif SC","Songti SC","SimSun",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('城门志  ·  ANNALS OF THE GATE', SPINE, 31);
    // thick fore-edge: stacked sheet edges on left, right and bottom
    const edge = (x0, y0, x1, y1, n, dir) => {
      g.fillStyle = '#b79a68'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let i = 0; i < n; i++) {
        const k = i / n, a = 0.18 + hash(i, 20) * 0.35, shade = hash(i, 21) > 0.5 ? '70,48,20' : '255,235,190';
        g.strokeStyle = 'rgba(' + shade + ',' + a.toFixed(2) + ')'; g.lineWidth = 0.8; g.beginPath();
        if (dir === 'v') { const x = x0 + k * (x1 - x0); g.moveTo(x, y0 + 2 + hash(i, 22) * 5); g.lineTo(x + (dir === 'v' ? (x1 > 700 ? 0 : 0) : 0), y1 - 2 - hash(i, 23) * 5); }
        else { const y = y0 + k * (y1 - y0); g.moveTo(x0 + 2 + hash(i, 22) * 5, y); g.lineTo(x1 - 2 - hash(i, 23) * 5, y); }
        g.stroke();
      }
    };
    edge(76, 56, PAGE.x0, 646, 34, 'v'); edge(PAGE.x1, 56, 1204, 646, 34, 'v');
    edge(PAGE.x0, PAGE.y1, PAGE.x1, 650, 34, 'h');
    gr = g.createLinearGradient(0, 620, 0, 652); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = gr; g.fillRect(PAGE.x0, 620, PAGE.x1 - PAGE.x0, 32);
    gr = g.createLinearGradient(76, 0, PAGE.x0, 0); gr.addColorStop(0, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0.05)'); g.fillStyle = gr; g.fillRect(76, 56, 36, 590);
    gr = g.createLinearGradient(PAGE.x1, 0, 1204, 0); gr.addColorStop(0, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = gr; g.fillRect(PAGE.x1, 56, 36, 590);
    // paper surface
    gr = g.createLinearGradient(PAGE.x0, 0, PAGE.x1, 0); gr.addColorStop(0, '#d9c595'); gr.addColorStop(0.5, '#e8d9ae'); gr.addColorStop(1, '#d9c595'); g.fillStyle = gr; g.fillRect(PAGE.x0, PAGE.y0, PAGE.x1 - PAGE.x0, PAGE.y1 - PAGE.y0);
    g.lineCap = 'round';
    for (let i = 0; i < 3600; i++) {
      const x = PAGE.x0 + hash(i, 31) * (PAGE.x1 - PAGE.x0), y = PAGE.y0 + hash(i, 32) * (PAGE.y1 - PAGE.y0), a = hash(i, 33) * Math.PI, l = 4 + hash(i, 34) * 14;
      g.strokeStyle = hash(i, 35) > 0.5 ? 'rgba(120,90,40,0.10)' : 'rgba(255,250,225,0.22)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 40; i++) { const x = PAGE.x0 + hash(i, 36) * 1056, y = PAGE.y0 + hash(i, 37) * 568, r = 6 + hash(i, 38) * 26; gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,110,50,0.09)'); gr.addColorStop(1, 'rgba(150,110,50,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    // impression marks (pressed in, no ink): frame rules, ruled columns, a seal ring, ghost lines of earlier writing
    dent(g, (c) => { g.strokeStyle = c; g.lineWidth = 1.6; g.strokeRect(150, 90, 460, 500); g.strokeRect(670, 90, 460, 500); });
    dent(g, (c) => { g.strokeStyle = c; g.lineWidth = 1.2; for (let y = 150; y < 520; y += 38) { g.beginPath(); g.moveTo(670, y); g.lineTo(1130, y); g.stroke(); } });
    dent(g, (c) => { g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); g.arc(500, 500, 36, 0, 7); g.stroke(); g.strokeRect(484, 484, 32, 32); g.beginPath(); g.moveTo(484, 500); g.lineTo(516, 500); g.moveTo(500, 484); g.lineTo(500, 516); g.stroke(); });
    dent(g, (c) => { g.fillStyle = c; for (let r = 0; r < 7; r++) for (let k = 0; k < 11; k++) if (hash(r * 20 + k, 40) > 0.28) g.fillRect(180 + k * 36 + hash(r, k) * 4, 176 + r * 38, 14 + hash(k, r) * 14, 3); });
    // gutter: dark crease with stitched thread
    gr = g.createLinearGradient(SPINE - 70, 0, SPINE + 70, 0); gr.addColorStop(0, 'rgba(40,24,8,0)'); gr.addColorStop(0.42, 'rgba(40,24,8,0.28)'); gr.addColorStop(0.5, 'rgba(15,8,2,0.78)'); gr.addColorStop(0.58, 'rgba(40,24,8,0.28)'); gr.addColorStop(1, 'rgba(40,24,8,0)'); g.fillStyle = gr; g.fillRect(SPINE - 70, PAGE.y0, 140, PAGE.y1 - PAGE.y0);
    g.fillStyle = 'rgba(220,190,120,0.55)'; for (let y = 90; y < 600; y += 72) g.fillRect(SPINE - 2, y, 4, 22);
    gr = g.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 780); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  })();

  // ---- hand-cut puppet toolkit: wobbly cut outlines, pierced holes, leather rib, baked contact shadow ----
  const COL = { red: '#d2452f', ochre: '#e6a93c', teal: '#3e9c92', dark: '#2a1c14', sun: '#e8702a', hill: '#6f7f5a', hill2: '#9a8a5a' };
  let A = 1; // alpha multiplier (reduced-motion cross-fade)
  const al = (g, a) => { g.globalAlpha = A * clamp(a); };
  let LP = { x: 860, y: 300 }; // candle, used to push cast shadows away from the light
  const SLOPE = 0.35; // fibres slant toward the spine by this rise per unit of run
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // closed outline with sharp-ish corners and a hand-wobbled middle on every edge
  function cut(g, pts, seed, amp) {
    const n = pts.length, J = (i, s) => (hash(i, seed + s) - 0.5) * 2 * amp;
    const v = pts.map((p, i) => [p[0] + J(i, 1), p[1] + J(i, 2)]);
    const st = lerp2(v[n - 1], v[0], 0.82);
    g.beginPath(); g.moveTo(st[0], st[1]);
    for (let i = 0; i < n; i++) {
      const a = v[i], b = v[(i + 1) % n], p1 = lerp2(a, b, 0.18), p2 = lerp2(a, b, 0.82), m = lerp2(a, b, 0.5);
      g.quadraticCurveTo(a[0], a[1], p1[0], p1[1]);
      g.quadraticCurveTo(m[0] + J(i, 3) * 0.8, m[1] + J(i, 4) * 0.8, p2[0], p2[1]);
    }
    g.closePath();
  }
  // leather body: translucent fill, soft inner highlight, dark rib along the cut edge
  function body(q, fill, line, lw) {
    q.globalAlpha = 0.94; q.fillStyle = fill; q.fill(); q.globalAlpha = 1;
    q.save(); q.clip(); q.strokeStyle = 'rgba(255,236,170,0.3)'; q.lineWidth = 6; q.stroke(); q.restore();
    q.strokeStyle = line; q.lineWidth = lw || 2.2; q.lineJoin = 'round'; q.stroke();
  }
  // pierced holes [x, y, rx, ry, 'd' for diamond]: cut clean through, light passes, leather rim darkened
  function punch(q, list, seed) {
    const shape = (h, i) => {
      if (h[4] === 'd') return [[h[0], h[1] - h[3]], [h[0] + h[2], h[1]], [h[0], h[1] + h[3]], [h[0] - h[2], h[1]]];
      const pts = [], a0 = hash(i, seed) * 0.8;
      for (let k = 0; k < 7; k++) { const a = a0 + k / 7 * 6.2832; pts.push([h[0] + Math.cos(a) * h[2], h[1] + Math.sin(a) * h[3]]); }
      return pts;
    };
    q.save(); q.globalCompositeOperation = 'destination-out'; q.fillStyle = '#000';
    list.forEach((h, i) => { cut(q, shape(h, i), seed + i, Math.min(h[2], h[3]) * 0.16); q.fill(); });
    q.globalCompositeOperation = 'source-atop'; q.strokeStyle = 'rgba(30,18,10,0.55)'; q.lineWidth = 1.1;
    list.forEach((h, i) => { cut(q, shape(h, i), seed + i, Math.min(h[2], h[3]) * 0.16); q.stroke(); });
    q.restore();
  }
  const Q2 = mk(420, 360), q2g = Q2.getContext('2d'), cache = {};
  // bake a puppet sprite once: body, holes, then a sharp contact shadow (offset copy) underneath
  function sprite(key, bw, bh, ax, ay, fn) {
    if (cache[key]) return cache[key];
    const c = mk(bw, bh), q = c.getContext('2d');
    q.save(); q.translate(ax, ay); q.lineJoin = 'round'; q.lineCap = 'round'; fn(q); q.restore();
    q2g.globalCompositeOperation = 'source-over'; q2g.clearRect(0, 0, bw, bh); q2g.drawImage(c, 3, 4);
    q2g.globalCompositeOperation = 'source-in'; q2g.fillStyle = 'rgba(30,16,6,0.34)'; q2g.fillRect(0, 0, bw, bh);
    q.globalCompositeOperation = 'destination-over'; q.drawImage(Q2, 0, 0, bw, bh, 0, 0, bw, bh);
    return (cache[key] = { c, ax, ay, bw, bh });
  }
  // draw a sprite with a soft cast shadow pushed away from the candle (third layer after contact shadow and body)
  function put(g, sp, x, y, o) {
    o = o || {};
    g.save(); g.translate(x, y); if (o.tilt) g.rotate(o.tilt); g.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); if (o.rot) g.rotate(o.rot);
    if (o.cast !== false) { g.shadowColor = 'rgba(36,18,6,0.3)'; g.shadowBlur = 8; g.shadowOffsetX = clamp((x - LP.x) * 0.04, -10, 10); g.shadowOffsetY = 7; }
    g.drawImage(sp.c, -sp.ax, -sp.ay); g.restore();
  }

  // ---- the gatekeeper: robe, profile head, hat, arm and lantern, all hand-cut and pierced. Feet at the origin, about 130 px tall ----
  const KB = { x0: -34, x1: 44, y0: -130, y1: 2 };
  const KEEP_CC = { robe: COL.red, collar: COL.ochre, head: COL.ochre, hat: COL.teal, sleeve: '#9c3b22', lamp: COL.ochre, line: COL.dark };
  const KEEP_SH = { robe: '#3a4a74', collar: '#4a5a84', head: '#44527c', hat: '#222c48', sleeve: '#222b44', lamp: '#3a4560', line: '#141a2c' };
  function keeperSprite(shadeStyle, arm) {
    const up = Math.round(clamp(arm || 0) * 20) / 20, c = shadeStyle ? KEEP_SH : KEEP_CC;
    return sprite('k' + (shadeStyle ? 's' : 'c') + up, 200, 250, 100, 200, (q) => {
      q.strokeStyle = c.line; q.lineWidth = 3.4; q.beginPath(); q.moveTo(-23, -66); q.quadraticCurveTo(-29, -30, -31, 2); q.stroke(); // staff
      cut(q, [[-27, -68], [-23, -75], [-19, -68], [-23, -62]], 5, 0.8); body(q, c.collar, c.line, 1.6);
      cut(q, [[-29, 0], [-23, -28], [-17, -72], [-6, -77], [6, -77], [17, -72], [23, -30], [31, 0], [22, -5], [14, 2], [6, -5], [-2, 2], [-10, -5], [-18, 2]], 11, 1.1); body(q, c.robe, c.line, 2.4);
      cut(q, [[-19, -72], [0, -81], [19, -72], [14, -58], [-14, -58]], 12, 0.9); body(q, c.collar, c.line, 2);
      cut(q, [[-10, -80], [-12, -90], [-8, -100], [0, -104], [8, -101], [12, -94], [17, -89], [12, -86], [12, -81], [4, -78]], 13, 0.8); body(q, c.head, c.line, 2);
      cut(q, [[-27, -98], [-16, -106], [-7, -121], [0, -129], [7, -121], [16, -106], [27, -98], [11, -102], [-11, -102]], 14, 0.9); body(q, c.hat, c.line, 2);
      const ax = 32 + 6 * up, ay = -38 - 56 * up, sx = 14, sy = -62, dx = ax - sx, dy = ay - sy, n = Math.hypot(dx, dy) || 1, nx = -dy / n * 3.4, ny = dx / n * 3.4;
      cut(q, [[sx + nx, sy + ny], [ax + nx, ay + ny], [ax - nx, ay - ny], [sx - nx, sy - ny]], 15, 0.5); body(q, c.sleeve, c.line, 1.8);
      q.strokeStyle = c.line; q.lineWidth = 1.6; q.beginPath(); q.moveTo(ax, ay - 7); q.lineTo(ax, ay); q.stroke();
      cut(q, [[ax - 6, ay], [ax + 6, ay], [ax + 9, ay + 9], [ax + 7, ay + 18], [ax - 7, ay + 18], [ax - 9, ay + 9]], 16, 0.6); body(q, c.lamp, c.line, 1.6);
      const h = [];
      for (let r = 0; r < 5; r++) { const y = -62 + r * 12.5, hw = 16 + (y + 62) / 62 * 12; (r % 2 ? [-4.5, 4.5] : [-9, 0, 9]).forEach((x) => { if (Math.abs(x) + 3.4 < hw - 3) h.push([x, y, 3.2, 4.2, 'd']); }); }
      for (let x = -18; x <= 18; x += 9) h.push([x, -6, 2.4, 2.4]);
      h.push([-8, -66, 1.8, 1.8], [0, -68, 1.8, 1.8], [8, -66, 1.8, 1.8]); // collar pores
      h.push([7, -93, 2.8, 1.3], [9.5, -85, 1.6, 1.1], [0, -112, 2.2, 2.2], [0, -121, 1.6, 1.6]); // eye slit, mouth, hat pores
      h.push([ax, ay + 9, 3.2, 4.6], [ax - 5.3, ay + 4, 1.2, 1.2], [ax + 5.3, ay + 4, 1.2, 1.2], [ax, ay + 15, 1.2, 1.2]); // lantern window and pores
      punch(q, h, 21);
    });
  }

  // ---- gate and tree sprites ----
  const gateSprite = {
    post() {
      return sprite('post', 50, 220, 25, 205, (q) => {
        cut(q, [[-14, 0], [-13, -60], [-15, -130], [-12, -190], [14, -191], [12, -120], [14, -50], [14, 0]], 31, 1.2); body(q, COL.red, COL.dark, 2.4);
        q.strokeStyle = 'rgba(40,16,8,0.35)'; q.lineWidth = 1.2; [-6, 6].forEach((x, i) => { q.beginPath(); q.moveTo(x, -4); q.bezierCurveTo(x + 2, -60, x - 2, -120 - i * 8, x + 1, -184); q.stroke(); });
        punch(q, [-40, -80, -120, -160].map((y) => [0, y, 3.2, 7.5]), 33);
      });
    },
    door(dw) {
      const n = Math.max(1, Math.round(dw / 2)), hw = n;
      return sprite('door' + n, 70, 180, 35, 168, (q) => {
        cut(q, [[-hw, 0], [-hw + 1, -80], [-hw - 1, -160], [hw, -160], [hw + 1, -80], [hw, 0]], 41, 1.2); body(q, '#9c3b22', COL.dark, 2.2);
        if (hw > 6) { const cols = hw > 18 ? 2 : 1, cw = hw * 2 / cols, h = []; for (let r = 0; r < 5; r++) for (let k = 0; k < cols; k++) h.push([-hw + cw * (k + 0.5), -22 - r * 29, Math.min(5.2, cw * 0.28), 7, 'd']); punch(q, h, 43); }
      });
    },
    lintel() {
      return sprite('lintel', 240, 40, 120, 30, (q) => {
        cut(q, [[-106, -20], [-60, -23], [0, -20], [60, -23], [106, -20], [102, 0], [60, 3], [0, 0], [-60, 3], [-102, 0]], 51, 1.2); body(q, COL.teal, COL.dark, 2.4);
        const h = []; for (let i = 0; i < 9; i++) h.push([-80 + i * 20, -10, 3.4, 4, 'd']); punch(q, h, 53);
      });
    },
    roof() {
      return sprite('roof', 320, 100, 160, 80, (q) => {
        cut(q, [[-142, -18], [-128, 2], [-96, -6], [-60, -22], [-24, -42], [0, -52], [24, -42], [60, -22], [96, -6], [128, 2], [142, -18], [132, 8], [100, 12], [60, 4], [0, -2], [-60, 4], [-100, 12], [-132, 8]], 61, 1.4); body(q, COL.teal, COL.dark, 2.6);
        const h = [[0, -40, 3, 3]]; for (let i = -3; i <= 3; i++) h.push([i * 20, -14, 4, 4]); h.push([-14, -28, 3.4, 3.4], [14, -28, 3.4, 3.4]); punch(q, h, 63);
      });
    },
    lamp() {
      return sprite('lamp', 34, 56, 17, 8, (q) => {
        cut(q, [[-8, 0], [8, 0], [11, 12], [8, 26], [-8, 26], [-11, 12]], 71, 0.7); body(q, COL.ochre, COL.dark, 1.8);
        punch(q, [[0, 13, 3.5, 6], [-6, 5, 1.1, 1.1], [6, 5, 1.1, 1.1], [-6, 21, 1.1, 1.1], [6, 21, 1.1, 1.1]], 73);
      });
    },
  };
  function treeSprite(i) {
    return sprite('tree' + i, 110, 170, 55, 150, (q) => {
      cut(q, [[-5, 0], [-4, -25], [-6, -55], [5, -55], [3, -25], [6, 0]], 80 + i, 0.8); body(q, '#3a2a1c', COL.dark, 1.8);
      const h = [];
      for (let j = 0; j < 3; j++) {
        const cx = (hash(i * 3 + j, 90) - 0.5) * 6, cy = -58 - j * 32, rx = 33 - j * 5, ry = 24, pts = [];
        for (let k = 0; k < 9; k++) { const a = k / 9 * 6.2832, rr = 0.8 + 0.34 * hash(k + j * 9 + i * 27, 91); pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]); }
        cut(q, pts, 100 + i * 7 + j, 2.2); body(q, j % 2 ? COL.teal : COL.hill, COL.dark, 2);
        for (let k = 0; k < 6; k++) h.push([cx + (hash(k + j * 6 + i * 18, 92) * 2 - 1) * rx * 0.6, cy + (hash(k + j * 6 + i * 18, 93) * 2 - 1) * ry * 0.5, 2.4 + hash(k + j, 94) * 1.6, 2 + hash(k + j, 95) * 1.4]);
      }
      punch(q, h, 110 + i);
    });
  }
  const hill = (g, pts, fill, seed) => { cut(g, pts, seed, 3); g.fillStyle = fill; g.fill(); g.strokeStyle = COL.dark; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(); };
  const gather = (x, y, k) => { const dx = (SPINE - x) * k; return [x + dx, y - Math.abs(dx) * SLOPE]; }; // slide toward the spine along slanted fibres
  let lastTrail = 0;

  function world(g, td, time) {
    const sway = time ? Math.sin(time * 1.3) * 0.012 : 0;
    al(g, 1); g.fillStyle = COL.sun; g.beginPath(); g.arc(930, 262, 36, 0, 7); g.fill();
    const hl = span(td, 0.42, 0.95);
    if (hl > 0) {
      al(g, hl); const rise = (1 - hl) * 70;
      hill(g, [[150, 400 + rise], [260, 330 + rise], [370, 380 + rise], [470, 300 + rise], [610, 392 + rise], [700, 392], [800, 330 + rise], [930, 300 + rise], [1050, 372 + rise], [1130, 400 + rise]], COL.hill2, 3);
      hill(g, [[150, 420 + rise], [330, 370 + rise], [520, 410 + rise], [760, 360 + rise], [960, 396 + rise], [1130, 420 + rise]], COL.hill, 4);
    }
    al(g, 1); g.fillStyle = COL.ochre; g.fillRect(150, GY, 980, 28); g.fillStyle = COL.dark; g.fillRect(150, GY, 980, 3);
    const road = span(td, 0.34, 0.9);
    al(g, 0.25 + 0.75 * road); const rw = 14 + 120 * road, rt = 8 + 12 * road;
    poly(g, [[SPINE - rt, GY], [SPINE + rt, GY], [SPINE + rw, 478], [SPINE - rw, 478]], '#f2d99a', COL.dark);
    const wall = span(td, 0.18, 0.62), wh = 110 * (1 - wall) + 9;
    [[150, 536], [744, 1130]].forEach(([x0, x1]) => {
      al(g, 1); g.fillStyle = COL.ochre; g.fillRect(x0, GY - wh, x1 - x0, wh); g.strokeStyle = COL.dark; g.lineWidth = 2; g.strokeRect(x0, GY - wh, x1 - x0, wh);
      for (let r = 0; r * 22 < wh; r++) { const y = GY - wh + r * 22; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); for (let x = x0 + (r % 2) * 30; x < x1; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(y + 22, GY)); g.stroke(); } }
      if (wall < 0.9) for (let x = x0 + 10; x < x1 - 20; x += 44) { al(g, 1 - wall); g.fillStyle = COL.ochre; g.fillRect(x, GY - wh - 14, 26, 14); g.strokeRect(x, GY - wh - 14, 26, 14); }
    });
    // gate: doors open, then the whole cut-out gathers toward the spine along the fibres and thins away
    const roof = span(td, 0.04, 0.4), open = span(td, 0.0, 0.26), gat = span(td, 0.12, 0.6), pa = 1 - span(td, 0.34, 0.62);
    if (pa > 0.001) {
      const sx = 1 - 0.7 * gat, tl = (x) => (Math.abs(x - SPINE) > 20 ? (x < SPINE ? 1 : -1) * gat * 0.2 : 0);
      const at = (sp, x, y, o) => { const p = gather(x, y, gat); put(g, sp, p[0], p[1], Object.assign({ sx, tilt: tl(x) }, o)); };
      al(g, pa); at(gateSprite.post(), 570, GY); at(gateSprite.post(), 710, GY);
      const dw = 56 * (1 - open);
      if (open < 0.98) { al(g, pa * (1 - open * 0.6)); const d = gateSprite.door(dw); at(d, 584 + dw / 2, GY); at(d, 696 - dw / 2, GY); }
      al(g, pa); at(gateSprite.lintel(), 640, GY - 168);
      al(g, pa * (1 - roof)); at(gateSprite.roof(), 640, GY - 190 - roof * 70);
      for (let i = 0; i < 3; i++) {
        const k = span(td, 0.02 + i * 0.05, 0.3 + i * 0.05), lx = 600 + i * 40 + (hash(i, 50) - 0.5) * k * 60, ly = GY - 150 - k * 90;
        const p0 = gather(lx, GY - 168, gat), p1 = gather(lx, ly, gat);
        al(g, pa * (1 - k)); g.strokeStyle = COL.dark; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
        put(g, gateSprite.lamp(), p1[0], p1[1], { sx });
      }
    }
    // trees grow in staggered
    [[200, 0.5], [350, 0.56], [930, 0.5], [1040, 0.58], [1100, 0.64]].forEach(([x, a], i) => {
      const k = span(td, a, a + 0.28); if (k <= 0) return; al(g, k);
      const s = 0.4 + 0.6 * k; put(g, treeSprite(i), x, GY + 8, { sx: s, sy: s, rot: sway * (i % 2 ? 1 : -1) });
    });
    // the gatekeeper dissolves in vertical slivers that slide toward the spine along the fibres
    const kx = 790, N = 9, sw = 12, ks = keeperSprite(false, 0);
    if (td < 0.62) for (let i = 0; i < N; i++) {
      const s = span(td, 0.1 + hash(i, 60) * 0.1, 0.42 + hash(i, 61) * 0.12); if (s >= 1) continue;
      const lx0 = -54 + i * (sw + 3), sxs = ks.ax + lx0, w3 = sw + 3;
      if (sxs + w3 <= 0 || sxs >= ks.bw) continue;
      const dxm = -(kx - SPINE) * s * (0.55 + 0.4 * hash(i, 62)), dy = -Math.abs(dxm) * SLOPE - s * 14 * hash(i, 63);
      g.save(); al(g, 1 - s); g.shadowColor = 'rgba(36,18,6,0.3)'; g.shadowBlur = 6; g.shadowOffsetX = 5; g.shadowOffsetY = 6;
      const c0 = Math.max(0, sxs), c1 = Math.min(ks.bw, sxs + w3);
      g.drawImage(ks.c, c0, 0, c1 - c0, ks.bh, Math.round(kx - ks.ax + c0 + dxm), Math.round(GY + 2 - ks.ay + dy), c1 - c0, ks.bh); g.restore();
    }
    // faint traceable residue: slanted dashes, pierced specks and a ghost silhouette that fade slowly
    lastTrail = (A === 1 ? 1 : 0) * span(td, 0.1, 0.4) * (1 - span(td, 0.78, 1));
    if (lastTrail > 0.01) {
      g.save(); g.lineCap = 'round'; g.strokeStyle = COL.dark; g.lineWidth = 1.6;
      [[790, GY - 46, 1], [566, GY - 120, 1], [714, GY - 120, 1], [590, GY - 168, 0.7], [690, GY - 168, 0.7]].forEach(([x0, y0, wt], si) => {
        const sg2 = x0 < SPINE ? 1 : -1;
        for (let j = 0; j < 10; j++) {
          const u = (j + 0.5) / 10, x = x0 + (SPINE - x0) * u * 0.92, y = y0 - Math.abs(x - x0) * SLOPE + (hash(j + si * 10, 80) - 0.5) * 12;
          g.globalAlpha = 0.36 * lastTrail * (1 - 0.4 * u) * wt;
          if (j % 3 === 2) { g.beginPath(); g.ellipse(x, y + 5, 2.4, 1.7, 0, 0, 7); g.stroke(); } else { g.beginPath(); g.moveTo(x, y); g.lineTo(x + sg2 * 9, y - 9 * SLOPE); g.stroke(); }
        }
      });
      g.restore(); al(g, 0.2 * lastTrail); put(g, ks, SPINE + 52, GY - 36, { sx: 0.4, cast: false, tilt: -0.12 }); al(g, 1);
    }
    al(g, 1);
  }

  // ---- the shade on the back of the paper: unlit by the candle, mirrored, casts toward the light ----
  function shade(g, h, light, flip, time, reduced, ak) {
    if (h <= 0.002) return null;
    const v = C.shadeVector(SHADE.x, SHADE.y - 70, light.x, light.y), f = 1 - 2 * ak; // the anomaly flips the response
    const lean = reduced ? 0 : clamp(v.x * f, -1, 1) * 0.16 * h;
    const arm = flip > 0 ? Math.sin(Math.min(1, flip) * Math.PI) : 0; // raises its lantern when the leaf is turned
    const d = 34 * h, sp = keeperSprite(true, arm);
    const sl = shadeL.getContext('2d'); sl.clearRect(0, 0, W, H);
    for (let k = 5; k >= 1; k--) { sl.globalAlpha = 0.07 * h * (6 - k) / 5; put(sl, sp, SHADE.x + v.x * f * d * k * 0.45, SHADE.y + v.y * f * d * k * 0.2, { flip: true, rot: lean, cast: false }); }
    sl.globalAlpha = 0.72 * h; put(sl, sp, SHADE.x, SHADE.y, { flip: true, rot: lean + (reduced ? 0 : Math.sin(time * 1.1) * 0.01), cast: false });
    // the same cut outline continues from the back of the turning leaf: mirrored across the spine, squeezed with the leaf
    let echo = null;
    const ea = flip > 0.5 ? Math.sin(Math.PI * (2 * flip - 1)) : 0, k2 = reduced ? 1 : Math.abs(Math.cos(Math.PI * flip));
    if (ea > 0.001) {
      const xm = 2 * SPINE - SHADE.x;
      sl.save(); sl.translate(SPINE, 0); sl.scale(k2, 1); sl.translate(-SPINE, 0); sl.globalAlpha = 0.72 * h * ea; put(sl, sp, xm, SHADE.y, { flip: false, rot: -lean, cast: false }); sl.restore();
      echo = { x0: SPINE + (xm + KB.x0 - SPINE) * k2, x1: SPINE + (xm + KB.x1 - SPINE) * k2, y0: SHADE.y + KB.y0, y1: SHADE.y + KB.y1, k: k2, alpha: ea };
    }
    g.save(); g.globalCompositeOperation = 'multiply'; g.filter = 'blur(0.8px)'; g.drawImage(shadeL, 100, 150, 1080, 360, 100, 150, 1080, 360); g.restore(); g.filter = 'none'; g.globalAlpha = 1;
    if (ak > 0.02) { // pencilled cue: where the shade should have leaned (toward the candle)
      g.save(); g.setLineDash([6, 6]); g.strokeStyle = 'rgba(138,58,26,' + (0.6 * ak).toFixed(2) + ')'; g.lineWidth = 2;
      const y0 = SHADE.y - 70, x1 = SHADE.x + v.x * 110, y1 = y0 + v.y * 110;
      g.beginPath(); g.moveTo(SHADE.x, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(x1, y1, 4, 0, 7); g.stroke(); g.restore();
    }
    return { x: SHADE.x, y: SHADE.y, toward: v, lean, arm, castX: v.x * f * d, castY: v.y * f * d * 0.2, anomK: ak, bounds: { x0: SHADE.x - KB.x1, x1: SHADE.x - KB.x0, y0: SHADE.y + KB.y0, y1: SHADE.y + KB.y1 }, echo };
  }

  function inkBlots(g, a, y) {
    if (a <= 0.01) return;
    for (let i = 0; i < 46; i++) {
      const at = hash(i, 71) * 0.8, k = smooth((a - at) / 0.25); if (k <= 0) continue;
      const x = 676 + hash(i, 72) * 460, yy = y - 14 + hash(i, 73) * 30, r = (4 + hash(i, 74) * 13) * k;
      const gr = g.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, 'rgba(25,20,40,' + (0.32 * k) + ')'); gr.addColorStop(1, 'rgba(25,20,40,0)'); g.fillStyle = gr; g.fillRect(x - r, yy - r, 2 * r, 2 * r);
    }
  }

  // ---- page-curl model: the leaf rises toward the gutter and curls at the fore-edges, so light and puppets squeeze horizontally there ----
  const GW = (d, s) => Math.exp(-(d / s) * (d / s));
  const sc = (x) => 1 - 0.3 * GW(x - SPINE, 92) - 0.12 * GW(x - PAGE.x0 - 18, 60) - 0.12 * GW(x - PAGE.x1 + 18, 60);
  const POS = new Float32Array(W + 2);
  (function () {
    const raw = new Float32Array(W + 2); let acc = 0;
    for (let x = SPINE + 1; x <= W + 1; x++) { acc += sc(x - 0.5); raw[x] = acc; }
    acc = 0; for (let x = SPINE - 1; x >= 0; x--) { acc -= sc(x + 0.5); raw[x] = acc; }
    for (let x = 0; x <= W + 1; x++) { const L = x < SPINE ? SPINE - PAGE.x0 : PAGE.x1 - SPINE, f = Math.min(1, Math.abs(x - SPINE) / L); POS[x] = SPINE + raw[x] + (x - SPINE - raw[x]) * f; }
  })();
  const wsc = (x) => { x = clamp(Math.round(x), 1, W - 1); return (POS[x + 1] - POS[x - 1]) / 2; };
  const WS = 8;
  function strips(dst, src, x0, x1, y0, y1, aFn) { // draw src into dst in vertical strips, remapped by POS, with per-strip brightness
    for (let xs = x0; xs < x1; xs += WS) {
      const xe = Math.min(x1, xs + WS), d0 = Math.round(POS[xs]), d1 = Math.round(POS[xe]); if (d1 <= d0) continue;
      dst.globalAlpha = aFn(xs + WS / 2); dst.drawImage(src, xs, y0, xe - xs, y1 - y0, d0, y0, d1 - d0, y1 - y0);
    }
    dst.globalAlpha = 1;
  }
  const aPuppet = (x) => 1 - 0.18 * GW(x - SPINE, 40);
  const aGlow = (x) => clamp(0.75 + 0.25 * GW(Math.abs(x - SPINE) - 70, 34) - 0.3 * GW(x - SPINE, 24));

  const shadeL = mk(W, H), P = mk(W, H), M = mk(W, H), WL = mk(W, H), GL = mk(W, H), snap = mk(W, H);
  const pg = P.getContext('2d'), mg = M.getContext('2d'), wg = WL.getContext('2d'), gl = GL.getContext('2d'), sg = snap.getContext('2d');
  let rodShade = null, rodWarp = null;

  // s: {td, time, glow, light:{x,y}, w, t, haunt, flip, reduced, anomK}
  function draw(g, s) {
    LP = s.light;
    g.clearRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(book, 0, 0);
    const fl = s.reduced ? 0 : 0.04 * Math.sin(s.time * 7.3) + 0.03 * Math.sin(s.time * 3.1);
    const glow = clamp(s.glow + fl * s.glow), lx = s.light.x, ly = s.light.y, R = 150 + 780 * s.glow;
    // warm paper where the flame shines through: drawn flat, then bent over the curl in strips
    gl.clearRect(PAGE.x0, PAGE.y0, PAGE.x1 - PAGE.x0, PAGE.y1 - PAGE.y0);
    let gr = gl.createRadialGradient(lx, ly, 0, lx, ly, R * 0.9); gr.addColorStop(0, 'rgba(255,170,60,' + clamp(0.67 * glow) + ')'); gr.addColorStop(0.5, 'rgba(255,150,40,' + clamp(0.27 * glow) + ')'); gr.addColorStop(1, 'rgba(255,140,30,0)');
    gl.fillStyle = gr; gl.fillRect(PAGE.x0, PAGE.y0, PAGE.x1 - PAGE.x0, PAGE.y1 - PAGE.y0);
    gr = gl.createRadialGradient(lx, ly, 0, lx, ly, 70); gr.addColorStop(0, 'rgba(255,230,160,' + clamp(0.73 * glow) + ')'); gr.addColorStop(1, 'rgba(255,200,100,0)');
    gl.fillStyle = gr; gl.fillRect(lx - 70, ly - 70, 140, 140);
    g.save(); g.globalCompositeOperation = 'lighter'; strips(g, GL, PAGE.x0, PAGE.x1, PAGE.y0, PAGE.y1, aGlow); g.restore();
    // puppet layer
    pg.clearRect(140, 140, 1000, 360); pg.globalCompositeOperation = 'source-over';
    if (s.reduced && s.td > 0.002 && s.td < 0.998) { A = 1 - smooth(s.td); world(pg, 0, 0); A = smooth(s.td); world(pg, 1, 0); A = 1; lastTrail = 0; }
    else { A = 1; world(pg, s.td, s.reduced ? 0 : s.time); }
    mg.globalCompositeOperation = 'source-over'; mg.globalAlpha = 1; mg.clearRect(140, 140, 1000, 360); mg.drawImage(P, 140, 140, 1000, 360, 140, 140, 1000, 360);
    mg.globalCompositeOperation = 'destination-out'; mg.globalAlpha = 0.5; mg.drawImage(fibre, 140, 140, 1000, 360, 140, 140, 1000, 360); mg.globalAlpha = 1;
    mg.globalCompositeOperation = 'destination-in';
    gr = mg.createRadialGradient(lx, ly, 0, lx, ly, R); gr.addColorStop(0, 'rgba(0,0,0,' + glow + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + (0.88 * glow) + ')'); gr.addColorStop(1, 'rgba(0,0,0,' + (0.4 * glow) + ')');
    mg.fillStyle = gr; mg.fillRect(140, 140, 1000, 360); mg.globalCompositeOperation = 'source-over';
    wg.clearRect(0, 140, W, 360); strips(wg, M, 140, 1140, 140, 500, aPuppet);
    g.save(); g.globalCompositeOperation = 'multiply'; g.filter = 'blur(0.9px)'; g.drawImage(WL, 140, 140, 1000, 360, 140, 140, 1000, 360); g.restore(); g.filter = 'none';
    // ink and nib on the fact line
    inkBlots(g, s.inkA, 530);
    if (s.pen > 0.001) { const x = 676 + s.w * 450, y = 530; g.save(); g.globalAlpha = s.pen; g.strokeStyle = '#2a1c14'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 34, y - 70); g.stroke(); poly(g, [[x + 34, y - 70], [x + 70, y - 120], [x + 56, y - 66]], '#efe3c4', '#2a1c14'); g.restore(); }
    // page turn: the leaf squeezes toward the spine; its back shows the same silhouette, mirrored; the shade itself does not turn with it
    if (s.flip > 0.001) {
      sg.clearRect(0, 0, W, H); sg.drawImage(g.canvas, 0, 0);
      const k = s.reduced ? 1 : Math.abs(Math.cos(Math.PI * s.flip)), x0 = SPINE, wdt = PAGE.x1 - SPINE, back = s.flip > 0.5 ? Math.sin(Math.PI * (2 * s.flip - 1)) : 0;
      if (s.reduced) { g.save(); g.globalAlpha = 0.5 * Math.sin(Math.PI * s.flip); g.fillStyle = '#e8d9ae'; g.fillRect(x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0); g.restore(); }
      else {
        g.drawImage(book, x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0, x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0);
        g.drawImage(snap, x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0, x0, PAGE.y0, wdt * k, PAGE.y1 - PAGE.y0);
        g.save(); g.globalAlpha = back; g.fillStyle = '#dccb98'; g.fillRect(x0, PAGE.y0, wdt * k, PAGE.y1 - PAGE.y0); g.restore();
        g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(x0 + wdt * k, PAGE.y0, 6, PAGE.y1 - PAGE.y0);
      }
    }
    rodShade = shade(g, s.haunt, s.light, s.flip, s.time, s.reduced, s.anomK || 0);
    rodWarp = { spine: wsc(SPINE), mid: wsc(900), spot: wsc(lx), edge: wsc(PAGE.x1 - 18) };
    return { shade: rodShade, warp: rodWarp, trail: lastTrail };
  }

  // canvas positions (after the page curl) of one pierced robe hole and one solid robe spot on the gatekeeper at t=0
  const probe = () => ({ hole: { x: POS[790], y: GY + 2 - 62 }, body: { x: POS[796], y: GY + 2 - 55.75 } });

  window.BSPaint = { W, H, mk, draw, PAGE, SPINE, SHADE, KB, probe, lastShade: () => rodShade };
})();
