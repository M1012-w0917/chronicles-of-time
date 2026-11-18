/* book.js: the book UI and the app loop. The world is the product; the book is the medium that triggers it. */
(function () {
  'use strict';
  var C = window.SliceCore, WORLD = window.SliceWorld;
  var KEY = 'chronicles-of-time.slice.v1';
  var Q = new URLSearchParams(location.search);
  var DEBUG = Q.has('t') || Q.has('state') || Q.has('autoplay') || Q.has('reduced') || Q.has('time');

  function $(id) { return document.getElementById(id); }
  var canvas = $('world'), dock = $('dock'), book = $('book');
  var keyBtn = $('keyBtn'), holdBtn = $('holdBtn'), cancelBtn = $('cancelBtn'), undoBtn = $('undoBtn');
  var compareBtn = $('compareBtn'), scrub = $('scrub'), motionBtn = $('motionBtn'), soundBtn = $('soundBtn');
  var bookToggle = $('bookToggle'), quill = $('quill'), blots = $('blots'), caption = $('caption');
  var pageR = book.querySelector('.page-r');

  var machine = C.createMachine({ rewriteDuration: 9, holdDuration: 1.2, undoDuration: 5.5 });
  var world = WORLD.createWorld(1873);
  var ctx = canvas.getContext('2d', { alpha: false });
  var scratch = document.createElement('canvas'), sctx = scratch.getContext('2d', { alpha: false });

  /* ------------------------------------------------------------ settings */
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var manualReduce = Q.get('reduced') === '1';
  var reduced = mq.matches || manualReduce;
  function applyMotion() {
    reduced = mq.matches || manualReduce;
    machine.rewriteDuration = reduced ? 1.2 : 9;
    machine.undoDuration = reduced ? 1.2 : 5.5;
    motionBtn.setAttribute('aria-pressed', reduced ? 'true' : 'false');
    motionBtn.textContent = reduced ? '已减弱动态' : '减弱动态';
    document.documentElement.classList.toggle('reduced', reduced);
    dirty = true;
  }
  var dirty = true;
  motionBtn.addEventListener('click', function () { manualReduce = !manualReduce; applyMotion(); });
  if (mq.addEventListener) mq.addEventListener('change', applyMotion);

  /* ------------------------------------------------------------ persistence */
  function save(done) { if (DEBUG) return; try { localStorage.setItem(KEY, JSON.stringify({ done: !!done })); } catch (e) { /* file:// may block */ } }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }

  /* ------------------------------------------------------------ view state */
  var pending = false;                 // key phrase swapped to the new wording, not yet written
  var shown = 0, easing = false, comparing = false;
  var pointer = { x: 0, y: 0 }, pointerT = { x: 0, y: 0 };
  var timeNow = 0, lastFrame = 0, blotCount = 0, lastState = 'OLD', savedDone = false;

  /* ------------------------------------------------------------ book DOM from state */
  var oldPhrase = '建于永昌四十二年', newPhrase = '从未建立';
  function setPending(v) {
    pending = v;
    keyBtn.textContent = v ? newPhrase : oldPhrase;
    keyBtn.classList.toggle('pending', v);
    dirtyBook = true;
  }
  var dirtyBook = true;
  keyBtn.addEventListener('click', function () { if (machine.state === 'OLD') setPending(!pending); });
  cancelBtn.addEventListener('click', function () { releaseHold(); setPending(false); });

  function layoutBook(t) {
    var strike = C.smooth(t / 0.12), fade = C.smooth((t - 0.12) / 0.3), nw = C.smooth((t - 0.06) / 0.3);
    pageR.style.setProperty('--strike', strike.toFixed(3));
    pageR.style.setProperty('--oldfade', (1 - 0.62 * fade).toFixed(3));
    pageR.style.setProperty('--new', nw.toFixed(3));
    pageR.classList.toggle('written', t > 0.005);
    keyBtn.disabled = t > 0.005 || machine.state !== 'OLD' && machine.state !== 'WRITING';
  }

  function updateHold(h, active) {
    holdBtn.style.setProperty('--hold', h.toFixed(3));
    holdBtn.classList.toggle('down', active);
    var q = quill.style;
    if (active) {
      var line = $('lineOld').getBoundingClientRect(), pr = pageR.getBoundingClientRect();
      var scale = pr.width / pageR.offsetWidth || 1;
      q.opacity = '1';
      q.transform = 'translate(' + ((line.left - pr.left) / scale + line.width / scale * (0.1 + 0.8 * h)) + 'px,' + ((line.top - pr.top) / scale + line.height / scale * 0.7 + Math.sin(h * 24) * 2) + 'px) rotate(' + (-18 + Math.sin(h * 16) * 3) + 'deg)';
      var want = Math.floor(h * 4);
      while (blotCount < want) {
        var b = document.createElement('i');
        b.style.left = ((line.left - pr.left) / scale + line.width / scale * (0.1 + 0.8 * h) - 3) + 'px';
        b.style.top = ((line.top - pr.top) / scale + line.height / scale * 0.9) + 'px';
        b.style.setProperty('--s', (0.7 + Math.random() * 0.8).toFixed(2));
        blots.appendChild(b); blotCount++;
      }
    } else q.opacity = '0';
  }
  function clearBlots() { blots.textContent = ''; blotCount = 0; }

  /* ------------------------------------------------------------ input */
  function startHold() {
    if (machine.state !== 'OLD' && machine.state !== 'SCRUB') return;
    if (!pending && machine.state === 'OLD') setPending(true);
    if (machine.startHold()) { holdBtn.setAttribute('data-held', 'true'); dirty = true; }
  }
  function releaseHold() { if (machine.releaseHold()) { holdBtn.removeAttribute('data-held'); clearBlots(); } }
  holdBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); holdBtn.setPointerCapture && holdBtn.setPointerCapture(e.pointerId); startHold(); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { holdBtn.addEventListener(n, releaseHold); });
  holdBtn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
  holdBtn.addEventListener('click', function (e) { e.preventDefault(); });

  function doUndo() { if (machine.undo()) { setPending(false); dirty = true; } }
  undoBtn.addEventListener('click', doUndo);
  function setCompare(v) {
    if (comparing === v) return;
    comparing = v; compareBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); easing = true; dirty = true;
  }
  compareBtn.addEventListener('pointerdown', function (e) { compareBtn.setPointerCapture && compareBtn.setPointerCapture(e.pointerId); setCompare(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { compareBtn.addEventListener(n, function () { setCompare(false); }); });
  compareBtn.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setCompare(true); } });
  compareBtn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') setCompare(false); });
  scrub.addEventListener('input', function () { machine.hold = 0; machine.scrub(scrub.value / 1000); easing = false; setPending(false); dirty = true; });

  function setOpen(open) {
    dock.setAttribute('data-open', open ? 'true' : 'false');
    bookToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    bookToggle.firstChild.nodeValue = open ? '收起书 ' : '翻开书 ';
  }
  bookToggle.addEventListener('click', function () { setOpen(dock.getAttribute('data-open') !== 'true'); });

  var heldKeys = {};
  function interactiveTarget(el) { return el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'A'); }
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (k === 'b') { setOpen(dock.getAttribute('data-open') !== 'true'); return; }
    if (k === 'z') { doUndo(); return; }
    if (k === 'c') { setCompare(true); return; }
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && (!interactiveTarget(e.target) || e.target === holdBtn)) {
      e.preventDefault(); heldKeys[e.key] = true; if (dock.getAttribute('data-open') !== 'true') setOpen(true); startHold();
    }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key.toLowerCase() === 'c') setCompare(false);
    if ((e.key === ' ' || e.key === 'Enter') && heldKeys[e.key]) { heldKeys[e.key] = false; releaseHold(); }
  });
  window.addEventListener('blur', function () { releaseHold(); setCompare(false); });
  window.addEventListener('pointermove', function (e) {
    pointerT.x = (e.clientX / window.innerWidth) * 2 - 1; pointerT.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ------------------------------------------------------------ quiet audio (off by default, never autoplays) */
  var audio = null, soundOn = false;
  function buildAudio() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var a = new AC(), len = a.sampleRate * 3, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    var src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    var lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360;
    var g = a.createGain(); g.gain.value = 0;
    var osc = a.createOscillator(); osc.type = 'sine'; osc.frequency.value = 55; var og = a.createGain(); og.gain.value = 0;
    var lfo = a.createOscillator(); lfo.frequency.value = 0.12; var lg = a.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(lp.frequency);
    src.connect(lp); lp.connect(g); g.connect(a.destination); osc.connect(og); og.connect(a.destination);
    src.start(); osc.start(); lfo.start();
    return { ctx: a, lp: lp, g: g, og: og };
  }
  soundBtn.addEventListener('click', function () {
    soundOn = !soundOn;
    if (soundOn && !audio) audio = buildAudio();
    if (audio) soundOn ? audio.ctx.resume() : audio.ctx.suspend();
    soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false'); soundBtn.textContent = soundOn ? '声音 开' : '声音 关';
  });
  function updateAudio(t) {
    if (!audio || !soundOn) return;
    var g = C.smooth(t), now = audio.ctx.currentTime;
    audio.g.gain.setTargetAtTime(0.035 + 0.04 * g, now, 0.3); audio.og.gain.setTargetAtTime(0.012 * g, now, 0.5);
    audio.lp.frequency.setTargetAtTime(300 + 700 * g, now, 0.4);
  }

  /* ------------------------------------------------------------ canvas sizing */
  var cw = 0, ch = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = window.innerWidth, h = window.innerHeight;
    cw = Math.round(w * dpr); ch = Math.round(h * dpr);
    canvas.width = cw; canvas.height = ch; scratch.width = cw; scratch.height = ch;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    scale = Math.max(cw / WORLD.W, ch / WORLD.H);
    ox = (cw - WORLD.W * scale) / 2; oy = (ch - WORLD.H * scale) / 2 - Math.min(0, 0);
    dirty = true;
  }
  window.addEventListener('resize', resize);

  /* ------------------------------------------------------------ frame */
  function frameState(t, extra) {
    var s = {
      t: t, time: timeNow, tension: machine.state === 'WRITING' ? machine.hold : 0, newTime: machine.newTime,
      pointer: reduced ? { x: 0, y: 0 } : pointer, reduced: reduced, motion: reduced ? 0 : 1, parallax: !reduced, grain: !reduced,
      forceFigure: reduced && machine.state === 'NEW' && machine.newTime > 1.0 && t >= 0.999 || !!window.__forceFigure
    };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }
  function drawWorld(c, t, st) { c.setTransform(scale, 0, 0, scale, ox, oy); world.render(c, frameState(t, st)); }
  var lastStageSig = '';
  function render() {
    if (reduced) {
      var st = C.reducedStages(shown), sig = st.a + '|' + st.b + '|' + st.mix.toFixed(3) + '|' + (machine.newTime > 1) + '|' + cw;
      if (sig === lastStageSig && !dirty) return;
      lastStageSig = sig;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawWorld(ctx, st.a);
      if (st.mix > 0.01) {
        drawWorld(sctx, st.b);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = st.mix; ctx.drawImage(scratch, 0, 0); ctx.globalAlpha = 1;
      }
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawWorld(ctx, shown);
    }
    dirty = false;
  }

  function captionFor(t) { return t < 0.5 ? '灰堡市 · 永昌四十二年立' : '灰堡草甸 · 无人定居的记录'; }
  var capSide = -1;
  function updateCaption(t) {
    var side = t < 0.5 ? 0 : 1;
    if (side !== capSide) {
      capSide = side; caption.classList.add('swap');
      setTimeout(function () { caption.textContent = captionFor(t); caption.classList.remove('swap'); }, capSide === 0 && !caption.textContent ? 0 : 450);
    }
  }

  function frame(ts) {
    var dt = Math.min(0.1, (ts - lastFrame) / 1000 || 0.016); lastFrame = ts;
    if (Q.has('time')) timeNow = parseFloat(Q.get('time')) || 0; else timeNow += dt;
    machine.tick(dt);
    // smooth pointer for gaze
    pointer.x += (pointerT.x - pointer.x) * Math.min(1, dt * 3); pointer.y += (pointerT.y - pointer.y) * Math.min(1, dt * 3);
    // displayed progress (compare eases between the two histories)
    var other = machine.t >= 0.5 ? 0 : 1, target = comparing ? other : machine.t;
    if (easing || comparing) {
      shown = C.stepToward(shown, target, dt, reduced ? 2 : 0.45);
      if (!comparing && shown === machine.t) easing = false;
    } else shown = machine.t;
    if (lastState !== machine.state) {
      if (machine.state === 'OLD' && lastState === 'UNDOING') clearBlots();
      if (machine.state === 'REWRITING') { holdBtn.removeAttribute('data-held'); clearBlots(); }
      lastState = machine.state; dirty = true;
    }
    var pt = C.persistTarget(machine.state, savedDone);
    if (pt !== null) { savedDone = pt; save(pt); }
    var st = { t: machine.t, motion: reduced ? 0 : 1 };
    if (!reduced) world.update(dt, st); else if (machine.state !== 'OLD') dirty = true;
    render();
    // DOM
    updateHold(machine.hold, machine.state === 'WRITING');
    layoutBook(shown);
    undoBtn.disabled = machine.t <= 0 || machine.state === 'UNDOING';
    if (document.activeElement !== scrub) scrub.value = Math.round(shown * 1000);
    var echo = machine.state === 'NEW' && shown >= 0.999 && machine.newTime > (reduced ? 1 : 7.5) || (!!window.__forceFigure && shown >= 0.999);
    dock.setAttribute('data-echo', echo ? 'true' : 'false');
    dock.setAttribute('data-state', machine.state);
    updateCaption(shown); updateAudio(shown);
    if (!document.hidden) requestAnimationFrame(frame); else running = false;
  }
  var running = false;
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !running) { running = true; lastFrame = performance.now(); requestAnimationFrame(frame); } });

  /* ------------------------------------------------------------ debug API and boot */
  window.__slice = {
    setProgress: function (t) { easing = false; machine.scrub(t); shown = machine.t; dirty = true; },
    getState: function () { return { state: machine.state, t: machine.t, shown: shown, hold: machine.hold, newTime: machine.newTime, reduced: reduced, pending: pending }; },
    jumpNew: function () { machine.jumpNew(); shown = 1; dirty = true; },
    forceFigure: function (v) { window.__forceFigure = !!v; dirty = true; },
    machine: machine
  };

  resize(); applyMotion();
  if (Q.has('book') && Q.get('book') === '0') setOpen(false);
  if (Q.has('state') && Q.get('state') === 'new') { machine.jumpNew(); shown = 1; }
  else if (Q.has('t')) { machine.scrub(parseFloat(Q.get('t')) || 0); shown = machine.t; }
  else if (!DEBUG) { var s = load(); if (s && s.done) { machine.scrub(1); shown = 1; savedDone = true; } }
  if (Q.get('autoplay') === '1') { setPending(true); machine.autoplay(); }
  if (Q.has('figure')) window.__forceFigure = Q.get('figure') !== '0';
  caption.textContent = ''; capSide = -1;
  running = true; lastFrame = performance.now(); requestAnimationFrame(frame);
})();
