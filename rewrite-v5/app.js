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
  const xf = P.mk(P.W, P.H), xfG = xf.getContext('2d');
  const fpC = P.mk(32, 18), fpG = fpC.getContext('2d', { willReadFrequently: true });
  const body = document.body, root = document.documentElement;
  const sur = $('sur'), surG = sur.getContext('2d');
  const CJK_FAMILY = getComputedStyle(root).getPropertyValue('--cjk').trim() || 'serif';
  // surtitle: real CJK font when the system has one, authored stroke glyphs otherwise. ?cjk=strokes or ?cjk=font forces a mode.
  const surMode = q.get('cjk') === 'strokes' ? 'strokes' : q.get('cjk') === 'font' ? 'font' : (V5Cjk.detect(CJK_FAMILY) ? 'font' : 'strokes');
  body.dataset.cjk = surMode;
  const SUR = {
    OLD: ['改写前', 'Before the rewrite'], WRITING: ['落笔', 'Pen down'], RECONSTRUCTING: ['重构中', 'Reconstructing'], NEW: ['新世界', 'The new world'],
    HAUNT: ['因果反常 守门人 0 · 影 1', 'Causality broken: gatekeepers 0, shades 1'], COMPARE: ['对照旧世界', 'Comparing with the old world'], REVERTING: ['撤回', 'Reverting'],
  };
  let surKey = '', surNow = SUR.OLD;

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

  let time = frozen ? 14 : 0, last = performance.now(), frame = 0, hv = C.hauntState(0), lightW = 0, lx = 640, lastNote = '', ftSum = 0, ftMax = 0, ftN = 0;

  // ink: blots bleeding out along the fact line, seeded so the same blot grows
  function drawInk(a, pen) {
    inkG.clearRect(0, 0, ink.width, ink.height);
    if (a <= 0.01) return;
    if (pen) { // the wet line under the nib: it runs along the fact as the pen is held down
      const x1 = 8 + (ink.width - 16) * C.smooth(a); inkG.save(); inkG.lineCap = 'round'; inkG.strokeStyle = 'rgba(30,14,40,0.85)'; inkG.lineWidth = 3.4;
      inkG.beginPath(); inkG.moveTo(8, 70); for (let x = 8; x <= x1; x += 6) inkG.lineTo(x, 70 + Math.sin(x * 0.07) * 1.6); inkG.stroke(); inkG.restore();
    }
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
    // reduced motion: no travel. The old and new stages are cross-faded in place, the lamp does not swing, the shade does not tug the rod.
    hv = { shade: h.shade * (1 - c), lightMove: h.lightMove * (1 - c), arm: h.arm * (1 - c), tug: m.reduced ? 0 : h.tug * (1 - c), mismatch: h.mismatch };
    lightW = m.reduced ? 0 : C.lightWriting(m.w, m.t);
    let out;
    if (m.reduced && td > 0.002 && td < 0.998) {
      P.draw(xfG, { td: 1, time: 0, lightW, haunt: hv, reduced: true });
      out = P.draw(g, { td: 0, time: 0, lightW, haunt: hv, reduced: true });
      g.save(); g.globalAlpha = C.smooth(td); g.drawImage(xf, 0, 0); g.restore();
    } else out = P.draw(g, { td, time: m.reduced ? 0 : time, lightW, haunt: hv, reduced: m.reduced });
    lx = out.LX;
    const nTxt = C.span(td, 0.04, 0.34);
    drawInk(m.t > 0 ? 1 - 0.8 * nTxt : m.w, m.t === 0);
    if (frame < 3) placeSur();
    root.style.setProperty('--n', nTxt.toFixed(4)); // the pen and hold bar belong to the writing: they lift off as the rewrite starts and stay up in NEW and HAUNT
    const wShow = m.state === 'WRITING' || m.state === 'OLD' ? m.w : Math.min(m.w, 1 - C.span(m.t, 0.1, 0.4));
    root.style.setProperty('--w', wShow.toFixed(4)); root.style.setProperty('--h', hv.shade.toFixed(3));
    body.dataset.state = m.state; body.dataset.reduced = String(m.reduced); body.dataset.compare = String(m.compare);
    $('stateTag').textContent = m.state;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare)); $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    const note = hv.shade > 0.4 && hv.mismatch ? '1' : '0';
    if (note !== lastNote) { lastNote = note; $('note').hidden = note === '0'; }
    let sk = m.state; if (m.c > 0.5) sk = 'COMPARE'; else if (sk === 'HAUNT' && note === '0') sk = 'NEW';
    if (sk !== surKey) { surKey = sk; surNow = SUR[sk]; drawSur(); }
    frame++;
  }

  // the surtitle plaque sits on the stage lip, under the scrims; it is its own canvas so stage pixels stay a pure function of t
  function drawSur() {
    const W = sur.width, H = sur.height, size = 34, opt = { strokes: surMode === 'strokes', family: CJK_FAMILY, color: '#f6dca0' };
    surG.clearRect(0, 0, W, H);
    surG.font = '19px Georgia, "Times New Roman", serif'; const ew = surG.measureText(surNow[1]).width, zw = V5Cjk.measure(surG, surNow[0], size, opt), gap = 22, tw = zw + gap + ew, x0 = (W - tw) / 2;
    const pg = surG.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, 'rgba(14,5,2,0.86)'); pg.addColorStop(1, 'rgba(30,10,4,0.86)');
    surG.fillStyle = pg; surG.fillRect(x0 - 26, 6, tw + 52, H - 12); surG.strokeStyle = 'rgba(216,168,80,0.75)'; surG.lineWidth = 1.5; surG.strokeRect(x0 - 26, 6, tw + 52, H - 12);
    V5Cjk.text(surG, surNow[0], x0, H / 2, size, opt);
    surG.fillStyle = '#d8b878'; surG.textBaseline = 'middle'; surG.font = '19px Georgia, "Times New Roman", serif'; surG.fillText(surNow[1], x0 + zw + gap, H / 2 + 1);
    sur.dataset.zh = surNow[0]; sur.dataset.en = surNow[1]; sur.setAttribute('aria-label', '字幕 ' + surNow[0] + ' ' + surNow[1]);
  }
  function placeSur() { // pin the overlay to the stage lip (stage y 588..652 of 720) whatever the stage's letterboxing
    const r = stage.getBoundingClientRect(), p = stage.parentElement.getBoundingClientRect(), k = r.width / 1280;
    Object.assign(sur.style, { left: (r.left - p.left) + 'px', top: (r.top - p.top + 588 * k) + 'px', width: r.width + 'px', height: (64 * k) + 'px' });
  }
  window.addEventListener('resize', placeSur); placeSur();

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
    const t0 = performance.now();
    render();
    const ft = performance.now() - t0; ftSum += ft; ftN++; if (ft > ftMax) ftMax = ft;
    requestAnimationFrame(tick);
  }

  // ---- input ----
  window.addEventListener('keydown', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return; // a focused button keeps native Space/Enter; Z and C still work
    if (e.code === 'Space' || (e.key === 'Enter' && e.target === $('fact'))) { e.preventDefault(); if (!e.repeat) m.press(); }
    else if (e.key === 'c' || e.key === 'C') { if (!e.repeat) m.setCompare(true); }
    else if (e.key === 'z' || e.key === 'Z') m.revert();
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

  // ---- test hook ----
  window.__slice = {
    getState() {
      const v = m.view(), mt = C.metrics(v.td), tips = P.rodTips();
      return {
        state: m.state, t: m.t, td: v.td, w: m.w, c: m.c, haunt: m.haunt, compare: m.compare, reduced: m.reduced, frame,
        persisted: store.get(KEY), lightX: lx, lightW, shade: hv.shade, shadeLight: hv.lightMove, tug: hv.tug, arm: hv.arm,
        keeperRod: tips && tips.K ? tips.K.slice() : null, metrics: mt, tether: P.tether(),
        sur: { zh: sur.dataset.zh, en: sur.dataset.en, mode: surMode, cjkFont: V5Cjk.detect(CJK_FAMILY) },
        dim: parseFloat(getComputedStyle($('dim')).opacity), bookBox: (() => { const r = $('book').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
        stageBox: (() => { const r = stage.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })(),
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
    // mean luminance of a stage-space rectangle of the live canvas
    cropLum(x, y, w, h) {
      const d = g.getImageData(x, y, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; return s / (d.length / 4);
    },
    resetFrameStats() { ftSum = 0; ftMax = 0; ftN = 0; },
    setProgress(v) { m.setProgress(v); },
    forceHaunt(x) { m.forceHaunt(x); },
    setCompare(b) { m.setCompare(b); },
  };
  requestAnimationFrame(tick);
})();
