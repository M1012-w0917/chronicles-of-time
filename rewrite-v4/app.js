// V4 app: wires the machine to the desk. window.__slice exposes getState/fingerprint/setProgress for tests.
(function () {
  'use strict';
  const C = V4Core, P = V4Paint;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const KEY = 'v4.world';

  const cam = $('cam'), camG = cam.getContext('2d');
  const wc = P.mk(P.W, P.H), wg = wc.getContext('2d');
  const ph1 = $('ph1').getContext('2d'), ph2 = $('ph2').getContext('2d'), ph3 = $('ph3').getContext('2d'), mapG = $('map').getContext('2d');
  const ink = $('ink'), inkG = ink.getContext('2d');
  const fpC = P.mk(32, 20), fpG = fpC.getContext('2d', { willReadFrequently: true });
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

  let time = frozen ? 5 : 0, last = performance.now(), frame = 0, haunt = C.hauntState(0), lastLogKey = '', jitter = 0;

  // ink: blots bleeding out along the fact line, seeded so the same blot grows
  function drawInk(a) {
    inkG.clearRect(0, 0, ink.width, ink.height);
    if (a <= 0.01) return;
    for (let i = 0; i < 46; i++) {
      const at = C.hash(i, 61) * 0.8, k = C.smooth((a - at) / 0.25); if (k <= 0) continue;
      const x = 10 + C.hash(i, 62) * (ink.width - 20), y = 30 + C.hash(i, 63) * 36, r = (4 + C.hash(i, 64) * 16) * k;
      const gr = inkG.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(25,20,40,' + (0.28 * k) + ')'); gr.addColorStop(1, 'rgba(25,20,40,0)');
      inkG.fillStyle = gr; inkG.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function render() {
    const v = m.view(), td = v.td, c = C.smooth(m.c);
    haunt = C.hauntState(m.haunt);
    const hv = { tape: haunt.tape * (1 - c), figure: haunt.figure, heading: haunt.heading, mismatch: haunt.mismatch };
    const moving = m.state === 'RECONSTRUCTING' || m.state === 'REVERTING';
    jitter = m.reduced ? 0 : m.state === 'WRITING' ? 0.25 + 0.75 * m.w : moving ? 0.25 + 0.2 * Math.sin(time * 9) * Math.sin(time * 9) : 0;
    P.drawWorld(wg, td, m.reduced ? 0 : time); // reduced motion: no ambient water/reed/ripple animation
    P.drawCam(camG, { time, frame, jitter, haunt: hv, reduced: m.reduced, wc, compare: c });
    P.drawPhoto(ph1, wc, 190, 120, 260, 165);
    P.drawPhoto(ph2, wc, 400, 100, 240, 152);
    P.drawPortrait(ph3, td);
    P.drawMap(mapG, td);
    drawInk(m.t > 0 ? 1 : m.w);
    root.style.setProperty('--t', td.toFixed(4)); root.style.setProperty('--w', m.w.toFixed(4)); root.style.setProperty('--h', (m.haunt * (1 - c)).toFixed(4));
    body.dataset.state = m.state; body.dataset.reduced = String(m.reduced); body.dataset.compare = String(m.compare);
    $('stateTag').textContent = m.state;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare)); $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    const rows = C.logAt(td), bad = hv.mismatch && c < 0.5 ? 1 : 0;
    const key = rows.map((r) => (r.rewritten ? 1 : 0)).join('') + bad;
    if (key !== lastLogKey) {
      lastLogKey = key;
      const html = rows.map((r, i) => '<li class="' + (r.rewritten ? 'rw' : '') + '"><span class="ts">' + r.ts + '</span>' + r.text[0] + '<i>' + r.text[1] + '</i></li>');
      if (bad) html.push('<li class="bad"><span class="ts">' + C.HAUNT_LINE.ts + '</span>' + C.HAUNT_LINE.zh + '<i>' + C.HAUNT_LINE.en + '</i></li>');
      $('log').innerHTML = html.join('');
    }
    frame++;
  }

  function persist() {
    if (frozen) return;
    if (m.state === 'NEW' || m.state === 'HAUNT') store.set(KEY, 'new'); else if (m.state === 'OLD') store.del(KEY);
  }

  function tick(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { time += dt / 1000; m.step(dt); persist(); }
    render();
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
      const v = m.view(), qy = C.quay(v.td);
      return {
        state: m.state, t: m.t, td: v.td, w: m.w, c: m.c, haunt: m.haunt, compare: m.compare, reduced: m.reduced, frame,
        persisted: store.get(KEY), jitter, heading: haunt.heading, tape: haunt.tape, mismatch: haunt.mismatch,
        log: C.logAt(v.td).map((r) => r.text[0]), gateOpen: qy.gateOpen, warehouse: qy.warehouse, shoreY: qy.shoreY, photoBlank: 1 - (1 - C.span(v.td, 0.2, 0.8)),
        factNew: getComputedStyle($('factNew')).opacity, cardStrike: getComputedStyle($('cName'), '::after').width,
      };
    },
    // 32x20 luminance of the live monitor canvas
    fingerprint() {
      fpG.drawImage(cam, 0, 0, 32, 20); const d = fpG.getImageData(0, 0, 32, 20).data, out = [];
      for (let i = 0; i < d.length; i += 4) out.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
      return out;
    },
    setProgress(v) { m.setProgress(v); },
    forceHaunt(h) { m.forceHaunt(h); },
    setCompare(b) { m.setCompare(b); },
  };
  requestAnimationFrame(tick);
})();
