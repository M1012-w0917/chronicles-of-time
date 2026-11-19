// V6 app: wires the machine to the cabinet and the book. window.__slice exposes getState/fingerprint/setProgress for tests.
(function () {
  'use strict';
  const C = V6Core, P = V6Paint;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const KEY = 'v6.world';

  const stage = $('stage'), g = stage.getContext('2d');
  const ink = $('ink'), inkG = ink.getContext('2d');
  const fpC = P.mk(32, 17), fpG = fpC.getContext('2d', { willReadFrequently: true });
  const body = document.body, root = document.documentElement;

  const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  const reducedParam = q.get('reduced');
  const m = C.createMachine({ reduced: reducedParam != null ? reducedParam === '1' : !!(mq && mq.matches) });
  const frozen = ['t', 'w', 'state', 'haunt'].some((k) => q.has(k)); // debug params make a deterministic still
  if (q.has('fresh')) store.del(KEY);
  if (q.has('t')) m.setProgress(parseFloat(q.get('t')));
  else if (q.get('state') === 'new' || (!frozen && store.get(KEY) === 'new')) m.setProgress(1);
  if (q.has('w')) { m.state = 'WRITING'; m.w = parseFloat(q.get('w')); }
  if (q.has('haunt')) m.forceHaunt(parseFloat(q.get('haunt')));
  if (q.get('compare') === '1') { m.setCompare(true); m.c = 1; }

  let time = frozen ? 5 : 0, last = performance.now(), frame = 0, phase = 0.3, hv = C.hauntState(0), ftSum = 0, ftMax = 0, ftN = 0;
  let px = 0, py = 0, tpx = 0, tpy = 0, lastNote = '';
  const wipes = [];

  // ink: blots bleeding out along the fact line, seeded so the same blot grows
  function drawInk(a) {
    inkG.clearRect(0, 0, ink.width, ink.height);
    if (a <= 0.01) return;
    for (let i = 0; i < 46; i++) {
      const at = C.hash(i, 61) * 0.8, k = C.smooth((a - at) / 0.25); if (k <= 0) continue;
      const x = 10 + C.hash(i, 62) * (ink.width - 20), y = 24 + C.hash(i, 63) * 34, r = (4 + C.hash(i, 64) * 14) * k;
      const gr = inkG.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(15,30,40,' + (0.3 * k) + ')'); gr.addColorStop(1, 'rgba(15,30,40,0)');
      inkG.fillStyle = gr; inkG.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function render(dt) {
    const v = m.view(), td = v.td, c = C.smooth(m.c);
    const h = C.hauntState(m.haunt);
    // the haunt belongs to the new ecology: comparing with the old one hides it, and undo removes it
    hv = { hand: h.hand, gather: h.gather, run: h.run, name: h.name, note: h.note };
    // water bead phase. Normal: integrates the signed flow, so beads slow, stop and reverse as the vein changes.
    // Reduced: no ambient drift, the phase is tied to t so the beads still travel with the rewrite.
    const flow = C.vein(td).flow;
    if (m.reduced) phase = td * 0.9; else if (!frozen) phase += dt / 1000 * 0.1 * flow * (1 + 1.5 * m.w);
    // gentle oblique-view shift toward the pointer
    if (m.reduced) { px = 0; py = 0; } else { px += (tpx - px) * 0.08; py += (tpy - py) * 0.08; }
    P.draw(g, { td, time: m.reduced ? 0 : time, phase, w: m.reduced ? m.w * 0.4 : m.w, haunt: hv, c, reduced: m.reduced, px, py, now: performance.now(), wipes });
    const nTxt = C.span(td, 0.04, 0.34);
    drawInk(m.t > 0 ? 1 - 0.8 * nTxt : m.w);
    root.style.setProperty('--n', nTxt.toFixed(4)); // the pen and hold bar belong to the writing: they lift off as the rewrite starts
    const wShow = m.state === 'WRITING' || m.state === 'OLD' ? m.w : Math.min(m.w, 1 - C.span(m.t, 0.1, 0.4));
    root.style.setProperty('--w', wShow.toFixed(4));
    body.dataset.state = m.state; body.dataset.reduced = String(m.reduced); body.dataset.compare = String(m.compare);
    $('stateTag').textContent = m.state;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare)); $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    const note = hv.note > 0 && c < 0.5 ? '1' : '0';
    if (note !== lastNote) { lastNote = note; $('note').hidden = note === '0'; }
    frame++;
  }

  // write on state change only: the new world is stored when it settles and cleared the moment a revert starts
  let persistedState = null;
  function persist() {
    if (frozen || m.state === persistedState) return;
    persistedState = m.state;
    if (m.state === 'NEW') store.set(KEY, 'new'); else if (m.state === 'REVERTING' || m.state === 'OLD') store.del(KEY);
  }

  function tick(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { time += dt / 1000; m.step(dt); persist(); }
    for (let i = wipes.length - 1; i >= 0; i--) if (now - wipes[i].t0 > 7000) wipes.splice(i, 1);
    const t0 = performance.now();
    render(frozen ? 0 : dt);
    const ft = performance.now() - t0; ftSum += ft; ftN++; if (ft > ftMax) ftMax = ft;
    requestAnimationFrame(tick);
  }

  // ---- input ----
  window.addEventListener('keydown', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return; // a focused button keeps native Space/Enter; Z, C and R still work
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
  // the pointer wipes the inside of the glass (stage coordinates) and tilts the view a little
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * P.W, y = (e.clientY - r.top) / r.height * P.H;
    tpx = (x / P.W - 0.5) * 2; tpy = (y / P.H - 0.5) * 2;
    const l = wipes[wipes.length - 1];
    if (!l || Math.hypot(l.x - x, l.y - y) > 12) { wipes.push({ x, y, t0: performance.now() }); if (wipes.length > 90) wipes.shift(); }
  });
  stage.addEventListener('pointerleave', () => { tpx = 0; tpy = 0; });

  // ---- test hook ----
  window.__slice = {
    getState() {
      const v = m.view(), mt = C.metrics(v.td);
      return {
        state: m.state, t: m.t, td: v.td, w: m.w, c: m.c, haunt: m.haunt, compare: m.compare, reduced: m.reduced, frame, phase,
        persisted: store.get(KEY), metrics: mt, anchor: C.anchor, wipes: wipes.length,
        hand: hv.hand, gather: hv.gather, name: hv.name, noteVisible: !$('note').hidden,
        factNew: getComputedStyle($('factNew')).opacity, factOld: getComputedStyle($('factOld')).opacity,
        frameMs: { avg: ftN ? ftSum / ftN : 0, max: ftMax, n: ftN },
      };
    },
    // 32x17 luminance of the live cabinet canvas
    fingerprint() {
      fpG.drawImage(stage, 0, 0, 32, 17); const d = fpG.getImageData(0, 0, 32, 17).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
      return out;
    },
    resetFrameStats() { ftSum = 0; ftMax = 0; ftN = 0; },
    setProgress(v) { m.setProgress(v); },
    setHaunt(x) { m.forceHaunt(x); },
    setCompare(b) { m.setCompare(b); },
  };
  requestAnimationFrame(tick);
})();
