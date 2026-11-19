// V7 app: wires the machine to the loom canvas and the book. window.__slice exposes the test hooks.
(function () {
  'use strict';
  const C = V7Core, P = V7Paint;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const KEY = 'v7.world';
  const stage = $('stage'), g = stage.getContext('2d');
  const fpC = P.mk(32, 17), fpG = fpC.getContext('2d', { willReadFrequently: true });
  const root = document.documentElement, body = document.body;

  // paper grain: a small noise canvas used as a CSS background
  (function grain() {
    const c = P.mk(96, 96), x = c.getContext('2d'), R = C.rng(11), d = x.createImageData(96, 96);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + R() * 110, a = R() * 0.1; d.data[i] = v; d.data[i + 1] = v * 0.9; d.data[i + 2] = v * 0.72; d.data[i + 3] = a * 255; }
    x.putImageData(d, 0, 0);
    root.style.setProperty('--grain', 'url(' + c.toDataURL() + ')');
  })();

  const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  const reducedParam = q.get('reduced');
  const m = C.createMachine({ reduced: reducedParam != null ? reducedParam === '1' : !!(mq && mq.matches) });
  const frozen = ['t', 'w', 'state', 'haunt'].some((k) => q.has(k)); // debug params make a deterministic still
  if (q.has('fresh')) store.del(KEY);
  if (q.has('t')) m.setProgress(parseFloat(q.get('t')));
  else if (q.get('state') === 'new') m.setProgress(1);
  else if (!frozen && store.get(KEY)) { m.setProgress(1); m.hauntDelay = C.TIMING.hauntReplayMs; } // a settled world replays its haunt on load
  if (q.has('w')) { m.state = 'WRITING'; m.w = parseFloat(q.get('w')); }
  if (q.has('haunt')) m.forceHaunt(parseFloat(q.get('haunt')));
  if (q.get('compare') === '1') { m.setCompare(true); m.c = 1; }
  // the new world is written once when it settles and cleared the moment an undo starts
  m.onSettle = () => { if (!frozen) store.set(KEY, JSON.stringify({ v: 1, t: 1 })); };
  m.onRevert = () => store.del(KEY);

  let time = frozen ? 5 : 0, last = performance.now(), frame = 0, ftSum = 0, ftMax = 0, ftN = 0, px = 0, py = 0, tpx = 0, tpy = 0, view = m.view(), snapT = 0;
  const wipeEl = $('factOld'); void wipeEl;

  function render() {
    view = m.view();
    const td = view.td, hd = view.hd, h = C.hauntAt(hd);
    if (m.reduced) { px = 0; py = 0; } else { px += (tpx - px) * 0.08; py += (tpy - py) * 0.08; }
    P.draw(g, { td, hd, time: m.reduced ? 0 : time, reduced: m.reduced, w: m.reduced ? m.w * 0.4 : m.w, px, py, state: m.state });
    // the sentence swaps with the shown t; the keeper's name leaves the register in the haunt
    root.style.setProperty('--wipe', C.span(td, 0.05, 0.75).toFixed(4));
    root.style.setProperty('--hold', (m.state === 'WRITING' || m.state === 'OLD' ? m.w : Math.min(m.w, 1 - C.span(m.t, 0.02, 0.2))).toFixed(4));
    root.style.setProperty('--nm', h.name.toFixed(4));
    body.dataset.erased = String(h.name > 0.98);
    body.dataset.state = m.state; body.dataset.reduced = String(m.reduced); body.dataset.compare = String(m.compare);
    $('stateTag').textContent = m.state;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare)); $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    // red thread between the book gutter and the loom
    const gt = $('gutterThread'), book = $('book'), loom = $('loom');
    const y1 = book.offsetTop + 26, y0 = loom.offsetTop + loom.offsetHeight - 2, len = Math.max(0, (y1 - y0) * (hd > 0 ? h.gutter : 0));
    gt.style.top = (y1 - len) + 'px'; gt.style.height = len + 'px';
    frame++;
  }

  function tick(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { time += dt / 1000; m.step(dt); }
    const t0 = performance.now(); render(); const ft = performance.now() - t0; ftSum += ft; ftN++; if (ft > ftMax) ftMax = ft;
    requestAnimationFrame(tick);
  }

  // ---- input ----
  window.addEventListener('keydown', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space' || (e.key === 'Enter' && e.target === $('fact'))) { e.preventDefault(); if (!e.repeat) m.press(); }
    else if (e.key === 'c' || e.key === 'C') { if (!e.repeat) m.setCompare(true); }
    else if (e.key === 'z' || e.key === 'Z') m.revert();
    else if ((e.key === 'r' || e.key === 'R') && !e.repeat) m.setReduced(!m.reduced);
  });
  window.addEventListener('keyup', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space' || e.key === 'Enter') { if (e.code === 'Space') e.preventDefault(); m.release(); }
    else if (e.key === 'c' || e.key === 'C') m.setCompare(false);
  });
  const fact = $('fact');
  fact.addEventListener('pointerdown', (e) => { e.preventDefault(); m.press(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => fact.addEventListener(n, () => m.release()));
  $('compareBtn').addEventListener('click', () => m.setCompare(!m.compare));
  $('revertBtn').addEventListener('click', () => m.revert());
  $('reduceBtn').addEventListener('click', () => m.setReduced(!m.reduced));
  if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { if (reducedParam == null) m.setReduced(e.matches); });
  // pointer over the loom: a small parallax between the three depth layers (off in reduced motion)
  stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); tpx = ((e.clientX - r.left) / r.width - 0.5) * 2; tpy = ((e.clientY - r.top) / r.height - 0.5) * 2; });
  stage.addEventListener('pointerleave', () => { tpx = 0; tpy = 0; });

  // ---- test hook ----
  window.__slice = {
    getState() {
      const s = C.stats(view.td), hz = C.hauntAt(view.hd);
      return {
        state: m.state, t: m.t, td: view.td, w: m.w, c: m.c, haunt: m.haunt, hauntShown: view.hd, compare: m.compare, reduced: m.reduced, frame,
        persisted: store.get(KEY), extracted: s.extracted, rerouted: s.rerouted, movers: s.movers, total: s.total,
        stitch: hz.stitch, hand: hz.hand, reach: hz.reach, back: hz.back, name: hz.name, gutterLen: parseFloat($('gutterThread').style.height) || 0,
        factNewClip: getComputedStyle($('factNew')).clipPath, wipe: parseFloat(getComputedStyle(root).getPropertyValue('--wipe')),
        frameMs: { avg: ftN ? ftSum / ftN : 0, max: ftMax, n: ftN },
      };
    },
    fingerprint() {
      fpG.drawImage(stage, 0, 0, 32, 17); const d = fpG.getImageData(0, 0, 32, 17).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
      return out;
    },
    // ids with node positions at the shown t, plus roles and lift
    threadSnapshot() {
      return C.threadsAt(view.td).map((x) => ({ id: x.id, layer: x.layer, oldRole: x.oldRole, newRole: x.newRole, role: x.role, mover: x.mover, z: x.zMax, re: x.re, pull: x.pull, pts: x.pts.slice() }));
    },
    resetFrameStats() { ftSum = 0; ftMax = 0; ftN = 0; },
    setProgress(v) { m.setProgress(v); },
    forceHaunt(x) { m.forceHaunt(x); },
    setCompare(b) { m.setCompare(b); },
  };
  void snapT;
  requestAnimationFrame(tick);
})();
