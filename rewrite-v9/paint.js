// V9 paint: one fixed camera on a brass orrery, a glass lens and a dome that shows the harbor as projected light.
// Everything is Canvas 2D. The harbor is drawn once per frame from the one world F(theta, lens) (three colour passes of the same
// geometry give the lens its chromatic edge); two worlds are never blended.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.V9Paint = factory(root.V9Core);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { W, H, DOME, LENSC, clamp, smooth, lerp, span } = C;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const OC = { x: 250, y: 262, U: 168, pitch: 0.24 };
  const LAMP = [OC.x, OC.y];
  const last = { st: null, worldPasses: 0, drawnWorlds: 0, holes: [], lens: null, star7: null, chartStar7: null, tip: null, beamEnd: null };
  const rgba = (r, g, b, a) => 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a.toFixed(3) + ')';
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

  // ---- static background (wall, floor, pedestal, dome frame, lens rail) ----
  let BG = null;
  function buildBG() {
    const c = mk(W, H), g = c.getContext('2d'), R = C.rng(5);
    let k = g.createLinearGradient(0, 0, 0, H); k.addColorStop(0, '#080b12'); k.addColorStop(0.6, '#10121a'); k.addColorStop(1, '#1a130d');
    g.fillStyle = k; g.fillRect(0, 0, W, H);
    // stone wall courses and arch ribs
    g.strokeStyle = 'rgba(120,130,150,0.07)'; g.lineWidth = 1;
    for (let y = 22; y < 470; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = ((y / 34) & 1) * 40; x < W; x += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 34); g.stroke(); } }
    for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(255,255,255,' + (R() * 0.03).toFixed(3) + ')'; g.fillRect(R() * W, R() * 470, 1 + R() * 2, 1 + R()); }
    // warm glow around the lamp, cool glow around the dome
    k = g.createRadialGradient(OC.x, OC.y, 10, OC.x, OC.y, 330); k.addColorStop(0, 'rgba(255,170,70,0.20)'); k.addColorStop(1, 'rgba(255,170,70,0)'); g.fillStyle = k; g.fillRect(0, 0, W, H);
    k = g.createRadialGradient(DOME.cx, DOME.cy, 40, DOME.cx, DOME.cy, 300); k.addColorStop(0, 'rgba(70,130,170,0.16)'); k.addColorStop(1, 'rgba(70,130,170,0)'); g.fillStyle = k; g.fillRect(0, 0, W, H);
    // floor boards
    k = g.createLinearGradient(0, 462, 0, H); k.addColorStop(0, '#2a1a0e'); k.addColorStop(1, '#0f0905'); g.fillStyle = k; g.fillRect(0, 462, W, H - 462);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5;
    for (let i = -10; i <= 22; i++) { g.beginPath(); g.moveTo(W / 2 + (i - 6) * 20, 462); g.lineTo(W / 2 + (i - 6) * 85, H); g.stroke(); }
    g.fillStyle = 'rgba(255,200,120,0.14)'; g.fillRect(0, 462, W, 2);
    // pedestal under the orrery: stepped brass drum with gear teeth
    const px = OC.x, py = 452;
    for (let s = 0; s < 3; s++) {
      const rx = 92 - s * 22, y0 = py + s * 15 + 10;
      k = g.createLinearGradient(px - rx, 0, px + rx, 0); k.addColorStop(0, '#3b2610'); k.addColorStop(0.3, '#c89a4c'); k.addColorStop(0.55, '#f0cf8a'); k.addColorStop(1, '#2d1c0b');
      g.fillStyle = k; g.beginPath(); g.ellipse(px, y0 + 14, rx, rx * 0.2, 0, 0, Math.PI); g.lineTo(px - rx, y0); g.ellipse(px, y0, rx, rx * 0.2, 0, Math.PI, 0, true); g.closePath(); g.fill();
      g.fillStyle = s === 0 ? '#e9c27a' : '#d3a85e'; g.beginPath(); g.ellipse(px, y0, rx, rx * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,35,10,0.8)'; g.lineWidth = 1; g.stroke();
    }
    g.strokeStyle = 'rgba(70,40,12,0.8)'; g.lineWidth = 2;
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, x = px + Math.cos(a) * 80, y = py + 10 + Math.sin(a) * 16; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 1.2); g.stroke(); }
    // dome: stone surround, brass frame, rivets
    k = g.createRadialGradient(DOME.cx, DOME.cy, 0, DOME.cx, DOME.cy, 340); k.addColorStop(0.45, 'rgba(0,0,0,0)'); k.addColorStop(0.75, 'rgba(0,0,0,0.5)'); k.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = k; g.fillRect(0, 0, W, H);
    for (let q = 0; q < 3; q++) {
      const e = 20 - q * 6;
      k = g.createLinearGradient(DOME.cx - DOME.rx, DOME.cy - DOME.ry, DOME.cx + DOME.rx, DOME.cy + DOME.ry); k.addColorStop(0, q === 1 ? '#f4d99a' : '#8a5f2a'); k.addColorStop(0.5, q === 1 ? '#a97a35' : '#4a2f12'); k.addColorStop(1, q === 1 ? '#e2b768' : '#6b4519');
      g.strokeStyle = k; g.lineWidth = 6; g.beginPath(); g.ellipse(DOME.cx, DOME.cy, DOME.rx + e * 0.5, DOME.ry + e * 0.5, 0, 0, Math.PI * 2); g.stroke();
    }
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, x = DOME.cx + Math.cos(a) * (DOME.rx + 12), y = DOME.cy + Math.sin(a) * (DOME.ry + 12); g.fillStyle = '#f0d594'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x + 0.8, y + 0.8, 1.2, 0, 7); g.fill(); }
    // rail the lens slides on
    const ry = LENSC.y + LENSC.r + 46;
    k = g.createLinearGradient(0, ry - 5, 0, ry + 5); k.addColorStop(0, '#f1d28e'); k.addColorStop(0.5, '#a67a37'); k.addColorStop(1, '#3d2610'); g.fillStyle = k; g.fillRect(396, ry - 5, 238, 10);
    for (const x of [396, 634]) { g.fillStyle = '#c89a4c'; g.fillRect(x - 4, ry - 12, 8, 24); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 1, ry - 12, 3, 24); }
    g.fillStyle = 'rgba(255,225,160,0.5)'; g.fillRect(396, ry - 5, 238, 1.5);
    g.strokeStyle = 'rgba(40,24,8,0.8)'; g.lineWidth = 1; for (let x = 410; x < 630; x += 10) { g.beginPath(); g.moveTo(x, ry + 1); g.lineTo(x, ry + 5); g.stroke(); }
    return c;
  }

  // ---- camera: ring units -> canvas pixels (pitch and a little perspective) ----
  function cam(p) {
    const c = Math.cos(OC.pitch), s = Math.sin(OC.pitch);
    const y = p[1] * c + p[2] * s, z = p[2] * c - p[1] * s, k = 1 / (1 - z * 0.09);
    return [OC.x + p[0] * k * OC.U, OC.y + y * k * OC.U, z];
  }
  const camDir = (v) => { const c = Math.cos(OC.pitch), s = Math.sin(OC.pitch); return [v[0], v[1] * c + v[2] * s, v[2] * c - v[1] * s]; };
  function frameOf(k, st) {
    const th = st.theta, R = C.rot, d = Math.PI / 180;
    if (k === 0) return (v) => R('y', th[0] * d, v);
    if (k === 1) return (v) => R('y', th[0] * d, R('x', th[1] * d, v));
    if (k === 2) return (v) => R('y', th[0] * d, R('x', th[1] * d, R('x', th[2] * d, v)));
    return (v) => R('z', th[3] * d, v);
  }
  // local circle basis and cross-section per ring
  const RB = [
    { e1: [1, 0, 0], e2: [0, 1, 0], n: [0, 0, 1], dr: 0.026, hh: 0.026, w: 'R1' },
    { e1: [1, 0, 0], e2: [0, 0, 1], n: [0, 1, 0], dr: 0.024, hh: 0.024, w: 'R2' },
    { e1: [1, 0, 0], e2: [0, 0, 1], n: [0, 1, 0], dr: 0.02, hh: 0.02, w: 'R3' },
    { e1: [1, 0, 0], e2: [0, 1, 0], n: [0, 0, 1], dr: 0.05, hh: 0.016, w: 'R4' },
  ];
  const lp = (b, r, phi, h) => { const c = Math.cos(phi) * r, s = Math.sin(phi) * r; return [b.e1[0] * c + b.e2[0] * s + b.n[0] * h, b.e1[1] * c + b.e2[1] * s + b.n[1] * h, b.e1[2] * c + b.e2[2] * s + b.n[2] * h]; };
  const KEY = (() => { const v = [-0.5, -0.62, 0.6], l = Math.hypot(...v); return v.map((x) => x / l); })();
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function brass(v, heat) {
    v = clamp(v);
    let c = v < 0.5 ? mix([34, 20, 8], [190, 140, 66], v / 0.5) : mix([190, 140, 66], [255, 226, 160], (v - 0.5) / 0.5);
    if (heat > 0) c = mix(c, [255, 120 + 60 * v, 40], heat * 0.7);
    return c;
  }
  function shade(nrm, pos, heat) { // nrm and pos are camera-space; the lamp sits at the origin
    const key = Math.max(0, dot(nrm, KEY)), pl = Math.hypot(pos[0], pos[1], pos[2]) || 1;
    const lamp = Math.max(0, -(nrm[0] * pos[0] + nrm[1] * pos[1] + nrm[2] * pos[2]) / pl) * 0.9;
    return brass(0.12 + 0.55 * key + 0.5 * lamp, heat);
  }
  function quad(g, a, b, c, d, col) { g.fillStyle = g.strokeStyle = rgba(col[0], col[1], col[2], 1); g.lineWidth = 0.8; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); g.stroke(); }

  function ringPrims(k, st, prims, o) {
    const ring = C.RINGS[k], b = RB[k], fr = frameOf(k, st), N = 96, r = ring.r, heat = k === 2 ? o.heat : 0;
    const nW = camDir(fr(b.n)), hs = nW[2] >= 0 ? 1 : -1;
    const V = (phi, sr, sh) => { const w = fr(lp(b, r + b.dr * sr, phi, b.hh * sh)); return cam(w); };
    let prev = null;
    for (let j = 0; j <= N; j++) {
      const phi = j / N * Math.PI * 2, cur = { io: V(phi, 1, hs), ii: V(phi, -1, hs), oo: V(phi, 1, -hs), oi: V(phi, -1, -hs) };
      if (prev) {
        const pm = (phi + (j - 1) / N * Math.PI * 2) / 2, rad = camDir(fr(lp(b, 1, pm, 0))), ro = rad[2] >= 0 ? 1 : -1;
        const mid = V(pm, 0, 0), z = mid[2], pos = [(mid[0] - OC.x) / OC.U, (mid[1] - OC.y) / OC.U, z];
        const pr = prev, cu = cur;
        prims.push({ z, f(g) {
          // cylinder face (outer when it faces the camera, inner otherwise), then the lit top face
          const e = ro > 0 ? 'o' : 'i', ca = ro > 0 ? [rad[0], rad[1], rad[2]] : [-rad[0], -rad[1], -rad[2]];
          const a1 = e === 'o' ? pr.io : pr.ii, a2 = e === 'o' ? pr.oo : pr.oi, b1 = e === 'o' ? cu.io : cu.ii, b2 = e === 'o' ? cu.oo : cu.oi;
          quad(g, a1, a2, b2, b1, shade(ca, pos, heat));
          quad(g, pr.io, pr.ii, cu.ii, cu.io, shade([nW[0] * hs, nW[1] * hs, nW[2] * hs], pos, heat));
        } });
      }
      prev = cur;
    }
    return { fr, b, r };
  }

  // ---- orrery ----
  function drawOrrery(g, st, o) {
    const prims = [], holes = [];
    const rr = C.RINGS.map((_, k) => ringPrims(k, st, prims, o));
    // R4 graduations (they turn with theta4) and the north notch
    { const { fr, b, r } = rr[3]; for (let i = 0; i < 72; i++) { const phi = i / 72 * Math.PI * 2, major = i % 6 === 0, a = cam(fr(lp(b, r - 0.045, phi, b.hh * 1.1))), c2 = cam(fr(lp(b, r - (major ? 0.01 : 0.025), phi, b.hh * 1.1))), nz = camDir(fr(b.n))[2] > 0; if (!nz) continue;
      prims.push({ z: a[2] + 0.01, f(gg) { gg.strokeStyle = major ? 'rgba(30,16,4,0.95)' : 'rgba(30,16,4,0.6)'; gg.lineWidth = major ? 2 : 1; gg.beginPath(); gg.moveTo(a[0], a[1]); gg.lineTo(c2[0], c2[1]); gg.stroke(); } }); }
      const n0 = cam(fr(lp(b, r + 0.075, 0, 0))), n1 = cam(fr(lp(b, r + 0.02, 0.05, 0))), n2 = cam(fr(lp(b, r + 0.02, -0.05, 0)));
      prims.push({ z: n0[2] + 0.02, f(gg) { gg.fillStyle = '#f2d18a'; gg.strokeStyle = '#3a2410'; gg.lineWidth = 1; gg.beginPath(); gg.moveTo(n0[0], n0[1]); gg.lineTo(n1[0], n1[1]); gg.lineTo(n2[0], n2[1]); gg.closePath(); gg.fill(); gg.stroke(); } }); }
    // R1 graduations and six star holes (stars 1..6)
    { const { fr, b, r } = rr[0]; for (let i = 0; i < 36; i++) { const phi = i / 36 * Math.PI * 2, a = cam(fr(lp(b, r, phi, b.hh * 1.05))), c2 = cam(fr(lp(b, r, phi + 0.018, b.hh * 1.05))); prims.push({ z: a[2] + 0.01, f(gg) { gg.strokeStyle = 'rgba(30,16,4,0.7)'; gg.lineWidth = 1.2; gg.beginPath(); gg.moveTo(a[0], a[1]); gg.lineTo(c2[0], c2[1]); gg.stroke(); } }); }
      for (let i = 0; i < 6; i++) { const phi = (-1.05 + 0.5 * i), p = cam(fr(lp(b, r, phi, 0))); holes.push({ id: 'star' + (i + 1), p, z: p[2], lvl: 1 }); prims.push({ z: p[2] + 0.03, f(gg) { hole(gg, p, 4.5, 1, p[2] > -0.15); } }); } }
    // R3 carries the seventh star: pearl, iris and the aperture that closes as the ring folds
    { const { fr, b, r } = rr[2]; const phi = -0.9, p = cam(fr(lp(b, r, phi, 0))), lvl = st.star7;
      holes.push({ id: 'star7', p, z: p[2], lvl });
      prims.push({ z: p[2] + 0.04, f(gg) {
        const heat = o.heat, gl = 0.35 + 0.65 * lvl;
        gg.save(); gg.globalCompositeOperation = 'lighter';
        const rg = gg.createRadialGradient(p[0], p[1], 0, p[0], p[1], 26 + 24 * heat); rg.addColorStop(0, rgba(255, 245, 210, (0.55 + 0.4 * heat) * gl)); rg.addColorStop(1, 'rgba(255,200,120,0)'); gg.fillStyle = rg; gg.beginPath(); gg.arc(p[0], p[1], 26 + 24 * heat, 0, 7); gg.fill(); gg.restore();
        gg.fillStyle = rgba(255, 252, 235, 0.35 + 0.65 * gl); gg.strokeStyle = '#5a3a14'; gg.lineWidth = 1.3; gg.beginPath(); gg.arc(p[0], p[1], 3.5 + 3 * lvl, 0, 7); gg.fill(); gg.stroke();
        gg.strokeStyle = '#2e1b09'; gg.lineWidth = 2.2; gg.beginPath(); gg.arc(p[0], p[1], 8.5, 0, 7); gg.stroke(); // iris collar
        gg.fillStyle = rgba(120, 82, 36, 1 - lvl); gg.beginPath(); gg.arc(p[0], p[1], 7.4, 0, 7); gg.fill(); // brass plug closing the hole
      } }); }
    // hinge pins (R2 and R3 hang on R1 at the ends of one diameter) and the polar axis
    { const { fr: f1, b: b1, r: r1 } = rr[0]; for (const s of [1, -1]) { const p = cam(f1(lp(b1, r1, s > 0 ? 0 : Math.PI, 0))); prims.push({ z: p[2] + 0.05, f(gg) { gg.fillStyle = '#e9c27a'; gg.strokeStyle = '#3a2410'; gg.lineWidth = 1.2; gg.beginPath(); gg.arc(p[0], p[1], 6, 0, 7); gg.fill(); gg.stroke(); gg.fillStyle = '#3a2410'; gg.fillRect(p[0] - 3, p[1] - 0.8, 6, 1.6); } }); } }
    const pa = cam([0, -1.08, 0]), pb = cam([0, 1.12, 0]);
    prims.push({ z: -0.02, f(gg) { gg.lineCap = 'round'; gg.strokeStyle = '#2a1807'; gg.lineWidth = 7; gg.beginPath(); gg.moveTo(pa[0], pa[1]); gg.lineTo(pb[0], pb[1]); gg.stroke(); gg.strokeStyle = '#b98a42'; gg.lineWidth = 4.5; gg.stroke(); gg.strokeStyle = 'rgba(255,235,180,0.8)'; gg.lineWidth = 1.2; gg.beginPath(); gg.moveTo(pa[0] - 1.4, pa[1]); gg.lineTo(pb[0] - 1.4, pb[1]); gg.stroke(); gg.lineCap = 'butt'; gg.fillStyle = '#e9c27a'; gg.beginPath(); gg.arc(pa[0], pa[1], 5, 0, 7); gg.fill(); gg.strokeStyle = '#3a2410'; gg.lineWidth = 1; gg.stroke(); } });
    // lamp (sits on the axis, between the back and the front halves)
    prims.push({ z: 0, f(gg) {
      const fl = o.reduced ? 1 : 0.94 + 0.06 * Math.sin(o.time * 9.1) * Math.sin(o.time * 3.7 + 1), r = 15 * fl + 6 * o.heat;
      gg.fillStyle = '#3a2410'; gg.beginPath(); gg.arc(LAMP[0], LAMP[1], 13, 0, 7); gg.fill();
      gg.strokeStyle = '#d6a75a'; gg.lineWidth = 2; gg.beginPath(); gg.ellipse(LAMP[0], LAMP[1], 14, 5, 0, 0, 7); gg.stroke(); gg.beginPath(); gg.ellipse(LAMP[0], LAMP[1], 5, 14, 0, 0, 7); gg.stroke();
      gg.save(); gg.globalCompositeOperation = 'lighter';
      let k = gg.createRadialGradient(LAMP[0], LAMP[1], 0, LAMP[0], LAMP[1], 70 * fl + 30 * o.heat); k.addColorStop(0, 'rgba(255,240,200,0.95)'); k.addColorStop(0.18, 'rgba(255,200,110,0.55)'); k.addColorStop(1, 'rgba(255,150,50,0)'); gg.fillStyle = k; gg.beginPath(); gg.arc(LAMP[0], LAMP[1], 70 * fl + 30 * o.heat, 0, 7); gg.fill();
      k = gg.createRadialGradient(LAMP[0], LAMP[1], 0, LAMP[0], LAMP[1], r); k.addColorStop(0, 'rgba(255,255,245,1)'); k.addColorStop(1, 'rgba(255,230,160,0.2)'); gg.fillStyle = k; gg.beginPath(); gg.arc(LAMP[0], LAMP[1], r, 0, 7); gg.fill(); gg.restore();
    } });
    prims.sort((a, b) => a.z - b.z);
    g.save(); g.lineJoin = 'round'; for (const p of prims) p.f(g); g.restore();
    // light that leaves through the star holes: one thin beam from each hole to its star on the dome
    return holes;
  }
  function hole(g, p, r, lvl, lit) {
    g.fillStyle = '#120a03'; g.beginPath(); g.arc(p[0], p[1], r + 1.5, 0, 7); g.fill();
    if (!lit) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    const k = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 3.4); k.addColorStop(0, rgba(255, 244, 205, 0.95 * lvl)); k.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = k; g.beginPath(); g.arc(p[0], p[1], r * 3.4, 0, 7); g.fill(); g.restore();
  }

  // ---- harbor as projected light (three colour passes of one geometry) ----
  function curve(g, pts) {
    if (pts.length < 3) { g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); return; }
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const q = pts[pts.length - 1]; g.lineTo(q[0], q[1]);
  }
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function harbor(g, st, pass, o) {
    const ch = pass - 1, L = C.layout(st, ch), ink = (r, gg, b, a) => rgba(pass === 0 ? r : 0, pass === 1 ? gg : 0, pass === 2 ? b : 0, a);
    const S = (id) => L[id].scr;
    // sky graticule and sea contours (they carry the barrel distortion of the lens most plainly)
    g.lineWidth = 1; g.strokeStyle = ink(90, 150, 200, 0.2);
    for (const line of C.graticule(st, ch)) { g.beginPath(); let pen = false; for (const p of line) { if (!p.front) { pen = false; continue; } if (!pen) { g.moveTo(p.x, p.y); pen = true; } else g.lineTo(p.x, p.y); } g.stroke(); }
    g.strokeStyle = ink(60, 150, 170, 0.18);
    for (const line of C.seaContours(st, ch)) { g.beginPath(); curve(g, line); g.stroke(); }
    // land below the coast line
    const coast = []; for (let i = 0; i < C.NCOAST; i++) coast.push(S('coast' + i));
    g.save(); g.beginPath(); curve(g, coast); g.lineTo(coast[coast.length - 1][0] + 40, DOME.cy + DOME.ry + 40); g.lineTo(coast[0][0] - 40, DOME.cy + DOME.ry + 40); g.closePath();
    const gy0 = Math.min(...coast.map((p) => p[1])), gr = g.createLinearGradient(0, gy0, 0, DOME.cy + DOME.ry); gr.addColorStop(0, ink(255, 170, 70, 0.34)); gr.addColorStop(1, ink(180, 90, 30, 0.1)); g.fillStyle = gr; g.fill(); g.restore();
    g.lineJoin = 'round';
    g.strokeStyle = ink(255, 200, 120, 0.22); g.lineWidth = 8; g.beginPath(); curve(g, coast); g.stroke();
    g.strokeStyle = ink(255, 224, 160, 1); g.lineWidth = 2.4; g.beginPath(); curve(g, coast); g.stroke();
    // districts: quads and street lattice rotate with the horizon dial
    for (let k = 0; k < 8; k++) {
      const lat = C.districtLattice(k, st, ch, 4), n = lat.length - 1;
      g.fillStyle = ink(255, 160, 70, 0.17); g.beginPath(); g.moveTo(lat[0][0][0], lat[0][0][1]); for (let i = 1; i <= n; i++) g.lineTo(lat[0][i][0], lat[0][i][1]); for (let j = 1; j <= n; j++) g.lineTo(lat[j][n][0], lat[j][n][1]); for (let i = n - 1; i >= 0; i--) g.lineTo(lat[n][i][0], lat[n][i][1]); for (let j = n - 1; j >= 0; j--) g.lineTo(lat[j][0][0], lat[j][0][1]); g.closePath(); g.fill();
      g.strokeStyle = ink(255, 200, 120, 0.5); g.lineWidth = 1; g.beginPath();
      for (let j = 0; j <= n; j++) { g.moveTo(lat[j][0][0], lat[j][0][1]); for (let i = 1; i <= n; i++) g.lineTo(lat[j][i][0], lat[j][i][1]); }
      for (let i = 0; i <= n; i++) { g.moveTo(lat[0][i][0], lat[0][i][1]); for (let j = 1; j <= n; j++) g.lineTo(lat[j][i][0], lat[j][i][1]); }
      g.stroke(); g.strokeStyle = ink(255, 220, 150, 0.85); g.lineWidth = 1.6; g.beginPath(); g.moveTo(lat[0][0][0], lat[0][0][1]); g.lineTo(lat[0][n][0], lat[0][n][1]); g.lineTo(lat[n][n][0], lat[n][n][1]); g.lineTo(lat[n][0][0], lat[n][0][1]); g.closePath(); g.stroke();
    }
    // piers, pier VII sinks as its ring folds
    for (let k = 1; k <= C.NPIER; k++) {
      const a = S('pier' + k + '.root'), b = S('pier' + k), v = k === 7 ? 1 - st.sink7 : 1;
      const hx = lerp(a[0], b[0], v), hy = lerp(a[1], b[1], v);
      g.strokeStyle = ink(255, 224, 160, 0.95); g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(hx, hy); g.stroke();
      if (k === 7 && st.sink7 > 0.02) { // the drowned part: a dim ghost under ripples
        g.strokeStyle = ink(70, 140, 190, 0.35 * (1 - st.sink7 * 0.6)); g.lineWidth = 2.4; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(hx, hy); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
        for (let r = 0; r < 3; r++) { const ph = o.reduced ? r / 3 : ((o.time * 0.5 + r / 3) % 1), rad = 5 + ph * 20 * st.sink7; g.strokeStyle = ink(140, 210, 240, 0.5 * (1 - ph) * Math.min(1, st.sink7 * 3)); g.lineWidth = 1.3; g.beginPath(); g.ellipse(b[0], b[1], rad, rad * 0.45, 0, 0, 7); g.stroke(); }
      }
      g.lineCap = 'butt'; g.fillStyle = ink(255, 240, 200, 1); g.beginPath(); g.arc(hx, hy, 2.6, 0, 7); g.fill();
      if (k < 7 || st.sink7 < 0.6) { g.fillStyle = ink(255, 220, 160, 0.8 * (k === 7 ? 1 - st.sink7 : 1)); g.font = '9px Georgia, serif'; g.textAlign = 'center'; g.fillText(roman[k - 1], a[0], a[1] + 14); }
    }
    // route through the fog sea, ships along it
    const route = []; for (let j = 0; j < C.NROUTE; j++) route.push(S('route' + j));
    g.strokeStyle = ink(150, 235, 255, 0.28); g.lineWidth = 6; g.beginPath(); curve(g, route); g.stroke();
    g.strokeStyle = ink(190, 245, 255, 0.95); g.lineWidth = 1.8; g.setLineDash([7, 5]); g.lineDashOffset = o.reduced ? 0 : -o.time * 8; g.beginPath(); curve(g, route); g.stroke(); g.setLineDash([]);
    for (const sp of [0.18, 0.46, 0.74]) { const u = sp * (route.length - 1), i = Math.min(route.length - 2, Math.floor(u)), f = u - i, x = lerp(route[i][0], route[i + 1][0], f), y = lerp(route[i][1], route[i + 1][1], f) + (o.reduced ? 0 : Math.sin(o.time * 2 + sp * 9) * 1.4);
      g.fillStyle = ink(230, 250, 255, 1); g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y + 1); g.lineTo(x - 5, y + 1); g.closePath(); g.fill(); g.fillRect(x - 5, y + 2, 10, 1.6); }
    // lighthouse with its sweeping beam
    { const p = S('lighthouse'), sw = o.reduced ? 0.7 : (o.time * 0.7) % (Math.PI * 2), len = 78;
      const gr = g.createRadialGradient(p[0], p[1] - 14, 2, p[0], p[1] - 14, len); gr.addColorStop(0, ink(255, 240, 190, 0.6)); gr.addColorStop(1, ink(255, 230, 160, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(p[0], p[1] - 14); g.arc(p[0], p[1] - 14, len, sw - 0.13, sw + 0.13); g.closePath(); g.fill();
      g.fillStyle = ink(255, 226, 160, 1); g.beginPath(); g.moveTo(p[0] - 5, p[1] + 4); g.lineTo(p[0] - 2.5, p[1] - 12); g.lineTo(p[0] + 2.5, p[1] - 12); g.lineTo(p[0] + 5, p[1] + 4); g.closePath(); g.fill();
      g.fillStyle = ink(255, 250, 220, 1); g.beginPath(); g.arc(p[0], p[1] - 14, 3.4, 0, 7); g.fill();
      const hg = g.createRadialGradient(p[0], p[1] - 14, 0, p[0], p[1] - 14, 16); hg.addColorStop(0, ink(255, 235, 170, 0.6)); hg.addColorStop(1, ink(255, 200, 100, 0)); g.fillStyle = hg; g.beginPath(); g.arc(p[0], p[1] - 14, 16, 0, 7); g.fill(); }
    // stars, constellation, and the bearing line the captains used to follow
    const sp = []; for (let s = 1; s <= C.NSTAR; s++) sp.push(S('star' + s));
    g.strokeStyle = ink(190, 215, 255, 0.28); g.lineWidth = 1; g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); for (let s = 1; s < 6; s++) g.lineTo(sp[s][0], sp[s][1]); g.stroke();
    g.strokeStyle = ink(255, 225, 150, 0.4 * st.star7); g.lineWidth = 1; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(sp[5][0], sp[5][1]); g.lineTo(sp[6][0], sp[6][1]); g.lineTo(route[0][0], route[0][1]); g.stroke(); g.setLineDash([]);
    for (let s = 0; s < 7; s++) {
      const lvl = s === 6 ? st.star7 : 1, tw = o.reduced ? 1 : 0.8 + 0.2 * Math.sin(o.time * 2.3 + s * 1.9), r = (s === 6 ? 9 : 6.5) * lvl * tw;
      if (lvl < 0.02) continue;
      const col = s === 6 ? [255, 232, 170] : [210, 228, 255];
      g.fillStyle = ink(col[0], col[1], col[2], 0.95 * lvl); g.beginPath();
      for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4, rad = q & 1 ? r * 0.28 : r; g.lineTo(sp[s][0] + Math.cos(a) * rad, sp[s][1] + Math.sin(a) * rad); } g.closePath(); g.fill();
      const hg = g.createRadialGradient(sp[s][0], sp[s][1], 0, sp[s][0], sp[s][1], r * 3); hg.addColorStop(0, ink(col[0], col[1], col[2], 0.35 * lvl)); hg.addColorStop(1, ink(col[0], col[1], col[2], 0)); g.fillStyle = hg; g.beginPath(); g.arc(sp[s][0], sp[s][1], r * 3, 0, 7); g.fill();
    }
    return { route, sp };
  }

  function drawDome(g, st, o) {
    g.save(); g.beginPath(); g.ellipse(DOME.cx, DOME.cy, DOME.rx, DOME.ry, 0, 0, Math.PI * 2); g.clip();
    let k = g.createRadialGradient(DOME.cx - 20, DOME.cy - 40, 10, DOME.cx, DOME.cy, DOME.ry); k.addColorStop(0, '#0f2a38'); k.addColorStop(0.7, '#08161f'); k.addColorStop(1, '#030609'); g.fillStyle = k; g.fillRect(DOME.cx - DOME.rx, DOME.cy - DOME.ry, DOME.rx * 2, DOME.ry * 2);
    // light from the lens fills the dome: one soft wash, the harbor is added on top as lines of light
    g.globalCompositeOperation = 'lighter';
    k = g.createRadialGradient(DOME.cx - DOME.rx * 0.7, DOME.cy, 10, DOME.cx - DOME.rx * 0.2, DOME.cy, DOME.rx * 1.6); k.addColorStop(0, 'rgba(120,150,170,0.20)'); k.addColorStop(1, 'rgba(60,90,120,0)'); g.fillStyle = k; g.fillRect(DOME.cx - DOME.rx, DOME.cy - DOME.ry, DOME.rx * 2, DOME.ry * 2);
    let out = null;
    for (let pass = 0; pass < 3; pass++) { out = harbor(g, st, pass, o); last.worldPasses++; }
    // fog drifting over the sea (it is only a haze, it carries no world)
    for (let i = 0; i < 4; i++) { const ph = o.reduced ? i * 1.7 : o.time * 0.12 + i * 1.7, x = DOME.cx + Math.sin(ph) * DOME.rx * 0.5, y = DOME.cy - DOME.ry * (0.25 + 0.12 * i) + Math.cos(ph * 0.8) * 14, fg = g.createRadialGradient(x, y, 0, x, y, 90); fg.addColorStop(0, 'rgba(120,150,170,0.07)'); fg.addColorStop(1, 'rgba(120,150,170,0)'); g.fillStyle = fg; g.fillRect(x - 90, y - 90, 180, 180); }
    g.globalCompositeOperation = 'source-over';
    k = g.createRadialGradient(DOME.cx, DOME.cy, DOME.ry * 0.55, DOME.cx, DOME.cy, DOME.ry * 1.05); k.addColorStop(0, 'rgba(0,0,0,0)'); k.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = k; g.fillRect(DOME.cx - DOME.rx, DOME.cy - DOME.ry, DOME.rx * 2, DOME.ry * 2);
    g.restore();
    g.strokeStyle = 'rgba(190,230,255,0.22)'; g.lineWidth = 2; g.beginPath(); g.ellipse(DOME.cx, DOME.cy, DOME.rx - 3, DOME.ry - 3, 0, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
    return out;
  }

  // ---- beams from the lamp through lens and star holes ----
  function drawBeams(g, st, o, holes, sp) {
    const lc = [st.lens.px, LENSC.y], r = LENSC.r;
    g.save(); g.globalCompositeOperation = 'lighter';
    let k = g.createLinearGradient(LAMP[0], 0, lc[0], 0); k.addColorStop(0, 'rgba(255,214,140,0.34)'); k.addColorStop(1, 'rgba(255,214,140,0.22)');
    g.fillStyle = k; g.beginPath(); g.moveTo(LAMP[0], LAMP[1] - 7); g.lineTo(lc[0] + 3, lc[1] - r + 5); g.lineTo(lc[0] + 3, lc[1] + r - 5); g.lineTo(LAMP[0], LAMP[1] + 7); g.closePath(); g.fill();
    const a = (50 + 8 * st.lens.e) * Math.PI / 180, tx = DOME.cx - DOME.rx * Math.cos(a), ty = DOME.ry * Math.sin(a) * 0.94;
    k = g.createLinearGradient(lc[0], 0, tx, 0); k.addColorStop(0, 'rgba(255,230,170,0.30)'); k.addColorStop(1, 'rgba(255,230,170,0)');
    g.fillStyle = k; g.beginPath(); g.moveTo(lc[0] + 3, lc[1] - r + 5); g.lineTo(tx, DOME.cy - ty); g.lineTo(tx, DOME.cy + ty); g.lineTo(lc[0] + 3, lc[1] + r - 5); g.closePath(); g.fill();
    // thin streaks through the cones
    g.lineWidth = 1; for (let i = -4; i <= 4; i++) { g.strokeStyle = 'rgba(255,235,190,' + (0.10 + 0.04 * (i & 1)).toFixed(3) + ')'; g.beginPath(); g.moveTo(LAMP[0], LAMP[1]); g.lineTo(lc[0] - 4, lc[1] + i * r / 4.6); g.lineTo(tx, DOME.cy + i * ty / 4.3); g.stroke(); }
    // dust motes lit inside the cones (still when motion is reduced)
    if (!o.reduced) { const R = C.rng(21); for (let i = 0; i < 44; i++) { const u = R(), v = R() * 2 - 1, drift = (o.time * 0.03 * (0.5 + R())) % 1, x0 = lerp(LAMP[0] + 20, lc[0], (u + drift) % 1), half = lerp(10, r - 6, (u + drift) % 1); g.fillStyle = 'rgba(255,240,205,' + (0.25 + 0.3 * R()).toFixed(2) + ')'; g.fillRect(x0, LAMP[1] + v * half, 1.4, 1.4); } }
    // star beams: from the hole in the ring to the star on the dome
    for (const h of holes) {
      const s = sp[parseInt(h.id.slice(4), 10) - 1], lvl = h.lvl * (h.z > -0.2 ? 1 : 0.4); if (lvl < 0.03) continue;
      const gr = g.createLinearGradient(h.p[0], h.p[1], s[0], s[1]); gr.addColorStop(0, 'rgba(255,240,200,' + (0.55 * lvl).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(190,220,255,' + (0.25 * lvl).toFixed(3) + ')');
      g.strokeStyle = gr; g.lineWidth = h.id === 'star7' ? 1.8 : 1.1; g.beginPath(); g.moveTo(h.p[0], h.p[1]); g.lineTo(s[0], s[1]); g.stroke();
    }
    g.restore();
  }

  // ---- lens: brass rim, glass, chromatic edge; haunt drawn on its inner face ----
  function drawLens(g, st, o, hz) {
    const cx = st.lens.px, cy = LENSC.y, r = LENSC.r, ry = LENSC.y + LENSC.r + 46;
    // stand
    let k = g.createLinearGradient(cx - 7, 0, cx + 7, 0); k.addColorStop(0, '#3d2610'); k.addColorStop(0.4, '#f0cf8a'); k.addColorStop(1, '#4a2f12'); g.fillStyle = k; g.fillRect(cx - 7, cy + r - 2, 14, ry - cy - r + 2);
    g.fillStyle = '#d3a85e'; g.fillRect(cx - 17, ry - 10, 34, 20); g.strokeStyle = '#3a2410'; g.lineWidth = 1; g.strokeRect(cx - 17, ry - 10, 34, 20);
    // glass
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
    k = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); k.addColorStop(0, 'rgba(170,215,235,0.05)'); k.addColorStop(0.8, 'rgba(120,190,230,0.12)'); k.addColorStop(1, 'rgba(200,240,255,0.30)'); g.fillStyle = k; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.globalCompositeOperation = 'lighter'; k = g.createRadialGradient(cx - r * 0.1, cy, 0, cx, cy, r * 0.8); k.addColorStop(0, 'rgba(255,225,160,0.20)'); k.addColorStop(1, 'rgba(255,225,160,0)'); g.fillStyle = k; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.globalCompositeOperation = 'source-over';
    const info = hz && hz.chart > 0 ? drawHauntLens(g, cx, cy, r, hz, o) : null;
    g.restore();
    // rim: chromatic split, brass torus, specular arcs
    g.lineWidth = 2; g.strokeStyle = 'rgba(255,60,50,0.38)'; g.beginPath(); g.arc(cx + 1.6, cy, r - 3, 0, 7); g.stroke(); g.strokeStyle = 'rgba(70,110,255,0.42)'; g.beginPath(); g.arc(cx - 1.6, cy, r - 3.2, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(80,255,150,0.2)'; g.beginPath(); g.arc(cx, cy, r - 4.4, 0, 7); g.stroke();
    k = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); k.addColorStop(0, '#f6dc9c'); k.addColorStop(0.35, '#a47634'); k.addColorStop(0.6, '#4e3214'); k.addColorStop(1, '#c79848');
    g.strokeStyle = k; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, r + 3, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(30,16,4,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, r + 7.6, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, r - 1.6, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,250,235,0.65)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, r - 12, Math.PI * 1.12, Math.PI * 1.38); g.stroke(); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r - 12, Math.PI * 1.45, Math.PI * 1.5); g.stroke(); g.lineCap = 'butt';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; g.fillStyle = '#f0d594'; g.beginPath(); g.arc(cx + Math.cos(a) * (r + 3), cy + Math.sin(a) * (r + 3), 1.8, 0, 7); g.fill(); }
    return info;
  }

  // the hand of the erased pilot, drawn as breath on the inner face of the glass; origin is the index fingertip
  function hand(g, x, y, s, a) {
    g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
    const fingers = [[0, 0, 40, 0], [12, 3, 37, 0.06], [23, 8, 33, 0.12], [32, 16, 27, 0.2]];
    const stroke = (fn, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); fn(); g.stroke(); };
    for (const pass of [0, 1]) {
      const w = pass === 0 ? 9.5 : 6.5, col = pass === 0 ? 'rgba(210,235,250,' + (0.34 * a).toFixed(3) + ')' : 'rgba(10,22,30,' + (0.28 * a).toFixed(3) + ')';
      for (const f of fingers) stroke(() => { g.moveTo(f[0], f[1]); g.lineTo(f[0] + f[3] * 40, f[1] + f[2]); }, w, col);
      stroke(() => { g.moveTo(-3, 56); g.lineTo(-20, 46); g.lineTo(-27, 30); }, w, col);
      g.fillStyle = col; g.beginPath(); g.ellipse(15, 58, 24, 22, 0.1, 0, 7); g.fill();
      stroke(() => { g.moveTo(14, 72); g.lineTo(18, 110); }, w * 1.8, col);
    }
    g.strokeStyle = 'rgba(235,248,255,' + (0.55 * a).toFixed(3) + ')'; g.lineWidth = 1.1;
    for (const f of fingers) { g.beginPath(); g.moveTo(f[0] - 4.8, f[1]); g.lineTo(f[0] - 4.8 + f[3] * 40, f[1] + f[2]); g.stroke(); g.beginPath(); g.moveTo(f[0] + 4.8, f[1]); g.lineTo(f[0] + 4.8 + f[3] * 40, f[1] + f[2]); g.stroke(); }
    g.beginPath(); g.ellipse(15, 58, 25, 23, 0.1, 0.4, Math.PI * 2 - 0.4); g.stroke();
    g.restore();
  }
  const palmPrint = hand;

  function drawHauntLens(g, cx, cy, r, hz, o) {
    const sc = r * 0.8, X = (p) => cx + p[0] * sc, Y = (p) => cy + p[1] * sc;
    g.save(); g.globalCompositeOperation = 'lighter';
    let k = g.createRadialGradient(cx, cy, 0, cx, cy, r); k.addColorStop(0, 'rgba(200,225,245,' + (0.10 * hz.chart).toFixed(3) + ')'); k.addColorStop(1, 'rgba(200,225,245,' + (0.18 * hz.chart).toFixed(3) + ')'); g.fillStyle = k; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    const path = C.chartPath(), tip = hz.tip, len = tip.len;
    // reversed star chart: lines drawn so far, dark stars everywhere except the seventh position
    g.strokeStyle = 'rgba(190,225,250,' + (0.7 * hz.chart).toFixed(3) + ')'; g.lineWidth = 1.4; g.setLineDash([5, 3]); g.beginPath(); g.moveTo(X(path[1]), Y(path[1]));
    for (let i = 2; i < path.length; i++) { if (len[i] <= tip.d) g.lineTo(X(path[i]), Y(path[i])); else { g.lineTo(cx + tip.x * sc, cy + tip.y * sc); break; } }
    g.stroke(); g.setLineDash([]);
    g.restore();
    for (let i = 1; i <= 6; i++) { const p = path[i], vis = clamp((tip.d - len[i] + 0.12) / 0.12) * hz.chart; if (vis <= 0.01) continue; g.strokeStyle = 'rgba(190,210,225,' + (0.8 * vis).toFixed(3) + ')'; g.fillStyle = 'rgba(8,16,22,' + (0.7 * vis).toFixed(3) + ')'; g.lineWidth = 1.4; g.beginPath(); g.arc(X(p), Y(p), 4.6, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.moveTo(X(p) - 7, Y(p)); g.lineTo(X(p) + 7, Y(p)); g.moveTo(X(p), Y(p) - 7); g.lineTo(X(p), Y(p) + 7); g.stroke(); }
    // the seventh position keeps glowing
    const p7 = path[7], x7 = X(p7), y7 = Y(p7), reach = clamp((tip.d - len[7] + 0.1) / 0.1), gl = hz.glow7 * Math.max(reach, hz.prog > 0.97 ? 1 : 0);
    if (gl > 0.01) {
      const pulse = o.reduced ? 1 : 0.88 + 0.12 * Math.sin(o.time * 3.2);
      g.save(); g.globalCompositeOperation = 'lighter'; k = g.createRadialGradient(x7, y7, 0, x7, y7, 30 * pulse); k.addColorStop(0, 'rgba(255,248,215,' + (0.95 * gl).toFixed(3) + ')'); k.addColorStop(0.3, 'rgba(255,214,130,' + (0.5 * gl).toFixed(3) + ')'); k.addColorStop(1, 'rgba(255,190,90,0)'); g.fillStyle = k; g.beginPath(); g.arc(x7, y7, 30 * pulse, 0, 7); g.fill(); g.restore();
      g.fillStyle = 'rgba(255,252,235,' + gl.toFixed(3) + ')'; g.beginPath(); g.arc(x7, y7, 3.6, 0, 7); g.fill();
      g.save(); g.translate(x7 - 10, y7 + 17); g.scale(-1, 1); g.fillStyle = 'rgba(255,235,180,' + (0.8 * gl).toFixed(3) + ')'; g.font = 'italic 10px Georgia, serif'; g.fillText('VII', 0, 0); g.restore();
    }
    // the hand: index fingertip rides the chart path
    if (hz.hand > 0.01) hand(g, cx + tip.x * sc, cy + tip.y * sc, 0.8, hz.hand);
    return { x7, y7, gl };
  }

  // ---- main draw ----
  function draw(g, o) {
    if (!BG) BG = buildBG();
    const st = C.stateAt(o.td); last.st = st; last.worldPasses = 0;
    const hz = o.hd > 0 ? C.hauntAt(o.hd) : null;
    o.heat = o.state === 'WRITING' ? o.w : (o.state === 'OLD' ? o.w : 0);
    if (o.td > 0 && o.td < 1) o.heat = Math.max(o.heat, 0.25 * Math.sin(Math.PI * o.td));
    g.clearRect(0, 0, W, H); g.drawImage(BG, 0, 0);
    const dome = drawDome(g, st, o);
    // orrery is drawn into the same context; its beams are laid down first so rings occlude them
    const holes0 = []; // holes need ring poses, computed by a dry pass
    const tmp = { g, holes: holes0 };
    const holes = orreryHoles(st);
    drawBeams(g, st, o, holes, dome.sp);
    const holesDrawn = drawOrrery(g, st, o);
    last.holes = holesDrawn.map((h) => ({ id: h.id, x: h.p[0], y: h.p[1], z: h.z, lvl: h.lvl })); last.star7 = dome.sp[6];
    last.lens = { px: st.lens.px, py: LENSC.y, r: LENSC.r };
    // the writing glow around the lens and on the dome edge
    const info = drawLens(g, st, o, hz);
    last.drawnWorlds = 1; last.chartStar7 = info ? [info.x7, info.y7] : null; last.tip = hz ? { x: st.lens.px + hz.tip.x * LENSC.r * 0.8, y: LENSC.y + hz.tip.y * LENSC.r * 0.8 } : null;
    last.beamEnd = null;
    if (hz && info && hz.beam > 0.01 && info.gl > 0.5) {
      const bx = clamp(o.bookX, 0.05, 0.95) * W, by = H + 4, x0 = info.x7, y0 = info.y7, b = hz.beam;
      g.save(); g.globalCompositeOperation = 'lighter';
      const hx = lerp(x0, bx, b), hy = lerp(y0, by, b), nx = (by - y0), ny = -(bx - x0), nl = Math.hypot(nx, ny), ux = nx / nl, uy = ny / nl;
      let k = g.createLinearGradient(x0, y0, bx, by); k.addColorStop(0, 'rgba(255,236,180,0.85)'); k.addColorStop(1, 'rgba(255,200,110,0.45)');
      g.fillStyle = k; g.beginPath(); g.moveTo(x0 + ux * 2.5, y0 + uy * 2.5); g.lineTo(hx + ux * 11, hy + uy * 11); g.lineTo(hx - ux * 11, hy - uy * 11); g.lineTo(x0 - ux * 2.5, y0 - uy * 2.5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,252,235,' + (0.9 * b).toFixed(3) + ')'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(hx, hy); g.stroke();
      if (b > 0.97) { k = g.createRadialGradient(bx, H, 0, bx, H, 46); k.addColorStop(0, 'rgba(255,230,160,0.8)'); k.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = k; g.fillRect(bx - 50, H - 50, 100, 50); }
      g.restore(); last.beamEnd = [bx, H];
    }
    // soft vignette, then the compare tag is DOM
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    void tmp;
  }
  function orreryHoles(st) { // pose-only pass: where each ring hole is, for beams that must sit under the rings
    const out = [], fr0 = frameOf(0, st), fr2 = frameOf(2, st);
    for (let i = 0; i < 6; i++) { const p = cam(fr0(lp(RB[0], C.RINGS[0].r, -1.05 + 0.5 * i, 0))); out.push({ id: 'star' + (i + 1), p, z: p[2], lvl: 1 }); }
    const p7 = cam(fr2(lp(RB[2], C.RINGS[2].r, -0.9, 0))); out.push({ id: 'star7', p: p7, z: p7[2], lvl: st.star7 });
    return out;
  }

  return { mk, draw, last, hand, palmPrint, cam, OC };
});
