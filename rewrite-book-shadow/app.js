// Book + Shadow app: wires the machine to the page. window.__bs exposes state, fingerprint and light control for tests.
(function () {
  'use strict';
  const C = BSCore, P = BSPaint;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const KEY = 'bs.world';
  const stage = $('stage'), g = stage.getContext('2d'), wrap = $('bookWrap');
  const fpC = P.mk(32, 18), fpG = fpC.getContext('2d', { willReadFrequently: true });
  const body = document.body, root = document.documentElement;

  const mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  const reducedParam = q.get('reduced');
  const m = C.createMachine({ reduced: reducedParam != null ? reducedParam === '1' : !!(mq && mq.matches) });
  const frozen = ['t', 'w', 'state', 'haunt'].some((k) => q.has(k));
  if (q.has('fresh')) store.del(KEY);
  if (q.has('t')) m.setProgress(parseFloat(q.get('t')));
  else if (q.get('state') === 'new' || (!frozen && store.get(KEY) === 'new')) m.setProgress(1);
  if (q.has('w')) { m.state = 'WRITING'; m.w = parseFloat(q.get('w')); }
  if (q.has('haunt')) m.forceHaunt(parseFloat(q.get('haunt')));
  if (q.get('compare') === '1') { m.setCompare(true); m.c = 1; }
  if (q.has('anom')) m.forceAnomaly();
  if (q.get('lit') === '1') m.lit = true;
  if (q.get('flip')) m.flip = parseFloat(q.get('flip'));

  const light = { x: 860, y: 300, tx: 860, ty: 300 };
  if (q.has('lx')) { light.x = light.tx = parseFloat(q.get('lx')); }
  if (q.has('ly')) { light.y = light.ty = parseFloat(q.get('ly')); }
  let time = frozen ? 5 : 0, last = performance.now(), frame = 0, lastShade = null, lastWarp = null, lastTrail = 0, lastNote = '', ftSum = 0, ftMax = 0, ftN = 0;

  const STATE_SR = { RECON: '落笔。纸页正在改写。 Writing. The leaf is being rewritten.', NEW: '新历史已成。这座城从来没有城门,黄昏也没有守门人。 The new history is set. This city never had a gate, and dusk never had a gatekeeper.', OLD: '旧世界。城门每日黄昏关闭,守门人点亮三盏灯。 The old world. The city gate closes every dusk, and the gatekeeper lights three lamps.' };
  let lastState = m.state, lastCur = '', lastAnom = '0';
  function announce(t) { $('sr').textContent = t; }
  function render() {
    const v = m.view(), td = v.td;
    const n = m.reduced ? C.smooth(td) : C.span(td, 0.3, 0.7);
    const glow = m.glow();
    const out = P.draw(g, {
      td, time: m.reduced ? 0 : time, glow, light: { x: light.x, y: light.y }, w: m.w, haunt: v.haunt, flip: m.flip,
      reduced: m.reduced, anomK: m.anomK(), inkA: m.t > 0 ? 1 - 0.8 * C.span(td, 0.04, 0.34) : m.w, pen: m.t > 0 ? 1 - C.span(m.t, 0, 0.1) : (m.w > 0 ? 1 : 0),
    });
    lastShade = out.shade; lastWarp = out.warp; lastTrail = out.trail;
    const fadeText = m.flipping && !m.reduced ? 1 - Math.sin(Math.PI * m.flip) : 1;
    $('factNew').style.opacity = (n * fadeText).toFixed(3); $('factOld').style.opacity = ((1 - n) * fadeText).toFixed(3);
    $('capNew').style.opacity = n.toFixed(3); $('capOld').style.opacity = (1 - n).toFixed(3);
    $('fact').style.opacity = fadeText.toFixed(3);
    root.style.setProperty('--w', (m.state === 'WRITING' || m.state === 'OLD' ? m.w : Math.min(m.w, 1 - C.span(m.t, 0.1, 0.4))).toFixed(4));
    body.dataset.state = m.state; body.dataset.reduced = String(m.reduced); body.dataset.compare = String(m.compare);
    $('stateTag').textContent = m.state;
    $('compareBtn').setAttribute('aria-pressed', String(m.compare)); $('reduceBtn').setAttribute('aria-pressed', String(m.reduced));
    $('turnBtn').disabled = !(m.state === 'HAUNT' && m.haunt > 0.5 && !m.flipping);
    $('waitBtn').disabled = m.state !== 'NEW';
    const an = m.anomaly === 1 ? '1' : '0';
    if (an !== lastAnom) { lastAnom = an; $('anomNote').hidden = an === '0'; if (an === '1') announce('影子答错了方向:它背向烛光倾斜。 The shade answers the wrong way: it leans away from the candle.'); }
    const note = v.haunt > 0.5 ? '1' : '0';
    if (note !== lastNote) { lastNote = note; $('note').hidden = note === '0'; if (note === '1') announce('纸背浮出一个影子。守门人名册 0,纸背的影 1。 A shade has appeared on the back of the leaf. Gatekeepers on the roll 0, shades 1.' ); }
    if (m.state !== lastState) { lastState = m.state; if (STATE_SR[m.state]) announce(STATE_SR[m.state]); }
    const cur = n > 0.5 ? 'factNew' : 'factOld';
    if (cur !== lastCur) { lastCur = cur; $('fact').setAttribute('aria-labelledby', cur); }
    frame++;
  }

  let persisted = null;
  function persist() {
    if (frozen || m.state === persisted) return; persisted = m.state;
    if (m.state === 'NEW') store.set(KEY, 'new'); else if (m.state === 'REVERTING' || m.state === 'OLD') store.del(KEY);
  }

  function tick(now) {
    const dt = Math.min(100, now - last); last = now;
    if (!frozen) { time += dt / 1000; m.step(dt); persist(); }
    const k = 1 - Math.exp(-dt / 140); light.x += (light.tx - light.x) * k; light.y += (light.ty - light.y) * k;
    const t0 = performance.now(); render(); const ft = performance.now() - t0; ftSum += ft; ftN++; if (ft > ftMax) ftMax = ft;
    requestAnimationFrame(tick);
  }

  // ---- input ----
  const setLight = (x, y) => { m.poke(); const nx = C.clamp(x, 150, 1130), ny = C.clamp(y, 100, 600); m.lightMoved(Math.hypot(nx - light.tx, ny - light.ty)); light.tx = nx; light.ty = ny; };
  window.addEventListener('keydown', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space' || (e.key === 'Enter' && e.target === $('fact'))) { e.preventDefault(); if (!e.repeat) m.press(); }
    else if (e.key === 'c' || e.key === 'C') { if (!e.repeat) m.setCompare(true); }
    else if (e.key === 'z' || e.key === 'Z') m.revert();
    else if (e.key === 'p' || e.key === 'P') m.turnPage();
    else if (e.key === 'h' || e.key === 'H') m.summon();
    else if (e.key.indexOf('Arrow') === 0) { e.preventDefault(); const d = { ArrowLeft: [-90, 0], ArrowRight: [90, 0], ArrowUp: [0, -70], ArrowDown: [0, 70] }[e.key]; setLight(light.tx + d[0], light.ty + d[1]); }
    else if (e.key !== 'Tab' && e.key !== 'Shift') m.poke();
  });
  window.addEventListener('keyup', (e) => {
    const onBtn = e.target && e.target.closest && e.target.closest('button');
    if (onBtn && (e.code === 'Space' || e.key === 'Enter')) return;
    if (e.code === 'Space' || e.key === 'Enter') { if (e.code === 'Space') e.preventDefault(); m.release(); }
    else if (e.key === 'c' || e.key === 'C') m.setCompare(false);
  });
  const fact = $('fact');
  fact.addEventListener('pointerdown', (e) => { e.preventDefault(); try { fact.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } m.press(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((nm) => fact.addEventListener(nm, () => m.release()));
  wrap.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); setLight((e.clientX - r.left) / r.width * P.W, (e.clientY - r.top) / r.height * P.H); });
  $('compareBtn').addEventListener('click', () => m.setCompare(!m.compare));
  $('revertBtn').addEventListener('click', () => m.revert());
  $('turnBtn').addEventListener('click', () => m.turnPage());
  $('waitBtn').addEventListener('click', () => m.summon());
  $('reduceBtn').addEventListener('click', () => m.setReduced(!m.reduced));
  if (mq && mq.addEventListener) mq.addEventListener('change', (e) => { if (reducedParam == null) m.setReduced(e.matches); });

  window.__bs = {
    getState() {
      const s = lastShade;
      return {
        state: m.state, t: m.t, td: m.view().td, w: m.w, c: m.c, haunt: m.haunt, flip: m.flip, turns: m.turns, compare: m.compare, reduced: m.reduced, frame,
        persisted: store.get(KEY), glow: m.glow(), light: { x: light.x, y: light.y },
        shade: s ? { x: s.x, y: s.y, toward: s.toward, lean: s.lean, arm: s.arm, castX: s.castX, castY: s.castY, bounds: s.bounds, echo: s.echo } : null,
        anomaly: m.anomaly, anomK: m.anomK(), warp: lastWarp, trail: lastTrail, anomVisible: !$('anomNote').hidden,
        factNew: getComputedStyle($('factNew')).opacity, factOld: getComputedStyle($('factOld')).opacity,
        noteVisible: !$('note').hidden, turnEnabled: !$('turnBtn').disabled, frameMs: { avg: ftN ? ftSum / ftN : 0, max: ftMax, n: ftN },
      };
    },
    fingerprint() { fpG.drawImage(stage, 0, 0, 32, 18); const d = fpG.getImageData(0, 0, 32, 18).data, out = []; for (let i = 0; i < d.length; i += 4) out.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]); return out; },
    setLight(x, y, snap) { setLight(x, y); if (snap) { light.x = light.tx; light.y = light.ty; } },
    setProgress(t) { m.setProgress(t); },
    probe() { const p = P.probe(), d = stage.getContext('2d').getImageData(0, 0, P.W, P.H).data, at = (o) => { let sum = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((Math.round(o.y) + dy) * P.W + Math.round(o.x) + dx) * 4; sum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; } return sum / 9; }; return { hole: at(p.hole), body: at(p.body), pts: p }; },
  };
  requestAnimationFrame(tick);
})();
