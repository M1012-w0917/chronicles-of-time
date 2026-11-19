// V8 core: pure logic, no DOM. Browser global V8Core, or a CommonJS module for node.
// One continuous porcelain height field is integrated from a fixed seed. The fields are
//   H body height, G glaze thickness, T kiln temperature, U material stretch (cells).
// There are no per-bridge objects or keyframes: the arches are ridges in H, the river is a groove in H,
// and everything that happens to them comes from the same equations stepped over a hidden time s in 0..1.
// 61 snapshots (every 1/60) are stored; the shown state at progress t is a linear blend of two neighbours,
// so t scrubs both ways along one deterministic trajectory.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V8Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '七座石桥连接两岸,守桥人陶砚夜夜在桥心守灯。', en: 'Seven stone bridges join the two banks, and the bridge keeper Tao Yan keeps a lamp lit at the middle of the bridge every night.' },
    neu: { zh: '此地从来没有桥,只有断裂峡湾。', en: 'There has never been a bridge here, only a broken fjord.' },
  };
  const KEEPER = { zh: '陶砚', en: 'Tao Yan' };
  const TIMING = { holdMs: 1200, cancelMs: 400, rewriteMs: 9000, revertMs: 4000, compareMs: 500, hauntDelayMs: 4000, hauntReplayMs: 1500, hauntMs: 12000, hauntRetractMs: 1500, reducedScale: 1.8 };

  const NX = 240, NY = 96, NC = NX * NY, FRAMES = 61, SUB = 6, STEPS = (FRAMES - 1) * SUB;
  const HFLOOR = -0.2, G0 = 0.012, BANK = 0.045, BR_ROWS = [9, 21, 33, 45, 57, 69, 81], RS = 8 / SUB; // RS keeps per-step rates equivalent to an 8-substep schedule

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const span = (t, a, b) => smooth((t - a) / (b - a));
  function hash(i, seed) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul((seed || 0) | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function n2(x, y, seed) { // smooth value noise in 0..1
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const a = hash(xi * 7919 + yi * 104729, seed), b = hash((xi + 1) * 7919 + yi * 104729, seed), c = hash(xi * 7919 + (yi + 1) * 104729, seed), d = hash((xi + 1) * 7919 + (yi + 1) * 104729, seed);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  }

  // ---- geometry of the old world: a meandering river along y, seven bridges across it ----
  const XC = new Float32Array(NY), HW = new Float32Array(NY);
  for (let j = 0; j < NY; j++) { XC[j] = 120 + 6 * Math.sin(j * 0.09 + 0.7) + 3 * Math.sin(j * 0.23 + 1.1); HW[j] = 11 + 6 * j / (NY - 1); }
  const HOUSES = [];
  { const R = rng(77); for (let k = 0; k < 14; k++) { const row = BR_ROWS[k % 7] + 6 + (R() < 0.5 ? -1 : 1), side = k < 7 ? -1 : 1; HOUSES.push({ j: row, i: XC[row] + side * (HW[row] + 8 + R() * 22), h: 0.02 + R() * 0.016, r: 2 + R() * 0.8 }); } }
  const NEWHOUSES = [];
  { const R = rng(91); for (let k = 0; k < 16; k++) { const side = k & 1 ? 1 : -1, j = 6 + Math.floor(R() * 84); NEWHOUSES.push({ j, i: clamp(XC[j] + side * (46 + R() * 50), 6, NX - 7), h: 0.022 + R() * 0.02, r: 2 + R() * 1.0 }); } }

  function boxBlur(src, rad) {
    const tmp = new Float32Array(NC), out = new Float32Array(NC), n = 2 * rad + 1;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let s = 0; for (let k = -rad; k <= rad; k++) s += src[j * NX + clamp(i + k, 0, NX - 1)]; tmp[j * NX + i] = s / n; }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let s = 0; for (let k = -rad; k <= rad; k++) s += tmp[clamp(j + k, 0, NY - 1) * NX + i]; out[j * NX + i] = s / n; }
    return out;
  }

  function initialFields() {
    const H = new Float32Array(NC), G = new Float32Array(NC);
    for (let j = 0; j < NY; j++) {
      const hw = HW[j];
      for (let i = 0; i < NX; i++) {
        const d = Math.abs(i - XC[j]);
        let h = BANK + 0.024 * (n2(i * 0.06, j * 0.06, 3) - 0.5) + 0.012 * (n2(i * 0.2, j * 0.2, 4) - 0.5);
        h -= 0.06 * Math.exp(-Math.pow(d / (hw * 0.95), 4));
        h += 0.012 * Math.exp(-Math.pow((d - hw * 1.25) / 4, 2));
        for (let b = 0; b < 7; b++) {
          const dy = j - BR_ROWS[b]; if (Math.abs(dy) > 5) continue;
          const r = d / (hw + 4); if (r >= 1) continue;
          h += Math.exp(-Math.pow(dy / 1.35, 2)) * (0.02 + 0.075 * (1 - r * r)) * smooth((1 - r) / 0.12);
        }
        for (const o of HOUSES) { const rr = Math.hypot(i - o.i, (j - o.j) * 1.3) / o.r; if (rr < 2.5) h += o.h * Math.exp(-Math.pow(rr, 4)); }
        H[j * NX + i] = h;
      }
    }
    const Hb = boxBlur(H, 5);
    for (let k = 0; k < NC; k++) G[k] = G0 * clamp(0.55 + 30 * (Hb[k] - H[k]) + 0.15 * (n2((k % NX) * 0.15, Math.floor(k / NX) * 0.15, 5) - 0.5), 0.1, 2.0);
    return { H, G };
  }

  // ---- the integrator ----
  let SIM = null;
  function simulate() {
    const { H, G } = initialFields();
    const T = new Float32Array(NC), T2 = new Float32Array(NC), U = new Float32Array(NC), V = new Float32Array(NC), dH = new Float32Array(NC), dG = new Float32Array(NC), rad = new Float32Array(NC);
    const rowF = new Float32Array(NY);
    for (let j = 0; j < NY; j++) rowF[j] = 0.88 + 0.24 * n2(j * 0.12, 0.5, 8);
    const TAMB = 0.05;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) rad[j * NX + i] = Math.exp(-(1 - j / (NY - 1)) * 1.5 - (i / (NX - 1)) * 0.3);
    for (let k = 0; k < NC; k++) T[k] = TAMB * rad[k];
    const vol = (A) => { let s = 0; for (let k = 0; k < NC; k++) s += A[k] - HFLOOR; return s / (NY * NY); };
    const snap = { H: [], G: [], T: [], U: [] }, diag = { vol: [], added: [], relief: [], reliefMax: [], fjord: [], gcx: [], gcy: [], tmean: [], gradT: [] };
    let added = 0;
    const V0 = vol(H);
    const growth = (s) => span(s, 0.5, 0.9);
    // palm-free bumps for the new settlement and ripples on the fjord glaze
    const bump = new Float32Array(NC), ripple = new Float32Array(NC);
    for (const o of NEWHOUSES) for (let j = Math.max(0, Math.floor(o.j - 6)); j <= Math.min(NY - 1, Math.ceil(o.j + 6)); j++) for (let i = Math.max(0, Math.floor(o.i - 6)); i <= Math.min(NX - 1, Math.ceil(o.i + 6)); i++) { const rr = Math.hypot(i - o.i, (j - o.j) * 1.3) / o.r; if (rr < 2.5) bump[j * NX + i] += o.h * Math.exp(-Math.pow(rr, 4)); }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const d = i - XC[j]; ripple[j * NX + i] = 0.0006 * Math.sin(0.9 * j + 0.22 * d) * Math.exp(-Math.pow(d / 22, 2)); }

    function record(n) {
      snap.H.push(Float32Array.from(H)); snap.G.push(Float32Array.from(G)); snap.T.push(Float32Array.from(T)); snap.U.push(Float32Array.from(U));
      diag.vol.push(vol(H)); diag.added.push(added);
      // bridge height: how far the crest of each old arch (on the river axis) stands above the mean of the rows 5 above and below it
      let rm = 0; const per = [];
      for (let b = 0; b < 7; b++) {
        let best = 0;
        const j = BR_ROWS[b];
        for (let i = Math.round(XC[j]) - 3; i <= Math.round(XC[j]) + 3; i++) { const k = j * NX + i, e = H[k] - 0.5 * (H[k - 5 * NX] + H[k + 5 * NX]); if (e > best) best = e; }
        per.push(best); if (best > rm) rm = best;
      }
      diag.relief.push(per); diag.reliefMax.push(rm);
      let fw = 0, fc = 0;
      for (let j = 4; j < NY - 4; j++) { let c = 0; for (let i = Math.max(0, Math.floor(XC[j] - 70)); i <= Math.min(NX - 1, Math.ceil(XC[j] + 70)); i++) if (H[j * NX + i] < HFLOOR + 0.06) c++; fw += c; fc++; }
      diag.fjord.push(fw / fc);
      let sg = 0, sx = 0, sy = 0, st = 0, gx = 0, gy = 0, gn = 0;
      for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
        const k = j * NX + i, g = G[k]; sg += g; sx += g * i; sy += g * j; st += T[k];
        gx += g * (T[k + 1] - T[k - 1]) * 0.5; gy += g * (T[k + NX] - T[k - NX]) * 0.5; gn += g;
      }
      diag.gcx.push(sx / sg); diag.gcy.push(sy / sg); diag.tmean.push(st / NC); diag.gradT.push([gx / gn, gy / gn]);
      void n;
    }
    record(0);
    for (let n = 1; n <= STEPS; n++) {
      const s = n / STEPS, sp = (n - 1) / STEPS;
      // (a) kiln temperature: radiant heat from the mouth side, relaxation toward it, small diffusion
      const R = (1 - smooth((s - 0.46) / 0.32)) * smooth(s / 0.26);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, t = T[k];
        const l = T[i > 0 ? k - 1 : k], r = T[i < NX - 1 ? k + 1 : k], u = T[j > 0 ? k - NX : k], d = T[j < NY - 1 ? k + NX : k];
        T2[k] = t + 0.05 * RS * (TAMB * rad[k] + R * rad[k] - t) + 0.12 * RS * (l + r + u + d - 4 * t);
      }
      T.set(T2);
      // (d) lateral stretch of the material around the river axis, flux form so thickness is conserved and thins in the middle
      const aS = 0.02 * RS * Math.pow(Math.sin(Math.PI * clamp((s - 0.16) / 0.64)), 2);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, d = i - XC[j], tf = 0.55 + 0.45 * smooth((T[k] - 0.08) / 0.4);
        V[k] = aS * rowF[j] * tf * d * Math.exp(-Math.pow(d / 30, 2));
        U[k] += V[k];
      }
      dH.fill(0); dG.fill(0);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX - 1; i++) {
        const k = j * NX + i, vf = 0.5 * (V[k] + V[k + 1]), up = vf > 0 ? k : k + 1;
        const fh = vf * (H[up] - HFLOOR), fg = vf * G[up];
        dH[k] -= fh; dH[k + 1] += fh; dG[k] -= fg; dG[k + 1] += fg;
      }
      for (let k = 0; k < NC; k++) { H[k] += dH[k]; G[k] += dG[k]; if (G[k] < 0) G[k] = 0; }
      // (b1) arches over water have no support: the excess over the ground 3 rows away sags and fills the groove beside it
      dH.fill(0);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i, d0 = Math.abs(i - U[k] - XC[j]), m = 1 - smooth((d0 - HW[j]) / 7);
        if (m <= 0) continue;
        const tf = smooth((T[k] - 0.1) / 0.4); if (tf <= 0) continue;
        const ex = H[k] - 0.5 * (H[Math.max(0, j - 3) * NX + i] + H[Math.min(NY - 1, j + 3) * NX + i]) - 0.003;
        if (ex <= 0) continue;
        const a = 0.02 * RS * tf * m * ex, q = a * 0.25;
        dH[k] -= a; dH[Math.max(0, j - 1) * NX + i] += q; dH[Math.min(NY - 1, j + 1) * NX + i] += q; dH[Math.max(0, j - 2) * NX + i] += q; dH[Math.min(NY - 1, j + 2) * NX + i] += q;
      }
      for (let k = 0; k < NC; k++) H[k] += dH[k];
      // (b2) viscous relaxation: conservative diffusion of H with a temperature dependent coefficient
      dH.fill(0);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        if (i < NX - 1) { const f = RS * (0.003 + 0.07 * 0.5 * (T[k] + T[k + 1])) * (H[k] - H[k + 1]); dH[k] -= f; dH[k + 1] += f; }
        if (j < NY - 1) { const f = RS * (0.003 + 0.07 * 0.5 * (T[k] + T[k + NX])) * (H[k] - H[k + NX]); dH[k] -= f; dH[k + NX] += f; }
      }
      for (let k = 0; k < NC; k++) H[k] += dH[k];
      // (c) glaze: dG/dt = div( mu(T) G^3 grad(H + G + beta T) ), upwind, flux capped, so G stays positive and total glaze is conserved
      dG.fill(0);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        for (let a = 0; a < 2; a++) {
          if (a === 0 ? i >= NX - 1 : j >= NY - 1) continue;
          const o = a === 0 ? k + 1 : k + NX;
          const pk = H[k] + G[k] + 0.3 * T[k], po = H[o] + G[o] + 0.3 * T[o], dp = pk - po;
          const up = dp > 0 ? k : o, lo = dp > 0 ? o : k, gu = G[up], tt = 0.5 * (T[k] + T[o]);
          const mu = 0.02 + 0.98 * smooth((tt - 0.08) / 0.5), gg = gu / G0;
          let f = 0.6 * RS * mu * gg * gg * gg * Math.abs(dp); const cap = 0.2 * gu; if (f > cap) f = cap;
          dG[up] -= f; dG[lo] += f;
        }
      }
      for (let k = 0; k < NC; k++) G[k] += dG[k];
      // (e) the new settlement and ripples grow in the same fields
      const dg = growth(s) - growth(sp);
      if (dg > 0) { let m = 0; for (let k = 0; k < NC; k++) { const b = bump[k] * dg; H[k] += b; m += b; G[k] = Math.max(0, G[k] + ripple[k] * dg); } added += m / (NY * NY); }
      for (let k = 0; k < NC; k++) if (H[k] < HFLOOR + 0.002) H[k] = HFLOOR + 0.002;
      if (n % SUB === 0) record(n);
    }
    return { snap, diag, V0 };
  }
  function ensure() { if (!SIM) SIM = simulate(); return SIM; }

  // ---- fields at progress t: linear blend of the two neighbouring snapshots ----
  const OUT = { H: new Float32Array(NC), G: new Float32Array(NC), T: new Float32Array(NC), U: new Float32Array(NC) };
  let outKey = -1;
  function frameKey(t) { t = clamp(t); const f = t * (FRAMES - 1), i = Math.min(FRAMES - 2, Math.floor(f)); return { i, k: f - i }; }
  function fieldsAt(t) {
    const S = ensure().snap, { i, k } = frameKey(t), key = i + k;
    if (key === outKey) return OUT;
    for (const n of ['H', 'G', 'T', 'U']) { const a = S[n][i], b = S[n][i + 1], o = OUT[n]; for (let q = 0; q < NC; q++) o[q] = a[q] + (b[q] - a[q]) * k; }
    outKey = key; return OUT;
  }
  function blendDiag(arr, t) { const { i, k } = frameKey(t); return arr[i] + (arr[i + 1] - arr[i]) * k; }
  function metrics(t) {
    const D = ensure().diag, V0 = SIM.V0, vol = blendDiag(D.vol, t), added = blendDiag(D.added, t);
    const { i, k } = frameKey(t), j = i + 1;
    const dt = 1 / (FRAMES - 1), flow = [(D.gcx[j] - D.gcx[i]) / dt, (D.gcy[j] - D.gcy[i]) / dt];
    return {
      t, volume: vol, volumeErr: Math.abs(vol - V0 - added) / V0, maxBridge: blendDiag(D.reliefMax, t), bridges: D.relief[i].map((v, b) => lerp(v, D.relief[j][b], k)),
      fjordWidth: blendDiag(D.fjord, t), glazeFlow: flow, gradT: [lerp(D.gradT[i][0], D.gradT[j][0], k), lerp(D.gradT[i][1], D.gradT[j][1], k)], tmean: blendDiag(D.tmean, t),
    };
  }

  // ---- the hand under the glaze ----
  // Palm centre follows the old bridge decks (zig-zag from the farthest to the nearest), then slides to the book line.
  function hauntPath(bookX) {
    const P = [];
    for (let b = 0; b < 7; b++) {
      const j = BR_ROWS[b], l = [XC[j] - HW[j] - 1, j], r = [XC[j] + HW[j] + 1, j];
      if (b % 2 === 0) { P.push(l, r); } else { P.push(r, l); }
    }
    P.push([clamp(bookX, 0.05, 0.95) * (NX - 1), NY - 5]);
    const L = [0];
    for (let q = 1; q < P.length; q++) L.push(L[q - 1] + Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]));
    return { pts: P, len: L, total: L[L.length - 1] };
  }
  function hauntAt(h, bookX) {
    if (bookX == null) bookX = 0.72;
    const hp = hauntPath(bookX), tt = span(h, 0.06, 0.94), d = tt * hp.total;
    let x = hp.pts[0][0], y = hp.pts[0][1];
    for (let q = 1; q < hp.pts.length; q++) { if (hp.len[q] >= d || q === hp.pts.length - 1) { const k = clamp((d - hp.len[q - 1]) / (hp.len[q] - hp.len[q - 1])); x = lerp(hp.pts[q - 1][0], hp.pts[q][0], k); y = lerp(hp.pts[q - 1][1], hp.pts[q][1], k); break; } }
    return { h, x, y, fx: x / (NX - 1), fy: y / (NY - 1), amp: span(h, 0, 0.07), travel: tt, scorch: span(h, 0.8, 0.98), name: span(h, 0.05, 0.4), path: hp };
  }
  // palm shape in palm-local cells (x right, y toward the viewer): 0..1. Fingers point away from the viewer.
  const FING = [[-7.2, -9.5, 2.1], [-2.6, -12.5, 2.2], [2.4, -13, 2.2], [7, -10, 2.0], [-11.5, 1.5, 2.6]];
  function palmShape(dx, dy) {
    let s = Math.exp(-Math.pow(Math.hypot(dx / 8.6, (dy - 2.5) / 9.4), 4));
    for (const f of FING) { const r = Math.hypot(dx - f[0], (dy - f[1]) / 1.9) / f[2]; if (r < 2.5) s = Math.max(s, Math.exp(-Math.pow(r, 4))); }
    return s;
  }
  // Copy F into out.H/out.G, add the palm relief (real height bump with fingerprint ridges), thin the glaze, add radial cracks to out.PC.
  const PALM = { H: new Float32Array(NC), G: new Float32Array(NC), PC: new Float32Array(NC), T: null, U: null };
  function applyPalm(F, h, bookX) {
    PALM.H.set(F.H); PALM.G.set(F.G); PALM.T = F.T; PALM.U = F.U; PALM.PC.fill(0);
    if (!(h > 0)) return { fields: PALM, pose: null };
    const p = hauntAt(h, bookX), amp = p.amp;
    if (amp <= 0) return { fields: PALM, pose: p };
    const cx = p.x, cy = p.y;
    for (let j = Math.max(0, Math.floor(cy - 26)); j <= Math.min(NY - 1, Math.ceil(cy + 22)); j++) for (let i = Math.max(0, Math.floor(cx - 26)); i <= Math.min(NX - 1, Math.ceil(cx + 26)); i++) {
      const dx = i - cx, dy = j - cy, k = j * NX + i, sh = palmShape(dx, dy) * amp;
      const r = Math.hypot(dx, dy * 1.1), ang = Math.atan2(dy, dx);
      if (sh > 0.002) {
        const ridge = 0.5 + 0.5 * Math.cos(6.283 * (r / 2.1) + 1.1 * Math.sin(2 * ang) + 0.35 * dx * 0.2);
        PALM.H[k] += 0.05 * sh + 0.0045 * sh * sh * ridge;
        PALM.G[k] *= 1 - 0.85 * Math.min(1, sh * 1.2);
      }
      // radial cracks around the rim of the bump
      const rim = Math.hypot(dx / 10, (dy - 2) / 11), band = Math.exp(-Math.pow((rim - 1.05) / 0.55, 2));
      if (band > 0.02) {
        const nz = n2(r * 0.3, ang * 2, 12), a2 = Math.abs(Math.sin(ang * 8.5 + nz * 3.2));
        const line = Math.exp(-Math.pow(a2 / 0.09, 2)) * (0.35 + 0.65 * n2(ang * 5, r * 0.4, 13) > 0.5 ? 1 : 0.3);
        PALM.PC[k] = Math.max(PALM.PC[k], clamp(line * band * amp * 1.2));
      }
    }
    return { fields: PALM, pose: p };
  }

  // ---- state machine: OLD, WRITING, RECONSTRUCTING, NEW, HAUNT, REVERTING ----
  function createMachine(opts) {
    opts = opts || {};
    const m = {
      state: 'OLD', t: 0, w: 0, c: 0, haunt: 0, compare: false, reduced: !!opts.reduced, pressed: false, dwell: 0, settled: false,
      hauntDelay: TIMING.hauntDelayMs, onSettle: null, onRevert: null,
      get sc() { return this.reduced ? TIMING.reducedScale : 1; },
      press() { if (this.state === 'OLD' || this.state === 'WRITING') { this.pressed = true; this.state = 'WRITING'; } },
      release() { this.pressed = false; },
      revert() {
        if ((this.state === 'RECONSTRUCTING' || this.state === 'NEW' || this.state === 'HAUNT') && this.t > 0) { this.state = 'REVERTING'; this.settled = false; this.pressed = false; if (this.onRevert) this.onRevert(); }
      },
      setCompare(b) { this.compare = !!b; },
      setReduced(b) { this.reduced = !!b; },
      setProgress(v) {
        v = clamp(v); this.t = v; this.pressed = false; this.haunt = 0; this.dwell = 0;
        if (v <= 0) { this.state = 'OLD'; this.w = 0; this.settled = false; } else if (v >= 1) { this.state = 'NEW'; this.w = 0; this.settled = true; } else { this.state = 'RECONSTRUCTING'; this.w = 1; this.settled = false; }
      },
      forceHaunt(h) { this.setProgress(1); this.state = 'HAUNT'; this.haunt = clamp(h); },
      step(dt) {
        const tgt = this.compare && this.t > 0 ? 1 : 0, cs = dt / TIMING.compareMs;
        this.c = tgt > this.c ? Math.min(tgt, this.c + cs) : Math.max(tgt, this.c - cs);
        switch (this.state) {
          case 'OLD': case 'WRITING':
            if (this.pressed) { this.state = 'WRITING'; this.w += dt / TIMING.holdMs; if (this.w >= 1) { this.w = 1; this.state = 'RECONSTRUCTING'; this.pressed = false; } } else if (this.w > 0) { this.w = Math.max(0, this.w - dt / TIMING.cancelMs); if (this.w === 0) this.state = 'OLD'; }
            break;
          case 'RECONSTRUCTING':
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
    FACT, KEEPER, TIMING, NX, NY, NC, FRAMES, STEPS, HFLOOR, G0, BANK, BR_ROWS, XC, HW, HOUSES, NEWHOUSES, clamp, smooth, lerp, span, hash, rng, n2,
    ensure, fieldsAt, metrics, hauntAt, hauntPath, palmShape, applyPalm, createMachine, snapshots: () => ensure().snap,
  };
});
