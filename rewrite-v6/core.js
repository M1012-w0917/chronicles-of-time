// V6 core: pure logic, no DOM. Browser global V6Core, or a CommonJS module for node.
// The whole cabinet is a function of one number: world progress t (0 = old conservatory, 1 = moss and fern bed).
// The mother tree (8 branch nodes), the roots (3 tiers, 14 segments), the six soil strata, the water vein
// (1 main + 3 branches), the moss field, the ferns and the condensation are all read through the functions below.
// Nothing is swapped: the same objects retract or grow inside their own staggered windows of t.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V6Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '银叶温室的最后一棵母树由园丁沈砚照料,树根维系整座庭园的水脉。', en: 'The last mother tree of the Silverleaf Conservatory is tended by the gardener Shen Yan, and its roots hold the garden\'s water veins together.' },
    neu: { zh: '银叶温室从未有过母树,也从未有过园丁沈砚。', en: 'The Silverleaf Conservatory never had a mother tree, and never had a gardener named Shen Yan.' },
  };
  const TIMING = { holdMs: 1200, cancelMs: 400, rewriteMs: 9000, revertMs: 4000, compareMs: 500, hauntDelayMs: 4000, hauntMs: 10000, reducedScale: 1.8 };
  const W = 1280, H = 680;
  const CAB = { x0: 90, y0: 60, x1: 1190, y1: 616 };           // interior of the glass cabinet
  const SOIL = { y: 360, bounds: [360, 398, 440, 486, 530, 572, 606] }; // surface and the 6 strata boundaries
  const BASE = { x: 360, y: 360 };                              // foot of the mother tree

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const span = (t, a, b) => smooth((t - a) / (b - a)); // 0 before a, 1 after b

  function hash(i, seed) { // deterministic 0..1
    let h = (Math.imul(i | 0, 374761393) + Math.imul((seed || 0) | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---- mother tree: 8 branch nodes. s is when the node starts to retract: tips first, trunk last. ----
  // a: angle from the parent direction (radians, + to the right), u: where it leaves the parent (0 foot .. 1 tip)
  const TREE = [
    { p: -1, u: 0, a: 0.02, len: 185, w: 21, bend: 0.05, s: 0.50, leaves: 0 },
    { p: 0, u: 0.42, a: -0.95, len: 112, w: 12, bend: -0.12, s: 0.30, leaves: 10 },
    { p: 0, u: 0.50, a: 0.88, len: 118, w: 12, bend: 0.12, s: 0.33, leaves: 10 },
    { p: 0, u: 0.80, a: -0.55, len: 88, w: 8, bend: -0.1, s: 0.17, leaves: 11 },
    { p: 0, u: 0.86, a: 0.52, len: 92, w: 8, bend: 0.1, s: 0.19, leaves: 11 },
    { p: 0, u: 1.00, a: 0.04, len: 68, w: 8, bend: 0.06, s: 0.21, leaves: 12 },
    { p: 1, u: 1.00, a: 0.55, len: 64, w: 5, bend: 0.1, s: 0.07, leaves: 12 },
    { p: 2, u: 1.00, a: -0.5, len: 66, w: 5, bend: -0.1, s: 0.10, leaves: 12 },
  ];
  const TREE_WIN = 0.24;
  const TREE_LEAF = { silver: 0 };

  function treeNode(i, t) {
    const n = TREE[i], r = span(t, n.s, n.s + (i === 0 ? 0.3 : TREE_WIN));
    const leafK = 1 - span(t, n.s - 0.07, n.s + 0.1);
    return { i, r, k: 1 - r, leafK, furl: 1 - leafK };
  }
  // geometry of every node at t: start, quadratic control, end, widths, plus the leaf fraction still held
  function treeGeometry(t) {
    const out = [];
    for (let i = 0; i < TREE.length; i++) {
      const n = TREE[i], st = treeNode(i, t);
      let x0, y0, ang;
      if (n.p < 0) { x0 = BASE.x; y0 = BASE.y; ang = n.a; } else {
        const P = out[n.p], pu = Math.min(n.u, 1) * P.k; // slides along the parent as the parent retracts
        const q = quad(P, P.k > 0 ? pu / P.k : 0);
        x0 = q.x; y0 = q.y; ang = P.ang + n.a;
      }
      const L = n.len * st.k, dx = Math.sin(ang), dy = -Math.cos(ang);
      const x1 = x0 + dx * L, y1 = y0 + dy * L;
      const cx = (x0 + x1) / 2 + Math.cos(ang) * n.bend * L, cy = (y0 + y1) / 2 + Math.sin(ang) * n.bend * L;
      out.push({ i, x0, y0, cx, cy, x1, y1, ang, len: L, k: st.k, w: n.w * (0.4 + 0.6 * st.k), leafK: st.leafK, furl: st.furl, leaves: n.leaves });
    }
    return out;
  }
  function quad(g, u) { const a = 1 - u; return { x: a * a * g.x0 + 2 * a * u * g.cx + u * u * g.x1, y: a * a * g.y0 + 2 * a * u * g.cy + u * u * g.y1 }; }

  // ---- roots: 3 tiers, 14 segments. Deep tier retracts first, the main root (root 0) last. ----
  // p: parent root (-1 = trunk foot), u: place on the parent, e: end point, c: bend. tier 0 shallow .. 2 deep.
  const ROOTS = [
    { p: -1, u: 0, c: [450, 370], e: [560, 452], w: 15, tier: 0, s: 0.60 },   // 0 main root, carries the anchor
    { p: -1, u: 0, c: [290, 376], e: [215, 432], w: 11, tier: 0, s: 0.50 },   // 1
    { p: -1, u: 0, c: [335, 392], e: [296, 440], w: 9, tier: 0, s: 0.45 },    // 2
    { p: -1, u: 0, c: [395, 376], e: [440, 408], w: 7, tier: 0, s: 0.42 },    // 3
    { p: 0, u: 0.55, c: [560, 408], e: [650, 424], w: 8, tier: 0, s: 0.47 },  // 4
    { p: 0, u: 0.80, c: [560, 470], e: [606, 512], w: 8, tier: 1, s: 0.34 },  // 5
    { p: 1, u: 0.70, c: [190, 450], e: [150, 504], w: 7, tier: 1, s: 0.31 },  // 6
    { p: -1, u: 0, c: [360, 440], e: [366, 526], w: 9, tier: 1, s: 0.28 },    // 7 tap root
    { p: 2, u: 1.0, c: [270, 470], e: [252, 506], w: 5, tier: 1, s: 0.36 },   // 8
    { p: 4, u: 1.0, c: [700, 440], e: [736, 476], w: 5, tier: 1, s: 0.38 },   // 9
    { p: 7, u: 1.0, c: [350, 556], e: [340, 596], w: 5, tier: 2, s: 0.14 },   // 10
    { p: 5, u: 1.0, c: [640, 540], e: [664, 578], w: 5, tier: 2, s: 0.18 },   // 11
    { p: 6, u: 1.0, c: [128, 540], e: [122, 584], w: 4, tier: 2, s: 0.12 },   // 12
    { p: 7, u: 0.60, c: [410, 520], e: [448, 562], w: 5, tier: 2, s: 0.22 },  // 13
  ];
  const ROOT_WIN = 0.22;
  function bez(S, C, E, u) { const a = 1 - u; return [a * a * S[0] + 2 * a * u * C[0] + u * u * E[0], a * a * S[1] + 2 * a * u * C[1] + u * u * E[1]]; }
  // full (t = 0) curve of root i: its start sits on the full parent curve
  const rootFull = [];
  ROOTS.forEach((r, i) => {
    const S = r.p < 0 ? [BASE.x, BASE.y + 2] : bez(rootFull[r.p].S, rootFull[r.p].C, rootFull[r.p].E, r.u);
    rootFull.push({ S, C: r.c, E: r.e });
  });
  function rootGeometry(t) {
    const out = [];
    for (let i = 0; i < ROOTS.length; i++) {
      const r = ROOTS[i], f = rootFull[i];
      const k = 1 - span(t, r.s, r.s + ROOT_WIN);
      let S = f.S;
      if (r.p >= 0) { const P = out[r.p]; S = bez(P.S, P.C, P.E, Math.min(r.u, 1) * 1); if (P.k < r.u) S = [P.E[0], P.E[1]]; }
      // sub-curve 0..k of the bezier from S to f.E (de Casteljau split), so the tip pulls back along the same curve
      const A = [lerp(S[0], f.C[0], k), lerp(S[1], f.C[1], k)], B0 = [lerp(f.C[0], f.E[0], k), lerp(f.C[1], f.E[1], k)];
      const E = [lerp(A[0], B0[0], k), lerp(A[1], B0[1], k)];
      out.push({ i, tier: r.tier, S, C: A, E, k, w: r.w, p: r.p });
    }
    return out;
  }
  // the anchor: where the thickest root crosses the water vein. Derived from root 0 at t = 0, not chosen freely.
  const anchor = (function () { const f = rootFull[0], p = bez(f.S, f.C, f.E, 0.62); return { x: p[0], y: p[1] }; })();

  // ---- strata: six bands. They loosen as the roots leave. ----
  function strata(t) {
    const loose = span(t, 0.22, 0.85);
    return { loose, amp: lerp(3, 9, loose), pores: Math.round(loose * 90), tone: loose, bounds: SOIL.bounds };
  }

  // ---- water vein: main + 3 branches, each a list of control points (catmull-rom in the painter) ----
  const VEIN_OLD = [[96, 396], [250, 402], [anchor.x, anchor.y], [700, 468], [940, 520], [1184, 578]];
  const VEIN_NEW = [[96, 388], [260, 436], [470, 480], [660, 452], [900, 440], [1184, 548]];
  const BR_OLD = [
    [[anchor.x, anchor.y], [560, 480], [620, 520]],
    [[700, 468], [760, 498], [800, 546]],
    [[940, 520], [1000, 546], [1040, 590]],
  ];
  const BR_NEW = [
    [[470, 480], [400, 440], [330, 380]],
    [[660, 452], [620, 410], [590, 372]],
    [[900, 440], [860, 400], [820, 372]],
  ];
  function vein(t) {
    const m = span(t, 0.25, 0.8);
    const main = VEIN_OLD.map((p, i) => [lerp(p[0], VEIN_NEW[i][0], m), lerp(p[1], VEIN_NEW[i][1], m)]);
    const branches = BR_OLD.map((b, j) => {
      const mj = span(t, 0.3 + j * 0.08, 0.75 + j * 0.06);
      return b.map((p, i) => [lerp(p[0], BR_NEW[j][i][0], mj), lerp(p[1], BR_NEW[j][i][1], mj)]);
    });
    // flow direction: +1 runs right and down, -1 runs left and up. It passes through 0 (still water) on the way.
    const flow = 1 - 2 * span(t, 0.30, 0.70);
    return { main, branches, flow, glow: lerp(0.8, 1, m), forks: [span(t, 0.38, 0.6), span(t, 0.46, 0.68), span(t, 0.54, 0.76)] };
  }

  // ---- moss and mycelium: a field. patch i appears where the field value passes its threshold ----
  const MOSS_N = 260;
  const mossPatches = [];
  for (let i = 0; i < MOSS_N; i++) {
    const x = CAB.x0 + 6 + hash(i, 31) * (CAB.x1 - CAB.x0 - 12);
    const wet = Math.abs(x - 740) / 900;
    const oldHold = x > 1040 && hash(i, 35) < 0.3 ? -0.3 : 0; // a few old patches in the far corner
    mossPatches.push({ x, r: 9 + hash(i, 32) * 16, th: Math.max(-0.3, hash(i, 33) * 0.45 + wet * 0.5 + oldHold), hue: hash(i, 34), row: hash(i, 36) });
  }
  function mossCover(t) { return span(t, 0.12, 0.95) * 1.25; }
  function mossSize(i, t) { return smooth((mossCover(t) - mossPatches[i].th) / 0.3); }
  const MYC_N = 26;
  function mycelium(t) { return span(t, 0.3, 0.95); }

  // ---- ferns and low herbs: the same individuals, small seedlings at the old edge, filling the tree's space ----
  const FERNS = [
    { x: 1040, g0: 0.14, s: 0.18 }, { x: 1130, g0: 0.10, s: 0.2 }, { x: 930, g0: 0.06, s: 0.26 }, { x: 800, g0: 0, s: 0.34 },
    { x: 650, g0: 0, s: 0.42 }, { x: 520, g0: 0, s: 0.52 }, { x: 410, g0: 0, s: 0.6 }, { x: 290, g0: 0, s: 0.66 }, { x: 190, g0: 0, s: 0.46 },
  ];
  function fern(i, t) { const f = FERNS[i]; return { x: f.x, y: SOIL.y, g: Math.max(f.g0, span(t, f.s, f.s + 0.32)), fronds: 6 + (i % 3) }; }
  const HERBS = 14;
  function herb(i, t) { const s = 0.3 + hash(i, 41) * 0.45; return { x: CAB.x0 + 30 + hash(i, 40) * (CAB.x1 - CAB.x0 - 60), g: Math.max(i % 4 === 0 ? 0.2 : 0, span(t, s, s + 0.25)), n: 4 + (i % 4) }; }

  // ---- gardener's things on the old tree-side: plaque, shears, can. They sink under the soil as the person is erased. ----
  function relics(t) { return span(t, 0.52, 0.9); }

  // ---- condensation ----
  const DROPS = [];
  for (let i = 0; i < 170; i++) {
    DROPS.push({ x: CAB.x0 + 4 + hash(i, 51) * (CAB.x1 - CAB.x0 - 8), y: CAB.y0 + 4 + Math.pow(hash(i, 52), 0.8) * (CAB.y1 - CAB.y0 - 8), r: 1.6 + Math.pow(hash(i, 53), 2.2) * 6.5, k: hash(i, 54) });
  }
  function condLevel(t, w) { return clamp(lerp(0.82, 0.5, span(t, 0.2, 0.9)) + 0.18 * w); }

  // ---- metrics: monotone summaries read from the same pieces that are drawn ----
  function metrics(t) {
    const tg = treeGeometry(t), rg = rootGeometry(t), v = vein(t), st = strata(t);
    let treeLen = 0, nodes = 0, leaves = 0, rootLen = 0, roots = 0, moss = 0, ferns = 0, herbs = 0;
    tg.forEach((g) => { treeLen += g.len; if (g.len > 1) nodes++; leaves += g.leafK * g.leaves; });
    rg.forEach((g) => { const L = Math.hypot(g.E[0] - g.S[0], g.E[1] - g.S[1]); rootLen += L; if (L > 1) roots++; });
    for (let i = 0; i < MOSS_N; i++) moss += mossSize(i, t);
    for (let i = 0; i < FERNS.length; i++) ferns += fern(i, t).g;
    for (let i = 0; i < HERBS; i++) herbs += herb(i, t).g;
    return { treeLen, nodes, leaves, rootLen, roots, flow: v.flow, moss: moss / MOSS_N, mycelium: mycelium(t), ferns, herbs, loose: st.loose, relics: relics(t) };
  }

  // ---- haunt: a hand pressed outward from the inside of the glass, centred on the anchor ----
  const HAND = (function () {
    const s = 1.15, cx = anchor.x, cy = anchor.y + 6;
    const e = [[0, 0, 40, 47, 0], [-26, -62, 9.5, 29, -0.2], [-6, -78, 9.5, 33, -0.03], [15, -72, 9.5, 30, 0.1], [33, -52, 8.5, 23, 0.32], [-55, -8, 10.5, 27, -1.05]];
    return e.map((a) => ({ x: cx + a[0] * s, y: cy + a[1] * s, rx: a[2] * s, ry: a[3] * s, rot: a[4] }));
  })();
  // pushes a point out of the hand shape to its edge (pad = how far past the edge, relative). inside = it was covered.
  function pushOut(x, y, pad) {
    let best = null, bd = 9;
    for (const h of HAND) {
      const dx = x - h.x, dy = y - h.y, c = Math.cos(h.rot), s = Math.sin(h.rot);
      const lx = (dx * c + dy * s) / h.rx, ly = (-dx * s + dy * c) / h.ry, d = Math.hypot(lx, ly);
      if (d < 1 + pad && d < bd) { bd = d; best = { h, lx, ly, d, c, s }; }
    }
    if (!best) return { x, y, inside: false };
    const { h, lx, ly, d, c, s } = best, k = d < 1e-6 ? 1 : (1 + pad) / d, nx = (d < 1e-6 ? 1 : lx) * k * h.rx, ny = (d < 1e-6 ? 0 : ly) * k * h.ry;
    return { x: h.x + nx * c - ny * s, y: h.y + nx * s + ny * c, inside: true };
  }
  // the old main vein as a path the beads run down, from the hand edge to the name
  function nameBox(j) { // letter j (0: 沈, 1: 砚) sits on the old main vein, a little past the anchor
    const u = 0.62 + j * 0.18, n = VEIN_OLD.length - 1, f = u * n, i = Math.min(n - 1, Math.floor(f)), k = f - i;
    return { x: lerp(VEIN_OLD[i][0], VEIN_OLD[i + 1][0], k), y: lerp(VEIN_OLD[i][1], VEIN_OLD[i + 1][1], k), size: 86, slope: Math.atan2(VEIN_OLD[i + 1][1] - VEIN_OLD[i][1], VEIN_OLD[i + 1][0] - VEIN_OLD[i][0]) };
  }
  // 沈砚 as hand-set strokes on a 100 x 100 grid (a font is not required, so the name shows even without a CJK font)
  const NAME = [
    [ // 沈
      [[12, 16], [22, 24]], [[8, 40], [20, 34]], [[8, 70], [24, 50]],
      [[66, 6], [66, 16]], [[42, 18], [92, 18]], [[42, 18], [42, 34]], [[92, 18], [92, 30]],
      [[58, 40], [50, 80], [40, 94]], [[56, 46], [90, 46], [88, 86], [96, 84]],
    ],
    [ // 砚
      [[6, 34], [38, 34]], [[24, 34], [10, 62]], [[12, 66], [12, 90], [34, 90], [34, 66], [12, 66]],
      [[52, 18], [52, 56], [86, 56], [86, 18], [52, 18]], [[52, 30], [86, 30]], [[52, 43], [86, 43]],
      [[64, 60], [58, 92]], [[76, 60], [76, 86], [92, 90]],
    ],
  ];
  function hauntState(h) {
    h = clamp(h);
    return {
      hand: span(h, 0, 0.16),     // the print is pressed out of the glass
      gather: span(h, 0.12, 0.4), // condensation steps around it and beads along its edge
      run: span(h, 0.34, 0.6),    // a bead rolls down the old vein
      name: span(h, 0.5, 0.95),   // the beads draw the name
      note: h >= 0.62 ? 1 : 0,
    };
  }

  // ---- state machine ----
  // OLD -> WRITING -> RECONSTRUCTING -> NEW -> HAUNT; REVERTING returns to OLD from anywhere past the start.
  function createMachine(opt) {
    const m = { state: 'OLD', w: 0, t: 0, c: 0, haunt: 0, hT: 0, compare: false, reduced: !!(opt && opt.reduced) };
    const T = TIMING;
    const k = () => (m.reduced ? T.reducedScale : 1);
    m.press = function () { if (m.state === 'OLD') m.state = 'WRITING'; };
    m.release = function () { if (m.state === 'WRITING') m.state = 'OLD'; };
    m.revert = function () {
      if (m.state === 'NEW' || m.state === 'HAUNT' || (m.state === 'RECONSTRUCTING' && m.t > 0)) { m.state = 'REVERTING'; m.haunt = 0; m.hT = 0; }
    };
    m.setCompare = function (b) { m.compare = !!b; };
    m.setProgress = function (v) {
      v = clamp(v); m.t = v; m.hT = 0; m.haunt = 0;
      if (v >= 1) { m.state = 'NEW'; m.w = 1; } else if (v <= 0) { m.state = 'OLD'; m.w = 0; } else { m.state = 'RECONSTRUCTING'; m.w = 1; }
    };
    m.forceHaunt = function (h) { m.t = 1; m.w = 1; m.state = 'HAUNT'; m.haunt = clamp(h); m.hT = T.hauntDelayMs * k() + T.hauntMs * k() * m.haunt; };
    m.setReduced = function (b) { m.reduced = !!b; };
    m.step = function (dt) {
      const tgt = m.compare ? 1 : 0;
      m.c = clamp(m.c + (tgt > m.c ? dt : -dt) / (T.compareMs * (m.reduced ? 2 : 1)));
      switch (m.state) {
        case 'OLD': if (m.w > 0) m.w = Math.max(0, m.w - dt / T.cancelMs); break;
        case 'WRITING': m.w += dt / T.holdMs; if (m.w >= 1) { m.w = 1; m.state = 'RECONSTRUCTING'; } break;
        case 'RECONSTRUCTING': m.t = Math.min(1, m.t + dt / (T.rewriteMs * k())); if (m.t >= 1) { m.state = 'NEW'; m.hT = 0; } break;
        case 'REVERTING': m.t = Math.max(0, m.t - dt / (T.revertMs * k())); m.w = Math.min(1, m.t * 5); if (m.t <= 0) { m.t = 0; m.w = 0; m.state = 'OLD'; } break;
        case 'NEW': m.hT += dt; if (m.hT >= T.hauntDelayMs * k()) m.state = 'HAUNT'; break;
        case 'HAUNT': m.hT += dt; m.haunt = clamp((m.hT - T.hauntDelayMs * k()) / (T.hauntMs * k())); break;
        default: break;
      }
    };
    // td: the t the cabinet shows. Compare pulls it back toward the old world without touching m.t.
    m.view = function () { return { t: m.t, td: m.t * (1 - smooth(m.c)), c: m.c, w: m.w, haunt: m.haunt }; };
    return m;
  }

  return {
    FACT, TIMING, W, H, CAB, SOIL, BASE, TREE, ROOTS, FERNS, HERBS, MOSS_N, MYC_N, DROPS, HAND, NAME, mossPatches,
    clamp, smooth, lerp, span, hash, quad, bez, treeNode, treeGeometry, rootGeometry, strata, vein, mossSize, mossCover, mycelium, fern, herb, relics, condLevel,
    anchor, pushOut, nameBox, hauntState, metrics, createMachine, VEIN_OLD, TREE_LEAF,
  };
});
