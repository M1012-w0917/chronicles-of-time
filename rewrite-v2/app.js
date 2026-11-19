// V2 view: builds the diorama out of DOM boxes and drives it from one model (V2Core). No canvas.
(function () {
  'use strict';
  const C = window.V2Core;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const world = $('world'), cam = $('cam'), stage = $('stage'), dock = $('dock');
  const debug = ['t', 'state', 'haunt', 'w', 'reduced'].some((k) => q.has(k));
  const mql = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const hsl = (h, s, l, a) => 'hsl(' + h + ' ' + s + '% ' + Math.max(0, Math.min(100, l)) + '%' + (a == null ? '' : ' / ' + a) + ')';
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };

  // an extruded box: five lit faces, height driven by --k (1 = full, 0 = flat in the page)
  function box(parent, o) {
    const b = el('div', 'bx ' + (o.cls || ''), parent, '<i class="f t"></i><i class="f s"></i><i class="f n"></i><i class="f w"></i><i class="f e"></i>' + (o.shadow ? '<i class="sh"></i>' : ''));
    const st = b.style;
    st.transform = 'translate3d(' + o.x + 'px,' + o.y + 'px,' + (o.z || 0) + 'px)' + (o.rot ? ' ' + o.rot : '');
    st.setProperty('--w', o.w); st.setProperty('--d', o.d); st.setProperty('--h', o.h); st.setProperty('--k', o.k == null ? 1 : o.k);
    if (o.c) { st.setProperty('--ct', o.c.t); st.setProperty('--cs', o.c.s); st.setProperty('--cn', o.c.n); st.setProperty('--cw', o.c.w); st.setProperty('--ce', o.c.e); }
    if (o.win) st.setProperty('--win', o.win);
    return b;
  }
  const wallColors = (w, roof) => ({
    t: hsl(roof[0], roof[1], roof[2]), s: hsl(w[0], w[1], w[2] - 2), n: hsl(w[0], w[1], w[2] - 12),
    w: hsl(w[0], w[1] + 2, w[2] + 7), e: hsl(w[0], w[1], w[2] - 20),
  });

  // ---------- static scene: table, lamp-lit book ----------
  el('div', 'tbl', world);
  el('div', 'tblshadow', world);
  box(world, { cls: 'cover', x: -550, y: -350, z: -26, w: 1100, d: 700, h: 12 });
  box(world, { cls: 'pg pgL', x: -503, y: -320, z: -14, w: 500, d: 640, h: 14 });
  box(world, { cls: 'pg pgR', x: 3, y: -320, z: -14, w: 500, d: 640, h: 14 });
  [[-550, -350], [504, -350], [-550, 304], [504, 304]].forEach((p) => box(world, { cls: 'brass', x: p[0], y: p[1], z: -26, w: 46, d: 46, h: 14 }));
  const meadow = el('div', 'meadow', world); meadow.style.setProperty('--o', 0);
  el('div', 'gut', world);
  el('div', 'rib', world);

  // ---------- the model: items from core.buildWorld ----------
  const W = C.buildWorld(1842);
  const parts = { text: null };
  W.items.forEach((it) => {
    if (it.kind === 'ink') {
      const e = el('div', 'ink ' + it.sub + ' ' + it.dir, world);
      e.style.transform = 'translate3d(' + it.x + 'px,' + it.y + 'px,3px)'; e.style.width = it.w + 'px'; e.style.height = it.h + 'px';
      it.el = e;
    } else if (it.kind === 'building') {
      const lit = it.win === 'lit';
      it.el = box(world, { cls: 'b' + (it.hall ? ' hall' : ''), x: it.x, y: it.y, w: it.w, d: it.d, h: it.h, shadow: true,
        c: wallColors(it.wall, it.hall ? [42, 70, 58] : it.roof), win: lit ? 'hsl(42 95% 72%)' : 'hsl(30 28% 36%)' });
    } else if (it.kind === 'stone') {
      it.el = box(world, { cls: 'stone', x: it.x, y: it.y, w: it.w, d: it.d, h: it.h, k: 0, shadow: true,
        c: { t: hsl(120, 6, 60), s: hsl(110, 7, 48), n: hsl(110, 7, 40), w: hsl(115, 7, 56), e: hsl(110, 8, 33) } });
    } else if (it.kind === 'tuft') {
      const t = el('div', 'tuft', world);
      t.style.transform = 'translate3d(' + it.x + 'px,' + it.y + 'px,2px)';
      t.style.setProperty('--k', 0);
      // two crossed paper cut-outs per tuft, each a zigzag of blades (cheap: 2 layers per tuft)
      const pts = []; const nb = it.blades + 2;
      for (let i = 0; i <= nb; i++) { pts.push((i / nb * 100).toFixed(1) + '% 100%'); if (i < nb) pts.push(((i + 0.5) / nb * 100).toFixed(1) + '% ' + (i % 2 ? 0 : 22 + (i % 3) * 12) + '%'); }
      const cp = 'polygon(' + pts.join(',') + ')';
      for (let i = 0; i < 2; i++) {
        const b = el('i', 'bl', t);
        b.style.width = it.size * 1.3 + 'px'; b.style.height = it.size + 'px';
        b.style.left = -it.size * 0.65 + 'px'; b.style.top = -it.size + 'px';
        b.style.clipPath = cp;
        b.style.setProperty('--g', 'linear-gradient(' + hsl(it.hue + i * 6, 40, 58 - i * 8) + ',' + hsl(it.hue + 10, 36, 34) + ')');
        b.style.transform = 'rotateZ(' + (it.rot + i * 90) + 'deg) rotateX(-90deg) scaleY(var(--k))';
      }
      it.el = t; it.vis = true;
    } else if (it.kind === 'person') {
      const t = el('div', 'tok', world);
      t.style.setProperty('--cl', hsl(it.color[0], it.color[1], it.color[2]));
      if (it.hero) el('div', 'ring', t);
      el('div', 'base', t);
      const up = el('div', 'up', t);
      const face = (cls) => '<i class="hd' + (it.head ? ' hat' : '') + '"></i><i class="bd"></i>';
      el('div', 'fc ft', up, face()); el('div', 'fc bk', up, face());
      it.el = t; it.up = up;
    }
  });

  // text lying on the left page, margin note on the right
  const txt = el('div', 'txt', world,
    '<div class="ln old" lang="zh">' + C.FACT.old.zh + '</div><div class="cap">' + C.FACT.old.en + '</div>' +
    '<div class="ln neu" lang="zh">' + C.FACT.neu.zh + '</div><div class="cap capn">' + C.FACT.neu.en + '</div>');
  txt.style.top = '0px'; txt.style.transform = 'translate3d(-474px,214px,4px)';
  const note = el('div', 'note', world,
    '<div class="hw">he remembers · year 42 <span lang="zh">他记得永昌四十二年。</span></div>' +
    '<svg width="400" height="22" viewBox="0 0 400 22"><path d="M2 14 C30 2 60 22 98 10 S160 3 205 13 S280 20 330 9 S380 8 396 12"/></svg>' +
    '<div class="cap">margin note, in no one\'s hand: “He remembers year 42.”</div>');
  note.style.transform = 'translate3d(48px,222px,4px)';

  // the pen: a lacquered barrel with a brass tip, nib at its origin
  const pen = el('div', 'pen', world);
  const penBody = box(pen, { cls: '', x: 16, y: -3.5, z: 0, w: 120, d: 7, h: 7, c: { t: '#2c211c', s: '#1a1210', n: '#1a1210', w: '#3a2c24', e: '#120c0a' } });
  box(pen, { cls: 'brass', x: 0, y: -2, z: 0, w: 18, d: 4, h: 4 });
  box(pen, { cls: 'brass', x: 70, y: -4, z: 0, w: 6, d: 8, h: 8 });

  // ---------- model + camera ----------
  const machine = C.createMachine({ reduced: q.get('reduced') === '1' || (!q.has('reduced') && mql.matches) });
  const cm = { yaw: parseFloat(q.get('yaw') || '-12'), pitch: parseFloat(q.get('pitch') || '54'), zoom: parseFloat(q.get('zoom') || '1'), uy: 0, up: 0, sway: 0 };
  const frozenCam = debug || q.has('yaw') || q.has('pitch');
  const SAVE = 'rewrite-v2.world';
  const store = {
    get() { try { return localStorage.getItem(SAVE); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE, v); } catch (e) { /* storage blocked: fine */ } },
  };

  if (q.has('state')) machine.setState(q.get('state') === 'new' ? 'new' : 'old');
  else if (q.has('t')) machine.scrub(parseFloat(q.get('t')));
  else if (store.get() === 'new') machine.restore('new');
  if (q.has('w')) machine.setWrite(parseFloat(q.get('w')));
  if (q.has('haunt')) machine.forceHaunt(parseFloat(q.get('haunt')));
  if (machine.reduced) document.body.classList.add('reduced');

  // ---------- render ----------
  const last = { yaw: null, key: '' };
  let ghostRaf = 0;
  const setV = (e, name, v) => e.style.setProperty(name, v);

  function crossfade() {
    document.querySelectorAll('.ghost').forEach((g) => g.remove());
    const g = world.cloneNode(true); g.removeAttribute('id'); g.className = 'ghost';
    cam.appendChild(g);
    const t0 = performance.now();
    cancelAnimationFrame(ghostRaf);
    const tick = (now) => {
      const f = Math.min(1, (now - t0) / 700);
      g.style.setProperty('--fade', (1 - f).toFixed(3));
      if (f < 1) ghostRaf = requestAnimationFrame(tick); else g.remove();
    };
    ghostRaf = requestAnimationFrame(tick);
  }

  function render(force) {
    const v = machine.view();
    const td = v.td, hs = C.hauntState(v.haunt);
    const yaw = cm.yaw + cm.uy + cm.sway;
    const pitch = Math.max(28, Math.min(80, cm.pitch + cm.up));
    const vw = window.innerWidth, vh = window.innerHeight;
    const sc = Math.min(vw / 1230, vh / 900) * cm.zoom;
    cam.style.transform = 'scale(' + sc.toFixed(4) + ') rotateX(' + pitch.toFixed(2) + 'deg) rotateZ(' + yaw.toFixed(2) + 'deg)';

    if (machine.reduced) {
      const key = td.toFixed(2) + '|' + (v.haunt > 0.02 ? 1 : 0) + '|' + (machine.w >= 1 ? 1 : machine.w > 0 ? 0.5 : 0) + '|' + machine.c;
      if (last.key && key !== last.key && !force) crossfade();
      last.key = key;
    } else { last.key = ''; document.querySelectorAll('.ghost').forEach((g) => g.remove()); }
    const wq = machine.reduced ? (machine.w >= 1 ? 1 : machine.w > 0 ? 0.5 : 0) * (1 - machine.c) : v.w;

    W.items.forEach((it) => {
      const val = C.itemValue(it, td);
      if (it.kind === 'building' || it.kind === 'stone') {
        const k = it.kind === 'building' ? val : val;
        const gone = k < 0.004;
        if (it.gone !== gone) { it.el.classList.toggle('gone', gone); it.gone = gone; }
        if (!gone && it.k !== k) { setV(it.el, '--k', k.toFixed(4)); it.k = k; }
      } else if (it.kind === 'ink') {
        if (it.k !== val) { setV(it.el, '--p', val.toFixed(4)); it.el.style.display = val > 0.999 ? 'none' : ''; it.k = val; }
      } else if (it.kind === 'tuft') {
        if (it.k !== val) { setV(it.el, '--k', val.toFixed(4)); it.el.style.display = val < 0.004 ? 'none' : ''; it.k = val; }
      } else if (it.kind === 'person') {
        const o = 1 - C.smooth(C.progress(val, 0.7, 0.3));
        it.up.style.transform = 'rotateX(' + (-90 * (1 - val)).toFixed(2) + 'deg)';
        setV(it.el, '--o', o.toFixed(3));
        it.el.style.display = o < 0.01 ? 'none' : '';
        const heading = it.hero ? hs.heading : it.face * 40;
        const s = it.hero ? hs.scale : 1;
        it.el.style.transform = 'translate3d(' + it.x + 'px,' + it.y + 'px,0) rotateZ(' + (-yaw + heading).toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
        if (it.hero) { const ring = it.el.querySelector('.ring'); setV(ring, '--o', hs.ring.toFixed(3)); }
      }
    });
    setV(meadow, '--o', C.meadow(td).toFixed(3));

    const ls = C.lineState(td, wq);
    setV(txt, '--strike', ls.strike.toFixed(3)); setV(txt, '--oldO', ls.oldFade.toFixed(3)); setV(txt, '--nr', ls.newReveal.toFixed(3));
    setV(note, '--m', hs.margin.toFixed(3));

    const ps = C.penState(td, wq);
    const px = -474 + 8 + ps.x * 200, py = 214 + 100;
    pen.style.display = ps.visible < 0.5 ? 'none' : '';
    pen.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py + 'px,' + (3 + ps.lift).toFixed(1) + 'px) rotateZ(-38deg) rotateY(-30deg)';

    // 2D dock
    const showNew = td >= 0.15;
    const f = showNew ? C.FACT.neu : C.FACT.old;
    if (dock.dataset.fact !== (showNew ? 'new' : 'old')) { $('factZh').textContent = f.zh; $('factEn').textContent = f.en; dock.dataset.fact = showNew ? 'new' : 'old'; }
    const echo = v.haunt > 0.5 && td > 0.9;
    dock.dataset.echo = String(echo); dock.dataset.state = machine.state;
    const msg = { OLD: 'The old city stands on the page. Hold to rewrite the line.', WRITING: 'Writing... keep holding. Let go early and the pen lifts.',
      REWRITING: 'The line is set. The city is being rewritten outward from it.', NEW: 'The new world. It persists. Undo (Z) or compare (hold C).',
      UNDOING: 'Undoing: the page remembers the old city.', SCRUB: 'Scrubbing between the two worlds.' }[machine.state];
    if ($('status').textContent !== msg) $('status').textContent = msg;
    $('compareBtn').setAttribute('aria-pressed', String(machine.comparing));
    $('penBtn').classList.toggle('on', machine.state === 'WRITING');
    if (!scrubbing) $('scrub').value = Math.round(machine.t * 1000);
  }

  // ---------- inputs ----------
  let scrubbing = false;
  const press = () => { machine.press(); };
  const release = () => { machine.release(); };
  $('penBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => $('penBtn').addEventListener(n, release));
  $('undoBtn').addEventListener('click', () => machine.undo());
  const cmp = $('compareBtn');
  cmp.addEventListener('pointerdown', (e) => { e.preventDefault(); machine.setCompare(true); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => cmp.addEventListener(n, () => machine.setCompare(false)));
  const sc = $('scrub');
  sc.addEventListener('input', () => { scrubbing = true; machine.scrub(sc.value / 1000); persist(); });
  sc.addEventListener('change', () => { scrubbing = false; });
  const rb = $('reduceBtn');
  const syncReduce = () => { rb.setAttribute('aria-pressed', String(machine.reduced)); document.body.classList.toggle('reduced', machine.reduced); };
  rb.addEventListener('click', () => { machine.setReduced(!machine.reduced); syncReduce(); });
  syncReduce();
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.target && e.target.type === 'range' && (k === ' ' || k === 'enter')) return;
    if (k === ' ' || k === 'enter') { e.preventDefault(); if (!e.repeat) press(); }
    else if (k === 'z') machine.undo();
    else if (k === 'c') machine.setCompare(true);
    else if (k === 'r') rb.click();
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'enter') release();
    else if (k === 'c') machine.setCompare(false);
  });
  window.addEventListener('blur', () => { release(); machine.setCompare(false); });
  // orbit and zoom
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, uy: cm.uy, up: cm.up }; stage.classList.add('drag'); try { stage.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; cm.uy = Math.max(-75, Math.min(75, drag.uy + (e.clientX - drag.x) * 0.25)); cm.up = Math.max(-26, Math.min(26, drag.up - (e.clientY - drag.y) * 0.15)); });
  const endDrag = () => { drag = null; stage.classList.remove('drag'); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); cm.zoom = Math.max(0.6, Math.min(2.2, cm.zoom * (e.deltaY < 0 ? 1.08 : 0.926))); }, { passive: false });
  window.addEventListener('resize', () => render(true));

  // ---------- loop ----------
  let prev = performance.now(), clock = 0, savedAs = machine.settled;
  function persist() { if (machine.settled !== savedAs) { savedAs = machine.settled; if (!debug) store.set(savedAs); } }
  function frame(now) {
    const dt = Math.min(1000, now - prev); prev = now; clock += dt;
    machine.step(dt);
    if (!frozenCam && !machine.reduced) cm.sway = 9 * Math.sin(clock / 1000 * 2 * Math.PI / 42);
    else cm.sway = 0;
    persist();
    render(false);
    requestAnimationFrame(frame);
  }
  render(true);
  requestAnimationFrame((n) => { prev = n; frame(n); });

  if (q.get('autoplay') === '1') {
    setTimeout(press, 1500);
    setTimeout(release, 1500 + C.TIMING.holdMs + 400);
  }

  window.__slice = {
    setProgress(t) { machine.scrub(t); persist(); render(true); },
    getState() {
      const v = machine.view();
      const n = { buildings: 0, people: 0, stones: 0, tufts: 0, ink: 0 };
      W.items.forEach((it) => {
        const val = C.itemValue(it, v.td);
        if (it.kind === 'building' && val > 0.5) n.buildings++;
        if (it.kind === 'person' && val < 0.5) n.people++;
        if (it.kind === 'stone' && val > 0.5) n.stones++;
        if (it.kind === 'tuft' && val > 0.5) n.tufts++;
        if (it.kind === 'ink' && val < 0.5) n.ink++;
      });
      const hero = W.items.find((i) => i.hero);
      return { state: machine.state, t: machine.t, td: v.td, w: machine.w, c: machine.c, haunt: machine.haunt, reduced: machine.reduced,
        heroHeading: C.hauntState(v.haunt).heading, yaw: cm.yaw + cm.uy + cm.sway, pitch: cm.pitch + cm.up, zoom: cm.zoom, counts: n, heroFold: C.itemValue(hero, v.td) };
    },
    setHaunt(h) { machine.forceHaunt(h); render(true); },
    setWrite(w) { machine.setWrite(w); render(true); },
    setReduced(on) { machine.setReduced(on); syncReduce(); render(true); },
    press, release, undo() { machine.undo(); }, compare(on) { machine.setCompare(on); },
  };
})();
