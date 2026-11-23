// V2 core: pure logic, no DOM. Works as a browser global (V2Core) and as a CommonJS module for node tests.
// Everything the diorama shows is a function of one model: world progress t (0 = old city, 1 = city never founded).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V2Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACT = {
    old: { zh: '灰堡市建于永昌四十二年。', en: 'City of Ashmere founded in year 42.' },
    neu: { zh: '灰堡市从未建立。', en: 'City of Ashmere was never founded.' },
    note: { zh: '他记得永昌四十二年。', en: 'He remembers year 42.' },
  };
  const TIMING = { holdMs: 1400, cancelMs: 450, rewriteMs: 9000, undoMs: 4200, compareMs: 380, hauntDelayMs: 1800, hauntMs: 7500, reducedStageMs: 1500 };
  const PAGE = { w: 500, d: 640 };
  const WAVE_ORIGIN = { x: -250, y: 272 }; // where the printed line sits: the rewrite spreads from here
  const WAVE_REACH = 900;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const progress = (t, delay, dur) => clamp((t - delay) / dur);

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

  const distN = (x, y) => Math.min(1, Math.hypot(x - WAVE_ORIGIN.x, y - WAVE_ORIGIN.y) / WAVE_REACH);

  // ---- world layout (page coordinates: x right, y toward the reader, origin at the gutter) ----
  const COLS = [[-440, -322], [-298, -172], [-148, -30], [30, 148], [172, 298], [322, 440]];
  const ROWS = [[-300, -205], [-181, -67], [-43, 71], [95, 205]];
  const VSTREETS = [-310, -160, 0, 160, 310];
  const HSTREETS = [-193, -55, 83];
  const CITY = { x0: -440, x1: 440, y0: -300, y1: 205 };
  const HERO_POS = { x: -92, y: 83 };

  function buildWorld(seed) {
    const r = rng(seed == null ? 1842 : seed);
    const items = [];
    let id = 0;
    const add = (o) => { o.id = id++; items.push(o); return o; };

    // printed map: streets and block outlines (ink lines that get wiped)
    VSTREETS.forEach((cx) => {
      const x = cx - 12, y = CITY.y0, w = 24, h = CITY.y1 - CITY.y0;
      add({ kind: 'ink', sub: 'street', x, y, w, h, dir: 'v', delay: 0.04 + 0.3 * distN(cx, 0), dur: 0.22 });
    });
    HSTREETS.forEach((cy) => {
      const x = CITY.x0, y = cy - 12, w = CITY.x1 - CITY.x0, h = 24;
      add({ kind: 'ink', sub: 'street', x, y, w, h, dir: 'h', delay: 0.04 + 0.3 * distN(0, cy), dur: 0.22 });
    });
    COLS.forEach(([xa, xb]) => ROWS.forEach(([ya, yb]) => {
      add({ kind: 'ink', sub: 'block', x: xa, y: ya, w: xb - xa, h: yb - ya, dir: 'h',
        delay: 0.05 + 0.3 * distN((xa + xb) / 2, (ya + yb) / 2) + r() * 0.04, dur: 0.2 });
    }));

    // buildings
    const hues = [28, 34, 40, 22, 46];
    COLS.forEach(([xa, xb], ci) => ROWS.forEach(([ya, yb], ri) => {
      const hall = ci === 3 && ri === 1;
      const nx = hall ? 1 : (r() < 0.55 ? 2 : 1), ny = hall ? 1 : (r() < 0.5 ? 2 : 1);
      const cw = (xb - xa) / nx, ch = (yb - ya) / ny;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const inset = 5 + r() * 9;
        const px = xa + i * cw, py = ya + j * ch;
        let w = cw - inset * 2 - (nx > 1 ? 3 : 0), d = ch - inset * 2 - (ny > 1 ? 3 : 0);
        let x = px + inset, y = py + inset;
        const cxm = x + w / 2, cym = y + d / 2;
        const central = 1 - Math.min(1, Math.hypot(cxm - 40, cym + 70) / 480);
        let h = 14 + r() * 30 + central * 52;
        if (hall) { w = 52; d = 52; x = px + (cw - w) / 2; y = py + (ch - d) / 2; h = 128; }
        const hue = hues[Math.floor(r() * hues.length)];
        const roofs = [[14, 46, 46], [12, 40, 40], [205, 12, 44], [38, 35, 58], [20, 52, 52]];
        const roof = roofs[Math.floor(r() * roofs.length)];
        add({ kind: 'building', hall, x, y, w, d, h,
          wall: [hue, 30 + r() * 16, 62 + r() * 14], roof, win: r() < 0.7 ? 'lit' : 'dim',
          delay: 0.12 + 0.4 * distN(cxm, cym) + r() * 0.06, dur: 0.26 });
      }
    }));

    // people: small standing tokens along the streets
    const palette = [[355, 55, 42], [210, 45, 40], [38, 70, 48], [150, 30, 36], [280, 28, 40], [18, 60, 46]];
    const addPerson = (x, y, hero) => {
      const c = palette[hero ? 0 : Math.floor(r() * palette.length)];
      add({ kind: 'person', hero: !!hero, x, y, color: c, head: r() < 0.5 ? 0 : 1,
        face: (r() - 0.5) * 1.0, delay: 0.0 + 0.3 * distN(x, y) + r() * 0.05, dur: 0.16 });
    };
    for (let i = 0; i < 20; i++) addPerson(CITY.x0 + 20 + r() * 840, HSTREETS[i % 3] + (r() - 0.5) * 12, false);
    for (let i = 0; i < 12; i++) addPerson(VSTREETS[i % 5] + (r() - 0.5) * 10, CITY.y0 + 12 + r() * 480, false);
    addPerson(HERO_POS.x, HERO_POS.y, true);
    // keep the crowd away from the hero so the lone figure reads as alone
    items.forEach((it) => { if (it.kind === 'person' && !it.hero && Math.hypot(it.x - HERO_POS.x, it.y - HERO_POS.y) < 34) it.x += 60; });

    // what the page grows instead: standing stones in a loose ring, then paper grass tufts
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r() * 0.3;
      const x = 20 + Math.cos(a) * (170 + r() * 40), y = -70 + Math.sin(a) * (95 + r() * 20);
      add({ kind: 'stone', x: x - 9, y: y - 6, w: 14 + r() * 8, d: 10 + r() * 6, h: 30 + r() * 36,
        delay: 0.56 + 0.2 * distN(x, y) + r() * 0.05, dur: 0.2 });
    }
    for (let i = 0; i < 70; i++) {
      const x = CITY.x0 + r() * 880, y = CITY.y0 + r() * 500;
      if (Math.abs(x) < 14) continue;
      add({ kind: 'tuft', x, y, blades: 4 + Math.floor(r() * 3), size: 9 + r() * 12, hue: 78 + r() * 30, rot: r() * 360,
        delay: 0.5 + 0.3 * distN(x, y) + r() * 0.05, dur: 0.16 });
    }
    // paper terrain: low ridges that rise along the old streets, and crease lines across the page (appended last so earlier layout is unchanged)
    for (let i = 0; i < 12; i++) {
      const horiz = i % 2 === 0, side = r() < 0.5 ? -1 : 1, len = 100 + r() * 110;
      const a0 = side < 0 ? -430 : 40, a1 = side < 0 ? -40 : 430;
      if (horiz) {
        const x = a0 + r() * (a1 - a0 - len), y = HSTREETS[Math.floor(r() * 3)] - 6;
        add({ kind: 'ridge', x, y, w: len, d: 12, h: 9 + r() * 11, delay: 0.14 + 0.34 * distN(x + len / 2, y) + r() * 0.04, dur: 0.26 });
      } else {
        const vs = [VSTREETS[0], VSTREETS[1], VSTREETS[3], VSTREETS[4]], x = vs[Math.floor(r() * 4)] - 6, y = CITY.y0 + r() * (480 - len);
        add({ kind: 'ridge', x, y, w: 12, d: len, h: 9 + r() * 11, delay: 0.14 + 0.34 * distN(x, y + len / 2) + r() * 0.04, dur: 0.26 });
      }
    }
    for (let i = 0; i < 9; i++) {
      const x = -380 + r() * 760, y = -240 + r() * 330, len = 110 + r() * 170, ang = (r() - 0.5) * 80 + (i % 2 ? 90 : 0);
      add({ kind: 'crease', x, y, len, ang, delay: 0.1 + 0.36 * distN(x, y) + r() * 0.04, dur: 0.24 });
    }
    return { items, seed: seed == null ? 1842 : seed };
  }

  // value of one item at world progress t. person: fold (0 standing .. 1 flat and gone). building: k (1 full height .. 0 sunk).
  // stone/tuft: k (0 buried .. 1 grown). ink: p (0 printed .. 1 wiped).
  function itemValue(it, t) {
    const p = smooth(progress(t, it.delay, it.dur));
    switch (it.kind) {
      case 'building': return 1 - p;
      case 'person': return it.hero ? 0 : p;
      case 'stone': case 'tuft': case 'ridge': case 'crease': return p;
      case 'ink': return p;
      default: return 0;
    }
  }

  // page ground washes from printed parchment to a pale meadow
  const meadow = (t) => smooth(progress(t, 0.35, 0.6));
  // the printed old line is struck, the new one is written below it
  function lineState(td, w) {
    return {
      strike: clamp(w),                                   // 0..1 ink strike through the old line
      oldFade: 1 - 0.7 * smooth(progress(td, 0, 0.2)),    // old line stays as a struck scar
      newReveal: clamp(w),                                // new line written below while the pen is held
    };
  }
  // pen: down while writing, lifts away once the world starts to change
  function penState(td, w) {
    const down = smooth(clamp(w * 6));
    const away = smooth(progress(td, 0.02, 0.2));
    return { x: clamp(w), lift: 70 * (1 - down) + 90 * away, visible: 1 - smooth(progress(td, 0.18, 0.12)) };
  }

  // the consequence: the one token that is not unwritten turns to the camera, the margin shows what it remembers
  function hauntState(h) {
    return {
      heading: 180 * (1 - smooth(progress(h, 0, 0.8))), // degrees away from the camera
      ring: smooth(progress(h, 0, 0.35)),
      margin: smooth(progress(h, 0.3, 0.6)),
      scale: 1 + 0.9 * smooth(progress(h, 0, 0.5)),
    };
  }

  const displayT = (t, c) => t * (1 - c);

  // ---- interaction state machine ----
  function createMachine(opts) {
    opts = opts || {};
    const T = Object.assign({}, TIMING, opts.timing || {});
    const m = { state: 'OLD', t: 0, w: 0, c: 0, haunt: 0, held: false, comparing: false, reduced: !!opts.reduced,
      hauntClock: 0, stageClock: 0, settled: null };
    const settle = () => { m.settled = m.state === 'NEW' ? 'new' : 'old'; };
    settle();

    m.press = () => { if (m.state === 'OLD' || m.state === 'WRITING') { m.held = true; m.state = 'WRITING'; } };
    m.release = () => { m.held = false; m.freezeW = false; if (m.state === 'WRITING') m.state = 'OLD'; }; // early release cancels
    m.setCompare = (on) => { m.comparing = !!on; };
    m.undo = () => {
      if (m.state === 'REWRITING' || m.state === 'NEW' || m.state === 'SCRUB') {
        m.state = 'UNDOING'; m.stageClock = 0;
      }
    };
    m.scrub = (v) => {
      v = clamp(v); m.t = v; m.held = false;
      if (v <= 0) { m.state = 'OLD'; m.w = 0; m.hauntClock = 0; m.haunt = 0; }
      else if (v >= 1) { m.state = 'NEW'; m.w = 1; }
      else { m.state = 'SCRUB'; m.w = 1; m.hauntClock = 0; m.haunt = 0; }
      m.freezeW = false;
      if (m.state === 'OLD' || m.state === 'NEW') settle();
    };
    m.setWrite = (v) => { m.state = 'WRITING'; m.w = clamp(v); m.held = true; m.freezeW = true; m.t = 0; };
    m.setState = (name) => {
      if (name === 'new') { m.scrub(1); } else { m.scrub(0); }
    };
    m.setReduced = (on) => { m.reduced = !!on; };

    m.step = (dt) => {
      const prev = m.state;
      // compare easing
      const ct = m.comparing ? 1 : 0;
      if (m.reduced) m.c = ct; else m.c = clamp(m.c + (ct - m.c) * Math.min(1, dt / (T.compareMs * 0.5)), 0, 1);
      if (Math.abs(m.c - ct) < 0.002) m.c = ct;
      if (m.freezeW) return m;

      if (m.state === 'WRITING') {
        m.w = clamp(m.w + dt / T.holdMs);
        if (m.w >= 1) { m.state = 'REWRITING'; m.stageClock = 0; }
      } else if (m.state === 'OLD' && m.w > 0) {
        m.w = clamp(m.w - dt / T.cancelMs);
      } else if (m.state === 'REWRITING') {
        if (m.reduced) {
          m.stageClock += dt;
          m.t = m.stageClock < T.reducedStageMs ? 0.5 : 1;
        } else m.t = clamp(m.t + dt / T.rewriteMs);
        if (m.t >= 1) { m.t = 1; m.state = 'NEW'; m.hauntClock = 0; }
      } else if (m.state === 'UNDOING') {
        if (m.reduced) m.t = 0; else m.t = clamp(m.t - dt / T.undoMs);
        m.hauntClock = Math.max(0, m.hauntClock - dt * 4);
        if (m.t <= 0) { m.t = 0; m.state = 'OLD'; m.w = 0.0001; m.held = false; }
      }
      if (m.state === 'NEW') m.hauntClock += dt;
      else if (m.state !== 'UNDOING') m.hauntClock = 0;
      const hp = clamp((m.hauntClock - T.hauntDelayMs) / T.hauntMs);
      m.haunt = m.reduced ? (hp > 0.02 ? 1 : 0) : hp;
      if (m.state === 'UNDOING' || m.state === 'OLD') { if (m.state === 'OLD') m.haunt = 0; }
      if (m.state !== prev && (m.state === 'OLD' || m.state === 'NEW')) settle();
      return m;
    };

    m.forceHaunt = (h) => { m.hauntClock = T.hauntDelayMs + clamp(h) * T.hauntMs; m.haunt = clamp(h); };
    m.snapshot = () => ({ settled: m.settled });
    m.restore = (s) => { if (s === 'new') m.scrub(1); };
    m.view = () => ({ td: displayT(m.t, m.c), w: m.w * (1 - m.c), haunt: m.haunt * (1 - m.c), state: m.state });
    return m;
  }

  return { FACT, TIMING, PAGE, WAVE_ORIGIN, HERO_POS, CITY, clamp, smooth, progress, rng, distN, buildWorld, itemValue, meadow,
    lineState, penState, hauntState, displayT, createMachine };
});
