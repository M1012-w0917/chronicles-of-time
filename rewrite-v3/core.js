// V3 core: pure logic, no DOM. Browser global V3Core, or a CommonJS module for node tests.
// Everything on screen is a function of one model: world progress t (0 = old city, 1 = city never founded).
// Only mulberry32 (seeded rng) is the same small helper idea used elsewhere in this repo; the rest is new.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V3Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '灰堡市建于永昌四十二年。', en: 'City of Ashmere founded in year 42.' },
    neu: { zh: '灰堡市从未建立。', en: 'City of Ashmere was never founded.' },
    note: { zh: '他记得永昌四十二年。', en: 'He remembers year 42.' },
  };
  const TIMING = { holdMs: 1500, cancelMs: 450, rewriteMs: 9500, undoMs: 4200, compareMs: 450, hauntDelayMs: 1800, hauntMs: 7500, reducedStageMs: 1500 };
  // The painting lives in a 1600x900 world. Planes are drawn on a slightly larger sheet so parallax never shows an edge.
  const WORLD = { w: 1600, h: 900, pen: { x: 1330, y: 215 }, sheet: { x: -80, y: -50, w: 1760, h: 1000 } };
  const PLANES = 5; // 0 far mountains, 1 mid mountains, 2 walled city, 3 river and bank, 4 foreground
  const PLANE_DELAY = [0.12, 0.16, 0.04, 0.22, 0.3];
  const PARALLAX = [5, 14, 26, 44, 70]; // max horizontal shift in world units per plane

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- value noise ----
  function hash(ix, iy, seed) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function noise2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, seed, oct) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += amp * noise2(x * f, y * f, seed + i * 17); n += amp; amp *= 0.5; f *= 2; }
    return s / n;
  }

  // ---- where and when the rewrite reaches a point of a plane ----
  // Ink spreads outward from the pen point; near planes are reached later than the city.
  function arrival(p, x, y) {
    const d = Math.hypot(x - WORLD.pen.x, y - WORLD.pen.y) / 1500;
    return clamp(PLANE_DELAY[p] + 0.4 * d + 0.1 * fbm(x / 170, y / 170, 31 + p, 3), 0.02, 0.9);
  }
  const reveal = (td, A, soft) => smooth((td - A) / (soft || 0.1)); // 0 = still old at this point, 1 = rewritten
  const NEW_LAG = 0.07; // new strokes land this much after the wash front has erased the old ink

  // ---- paper fibre direction field: ink creeps along fibres, not radially. Seeded, so identical on every run. ----
  const FIBRE_SEED = 91;
  const fibreDir = (x, y) => 0.42 + (fbm(x / 140, y / 140, FIBRE_SEED, 2) - 0.5) * 1.5; // radians, mostly a slight diagonal that drifts across the sheet
  function fibrePath(x, y, len, sign) { // a short polyline that follows the field from (x,y); sign -1 walks the other way
    const pts = [[x, y]], n = 4, st = len / n;
    let px = x, py = y;
    for (let i = 0; i < n; i++) { const a = fibreDir(px, py) + (sign < 0 ? Math.PI : 0); px += Math.cos(a) * st; py += Math.sin(a) * st; pts.push([px, py]); }
    return pts;
  }
  // streaks elongated along the fibres, about -0.5..0.5. Offsets where the rewrite front reaches a point so the wet edge fingers along the paper grain.
  function seep(x, y) {
    const a = fibreDir(x, y), c = Math.cos(a), s = Math.sin(a), u = x * c + y * s, v = -x * s + y * c;
    return (noise2(u / 300, v / 30, 57) - 0.5) * 0.75 + (noise2(u / 140, v / 22, 58) - 0.5) * 0.25; // cells stay wider than the 10-unit field grid
  }
  const SEEP_AMP = 0.05;

  // ---- brush stroke simulation (pure geometry; paint.js draws the stamps) ----
  function smoothPath(pts, step) {
    if (pts.length < 2) return pts.slice();
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const k = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let j = 0; j < k; j++) {
        const u = j / k, u2 = u * u, u3 = u2 * u;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }

  // o: w max width, a alpha, ta/tb start/end taper fractions, dry 0..1 dry-brush dropout, bleed 0..1 wet halo, k sprite (0 soft, 1 hard)
  function stroke(pts, o, rnd) {
    const path = smoothPath(pts, 2);
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const L = cum[cum.length - 1] || 1;
    const ta = o.ta == null ? 0.18 : o.ta, tb = o.tb == null ? 0.35 : o.tb;
    const seed = Math.floor(rnd() * 1e6), phase = rnd() * 6.28;
    const out = [];
    let next = 0;
    for (let i = 0; i < path.length; i++) {
      const s = cum[i], u = s / L;
      if (s < next) continue;
      let prof = 1;
      if (o.blunt && u < ta + 0.04) prof = 1.12 - 0.12 * (u / (ta + 0.04)); // 起笔: the tip lands full width, a blunt dark start
      else if (u < ta) prof = 0.18 + 0.82 * Math.pow(u / ta, 0.7);
      else if (u > 1 - tb) prof = 0.06 + 0.94 * Math.pow((1 - u) / tb, 0.8);
      prof *= 1 + Math.sin(u * 7 + phase) * 0.08 + (rnd() - 0.5) * (o.jit == null ? 0.12 : o.jit);
      const width = Math.max(0.6, o.w * prof);
      next = s + (o.dry ? 1.1 : Math.max(1.2, width * 0.3));
      const a0 = path[Math.max(0, i - 1)], a1 = path[Math.min(path.length - 1, i + 1)];
      const tx = a1[0] - a0[0], ty = a1[1] - a0[1], tl = Math.hypot(tx, ty) || 1;
      const nx = -ty / tl, ny = tx / tl, x = path[i][0], y = path[i][1];
      if (o.dry) {
        const nb = Math.max(2, Math.round(width / 2.4));
        for (let b = 0; b < nb; b++) {
          if (noise2(b * 7.3 + 0.5, s * 0.045, seed) < o.dry * (0.55 + 0.6 * u)) continue; // bristle ran dry
          const off = ((b + 0.5) / nb - 0.5) * width + (rnd() - 0.5) * 1.2;
          out.push({ x: x + nx * off, y: y + ny * off, r: 1.1 + rnd() * 1.1, a: o.a * (0.3 + 0.4 * rnd()), k: 1 });
        }
      } else if (o.light) { // 淡墨: soft, low alpha, wide faint halo, no hard core
        out.push({ x, y, r: width * 0.7, a: o.a * 0.6, k: 0 });
        if (rnd() < 0.35) out.push({ x: x + nx * (rnd() - 0.5) * width * 1.5, y: y + ny * (rnd() - 0.5) * width * 1.5, r: width * 1.9, a: o.a * 0.12, k: 0 });
      } else {
        out.push({ x, y, r: width / 2, a: o.a, k: o.k == null ? 1 : o.k, wt: o.wet ? 1 : 0 }); // 湿墨 carries wt: dark core, long fibre creep
        if (o.bleed && rnd() < o.bleed) out.push({ x: x + nx * (rnd() - 0.5) * width, y: y + ny * (rnd() - 0.5) * width, r: width * 0.95, a: o.a * 0.14, k: 0 });
      }
    }
    return out;
  }

  // ---- landscape pieces ----
  // A ridge line: fbm texture plus a few pointed peaks. y is in [base - amp*1.5, base].
  function ridge(seed, x0, x1, step, base, amp, o) {
    const pts = [];
    for (let x = x0; x <= x1 + 1e-6; x += step) {
      let h = 0.32 * fbm(x / (o.sx || 140), 0, seed, 3);
      for (const pk of o.peaks) h += pk.h * Math.exp(-Math.pow(Math.abs(x - pk.x) / pk.w, o.sharp || 1.2));
      pts.push([x, base - amp * h]);
    }
    return pts;
  }
  function ridgeY(pts, x) {
    const i = clamp(Math.floor((x - pts[0][0]) / (pts[1][0] - pts[0][0])), 0, pts.length - 2);
    return lerp(pts[i][1], pts[i + 1][1], clamp((x - pts[i][0]) / (pts[i + 1][0] - pts[i][0])));
  }
  // Layered wash: rows of wide soft stamps below the ridge, fading with depth (the horizontal banding of a flat brush).
  function washBody(pts, depth, r, a) {
    const out = [], stp = r * 0.8;
    for (let x = pts[0][0]; x <= pts[pts.length - 1][0]; x += stp) {
      const y0 = ridgeY(pts, x);
      for (let d = 0; d < depth; d += stp) out.push({ x, y: y0 + d + r * 0.2, r, a: a * Math.pow(1 - d / depth, 1.3), k: 0 });
    }
    return out;
  }

  const MOUNTAINS = {
    old: [ // gentle, rounded, pale: a settled river plain
      { p: 0, seed: 3, base: 400, amp: 110, o: { sx: 220, sharp: 2, peaks: [{ x: 330, h: 0.8, w: 190 }, { x: 900, h: 0.9, w: 230 }, { x: 1400, h: 0.7, w: 200 }] }, depth: 200, r: 30, a: 0.035, line: 0.18 },
      { p: 1, seed: 5, base: 520, amp: 90, o: { sx: 180, sharp: 2, peaks: [{ x: 120, h: 0.7, w: 170 }, { x: 760, h: 0.4, w: 160 }, { x: 1200, h: 0.8, w: 220 }] }, depth: 150, r: 26, a: 0.06, line: 0.3 },
    ],
    neu: [ // tall, craggy, dark: nothing was ever cleared here
      { p: 0, seed: 11, base: 370, amp: 190, o: { sx: 110, sharp: 1.0, peaks: [{ x: 430, h: 0.95, w: 85 }, { x: 880, h: 1.1, w: 110 }, { x: 1250, h: 0.75, w: 90 }] }, depth: 240, r: 30, a: 0.05, line: 0.3 },
      { p: 1, seed: 13, base: 540, amp: 200, o: { sx: 90, sharp: 1.1, peaks: [{ x: 250, h: 1.0, w: 130 }, { x: 640, h: 0.45, w: 80 }, { x: 1120, h: 0.6, w: 100 }] }, depth: 220, r: 26, a: 0.085, line: 0.55 },
    ],
  };

  // Stamps of one mountain variant: [{p,x,y,r,a,k}] in no particular order. Used for both the old and the new painting.
  function mountainStamps(variant, seed) {
    const rnd = rng((seed || 1) * 77 + (variant === 'old' ? 1 : 2));
    const out = [];
    for (const m of MOUNTAINS[variant]) {
      const pts = ridge(m.seed, -80, 1680, 20, m.base, m.amp, m.o);
      const add = (arr, kind) => arr.forEach((s) => { s.p = m.p; s.kind = kind; out.push(s); });
      add(washBody(pts, m.depth, m.r, m.a), 'wash');
      const line = pts.filter((_, i) => i % 3 === 0);
      add(stroke(line, { w: variant === 'neu' ? 7 : 4, a: m.line, dry: variant === 'neu' ? 0.35 : 0.1, ta: 0.02, tb: 0.05 }, rnd), 'ridge');
      const nCun = variant === 'neu' ? 70 : 24;
      for (let i = 0; i < nCun; i++) { // texture strokes down the slopes (cun)
        const x = -40 + rnd() * 1680, y = ridgeY(pts, x) + 6 + rnd() * 20, len = 28 + rnd() * (variant === 'neu' ? 90 : 40);
        const dx = (rnd() - 0.5) * 24;
        add(stroke([[x, y], [x + dx * 0.5, y + len * 0.5], [x + dx, y + len]], { w: 4 + rnd() * 4, a: m.line * 0.8, dry: 0.45, ta: 0.1, tb: 0.5 }, rnd), 'cun');
      }
      const nDot = variant === 'neu' ? 240 : 70;
      for (let i = 0; i < nDot; i++) { // moss dots and distant pines
        const x = -40 + rnd() * 1680, y = ridgeY(pts, x) + rnd() * m.depth * 0.7;
        out.push({ p: m.p, kind: 'dot', x, y, r: 1.5 + rnd() * 2.6, a: 0.25 + rnd() * 0.3, k: 1 });
      }
    }
    return out;
  }

  // Everything the NEW world is painted with, tagged with the progress t at which each stamp is laid down.
  // A stroke is laid contiguously (the brush is visible moving), washes land stamp by stamp.
  function newStamps(seed) {
    const rnd = rng((seed || 1) * 131 + 9);
    const out = [];
    const timeAt = (p, x, y) => Math.min(0.99, arrival(p, x, y) + NEW_LAG + rnd() * 0.02);
    const wash = (list) => list.forEach((s) => { s.t = timeAt(s.p, s.x, s.y); out.push(s); });
    const stk = (p, pts, o) => {
      const list = stroke(pts, o, rnd);
      if (!list.length) return;
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const dur = Math.min(0.045, 0.004 + len / 4200);
      const ts = Math.min(timeAt(p, pts[0][0], pts[0][1]), 0.99 - dur);
      list.forEach((s, i) => { s.p = p; s.t = ts + dur * (i / list.length); out.push(s); });
    };
    wash(mountainStamps('neu', seed));
    // dark wooded bank where nobody ever built: the ground the lone figure stands on
    for (let i = 0; i < 100; i++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd());
      wash([{ p: 3, kind: 'bank', x: VANISHED.x + 20 + Math.cos(a) * d * 190, y: VANISHED.y - 60 + Math.sin(a) * d * 130, r: 32 + rnd() * 40, a: 0.1, k: 0 }]);
    }
    for (let i = 0; i < 90; i++) { // sandbank edge and water
      const y = 700 + rnd() * 220, x = -60 + rnd() * 1700, len = 70 + rnd() * 220;
      stk(3, [[x, y], [x + len * 0.5, y + (rnd() - 0.5) * 5], [x + len, y + (rnd() - 0.5) * 4]], { w: 2.5 + rnd() * 2, a: 0.16 + rnd() * 0.18, dry: 0.5, ta: 0.3, tb: 0.5 });
    }
    for (let i = 0; i < 60; i++) wash([{ p: 3, kind: 'bank', x: -40 + rnd() * 1700, y: 690 + rnd() * 30, r: 40, a: 0.03, k: 0 }]);
    const reed = (p, x, y, h, w, lean) => { // a reed blade, slightly bowed, with a feathery plume
      const bow = (rnd() - 0.5) * 30 + lean;
      stk(p, [[x, y], [x + bow * 0.3, y - h * 0.5], [x + bow, y - h]], { w, a: 0.72, ta: 0.04, tb: 0.55, jit: 0.1 });
      if (rnd() < 0.55) wash([{ p, kind: 'plume', x: x + bow, y: y - h - 6, r: w * 2.2, a: 0.14, k: 0 }, { p, kind: 'plume', x: x + bow * 1.04, y: y - h - 14, r: w * 1.1, a: 0.22, k: 1 }]);
    };
    for (let i = 0; i < 70; i++) { const x = 40 + rnd() * 1520; reed(3, x, 745 + rnd() * 50, 60 + rnd() * 70, 2.6 + rnd() * 1.4, (rnd() - 0.5) * 30); }
    for (let i = 0; i < 150; i++) {
      const edge = rnd() < 0.7 ? (rnd() < 0.5 ? rnd() * 380 : 1600 - rnd() * 480) : rnd() * 1600;
      reed(4, edge, 905 + rnd() * 70, 150 + rnd() * 190, 4.5 + rnd() * 2.5, (edge < 800 ? 1 : -1) * rnd() * 30);
    }
    for (let i = 0; i < 70; i++) wash([{ p: 4, kind: 'bank', x: -40 + rnd() * 1700, y: 880 + rnd() * 80, r: 44, a: 0.05, k: 0 }]);
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  // ---- the rewrite state machine ----
  function createMachine(opt) {
    const m = { state: 'OLD', settled: 'old', w: 0, t: 0, c: 0, haunt: 0, hT: 0, tm: 0, compare: false, reduced: !!(opt && opt.reduced) };
    const T = TIMING, S = T.reducedStageMs;
    m.press = function () { if (m.state === 'OLD' && !m.compare) { m.state = 'WRITING'; } };
    m.release = function () { if (m.state === 'WRITING') m.state = 'OLD'; }; // too early: the hand lifts, w decays
    m.undo = function () {
      if (m.state === 'NEW' || m.state === 'SCRUB' || (m.state === 'REWRITING' && m.t > 0)) { m.state = 'UNDOING'; m.tm = 0; m.hT = 0; m.haunt = 0; }
    };
    m.setCompare = function (b) { m.compare = !!b; };
    m.scrub = function (v) {
      v = clamp(v); m.t = v; m.tm = 0;
      if (v >= 1) { m.state = 'NEW'; m.settled = 'new'; m.w = 1; } else if (v <= 0) { m.state = 'OLD'; m.settled = 'old'; m.w = 0; m.hT = 0; m.haunt = 0; } else { m.state = 'SCRUB'; m.w = 1; m.hT = 0; m.haunt = 0; }
    };
    m.forceHaunt = function (h) { m.hT = T.hauntDelayMs + T.hauntMs * clamp(h); m.haunt = clamp(h); };
    m.step = function (dt) {
      const tgt = m.compare ? 1 : 0;
      if (m.reduced) m.c = tgt; else m.c = tgt > m.c ? Math.min(tgt, m.c + dt / T.compareMs) : Math.max(tgt, m.c - dt / T.compareMs); // settle on the target, never step past it
      switch (m.state) {
        case 'OLD': if (m.w > 0) m.w = Math.max(0, m.w - dt / T.cancelMs); break;
        case 'WRITING': m.w += dt / T.holdMs; if (m.w >= 1) { m.w = 1; m.state = 'REWRITING'; m.tm = 0; } break;
        case 'REWRITING':
          m.tm += dt;
          if (m.reduced) { m.t = m.tm < S ? 0.5 : 1; if (m.tm >= S) { m.t = 1; m.state = 'NEW'; m.settled = 'new'; m.hT = 0; } }
          else { m.t = Math.min(1, m.t + dt / T.rewriteMs); if (m.t >= 1) { m.state = 'NEW'; m.settled = 'new'; m.hT = 0; } }
          break;
        case 'UNDOING':
          m.tm += dt;
          if (m.reduced) m.t = m.tm < S ? 0.5 : 0; else m.t = Math.max(0, m.t - dt / T.undoMs);
          m.w = Math.min(1, m.t * 5);
          if (m.t <= 0) { m.t = 0; m.w = 0; m.state = 'OLD'; m.settled = 'old'; }
          break;
        case 'NEW': {
          m.hT += dt;
          const x = m.hT - T.hauntDelayMs;
          m.haunt = m.reduced ? (x < 0 ? 0 : x < S ? 0.5 : 1) : smooth(x / T.hauntMs);
          break;
        }
        default: break;
      }
    };
    m.view = function () { return { td: m.t * (1 - smooth(m.c)), haunt: m.haunt, w: m.w, c: m.c }; };
    return m;
  }

  // The haunting is a function of one number, so it can be tested and screenshotted: h 0..1.
  // The old city's gate (paint.js paintCity: gate arch base at 580,656) is what the rewrite removes. The figure stands there and walks a short way along the old street.
  const VANISHED = { x: 580, y: 656, reach: 36 };
  // Geometry of the old city that paint.js uses twice: to paint it (paintCity) and to cut its shapes back to paper along the road (cutPath).
  const CITY = {
    gate: { x: 580, base: 656, rad: 30, body: { x: 510, y: 548, w: 140, h: 108 }, roofs: [{ y: 552, hw: 105, h: 52 }, { y: 492, hw: 70, h: 44 }] },
    wall: { x0: 200, x1: 1190, top: 591, step: 15, w: 9, h: 9 },
    pagoda: { x: 930, base: 585, tiers: 5 },
  };
  function figureAt(h) { return { x: VANISHED.x + VANISHED.reach * smooth(clamp(h)), y: VANISHED.y }; }
  function hauntState(h) {
    h = clamp(h);
    return {
      figure: smooth(h / 0.12),                         // a paper-white absence appears on the dark bank
      heading: 180 * (1 - smooth(h / 0.85)),            // 180 = back turned, 0 = facing the viewer
      seal: smooth((h - 0.55) / 0.2),                   // vermilion seal lands on the wrong place
      margin: h >= 0.95 ? 1 : 0,                        // a margin note that nobody wrote
      path: smooth(h / 0.9),                            // the old gate's shapes are cut back to paper along its road, in step with the walk
    };
  }

  return { FACT, TIMING, WORLD, PLANES, PLANE_DELAY, PARALLAX, NEW_LAG, clamp, smooth, lerp, rng, noise2, fbm, arrival, reveal, smoothPath, stroke, ridge, ridgeY, washBody, mountainStamps, newStamps, createMachine, hauntState, VANISHED, CITY, figureAt, fibreDir, fibrePath, seep, SEEP_AMP };
});
