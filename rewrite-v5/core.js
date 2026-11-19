// V5 core: pure logic, no DOM. Browser global V5Core, or a CommonJS module for node.
// The whole theatre is a function of one number: world progress t (0 = gate stage, 1 = open mountain road).
// Every piece (gate boards, posts, lintel, bricks, slabs, trees, road segments, lamps, keeper) reads t through
// the functions below, each with its own staggered window, so nothing is swapped: pieces unlatch, flip and are pulled away
// while trees and the road unfold in the same place.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V5Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '城门每日黄昏关闭,守门人点亮三盏灯。', en: 'The city gate closes every dusk, and the gatekeeper lights three lamps.' },
    neu: { zh: '这座城从来没有城门,黄昏也没有守门人。', en: 'This city never had a gate, and dusk never had a gatekeeper.' },
  };
  const TIMING = { holdMs: 1200, cancelMs: 400, rewriteMs: 9000, revertMs: 4000, compareMs: 500, hauntDelayMs: 4000, hauntMs: 10000, reducedScale: 0.4 };
  const COUNTS = { boards: 6, bricks: 60, slabs: 10, trees: 5, roadSegs: 8, lamps: 3 };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const span = (t, a, b) => smooth((t - a) / (b - a)); // 0 before a, 1 after b

  function hash(i, seed) { // deterministic 0..1
    let h = (Math.imul(i | 0, 374761393) + Math.imul((seed || 0) | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // Gate leaf boards, 0..5: boards 0-2 are the left leaf (top to bottom), 3-5 the right leaf. Each board unlatches on its own beat.
  function board(i, t) {
    const s = 0.04 + (i % 3) * 0.05 + (i > 2 ? 0.025 : 0);
    return { swing: span(t, s, s + 0.2), flip: span(t, s + 0.12, s + 0.3), away: span(t, s + 0.26, s + 0.52) };
  }
  const lintel = (t) => ({ tilt: span(t, 0.22, 0.42), rise: span(t, 0.4, 0.66) });
  const post = (i, t) => ({ lean: span(t, 0.3 + i * 0.04, 0.5 + i * 0.04), sink: span(t, 0.5 + i * 0.04, 0.82 + i * 0.04) });
  function brick(i, t) {
    const row = Math.floor((i % 30) / 10), s = 0.08 + hash(i, 3) * 0.4 + (2 - row) * 0.02;
    return { flip: span(t, s, s + 0.14), away: span(t, s + 0.1, s + 0.32) };
  }
  function slab(i, t) { const s = 0.06 + hash(i, 5) * 0.34; return { flip: span(t, s, s + 0.16), away: span(t, s + 0.12, s + 0.34) }; }
  function tree(i, t) { const s = 0.36 + i * 0.07; return { grow: span(t, s, s + 0.3), unfold: span(t, s + 0.18, s + 0.42) }; }
  const roadSeg = (j, t) => span(t, 0.4 + j * 0.06, 0.62 + j * 0.055);
  const lamp = (i, t) => ({ glow: 1 - span(t, 0.18 + i * 0.12, 0.34 + i * 0.12), pull: span(t, 0.36 + i * 0.05, 0.62 + i * 0.05) });
  const ridge = (t) => span(t, 0.3, 0.8);           // the shut mountain pass folds down
  const sky = (t) => span(t, 0.05, 0.95);           // amber dusk to jade dusk
  const cone = (t) => 1 - span(t, 0.12, 0.78);      // keeper lantern cone
  // keeper: path mix (flat patrol path to winding road), pull (dragged away on his own rod, limbs going slack)
  const keeper = (t) => ({ mix: span(t, 0.08, 0.3), road: span(t, 0.1, 0.62), pull: span(t, 0.62, 0.9) });
  const keeperAlive = (t) => keeper(t).pull < 0.995;

  // Scalar summaries used by the debug API and tests.
  function metrics(t) {
    const avg = (n, f) => { let s = 0; for (let i = 0; i < n; i++) s += f(i); return s / n; };
    return {
      boardsAway: avg(6, (i) => board(i, t).away), boardsFlip: avg(6, (i) => board(i, t).flip),
      bricksGone: avg(60, (i) => brick(i, t).away), slabsGone: avg(10, (i) => slab(i, t).away),
      treeGrow: avg(5, (i) => tree(i, t).grow), roadOpen: avg(8, (j) => roadSeg(j, t)),
      lamps: avg(3, (i) => lamp(i, t).glow), cone: cone(t), keeperPull: keeper(t).pull, keeperAlive: keeperAlive(t),
      lintelRise: lintel(t).rise, ridgeOpen: ridge(t),
    };
  }

  // Backlight x (stage px). Ink (w) swings the lamp, so cast shadows move before any piece does. Fades once the rewrite is under way.
  const lightWriting = (w, tReal) => smooth(w) * (1 - span(tReal, 0.05, 0.7));

  // Haunt as a function of h 0..1: a lantern-bearing shade on the scrim with no puppet, no rod and no keeper behind it.
  function hauntState(h) {
    h = clamp(h);
    return {
      shade: smooth(h / 0.12),                        // the shade soaks into the near scrim
      lightMove: smooth((h - 0.22) / 0.22),           // the backlight is dragged away to the right; the shade does not follow
      arm: smooth((h - 0.45) / 0.3),                  // its lantern arm lifts and reaches toward the front rod
      tug: smooth((h - 0.5) / 0.15) * (0.55 + 0.45 * Math.sin(h * 34)), // the front rod is pulled by the shade
      mismatch: h >= 0.4 ? 1 : 0,                     // caption: keepers 0 / shades 1
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
      m.c = clamp(m.c + (tgt > m.c ? dt : -dt) / (T.compareMs * (m.reduced ? 0.5 : 1)));
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
    // td: the t the stage shows. Compare pulls it back toward the old world without touching m.t.
    m.view = function () { return { t: m.t, td: m.t * (1 - smooth(m.c)), c: m.c, w: m.w, haunt: m.haunt }; };
    return m;
  }

  return { FACT, TIMING, COUNTS, clamp, smooth, lerp, span, hash, board, lintel, post, brick, slab, tree, roadSeg, lamp, ridge, sky, cone, keeper, keeperAlive, metrics, lightWriting, hauntState, createMachine };
});
