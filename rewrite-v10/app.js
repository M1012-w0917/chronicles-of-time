// V10 app: runs the precompute in cooperative slices, moves a playhead over the stored frames, wires the book and input.
// window.__slice exposes the test hooks.
(function () {
  'use strict';
  const C = V10Core, P = V10Paint;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const KEY = 'v10.world';
  const stage = $('stage'), g = stage.getContext('2d');
  const root = document.documentElement, body = document.body;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const span = (s, a, b) => { const v = clamp((s - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };

  const job = C.precompute(), S = job.store, EV = C.events();
  const fNew = S.fNew, FEND = S.F - 1, N = S.N;
  const LIVE = 30, REV = fNew / 4, CMP = fNew / 1.2;     // playhead speeds in frames per second: live sim, undo (about 4 s), compare (about 1.2 s)
  const HAND_F = EV.knocks[0].f - 6;                      // reduced motion stops the haunt on the formed hand print
  const fill = (n) => { while (S.filled <= n && !job.done) job.run(40); };

  // paper grain and the scorch (the same hand print the grains form, burnt brown)
  (function decor() {
    const c = P.mk(96, 96), x = c.getContext('2d'), rnd = C.mulberry32(11), d = x.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + rnd() * 110, a = rnd() * 0.1; d.data[i] = v; d.data[i + 1] = v * 0.9; d.data[i + 2] = v * 0.72; d.data[i + 3] = a * 255; }
    x.putImageData(d, 0, 0); root.style.setProperty('--grain', 'url(' + c.toDataURL() + ')');
    const sc = $('scorch').getContext('2d'); sc.fillStyle = 'rgb(70,28,8)';
    C.handTargets(500).forEach((p) => { sc.beginPath(); sc.arc((p[0] - C.CX) * 1.05 + 100, (p[1] - 150) * 1.05 + 110, 3.4, 0, 6.2832); sc.fill(); });
  })();

  const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  const reducedParam = q.get('reduced');
  let reduced = reducedParam != null ? reducedParam === '1' : !!(mq && mq.matches);
  const frozen = ['t', 'w', 'state', 'haunt'].some((k) => q.has(k)); // debug params make a deterministic still
  if (q.has('fresh')) store.del(KEY);
  let keep = 0, pf = 0, w = 0, running = false, undo = false, compare = false, held = false, hauntDone = false, hauntWait = 0, restoring = false, persistedNow = false;
  if (q.has('t')) { keep = C.frameOfT(parseFloat(q.get('t')) || 0); }
  else if (q.get('state') === 'new') keep = fNew;
  else if (q.has('haunt')) keep = fNew + clamp(parseFloat(q.get('haunt')) || 0, 0, 1) * (FEND - fNew);
  else if (!frozen && store.get(KEY)) restoring = true; // a settled world is restored directly to the settled frame once those frames exist
  if (q.has('w')) w = clamp(parseFloat(q.get('w')) || 0, 0, 1);
  if (keep > 0) fill(Math.ceil(keep) + 1);
  keep = Math.min(keep, S.filled - 1); pf = keep;
  if (q.get('compare') === '1') { compare = true; pf = 0; }
  if (q.get('blind') === '1') body.dataset.blind = 'true';
  const wasPersisted = !!store.get(KEY);

  let time = frozen ? 5 : 0, last = performance.now(), frame = 0, ftSum = 0, ftMax = 0, ftN = 0, fpsN = 0, fpsT = 0, fps = 0, ready = false;
  const xy = new Float32Array(N * 2); let ps = { gate: 0, keel: 0, tilt: 0 };
  const settled = () => { if (!frozen) { store.set(KEY, JSON.stringify({ v: 1, t: 1 })); persistedNow = true; } };
  function stateName() {
    if (undo) return 'REVERTING';
    if (keep <= 0) return w > 0 ? 'WRITING' : 'OLD';
    if (keep < fNew) return 'REWRITING';
    return keep > fNew && !hauntDone ? 'HAUNT' : 'NEW';
  }
  function derived() {
    const tShown = Math.min(pf, fNew) / fNew, hs = Math.max(0, pf - fNew) / LIVE;
    return { tShown, hs, wipe: span(tShown, 0.05, 0.75), nm: span(tShown, 0.75, 0.95), sc: span(hs, 4.5, 6.0), rw: span(hs, 6.6, 7.8) };
  }

  function step(dt) {
    const s = dt / 1000, rs = reduced ? 1 / 1.8 : 1;
    if (!job.done) job.run(restoring ? 30 : 8);
    if (restoring && S.filled > fNew) { keep = pf = fNew; restoring = false; }
    if (!frozen) {
      if (undo) { keep = Math.max(0, keep - REV * rs * s); if (keep <= 0) { keep = 0; undo = false; running = false; hauntDone = false; hauntWait = 0; w = 0; held = false; } }
      else if (!compare && !restoring) {
        if (keep === 0 && !running) {
          if (held) { w = Math.min(1, w + s / 1.2); if (w >= 1) { running = true; w = 0; held = false; } } else w = Math.max(0, w - s / 0.3);
        }
        if (running && keep < fNew) { keep = Math.min(fNew, keep + LIVE * rs * s, S.filled - 1); if (keep >= fNew) { keep = fNew; running = false; settled(); } }
        else if (keep >= fNew && !hauntDone) {
          if (keep === fNew) hauntWait += dt;
          if (hauntWait >= 4000) {
            const lim = reduced ? HAND_F : FEND;
            keep = Math.min(lim, keep + LIVE * rs * s, S.filled - 1);
            if (keep >= lim) { hauntDone = true; }
          }
        }
      }
    }
    const target = compare ? 0 : keep, sp = CMP * rs * s;
    if (Math.abs(target - pf) <= sp) pf = target; else pf += Math.sign(target - pf) * sp;
  }

  function render() {
    C.frameAt(S, pf, xy);
    const d = derived(), t0 = performance.now();
    ps = P.draw(g, { store: S, xy, pf, w: w, time, reduced });
    const ft = performance.now() - t0; ftSum += ft; ftN++; if (ft > ftMax) ftMax = ft;
    root.style.setProperty('--wipe', d.wipe.toFixed(4));
    root.style.setProperty('--hold', (keep > 0 ? Math.min(1, 1 - span(d.tShown, 0.02, 0.2)) : w).toFixed(4));
    root.style.setProperty('--nm', d.nm.toFixed(4));
    root.style.setProperty('--sc', d.sc.toFixed(4));
    root.style.setProperty('--rw', d.rw.toFixed(4));
    const st = stateName();
    body.dataset.state = st; body.dataset.reduced = String(reduced); body.dataset.compare = String(compare);
    const loading = !frozen && (!job.done || restoring); body.dataset.loading = String(loading);
    if (loading) { $('loadPct').textContent = Math.floor(job.progress * 100) + '%'; $('loadZh').textContent = restoring ? '正在恢复已落定的世界' : '砂粒正在落定'; $('loadEn').textContent = restoring ? 'Restoring the settled world' : 'Settling the sand'; }
    $('stateTag').textContent = st;
    $('compareBtn').setAttribute('aria-pressed', String(compare)); $('reduceBtn').setAttribute('aria-pressed', String(reduced));
    frame++;
  }

  function tick(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { time += dt / 1000; step(dt); }
    render();
    fpsN++; fpsT += dt; if (fpsT >= 1000) { fps = fpsN * 1000 / fpsT; fpsN = 0; fpsT = 0; }
    requestAnimationFrame(tick);
  }

  // ---- input ----
  const press = () => { if (keep === 0 && !running && !undo && !compare && !restoring) held = true; };
  const release = () => { held = false; };
  const setCompare = (b) => { compare = !!b; if (compare) held = false; };
  const revert = () => { store.del(KEY); persistedNow = false; if (keep > 0 && !undo) { undo = true; running = false; held = false; compare = false; } else if (w > 0) { w = 0; held = false; } };
  const setReduced = (b) => { reduced = !!b; };
  window.addEventListener('keydown', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space' || (e.key === 'Enter' && e.target === $('fact'))) { e.preventDefault(); if (!e.repeat) press(); }
    else if (e.key === 'c' || e.key === 'C') { if (!e.repeat) setCompare(true); }
    else if (e.key === 'z' || e.key === 'Z') revert();
    else if ((e.key === 'r' || e.key === 'R') && !e.repeat) setReduced(!reduced);
  });
  window.addEventListener('keyup', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space' || e.key === 'Enter') { if (e.code === 'Space') e.preventDefault(); release(); }
    else if (e.key === 'c' || e.key === 'C') setCompare(false);
  });
  const fact = $('fact');
  fact.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => fact.addEventListener(n, release));
  $('compareBtn').addEventListener('click', () => setCompare(!compare));
  $('revertBtn').addEventListener('click', revert);
  $('reduceBtn').addEventListener('click', () => setReduced(!reduced));
  if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { if (reducedParam == null) setReduced(e.matches); });

  // ---- test hook ----
  const setKeep = (f) => { fill(Math.ceil(f) + 1); keep = pf = Math.min(f, S.filled - 1); running = false; undo = false; if (keep <= fNew) hauntDone = false; };
  window.__slice = {
    getState() {
      const d = derived(), m = C.machineAt(pf * S.spf), gr = C.gravityAt(pf * S.spf);
      return {
        state: stateName(), p: pf / fNew, pf, keep, t: Math.min(keep, fNew) / fNew, tShown: d.tShown, haunt: Math.max(0, keep - fNew) / (FEND - fNew), hauntShown: Math.max(0, pf - fNew) / (FEND - fNew), hauntSec: d.hs,
        w, compare, reduced, frame, ready, persisted: store.get(KEY), wasPersisted, persistedNow, restoring, precomputed: job.done, progress: job.progress, filled: S.filled,
        grainCount: N, tremor: ps.tremor, gate: m.gate, keel: m.keel, tilt: gr.deg, wipe: d.wipe, struck: d.nm, scorch: d.sc, rewritten: d.rw, fps,
        knocks: EV.knocks.map((k) => k.f), frames: { fNew, fEnd: FEND, handF: HAND_F }, hauntWait,
        frameMs: { avg: ftN ? ftSum / ftN : 0, max: ftMax, n: ftN },
      };
    },
    grains() { const o = [], a = C.frameAt(S, pf); for (let i = 0; i < N; i++) o.push({ id: i, x: a[2 * i], y: a[2 * i + 1], role: S.role[i] }); return o; },
    sample(f) { fill(Math.ceil(f) + 1); return Array.from(C.frameAt(S, f)); },
    roles() { return Array.from(S.role); },
    metrics() { return C.metrics(S, Math.round(pf)); },
    fingerprint() { return C.fingerprint(S, Math.round(pf)); },
    pixelFingerprint() { const c = P.mk(32, 18), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(stage, 0, 0, 32, 18); const dd = x.getImageData(0, 0, 32, 18).data, out = []; for (let i = 0; i < dd.length; i += 4) out.push(0.3 * dd[i] + 0.59 * dd[i + 1] + 0.11 * dd[i + 2]); return out; },
    resetFrameStats() { ftSum = 0; ftMax = 0; ftN = 0; },
    setProgress(t) { setKeep(C.frameOfT(t)); },
    setFrame(f) { setKeep(f); },
    forceHaunt(x) { setKeep(fNew + clamp(x, 0, 1) * (FEND - fNew)); hauntDone = false; hauntWait = 0; },
    setCompare,
    toClient(sx, sy) { const r = stage.getBoundingClientRect(); return [r.left + (P.OX + sx) / P.CW * r.width, r.top + (P.OY + sy) / P.CH * r.height]; },
  };

  ready = true; body.dataset.ready = 'true'; last = performance.now();
  requestAnimationFrame(tick);
})();
