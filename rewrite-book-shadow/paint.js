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

  // ---- puppets ----
  const COL = { red: '#d2452f', ochre: '#e6a93c', teal: '#3e9c92', dark: '#2a1c14', sun: '#e8702a', hill: '#6f7f5a', hill2: '#9a8a5a' };
  let A = 1; // alpha multiplier (reduced-motion cross-fade)
  const al = (g, a) => { g.globalAlpha = A * clamp(a); };

  function keeper(g, x, y, o) { // origin at the feet, about 130 px tall
    o = o || {};
    g.save(); g.translate(x, y); g.scale(o.flip ? -1 : 1, 1); if (o.rot) g.rotate(o.rot);
    const col = o.color || COL.red, line = o.line || COL.dark;
    g.strokeStyle = line; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-22, -64); g.lineTo(-30, 0); g.stroke(); // staff
    poly(g, [[-26, 0], [-17, -72], [17, -72], [28, 0]], col, line);
    poly(g, [[-18, -72], [0, -78], [18, -72], [14, -60], [-14, -60]], COL.ochre, line);
    g.fillStyle = COL.ochre; g.beginPath(); g.arc(0, -88, 12, 0, 7); g.fill(); g.strokeStyle = line; g.lineWidth = 2; g.stroke();
    poly(g, [[-24, -96], [0, -118], [24, -96]], COL.teal, line);
    const up = o.arm || 0, ax = 32 + 6 * up, ay = -38 - 56 * up; // arm and lantern
    g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = line; g.beginPath(); g.moveTo(14, -62); g.lineTo(ax, ay); g.stroke();
    g.fillStyle = COL.ochre; g.fillRect(ax - 6, ay, 12, 16); g.strokeStyle = line; g.lineWidth = 1.5; g.strokeRect(ax - 6, ay, 12, 16);
    g.restore();
  }

  function world(g, td, time) {
    const sway = time ? Math.sin(time * 1.3) * 0.012 : 0;
    // dusk sun, present in both worlds so the same sky ties them together
    al(g, 1); g.fillStyle = COL.sun; g.beginPath(); g.arc(930, 262, 36, 0, 7); g.fill();
    // far hills only exist in the new world
    const hill = span(td, 0.42, 0.95);
    if (hill > 0) {
      al(g, hill); const rise = (1 - hill) * 70;
      poly(g, [[150, 400 + rise], [260, 330 + rise], [370, 380 + rise], [470, 300 + rise], [610, 392 + rise], [700, 392], [800, 330 + rise], [930, 300 + rise], [1050, 372 + rise], [1130, 400 + rise]], COL.hill2, COL.dark);
      poly(g, [[150, 420 + rise], [330, 370 + rise], [520, 410 + rise], [760, 360 + rise], [960, 396 + rise], [1130, 420 + rise]], COL.hill, COL.dark);
    }
    // ground
    al(g, 1); g.fillStyle = COL.ochre; g.fillRect(150, GY, 980, 28); g.fillStyle = COL.dark; g.fillRect(150, GY, 980, 3);
    // road
    const road = span(td, 0.34, 0.9);
    al(g, 0.25 + 0.75 * road); const rw = 14 + 120 * road, rt = 8 + 12 * road;
    poly(g, [[SPINE - rt, GY], [SPINE + rt, GY], [SPINE + rw, 478], [SPINE - rw, 478]], '#f2d99a', COL.dark);
    // city wall collapses to boundary stones
    const wall = span(td, 0.18, 0.62), wh = 110 * (1 - wall) + 9;
    [[150, 536], [744, 1130]].forEach(([x0, x1], side) => {
      al(g, 1); g.fillStyle = COL.ochre; g.fillRect(x0, GY - wh, x1 - x0, wh); g.strokeStyle = COL.dark; g.lineWidth = 2; g.strokeRect(x0, GY - wh, x1 - x0, wh);
      for (let r = 0; r * 22 < wh; r++) { const y = GY - wh + r * 22; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); for (let x = x0 + (r % 2) * 30; x < x1; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(y + 22, GY)); g.stroke(); } }
      if (wall < 0.9) for (let x = x0 + 10; x < x1 - 20; x += 44) { al(g, 1 - wall); g.fillStyle = COL.ochre; g.fillRect(x, GY - wh - 14, 26, 14); g.strokeRect(x, GY - wh - 14, 26, 14); }
      void side;
    });
    // gate: roof lifts away, doors open, posts slide apart and fade
    const roof = span(td, 0.04, 0.4), open = span(td, 0.0, 0.26), post = span(td, 0.14, 0.58), pa = 1 - span(td, 0.34, 0.62);
    const px = post * 260;
    if (pa > 0.001) {
      al(g, pa); g.fillStyle = COL.red;
      [[556 - px, 584 - px], [696 + px, 724 + px]].forEach(([a, b]) => { g.fillRect(a, GY - 190, b - a, 190); g.strokeStyle = COL.dark; g.lineWidth = 2; g.strokeRect(a, GY - 190, b - a, 190); });
      const dw = 56 * (1 - open);
      if (open < 0.98) { al(g, pa * (1 - open * 0.6)); g.fillStyle = '#9c3b22'; g.fillRect(584 - px, GY - 160, dw, 160); g.fillRect(696 + px - dw, GY - 160, dw, 160); g.strokeRect(584 - px, GY - 160, dw, 160); g.strokeRect(696 + px - dw, GY - 160, dw, 160); }
      al(g, pa); g.fillStyle = COL.teal; g.fillRect(536 - px, GY - 188, 208 + 2 * px, 20); g.strokeRect(536 - px, GY - 188, 208 + 2 * px, 20);
      al(g, pa * (1 - roof)); const ry = -roof * 70;
      poly(g, [[512 - px, GY - 188 + ry], [640, GY - 238 + ry], [768 + px, GY - 188 + ry], [740 + px, GY - 196 + ry], [640, GY - 224 + ry], [540 - px, GY - 196 + ry]], COL.teal, COL.dark);
      // three lamps rise away like sparks once the keeper is gone
      for (let i = 0; i < 3; i++) {
        const k = span(td, 0.02 + i * 0.05, 0.3 + i * 0.05), lx = 600 + i * 40 + (hash(i, 50) - 0.5) * k * 60, ly = GY - 150 - k * 90;
        al(g, pa * (1 - k)); g.strokeStyle = COL.dark; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lx, GY - 168); g.lineTo(lx, ly); g.stroke();
        g.fillStyle = COL.ochre; g.beginPath(); g.ellipse(lx, ly + 12, 10, 14, 0, 0, 7); g.fill(); g.stroke();
        al(g, pa * (1 - k) * 0.8); g.fillStyle = '#fff1b0'; g.beginPath(); g.arc(lx, ly + 12, 4, 0, 7); g.fill();
      }
    }
    // trees grow in staggered
    [[200, 0.5], [350, 0.56], [930, 0.5], [1040, 0.58], [1100, 0.64]].forEach(([x, a], i) => {
      const k = span(td, a, a + 0.28); if (k <= 0) return; al(g, k);
      const s = 0.4 + 0.6 * k, b = GY + 8; g.save(); g.translate(x, b); g.scale(s, s); g.rotate(sway * (i % 2 ? 1 : -1));
      g.fillStyle = COL.dark; g.fillRect(-4, -50, 8, 50);
      for (let j = 0; j < 3; j++) poly(g, [[-34 + j * 5, -40 - j * 34], [0, -86 - j * 34], [34 - j * 5, -40 - j * 34]], j % 2 ? COL.teal : COL.hill, COL.dark);
      g.restore();
    });
    // the gatekeeper dissolves in vertical slivers of fibre, then is gone
    const kx = 790, N = 9, sw = 12;
    if (td < 0.62) for (let i = 0; i < N; i++) {
      const s = span(td, 0.1 + hash(i, 60) * 0.1, 0.42 + hash(i, 61) * 0.12); if (s >= 1) continue;
      g.save(); g.translate((hash(i, 62) - 0.5) * s * 36, -s * (20 + hash(i, 63) * 60)); g.beginPath(); g.rect(kx - 54 + i * sw * 1.0 + (i * 3), GY - 150, sw + 3, 160); g.clip();
      al(g, 1 - s); keeper(g, kx, GY + 2, { rot: sway * 2, arm: 0 }); g.restore();
    }
    al(g, 1);
  }

  // ---- the shade on the back of the paper: unlit by the candle, mirrored, casts toward the light ----
  function shade(g, h, light, flip, time, reduced) {
    if (h <= 0.002) return null;
    const v = C.shadeVector(SHADE.x, SHADE.y - 70, light.x, light.y);
    const lean = reduced ? 0 : clamp(v.x, -1, 1) * 0.16 * h;
    const arm = flip > 0 ? Math.sin(Math.min(1, flip) * Math.PI) : 0; // raises its lantern when the leaf is turned
    const d = 34 * h;
    const sl = shadeL.getContext('2d'); sl.clearRect(0, 0, W, H); const g0 = g; g = sl;
    for (let k = 5; k >= 1; k--) { g.globalAlpha = 0.07 * h * (6 - k) / 5; keeper(g, SHADE.x + v.x * d * k * 0.45, SHADE.y + v.y * d * k * 0.2, { flip: true, color: '#3a4560', line: '#1d2438', rot: lean, arm }); }
    g.globalAlpha = 0.72 * h; keeper(g, SHADE.x, SHADE.y, { flip: true, color: '#2a3550', line: '#141a2c', rot: lean + (reduced ? 0 : Math.sin(time * 1.1) * 0.01), arm: Math.max(arm, 0) });
    g = g0; g.save(); g.globalCompositeOperation = 'multiply'; g.filter = 'blur(2.2px)'; g.drawImage(shadeL, 100, 150, 560, 360, 100, 150, 560, 360); g.restore(); g.filter = 'none'; g.globalAlpha = 1;
    return { x: SHADE.x, y: SHADE.y, toward: v, lean, arm, castX: v.x * d, castY: v.y * d * 0.2 };
  }

  function inkBlots(g, a, y) {
    if (a <= 0.01) return;
    for (let i = 0; i < 46; i++) {
      const at = hash(i, 71) * 0.8, k = smooth((a - at) / 0.25); if (k <= 0) continue;
      const x = 676 + hash(i, 72) * 460, yy = y - 14 + hash(i, 73) * 30, r = (4 + hash(i, 74) * 13) * k;
      const gr = g.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, 'rgba(25,20,40,' + (0.32 * k) + ')'); gr.addColorStop(1, 'rgba(25,20,40,0)'); g.fillStyle = gr; g.fillRect(x - r, yy - r, 2 * r, 2 * r);
    }
  }

  const shadeL = mk(W, H), P = mk(W, H), M = mk(W, H), snap = mk(W, H);
  const pg = P.getContext('2d'), mg = M.getContext('2d'), sg = snap.getContext('2d');
  let rodShade = null;

  // s: {td, time, glow, light:{x,y}, w, t, haunt, flip, reduced}
  function draw(g, s) {
    g.clearRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(book, 0, 0);
    const fl = s.reduced ? 0 : 0.04 * Math.sin(s.time * 7.3) + 0.03 * Math.sin(s.time * 3.1);
    const glow = clamp(s.glow + fl * s.glow), lx = s.light.x, ly = s.light.y, R = 150 + 780 * s.glow;
    // warm paper where the flame shines through
    let gr = g.createRadialGradient(lx, ly, 0, lx, ly, R * 0.9); gr.addColorStop(0, 'rgba(255,170,60,' + (0.5 * glow) + ')'); gr.addColorStop(0.5, 'rgba(255,150,40,' + (0.2 * glow) + ')'); gr.addColorStop(1, 'rgba(255,140,30,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(PAGE.x0, PAGE.y0, PAGE.x1 - PAGE.x0, PAGE.y1 - PAGE.y0); g.restore();
    // puppet layer
    pg.clearRect(140, 140, 1000, 360); pg.globalCompositeOperation = 'source-over';
    if (s.reduced && s.td > 0.002 && s.td < 0.998) { A = 1 - smooth(s.td); world(pg, 0, 0); A = smooth(s.td); world(pg, 1, 0); A = 1; }
    else { A = 1; world(pg, s.td, s.reduced ? 0 : s.time); }
    mg.globalCompositeOperation = 'source-over'; mg.globalAlpha = 1; mg.clearRect(140, 140, 1000, 360); mg.drawImage(P, 140, 140, 1000, 360, 140, 140, 1000, 360);
    mg.globalCompositeOperation = 'destination-out'; mg.globalAlpha = 0.5; mg.drawImage(fibre, 140, 140, 1000, 360, 140, 140, 1000, 360); mg.globalAlpha = 1;
    mg.globalCompositeOperation = 'destination-in';
    gr = mg.createRadialGradient(lx, ly, 0, lx, ly, R); gr.addColorStop(0, 'rgba(0,0,0,' + glow + ')'); gr.addColorStop(0.55, 'rgba(0,0,0,' + (0.88 * glow) + ')'); gr.addColorStop(1, 'rgba(0,0,0,' + (0.4 * glow) + ')');
    mg.fillStyle = gr; mg.fillRect(140, 140, 1000, 360); mg.globalCompositeOperation = 'source-over';
    g.save(); g.globalCompositeOperation = 'multiply'; g.filter = 'blur(0.9px)'; g.drawImage(M, 140, 140, 1000, 360, 140, 140, 1000, 360); g.restore(); g.filter = 'none';
    // flame hot spot
    gr = g.createRadialGradient(lx, ly, 0, lx, ly, 70); gr.addColorStop(0, 'rgba(255,230,160,' + (0.55 * glow) + ')'); gr.addColorStop(1, 'rgba(255,200,100,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(lx - 70, ly - 70, 140, 140); g.restore();
    // ink and nib on the fact line
    inkBlots(g, s.inkA, 542);
    if (s.pen > 0.001) { const x = 676 + s.w * 450, y = 540; g.save(); g.globalAlpha = s.pen; g.strokeStyle = '#2a1c14'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 34, y - 70); g.stroke(); poly(g, [[x + 34, y - 70], [x + 70, y - 120], [x + 56, y - 66]], '#efe3c4', '#2a1c14'); g.restore(); }
    // page turn: the leaf squeezes toward the spine; the shade does not turn with it
    if (s.flip > 0.001) {
      sg.clearRect(0, 0, W, H); sg.drawImage(g.canvas, 0, 0);
      const k = s.reduced ? 1 : Math.abs(Math.cos(Math.PI * s.flip)), x0 = SPINE, wdt = PAGE.x1 - SPINE;
      if (s.reduced) { g.save(); g.globalAlpha = 0.5 * Math.sin(Math.PI * s.flip); g.fillStyle = '#e8d9ae'; g.fillRect(x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0); g.restore(); }
      else {
        g.drawImage(book, x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0, x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0);
        g.drawImage(snap, x0, PAGE.y0, wdt, PAGE.y1 - PAGE.y0, x0, PAGE.y0, wdt * k, PAGE.y1 - PAGE.y0);
        g.fillStyle = 'rgba(30,18,6,0.35)'; g.fillRect(x0 + wdt * k, PAGE.y0, 6, PAGE.y1 - PAGE.y0);
      }
    }
    rodShade = shade(g, s.haunt, s.light, s.flip, s.time, s.reduced);
    return { shade: rodShade };
  }

  window.BSPaint = { W, H, mk, draw, PAGE, SPINE, SHADE, lastShade: () => rodShade };
})();
