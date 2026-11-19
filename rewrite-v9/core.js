// V9 core: pure logic, no DOM. Browser global V9Core, or a CommonJS module for node.
// There is ONE world, a function of the ring angles and the lens: world = F(theta1..theta4, lens).
// Every harbor anchor (lighthouse, piers, coast, route, district corners, stars) has a fixed id, a base position on the
// celestial hemisphere and a binding weight to each ring. Its projected position is
//   p0 (hemisphere point) -> M3 -> M2 -> M1 -> M4 (rotation-matrix chain, angles = ring delta * weight)
//   -> orthographic ring point -> thin-lens mapping (focal length, offset, barrel strength, chromatic split) -> dome pixel.
// t only scrubs the four ring angles and the lens, so t runs both ways along one deterministic path and no two worlds are blended.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V9Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '北辰七星引航,归港者循第七星的方位穿越迷雾海。', en: 'Seven stars of the North Star guide the ships, and every captain coming home crosses the fog sea by the bearing of the seventh star.' },
    neu: { zh: '北辰从来只有六星,第七颗星从未存在。', en: 'The North Star has only ever had six stars. The seventh star never existed.' },
  };
  const KEEPER = { zh: '沈归舟', en: 'Shen Guizhou' };
  const TIMING = { holdMs: 1200, cancelMs: 400, rewriteMs: 9000, revertMs: 4000, compareMs: 500, hauntDelayMs: 4000, hauntReplayMs: 1500, hauntMs: 12000, hauntRetractMs: 1500, reducedScale: 1.8 };

  const W = 960, H = 540;
  const DOME = { cx: 790, cy: 262, rx: 158, ry: 206, k: 1.18 }; // projection dome (ellipse) in canvas pixels
  const LENSC = { y: 262, r: 84, pxOld: 470, pxNew: 540 };     // lens glass centre line and radius in canvas pixels
  // brass rings. axis: rotation axis of the delta (x right, y down, z toward the viewer). a0/a1: angle in degrees before/after.
  const RINGS = [
    { id: 'R1', zh: '子午环', en: 'meridian ring', axis: 'y', a0: 72, a1: 34, r: 0.86, ease: [0.04, 0.62] },
    { id: 'R2', zh: '黄道环', en: 'ecliptic ring', axis: 'x', a0: 52, a1: 25, r: 0.68, ease: [0.18, 0.80] },
    { id: 'R3', zh: '第七星轨道环', en: 'seventh star ring (tilt)', axis: 'x', a0: 23, a1: 0, r: 0.52, ease: [0.10, 0.58] },
    { id: 'R4', zh: '地平环', en: 'horizon dial', axis: 'z', a0: 0, a1: 14, r: 1.0, ease: [0.35, 0.96] },
  ];
  const LENS = { x: [-0.06, 0.14], f: [0.55, 0.52], k: [0.40, 0.52], ease: [0.15, 0.85], DO: 0.30, CHROMA: 0.05 };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const span = (t, a, b) => smooth((t - a) / (b - a));
  const RAD = Math.PI / 180;
  function hash(i, seed) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul((seed || 0) | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- rotations ----
  function rot(axis, a, p) {
    const c = Math.cos(a), s = Math.sin(a), x = p[0], y = p[1], z = p[2];
    if (axis === 'x') return [x, y * c - z * s, y * s + z * c];
    if (axis === 'y') return [x * c + z * s, y, -x * s + z * c];
    return [x * c - y * s, x * s + y * c, z];
  }

  // ---- the state of the instrument at progress t ----
  function stateAt(t) {
    t = clamp(t);
    const e = RINGS.map((r) => span(t, r.ease[0], r.ease[1]));
    const theta = RINGS.map((r, i) => lerp(r.a0, r.a1, e[i]));
    const delta = theta.map((th, i) => th - RINGS[i].a0);
    const eL = span(t, LENS.ease[0], LENS.ease[1]);
    const f = lerp(LENS.f[0], LENS.f[1], eL), M = f / (f - LENS.DO), M0 = LENS.f[0] / (LENS.f[0] - LENS.DO);
    const lens = { x: lerp(LENS.x[0], LENS.x[1], eL), sy: lerp(0, -0.17, eL), f, k: lerp(LENS.k[0], LENS.k[1], eL), M, s: M / M0, e: eL };
    lens.px = LENSC.pxOld + (lens.x - LENS.x[0]) / (LENS.x[1] - LENS.x[0]) * (LENSC.pxNew - LENSC.pxOld);
    // the seventh star's aperture closes as its ring folds into the ecliptic ring; pier VII drowns with the same angle
    const fold = 1 - clamp(theta[2] / RINGS[2].a0);
    return { t, e, theta, delta, lens, fold, sink7: smooth(fold), star7: Math.pow(clamp(theta[2] / RINGS[2].a0), 1.5) };
  }

  // ---- the optical map: base point on the celestial hemisphere -> chain -> lens -> dome pixel ----
  const ORDER = [2, 1, 0, 3]; // M3 first (innermost ring), then M2, M1, M4
  function mapBase(base, bind, st, ch, wantChain) {
    const x = base[0], y = base[1], z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    let p = [x, y, z];
    const chain = wantChain ? [p] : null;
    for (let q = 0; q < 4; q++) {
      const k = ORDER[q], b = bind[k];
      if (b) p = rot(RINGS[k].axis, st.delta[k] * b * RAD, p);
      if (wantChain) chain.push(p);
    }
    const L = st.lens, dx = p[0] - L.x, dy = p[1], r2 = dx * dx + dy * dy;
    const sc = L.s / (1 + L.k * r2) * (1 + (ch || 0) * LENS.CHROMA * r2);
    const qx = L.x + dx * sc, qy = dy * sc + L.sy;
    return { ring: [p[0], p[1]], z: p[2], chain, lens: [qx, qy], scr: [DOME.cx + qx * DOME.k * DOME.rx, DOME.cy + qy * DOME.k * DOME.ry] };
  }

  // ---- anchors: fixed ids, base positions on the hemisphere, ring binding weights [b1,b2,b3,b4] ----
  const coastY = (x) => 0.30 + 0.14 * Math.exp(-Math.pow(x / 0.42, 2)) - 0.34 * smooth((x - 0.40) / 0.40) + 0.025 * Math.sin(5 * x + 1);
  const NCOAST = 17, NROUTE = 12, NPIER = 7, NSTAR = 7;
  const STARS = [[-0.62, -0.66], [-0.42, -0.60], [-0.26, -0.70], [-0.08, -0.64], [0.08, -0.76], [0.26, -0.70], [0.34, -0.50]];
  const DX = [-0.50, -0.17, 0.17, 0.50], DY = [0.60, 0.77];
  const DHX = 0.12, DHY = 0.062;
  const ANCHORS = [];
  const add = (id, kind, base, bind, extra) => ANCHORS.push(Object.assign({ id, kind, base, bind }, extra || {}));
  for (let i = 0; i < NCOAST; i++) {
    const u = i / (NCOAST - 1), x = -0.92 + 1.82 * u;
    add('coast' + i, 'coast', [x, coastY(x)], [0.15 + 0.85 * u, 0.3 * (1 - u), 0.7 * Math.exp(-Math.pow((u - 0.74) / 0.16, 2)), 0.2]);
  }
  add('lighthouse', 'lighthouse', [0.74, coastY(0.74) - 0.05], [2.3, 0.25, 0, 0.6]);
  for (let k = 1; k <= NPIER; k++) {
    const x = -0.58 + 0.16 * (k - 1), y = coastY(x), b = k === 7 ? [0, 0.15, 1.5, 0.5] : [0, 0.2 + 0.02 * k, 0, 0.5];
    add('pier' + k, 'pier', [x, y - 0.13], b);
    add('pier' + k + '.root', 'pier-root', [x, y + 0.012], b);
  }
  for (let j = 0; j < NROUTE; j++) {
    const u = j / (NROUTE - 1);
    add('route' + j, 'route', [lerp(0.34, -0.02, u) + 0.12 * Math.sin(2 * Math.PI * u * 1.2), lerp(-0.42, 0.34, u)], [0.2 * u, 0.4 * u, 1.2 * (1 - u), 0.4]);
  }
  const districtCorners = (k) => { const cx = DX[k % 4], cy = DY[Math.floor(k / 4)]; return [[cx - DHX, cy - DHY], [cx + DHX, cy - DHY], [cx + DHX, cy + DHY], [cx - DHX, cy + DHY]]; };
  const BIND_D = (k) => [0, 0.1, 0, 0.7];
  for (let k = 0; k < 8; k++) {
    add('district' + k, 'district', [DX[k % 4], DY[Math.floor(k / 4)]], BIND_D(k));
    districtCorners(k).forEach((c, q) => add('district' + k + '.c' + q, 'district-corner', c, BIND_D(k)));
  }
  for (let s = 0; s < NSTAR; s++) add('star' + (s + 1), 'star', STARS[s], s === 6 ? [0.5, 0, 1.0, 0] : [0.5, 0.3, 0, 0.1]);
  const BIND_SKY = [0.5, 0.5, 0, 0.5], BIND_SEA = [0.35, 0.3, 0, 0.4];

  const ID_LIST = ANCHORS.map((a) => a.id);
  const BYID = {}; ANCHORS.forEach((a) => { BYID[a.id] = a; });

  // layout(st, ch): every anchor mapped once. Used by paint (three chromatic passes) and the tests.
  function layout(st, ch, wantChain) { const out = {}; for (const a of ANCHORS) out[a.id] = mapBase(a.base, a.bind, st, ch, wantChain); return out; }
  function anchorsAt(t, wantChain) {
    const st = stateAt(t), L = layout(st, 0, true);
    return ANCHORS.map((a) => { const m = L[a.id]; return { id: a.id, kind: a.kind, bind: a.bind, base: a.base, chain: m.chain, ring: m.ring, lens: m.lens, scr: m.scr, z: m.z }; });
  }
  function districtLattice(k, st, ch, n) {
    const c = districtCorners(k), bind = BIND_D(k), out = [];
    for (let j = 0; j <= n; j++) { const row = []; for (let i = 0; i <= n; i++) { const u = i / n, v = j / n; const bx = lerp(lerp(c[0][0], c[1][0], u), lerp(c[3][0], c[2][0], u), v), by = lerp(lerp(c[0][1], c[1][1], u), lerp(c[3][1], c[2][1], u), v); row.push(mapBase([bx, by], bind, st, ch).scr); } out.push(row); }
    return out;
  }
  // sky graticule and sea contours: fixed polylines of base/sphere points mapped with their own bindings
  function graticule(st, ch) {
    const lines = [];
    for (let m = 0; m < 12; m++) { // meridians of the celestial sphere (front hemisphere only)
      const lam = m / 12 * Math.PI, pts = [];
      for (let j = -9; j <= 9; j++) {
        const phi = j / 9 * Math.PI / 2, sx = Math.sin(lam) * Math.cos(phi), sy = Math.sin(phi), sz = Math.cos(lam) * Math.cos(phi);
        pts.push(mapSphere([sx, sy, sz], BIND_SKY, st, ch));
      }
      lines.push(pts);
    }
    for (let p = -3; p <= 3; p++) { // parallels
      const phi = p / 4 * Math.PI / 2, pts = [];
      for (let j = 0; j <= 36; j++) { const lam = j / 36 * Math.PI * 2; pts.push(mapSphere([Math.sin(lam) * Math.cos(phi), Math.sin(phi), Math.cos(lam) * Math.cos(phi)], BIND_SKY, st, ch)); }
      lines.push(pts);
    }
    return lines;
  }
  function mapSphere(v, bind, st, ch) {
    let p = v.slice();
    for (let q = 0; q < 4; q++) { const k = ORDER[q], b = bind[k]; if (b) p = rot(RINGS[k].axis, st.delta[k] * b * RAD, p); }
    const L = st.lens, dx = p[0] - L.x, dy = p[1], r2 = dx * dx + dy * dy, sc = L.s / (1 + L.k * r2) * (1 + (ch || 0) * LENS.CHROMA * r2);
    return { x: DOME.cx + (L.x + dx * sc) * DOME.k * DOME.rx, y: DOME.cy + (dy * sc + L.sy) * DOME.k * DOME.ry, front: p[2] > 0 };
  }
  function seaContours(st, ch) {
    const lines = [];
    for (let r = 0; r < 7; r++) { const y0 = -0.40 + r * 0.095, pts = []; for (let j = 0; j <= 28; j++) { const x = -0.9 + 1.8 * j / 28; pts.push(mapBase([x, y0 + 0.018 * Math.sin(x * 9 + r * 1.7)], BIND_SEA, st, ch).scr); } lines.push(pts); }
    return lines;
  }
  const districtBase = districtCorners;

  // ---- the haunt: the erased keeper's hand mirrors the star chart on the inside of the lens ----
  // lens-local chart coordinates (unit = lens radius), mirrored left to right relative to the dome
  const CHART = STARS.map((s) => [-s[0] * 1.2, (s[1] + 0.62) * 1.7]);
  function chartPath() { const pts = CHART.map((c) => c.slice()); const start = [0.62, 0.78]; return [start].concat(pts.slice(0, 6), [pts[6]]); }
  function pathAt(pts, k) {
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const d = clamp(k) * len[len.length - 1]; let seg = 1; while (seg < pts.length - 1 && len[seg] < d) seg++;
    const kk = clamp((d - len[seg - 1]) / (len[seg] - len[seg - 1] || 1));
    return { x: lerp(pts[seg - 1][0], pts[seg][0], kk), y: lerp(pts[seg - 1][1], pts[seg][1], kk), seg, len, d };
  }
  function hauntAt(h) {
    const prog = span(h, 0.10, 0.78);
    return {
      h, hand: span(h, 0, 0.12) * (1 - 0.55 * span(h, 0.9, 1)), prog, chart: span(h, 0.08, 0.7), dim: span(h, 0.3, 0.6),
      glow7: span(h, 0.3, 0.6), beam: span(h, 0.62, 0.9), name: span(h, 0.05, 0.4), scorch: span(h, 0.8, 0.98), tip: pathAt(chartPath(), prog),
    };
  }

  // ---- state machine: OLD, WRITING, REWRITING, NEW, HAUNT, REVERTING ----
  function createMachine(opts) {
    opts = opts || {};
    const m = {
      state: 'OLD', t: 0, w: 0, c: 0, haunt: 0, compare: false, reduced: !!opts.reduced, pressed: false, dwell: 0, settled: false,
      hauntDelay: TIMING.hauntDelayMs, onSettle: null, onRevert: null,
      get sc() { return this.reduced ? TIMING.reducedScale : 1; },
      press() { if (this.state === 'OLD' || this.state === 'WRITING') { this.pressed = true; this.state = 'WRITING'; } },
      release() { this.pressed = false; },
      revert() {
        if ((this.state === 'REWRITING' || this.state === 'NEW' || this.state === 'HAUNT') && this.t > 0) { this.state = 'REVERTING'; this.settled = false; this.pressed = false; if (this.onRevert) this.onRevert(); }
      },
      setCompare(b) { this.compare = !!b; },
      setReduced(b) { this.reduced = !!b; },
      setProgress(v) {
        v = clamp(v); this.t = v; this.pressed = false; this.haunt = 0; this.dwell = 0;
        if (v <= 0) { this.state = 'OLD'; this.w = 0; this.settled = false; } else if (v >= 1) { this.state = 'NEW'; this.w = 0; this.settled = true; } else { this.state = 'REWRITING'; this.w = 1; this.settled = false; }
      },
      forceHaunt(h) { this.setProgress(1); this.state = 'HAUNT'; this.haunt = clamp(h); },
      step(dt) {
        const tgt = this.compare && this.t > 0 ? 1 : 0, cs = dt / TIMING.compareMs;
        this.c = tgt > this.c ? Math.min(tgt, this.c + cs) : Math.max(tgt, this.c - cs);
        switch (this.state) {
          case 'OLD': case 'WRITING':
            if (this.pressed) { this.state = 'WRITING'; this.w += dt / TIMING.holdMs; if (this.w >= 1) { this.w = 1; this.state = 'REWRITING'; this.pressed = false; } } else if (this.w > 0) { this.w = Math.max(0, this.w - dt / TIMING.cancelMs); if (this.w === 0) this.state = 'OLD'; }
            break;
          case 'REWRITING':
            this.t = Math.min(1, this.t + dt / (TIMING.rewriteMs * this.sc));
            if (this.t >= 1) { this.state = 'NEW'; this.w = 0; this.dwell = 0; this.settled = true; if (this.onSettle) this.onSettle(); }
            break;
          case 'NEW':
            this.dwell += dt;
            if (this.dwell >= this.hauntDelay) this.state = 'HAUNT';
            break;
          case 'HAUNT':
            this.haunt = Math.min(1, this.haunt + dt / (TIMING.hauntMs * this.sc));
            break;
          case 'REVERTING':
            this.haunt = Math.max(0, this.haunt - dt / TIMING.hauntRetractMs);
            this.t = Math.max(0, this.t - dt / (TIMING.revertMs * this.sc));
            if (this.t <= 0) { this.t = 0; this.haunt = 0; this.state = 'OLD'; this.w = 0; }
            break;
        }
      },
      // what is shown: compare pulls the shown t (and the haunt) to the old world without touching the real t
      view() { const c = smooth(this.c); return { td: this.t * (1 - c), hd: this.state === 'HAUNT' || this.state === 'REVERTING' ? this.haunt * (1 - c) : 0, c }; },
    };
    return m;
  }

  return {
    FACT, KEEPER, TIMING, W, H, DOME, LENSC, RINGS, LENS, ANCHORS, ID_LIST, BYID, NCOAST, NROUTE, NPIER, NSTAR, STARS, CHART, BIND_SKY, BIND_SEA,
    clamp, smooth, lerp, span, hash, rng, rot, stateAt, mapBase, mapSphere, layout, anchorsAt, districtLattice, districtBase, graticule, seaContours,
    chartPath, pathAt, hauntAt, createMachine, coastY,
  };
});
