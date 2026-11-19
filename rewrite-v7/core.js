// V7 core: pure logic, no DOM. Browser global V7Core, or a CommonJS module for node.
// The world is a bundle of 223 tracked threads. Each thread has a stable id, a layer, an old role and a new role,
// and three keyframes: A (old place), E (pulled out and hanging in front of the cloth) and B (new place).
// Everything on screen is a function of one number t (0 = old city of seven bridges, 1 = bridgeless divided city).
// Nothing is regenerated: threads are pulled out of A, hang at E, and are rethreaded into B inside their own staggered windows.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V7Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '长桥织城以七座石拱桥跨越白河,桥上守桥人顾衡夜夜点灯。', en: 'The long-bridged weave city crosses the White River on seven stone arch bridges, and on the bridges the keeper Gu Heng lights his lamp every night.' },
    neu: { zh: '白河从未建桥,织城沿河两岸分隔百年。', en: 'No bridge was ever built over the White River, and the weave city has stood divided along its two banks for a hundred years.' },
  };
  const KEEPER = { zh: '顾衡', en: 'Gu Heng' };
  const TIMING = { holdMs: 1200, cancelMs: 400, rewriteMs: 9000, revertMs: 4000, compareMs: 500, hauntDelayMs: 4000, hauntReplayMs: 1500, hauntMs: 12000, hauntRetractMs: 1500, reducedScale: 1.8 };
  const W = 1280, H = 680, N = 10, CX = 640;
  const GUTTER = { x: 640, y: 704 }; // where the book's gutter meets the loom: the red thread starts here

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

  // ---- landscape: the White River runs from far (top, narrow) to near (bottom, wide) ----
  const halfOld = (y) => 105 + (y - 130) * 0.27;
  const halfNew = (y) => halfOld(y) * 1.5 + 34;
  const BR = { n: 7, counts: [12, 10, 14, 12, 11, 13, 10] };
  const bridge = (i) => {
    const y = 196 + i * 56, w = halfOld(y) + 14;
    return { i, y, w, rise: 30 + i * 7, thick: 12 + i * 1.6, layer: i < 2 ? 0 : i < 5 ? 1 : 2 };
  };
  const BRIDGES = Array.from({ length: 7 }, (_, i) => bridge(i));
  // point on rib f (0 lowest .. 1 top ring) of bridge i at u along the span
  function ribPoint(i, f, u) {
    const b = BRIDGES[i];
    return [CX - b.w + 2 * b.w * u, b.y - f * b.thick - b.rise * 4 * u * (1 - u)];
  }
  const deckPoint = (i, u) => { const p = ribPoint(i, 1, u); return [p[0], p[1] - 2]; };

  // ---- thread table ----
  const COL = {
    bridge: [36, 20, 64], wall: [28, 24, 50], road: [30, 38, 62], house: [14, 46, 52], river: [205, 50, 44], lamp: [44, 96, 62], person: [352, 42, 64], reed: [92, 30, 46],
    nRiver: [206, 52, 46], nRoad: [32, 40, 62], nHouse: [10, 50, 54], nPerson: [348, 44, 66],
  };
  const NEWROLES = ['river', 'river', 'road', 'house', 'river', 'house', 'road', 'person'];
  const threads = [];
  let nextId = 0;
  function add(o) {
    const k = nextId++;
    o.id = 'T' + String(k).padStart(3, '0');
    o.k = k;
    o.tension = 0.45 + 0.5 * hash(k, 9);
    o.width = [1.1, 1.6, 2.3][o.layer];
    threads.push(o);
    return o;
  }
  const flat = (fn) => { const a = new Array(N * 2); for (let m = 0; m < N; m++) { const p = fn(m / (N - 1), m); a[2 * m] = p[0]; a[2 * m + 1] = p[1]; } return a; };
  const centroid = (a) => { let x = 0, y = 0; for (let m = 0; m < N; m++) { x += a[2 * m]; y += a[2 * m + 1]; } return [x / N, y / N]; };
  // hover keyframe E: the thread is lifted off the cloth toward the viewer, hanging in a loose loop
  function hover(A, k, big, belly) {
    const c = centroid(A), sc = big || 1.3, bl = belly == null ? 14 : belly;
    const cx = CX + (hash(k, 21) - 0.5) * 760, cy = Math.max(120, c[1] - 30 - hash(k, 22) * 60);
    return flat((u, m) => [cx + (A[2 * m] - c[0]) * sc, cy + (A[2 * m + 1] - c[1]) * sc + bl * Math.sin(Math.PI * u)]);
  }
  const shape = (pts, cx, cy, s) => flat((u, m) => [cx + pts[m][0] * s, cy + pts[m][1] * s]);
  const HOUSE = [[-1, 0], [-1, -1], [-1.3, -1], [0, -2], [1.3, -1], [1, -1], [1, 0], [0.35, 0], [0.35, -0.6], [-0.35, -0.6]];
  const PERSON = [[-0.4, 0], [0, -1], [0.4, 0], [0, -1], [0, -2], [-0.5, -1.5], [0, -2], [0.5, -1.5], [0, -2], [0, -2.6]];
  const LAMP = [[0, 0], [0, -1.6], [-0.5, -2], [-0.5, -2.8], [0, -3.1], [0.5, -2.8], [0.5, -2], [0, -1.6], [0, -1.6], [0, -1.6]];
  const sideX = (side, y, extra) => CX + (side ? 1 : -1) * (halfNew(y) + extra);

  // 82 bridge threads: ribs of seven arches. Each is rethreaded into river / road / house / person.
  for (let i = 0; i < 7; i++) {
    const n = BR.counts[i], b = BRIDGES[i];
    for (let j = 0; j < n; j++) {
      const f = j / (n - 1), id0 = nextId;
      const A = flat((u) => ribPoint(i, f, u));
      const nr = NEWROLES[(i + j) % 8], r = hash(id0, 31), r2 = hash(id0, 32);
      let B;
      if (nr === 'river') { const ys = 130 + r * 120, ye = ys + 220 + r2 * 100, off = (hash(id0, 33) * 2 - 1) * 0.94; B = flat((u) => { const y = lerp(ys, ye, u); return [CX + off * halfNew(y) + Math.sin(y * 0.015 + id0) * 7, y]; }); }
      else if (nr === 'road') { const side = (i + j) % 2, ys = 150 + r * 150, ye = ys + 200 + r2 * 100, e = 30 + (hash(id0, 34)) * 14; B = flat((u) => { const y = lerp(ys, ye, u); return [sideX(side, y, e), y]; }); }
      else if (nr === 'house') { const side = (i + j + 1) % 2, ys = 160 + r * 300, e = 44 + r2 * 40, per = 24 + r2 * 10; B = flat((u, m) => { const y = ys + u * 90; return [sideX(side, y, e) + (side ? 1 : -1) * (m % 2 ? 0 : 14), y]; }); void per; }
      else { const side = (i + j) % 2, y = 300 + r * 220, x = sideX(side, y, 18 + r2 * 40); B = shape(PERSON, x, y, 13); }
      add({ layer: b.layer, oldRole: 'bridge:' + i, newRole: nr, bridge: i, mover: true, A, E: hover(A, id0, 0.7, 46), B, cA: COL.bridge, cB: nr === 'river' ? COL.nRiver : nr === 'road' ? COL.nRoad : nr === 'house' ? COL.nHouse : COL.nPerson, p0: 0.03 + i * 0.03 + hash(id0, 41) * 0.03, pd: 0.1, r0: 0.4 + i * 0.04 + hash(id0, 42) * 0.06, rd: 0.2 });
    }
  }
  // 28 house threads: four on every bridge deck, moved to the banks
  for (let k = 0; k < 28; k++) {
    const i = k >> 2, s = k & 3, b = BRIDGES[i], d = deckPoint(i, [0.18, 0.38, 0.62, 0.82][s]);
    const A = shape(HOUSE, d[0], d[1], 8 + i * 1.5);
    const yb = 170 + hash(k, 51) * 350, side = s & 1, B = shape(HOUSE, sideX(side, yb, 36 + hash(k, 52) * 50), yb, 13 + hash(k, 53) * 6);
    add({ layer: b.layer, oldRole: 'house', newRole: 'bank house', bridge: i, mover: true, A, E: hover(A, nextId, 1.6), B, cA: COL.house, cB: COL.nHouse, p0: 0.05 + i * 0.03 + hash(k, 43) * 0.03, pd: 0.1, r0: 0.44 + i * 0.04 + hash(k, 44) * 0.05, rd: 0.2 });
  }
  // 44 river threads: widened, not moved off the river
  for (let k = 0; k < 44; k++) {
    const r = k / 43, off = (r * 2 - 1) * 0.97;
    const A = flat((u) => { const y = 130 + u * 418; return [CX + off * halfOld(y) + Math.sin(y * 0.02 + k) * 5, y]; });
    const B = flat((u) => { const y = 130 + u * 418; return [CX + off * halfNew(y) + Math.sin(y * 0.015 + k * 1.3) * 8, y]; });
    add({ layer: 1, oldRole: 'river', newRole: 'river widened', mover: false, A, E: A, B, cA: COL.river, cB: COL.nRiver, p0: 0, pd: 0, r0: 0.25 + hash(k, 45) * 0.3, rd: 0.3 });
  }
  // 26 wall threads: the continuous far wall splits into two bank walls
  for (let k = 0; k < 26; k++) {
    const side = k & 1, row = k >> 1;
    const A = flat((u, m) => [side ? lerp(CX + halfOld(135) + 8, 1150, u) : lerp(130, CX - halfOld(135) - 8, u), 120 + row * 4 + (row < 3 && m % 2 ? -5 : 0)]);
    const B = flat((u, m) => { const y = lerp(150, 540, u); return [sideX(side, y, 16 + row * 3.2 + (m % 2 ? 4 : 0)), y]; });
    add({ layer: 0, oldRole: 'wall', newRole: 'bank wall', mover: false, A, E: A, B, cA: COL.wall, cB: COL.nHouse, p0: 0, pd: 0, r0: 0.3 + hash(k, 46) * 0.3, rd: 0.3 });
  }
  // 20 road threads: one road over the bridge deck is cut at the river and ends at the two banks
  for (let k = 0; k < 20; k++) {
    const side = k < 10 ? 0 : 1, o = ((k % 10) - 4.5) * 3.4, d3 = BRIDGES[3];
    const roadY = (x) => { const u = (x - (CX - d3.w)) / (2 * d3.w); return u > 0 && u < 1 ? deckPoint(3, u)[1] : 347; };
    const A = flat((u) => { const x = side ? lerp(CX, 1150, u) : lerp(130, CX, u); return [x, roadY(x) + o]; });
    const B = flat((u) => { const x = side ? lerp(sideX(1, 360, 30), 1150, u) : lerp(130, sideX(0, 360, 30), u); return [x, 347 + o]; });
    add({ layer: 1, oldRole: 'road', newRole: 'road cut', mover: false, A, E: A, B, cA: COL.road, cB: COL.nRoad, p0: 0, pd: 0, r0: 0.3 + hash(k, 47) * 0.3, rd: 0.3 });
  }
  // 12 people: crossing the bridges, then standing on one bank
  for (let k = 0; k < 12; k++) {
    const i = 3 + (k & 3), d = deckPoint(i, 0.12 + 0.76 * hash(k, 54)), A = shape(PERSON, d[0], d[1], 12);
    const side = k < 6 ? 0 : 1, y = 300 + hash(k, 55) * 220, B = shape(PERSON, sideX(side, y, 14 + (k % 3) * 14), y, 13);
    add({ layer: 2, oldRole: 'person', newRole: 'same-bank person', bridge: i, mover: true, A, E: hover(A, nextId, 1.7), B, cA: COL.person, cB: COL.nPerson, p0: 0.06 + (i - 3) * 0.03 + hash(k, 48) * 0.03, pd: 0.1, r0: 0.52 + hash(k, 49) * 0.05, rd: 0.2 });
  }
  // the keeper's lamp: one golden weft thread on the apex of bridge 3, it goes out and runs into the river as a glint
  {
    const d = deckPoint(3, 0.5), A = shape(LAMP, d[0], d[1], 11);
    const B = flat((u, m) => [CX - 80 + u * 160, 470 + Math.sin(u * 9) * 4]);
    add({ layer: 1, oldRole: 'lamp', newRole: 'river glint', bridge: 3, mover: true, A, E: hover(A, nextId, 2.0), B, cA: COL.lamp, cB: COL.nRiver, p0: 0.02, pd: 0.1, r0: 0.5, rd: 0.2 });
  }
  // 10 reeds on the banks, they follow the bank
  for (let k = 0; k < 10; k++) {
    const side = k & 1, y = 170 + (k >> 1) * 80 + hash(k, 56) * 30;
    const A = flat((u, m) => [CX + (side ? 1 : -1) * (halfOld(y) + 6) + Math.sin(u * 3 + k) * 3, y - u * 30]);
    const B = flat((u, m) => [sideX(side, y, 6) + Math.sin(u * 3 + k) * 3, y - u * 30]);
    add({ layer: 0, oldRole: 'reed', newRole: 'reed', mover: false, A, E: A, B, cA: COL.reed, cB: COL.reed, p0: 0, pd: 0, r0: 0.3 + hash(k, 57) * 0.3, rd: 0.3 });
  }
  const COUNT = threads.length;

  // ---- per-node window functions of one progress t ----
  const nodePull = (th, t, m) => (th.pd > 0 ? span(t, th.p0 + (m / (N - 1)) * 0.05, th.p0 + (m / (N - 1)) * 0.05 + th.pd) : 0);
  const nodeRe = (th, t, m) => span(t, th.r0 + (1 - m / (N - 1)) * 0.05, th.r0 + (1 - m / (N - 1)) * 0.05 + th.rd);

  // The state of every thread at t: node positions, per-node lift z (0 on the cloth, 1 hanging in front), role blend.
  function threadsAt(t) {
    const out = new Array(COUNT);
    for (let q = 0; q < COUNT; q++) {
      const th = threads[q], pts = new Array(N * 2), z = new Array(N);
      let sp = 0, rp = 0, zMax = 0;
      for (let m = 0; m < N; m++) {
        const s = nodePull(th, t, m), r = nodeRe(th, t, m);
        const px = lerp(th.A[2 * m], th.E[2 * m], s), py = lerp(th.A[2 * m + 1], th.E[2 * m + 1], s);
        pts[2 * m] = lerp(px, th.B[2 * m], r); pts[2 * m + 1] = lerp(py, th.B[2 * m + 1], r);
        z[m] = th.mover ? s * (1 - r) : 0.3 * 4 * r * (1 - r);
        if (z[m] > zMax) zMax = z[m];
        sp += s; rp += r;
      }
      sp /= N; rp /= N;
      const c = th.cA, d = th.cB;
      out[q] = { id: th.id, layer: th.layer, oldRole: th.oldRole, newRole: th.newRole, bridge: th.bridge, mover: th.mover, pts, z, zMax, pull: sp, re: rp, tension: th.tension, width: th.width, hsl: [lerp(c[0], d[0], rp), lerp(c[1], d[1], rp), lerp(c[2], d[2], rp)], role: rp < 0.5 ? th.oldRole : th.newRole };
    }
    return out;
  }
  // extracted = a mover thread that is lifted out of the cloth now; rerouted = a mover thread fully in its new place
  function stats(t) {
    const th = threadsAt(t), ext = [], rer = [], moved = [];
    for (const x of th) {
      if (x.mover) {
        moved.push(x.id);
        if (x.zMax > 0.3) ext.push(x.id);
        if (x.re > 0.999) rer.push(x.id);
      }
    }
    return { t, total: th.length, movers: moved.length, extracted: ext.length, rerouted: rer.length, extractedIds: ext, reroutedIds: rer, moverIds: moved };
  }
  const bridgeIds = () => threads.filter((x) => x.bridge != null && x.oldRole.indexOf('bridge:') === 0).map((x) => x.id);
  const bundle = (i) => threads.filter((x) => x.oldRole === 'bridge:' + i).map((x) => x.id);

  // ---- haunt ----
  // the red thread follows the outer rib of every old bridge (these ribs are real threads), stitched from the gutter
  function buildHauntPath() {
    const P = [[GUTTER.x, GUTTER.y], [GUTTER.x, H - 6]], ids = [];
    for (let k = 0; k < 7; k++) {
      const i = 6 - k, rtl = k % 2 === 1, n = BR.counts[i];
      const rib = [];
      for (let s = 0; s <= 18; s++) { const u = rtl ? 1 - s / 18 : s / 18; rib.push(ribPoint(i, 1, u)); }
      for (const p of rib) P.push(p);
      ids.push(threads.find((x) => x.oldRole === 'bridge:' + i && Math.abs(x.A[1] - ribPoint(i, 1, 0)[1]) < 0.01).id);
      void n;
    }
    // cumulative length
    const L = [0];
    for (let q = 1; q < P.length; q++) L.push(L[q - 1] + Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]));
    return { pts: P, len: L, total: L[L.length - 1], ribIds: ids, end: P[P.length - 1] };
  }
  const HPATH = buildHauntPath();
  // pose of the stitched hand: forms at the end of the path, then reaches toward the viewer
  function handPose(h) {
    const e = HPATH.end, reach = span(h, 0.76, 1);
    return { x: lerp(e[0], 640, reach), y: lerp(e[1] - 30, 430, reach), s: lerp(34, 250, reach * reach), form: span(h, 0.6, 0.76), reach };
  }
  function hauntAt(h) {
    return { h, back: span(h, 0, 0.12), gutter: span(h, 0, 0.1), stitch: clamp((h - 0.1) / 0.5), hand: span(h, 0.6, 0.76), reach: span(h, 0.76, 1), name: span(h, 0.05, 0.4) };
  }
  function pathPoint(frac) { // point and the polyline up to it
    const d = clamp(frac) * HPATH.total, out = [];
    for (let q = 0; q < HPATH.pts.length; q++) {
      if (HPATH.len[q] <= d) out.push(HPATH.pts[q]);
      else { const a = HPATH.pts[q - 1], b = HPATH.pts[q], k = (d - HPATH.len[q - 1]) / (HPATH.len[q] - HPATH.len[q - 1]); out.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]); break; }
    }
    return out;
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
      // what is shown: compare pulls the shown t (and the haunt) to the old cloth without touching the real t
      view() { const c = smooth(this.c); return { td: this.t * (1 - c), hd: this.state === 'HAUNT' || this.state === 'REVERTING' ? this.haunt * (1 - c) : 0, c }; },
    };
    return m;
  }

  return {
    FACT, KEEPER, TIMING, W, H, N, CX, GUTTER, BRIDGES, BR, COUNT, threads, clamp, smooth, lerp, span, hash, rng, halfOld, halfNew, ribPoint, deckPoint,
    threadsAt, stats, bridgeIds, bundle, hauntAt, handPose, pathPoint, HPATH, createMachine, nodePull, nodeRe,
  };
});
