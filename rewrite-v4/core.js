// V4 core: pure logic, no DOM. Browser global V4Core, or a CommonJS module for node.
// Everything on the desk is a function of one number: world progress t (0 = quay with a lock gate, 1 = open silted bank).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V4Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '陈守拙是灰堡市渡口的守闸人。', en: 'Chen Shouzhuo is the lock keeper at the Ashmere ferry quay.' },
    neu: { zh: '渡口从未设闸,陈守拙从未存在。', en: 'The ferry never had a lock. Chen Shouzhuo never existed.' },
  };
  const TIMING = { holdMs: 1200, cancelMs: 400, rewriteMs: 8000, revertMs: 3500, compareMs: 450, hauntDelayMs: 4000, hauntMs: 9000, reducedScale: 0.4 };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const span = (t, a, b) => smooth((t - a) / (b - a)); // 0 before a, 1 after b

  function hash(i, seed) { // deterministic 0..1
    let h = (Math.imul(i | 0, 374761393) + Math.imul((seed || 0) | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // The quay as a function of t. Every number moves continuously; nothing is swapped.
  // Units are CAM-07 pixels in a 640x400 frame.
  function quay(t) {
    t = clamp(t);
    return {
      t,
      figure: 1 - span(t, 0.05, 0.5),            // Chen on the gate fades from the feet up
      gateOpen: span(t, 0.08, 0.5),               // gate arms swing away from each other, 0 closed, 1 fully retracted
      gateLen: 1 - span(t, 0.45, 0.85),           // arms shrink
      postH: 1 - span(t, 0.3, 0.95),              // gate posts sink
      crumble: span(t, 0.1, 0.9),                 // masonry bricks fall away as crumble passes their threshold
      warehouse: 1 - span(t, 0.15, 0.9),          // warehouse height scale
      lamp: 1 - span(t, 0.25, 0.7),
      shore: span(t, 0.12, 1),                    // shoreline migration 0..1
      shoreY: lerp(298, 352, span(t, 0.12, 1)),
      waterLevel: lerp(0, 18, span(t, 0.1, 0.95)),// water creeps up over the old quay foot
      silt: span(t, 0.25, 1),                     // mud colour in foreground
      reeds: span(t, 0.2, 1),
      sky: span(t, 0, 1),
    };
  }
  const brickGone = (i, crumble) => clamp((crumble - hash(i, 7) * 0.8) / 0.2); // 0 intact, 1 gone
  const reedGrow = (i, reeds) => span(reeds, 0.05 + hash(i, 11) * 0.7, 0.3 + hash(i, 11) * 0.7);

  // Rows of the log. Each rewrites when t passes at.
  const LOG = [
    { ts: '03-11 05:58', old: ['渡口开闸 守闸人:陈守拙', 'Gate opened. Keeper: Chen Shouzhuo'], neu: ['渡口水位记录 无闸', 'Water level logged. No gate.'], at: 0.22 },
    { ts: '03-11 12:10', old: ['货船过闸 3 艘 签收:陈守拙', 'Three barges locked through. Signed: Chen'], neu: ['货船泊岸 0 艘', 'Barges moored: 0'], at: 0.38 },
    { ts: '03-11 18:40', old: ['夜班交接 在岗:陈守拙', 'Night shift handover. On duty: Chen'], neu: ['夜班交接 无人在岗', 'Night shift handover. Nobody on duty.'], at: 0.54 },
    { ts: '03-11 23:41', old: ['人员 1 / 画面 1 吻合', 'Persons 1 / frame 1. Match.'], neu: ['人员 0 / 画面 0 吻合', 'Persons 0 / frame 0. Match.'], at: 0.7 },
  ];
  const CARD = { name: ['陈守拙', 'Chen Shouzhuo'], role: ['灰堡市渡口守闸人', 'Lock keeper, Ashmere ferry'], year: ['1961 生 / 1987 起任', 'b. 1961 / in post since 1987'], none: ['查无此人', 'NO RECORD'] };
  const HAUNT_LINE = { zh: '人员登记 0 / 画面检测 1', en: 'Registered persons 0 / detected in frame 1', ts: '03-11 23:41' };
  const TAPE_DATE = '1994-03-12 23:41:07'; // stale loop, older than anything the archive claims to hold

  function logAt(t) { return LOG.map((r) => ({ ts: r.ts, text: t >= r.at ? r.neu : r.old, rewritten: t >= r.at })); }

  // Haunt as a function of h 0..1 (figure on the now nonexistent footing, standing on water).
  function hauntState(h) {
    h = clamp(h);
    return {
      tape: smooth(h / 0.1),                       // the stale loop takes over the corner
      figure: smooth((h - 0.05) / 0.15),
      heading: 180 * (1 - smooth((h - 0.25) / 0.55)), // 180 back to lens, 0 facing the lens
      mismatch: h >= 0.45 ? 1 : 0,                 // log line: 0 registered / 1 detected
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
    // td: the t the evidence shows. Compare pulls it back toward the old world without touching m.t.
    m.view = function () { return { t: m.t, td: m.t * (1 - smooth(m.c)), c: m.c, w: m.w, haunt: m.haunt }; };
    return m;
  }

  return { FACT, TIMING, LOG, CARD, HAUNT_LINE, TAPE_DATE, clamp, smooth, lerp, span, hash, quay, brickGone, reedGrow, logAt, hauntState, createMachine };
});
