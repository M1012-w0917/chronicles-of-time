// V5 app: wires the machine to the stage and the book. window.__slice exposes getState/fingerprint/setProgress for tests.
(function () {
  'use strict';
  const C = V5Core, P = V5Paint;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const KEY = 'v5.world';

  const stage = $('stage'), g = stage.getContext('2d');
  const ink = $('ink'), inkG = ink.getContext('2d');
  const fpC = P.mk(32, 18), fpG = fpC.getContext('2d', { willReadFrequently: true });
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

  let time = frozen ? 5 : 0, last = performance.now(), frame = 0, hv = C.hauntState(0), lightW = 0, lx = 640, lastNote = '', ftSum = 0, ftMax = 0, ftN = 0;

  // ink: blots bleeding out along the fact line, seeded so the same blot grows
  function drawInk(a) {
    inkG.clearRect(0, 0, ink.width, ink.height);
    if (a <= 0.01) return;
    for (let i = 0; i < 46; i++) {
      const at = C.hash(i, 61) * 0.8, k = C.smooth((a - at) / 0.25); if (k <= 0) continue;
      const x = 10 + C.hash(i, 62) * (ink.width - 20), y = 24 + C.hash(i, 63) * 34, r = (4 + C.hash(i, 64) * 14) * k;
      const gr = inkG.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(25,20,40,' + (0.3 * k) + ')'); gr.addColorStop(1, 'rgba(25,20,40,0)');
      inkG.fillStyle = gr; inkG.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function render() {
    const v = m.view(), td = v.td, c = C.smooth(m.c);
    const h = C.hauntState(m.haunt);
    hv = { shade: h.shade * (1 - c), lightMove: h.lightMove * (1 - c), arm: h.arm, tug: h.tug, mismatch: h.mismatch };
    lightW = C.lightWriting(m.w, m.t);
    const out = P.draw(g, { td, time: m.reduced ? 0 : time, lightW, haunt: hv, reduced: m.reduced });
    lx = out.LX;
    const nTxt = C.span(td, 0.04, 0.34);
    drawInk(m.t > 0 ? 1 - 0.8 * nTxt : m.w);
    root.style.setProperty('--n', nTxt.toFixed(4)); root.style.setProperty('--w', m.w.toFixed(4)); root.style.setProperty('--h', hv.shade.toFixed(3));
    body.dataset.state = m.state; body.dataset.reduced = String(m.reduced); body.dataset.compare = String(m.compare);
    $('stateTag').textContent = m.state;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare)); $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    const note = hv.shade > 0.4 && hv.mismatch ? '1' : '0';
    if (note !== lastNote) { lastNote = note; $('note').hidden = note === '0'; }
    frame++;
  }

  function persist() {
    if (frozen) return;
    if (m.state === 'NEW' || m.state === 'HAUNT') store.set(KEY, 'new'); else if (m.state === 'OLD') store.del(KEY);
  }

  function tick(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { time += dt / 1000; m.step(dt); persist(); }
    const t0 = performance.now();
    render();
    const ft = performance.now() - t0; ftSum += ft; ftN++; if (ft > ftMax) ftMax = ft;
    requestAnimationFrame(tick);
  }

  // ---- input ----
  window.addEventListener('keydown', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn) return; // let focused buttons handle Space/Enter natively
    if (e.code === 'Space' || (e.key === 'Enter' && e.target === $('fact'))) { e.preventDefault(); if (!e.repeat) m.press(); }
    else if (e.key === 'c' || e.key === 'C') { if (!e.repeat) m.setCompare(true); }
    else if (e.key === 'z' || e.key === 'Z') m.revert();
  });
  window.addEventListener('keyup', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
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

  // ---- test hook ----
  window.__slice = {
    getState() {
      const v = m.view(), mt = C.metrics(v.td), tips = P.rodTips();
      return {
        state: m.state, t: m.t, td: v.td, w: m.w, c: m.c, haunt: m.haunt, compare: m.compare, reduced: m.reduced, frame,
        persisted: store.get(KEY), lightX: lx, lightW, shade: hv.shade, shadeLight: hv.lightMove, tug: hv.tug, arm: hv.arm,
        keeperRod: tips && tips.K ? tips.K.slice() : null, metrics: mt,
        factNew: getComputedStyle($('factNew')).opacity, factOld: getComputedStyle($('factOld')).opacity,
        noteVisible: !$('note').hidden, frameMs: { avg: ftN ? ftSum / ftN : 0, max: ftMax, n: ftN },
      };
    },
    // 32x18 luminance of the live stage canvas
    fingerprint() {
      fpG.drawImage(stage, 0, 0, 32, 18); const d = fpG.getImageData(0, 0, 32, 18).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
      return out;
    },
    resetFrameStats() { ftSum = 0; ftMax = 0; ftN = 0; },
    setProgress(v) { m.setProgress(v); },
    forceHaunt(x) { m.forceHaunt(x); },
    setCompare(b) { m.setCompare(b); },
  };
  requestAnimationFrame(tick);
})();
