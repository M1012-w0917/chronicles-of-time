// V4 paint: canvas 2D, fully procedural. Browser global V4Paint.
// One world function drawWorld(g, t, time) paints CAM-07; the photos, map and portrait are derived from the same t.
(function (root) {
  'use strict';
  const C = root.V4Core;
  const { clamp, smooth, lerp, span, hash } = C;
  const W = 640, H = 400;

  function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, k) { const A = rgb(a), B = rgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')'; }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function drawPerson(g, x, y, s, a, heading) {
    const rad = heading * Math.PI / 180, ch = Math.cos(rad);
    g.save(); g.globalAlpha *= a;
    g.fillStyle = '#17191b';
    g.beginPath(); g.moveTo(x - 5 * s, y); g.lineTo(x - 4 * s, y - 14 * s); g.lineTo(x + 4 * s, y - 14 * s); g.lineTo(x + 5 * s, y); g.closePath(); g.fill();
    g.fillStyle = '#8a3a2e'; g.fillRect(x - 3.5 * s, y - 15.4 * s, 7 * s, 1.8 * s);
    const hy = y - 18.6 * s, rx = s * (1.3 + 2.1 * Math.abs(ch)), ry = 3.4 * s;
    g.fillStyle = ch < 0 ? '#0e0e0f' : '#cfc4b0';
    g.beginPath(); g.ellipse(x, hy, rx, ry, 0, 0, 6.2832); g.fill();
    if (ch > 0.25) { // eyes: dark, fixed on the lens
      g.fillStyle = '#16120f'; const e = 1.15 * s * ch, k = clamp((ch - 0.25) / 0.5);
      g.globalAlpha *= k; g.fillRect(x - e - 0.5 * s, hy - 0.6 * s, 1 * s, 1.2 * s); g.fillRect(x + e - 0.5 * s, hy - 0.6 * s, 1 * s, 1.2 * s);
    }
    g.restore();
  }

  function drawWorld(g, t, time) {
    const q = C.quay(t);
    // sky, moon, far treeline
    let gr = g.createLinearGradient(0, 0, 0, 175);
    gr.addColorStop(0, mix('#222d36', '#2a3736', q.sky)); gr.addColorStop(1, mix('#68766f', '#7c8878', q.sky));
    g.fillStyle = gr; g.fillRect(0, 0, W, 175);
    g.fillStyle = 'rgba(225,225,205,0.8)'; g.beginPath(); g.arc(520, 48, 14, 0, 6.2832); g.fill();
    g.fillStyle = '#25302d'; g.beginPath(); g.moveTo(0, 175);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, 160 - hash(x, 2) * 14 - 6 * Math.sin(x * 0.02));
    g.lineTo(W, 175); g.fill();
    // warehouse on the far bank
    if (q.warehouse > 0.01) {
      const wh = 62 * q.warehouse, base = 176;
      g.fillStyle = '#3b3834'; g.fillRect(470, base - wh, 130, wh);
      g.fillStyle = '#2b2927'; g.beginPath(); g.moveTo(462, base - wh); g.lineTo(535, base - wh - 26 * q.warehouse); g.lineTo(608, base - wh); g.fill();
      g.fillStyle = 'rgba(232,190,100,' + (0.8 * q.warehouse) + ')';
      for (let i = 0; i < 4; i++) g.fillRect(482 + i * 30, base - wh * 0.7, 10, Math.max(0, wh * 0.22));
    }
    g.strokeStyle = '#37422c'; g.lineWidth = 1.5; // far-bank reeds where the warehouse stood
    for (let i = 0; i < 26; i++) { const gx = 465 + hash(i, 40) * 150, hh = (6 + hash(i, 41) * 14) * C.reedGrow(i, q.reeds); if (hh < 0.5) continue; g.beginPath(); g.moveTo(gx, 177); g.lineTo(gx + 2, 177 - hh); g.stroke(); }
    // water
    gr = g.createLinearGradient(0, 172, 0, 380);
    gr.addColorStop(0, mix('#59675f', '#5e6a58', q.silt)); gr.addColorStop(1, mix('#2b3a3c', '#4a4a37', q.silt * 0.7));
    g.fillStyle = gr; g.fillRect(0, 172, W, 228);
    g.fillStyle = 'rgba(225,225,205,0.12)'; g.fillRect(512, 175, 16, 140);
    g.strokeStyle = 'rgba(220,230,220,0.16)'; g.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const y = 182 + hash(i, 5) * 150, sp = 6 + hash(i, 6) * 14, x = ((hash(i, 8) * 760 + time * sp) % 760) - 60, len = 10 + hash(i, 9) * 36;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    }
    // lock gate on its footing (all of it sinks and swings away with t)
    if (q.postH > 0.02) {
      const ph = q.postH, top = 250 - 84 * ph;
      g.fillStyle = '#5b5850'; g.fillRect(268, 256 - 12 * ph, 104, 12 * ph);
      g.fillStyle = '#6a5a3e'; g.fillRect(282, top, 8, 84 * ph); g.fillRect(352, top, 8, 84 * ph);
      g.fillRect(282, top, 78, 5);
      const lw = 31 * Math.cos(q.gateOpen * Math.PI / 2) * q.gateLen, lh = 56 * ph, ly = 250 - lh;
      g.fillStyle = '#4a3a26';
      if (lw > 0.4) { g.fillRect(290, ly, lw, lh - 2); g.fillRect(352 - lw, ly, lw, lh - 2); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      for (let k = 1; k < 5 && lw > 3; k++) { const yy = ly + k * (lh - 2) / 5; g.beginPath(); g.moveTo(290, yy); g.lineTo(290 + lw, yy); g.moveTo(352 - lw, yy); g.lineTo(352, yy); g.stroke(); }
      if (q.figure > 0.01) { // Chen, erased from the feet up
        const base = top, vis = 30 * q.figure;
        g.save(); g.beginPath(); g.rect(300, base - 30, 40, vis); g.clip();
        drawPerson(g, 320, base, 1.1, Math.sqrt(q.figure), 180); g.restore();
      }
    }
    // reflection of the footing in the water, ripples around where it stood
    g.strokeStyle = 'rgba(220,230,220,' + (0.2 * (1 - q.postH)) + ')';
    g.beginPath(); g.ellipse(320, 254, 40 + 6 * Math.sin(time), 3, 0, 0, 6.2832); g.stroke();
    // ground: quay wall to silted bank
    const sy = q.shoreY;
    g.save(); g.beginPath(); g.moveTo(0, 400);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, sy + q.shore * (5 * Math.sin(x * 0.045 + 1) + 4 * (hash(x, 3) - 0.5)));
    g.lineTo(W, 400); g.closePath(); g.clip();
    g.fillStyle = mix('#3c3b38', '#5b4c36', q.silt); g.fillRect(0, 280, W, 130);
    g.fillStyle = mix('#76725f', '#7a6a4c', q.silt); g.fillRect(0, sy - 2, W, 10);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 17; c++) {
      const i = r * 17 + c, gone = C.brickGone(i, q.crumble); if (gone >= 1) continue;
      const bx = -20 + c * 40 + (r % 2) * 20, by = 298 + r * 15 + gone * 30;
      if (by + 15 < sy - 2) continue;
      g.globalAlpha = 1 - gone * gone; g.fillStyle = mix('#6a665c', '#4f4a3e', hash(i, 1));
      g.fillRect(bx + 1 + gone * (hash(i, 2) - 0.5) * 14, by + 1, 38, 13);
    }
    g.globalAlpha = 1; g.restore();
    // lamp on the quay
    if (q.lamp > 0.02) {
      const lb = sy - 2, lh = 70 * q.lamp;
      gr = g.createRadialGradient(110, lb - lh, 2, 110, lb - lh, 60);
      gr.addColorStop(0, 'rgba(255,214,130,' + (0.6 * q.lamp) + ')'); gr.addColorStop(1, 'rgba(255,214,130,0)');
      g.fillStyle = gr; g.fillRect(40, lb - lh - 60, 140, 120);
      g.fillStyle = '#1d1e1e'; g.fillRect(108, lb - lh, 4, lh); g.fillRect(104, lb - lh - 6, 12, 7);
    }
    // reeds on the new bank
    for (let i = 0; i < 90; i++) {
      const gr2 = C.reedGrow(i, q.reeds); if (gr2 < 0.02) continue;
      const bx = -10 + hash(i, 3) * 660, by = sy + 4 + hash(i, 5) * (396 - sy), sc = 0.6 + (by - sy) / 60;
      const hh = (16 + hash(i, 9) * 40) * gr2 * sc, sw = Math.sin(time * 1.3 + i) * 1.6 * (hh / 40);
      g.strokeStyle = mix('#34421f', '#6a7544', hash(i, 12)); g.lineWidth = 1.4 * sc;
      for (let b = -1; b <= 1; b++) { g.beginPath(); g.moveTo(bx + b * 2 * sc, by); g.quadraticCurveTo(bx + b * 3 * sc, by - hh * 0.5, bx + b * 5 * sc + sw + b * hh * 0.1, by - hh); g.stroke(); }
      if (hh > 14) { g.fillStyle = '#8b7d5a'; g.beginPath(); g.ellipse(bx + sw, by - hh - 2 * sc, 1.4 * sc, 4 * sc, 0, 0, 6.2832); g.fill(); }
    }
    gr = g.createLinearGradient(0, 150, 0, 215); gr.addColorStop(0, 'rgba(210,220,205,0)'); gr.addColorStop(0.5, 'rgba(210,220,205,0.13)'); gr.addColorStop(1, 'rgba(210,220,205,0)');
    g.fillStyle = gr; g.fillRect(0, 150, W, 65);
  }

  // ---- CRT feed ----
  let scan = null, noise = null;
  function prep() {
    if (scan) return;
    scan = mk(4, 4); const s = scan.getContext('2d'); s.fillStyle = 'rgba(0,0,0,0.22)'; s.fillRect(0, 0, 4, 1); s.fillStyle = 'rgba(0,0,0,0.10)'; s.fillRect(0, 2, 4, 1);
    noise = mk(160, 100); const n = noise.getContext('2d'), d = n.createImageData(160, 100);
    for (let i = 0; i < 160 * 100; i++) { const v = hash(i, 99) * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    n.putImageData(d, 0, 0);
  }

  // o: { time, frame, jitter 0..1, haunt (hauntState), reduced, wc (world canvas), compare 0..1, writing 0..1 }
  function drawCam(g, o) {
    prep();
    const wc = o.wc;
    g.save(); g.imageSmoothingEnabled = true;
    if (o.jitter > 0.01) {
      for (let y = 0; y < H; y += 8) {
        const dx = o.jitter * (4 * Math.sin(y * 0.09 + o.time * 23) + 2 * (hash(y + o.frame % 7, 4) - 0.5));
        g.drawImage(wc, 0, y, W, 8, dx, y, W, 8);
      }
      const yb = (o.time * 80) % H; g.drawImage(wc, 0, yb, W, 14, o.jitter * 26, yb, W, 14);
    } else g.drawImage(wc, 0, 0, W, H);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(176,214,184)'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
    const hs = o.haunt;
    if (hs && hs.tape > 0.01) drawTape(g, o, hs);
    g.fillStyle = g.createPattern(scan, 'repeat'); g.fillRect(0, 0, W, H);
    if (!o.reduced) { g.globalAlpha = 0.05; g.drawImage(noise, 0, 0, 160, 100, -((o.frame * 37) % 40), -((o.frame * 53) % 30), W + 80, H + 60); g.globalAlpha = 1; }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // overlay text
    g.font = 'bold 15px monospace'; g.fillStyle = 'rgba(235,240,225,0.92)'; g.textBaseline = 'top';
    g.fillText('CAM-07  FERRY QUAY E.', 14, 12);
    const sec = Math.floor(o.time) % 60;
    g.fillText('2019-03-11 23:41:' + (sec < 10 ? '0' : '') + sec, 14, H - 28);
    if (o.reduced || Math.floor(o.time * 1.5) % 2 === 0) { g.fillStyle = '#d33'; g.beginPath(); g.arc(W - 78, 20, 5, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(235,240,225,0.92)'; g.fillText('REC', W - 66, 12); }
    if (o.compare > 0.02) { g.fillStyle = 'rgba(235,240,225,' + o.compare + ')'; g.fillText('COMPARE: OLD', 14, 32); }
    g.restore();
  }

  function drawTape(g, o, hs) {
    const px = 396, py = 36, pw = 232, ph = 146, a = hs.tape;
    // analytics box on the main frame, where the live image shows only open water
    if (hs.figure > 0.3) {
      g.strokeStyle = 'rgba(120,255,150,' + (0.85 * a) + ')'; g.lineWidth = 1.5; g.strokeRect(298, 206, 44, 52);
      g.font = '11px monospace'; g.fillStyle = 'rgba(120,255,150,' + (0.9 * a) + ')'; g.textBaseline = 'top'; g.fillText('PERSON 1', 298, 193);
    }
    g.save(); g.globalAlpha = a; g.beginPath(); g.rect(px, py, pw, ph); g.clip();
    g.imageSmoothingEnabled = false; g.drawImage(o.wc, 283, 226, 75, 47, px, py, pw, ph); g.imageSmoothingEnabled = true;
    g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,0.9)'; g.fillRect(px, py, pw, ph); g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(18,16,12,0.28)'; g.fillRect(px, py, pw, ph);
    const fx = px + pw / 2, fy = py + (250 - 226) * (ph / 47) + 6;
    g.strokeStyle = 'rgba(210,220,210,0.45)'; g.lineWidth = 1;
    for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(fx, fy, 26 + k * 12 + (o.reduced ? 0 : 3 * Math.sin(o.time * 2 + k)), 4 + k * 2, 0, 0, 6.2832); g.stroke(); }
    drawPerson(g, fx, fy, 2.6, hs.figure, hs.heading);
    if (!o.reduced) { const yb = py + ((o.time * 40) % ph); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px, yb, pw, 6); }
    g.fillStyle = g.createPattern(scan, 'repeat'); g.fillRect(px, py, pw, ph);
    g.restore();
    g.strokeStyle = 'rgba(235,235,220,' + a + ')'; g.lineWidth = 1; g.strokeRect(px, py, pw, ph);
    g.font = '11px monospace'; g.fillStyle = 'rgba(235,225,150,' + a + ')'; g.textBaseline = 'top';
    g.fillText('TAPE LOOP ' + C.TAPE_DATE, px, py + ph + 3);
  }

  // ---- documents derived from the same t ----
  const PAPER = '#d9d0b8';
  function sepia(g, x, y, w, h, k) { g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(190,150,95,' + k + ')'; g.fillRect(x, y, w, h); g.globalCompositeOperation = 'source-over'; }
  function drawPhoto(g, wc, sx, sy, sw, sh) {
    const w = g.canvas.width, h = g.canvas.height;
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    g.drawImage(wc, sx, sy, sw, sh, 6, 6, w - 12, h - 12);
    sepia(g, 6, 6, w - 12, h - 12, 0.6);
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,0,0.35)');
    g.fillStyle = v; g.fillRect(6, 6, w - 12, h - 12);
  }
  function drawPortrait(g, t) {
    const w = g.canvas.width, h = g.canvas.height, p = 1 - span(t, 0.2, 0.8);
    g.fillStyle = PAPER; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8b908c'; g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#1b1d1f'; g.beginPath(); g.ellipse(w / 2, h - 6, w * 0.34, h * 0.3, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#8a3a2e'; g.fillRect(w / 2 - 12, h * 0.62, 24, 5);
    g.fillStyle = '#cfc4b0'; g.beginPath(); g.ellipse(w / 2, h * 0.42, w * 0.17, h * 0.2, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#16120f'; g.fillRect(w / 2 - 12, h * 0.4, 5, 3); g.fillRect(w / 2 + 7, h * 0.4, 5, 3);
    sepia(g, 6, 6, w - 12, h - 12, 0.5);
    g.fillStyle = 'rgba(217,208,184,' + (1 - p) + ')'; g.fillRect(6, 6, w - 12, h - 12); // the print blanks out to paper
    g.strokeStyle = 'rgba(90,80,60,' + (0.35 * (1 - p)) + ')'; g.strokeRect(6.5, 6.5, w - 13, h - 13); // pale impression of the frame
  }
  function drawMap(g, t) {
    const w = g.canvas.width, h = g.canvas.height, q = C.quay(t);
    g.fillStyle = '#d6c9a2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,100,60,0.25)'; g.lineWidth = 1;
    for (let x = 20; x < w; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 20; y < h; y += 30) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // river with a bank that migrates south-east and silts up
    g.fillStyle = '#8fa4a0'; g.beginPath(); g.moveTo(0, h * 0.28);
    for (let x = 0; x <= w; x += 10) g.lineTo(x, h * 0.28 + 10 * Math.sin(x * 0.03));
    for (let x = w; x >= 0; x -= 10) g.lineTo(x, h * 0.62 + 10 * Math.sin(x * 0.03 + 1) + q.shore * (22 + 4 * Math.sin(x * 0.08)));
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(110,90,50,' + (0.5 * q.silt) + ')';
    for (let i = 0; i < 70 * q.silt; i++) { const x = hash(i, 21) * w, y = h * 0.62 + 10 * Math.sin(x * 0.03 + 1) + q.shore * 22 - hash(i, 22) * 24 * q.shore; g.fillRect(x, y, 2, 2); }
    // the lock symbol and its pin
    const cx = w * 0.5, cy = h * 0.44;
    g.globalAlpha = q.postH; g.fillStyle = '#4a3a26'; g.fillRect(cx - 20, cy - 3, 14, 6); g.fillRect(cx + 6, cy - 3, 14, 6); g.fillRect(cx - 22, cy - 9, 4, 18); g.fillRect(cx + 18, cy - 9, 4, 18);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(70,50,30,0.9)'; g.font = '10px serif'; g.textBaseline = 'alphabetic';
    g.globalAlpha = q.postH; g.fillText('FERRY LOCK', cx - 28, cy + 24); g.globalAlpha = 1;
    g.globalAlpha = span(t, 0.6, 1); g.fillText('NO LOCK ON RECORD', cx - 46, cy + 24); g.globalAlpha = 1;
    const dash = span(t, 0.3, 0.9);
    g.lineWidth = 2; g.strokeStyle = '#a02a22'; g.fillStyle = 'rgba(160,42,34,' + (1 - dash) + ')';
    g.setLineDash(dash > 0.05 ? [3, 3] : []);
    g.beginPath(); g.arc(cx, cy - 20 - 3 * dash, 6, 0, 6.2832); g.fill(); g.stroke(); g.setLineDash([]);
    g.beginPath(); g.moveTo(cx, cy - 14 - 3 * dash); g.lineTo(cx, cy - 4); g.stroke();
    g.fillStyle = 'rgba(70,50,30,0.8)'; g.fillText('N', w - 14, 14); g.beginPath(); g.moveTo(w - 10, 18); g.lineTo(w - 10, 34); g.stroke();
  }

  root.V4Paint = { W, H, mk, mix, drawPerson, drawWorld, drawCam, drawPhoto, drawPortrait, drawMap };
})(typeof self !== 'undefined' ? self : this);
