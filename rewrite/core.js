/* Pure logic for the rewrite slice. UMD: works as a plain <script> and under node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SliceCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // Deterministic PRNG (mulberry32)
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Per-entity erasure progress. t: global progress 0..1, wave: 0 (at the pen) .. 1 (far),
  // jitter: 0..1 per entity. Monotonic non-decreasing in t, 0 at t=0, 1 at t=1.
  var SPREAD = 0.55, JIT = 0.12;
  function localProgress(t, wave, jitter) {
    wave = clamp(wave, 0, 1); jitter = clamp(jitter, 0, 1);
    return clamp(t * (1 + SPREAD + JIT) - wave * SPREAD - jitter * JIT, 0, 1);
  }

  // Reduced motion: three held keyframes of the same model, crossfaded.
  // u 0..1 -> {a, b, mix}: render keyframe a, then keyframe b at alpha mix.
  var KEYFRAMES = [0, 0.5, 1];
  function reducedStages(u) {
    u = clamp(u, 0, 1);
    var seg = u < 0.5 ? 0 : 1;
    var f = clamp((u - seg * 0.5) * 2, 0, 1);
    return { a: KEYFRAMES[seg], b: KEYFRAMES[seg + 1], mix: smooth((f - 0.25) / 0.5) };
  }

  // State machine: OLD -> WRITING -> REWRITING -> NEW -> UNDOING -> OLD, plus SCRUB.
  function createMachine(o) {
    o = o || {};
    var m = {
      state: 'OLD', t: 0, hold: 0, newTime: 0,
      holdDuration: o.holdDuration || 1.2,
      rewriteDuration: o.rewriteDuration || 9,
      undoDuration: o.undoDuration || 5.5,
      _from: 'OLD'
    };
    function settle() {
      if (m.t <= 0) { m.t = 0; m.state = 'OLD'; }
      else if (m.t >= 1) { m.t = 1; if (m.state !== 'NEW') m.newTime = 0; m.state = 'NEW'; }
      else m.state = 'SCRUB';
    }
    m.startHold = function () {
      if (m.state === 'OLD' || m.state === 'SCRUB') { m._from = m.state; m.state = 'WRITING'; m.hold = 0; return true; }
      return false;
    };
    m.releaseHold = function () {
      if (m.state === 'WRITING') { m.hold = 0; m.state = m._from; return true; }
      return false;
    };
    m.undo = function () {
      if (m.state === 'NEW' || m.state === 'REWRITING' || (m.state === 'SCRUB' && m.t > 0)) { m.state = 'UNDOING'; return true; }
      return false;
    };
    m.scrub = function (v) { m.hold = 0; m.t = clamp(v, 0, 1); settle(); };
    m.jumpNew = function () { m.t = 1; m.state = 'NEW'; m.newTime = 99; };
    m.autoplay = function () { if (m.state === 'OLD') { m.state = 'REWRITING'; m.hold = 0; return true; } return false; };
    m.tick = function (dt) {
      switch (m.state) {
        case 'WRITING':
          m.hold += dt / m.holdDuration;
          if (m.hold >= 1) { m.hold = 0; m.state = 'REWRITING'; }
          break;
        case 'REWRITING':
          m.t += dt / m.rewriteDuration;
          if (m.t >= 1) { m.t = 1; m.newTime = 0; m.state = 'NEW'; }
          break;
        case 'UNDOING':
          m.t -= dt / m.undoDuration;
          if (m.t <= 0) { m.t = 0; m.state = 'OLD'; m.newTime = 0; }
          break;
        case 'NEW':
          m.newTime += dt;
          break;
      }
      return m;
    };
    return m;
  }

  // Move a value toward a target at a constant rate (used for compare easing).
  function stepToward(cur, target, dt, rate) {
    var d = target - cur, s = rate * dt;
    return Math.abs(d) <= s ? target : cur + Math.sign(d) * s;
  }

  return {
    clamp: clamp, lerp: lerp, smooth: smooth, mulberry32: mulberry32,
    localProgress: localProgress, reducedStages: reducedStages, KEYFRAMES: KEYFRAMES,
    createMachine: createMachine, stepToward: stepToward
  };
});
