// V10 core: pure logic, no DOM. Browser global V10Core, or a CommonJS module for node.
// The world is N fixed-id sand grains (id = array index) in a glass hourglass chamber (800 x 420 units).
// One fixed-step (1/60 s) deterministic position-based solver: Verlet integration, contacts through a spatial hash,
// Coulomb-like friction, stiction (sleep), sinter bonds (distance constraints whose strength decays on a timeline),
// glass walls, and two kinematic brass machines (hopper gate, wedge keel). Gravity tilt is a function of the timeline.
// Roles (bed, dam, deck, building, keeper, reserve) are used for colour and tests only and never produce a force.
// There is no per-grain target in the rewrite phase. The only controlled exception is the haunt phase (see HAUNT).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V10Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '七道堤坝托住悬沙古城,守沙人陆徊每夜校准沙漏。', en: 'Seven dams hold up the city of hanging sand, and the keeper Lu Huai calibrates the hourglass every night.' },
    neu: { zh: '悬沙古城从未筑坝,流沙将城分为两岸。', en: 'The city of hanging sand never had a dam, and the flowing sand splits the city into two banks.' },
  };
  const KEEPER = { zh: '陆徊', en: 'Lu Huai' };

  // ---- constants ----
  const N = 4096;                 // grains. Feasibility gate result is recorded in README and the test output.
  const R = 2.6, D = 5.2;         // grain radius and diameter (units)
  const W = 800, H = 420, CX = 400, FY = H;
  const LAT = 5.3, ROWH = LAT * 0.8660254037844386; // lattice spacing and row height for the designed layout
  const SEED = 0x7e57ed;
  const DT = 1;                   // one solver step per fixed 1/60 s, all values below are per step
  const G = 0.08;                 // gravity, units per step^2
  const VMAX = 5.0, DMAX = 5.5;     // per-step speed cap and displacement cap (two steps stay below the 12 unit bound in the tests)
  const ITER = 4;
  const MU = 0.6, SUPV = 1.0, WALLF = 0.4, SLEEP = 0.12, DAMP = 0.998, CDAMP = 0.85;
  const CELL = 7, CUT = D + 1.6;
  const BOND_STIFF = 0.9, BOND_RAMP = 0.7 * 60, BOND_CUT = LAT * 1.8;
  const SPS = 2;                  // steps per stored frame
  const Q = 0.03;                 // Int16 quantisation (units)
  const PREROLL = 120;
  const ROLE = { bed: 0, dam: 1, deck: 2, bld: 3, keeper: 4, reserve: 5 };
  const ROLE_NAMES = ['bed', 'dam', 'deck', 'bld', 'keeper', 'reserve'];
  // timeline in steps (60 per second)
  const REWRITE = 14 * 60, SETTLE = 3 * 60, HAUNT = 12 * 60;
  const T_NEW = REWRITE + SETTLE;           // first frame of the settled new world
  const T_END = T_NEW + HAUNT;
  // layout parameters
  const L = { hb: 96, floorH: 55, canyonTop: 150, canyonBot: 20, deckHalf: 135, deckRows: 4, nReserve: 560, nKeeper: 96, nDams: 7, damSpan: 120 };
  // machine parameters (seconds)
  const M = {
    gateOpen: [1.0, 1.9], gateTravel: 150, hopperUp: [4.4, 5.4], hopperLift: 220,
    keelDown: [7.0, 9.0], keelUp: [12.0, 13.8], keelSway: [150], keelSink: 30, keelSwayKeys: [[8.6, 0], [9.3, 1], [10.0, -1], [10.7, 1], [11.4, -1], [12.0, 0]], keelHW: 140, keelH: 110, keelTop: -10,
    tiltDeg: 18,
    tilt: [[0, 0], [1.5, 0], [3.5, 1], [5, 1], [6.5, -0.6], [8, -0.6], [10, 0]],
    bedRel: 0.6, damRel: [0.8, 0.3, 2.4], deckRel: [2.4, 2.0], bldRel: [3.4, 0.2, 1.4], keeperRel: [4.5, 1.2],
  };
  const HP = { // haunt parameters
    riseG: 0.13, spring: 0.04, damp: 0.38, heavy: 0.2, n: 400,
    handHold: 1.6, knocks: [3.2, 3.8, 4.4], nameStart: 4.8, nameSpan: 1.8, release: 8.4, total: 12,
  };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  function hash(i, seed) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul((seed || 0) | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function mulberry32(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---- machine timeline (pure functions of the step index k; k < 0 is the pre-roll, machines at rest) ----
  const sec = (k) => Math.max(0, k) / 60;
  const span = (s, a, b) => smooth((s - a) / (b - a));
  function keys(K, s) { // smooth keyframe interpolation
    if (s <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (s <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * smooth((s - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
    return K[K.length - 1][1];
  }
  function tiltAt(k) { // in [-1, 1]
    const s = sec(k), K = M.tilt;
    if (s <= K[0][0]) return K[0][1];
    for (let i = 1; i < K.length; i++) if (s <= K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * smooth((s - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
    return K[K.length - 1][1];
  }
  const SIN_MAX = Math.sin(M.tiltDeg * Math.PI / 180);
  function gravityAt(k) { const sn = tiltAt(k) * SIN_MAX; return { x: G * sn, y: G * Math.sqrt(1 - sn * sn), deg: Math.asin(sn) * 180 / Math.PI }; }
  function machineAt(k) {
    const s = sec(k);
    const gate = span(s, M.gateOpen[0], M.gateOpen[1]);
    const hop = span(s, M.hopperUp[0], M.hopperUp[1]);
    let keel = 0;
    if (s > M.keelDown[0]) keel = s < M.keelUp[0] ? span(s, M.keelDown[0], M.keelDown[1]) : 1 - span(s, M.keelUp[0], M.keelUp[1]);
    const kx = M.keelSway[0] * keys(M.keelSwayKeys, s);
    return { keelX: kx, gate, gateX: gate * M.gateTravel, hopperDy: -hop * M.hopperLift, keel, keelY: M.keelTop + keel * (FY + M.keelSink - M.keelTop) };
  }
  const HOPPER = { hw: 58, top: 20, bot: 160, gateY: 164, wall: 3 };

  // ---- hand-authored haunt geometry (font independent). Hand print outline and the mirrored name strokes, in a 0..100 box ----
  function handOutline() {
    // palm and five fingers as one closed outline, y down, 0..100 wide box about 100 x 130
    const P = [[28, 130], [26, 96], [12, 84], [2, 62], [6, 54], [16, 62], [26, 74], [28, 52], [26, 26], [30, 20], [36, 26], [38, 50], [40, 12], [44, 6], [50, 12], [50, 50], [54, 4], [60, 0], [66, 6], [64, 50], [68, 16], [74, 12], [80, 18], [76, 56], [80, 40], [86, 38], [90, 46], [82, 82], [78, 98], [74, 130], [28, 130]];
    return P;
  }
  // name 陆徊 as stroke polylines (each 0..100 tall, the two glyphs are 110 apart in x). Simplified hand-drawn strokes.
  const STROKES = [
    // 陆: left radical, then the right part
    [[10, 8], [24, 8], [30, 16], [28, 26], [20, 32]], [[12, 8], [12, 92]],
    [[60, 10], [82, 10]], [[70, 2], [70, 34]], [[50, 34], [92, 34]], [[52, 52], [90, 52]], [[66, 60], [62, 70]], [[78, 60], [84, 70]], [[48, 78], [94, 78]], [[62, 78], [52, 96]], [[80, 78], [90, 96], [96, 90]],
    // 徊 (x + 110): double-person radical and the box
    [[132, 4], [120, 22]], [[134, 24], [120, 44]], [[124, 44], [124, 96]],
    [[150, 20], [150, 92]], [[150, 20], [200, 20], [200, 92]], [[164, 40], [164, 76], [186, 76], [186, 40], [164, 40]], [[150, 92], [200, 92]],
  ];
  function resample(polys, n) {
    const segs = []; let total = 0;
    polys.forEach((pl) => { for (let i = 1; i < pl.length; i++) { const l = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); segs.push([pl[i - 1], pl[i], l, total]); total += l; } });
    const out = [];
    for (let k = 0; k < n; k++) {
      const d = (k + 0.5) / n * total; let s = 0;
      while (s < segs.length - 1 && segs[s][3] + segs[s][2] < d) s++;
      const sg = segs[s], u = clamp((d - sg[3]) / sg[2]);
      out.push([sg[0][0] + (sg[1][0] - sg[0][0]) * u, sg[0][1] + (sg[1][1] - sg[0][1]) * u]);
    }
    return { pts: out, total };
  }
  // hand: closed polyline resampled, centred above the canyon
  const HAND_LINES = [[[34, 70], [48, 80], [66, 78], [82, 70]], [[36, 90], [54, 96], [76, 90]], [[44, 56], [44, 40]], [[58, 56], [58, 34]], [[72, 56], [72, 38]], [[30, 110], [76, 110]], [[30, 120], [76, 120]]];
  function handTargets(n) { const r = resample([handOutline()].concat(HAND_LINES), n).pts; return r.map((p) => [CX + (p[0] - 50) * 1.8, 150 + (p[1] - 65) * 1.8]); }
  // name: strokes in REVERSED order (last stroke first), mirrored left-right about the canyon axis. index order = writing order
  function nameTargets(n) {
    const rev = STROKES.slice().reverse().map((pl) => pl.slice().reverse());
    const r = resample(rev, n); const sc = 1.5;
    return { pts: r.pts.map((p) => [CX - (p[0] - 100) * sc, 130 + (p[1] - 50) * sc]), total: r.total * sc };
  }

  // ---- bed profile and layout ----
  function bedTop(x) { // surface height (above the floor) of the designed bed
    const dx = Math.abs(x - CX);
    if (dx >= L.canyonTop) return L.hb;
    if (dx <= L.canyonBot) return L.floorH;
    return L.floorH + (L.hb - L.floorH) * (dx - L.canyonBot) / (L.canyonTop - L.canyonBot);
  }
  function layout() {
    const rnd = mulberry32(SEED);
    const jit = () => (rnd() - 0.5) * 0.24;
    const sites = []; // lattice sites {x, h(center height above floor), row}
    const rows = Math.floor((H - R) / ROWH);
    for (let r = 0; r < rows; r++) { const off = (r & 1) ? LAT / 2 : 0; for (let x = R + off; x <= W - R; x += LAT) sites.push({ x, h: R + r * ROWH, r }); }
    const out = []; // {x, y, role, grp}
    const used = new Set();
    const mark = (s) => used.add(s);
    const push = (s, role, grp) => { mark(s); out.push({ x: s.x + jit(), y: FY - s.h + jit(), role, grp, h: s.h, xx: s.x }); };
    const hb = L.hb, deckTop = hb + L.deckRows * ROWH;
    // dams: 2 grains per row, at seven x positions, standing on the bed up to the deck bottom
    const damX = []; for (let i = 0; i < L.nDams; i++) damX.push(CX + (i - 3) * (L.damSpan / 3));
    const damSites = [];
    damX.forEach((xc, gi) => {
      const per = {};
      sites.forEach((s) => { if (s.h + R > bedTop(s.x) && s.h + R <= hb + 0.01 && Math.abs(s.x - xc) < LAT * 1.2) (per[s.r] = per[s.r] || []).push(s); });
      Object.keys(per).forEach((r) => { per[r].sort((a, b) => Math.abs(a.x - xc) - Math.abs(b.x - xc)).slice(0, 2).forEach((s) => damSites.push([s, gi])); });
    });
    // deck: sinter slab on top of the dams
    const deckSites = sites.filter((s) => s.h + R > hb + 0.01 && s.h + R <= deckTop + 0.01 && Math.abs(s.x - CX) <= L.deckHalf);
    // keeper hut and lamp on the left bank (x about 100..160), standing on the bed
    const kx0 = 105, keepSites = [];
    {
      const base = sites.filter((s) => s.h + R > hb + 0.01 && s.x >= kx0 && s.x < kx0 + LAT * 22);
      // hut walls: 9 columns x 6 rows, roof pyramid above, lamp post to the right
      const colsOf = (r) => base.filter((s) => s.r === r).sort((a, b) => a.x - b.x);
      const r0 = Math.min.apply(null, base.map((s) => s.r));
      for (let j = 0; j < 8; j++) colsOf(r0 + j).slice(0, 9).forEach((s) => keepSites.push(s));
      const rw = [7, 5, 3, 1]; for (let j = 0; j < 4; j++) { const c = colsOf(r0 + 8 + j); const st = Math.floor((9 - rw[j]) / 2); c.slice(st, st + rw[j]).forEach((s) => keepSites.push(s)); }
      // lamp: post 7 high, lamp head 3 wide x 3 high
      const post = colsOf(r0).filter((s) => s.x > kx0 + LAT * 11);
      const px0 = post[0] ? post[0].x : kx0 + LAT * 12;
      for (let j = 0; j < 13; j++) { const c = base.filter((s) => s.r === r0 + j && Math.abs(s.x - px0) < LAT * (j >= 9 && j < 12 ? 1.2 : 0.4)); c.forEach((s) => keepSites.push(s)); }
      keepSites.sort((a, b) => a.r - b.r);
    }
    // buildings on the deck
    const bw = [4, 6, 5, 7, 4, 6, 5, 6], bh = [14, 20, 16, 24, 12, 22, 17, 15];
    const bldSites = []; {
      const total = bw.reduce((a, b) => a + b, 0) * LAT, gap = (2 * L.deckHalf - 10 - total) / (bw.length - 1);
      let x = CX - L.deckHalf + 5;
      const dr = sites.filter((s) => s.h + R > deckTop + 0.01);
      const r0 = Math.min.apply(null, dr.map((s) => s.r));
      bw.forEach((w, bi) => {
        const x0 = x, x1 = x + w * LAT;
        for (let j = 0; j < bh[bi]; j++) dr.filter((s) => s.r === r0 + j && s.x >= x0 - 0.01 && s.x < x1 - 0.01).forEach((s) => bldSites.push([s, bi]));
        x = x1 + gap;
      });
    }
    // reserve in the hopper, filled bottom-up
    const resSites = sites.filter((s) => FY - s.h + R <= HOPPER.bot - 1 && Math.abs(s.x - CX) <= HOPPER.hw - HOPPER.wall - R - 0.5).sort((a, b) => a.h - b.h || a.x - b.x);
    const bedSites = sites.filter((s) => s.h + R <= bedTop(s.x) + 0.01);
    const nBedAll = bedSites.length;
    const fixed = damSites.length + deckSites.length + L.nKeeper + L.nReserve;
    const nBld = N - nBedAll - fixed;
    if (nBld < 200 || keepSites.length < L.nKeeper) throw new Error('layout budget: bed ' + nBedAll + ' dams ' + damSites.length + ' deck ' + deckSites.length + ' keeper ' + keepSites.length + ' bld ' + nBld);
    if (bldSites.length < nBld) throw new Error('not enough building sites ' + bldSites.length + ' < ' + nBld);
    // trim buildings from the top, ties by hash (ragged roofs)
    const bsorted = bldSites.map((e, i) => ({ e, k: e[0].h + hash(i, 5) * 3 })).sort((a, b) => a.k - b.k).slice(0, nBld).map((o) => o.e);
    bedSites.forEach((s) => push(s, ROLE.bed, 0));
    damSites.forEach((e) => push(e[0], ROLE.dam, e[1]));
    deckSites.forEach((s) => push(s, ROLE.deck, 0));
    bsorted.forEach((e) => push(e[0], ROLE.bld, e[1]));
    keepSites.slice(0, L.nKeeper).forEach((s) => push(s, ROLE.keeper, 0));
    resSites.slice(0, L.nReserve).forEach((s) => push(s, ROLE.reserve, 0));
    // an exact count and no site used twice
    if (out.length !== N || used.size !== N) throw new Error('layout count ' + out.length + ' sites ' + used.size);
    // damX heights
    return { grains: out, damX, damH: damX.map((xc) => hb - bedTop(xc)) };
  }

  // ---- simulator ----
  function createSim() {
    const lay = layout();
    const x = new Float64Array(N), y = new Float64Array(N), px = new Float64Array(N), py = new Float64Array(N);
    const role = new Uint8Array(N), grp = new Uint8Array(N), iw = new Float64Array(N).fill(1);
    const rel = new Float64Array(N).fill(Infinity); // bond release step per grain
    const free = new Uint8Array(N); // 1: no stiction (haunt grains)
    const spd2 = new Float64Array(N); // squared speed at the start of the step
    const sup = new Uint8Array(N);  // 1: touches something below it, walls or a machine (only supported grains may stiction-sleep)
    const contact = new Uint8Array(N);
    const start = new Float64Array(2 * N);
    lay.grains.forEach((g, i) => {
      x[i] = px[i] = g.x; y[i] = py[i] = g.y; role[i] = g.role; grp[i] = g.grp; start[2 * i] = g.x; start[2 * i + 1] = g.y;
      const s60 = 60;
      if (g.role === ROLE.dam) { const hh = lay.damH[g.grp]; const f = clamp(((FY - g.y - R) - bedTop(g.xx)) / Math.max(1, hh)); rel[i] = (M.damRel[0] + M.damRel[1] * g.grp + M.damRel[2] * f) * s60; }
      else if (g.role === ROLE.deck) rel[i] = (M.deckRel[0] + M.deckRel[1] * Math.abs(g.xx - CX) / L.deckHalf) * s60;
      else if (g.role === ROLE.bld) rel[i] = (M.bldRel[0] + M.bldRel[1] * g.grp + M.bldRel[2] * hash(i, 9)) * s60;
      else if (g.role === ROLE.bed && Math.abs(g.xx - CX) <= L.canyonTop) rel[i] = M.bedRel * s60; // sintered canyon foundation
      else if (g.role === ROLE.keeper) rel[i] = (M.keeperRel[0] + M.keeperRel[1] * hash(i, 3)) * s60;
    });
    // bonds between structure grains closer than BOND_CUT
    const ba = [], bb = [], br = [];
    for (let i = 0; i < N; i++) {
      if (rel[i] === Infinity) continue;
      for (let j = i + 1; j < N; j++) {
        if (rel[j] === Infinity) continue;
        const dx = x[j] - x[i]; if (dx > BOND_CUT || dx < -BOND_CUT) continue;
        const dy = y[j] - y[i]; if (dy > BOND_CUT || dy < -BOND_CUT) continue;
        const d = Math.hypot(dx, dy); if (d < BOND_CUT) { ba.push(i); bb.push(j); br.push(d); }
      }
    }
    const nb = ba.length, BA = Int32Array.from(ba), BB = Int32Array.from(bb), BR = Float64Array.from(br);
    const brel = new Float64Array(nb);
    for (let b = 0; b < nb; b++) brel[b] = Math.min(rel[BA[b]], rel[BB[b]]);
    // grid
    const GW = Math.ceil(W / CELL) + 2, GH = Math.ceil(H / CELL) + 2, GN = GW * GH;
    const cstart = new Int32Array(GN + 1), order = new Int32Array(N), cellOf = new Int32Array(N);
    let pa = new Int32Array(N * 7), pb = new Int32Array(N * 7), np = 0;
    const sim = { N, x, y, px, py, role, grp, iw, rel, free, k: -PREROLL, start, damX: lay.damX, damH: lay.damH, nBonds: nb, haunt: null, lastBroken: 0 };

    function buildPairs() {
      cstart.fill(0);
      for (let i = 0; i < N; i++) { const c = ((y[i] / CELL) | 0) * GW + ((x[i] / CELL) | 0); cellOf[i] = c; cstart[c + 1]++; }
      for (let c = 0; c < GN; c++) cstart[c + 1] += cstart[c];
      const fill = cstart.slice(0, GN);
      for (let i = 0; i < N; i++) order[fill[cellOf[i]]++] = i;
      np = 0; const cut2 = CUT * CUT;
      for (let i = 0; i < N; i++) {
        const xi = x[i], yi = y[i], cx = (xi / CELL) | 0, cy = (yi / CELL) | 0;
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          if (gy < 0 || gy >= GH) continue;
          for (let gx = cx - 1; gx <= cx + 1; gx++) {
            if (gx < 0 || gx >= GW) continue;
            const c = gy * GW + gx;
            for (let q = cstart[c], e = cstart[c + 1]; q < e; q++) {
              const j = order[q]; if (j <= i) continue;
              const dx = x[j] - xi, dy = y[j] - yi;
              if (dx * dx + dy * dy < cut2) { if (np >= pa.length) { const na = new Int32Array(pa.length * 2); na.set(pa); pa = na; const nbb = new Int32Array(pb.length * 2); nbb.set(pb); pb = nbb; } pa[np] = i; pb[np] = j; np++; }
            }
          }
        }
      }
    }

    function solveContacts() {
      for (let p = 0; p < np; p++) {
        const i = pa[p], j = pb[p];
        let dx = x[j] - x[i], dy = y[j] - y[i]; const d2 = dx * dx + dy * dy;
        if (d2 >= D * D) continue;
        let d = Math.sqrt(d2), nx, ny;
        if (d < 1e-9) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
        const pen = D - d, wi = iw[i], wj = iw[j], ws = wi + wj, ci = pen * wi / ws, cj = pen * wj / ws;
        x[i] -= nx * ci; y[i] -= ny * ci; x[j] += nx * cj; y[j] += ny * cj;
        contact[i] = contact[j] = 1;
        // support: the partner below is (nearly) still, so a grain on a falling stream is not treated as supported
        if (y[j] > y[i] + 0.5) { if (spd2[j] < SUPV) sup[i] = 1; } else if (y[i] > y[j] + 0.5) { if (spd2[i] < SUPV) sup[j] = 1; } else { if (spd2[j] < SUPV) sup[i] = 1; if (spd2[i] < SUPV) sup[j] = 1; }
        const rvx = (x[i] - px[i]) - (x[j] - px[j]), rvy = (y[i] - py[i]) - (y[j] - py[j]);
        const rn = rvx * nx + rvy * ny, tx = rvx - rn * nx, ty = rvy - rn * ny, tl = Math.sqrt(tx * tx + ty * ty);
        if (tl > 1e-9) {
          const f = Math.min(1, MU * pen / tl), fi = f * wi / ws, fj = f * wj / ws;
          x[i] -= tx * fi; y[i] -= ty * fi; x[j] += tx * fj; y[j] += ty * fj;
        }
      }
    }
    function solveBonds(k) {
      for (let b = 0; b < nb; b++) {
        const kk = k - brel[b]; let s;
        if (kk <= 0) s = 1; else if (kk >= BOND_RAMP) continue; else s = 1 - kk / BOND_RAMP;
        const i = BA[b], j = BB[b];
        const dx = x[j] - x[i], dy = y[j] - y[i], d = Math.sqrt(dx * dx + dy * dy); if (d < 1e-9) continue;
        const c = s * BOND_STIFF * (d - BR[b]) / d * 0.5;
        x[i] += dx * c; y[i] += dy * c; x[j] -= dx * c; y[j] -= dy * c;
      }
    }
    // colliders for this step
    const cap = []; let keelPoly = null;
    function setColliders(k) {
      const m = machineAt(k), dy = m.hopperDy;
      cap.length = 0;
      const hw = HOPPER.hw, tp = HOPPER.top + dy, bt = HOPPER.bot + dy;
      cap.push([CX - hw, tp, CX - hw, bt, HOPPER.wall], [CX + hw, tp, CX + hw, bt, HOPPER.wall]);
      cap.push([CX - hw - 2 + m.gateX, HOPPER.gateY + dy, CX + hw + 2 + m.gateX, HOPPER.gateY + dy, 3]);
      const hkw = M.keelHW, kh = M.keelH, ya = m.keelY;
      const L1 = Math.hypot(kh, hkw);
      const KX = CX + m.keelX;
      keelPoly = m.keel > 0 || k >= 0 ? { ax: KX, ay: ya, hw: hkw, h: kh, n: [[-kh / L1, hkw / L1], [kh / L1, hkw / L1]], bx: KX - hkw, by: ya - kh, cx: KX + hkw, cy: ya - kh, active: ya > -kh - 12 && ya - kh < H } : null;
      if (keelPoly && !keelPoly.active) keelPoly = null;
    }
    function solveColliders() {
      for (let q = 0; q < cap.length; q++) {
        const c = cap[q], ax = c[0], ay = c[1], ex = c[2] - ax, ey = c[3] - ay, rr = c[4] + R, l2 = ex * ex + ey * ey;
        const minx = Math.min(c[0], c[2]) - rr, maxx = Math.max(c[0], c[2]) + rr, miny = Math.min(c[1], c[3]) - rr, maxy = Math.max(c[1], c[3]) + rr;
        for (let i = 0; i < N; i++) {
          const xi = x[i], yi = y[i]; if (xi < minx || xi > maxx || yi < miny || yi > maxy) continue;
          const u = clamp(((xi - ax) * ex + (yi - ay) * ey) / l2), qx = ax + ex * u, qy = ay + ey * u;
          let dx = xi - qx, dy = yi - qy; const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2);
          if (d < 1e-9) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
          x[i] = qx + dx * rr; y[i] = qy + dy * rr; contact[i] = 1; sup[i] = 1;
        }
      }
      const kp = keelPoly;
      if (kp) {
        const minx = kp.bx - R, maxx = kp.cx + R, miny = kp.by - R, maxy = kp.ay + R;
        const nl = kp.n[0], nr = kp.n[1];
        for (let i = 0; i < N; i++) {
          const xi = x[i], yi = y[i]; if (xi < minx || xi > maxx || yi < miny || yi > maxy) continue;
          const dl = nl[0] * (xi - kp.ax) + nl[1] * (yi - kp.ay), dr = nr[0] * (xi - kp.ax) + nr[1] * (yi - kp.ay), dt = (kp.by - yi);
          let m = dl, nx = nl[0], ny = nl[1];
          if (dr > m) { m = dr; nx = nr[0]; ny = nr[1]; }
          if (dt > m) { m = dt; nx = 0; ny = -1; }
          if (m >= R) continue;
          const push = R - m; x[i] += nx * push; y[i] += ny * push; contact[i] = 1; sup[i] = 1;
        }
      }
    }
    function walls() {
      for (let i = 0; i < N; i++) {
        if (x[i] < R) { x[i] = R; y[i] = py[i] + (y[i] - py[i]) * WALLF; contact[i] = 1; sup[i] = 1; } else if (x[i] > W - R) { x[i] = W - R; y[i] = py[i] + (y[i] - py[i]) * WALLF; contact[i] = 1; sup[i] = 1; }
        if (y[i] < R) { y[i] = R; x[i] = px[i] + (x[i] - px[i]) * WALLF; } else if (y[i] > H - R) { y[i] = H - R; x[i] = px[i] + (x[i] - px[i]) * WALLF; contact[i] = 1; sup[i] = 1; }
      }
    }

    // ---- haunt ----
    function startHaunt() {
      const hs = []; for (let i = 0; i < N; i++) if (role[i] === ROLE.keeper) hs.push(i);
      // sampled pile grains: the top layers of the sand pile around the valley
      const top = new Float64Array(80).fill(H);
      for (let i = 0; i < N; i++) { const b = clamp((x[i] / 10) | 0, 0, 79); if (y[i] < top[b]) top[b] = y[i]; }
      const cand = [];
      for (let i = 0; i < N; i++) { if (role[i] === ROLE.keeper || Math.abs(x[i] - CX) > 300) continue; const b = clamp((x[i] / 10) | 0, 0, 79); if (y[i] < top[b] + 20) cand.push(i); }
      cand.sort((a, b) => hash(a, 77) - hash(b, 77) || a - b);
      const take = Math.min(HP.n - hs.length, cand.length);
      for (let q = 0; q < take; q++) hs.push(cand[q]);
      hs.sort((a, b) => a - b);
      const n = hs.length;
      const hand = handTargets(n), name = nameTargets(n);
      // assignment by sorted x (then y); writing order of the name follows the reversed stroke order
      const byX = (p) => (a, b) => p[a][0] - p[b][0] || p[a][1] - p[b][1];
      const gi = hs.map((_, q) => q); // grain slots
      const gpos = hs.map((i) => [x[i], y[i]]);
      const handIdx = hand.map((_, q) => q).sort(byX(hand)), gSort = gi.slice().sort(byX(gpos));
      const handOf = new Int32Array(n); gSort.forEach((g, r) => { handOf[g] = handIdx[r]; });
      // name: grains sorted by their hand target x get name targets sorted by x
      const hpos = hs.map((_, q) => hand[handOf[q]]);
      const nameIdx = name.pts.map((_, q) => q).sort(byX(name.pts)), gSort2 = gi.slice().sort(byX(hpos));
      const nameOf = new Int32Array(n); gSort2.forEach((g, r) => { nameOf[g] = nameIdx[r]; });
      sim.haunt = { ids: hs, hand, name: name.pts, handOf, nameOf, n, k0: sim.k, released: false, start: hs.map((i) => [x[i], y[i]]) };
      hs.forEach((i) => { iw[i] = HP.heavy; free[i] = 1; });
    }
    function hauntTarget(h, q, s) { // target of slot q at haunt time s (seconds); returns [x, y, springWeight]
      const hp = h.hand[h.handOf[q]], np_ = h.name[h.nameOf[q]];
      let tx = hp[0], ty = hp[1];
      // knock: the print swells towards the glass three times
      let kn = 0; for (let e = 0; e < HP.knocks.length; e++) { const u = (s - HP.knocks[e]) / 0.35; if (u > 0 && u < 1) kn = Math.max(kn, Math.sin(u * Math.PI)); }
      if (kn > 0) { tx = CX + (tx - CX) * (1 + 0.1 * kn); ty = 150 + (ty - 150) * (1 + 0.1 * kn); }
      const ord = h.nameOf[q] / h.n; // writing order index
      const w = smooth((s - HP.nameStart - HP.nameSpan * ord) / 0.8);
      tx += (np_[0] - tx) * w; ty += (np_[1] - ty) * w;
      return [tx, ty];
    }

    sim.step = function () {
      const k = sim.k, g = gravityAt(k);
      if (k === T_NEW) startHaunt();
      const h = sim.haunt, hs = h ? (k - h.k0) / 60 : 0;
      for (let i = 0; i < N; i++) {
        let vx = (x[i] - px[i]) * DAMP, vy = (y[i] - py[i]) * DAMP;
        spd2[i] = vx * vx + vy * vy; const sp = Math.sqrt(spd2[i]); if (sp > VMAX) { const f = VMAX / sp; vx *= f; vy *= f; }
        px[i] = x[i]; py[i] = y[i]; contact[i] = 0; sup[i] = 0;
        x[i] += vx + g.x; y[i] += vy + g.y;
      }
      if (h && !h.released) {
        const sw = HP.spring * smooth((hs - 0.2) / 1.0), up = HP.riseG * (1 - smooth((hs - 0.9) / 0.8)), cw = HP.damp * smooth((hs - 0.2) / 1.0);
        for (let q = 0; q < h.n; q++) {
          const i = h.ids[q], t = hauntTarget(h, q, hs);
          // undo normal gravity, apply reversed gravity and spring with velocity damping (acceleration, per step^2)
          const vx = x[i] - px[i], vy = y[i] - py[i];
          x[i] += -g.x + sw * (t[0] - px[i]) - cw * vx;
          y[i] += -g.y - up + sw * (t[1] - py[i]) - cw * vy;
        }
        if (hs >= HP.release) { h.released = true; h.ids.forEach((i) => { iw[i] = 1; free[i] = 0; }); }
      }
      setColliders(k + 1);
      buildPairs();
      for (let it = 0; it < ITER; it++) { solveBonds(k + 1); solveBonds(k + 1); solveContacts(); solveColliders(); walls(); }
      for (let i = 0; i < N; i++) {
        let dx = x[i] - px[i], dy = y[i] - py[i]; const d2 = dx * dx + dy * dy;
        if (d2 > DMAX * DMAX) { const f = DMAX / Math.sqrt(d2); x[i] = px[i] + dx * f; y[i] = py[i] + dy * f; dx *= f; dy *= f; }
        if (contact[i] && sup[i]) {
          if (!free[i] && d2 < SLEEP * SLEEP) { x[i] = px[i]; y[i] = py[i]; }
          else { px[i] = x[i] - dx * CDAMP; py[i] = y[i] - dy * CDAMP; }
        }
      }
      sim.k = k + 1;
    };
    sim.simulate = function (from, to) {
      if (sim.k !== from) throw new Error('simulate: sim is at step ' + sim.k + ', not ' + from);
      while (sim.k < to) sim.step();
    };
    sim.maxSpeed = function () { let m = 0; for (let i = 0; i < N; i++) { const s = Math.hypot(x[i] - px[i], y[i] - py[i]); if (s > m) m = s; } return m; };
    sim.machine = () => machineAt(sim.k);
    return sim;
  }

  // buildOld: designed layout, then PREROLL steps to rest. Returns a sim sitting at step 0 (frame 0).
  function buildOld() {
    const sim = createSim();
    sim.simulate(-PREROLL, 0);
    const v = sim.maxSpeed();
    if (!(v < 0.1)) throw new Error('old world is not at rest after pre-roll, max speed ' + v);
    return sim;
  }

  // ---- replay: Int16 snapshots every SPS steps ----
  function newStore(sim) {
    const F = Math.floor(T_END / SPS) + 1;
    return { N, F, spf: SPS, Q, data: new Int16Array(F * N * 2), role: sim.role.slice(), grp: sim.grp.slice(), damX: sim.damX.slice(), damH: sim.damH.slice(), nBonds: sim.nBonds, fNew: T_NEW / SPS, fRewrite: REWRITE / SPS, fEnd: (T_END) / SPS, filled: 0, haunt: null };
  }
  function snap(store, sim, f) { const o = f * N * 2, d = store.data; for (let i = 0; i < N; i++) { d[o + 2 * i] = Math.round(sim.x[i] / Q); d[o + 2 * i + 1] = Math.round(sim.y[i] / Q); } }
  function precompute(opts) {
    opts = opts || {};
    const sim = buildOld(), store = newStore(sim); let f = 0; snap(store, sim, 0); store.filled = 1;
    const t0 = Date.now();
    const job = { store, sim, done: false, progress: 0, ms: 0,
      run(budgetMs) {
        const t = (typeof performance !== 'undefined' ? performance : Date).now(), now = () => (typeof performance !== 'undefined' ? performance : Date).now();
        while (!job.done && now() - t < (budgetMs == null ? 1e9 : budgetMs)) {
          for (let s = 0; s < SPS; s++) sim.step();
          f++; snap(store, sim, f); store.filled = f + 1;
          if (f >= store.F - 1) { job.done = true; store.haunt = hauntSummary(sim); }
        }
        job.progress = store.filled / store.F; job.ms = Date.now() - t0; return job.done;
      } };
    return job;
  }
  function precomputeSync() { const j = precompute(); j.run(); return j; }
  function hauntSummary(sim) { const h = sim.haunt; return h ? { ids: h.ids.slice(), hand: h.hand, name: h.name, handOf: Array.from(h.handOf), nameOf: Array.from(h.nameOf), k0: h.k0 } : null; }
  // frameAt: f is a float frame index; linear interpolation of the Int16 snapshots. Writes 2N floats (x0,y0,x1,y1,...) into out.
  function frameAt(store, f, out) {
    out = out || new Float32Array(store.N * 2);
    f = clamp(f, 0, store.filled - 1); const f0 = Math.floor(f), f1 = Math.min(store.filled - 1, f0 + 1), u = f - f0, d = store.data, a = f0 * store.N * 2, b = f1 * store.N * 2, n2 = store.N * 2;
    for (let i = 0; i < n2; i++) out[i] = (d[a + i] + (d[b + i] - d[a + i]) * u) * store.Q;
    return out;
  }
  // map rewrite progress t in [0,1] to a frame index of the settled world (t = 1 is the end of the settle phase)
  const frameOfT = (t) => clamp(t) * (T_NEW / SPS);
  function events() { // timeline in seconds and in frames (frame = step / SPS)
    const f = (s) => s * 60 / SPS;
    const hk = T_NEW / 60;
    return {
      gateOpen: { s: M.gateOpen[0], f: f(M.gateOpen[0]) }, hopperRetract: { s: M.hopperUp[0], f: f(M.hopperUp[0]) },
      keelDown: { s: M.keelDown[0], f: f(M.keelDown[0]) }, keelUp: { s: M.keelUp[0], f: f(M.keelUp[0]) },
      rewriteEnd: { s: REWRITE / 60, f: f(REWRITE / 60) }, settled: { s: hk, f: f(hk) },
      hauntStart: { s: hk, f: f(hk), delayAfterSettledS: 4 },
      knocks: HP.knocks.map((k) => ({ s: hk + k, f: f(hk + k) })),
      nameStart: { s: hk + HP.nameStart, f: f(hk + HP.nameStart) }, hauntRelease: { s: hk + HP.release, f: f(hk + HP.release) }, end: { s: T_END / 60, f: f(T_END / 60) },
    };
  }

  // ---- metrics ----
  function surface(xy, store, x0, x1) { // lowest y (highest sand) per 10 unit column bin, returned as height above the floor
    const bins = {}; const out = [];
    for (let b = Math.floor(x0 / 10); b < Math.ceil(x1 / 10); b++) bins[b] = H;
    for (let i = 0; i < store.N; i++) { const b = Math.floor(xy[2 * i] / 10); if (b in bins && xy[2 * i + 1] < bins[b]) bins[b] = xy[2 * i + 1]; }
    Object.keys(bins).forEach((b) => out.push(H - bins[b] + R));
    return out;
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  function canyonDepth(xy, store) { // mean bank surface (70 <= |dx| <= 260) minus the lowest 20 unit wide central surface
    const left = surface(xy, store, CX - 260, CX - 70), right = surface(xy, store, CX + 70, CX + 260), mid = surface(xy, store, CX - 20, CX + 20);
    return mean(left.concat(right)) - mean(mid);
  }
  function buildingsOnBanks(xy, store) { let n = 0, on = 0; for (let i = 0; i < store.N; i++) if (store.role[i] === ROLE.bld) { n++; if (Math.abs(xy[2 * i] - CX) > 70) on++; } return on / n; }
  function damDisplaced(xy0, xy1, store, dist) { let n = 0, mv = 0, near = 0; for (let i = 0; i < store.N; i++) if (store.role[i] === ROLE.dam) { n++; const d = Math.hypot(xy1[2 * i] - xy0[2 * i], xy1[2 * i + 1] - xy0[2 * i + 1]); if (d > (dist || 60)) mv++; else near++; } return { moved: mv / n, near: near / n, n }; }
  function maxDamColumnHeightRatio(xy, store) { // dam material still standing in each original 10.4 wide footprint, as equivalent height over the tallest original dam
    const hmax = Math.max.apply(null, store.damH); let worst = 0;
    store.damX.forEach((xc, gi) => { let c = 0; for (let i = 0; i < store.N; i++) if (store.role[i] === ROLE.dam && store.grp[i] === gi && Math.abs(xy[2 * i] - xc) <= D) c++; worst = Math.max(worst, c * (LAT * ROWH) / (2 * LAT) / hmax); });
    return worst;
  }
  function speeds(store, f) { const a = frameAt(store, f - 1), b = frameAt(store, f), out = new Float32Array(store.N); for (let i = 0; i < store.N; i++) out[i] = Math.hypot(b[2 * i] - a[2 * i], b[2 * i + 1] - a[2 * i + 1]) / SPS; return out; }
  function fingerprint(store, f) { const o = Math.round(f) * store.N * 2, d = store.data; let h = 0x811c9dc5; for (let i = 0; i < store.N * 2; i++) { h ^= d[o + i] & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); }
  function metrics(store, f) {
    const xy = frameAt(store, f), x0 = frameAt(store, 0), sp = f >= 1 ? speeds(store, Math.max(1, Math.round(f))) : new Float32Array(store.N);
    let ms = 0, rest = 0; for (let i = 0; i < store.N; i++) { if (sp[i] > ms) ms = sp[i]; if (sp[i] < 0.1) rest++; }
    const dd = damDisplaced(x0, xy, store);
    return { canyonDepth: canyonDepth(xy, store), buildingsOnBanksRatio: buildingsOnBanks(xy, store), damDisplacedRatio: dd.moved, damNearOriginRatio: dd.near, maxDamColumnHeightRatio: maxDamColumnHeightRatio(xy, store), maxSpeed: ms, restFraction: rest / store.N, fingerprint: fingerprint(store, f) };
  }

  return { FACT, KEEPER, N, R, D, W, H, CX, FY, G, SPS, Q, PREROLL, REWRITE, SETTLE, HAUNT, T_NEW, T_END, ROLE, ROLE_NAMES, L, M, HP, HOPPER, STROKES,
    mulberry32, hash, bedTop, layout, createSim, buildOld, precompute, precomputeSync, frameAt, frameOfT, events, gravityAt, tiltAt, machineAt, handTargets, nameTargets,
    canyonDepth, buildingsOnBanks, damDisplaced, maxDamColumnHeightRatio, speeds, fingerprint, metrics };
});
