// Book + Shadow core: pure logic, no DOM. Browser global BSCore, or a CommonJS module for node.
// One number t (0 = old gate world, 1 = new open road) drives every puppet; nothing is swapped.
(function (root) {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const span = (t, a, b) => smooth((t - a) / (b - a));
  const hash = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
  const HOLD_MS = 1200;
  const ANOM_MS = 1500, ANOM_MOVE = 260; // one deliberate misalignment: once the candle has travelled this far in HAUNT, the shade answers the wrong way for ANOM_MS
  const IDLE_MS = 20000, IDLE_REDUCED_MS = 8000; // new world waits this long with no input before the shade appears on its own

  function createMachine(opt) {
    const m = {
      state: 'OLD', holding: false, w: 0, t: 0, c: 0, haunt: 0, dwell: 0, compare: false,
      reduced: !!(opt && opt.reduced), flip: 0, flipping: false, turns: 0, lit: false, anomaly: 0, anomT: 0, moveAcc: 0,
      press() { if (m.state === 'OLD' || m.state === 'WRITING') { m.state = 'WRITING'; m.holding = true; } },
      release() { m.holding = false; },
      revert() { if (m.t > 0 && m.state !== 'REVERTING') { m.state = 'REVERTING'; m.holding = false; m.w = 0; m.flipping = false; m.flip = 0; m.anomaly = 0; m.moveAcc = 0; } },
      poke() { if (m.state === 'NEW') m.dwell = 0; },
      summon() { if (m.state === 'NEW') m.state = 'HAUNT'; },
      setCompare(v) { m.compare = !!v; },
      setReduced(v) { m.reduced = !!v; },
      turnPage() { if (m.state === 'HAUNT' && m.haunt > 0.5 && !m.flipping) { m.flipping = true; m.flip = 0; return true; } return false; },
      setProgress(t) { m.t = clamp(t); m.w = m.t > 0 ? 1 : 0; m.state = m.t >= 1 ? 'NEW' : m.t > 0 ? 'RECON' : 'OLD'; m.dwell = 0; m.haunt = 0; m.anomaly = 0; m.moveAcc = 0; },
      lightMoved(d) { if (m.state === 'HAUNT' && m.haunt > 0.5 && m.anomaly === 0 && !m.compare) { m.moveAcc += d; if (m.moveAcc >= ANOM_MOVE) { m.anomaly = 1; m.anomT = ANOM_MS; } } },
      forceAnomaly() { m.anomaly = 1; m.anomT = 1e9; },
      forceHaunt(h) { m.t = 1; m.w = 1; m.state = 'HAUNT'; m.haunt = clamp(h); },
      step(dt) {
        const s = m.state;
        if (s === 'WRITING') {
          if (m.holding) m.w = Math.min(1, m.w + dt / HOLD_MS); else m.w = Math.max(0, m.w - dt / 280);
          if (m.w >= 1) { m.state = 'RECON'; m.holding = false; m.t = 1e-4; }
          else if (m.w <= 0 && !m.holding) m.state = 'OLD';
        } else if (s === 'RECON') {
          m.t += dt / (m.reduced ? 1500 : 4800);
          if (m.t >= 1) { m.t = 1; m.state = 'NEW'; m.dwell = 0; }
        } else if (s === 'NEW') {
          m.dwell += dt;
          if (m.dwell >= (m.reduced ? IDLE_REDUCED_MS : IDLE_MS)) m.state = 'HAUNT';
        } else if (s === 'HAUNT') {
          m.haunt = Math.min(1, m.haunt + dt / 2400);
        } else if (s === 'REVERTING') {
          m.t -= dt / 1800; m.haunt = Math.max(0, m.haunt - dt / 600);
          if (m.t <= 0) { m.t = 0; m.haunt = 0; m.w = 0; m.state = 'OLD'; }
        }
        const ct = m.compare && m.t > 0 ? 1 : 0;
        m.c += clamp(ct - m.c, -dt / 250, dt / 250);
        if (m.anomaly === 1) { m.anomT -= dt; if (m.anomT <= 0) { m.anomaly = 2; m.anomT = 0; } }
        if (m.flipping) { m.flip += dt / (m.reduced ? 700 : 1600); if (m.flip >= 1) { m.flipping = false; m.flip = 0; m.turns++; } }
      },
      // shown world progress: comparing pulls the whole book back to the old world in the same camera
      view() { const k = 1 - smooth(m.c); return { td: m.t * k, haunt: m.haunt * k }; },
      // 0..1 strength of the wrong-way response; reduced motion holds it fully static for the whole window
      anomK() { if (m.anomaly !== 1) return 0; if (m.reduced) return 1; const p = 1 - m.anomT / ANOM_MS; return smooth(p / 0.12) * (1 - smooth((p - 0.78) / 0.22)); },
      glow() { return m.lit ? 1 : 0.04 + 0.96 * Math.max(smooth(m.w), span(m.t, 0, 0.12)); },
    };
    return m;
  }

  // the shade on the back of the paper casts TOWARD the candle (a real shadow falls away from it)
  function shadeVector(sx, sy, lx, ly) {
    const dx = lx - sx, dy = ly - sy, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, dist: d };
  }

  const api = { clamp, smooth, span, hash, createMachine, shadeVector, HOLD_MS, ANOM_MS, ANOM_MOVE, IDLE_MS, IDLE_REDUCED_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BSCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
