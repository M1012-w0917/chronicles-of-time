// V7 paint: Canvas 2D renderer. Every tracked thread is drawn individually, back to front by layer and by how far it is lifted
// out of the cloth, with a shadow on the cloth and a dark casing so it reads against what it passes in front of.
// The world is never cross-faded: the ground polygons, the threads and the camera swing are all geometry driven by t.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.V7Paint = factory(root.V7Core);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { W, H, N, CX, lerp, span, smooth, clamp } = C;
  const F = { x: 100, y: 96, w: 1080, h: 476 }; // the cloth on the loom
  const mk = (w, h) => { const c = (typeof document !== 'undefined') ? document.createElement('canvas') : null; if (c) { c.width = w; c.height = h; } return c; };
  const hsl = (h, s, l, a) => 'hsla(' + h.toFixed(0) + ',' + s.toFixed(0) + '%,' + l.toFixed(0) + '%,' + (a == null ? 1 : a) + ')';

  // ---- cached: loom frame, wooden beams, heddle bar ----
  let loomC = null, weaveC = null;
  function buildLoom() {
    loomC = mk(W, H); const g = loomC.getContext('2d'), R = C.rng(7);
    const wood = (x, y, w, h, vertical) => {
      const gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#5a3a22'); gr.addColorStop(0.35, '#7a5130'); gr.addColorStop(0.7, '#5d3b22'); gr.addColorStop(1, '#3a2313');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(25,12,5,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < (vertical ? 14 : 22); i++) {
        g.beginPath();
        if (vertical) { const gx = x + R() * w; g.moveTo(gx, y); g.bezierCurveTo(gx + 3, y + h * 0.3, gx - 3, y + h * 0.6, gx + 1, y + h); } else { const gy = y + R() * h; g.moveTo(x, gy); g.bezierCurveTo(x + w * 0.3, gy + 2, x + w * 0.6, gy - 2, x + w, gy + 1); }
        g.stroke();
      }
    };
    g.fillStyle = '#1e140d'; g.fillRect(0, 0, W, H);
    // back wall, warm dark
    const bg = g.createRadialGradient(640, 330, 100, 640, 330, 760); bg.addColorStop(0, '#3b2a1c'); bg.addColorStop(1, '#17100a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    wood(0, 0, 92, H, true); wood(1188, 0, 92, H, true);
    wood(0, 0, W, 54, false); wood(0, 596, W, 84, false);
    // cloth roll at the bottom, a rolled bundle of finished weave
    for (let i = 0; i < 6; i++) { const y = 574 + i * 3; g.fillStyle = 'hsl(36,' + (16 + i * 2) + '%,' + (30 + i * 2) + '%)'; g.fillRect(100, y, 1080, 3); }
    const rl = g.createLinearGradient(0, 566, 0, 600); rl.addColorStop(0, '#6d5a40'); rl.addColorStop(1, '#2b2013'); g.fillStyle = rl; g.fillRect(96, 590, 1088, 8);
    // heddle bar: a bar with a row of heddle eyes and the warp strings
    wood(92, 60, 1096, 18, false);
    g.strokeStyle = 'rgba(210,190,150,0.5)'; g.lineWidth = 1;
    for (let x = 108; x < 1180; x += 9) { g.beginPath(); g.moveTo(x, 78); g.lineTo(x, F.y); g.stroke(); }
    g.fillStyle = '#2a1a0e'; for (let x = 108; x < 1180; x += 36) { g.beginPath(); g.ellipse(x, 69, 3, 5, 0, 0, 6.3); g.fill(); }
    // brass pins on the posts
    for (const x of [46, 1234]) for (const y of [140, 300, 460]) { g.fillStyle = '#a58849'; g.beginPath(); g.arc(x, y, 5, 0, 6.3); g.fill(); g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(x + 1, y + 1.5, 2.2, 0, 6.3); g.fill(); }
  }
  // cached: over and under weave of the cloth, drawn over the ground
  function buildWeave() {
    weaveC = mk(F.w, F.h); const g = weaveC.getContext('2d');
    for (let y = 0; y < F.h; y += 5) {
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y + 3, F.w, 1.4);
      g.fillStyle = 'rgba(255,240,210,0.06)'; g.fillRect(0, y, F.w, 1);
    }
    for (let x = 0; x < F.w; x += 7) {
      for (let y = 0; y < F.h; y += 10) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, y + ((x / 7) % 2 ? 0 : 5), 2, 5); }
    }
    const vg = g.createRadialGradient(F.w / 2, F.h / 2, F.h * 0.35, F.w / 2, F.h / 2, F.w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = vg; g.fillRect(0, 0, F.w, F.h);
  }

  // perspective for a point: layers carry a parallax, lifted threads are scaled toward the viewer
  function xf(x, y, z, layer, v) {
    const s = 1 + 0.16 * z;
    return [CX + (x - CX) * s + v.px * (layer - 1) * 9, 330 + (y - 330) * s - z * 10 + v.py * (layer - 1) * 6];
  }
  function trace(g, P) {
    g.beginPath(); g.moveTo(P[0], P[1]);
    for (let m = 1; m < N - 1; m++) g.quadraticCurveTo(P[2 * m], P[2 * m + 1], (P[2 * m] + P[2 * m + 2]) / 2, (P[2 * m + 1] + P[2 * m + 3]) / 2);
    g.lineTo(P[2 * N - 2], P[2 * N - 1]);
  }
  const halfT = (y, td) => lerp(C.halfOld(y), C.halfNew(y), span(td, 0.28, 0.8));

  function ground(g, v) {
    const td = v.td;
    g.save(); g.beginPath(); g.rect(F.x, F.y, F.w, F.h); g.clip();
    const lg = g.createLinearGradient(0, F.y, 0, F.y + F.h); lg.addColorStop(0, 'hsl(40,22%,24%)'); lg.addColorStop(0.5, 'hsl(38,26%,32%)'); lg.addColorStop(1, 'hsl(34,30%,38%)');
    g.fillStyle = lg; g.fillRect(F.x, F.y, F.w, F.h);
    // river polygon from the same half-width the river threads move toward
    const L = [], Rr = [];
    for (let y = F.y; y <= F.y + F.h; y += 14) { const h = Math.max(halfT(Math.max(y, 130), td), 30) * 1.02; L.push([CX - h, y]); Rr.push([CX + h, y]); }
    const rg = g.createLinearGradient(0, F.y, 0, F.y + F.h); rg.addColorStop(0, 'hsl(212,46%,20%)'); rg.addColorStop(1, 'hsl(204,52%,32%)');
    g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath(); g.fillStyle = rg; g.fill();
    g.strokeStyle = 'rgba(15,10,5,0.5)'; g.lineWidth = 3; g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.beginPath(); Rr.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    // the dark water under each arch is where that bridge's bundle still hangs in the cloth
    for (let i = 0; i < 7; i++) {
      const b = C.BRIDGES[i], pres = v.presence[i];
      if (pres < 0.01) continue;
      g.fillStyle = 'rgba(4,10,18,' + (0.5 * pres).toFixed(3) + ')'; g.beginPath(); g.ellipse(CX, b.y + 3, b.w * 0.92, 5 + i, 0, 0, 6.3); g.fill();
    }
    g.drawImage(weaveC, F.x, F.y);
    g.restore();
  }

  // lamp glow: the keeper's golden thread, bright while it burns on the old bridge
  function lampGlow(g, th, v) {
    const lamp = th, z = lamp.zMax, P = lamp.pts;
    const cx = P[2 * 4], cy = P[2 * 4 + 1], q = xf(cx, cy, z, lamp.layer, v);
    const burn = (1 - lamp.re) * (v.reduced ? 1 : 0.88 + 0.12 * Math.sin(v.time * 7.3) * Math.sin(v.time * 3.1 + 1)) * (0.8 + 0.5 * v.w);
    if (burn < 0.02) return;
    const r = 70 + 40 * z;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(q[0], q[1], 2, q[0], q[1], r); gr.addColorStop(0, 'rgba(255,205,110,' + (0.65 * burn).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,160,40,0)');
    g.fillStyle = gr; g.fillRect(q[0] - r, q[1] - r, r * 2, r * 2); g.restore();
  }

  function drawThread(g, th, v) {
    const P = new Array(N * 2), back = v.dim, zMean = th.z.reduce((a, b) => a + b, 0) / N;
    const sway = v.reduced ? 0 : 1, shake = v.w * (v.reduced ? 0.3 : 1);
    const k = parseInt(th.id.slice(1), 10);
    for (let m = 0; m < N; m++) {
      const u = m / (N - 1), z = th.z[m];
      let x = th.pts[2 * m], y = th.pts[2 * m + 1];
      y += (1 - th.tension) * z * 18 * Math.sin(Math.PI * u); // slack threads hang lower
      const ph = v.time * 1.25 + k * 0.7 + u * 2.4;
      x += sway * Math.sin(ph) * (0.7 + 5 * z) + shake * Math.sin(v.time * 31 + k + m) * 1.4 * (th.mover ? 1 : 0.4);
      y += sway * Math.cos(ph * 0.8) * (0.4 + 3 * z);
      const q = xf(x, y, z, th.layer, v); P[2 * m] = q[0]; P[2 * m + 1] = q[1];
    }
    const lw = th.width * (1 + 0.5 * zMean + 0.3 * v.reachK);
    const L = th.hsl[2] * (1 - 0.42 * back), S = th.hsl[1] * (1 - 0.5 * back);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (th.zMax > 0.04) { // shadow on the cloth and a dark casing
      g.save(); g.translate(14 * th.zMax, 20 * th.zMax); g.strokeStyle = 'rgba(0,0,0,' + (0.3 * th.zMax).toFixed(3) + ')'; g.lineWidth = lw + 3; trace(g, P); g.stroke(); g.restore();
      g.strokeStyle = 'rgba(12,8,4,' + (0.55 * Math.min(1, th.zMax * 2)).toFixed(3) + ')'; g.lineWidth = lw + 2.2; trace(g, P); g.stroke();
    }
    g.strokeStyle = hsl(th.hsl[0], S, L * (0.78 + 0.22 * th.tension)); g.lineWidth = lw; trace(g, P); g.stroke();
    g.strokeStyle = hsl(th.hsl[0], S, Math.min(92, L + 20), 0.6 * (1 - 0.6 * back)); g.lineWidth = Math.max(0.5, lw * 0.35); g.save(); g.translate(0, -lw * 0.28); trace(g, P); g.stroke(); g.restore();
    if (back > 0.4) { // the back of the cloth: loose ends and knots
      g.fillStyle = 'rgba(20,12,8,' + (0.75 * back).toFixed(2) + ')';
      for (const m of [0, N - 1]) { g.beginPath(); g.arc(P[2 * m], P[2 * m + 1], 1.6 + th.layer * 0.5, 0, 6.3); g.fill(); }
    }
  }

  // one stitched hand: fingers drawn as an outline, placed at the end of the red path
  const FING = [[-0.36, 0.78], [-0.12, 0.92], [0.12, 0.84], [0.35, 0.62]];
  const HAND = (() => {
    const p = [[-0.5, 0], [-0.55, -0.5], [-1.0, -0.82], [-1.1, -1.08], [-0.95, -1.16], [-0.58, -0.86]];
    for (const [x, len] of FING) { const hw = 0.1, by = -0.86; p.push([x - hw, by], [x - hw, by - len + hw], [x, by - len], [x + hw, by - len + hw], [x + hw, by]); }
    p.push([0.5, -0.8], [0.5, -0.3], [0.42, 0]);
    const L = [0]; for (let i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    return { p, L, total: L[L.length - 1] };
  })();

  function drawHaunt(g, hv, hp, v) {
    if (hv.h <= 0) return;
    const stitch = hv.stitch;
    const red = 'hsl(2,78%,46%)', dk = 'hsl(2,70%,22%)';
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const run = C.pathPoint(stitch);
    if (run.length > 1) {
      const path = () => { g.beginPath(); run.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
      g.strokeStyle = dk; g.lineWidth = 4.6; g.setLineDash([]); path(); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1; // the thread under the cloth
      g.strokeStyle = red; g.lineWidth = 3; g.setLineDash([11, 6]); path(); g.stroke(); g.setLineDash([]);
      const head = run[run.length - 1];
      if (stitch < 1) { g.fillStyle = 'rgba(255,90,70,0.9)'; g.beginPath(); g.arc(head[0], head[1], 3.4, 0, 6.3); g.fill(); g.strokeStyle = 'rgba(255,120,100,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(head[0], head[1]); g.lineTo(head[0] + 10, head[1] - 22); g.stroke(); }
    }
    if (hp.form > 0.001) {
      const s = hp.s, d = hp.form * HAND.total, pts = [];
      for (let i = 0; i < HAND.p.length; i++) { if (HAND.L[i] <= d) pts.push(HAND.p[i]); else { const a = HAND.p[i - 1], b = HAND.p[i], k = (d - HAND.L[i - 1]) / (HAND.L[i] - HAND.L[i - 1]); pts.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]); break; } }
      const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(hp.x + p[0] * s, hp.y + p[1] * s) : g.moveTo(hp.x + p[0] * s, hp.y + p[1] * s))); };
      if (hp.reach > 0.02 && hp.form > 0.99) { g.save(); g.fillStyle = 'rgba(40,6,4,' + (0.38 * hp.reach).toFixed(3) + ')'; path(); g.closePath(); g.fill(); g.restore(); }
      g.strokeStyle = dk; g.globalAlpha = 0.4; g.lineWidth = 3 + s * 0.03; path(); g.stroke(); g.globalAlpha = 1;
      g.strokeStyle = red; g.lineWidth = 2.4 + s * 0.022; g.setLineDash([Math.max(7, s * 0.08), Math.max(4, s * 0.05)]); path(); g.stroke(); g.setLineDash([]);
    }
    g.restore();
  }

  // v: { td, hd, c, time, reduced, w, px, py, state }
  function draw(g, v) {
    if (!loomC) { buildLoom(); buildWeave(); }
    const td = v.td, hv = C.hauntAt(v.hd), hp = C.handPose(v.hd);
    const th = C.threadsAt(td);
    v.presence = new Array(7).fill(0);
    const cnt = new Array(7).fill(0);
    for (const t of th) if (t.oldRole.indexOf('bridge:') === 0) { const i = t.bridge; v.presence[i] += 1 - t.pull; cnt[i]++; }
    for (let i = 0; i < 7; i++) v.presence[i] = clamp(v.presence[i] / cnt[i]);
    v.dim = span(hv.back, 0.35, 0.85);
    v.reachK = hp.reach;
    const th2 = Math.PI * hv.back, sx = Math.cos(th2), sinT = Math.sin(th2);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.save();
    g.translate(CX, 0); g.scale(sx === 0 ? 0.001 : sx, 1 + 0.02 * sinT); g.translate(-CX, -H * 0.01 * sinT);
    g.drawImage(loomC, 0, 0);
    ground(g, v);
    // threads: far layers first, lifted threads last, so a pulled-out thread passes in front of everything it crosses
    const order = th.slice().sort((a, b) => (a.layer + a.zMax * 3.2) - (b.layer + b.zMax * 3.2) || (a.id < b.id ? -1 : 1));
    // the back of the cloth is seen from behind: a darker wash over the ground, not a different texture
    g.save(); g.beginPath(); g.rect(F.x - 4, F.y - 4, F.w + 8, F.h + 8); g.clip();
    if (v.dim > 0.01) { g.fillStyle = 'rgba(8,6,10,' + (0.42 * v.dim).toFixed(3) + ')'; g.fillRect(F.x, F.y, F.w, F.h); }
    g.restore();
    for (const t of order) { if (t.oldRole === 'lamp') lampGlow(g, t, v); drawThread(g, t, v); }
    drawHaunt(g, hv, hp, v);
    // wash of the heddle bar's shadow on the cloth top
    const sg = g.createLinearGradient(0, F.y, 0, F.y + 22); sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(F.x, F.y, F.w, 22);
    g.restore();
    return th;
  }

  return { draw, W, H, F, mk };
});
