// V6 paint: procedural Canvas 2D renderer for the glass cabinet. No assets, no fonts.
// Layers, back to front: back wall (cached) / relics / soil strata cross-section (+ cached grain) / water vein / roots / mycelium /
// mother tree / ferns, herbs, moss / spores / front glass sheen (cached) / fog and condensation / haunt / brass frame (cached).
// Only the layers that depend on t are redrawn per frame. Soil grain, back wall, glass sheen, fog texture and the frame are cached once.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.V6Paint = factory(root.V6Core);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { W, H, CAB, SOIL, BASE } = C;
  const TAU = Math.PI * 2;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const lerp = C.lerp, hash = C.hash, span = C.span, clamp = C.clamp;
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => 'rgb(' + Math.round(lerp(a[0], b[0], k)) + ',' + Math.round(lerp(a[1], b[1], k)) + ',' + Math.round(lerp(a[2], b[2], k)) + ')';

  const BAND_OLD = ['#3a281a', '#4b3524', '#5b4430', '#6c5339', '#7b6547', '#6b6a63'].map(rgb);
  const BAND_NEW = ['#2c3a22', '#3d4b2c', '#524b32', '#62533a', '#6f6044', '#6b6c60'].map(rgb);

  let cache = null;

  function build() {
    const back = mk(W, H), bg = back.getContext('2d');
    // room beyond the glass, then the cabinet's back wall
    let gr = bg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16201c'); gr.addColorStop(1, '#0b0f0d'); bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    gr = bg.createLinearGradient(0, CAB.y0, 0, CAB.y1); gr.addColorStop(0, '#9fb3a4'); gr.addColorStop(0.55, '#62786a'); gr.addColorStop(1, '#2f3d34');
    bg.fillStyle = gr; bg.fillRect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, CAB.y1 - CAB.y0);
    // far shelves and bottle silhouettes seen through the back glass, soft
    bg.save(); bg.beginPath(); bg.rect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, CAB.y1 - CAB.y0); bg.clip();
    for (let i = 0; i < 14; i++) {
      const x = CAB.x0 + 20 + i * 78 + hash(i, 1) * 20, h = 40 + hash(i, 2) * 70, w = 20 + hash(i, 3) * 26;
      bg.fillStyle = 'rgba(30,48,40,' + (0.12 + hash(i, 4) * 0.1) + ')'; bg.fillRect(x, 232 - h, w, h);
      bg.fillStyle = 'rgba(210,235,220,0.07)'; bg.fillRect(x + 3, 232 - h + 4, 3, h - 8);
    }
    bg.fillStyle = 'rgba(40,30,20,0.28)'; bg.fillRect(CAB.x0, 232, CAB.x1 - CAB.x0, 7); bg.fillStyle = 'rgba(255,255,255,0.1)'; bg.fillRect(CAB.x0, 232, CAB.x1 - CAB.x0, 1.5);
    for (let i = 0; i < 9; i++) { // back-glass panel seams
      bg.fillStyle = 'rgba(255,255,255,0.05)'; bg.fillRect(CAB.x0 + i * 137, CAB.y0, 2, CAB.y1 - CAB.y0);
    }
    gr = bg.createRadialGradient(560, 120, 20, 560, 160, 620); gr.addColorStop(0, 'rgba(255,244,205,0.38)'); gr.addColorStop(1, 'rgba(255,244,205,0)');
    bg.fillStyle = gr; bg.fillRect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, CAB.y1 - CAB.y0);
    for (let i = 0; i < 260; i++) { bg.fillStyle = 'rgba(255,255,255,' + (0.03 + hash(i, 7) * 0.05) + ')'; bg.fillRect(CAB.x0 + hash(i, 5) * 1100, CAB.y0 + hash(i, 6) * 300, 1.5, 1.5); }
    bg.restore();

    // soil grain: fixed speckle and pebbles over the cross-section, drawn on top of the live bands
    const grain = mk(CAB.x1 - CAB.x0, CAB.y1 - CAB.y0 - (SOIL.y - CAB.y0)), gg = grain.getContext('2d');
    const gw = grain.width, gh = grain.height;
    for (let i = 0; i < 2600; i++) {
      const x = hash(i, 11) * gw, y = hash(i, 12) * gh, d = hash(i, 13);
      gg.fillStyle = d < 0.5 ? 'rgba(15,8,2,' + (0.12 + hash(i, 14) * 0.2) + ')' : 'rgba(255,235,200,' + (0.06 + hash(i, 14) * 0.12) + ')';
      const s = 1 + hash(i, 15) * 2; gg.fillRect(x, y, s, s * (0.6 + hash(i, 16) * 0.5));
    }
    for (let i = 0; i < 90; i++) { // pebbles, more in the deep bands
      const y = Math.pow(hash(i, 17), 0.55) * gh, x = hash(i, 18) * gw, r = 2.5 + hash(i, 19) * (3 + y / gh * 7);
      gg.fillStyle = 'rgba(' + (120 + hash(i, 20) * 60 | 0) + ',' + (112 + hash(i, 20) * 50 | 0) + ',' + (98 + hash(i, 20) * 40 | 0) + ',0.7)';
      gg.beginPath(); gg.ellipse(x, y, r * 1.2, r * 0.85, hash(i, 21) * 3, 0, TAU); gg.fill();
      gg.fillStyle = 'rgba(255,255,255,0.18)'; gg.beginPath(); gg.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.25, 0, 0, TAU); gg.fill();
    }

    // front glass: diagonal sheen, a window reflection and darkened edges. Cached, shifted with the pointer.
    const front = mk(W, H), fg = front.getContext('2d');
    fg.save(); fg.beginPath(); fg.rect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, CAB.y1 - CAB.y0); fg.clip();
    for (let i = 0; i < 3; i++) {
      const x = 220 + i * 330, w = 70 + i * 30;
      gr = fg.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,' + (0.1 - i * 0.02) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      fg.save(); fg.transform(1, 0, -0.45, 1, 0, 0); fg.fillStyle = gr; fg.fillRect(x + 160, CAB.y0, w, CAB.y1 - CAB.y0); fg.restore();
    }
    fg.fillStyle = 'rgba(255,255,255,0.07)'; fg.fillRect(880, 90, 230, 150); // window reflection with mullions
    fg.fillStyle = 'rgba(0,0,0,0.12)'; fg.fillRect(994, 90, 5, 150); fg.fillRect(880, 162, 230, 5);
    gr = fg.createLinearGradient(CAB.x0, 0, CAB.x0 + 70, 0); gr.addColorStop(0, 'rgba(0,10,8,0.45)'); gr.addColorStop(1, 'rgba(0,10,8,0)'); fg.fillStyle = gr; fg.fillRect(CAB.x0, CAB.y0, 70, CAB.y1 - CAB.y0);
    gr = fg.createLinearGradient(CAB.x1 - 70, 0, CAB.x1, 0); gr.addColorStop(0, 'rgba(0,10,8,0)'); gr.addColorStop(1, 'rgba(0,10,8,0.45)'); fg.fillStyle = gr; fg.fillRect(CAB.x1 - 70, CAB.y0, 70, CAB.y1 - CAB.y0);
    gr = fg.createLinearGradient(0, CAB.y0, 0, CAB.y0 + 60); gr.addColorStop(0, 'rgba(0,10,8,0.35)'); gr.addColorStop(1, 'rgba(0,10,8,0)'); fg.fillStyle = gr; fg.fillRect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, 60);
    fg.strokeStyle = 'rgba(255,255,255,0.35)'; fg.lineWidth = 2; fg.beginPath(); fg.moveTo(CAB.x0 + 3, CAB.y0 + 3); fg.lineTo(CAB.x1 - 3, CAB.y0 + 3); fg.moveTo(CAB.x0 + 3, CAB.y0 + 3); fg.lineTo(CAB.x0 + 3, CAB.y1 - 3); fg.stroke();
    fg.restore();

    // fog texture at half resolution
    const fog = mk(W / 2, H / 2), fo = fog.getContext('2d');
    fo.fillStyle = 'rgba(214,232,232,0.5)'; fo.fillRect(0, 0, fog.width, fog.height);
    for (let i = 0; i < 90; i++) {
      const x = hash(i, 61) * fog.width, y = hash(i, 62) * fog.height, r = 20 + hash(i, 63) * 50, k = hash(i, 64) < 0.5;
      const g2 = fo.createRadialGradient(x, y, 0, x, y, r); g2.addColorStop(0, k ? 'rgba(255,255,255,0.22)' : 'rgba(150,180,180,0.2)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
      fo.fillStyle = g2; fo.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const brush = mk(48, 48), bb = brush.getContext('2d'); gr = bb.createRadialGradient(24, 24, 2, 24, 24, 24); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); bb.fillStyle = gr; bb.fillRect(0, 0, 48, 48);
    const fogM = mk(fog.width, fog.height);

    // brass frame and plinth
    const frame = mk(W, H), fr = frame.getContext('2d');
    const brass = (x0, y0, x1, y1, vertical) => { const g3 = vertical ? fr.createLinearGradient(x0, 0, x1, 0) : fr.createLinearGradient(0, y0, 0, y1); g3.addColorStop(0, '#f2d58a'); g3.addColorStop(0.18, '#c9a24c'); g3.addColorStop(0.5, '#8a6a26'); g3.addColorStop(0.82, '#b58f3c'); g3.addColorStop(1, '#5f4616'); fr.fillStyle = g3; fr.fillRect(x0, y0, x1 - x0, y1 - y0); };
    brass(34, 12, W - 34, CAB.y0, false); brass(34, CAB.y1, W - 34, 650, false); brass(34, 12, CAB.x0, 650, true); brass(CAB.x1, 12, W - 34, 650, true);
    fr.fillStyle = '#2a2014'; fr.fillRect(20, 650, W - 40, 30); brass(20, 650, W - 20, 664, false); // plinth
    fr.fillStyle = 'rgba(0,0,0,0.5)'; fr.fillRect(20, 664, W - 40, 16);
    fr.strokeStyle = 'rgba(40,24,4,0.8)'; fr.lineWidth = 3; fr.strokeRect(CAB.x0 - 1.5, CAB.y0 - 1.5, CAB.x1 - CAB.x0 + 3, CAB.y1 - CAB.y0 + 3);
    fr.strokeStyle = 'rgba(255,236,170,0.55)'; fr.lineWidth = 1.5; fr.strokeRect(36, 14, W - 72, 634); fr.strokeRect(CAB.x0 - 6, CAB.y0 - 6, CAB.x1 - CAB.x0 + 12, CAB.y1 - CAB.y0 + 12);
    const rivet = (x, y, r) => { const g4 = fr.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.5, x, y, r); g4.addColorStop(0, '#fff2b8'); g4.addColorStop(0.6, '#b8903a'); g4.addColorStop(1, '#4a3510'); fr.fillStyle = g4; fr.beginPath(); fr.arc(x, y, r, 0, TAU); fr.fill(); };
    for (let i = 0; i < 17; i++) { rivet(CAB.x0 + 40 + i * 62, 36, 4); rivet(CAB.x0 + 40 + i * 62, 633, 4); }
    for (let i = 0; i < 9; i++) { rivet(62, 90 + i * 62, 4); rivet(W - 62, 90 + i * 62, 4); }
    for (const hy of [160, 460]) { // hinge leaves
      brass(40, hy, 86, hy + 70, true); fr.strokeStyle = 'rgba(40,24,4,0.7)'; fr.lineWidth = 1.5; fr.strokeRect(40, hy, 46, 70); rivet(63, hy + 14, 3.5); rivet(63, hy + 56, 3.5);
      fr.fillStyle = '#6a4e1a'; fr.fillRect(CAB.x0 - 9, hy + 4, 9, 62);
    }
    brass(520, 12, 760, 44, false); fr.strokeStyle = 'rgba(40,24,4,0.8)'; fr.strokeRect(520, 12, 240, 32); // top cartouche
    fr.fillStyle = '#4a3410'; for (let i = 0; i < 9; i++) fr.fillRect(540 + i * 22, 24, 12, 3);
    fr.fillStyle = 'rgba(0,0,0,0.35)'; fr.fillRect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, 5); // shadow under the top rail
    const lat = mk(120, 24), lg = lat.getContext('2d'); lg.fillStyle = '#3a2a14'; lg.fillRect(0, 0, 120, 24); // plinth stripes
    cache = { back, grain, front, fog, fogM, brush, frame };
  }

  // ---- shared helpers ----
  function splinePts(pts, seg) { // catmull-rom through pts
    const out = [], n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      for (let s = 0; s < seg; s++) {
        const u = s / seg, u2 = u * u, u3 = u2 * u;
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]);
      }
    }
    out.push(pts[n - 1].slice());
    return out;
  }
  function at(path, cum, s) { // point at fraction s of a polyline
    const L = cum[cum.length - 1], d = s * L; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const k = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return [lerp(path[i - 1][0], path[i][0], k), lerp(path[i - 1][1], path[i][1], k)];
  }
  function cumLen(path) { const c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return c; }
  function strokePoly(g, path, from, to) { g.beginPath(); g.moveTo(path[from][0], path[from][1]); for (let i = from + 1; i <= to; i++) g.lineTo(path[i][0], path[i][1]); g.stroke(); }
  function surfY(x, amp) { return SOIL.y + amp * 0.28 * Math.sin(x * 0.013 + 0.6) + 1.6 * Math.sin(x * 0.07); }

  // ---- soil ----
  function drawSoil(g, st, t) {
    const x0 = CAB.x0, x1 = CAB.x1, b = st.bounds, N = 46, dx = (x1 - x0) / N;
    const wave = (k, x) => (k === 0 ? surfY(x, st.amp) : k === 6 ? b[6] : b[k] + st.amp * Math.sin(x * 0.011 * (1 + k * 0.17) + k * 2.1) + 2.2 * Math.sin(x * 0.047 + k * 1.3));
    g.save(); g.beginPath(); g.rect(x0, CAB.y0, x1 - x0, CAB.y1 - CAB.y0); g.clip();
    for (let k = 0; k < 6; k++) {
      g.beginPath(); g.moveTo(x0, wave(k, x0));
      for (let i = 1; i <= N; i++) g.lineTo(x0 + i * dx, wave(k, x0 + i * dx));
      for (let i = N; i >= 0; i--) g.lineTo(x0 + i * dx, wave(k + 1, x0 + i * dx) + (k === 5 ? 10 : 0));
      g.closePath(); g.fillStyle = mix(BAND_OLD[k], BAND_NEW[k], st.tone); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, wave(k, x0));
      for (let i = 1; i <= N; i++) g.lineTo(x0 + i * dx, wave(k, x0 + i * dx)); g.stroke();
      g.strokeStyle = 'rgba(255,230,190,' + (k === 0 ? 0.3 : 0.12) + ')'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, wave(k, x0) - 1.5);
      for (let i = 1; i <= N; i++) g.lineTo(x0 + i * dx, wave(k, x0 + i * dx) - 1.5); g.stroke();
    }
    g.drawImage(cache.grain, x0, SOIL.y);
    // pores open as the strata loosen: dark air pockets with a lit lower lip
    g.fillStyle = 'rgba(10,6,2,0.38)'; g.beginPath();
    for (let i = 0; i < st.pores; i++) { const px = x0 + 10 + hash(i, 71) * (x1 - x0 - 20), py = SOIL.y + 14 + hash(i, 72) * (b[6] - SOIL.y - 24), r = 2 + hash(i, 73) * 4.5; g.moveTo(px + r * 1.4, py); g.ellipse(px, py, r * 1.4, r, 0, 0, TAU); }
    g.fill();
    g.fillStyle = 'rgba(255,230,190,0.12)'; g.beginPath();
    for (let i = 0; i < st.pores; i++) { const px = x0 + 10 + hash(i, 71) * (x1 - x0 - 20), py = SOIL.y + 14 + hash(i, 72) * (b[6] - SOIL.y - 24), r = 2 + hash(i, 73) * 4.5; g.moveTo(px + r * 1.2, py + r * 0.6); g.ellipse(px, py + r * 0.6, r * 1.2, r * 0.4, 0, 0, TAU); }
    g.fill();
    g.restore();
  }

  // ---- water vein ----
  function drawVein(g, v, phase, w, pulseT) {
    const paths = [{ pts: v.main, k: 1, n: 16 }];
    v.branches.forEach((b, j) => paths.push({ pts: b, k: lerp(0.45, 1, v.forks[j]), n: 6 }));
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    paths.forEach((p) => {
      const sp = splinePts(p.pts, 9);
      const pulse = 1 + w * 0.35 * Math.sin(pulseT * 9);
      g.strokeStyle = 'rgba(30,20,10,0.35)'; g.lineWidth = 20 * p.k * v.glow; strokePoly(g, sp, 0, sp.length - 1);
      g.strokeStyle = 'rgba(70,200,215,' + (0.14 * pulse * p.k) + ')'; g.lineWidth = 17 * p.k; strokePoly(g, sp, 0, sp.length - 1);
      g.strokeStyle = 'rgba(110,225,235,' + (0.34 * pulse * p.k) + ')'; g.lineWidth = 9 * p.k; strokePoly(g, sp, 0, sp.length - 1);
      g.strokeStyle = 'rgba(200,250,255,' + (0.8 * p.k) + ')'; g.lineWidth = 3 * (0.6 + 0.4 * p.k); strokePoly(g, sp, 0, sp.length - 1);
      const cum = cumLen(sp);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath();
      for (let j = 0; j < p.n; j++) {
        const s = ((phase * (p === paths[0] ? 1 : 1.3) + j / p.n) % 1 + 1) % 1, q = at(sp, cum, s), r = 2.4 + 0.9 * Math.sin(j * 2.3);
        g.moveTo(q[0] + r * p.k, q[1]); g.arc(q[0], q[1], r * p.k, 0, TAU);
      }
      g.fill();
    });
    g.restore();
  }

  // ---- roots ----
  function drawRoots(g, rg) {
    g.save(); g.lineCap = 'round';
    const order = rg.slice().sort((a, b) => b.tier - a.tier); // deep first so shallow thick roots overlap them
    order.forEach((r) => {
      if (r.k < 0.02) return;
      const n = 9, S = r.S, Cp = r.C, E = r.E, pts = [];
      for (let j = 0; j <= n; j++) pts.push(C.bez(S, Cp, E, j / n));
      for (let pass = 0; pass < 3; pass++) {
        for (let j = 0; j < n; j++) {
          const f = (j + 0.5) / n, wd = r.w * (1 - 0.72 * f) * (0.5 + 0.5 * Math.min(1, r.k * 2.2));
          g.strokeStyle = pass === 0 ? 'rgba(15,8,2,0.55)' : pass === 1 ? '#5d4128' : '#8b6a45';
          g.lineWidth = pass === 0 ? wd + 3 : pass === 1 ? wd : wd * 0.35;
          g.beginPath(); g.moveTo(pts[j][0] + (pass === 2 ? -wd * 0.18 : 0), pts[j][1] + (pass === 0 ? 1.5 : pass === 2 ? -wd * 0.18 : 0)); g.lineTo(pts[j + 1][0] + (pass === 2 ? -wd * 0.18 : 0), pts[j + 1][1] + (pass === 0 ? 1.5 : pass === 2 ? -wd * 0.18 : 0)); g.stroke();
        }
      }
      // rootlets near the tip
      g.strokeStyle = 'rgba(190,160,120,0.8)'; g.lineWidth = 1.2; g.beginPath();
      for (let j = 0; j < 5; j++) {
        const u = 0.45 + j * 0.12, p = C.bez(S, Cp, E, Math.min(1, u)), a = (j % 2 ? 1 : -1) * (0.7 + 0.5 * hash(r.i * 7 + j, 81)) + Math.atan2(E[1] - S[1], E[0] - S[0]), L = (9 + 13 * hash(r.i * 7 + j, 82)) * Math.min(1, r.k * 2);
        g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + Math.cos(a) * L * 0.5, p[1] + Math.sin(a) * L * 0.5 + 2, p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L);
      }
      g.stroke();
    });
    g.restore();
  }

  function drawMycelium(g, v, t, main) {
    const m = C.mycelium(t); if (m <= 0.01) return;
    const sp = splinePts(v.main, 8), cum = cumLen(sp);
    g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(245,240,225,0.65)'; g.lineWidth = 1.1; g.beginPath();
    const dots = [];
    for (let i = 0; i < C.MYC_N; i++) {
      const p = at(sp, cum, 0.03 + hash(i, 91) * 0.94), a = (hash(i, 92) - 0.5) * 3.1 + (hash(i, 93) < 0.5 ? 1.57 : -1.57), len = (18 + hash(i, 94) * 46) * clamp((m - hash(i, 95) * 0.5) * 2.2);
      if (len < 1) continue;
      let x = p[0], y = p[1]; g.moveTo(x, y);
      for (let s = 0; s < 3; s++) { const aa = a + Math.sin(i * 3 + s * 2) * 0.7; x += Math.cos(aa) * len / 3; y = Math.max(SOIL.y + 8, Math.min(CAB.y1 - 14, y + Math.sin(aa) * len / 3)); g.lineTo(x, y); if (s < 2 && hash(i + s, 96) < 0.6) dots.push([x, y]); }
    }
    g.stroke(); g.fillStyle = 'rgba(255,250,235,0.85)'; g.beginPath(); dots.forEach((d) => { g.moveTo(d[0] + 1.8, d[1]); g.arc(d[0], d[1], 1.8, 0, TAU); }); g.fill();
    g.restore();
  }

  // ---- mother tree ----
  const LEAF_COL = ['#c3d8cc', '#a9c6b9', '#d6e6dc'];
  function drawTree(g, tg, time, w, reduced) {
    g.save(); g.lineCap = 'round';
    // trunk flare where the trunk meets the roots
    const tr = tg[0];
    if (tr.k > 0.02) { g.fillStyle = '#4a3522'; g.beginPath(); g.ellipse(BASE.x, BASE.y + 1, 15 + 20 * tr.k, 7 + 3 * tr.k, 0, Math.PI, TAU); g.fill(); }
    tg.forEach((b) => { // branches thickest first so twigs overlap parents
      if (b.k < 0.02) return;
      const n = 8;
      for (let pass = 0; pass < 3; pass++) {
        for (let j = 0; j < n; j++) {
          const u0 = j / n, u1 = (j + 1) / n, p0 = C.quad(b, u0), p1 = C.quad(b, u1), wd = b.w * (1 - 0.45 * (j + 0.5) / n);
          g.strokeStyle = pass === 0 ? 'rgba(20,12,4,0.5)' : pass === 1 ? '#5a4330' : '#8a6e50';
          g.lineWidth = pass === 0 ? wd + 3 : pass === 1 ? wd : wd * 0.28;
          const o = pass === 2 ? -wd * 0.2 : 0;
          g.beginPath(); g.moveTo(p0.x + o, p0.y); g.lineTo(p1.x + o, p1.y); g.stroke();
        }
      }
      // growth marks: nodal bands along the branch, fewer as it shortens
      g.strokeStyle = 'rgba(30,18,8,0.45)'; g.lineWidth = 1.4; g.beginPath();
      for (let j = 1; j <= 3; j++) { const u = j * 0.22, p = C.quad(b, u), wd = b.w * (1 - 0.45 * u) * 0.5; g.moveTo(p.x - Math.cos(b.ang) * wd, p.y - Math.sin(b.ang) * wd); g.lineTo(p.x + Math.cos(b.ang) * wd, p.y + Math.sin(b.ang) * wd); }
      g.stroke();
    });
    // leaves: three colour groups, each one path. They furl toward the branch and shrink before the branch itself retracts.
    for (let c = 0; c < 3; c++) {
      g.fillStyle = LEAF_COL[c]; g.beginPath();
      tg.forEach((b) => {
        if (b.leafK < 0.02 || b.leaves === 0) return;
        for (let j = 0; j < b.leaves; j++) {
          if ((j + b.i) % 3 !== c) continue;
          const u = 0.2 + 0.8 * (j + 0.5) / b.leaves, p = C.quad(b, u), side = j % 2 ? 1 : -1;
          const sway = reduced ? 0 : Math.sin(time * 1.3 + b.i * 1.7 + j) * 0.07 + w * Math.sin(time * 38 + j * 2.1) * 0.05;
          const open = (0.95 - 0.7 * b.furl) * side, a = b.ang + open + sway - 1.5708 + 1.5708 * 0; // leaf direction, furling toward the branch axis
          const size = (17 + 8 * hash(b.i * 13 + j, 101)) * (0.35 + 0.65 * b.leafK), rx = size * 0.5, ry = size * 0.22 * (1 - 0.5 * b.furl);
          const ca = Math.sin(b.ang + open + sway), sa = -Math.cos(b.ang + open + sway);
          const cx = p.x + ca * rx, cy = p.y + sa * rx;
          g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, Math.atan2(sa, ca), 0, TAU);
        }
      });
      g.fill();
    }
    // leaf midribs and a cool rim so the silver reads against the wall
    g.strokeStyle = 'rgba(40,70,60,0.35)'; g.lineWidth = 0.9; g.beginPath();
    tg.forEach((b) => {
      if (b.leafK < 0.1 || b.leaves === 0) return;
      for (let j = 0; j < b.leaves; j++) {
        const u = 0.2 + 0.8 * (j + 0.5) / b.leaves, p = C.quad(b, u), side = j % 2 ? 1 : -1, open = (0.95 - 0.7 * b.furl) * side;
        const size = (17 + 8 * hash(b.i * 13 + j, 101)) * (0.35 + 0.65 * b.leafK);
        g.moveTo(p.x, p.y); g.lineTo(p.x + Math.sin(b.ang + open) * size, p.y - Math.cos(b.ang + open) * size);
      }
    });
    g.stroke();
    g.restore();
  }

  // ---- ferns, herbs, moss ----
  function drawFerns(g, t, time, reduced) {
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < C.FERNS.length; i++) {
      const f = C.fern(i, t); if (f.g < 0.02) continue;
      const surf = f.y + 1; g.beginPath();
      const rach = new Path2D(), leaf = new Path2D();
      for (let k = 0; k < f.fronds; k++) {
        const fan = (k / (f.fronds - 1) - 0.5) * 2.5 + (hash(i * 9 + k, 111) - 0.5) * 0.25;
        const L = (46 + 40 * hash(i * 9 + k, 112)) * f.g * (1 - Math.abs(fan) * 0.15), sway = reduced ? 0 : Math.sin(time * 0.9 + i + k) * 0.05;
        const a = fan + sway, curl = lerp(1.3, 0.45, f.g) * (fan >= 0 ? 1 : -1);
        const ex = f.x + Math.sin(a) * L + curl * L * 0.28, ey = surf - Math.cos(a) * L * 0.95 + (Math.abs(fan) > 0.9 ? L * 0.25 : 0);
        const cx = f.x + Math.sin(a) * L * 0.3, cy = surf - Math.cos(a) * L * 0.75;
        rach.moveTo(f.x, surf); rach.quadraticCurveTo(cx, cy, ex, ey);
        const nl = Math.max(3, Math.round(10 * f.g + 2));
        for (let j = 1; j <= nl; j++) {
          const u = j / (nl + 1), a1 = 1 - u, px = a1 * a1 * f.x + 2 * a1 * u * cx + u * u * ex, py = a1 * a1 * surf + 2 * a1 * u * cy + u * u * ey;
          const tx = 2 * a1 * (cx - f.x) + 2 * u * (ex - cx), ty = 2 * a1 * (cy - surf) + 2 * u * (ey - cy), tl = Math.hypot(tx, ty) || 1;
          const nx = -ty / tl, ny = tx / tl, ll = (3 + 13 * (1 - u * 0.75)) * f.g * 1.2 + 1;
          leaf.moveTo(px - nx * ll + tx / tl * ll * 0.4, py - ny * ll + ty / tl * ll * 0.4); leaf.lineTo(px, py); leaf.lineTo(px + nx * ll + tx / tl * ll * 0.4, py + ny * ll + ty / tl * ll * 0.4);
        }
      }
      g.strokeStyle = 'rgba(15,35,15,0.5)'; g.lineWidth = 3.4; g.stroke(rach);
      g.strokeStyle = '#4f8a45'; g.lineWidth = 1.7; g.stroke(rach);
      g.strokeStyle = '#7bbd62'; g.lineWidth = 2.1; g.stroke(leaf);
      g.strokeStyle = 'rgba(230,255,200,0.4)'; g.lineWidth = 0.8; g.stroke(leaf);
    }
    // low herbs: tufts of blades
    g.lineWidth = 1.6; g.strokeStyle = '#6aa855'; const hb = new Path2D();
    for (let i = 0; i < C.HERBS; i++) {
      const h = C.herb(i, t); if (h.g < 0.02) continue; const sy = surfYAt(h.x, t);
      for (let b = 0; b < h.n; b++) { const a = (b / (h.n - 1) - 0.5) * 1.3, L = (10 + 10 * hash(i * 5 + b, 121)) * h.g; hb.moveTo(h.x, sy + 1); hb.quadraticCurveTo(h.x + Math.sin(a) * L * 0.4, sy - L * 0.7, h.x + Math.sin(a) * L, sy - Math.cos(a) * L); }
    }
    g.stroke(hb);
    g.restore();
  }
  let ampNow = 3;
  function surfYAt(x) { return surfY(x, ampNow); }

  function drawMoss(g, t, w, time) {
    const groups = [[], [], []];
    for (let i = 0; i < C.MOSS_N; i++) { const s = C.mossSize(i, t); if (s < 0.03) continue; groups[Math.min(2, (C.mossPatches[i].hue * 3) | 0)].push(i); }
    const cols = ['#3c6a35', '#558d44', '#7fb05a'];
    g.save();
    g.fillStyle = 'rgba(10,25,8,0.35)'; g.beginPath();
    groups.forEach((gr) => gr.forEach((i) => { const p = C.mossPatches[i], s = C.mossSize(i, t), x = p.x, y = surfYAt(x) + 1.5, r = p.r * s; g.moveTo(x + r, y); g.ellipse(x, y, r * 1.05, r * 0.5, 0, Math.PI, TAU); }));
    g.fill();
    groups.forEach((gr, c) => {
      g.fillStyle = cols[c]; g.beginPath();
      gr.forEach((i) => {
        const p = C.mossPatches[i], s = C.mossSize(i, t), x = p.x, y = surfYAt(x) + 1, r = p.r * s;
        for (let k = 0; k < 3; k++) { const ox = (k - 1) * r * 0.7, rr = r * (0.55 + 0.25 * hash(i * 3 + k, 131)); g.moveTo(x + ox + rr, y); g.arc(x + ox, y - rr * 0.35, rr, Math.PI, TAU); }
      });
      g.fill();
    });
    g.fillStyle = 'rgba(210,245,170,0.35)'; g.beginPath();
    groups[2].forEach((i) => { const p = C.mossPatches[i], s = C.mossSize(i, t), x = p.x, y = surfYAt(x) - p.r * s * 0.5; g.moveTo(x + 2, y); g.arc(x, y, 2, 0, TAU); });
    g.fill();
    g.restore();
  }

  function drawSpores(g, t, time) {
    const k = C.mossCover(t); if (k < 0.15) return;
    g.fillStyle = 'rgba(235,255,210,0.6)'; g.beginPath();
    for (let i = 0; i < 26; i++) {
      const s = (time * (0.03 + hash(i, 141) * 0.03) + hash(i, 142)) % 1, x = CAB.x0 + 40 + hash(i, 143) * (CAB.x1 - CAB.x0 - 80) + Math.sin(time + i) * 10, y = SOIL.y - 4 - s * 220;
      g.moveTo(x + 1.4, y); g.arc(x, y, 1.4 * Math.sin(s * 3.14), 0, TAU);
    }
    g.fill();
  }

  // ---- the gardener's things (old world only) ----
  function strokeName(g, j, cx, cy, size, rot, prog, style) {
    const strokes = C.NAME[j], total = strokes.length, cr = Math.cos(rot), sr = Math.sin(rot);
    const map = (p) => { const x = (p[0] - 50) * size / 100, y = (p[1] - 50) * size / 100; return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
    const tips = [];
    strokes.forEach((s, si) => {
      const k = clamp(prog * total - si); if (k <= 0) return;
      const pts = s.map(map); let len = 0; const seg = [];
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); len += d; }
      let rem = len * k; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); let lx = pts[0][0], ly = pts[0][1];
      for (let i = 1; i < pts.length && rem > 0; i++) { const d = seg[i - 1], f = Math.min(1, rem / d); lx = lerp(pts[i - 1][0], pts[i][0], f); ly = lerp(pts[i - 1][1], pts[i][1], f); g.lineTo(lx, ly); rem -= d; }
      g.stroke(); tips.push([lx, ly, k, si]);
    });
    return tips;
  }

  function drawRelics(g, t, w) {
    const sink = C.relics(t); if (sink > 0.995) return;
    g.save(); g.beginPath(); g.rect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, surfYAt(300) + 2 - CAB.y0); g.clip();
    g.translate(0, sink * 64);
    // plaque on a stake
    g.fillStyle = '#3e2c18'; g.fillRect(449, 318, 5, 46);
    let gr = g.createLinearGradient(420, 0, 480, 0); gr.addColorStop(0, '#f0d589'); gr.addColorStop(0.5, '#b58f3c'); gr.addColorStop(1, '#7a5c1c'); g.fillStyle = gr; g.fillRect(418, 296, 66, 36);
    g.strokeStyle = 'rgba(40,26,6,0.8)'; g.lineWidth = 1.5; g.strokeRect(418.5, 296.5, 65, 35);
    g.strokeStyle = 'rgba(50,32,8,0.85)'; g.lineWidth = 1.6; g.lineCap = 'round'; g.lineJoin = 'round';
    strokeName(g, 0, 440, 314, 24, 0, 1); strokeName(g, 1, 466, 314, 24, 0, 1);
    // shears lying on the soil
    g.strokeStyle = '#2b2b2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(520, 354); g.lineTo(572, 344); g.moveTo(520, 346); g.lineTo(572, 350); g.stroke();
    g.strokeStyle = '#a0522d'; g.lineWidth = 4; g.beginPath(); g.moveTo(520, 354); g.quadraticCurveTo(496, 366, 502, 346); g.moveTo(520, 346); g.quadraticCurveTo(494, 332, 504, 350); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(524, 353); g.lineTo(568, 344); g.stroke();
    // watering can
    gr = g.createLinearGradient(190, 0, 250, 0); gr.addColorStop(0, '#7f9a8f'); gr.addColorStop(0.4, '#c9ddd2'); gr.addColorStop(1, '#4d6a60');
    g.fillStyle = gr; g.beginPath(); g.moveTo(194, 358); g.lineTo(198, 322); g.lineTo(240, 322); g.lineTo(246, 358); g.closePath(); g.fill();
    g.strokeStyle = '#46605a'; g.lineWidth = 3; g.beginPath(); g.moveTo(240, 330); g.lineTo(276, 306); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(276, 306); g.lineTo(284, 303); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(200, 322); g.bezierCurveTo(196, 292, 238, 292, 236, 322); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(203, 326, 5, 28);
    g.restore();
  }

  // ---- fog, condensation and haunt (front glass) ----
  const HAND_EDGE = (function () {
    const pts = [];
    C.HAND.forEach((h, hi) => {
      for (let k = 0; k < 26; k++) {
        const a = k / 26 * TAU, c = Math.cos(h.rot), s = Math.sin(h.rot), lx = Math.cos(a) * h.rx, ly = Math.sin(a) * h.ry;
        const x = h.x + lx * c - ly * s, y = h.y + lx * s + ly * c, q = C.pushOut(x, y, -0.04);
        if (!q.inside) pts.push({ x, y, r: 1.8 + hash(hi * 26 + k, 151) * 3.4, k: hash(hi * 26 + k, 152) });
      }
    });
    return pts;
  })();

  function drawFront(g, o, level, hs, c) {
    const px = o.px || 0, py = o.py || 0, t = o.td;
    g.save(); g.beginPath(); g.rect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, CAB.y1 - CAB.y0); g.clip();
    g.save(); g.translate(px * 5, py * 3); g.drawImage(cache.front, 0, 0); g.restore();
    const wipes = (o.wipes || []).filter((q) => o.now - q.t0 < 7000);
    const hand = hs.hand * (1 - c), gather = hs.gather * (1 - c);
    // fog layer: clear it where the pointer wiped and where the hand was pressed
    const fogA = 0.5 * level;
    if (wipes.length || hand > 0.01) {
      const fm = cache.fogM.getContext('2d'); fm.globalCompositeOperation = 'source-over'; fm.clearRect(0, 0, cache.fogM.width, cache.fogM.height); fm.drawImage(cache.fog, 0, 0);
      fm.globalCompositeOperation = 'destination-out';
      wipes.forEach((q) => { fm.globalAlpha = clamp(1 - (o.now - q.t0) / 7000) * 1.2; fm.drawImage(cache.brush, q.x / 2 - 18, q.y / 2 - 18, 36, 36); });
      if (hand > 0.01) { fm.globalAlpha = hand * 0.95; fm.fillStyle = '#000'; fm.beginPath(); C.HAND.forEach((h) => { fm.moveTo((h.x + h.rx) / 2, h.y / 2); fm.ellipse(h.x / 2, h.y / 2, h.rx / 2, h.ry / 2, h.rot, 0, TAU); }); fm.fill(); }
      fm.globalAlpha = 1; fm.globalCompositeOperation = 'source-over';
      g.globalAlpha = fogA; g.drawImage(cache.fogM, 0, 0, W, H); g.globalAlpha = 1;
    } else { g.globalAlpha = fogA; g.drawImage(cache.fog, 0, 0, W, H); g.globalAlpha = 1; }
    // drops
    const fill = new Path2D(), rim = new Path2D(), hi = new Path2D();
    C.DROPS.forEach((d, i) => {
      if (d.k > level) return;
      let x = d.x + px * 3, y = d.y + py * 2, r = d.r * (o.reduced ? 1 : 1 + 0.07 * Math.sin(o.time * 1.1 + d.k * 20));
      if (gather > 0.01) { const q = C.pushOut(d.x, d.y, 0.14); if (q.inside) { x = lerp(d.x, q.x, gather) + px * 3; y = lerp(d.y, q.y, gather) + py * 2; } }
      for (let j = 0; j < wipes.length; j++) if (Math.hypot(d.x - wipes[j].x, d.y - wipes[j].y) < 30) return;
      fill.moveTo(x + r, y); fill.arc(x, y, r, 0, TAU);
      rim.moveTo(x + r, y); rim.arc(x, y, r, 0, TAU);
      hi.moveTo(x - r * 0.15, y - r * 0.35); hi.arc(x - r * 0.3, y - r * 0.35, Math.max(0.7, r * 0.25), 0, TAU);
      if (r > 5) { g.fillStyle = 'rgba(210,235,240,0.1)'; g.fillRect(x - 0.7, y + r, 1.4, 10 + r * 2); }
    });
    g.fillStyle = 'rgba(205,232,238,0.2)'; g.fill(fill);
    g.strokeStyle = 'rgba(10,30,34,0.5)'; g.lineWidth = 1.2; g.stroke(rim);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill(hi);
    // handprint: the glass is clean inside it, the rim holds beaded water
    if (hand > 0.01) {
      const grow = 0.94 + 0.06 * hand;
      g.lineJoin = 'round'; g.strokeStyle = 'rgba(235,250,250,' + (0.55 * hand) + ')'; g.lineWidth = 3;
      C.HAND.forEach((h) => { g.beginPath(); g.ellipse(h.x, h.y, h.rx * grow, h.ry * grow, h.rot, 0, TAU); g.stroke(); });
      g.strokeStyle = 'rgba(10,30,36,' + (0.35 * hand) + ')'; g.lineWidth = 1.2;
      C.HAND.forEach((h) => { g.beginPath(); g.ellipse(h.x + 1.5, h.y + 1.5, h.rx * grow, h.ry * grow, h.rot, 0, TAU); g.stroke(); });
      g.strokeStyle = 'rgba(210,235,240,' + (0.3 * hand) + ')'; g.lineWidth = 1; g.beginPath(); // palm creases and finger ridges
      const a = C.anchor; g.moveTo(a.x - 30, a.y - 6); g.quadraticCurveTo(a.x - 4, a.y + 14, a.x + 30, a.y - 4); g.moveTo(a.x - 24, a.y + 18); g.quadraticCurveTo(a.x, a.y + 4, a.x + 28, a.y + 14); g.stroke();
      if (gather > 0.01) {
        g.fillStyle = 'rgba(215,240,245,' + (0.55 * gather) + ')'; g.strokeStyle = 'rgba(10,30,34,' + (0.5 * gather) + ')'; g.lineWidth = 1;
        const bp = new Path2D(), bh = new Path2D();
        HAND_EDGE.forEach((b) => { if (b.k > gather * 1.05) return; bp.moveTo(b.x + b.r, b.y); bp.arc(b.x, b.y, b.r, 0, TAU); bh.moveTo(b.x - b.r * 0.2, b.y - b.r * 0.35); bh.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.25), 0, TAU); });
        g.fill(bp); g.stroke(bp); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill(bh);
      }
    }
    // the run: a bead rolls out of the hand along the old vein and the name beads up on it
    if ((hs.run > 0.01 || hs.name > 0.01) && c < 0.99) {
      const old = splinePts(C.VEIN_OLD, 10), cum = cumLen(old), n0 = 20, n1 = old.length - 1, i0 = Math.min(n1, n0 + 2), nb0 = C.nameBox(0), nb1 = C.nameBox(1);
      let iEnd = i0; while (iEnd < n1 && old[iEnd][0] < nb0.x - 30) iEnd++;
      const last = Math.round(lerp(i0, iEnd, hs.run * (1 - c)));
      g.save(); g.globalAlpha = 1 - c; g.lineCap = 'round'; g.lineJoin = 'round';
      if (last > i0) {
        g.strokeStyle = 'rgba(8,24,28,0.5)'; g.lineWidth = 5; g.save(); g.translate(1.5, 2); strokePoly(g, old, i0, last); g.restore();
        g.strokeStyle = 'rgba(215,240,246,0.7)'; g.lineWidth = 3; strokePoly(g, old, i0, last);
        g.fillStyle = 'rgba(240,252,255,0.95)'; g.beginPath(); g.arc(old[last][0], old[last][1], 4.2, 0, TAU); g.fill();
      }
      [nb1, nb0].forEach((nb, jj) => {
        const j = 1 - jj, prog = clamp(hs.name * 2 - j), rot = nb.slope * 0.5;
        if (prog <= 0) return;
        g.strokeStyle = 'rgba(6,20,24,0.65)'; g.lineWidth = 6; g.save(); g.translate(1.6, 2.4); strokeName(g, j, nb.x, nb.y - 8, nb.size, rot, prog); g.restore();
        g.strokeStyle = 'rgba(226,246,250,0.88)'; g.lineWidth = 3.6; const tips = strokeName(g, j, nb.x, nb.y - 8, nb.size, rot, prog);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; strokeName(g, j, nb.x - 0.8, nb.y - 8.8, nb.size, rot, prog);
        g.fillStyle = 'rgba(240,252,255,0.95)'; g.beginPath();
        tips.forEach((tp) => { g.moveTo(tp[0] + 3.4, tp[1]); g.arc(tp[0], tp[1], 3.4, 0, TAU); }); g.fill();
        g.strokeStyle = 'rgba(215,238,244,0.35)'; g.lineWidth = 1.6; g.beginPath(); tips.forEach((tp) => { if (tp[2] >= 1) { g.moveTo(tp[0], tp[1]); g.lineTo(tp[0] + 0.5, tp[1] + 8 + 10 * hash(tp[3] + j * 9, 161)); } }); g.stroke();
      });
      g.restore();
    }
    g.restore();
  }

  // opts: td (shown t), time (s), phase (water bead phase), w (writing 0..1), haunt (hauntState), c (compare 0..1), reduced, px, py, now, wipes
  function draw(g, o) {
    if (!cache) build();
    const t = o.td, px = o.px || 0, py = o.py || 0, reduced = !!o.reduced;
    const tg = C.treeGeometry(t), rg = C.rootGeometry(t), st = C.strata(t), v = C.vein(t);
    ampNow = st.amp;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(cache.back, -px * 4, -py * 2, W, H);
    g.fillStyle = '#0b0f0d'; g.fillRect(0, 0, W, CAB.y0); g.fillRect(0, CAB.y1, W, H - CAB.y1); g.fillRect(0, 0, CAB.x0, H); g.fillRect(CAB.x1, 0, W - CAB.x1, H);
    g.save(); g.beginPath(); g.rect(CAB.x0, CAB.y0, CAB.x1 - CAB.x0, CAB.y1 - CAB.y0); g.clip();
    drawRelics(g, t, o.w);
    drawSoil(g, st, t);
    drawVein(g, v, o.phase || 0, o.w || 0, o.time || 0);
    drawRoots(g, rg);
    drawMycelium(g, v, t);
    drawTree(g, tg, o.time || 0, o.w || 0, reduced);
    drawFerns(g, t, o.time || 0, reduced);
    drawMoss(g, t, o.w, o.time || 0);
    if (!reduced) drawSpores(g, t, o.time || 0);
    // gravel base strip under the soil
    g.fillStyle = '#2a2620'; g.fillRect(CAB.x0, 606, CAB.x1 - CAB.x0, CAB.y1 - 606);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(CAB.x0, 606, CAB.x1 - CAB.x0, 1.5);
    g.restore();
    drawFront(g, o, C.condLevel(t, o.w || 0), o.haunt || C.hauntState(0), o.c || 0);
    g.drawImage(cache.frame, 0, 0);
  }

  return { draw, mk, W, H, build: function () { if (!cache) build(); } };
});
