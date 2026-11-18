/* world.js: one deterministic procedural city, rendered on canvas 2D from a single world-state model.
   Every entity reads the same progress t (0 = city of Ashmere, 1 = never founded) through its own
   erasure threshold, so the frames are the same place being rewritten, not two images crossfaded. */
(function () {
  'use strict';
  var C = window.SliceCore;
  var W = 1600, H = 900, M = 80;               // logical size, cache side margin
  var PEN = { x: 260, y: 840 };                // where the pen touches the world
  var WATER_TOP = 598, WATER_BOT = 676, BANK_TOP = 462;
  var FONT = '"Songti SC","Noto Serif CJK SC","STKaiti",Georgia,serif';

  var smooth = C.smooth, clamp = C.clamp, lerp = C.lerp;
  function waveAt(x, y) { return Math.min(1, Math.hypot(x - PEN.x, (y - PEN.y) * 1.5) / 1500); }
  function mixc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function rgb(a, al) {
    return (al === undefined || al >= 1) ? 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')'
      : 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al.toFixed(3) + ')';
  }
  function dark(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------------------------------------------------------- palettes */
  var SKY_OLD = { top: [34, 28, 66], mid: [150, 76, 98], hor: [244, 156, 88] };
  var SKY_NEW = { top: [22, 32, 48], mid: [84, 102, 120], hor: [186, 184, 172] };
  var COLD = [70, 82, 104];
  var WALLS = [[150, 92, 66], [172, 122, 84], [122, 84, 72], [142, 132, 122], [98, 102, 116], [168, 140, 102], [112, 72, 64]];
  var ROOFS = [[62, 44, 46], [78, 58, 54], [48, 52, 66], [90, 52, 44]];

  function palette(g) {
    var P = {};
    P.top = mixc(SKY_OLD.top, SKY_NEW.top, g);
    P.mid = mixc(SKY_OLD.mid, SKY_NEW.mid, g);
    P.hor = mixc(SKY_OLD.hor, SKY_NEW.hor, g);
    P.haze = mixc(mixc(P.hor, P.mid, 0.35), [120, 110, 120], 0.1);
    P.warm = 1 - g;                          // strength of lamplight / dusk fire
    P.ink = [18, 12, 20];
    return P;
  }

  /* ---------------------------------------------------------------- build */
  function createWorld(seed) {
    var rnd = C.mulberry32(seed || 1873);
    function R(a, b) { return a + (b - a) * rnd(); }
    function pick(arr) { return arr[(rnd() * arr.length) | 0]; }

    /* ---- static glow sprite */
    var glow = mk(64, 64);
    (function () {
      var g = glow.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,214,140,1)'); gr.addColorStop(0.25, 'rgba(255,170,80,0.5)');
      gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    })();

    /* ---- texture patterns */
    var brick = mk(48, 48);
    (function () {
      var g = brick.getContext('2d');
      for (var i = 0; i < 420; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + R(0.03, 0.12).toFixed(2) + ')' : 'rgba(255,220,180,' + R(0.02, 0.08).toFixed(2) + ')';
        g.fillRect(rnd() * 48, rnd() * 48, R(1, 3), R(1, 2));
      }
      g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 1;
      for (var y = 0; y < 48; y += 6) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(48, y + 0.5); g.stroke(); }
    })();
    var grain = mk(220, 220);
    (function () {
      var g = grain.getContext('2d'), id = g.createImageData(220, 220), d = id.data;
      for (var i = 0; i < d.length; i += 4) { var v = 110 + rnd() * 90; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(id, 0, 0);
    })();
    var paperTex = null;

    /* ---- sky: stars, clouds, hills */
    var stars = [];
    for (var i = 0; i < 150; i++) stars.push({ x: R(-40, W + 40), y: R(0, 330) * R(0.4, 1), r: R(0.4, 1.4), ph: R(0, 6.28), thr: rnd() });
    var cloudDefs = [];
    for (i = 0; i < 9; i++) {
      var cl = { x: R(0, W), y: R(60, 330), w: R(180, 420), puffs: [] };
      for (var k = 0; k < 16; k++) cl.puffs.push({ dx: R(-0.5, 0.5) * cl.w, dy: R(-0.12, 0.1) * cl.w * 0.4, r: R(0.1, 0.22) * cl.w * 0.55 });
      cloudDefs.push(cl);
    }
    function cloudLayer(top, bottom, density) {
      var c = mk(W, 380), g = c.getContext('2d');
      cloudDefs.forEach(function (cl) {
        [0, -W].forEach(function (off) {
          cl.puffs.forEach(function (p) {
            var x = cl.x + p.dx + off, y = cl.y + p.dy, rg = g.createRadialGradient(x, y, 0, x, y, p.r);
            rg.addColorStop(0, 'rgba(255,255,255,' + density + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, p.r * 1.7, p.r * 0.8, 0, 0, 6.3); g.fill();
          });
        });
      });
      g.globalCompositeOperation = 'source-atop';
      var lg = g.createLinearGradient(0, 40, 0, 380);
      lg.addColorStop(0, rgb(top)); lg.addColorStop(1, rgb(bottom));
      g.fillStyle = lg; g.fillRect(0, 0, W, 380);
      return c;
    }
    var cloudsOld = cloudLayer([196, 130, 130], [255, 150, 80], 0.5);
    var cloudsNew = cloudLayer([124, 134, 148], [200, 192, 176], 0.42);

    function ridge(base, amp, f1, f2, ph) {
      var pts = [];
      for (var x = -120; x <= W + 120; x += 16) pts.push([x, base - amp * (0.55 * Math.sin(x * f1 + ph) + 0.3 * Math.sin(x * f2 + ph * 2.3) + 0.15 * Math.sin(x * 0.07 + ph))]);
      return pts;
    }
    var hills = [
      { pts: ridge(404, 34, 0.0042, 0.011, 1.2), hz: 0.78, par: 0.18 },
      { pts: ridge(430, 26, 0.0061, 0.016, 4.1), hz: 0.58, par: 0.28 },
      { pts: ridge(448, 13, 0.0085, 0.021, 2.4), hz: 0.4, par: 0.36 }
    ];
    // tiny hill villages: old-world only, far lights
    var hillLights = [];
    for (i = 0; i < 26; i++) hillLights.push({ x: R(80, W - 80), y: R(436, 452), thr: R(0.05, 0.4) });

    /* ---- buildings */
    var LAYERS = [
      { base: 480, hmin: 46, hmax: 120, wmin: 28, wmax: 64, hz: 0.66, par: 0.42, n: 17 },
      { base: 534, hmin: 70, hmax: 170, wmin: 40, wmax: 84, hz: 0.38, par: 0.62, n: 14 },
      { base: 592, hmin: 98, hmax: 222, wmin: 62, wmax: 120, hz: 0.12, par: 0.82, n: 10 }
    ];
    var buildings = [];
    function addBuilding(l, x, w, h, special) {
      var L = LAYERS[l], b = { layer: l, x: x, w: w, h: h, base: L.base, special: special || null };
      b.top = b.base - h;
      b.roof = special ? 3 : pick([0, 1, 1, 2]);
      b.rh = b.roof === 0 ? 5 : b.roof === 1 ? Math.min(34, w * 0.32) : b.roof === 2 ? 15 : 62;
      b.wall = pick(WALLS); b.rcol = pick(ROOFS);
      b.chim = (!special && rnd() < 0.6) ? { x: R(0.15, 0.75) * w, h: R(14, 26) } : null;
      b.j = rnd();
      b.wave = waveAt(x + w / 2, L.base);
      b.jag = []; for (var q = 0; q < 12; q++) b.jag.push(R(-1, 1));
      b.cols = Math.max(1, Math.floor((w - 8) / 15)); b.rows = Math.max(1, Math.floor((h - b.rh - 16) / 22));
      b.wins = [];
      for (var r = 0; r < b.rows; r++) for (var c = 0; c < b.cols; c++)
        b.wins.push({ r: r, c: c, lit0: rnd() < 0.68, thr: R(0.04, 0.5), ph: R(0, 6.3) });
      buildings.push(b);
    }
    LAYERS.forEach(function (L, l) {
      var sp = 1760 / L.n;
      for (var q = 0; q < L.n; q++) {
        var w = R(L.wmin, L.wmax), h = R(L.hmin, L.hmax);
        if (l === 1 && q === 7) continue;                    // room for the clock tower
        addBuilding(l, -80 + q * sp + R(-0.2, 0.2) * sp, w, h);
      }
    });
    addBuilding(1, 748, 80, 300, 'clock');
    buildings.sort(function (a, b) { return a.layer - b.layer || a.base - b.base; });

    /* ---- lamps */
    var lamps = [];
    for (i = 0; i < 7; i++) lamps.push({ x: 130 + i * 235 + R(-30, 30), y: 716 + R(-4, 6), s: 1.05, thr: R(0.1, 0.34), side: rnd() < 0.5 ? 1 : -1 });
    for (i = 0; i < 5; i++) lamps.push({ x: 150 + i * 330 + R(-40, 40), y: 606, s: 0.5, thr: R(0.1, 0.34), side: rnd() < 0.5 ? 1 : -1 });
    lamps.forEach(function (m) { m.wave = waveAt(m.x, m.y); m.j = rnd(); m.ph = R(0, 6.3); });

    /* ---- people */
    var people = [];
    function addPerson(y, far) {
      var s = far ? 0.3 : 0.62 + (y - 700) / 200 * 0.7;
      var p = { x: R(-40, W + 40), y: y, s: s, v: R(14, 34) * (rnd() < 0.5 ? -1 : 1) * (far ? 0.4 : 1) * s * 1.2,
        ph: R(0, 6.3), variant: (rnd() * 5) | 0, tone: R(0.8, 1.15), freeze: R(0.06, 0.3), lookUp: rnd() < 0.24, far: far };
      p.x0 = p.x; p.wave = waveAt(p.x0, y); p.j = rnd(); p.dir = p.v < 0 ? -1 : 1;
      people.push(p);
    }
    for (i = 0; i < 20; i++) addPerson(R(704, 872), false);
    for (i = 0; i < 5; i++) addPerson(R(603, 612), true);
    var cart = { x: 520, y: 782, s: 1.1, v: 9, j: 0.4, freeze: 0.14 };
    cart.x0 = cart.x; cart.wave = waveAt(cart.x, cart.y);

    /* ---- boats */
    var boats = [];
    for (i = 0; i < 3; i++) boats.push({ x: 300 + i * 420 + R(-60, 60), y: 628 + i * 10 + R(-4, 6), w: R(90, 130), v: R(5, 11) * (rnd() < 0.5 ? -1 : 1), j: rnd(), ph: R(0, 6.3) });
    boats.forEach(function (b) { b.x0 = b.x; b.wave = waveAt(b.x, b.y); b.top = b.y - 44; b.base = b.y + 12; b.jag = buildings[0].jag; b.h = 56; b.dir = b.v < 0 ? -1 : 1; });

    /* ---- bridge: three spans, one entity each */
    var bridge = [];
    for (i = 0; i < 3; i++) {
      var bx = 1040 + i * 150;
      bridge.push({ x: bx, w: 150, top: 580, base: 668, h: 88, wave: waveAt(bx + 75, 640), j: rnd(), jag: buildings[1].jag });
    }

    /* ---- birds */
    var birds = [];
    for (i = 0; i < 16; i++) birds.push({ x: R(0, W), y: R(120, 330), v: R(18, 34), ph: R(0, 6.3), s: R(0.7, 1.3), fl: i < 9 ? 0 : 1 });

    /* ---- grass and reeds */
    var blades = [];
    function addBlades(n, y0, y1, hmin, hmax) {
      for (var q = 0; q < n; q++) {
        var y = R(y0, y1);
        blades.push({ x: R(-60, W + 60), y: y, h: R(hmin, hmax) * (0.6 + (y - y0) / (y1 - y0) * 0.7), ph: R(0, 6.3), c: (rnd() * 3) | 0, j: rnd() });
      }
    }
    addBlades(160, 470, 600, 6, 14); addBlades(150, 686, 760, 10, 22); addBlades(260, 760, 900, 16, 40);
    blades.forEach(function (b) { b.wave = waveAt(b.x, b.y); });
    var reeds = [];
    for (i = 0; i < 90; i++) {
      var far = i < 45;
      reeds.push({ x: R(-60, W + 60), y: far ? R(596, 606) : R(670, 684), h: R(30, 70) * (far ? 0.7 : 1.1), ph: R(0, 6.3), head: rnd() < 0.55, j: rnd() });
      reeds[i].wave = waveAt(reeds[i].x, reeds[i].y);
    }
    var stones = [
      { x: 520, y: 568, w: 26, h: 54 }, { x: 590, y: 576, w: 20, h: 38 }, { x: 468, y: 574, w: 18, h: 30 }, { x: 1290, y: 520, w: 22, h: 40 }
    ];
    stones.forEach(function (s) { s.wave = waveAt(s.x, s.y); s.j = rnd(); });
    var signStone = { x: 1215, y: 812, w: 92, h: 118, wave: waveAt(1215, 812), j: 0.2 };
    var board = { x: 1390, y: 712, wave: waveAt(1390, 712), j: 0.3 };
    var figure = { x: 1010, y: 796, s: 1.5, wave: waveAt(1010, 796) };

    /* ---- ground caches (old: town earth + cobbles, new: meadow, track: dirt) */
    var GW = W + M * 2, GH = H - BANK_TOP;
    var gOld = mk(GW, GH), gNew = mk(GW, GH), gTrack = mk(GW, GH);
    function wob(x, a, b, c) { return Math.sin(x * a + c) * 0.5 + Math.sin(x * b + c * 1.7) * 0.5; }
    (function buildGround() {
      var g = gOld.getContext('2d'); g.translate(M, -BANK_TOP);
      var bg = g.createLinearGradient(0, BANK_TOP, 0, 610);
      bg.addColorStop(0, 'rgb(74,56,52)'); bg.addColorStop(1, 'rgb(52,40,40)');
      g.fillStyle = bg; g.fillRect(-M, BANK_TOP, GW, 610 - BANK_TOP);
      // far-bank lane cobbles
      for (var y = 562; y < 612; y += 5) {
        var rh = 3 + (y - 562) / 14;
        for (var x = -M; x < W + M; x += rh * 2.2) {
          var v = R(0.8, 1.2); g.fillStyle = rgb([92 * v, 74 * v, 66 * v]);
          g.fillRect(x + (((y / 5) | 0) % 2) * rh, y, rh * 2 - 0.6, rh - 0.6);
        }
      }
      var fg = g.createLinearGradient(0, 660, 0, H);
      fg.addColorStop(0, 'rgb(86,66,58)'); fg.addColorStop(0.5, 'rgb(64,48,46)'); fg.addColorStop(1, 'rgb(36,28,32)');
      g.fillStyle = fg; g.fillRect(-M, 660, GW, H - 660);
      var y2 = 684, row = 0;
      while (y2 < H) {
        var rh2 = 5 + (y2 - 684) * 0.085;
        for (x = -M - (row % 2) * rh2; x < W + M; x += rh2 * 1.9) {
          v = R(0.72, 1.24); var warm = R(0, 1);
          g.fillStyle = rgb([104 * v + warm * 8, 82 * v, 72 * v - warm * 6]);
          g.beginPath();
          g.moveTo(x + 1, y2 + rh2 - 1); g.lineTo(x + 2, y2 + 1); g.lineTo(x + rh2 * 1.9 - 2, y2 + 1.5); g.lineTo(x + rh2 * 1.9 - 1, y2 + rh2 - 1); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,200,140,0.10)'; g.fillRect(x + 2, y2 + 1, rh2 * 1.9 - 4, 1.2);
        }
        y2 += rh2; row++;
      }
      // soot and wear
      for (i = 0; i < 90; i++) { g.fillStyle = 'rgba(10,6,10,' + R(0.04, 0.12).toFixed(2) + ')'; g.beginPath(); g.ellipse(R(-M, W + M), R(690, H), R(30, 130), R(6, 26), 0, 0, 6.3); g.fill(); }

      // new: meadow
      g = gNew.getContext('2d'); g.translate(M, -BANK_TOP);
      function meadow(y0, y1, c0, c1, blades0) {
        var mg = g.createLinearGradient(0, y0, 0, y1);
        mg.addColorStop(0, rgb(c0)); mg.addColorStop(1, rgb(c1));
        g.fillStyle = mg; g.fillRect(-M, y0, GW, y1 - y0);
        for (var q = 0; q < 70; q++) {
          var cc = pick([[96, 110, 78], [120, 118, 84], [70, 90, 70], [138, 124, 90], [84, 104, 82]]);
          g.fillStyle = rgb(cc, R(0.1, 0.28)); g.beginPath(); g.ellipse(R(-M, W + M), R(y0, y1), R(40, 190), R(8, 36), R(-0.2, 0.2), 0, 6.3); g.fill();
        }
        for (q = 0; q < blades0; q++) {
          var x = R(-M, W + M), y = R(y0, y1), sc = 0.5 + (y - y0) / (y1 - y0), cc2 = pick([[62, 84, 60], [96, 112, 74], [128, 128, 88], [48, 66, 54], [150, 140, 96]]);
          g.strokeStyle = rgb(mixc(cc2, [20, 30, 30], R(0, 0.35)), 0.7); g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-2, 2) * sc, y - R(3, 8) * sc); g.stroke();
        }
      }
      meadow(BANK_TOP, 610, [88, 102, 84], [66, 84, 66], 6500);
      meadow(660, H, [78, 96, 72], [46, 62, 48], 15000);
      for (i = 0; i < 160; i++) {
        var fx = R(-M, W + M), fy = R(688, H);
        g.fillStyle = rnd() < 0.6 ? 'rgba(236,232,210,0.8)' : 'rgba(224,196,96,0.75)';
        g.beginPath(); g.arc(fx, fy, R(0.8, 1.9) * (0.6 + (fy - 688) / 300), 0, 6.3); g.fill();
      }
      // dew mist
      var mist = g.createLinearGradient(0, 600, 0, 700); mist.addColorStop(0, 'rgba(190,196,188,0)'); mist.addColorStop(0.5, 'rgba(190,196,188,0.12)'); mist.addColorStop(1, 'rgba(190,196,188,0)');
      g.fillStyle = mist; g.fillRect(-M, 600, GW, 100);

      // track: ruts where the street used to run
      g = gTrack.getContext('2d'); g.translate(M, -BANK_TOP);
      [[776, 15], [838, 22], [572, 6]].forEach(function (tr) {
        var pts = [];
        for (var x = -M; x <= W + M; x += 12) pts.push([x, tr[0] + wob(x, 0.007, 0.019, tr[0]) * tr[1]]);
        g.beginPath(); pts.forEach(function (p, q) { q ? g.lineTo(p[0], p[1] - tr[1] * 0.45) : g.moveTo(p[0], p[1] - tr[1] * 0.45); });
        for (var q = pts.length - 1; q >= 0; q--) g.lineTo(pts[q][0], pts[q][1] + tr[1] * 0.45);
        g.closePath(); g.fillStyle = 'rgba(112,92,66,0.85)'; g.fill();
        for (var d = 0; d < 700; d++) { var pp = pts[(rnd() * pts.length) | 0]; g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '60,48,36' : '150,126,90') + ',0.4)'; g.fillRect(pp[0] + R(-8, 8), pp[1] + R(-tr[1] * 0.4, tr[1] * 0.4), R(1, 3), 1.4); }
      });
    })();

    /* ---------------------------------------------------------------- render */
    var S;   // frame state
    var PAL, G, T, TIME, ctx;
    var camX = 0;

    function lp(wave, j) { return C.localProgress(T, wave, j); }

    // eaten-from-the-top clip with an ink-torn edge; returns cutY
    function eatClip(e, b) {
      var sink = b.h * 0.2 * e;
      var t0 = b.top + sink - 16, cutY = t0 + e * (b.base - t0);
      var amp = 2.5 + 9 * Math.sin(Math.PI * e), n = b.jag.length, x0 = b.x - 8, x1 = b.x + b.w + 8;
      ctx.beginPath(); ctx.moveTo(x0, b.base);
      for (var i = 0; i < n; i++) ctx.lineTo(x0 + (x1 - x0) * i / (n - 1), cutY + b.jag[i] * amp);
      ctx.lineTo(x1, b.base); ctx.closePath();
      return { cut: cutY, sink: sink, amp: amp };
    }
    function inkEdge(e, b, info, hz) {
      if (e <= 0.01 || e >= 0.995) return;
      var n = b.jag.length, x0 = b.x - 8, x1 = b.x + b.w + 8, a = Math.sin(Math.PI * e);
      ctx.strokeStyle = rgb(mixc(PAL.ink, PAL.haze, hz * 0.5), 0.75 * a + 0.1); ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (var i = 0; i < n; i++) { var x = x0 + (x1 - x0) * i / (n - 1), y = info.cut + b.jag[i] * info.amp; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.lineWidth = 1.1;
      for (i = 1; i < n - 1; i += 2) {
        var xx = x0 + (x1 - x0) * i / (n - 1), yy = info.cut + b.jag[i] * info.amp, len = (6 + (b.jag[(i + 3) % n] + 1) * 12) * a;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + b.jag[(i + 5) % n], yy + len); ctx.stroke();
      }
    }

    function drawScaffold(b, p, info, hz) {
      var sa = smooth((p - 0.1) / 0.2) * (1 - smooth((p - 0.66) / 0.2));
      if (sa <= 0.01) return;
      var top = b.top - 6 + b.h * smooth((p - 0.42) / 0.38);
      var bot = info.cut + 4;
      if (bot <= top) return;
      ctx.strokeStyle = rgb(mixc([226, 196, 150], PAL.haze, 0.35 + hz * 0.4), sa * 0.7); ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = b.x; x <= b.x + b.w + 0.1; x += Math.max(10, b.w / Math.round(b.w / 12))) { ctx.moveTo(x, Math.max(top, 0)); ctx.lineTo(x, bot); }
      for (var y = b.base - 4; y > top; y -= 19) if (y < bot) { ctx.moveTo(b.x - 3, y); ctx.lineTo(b.x + b.w + 3, y); }
      for (y = b.base - 4, x = 0; y - 19 > top; y -= 19, x++) if (y < bot) { var xa = b.x + (x % 2) * b.w; ctx.moveTo(xa, y); ctx.lineTo(b.x + b.w - (x % 2) * b.w, y - 19); }
      ctx.stroke();
    }
    function drawFoundation(b, p, hz) {
      var fa = smooth((p - 0.45) / 0.15) * (1 - smooth((p - 0.78) / 0.2));
      if (fa <= 0.01) return;
      ctx.strokeStyle = rgb(mixc([176, 160, 132], PAL.haze, 0.3 + hz * 0.4), fa * 0.8); ctx.lineWidth = 1.2;
      ctx.strokeRect(b.x, b.base - 5, b.w, 5);
      ctx.beginPath(); for (var x = b.x + 9; x < b.x + b.w; x += 11) { ctx.moveTo(x, b.base - 5); ctx.lineTo(x, b.base); } ctx.stroke();
    }

    function drawBuilding(b) {
      var p = lp(b.wave, b.j), L = LAYERS[b.layer], hz = L.hz;
      if (p >= 0.995) return;
      var e = smooth(p / 0.56);
      var wall = mixc(mixc(b.wall, COLD, G * 0.55), PAL.haze, hz), roof = mixc(mixc(b.rcol, COLD, G * 0.5), PAL.haze, hz);
      var info;
      ctx.save();
      if (e > 0.001) info = eatClip(e, b); else { ctx.beginPath(); ctx.rect(b.x - 10, b.top - 80, b.w + 20, b.h + 80 + 4); info = { cut: b.top - 16, sink: 0, amp: 0 }; }
      ctx.clip();
      ctx.translate(0, info.sink);
      var top = b.top, wt = top + b.rh;
      // wall
      var gr = ctx.createLinearGradient(0, wt, 0, b.base);
      gr.addColorStop(0, rgb(mixc(wall, PAL.hor, 0.14 * PAL.warm + 0.02))); gr.addColorStop(1, rgb(dark(mixc(wall, PAL.haze, 0.1), 0.62)));
      ctx.fillStyle = gr; ctx.fillRect(b.x, wt, b.w, b.base - wt + 2);
      if (b.layer > 0) { ctx.globalAlpha = 0.5 * (1 - hz); ctx.fillStyle = ctx.createPattern(brick, 'repeat'); ctx.fillRect(b.x, wt, b.w, b.base - wt); ctx.globalAlpha = 1; }
      ctx.fillStyle = 'rgba(8,6,16,' + (0.22 + 0.1 * G).toFixed(2) + ')'; ctx.fillRect(b.x + b.w * 0.68, wt, b.w * 0.32, b.base - wt + 2);
      // lit edge from the dusk sun
      ctx.fillStyle = rgb(PAL.hor, 0.18 * PAL.warm); ctx.fillRect(b.x, wt, 2, b.base - wt);
      // roof
      ctx.fillStyle = rgb(roof);
      ctx.beginPath();
      if (b.roof === 0) { ctx.rect(b.x - 2, top, b.w + 4, 5); }
      else if (b.roof === 1) { ctx.moveTo(b.x - 3, wt); ctx.lineTo(b.x + b.w / 2, top); ctx.lineTo(b.x + b.w + 3, wt); }
      else if (b.roof === 2) { ctx.moveTo(b.x - 2, wt); ctx.lineTo(b.x + 6, top); ctx.lineTo(b.x + b.w - 6, top); ctx.lineTo(b.x + b.w + 2, wt); }
      else { ctx.moveTo(b.x - 4, wt); ctx.lineTo(b.x + b.w / 2, top); ctx.lineTo(b.x + b.w + 4, wt); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      if (b.roof === 1) { ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, top); ctx.lineTo(b.x + b.w + 3, wt); ctx.lineTo(b.x + b.w / 2, wt); ctx.closePath(); ctx.fill(); }
      if (b.chim) { ctx.fillStyle = rgb(dark(wall, 0.6)); ctx.fillRect(b.x + b.chim.x, wt - b.chim.h - (b.roof === 1 ? b.w * 0.1 : 0), 6, b.chim.h + 6); }
      // windows
      var gx = (b.w - b.cols * 15) / 2 + 4, gy = wt + 12;
      for (var wi = 0; wi < b.wins.length; wi++) {
        var wn = b.wins[wi], wx = b.x + gx + wn.c * 15 + 1, wy = gy + wn.r * 22;
        if (wy + 10 > b.base - 6) continue;
        var br = 0;
        if (wn.lit0 && p < wn.thr + 0.05) {
          br = clamp((wn.thr + 0.05 - p) / 0.05, 0, 1);
          if (p > wn.thr - 0.14) br *= 0.65 + 0.35 * Math.sin(TIME * 17 + wn.ph) * Math.sin(TIME * 7.3 + wn.ph * 2);
          br *= 1 - S.tension * 0.25 * (0.5 + 0.5 * Math.sin(TIME * 13 + wn.ph));
        }
        ctx.fillStyle = br > 0.02 ? rgb(mixc([60, 52, 70], [255, 198, 108], br)) : rgb(mixc([34, 36, 54], PAL.haze, 0.12 + hz * 0.5));
        ctx.fillRect(wx, wy, 7, 10);
        if (br > 0.1 && b.layer > 0) {
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = br * 0.55 * (1 - hz * 0.7);
          ctx.drawImage(glow, wx - 11, wy - 9, 29, 29);
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        } else if (br <= 0.02 && b.layer > 0) { ctx.fillStyle = 'rgba(120,150,190,' + (0.1 * G).toFixed(2) + ')'; ctx.fillRect(wx, wy, 7, 4); }
      }
      if (b.layer === 2) { ctx.fillStyle = 'rgba(14,8,10,0.7)'; ctx.fillRect(b.x + b.w * 0.5 - 5, b.base - 20, 10, 22); }
      if (b.special === 'clock') {
        var cx = b.x + b.w / 2, cy = wt + 50;
        ctx.fillStyle = rgb(mixc([232, 214, 170], PAL.haze, hz + 0.2)); ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 6.3); ctx.fill();
        ctx.strokeStyle = rgb(dark(wall, 0.4)); ctx.lineWidth = 3; ctx.stroke();
        var ha = TIME * 0.2 - p * 40, ma = ha * 12;
        ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgb(30,22,24)'; ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ha) * 11, cy - Math.cos(ha) * 11);
        ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ma) * 17, cy - Math.cos(ma) * 17); ctx.stroke();
        var lg = ctx.createRadialGradient(cx, cy, 6, cx, cy, 60); lg.addColorStop(0, rgb([255, 190, 110], 0.28 * PAL.warm)); lg.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = lg; ctx.fillRect(cx - 60, cy - 60, 120, 120);
      }
      ctx.restore();
      if (e > 0.001) { ctx.save(); inkEdge(e, b, info, hz); ctx.restore(); }
      ctx.save(); drawScaffold(b, p, info, hz); drawFoundation(b, p, hz); ctx.restore();
      // grass takes the lot
      var gt = smooth((p - 0.55) / 0.4);
      if (gt > 0.02) {
        ctx.strokeStyle = rgb(mixc([70, 92, 66], PAL.haze, hz * 0.8), 0.9); ctx.lineWidth = 1.2; ctx.beginPath();
        for (var x = b.x; x < b.x + b.w; x += 5) {
          var sw = Math.sin(TIME * 1.7 + x * 0.1) * 2 * S.motion, hh = (3 + ((x * 7) % 5)) * gt * (1.4 - hz);
          ctx.moveTo(x, b.base + 1); ctx.quadraticCurveTo(x + sw * 0.4, b.base - hh * 0.6, x + sw, b.base - hh);
        }
        ctx.stroke();
      }
      // smoke: stops as the hearth is never lit
      if (b.chim && p < 0.34 && b.layer > 0) {
        var ss = 1 - smooth(p / 0.34), cx2 = b.x + b.chim.x + 3, cy2 = wt - b.chim.h - (b.roof === 1 ? b.w * 0.1 : 0);
        for (var q = 0; q < 6; q++) {
          var age = ((TIME * 0.11 * S.motion + q / 6 + b.j) % 1 + 1) % 1;
          ctx.fillStyle = rgb(mixc([120, 100, 104], PAL.haze, 0.4 + hz * 0.4), 0.2 * (1 - age) * ss);
          ctx.beginPath(); ctx.arc(cx2 + age * 24 + Math.sin(age * 5 + b.j * 9) * 4, cy2 - age * 50, 3 + age * 10, 0, 6.3); ctx.fill();
        }
      }
    }

    /* ---- people */
    function personPath(pe, ph, lookUp) {
      var sw = Math.sin(ph) * 7, v = pe.variant, pa = new Path2D();
      // legs
      pa.moveTo(-5.5, -40); pa.lineTo(-5 + sw, 0); pa.lineTo(0.5 + sw, 0); pa.lineTo(0.5, -40);
      pa.moveTo(-0.5, -40); pa.lineTo(-sw - 0.5, 0); pa.lineTo(5 - sw, 0); pa.lineTo(5.5, -40);
      // coat
      var hem = v === 3 ? -12 : -28;
      pa.moveTo(-8.5, -82); pa.quadraticCurveTo(0, -86, 8.5, -82); pa.lineTo(v === 3 ? 14 : 11.5, hem); pa.lineTo(v === 3 ? -14 : -11.5, hem); pa.closePath();
      // head
      var hy = -91 - (lookUp ? 2 : 0);
      pa.moveTo(6, hy); pa.arc(0, hy, 5.8, 0, 6.3);
      if (v === 1) { pa.rect(-5, hy - 14, 10, 11); pa.rect(-8, hy - 4, 16, 2.4); }
      if (v === 2) { pa.moveTo(-8, -80); pa.quadraticCurveTo(0, hy - 10, 8, -80); }
      if (v === 4) { pa.rect(-8, -62, 7, 8); }
      return pa;
    }
    function paintGhostable(pa, base, fa, oa, rim) {
      if (fa > 0.01) {
        ctx.globalAlpha = fa; ctx.fillStyle = rgb(base); ctx.fill(pa);
        if (rim > 0.01) { ctx.strokeStyle = rgb([255, 170, 96], rim * fa); ctx.lineWidth = 1; ctx.stroke(pa); }
        ctx.globalAlpha = 1;
      }
      if (oa > 0.01) { ctx.strokeStyle = 'rgba(214,204,186,' + (oa * 0.8).toFixed(3) + ')'; ctx.lineWidth = 1.1; ctx.stroke(pa); }
    }
    function drawPerson(pe) {
      var p = lp(pe.wave, pe.j);
      var fa = 1 - smooth((p - 0.42) / 0.26), oa = smooth((p - 0.32) / 0.1) * (1 - smooth((p - 0.66) / 0.22));
      if (fa <= 0.01 && oa <= 0.01) return;
      var still = 1 - smooth((p - pe.freeze) / 0.06);
      var look = pe.lookUp ? smooth((p - 0.2) / 0.12) : 0;
      var hz = pe.far ? 0.7 : 0.1;
      var base = mixc(mixc(dark([58, 46, 54], pe.tone), COLD, G * 0.5), PAL.haze, hz);
      ctx.save(); ctx.translate(pe.x, pe.y); ctx.scale(pe.s * pe.dir, pe.s);
      // contact shadow
      ctx.fillStyle = 'rgba(6,4,10,0.28)'; ctx.beginPath(); ctx.ellipse(0, 1, 11, 3, 0, 0, 6.3); ctx.fill();
      paintGhostable(personPath(pe, pe.ph * still + (1 - still) * 0, look > 0.5), base, fa, oa, 0.12 * PAL.warm);
      ctx.restore();
    }
    function drawCart() {
      var p = lp(cart.wave, cart.j);
      var fa = 1 - smooth((p - 0.42) / 0.26), oa = smooth((p - 0.32) / 0.1) * (1 - smooth((p - 0.66) / 0.22));
      if (fa <= 0.01 && oa <= 0.01) return;
      var pa = new Path2D(), rot = cart.x * 0.07;
      pa.rect(-34, -34, 62, 14); pa.moveTo(-34, -30); pa.lineTo(-66, -44); pa.lineTo(-66, -41); pa.lineTo(-34, -26);
      pa.rect(-24, -52, 14, 18); pa.rect(-6, -48, 12, 14);
      pa.moveTo(-8, -24); pa.arc(-8, -16, 14, 0, 6.3); pa.moveTo(24, -24); pa.arc(24, -16, 14, 0, 6.3);
      ctx.save(); ctx.translate(cart.x, cart.y); ctx.scale(cart.s, cart.s);
      ctx.fillStyle = 'rgba(6,4,10,0.28)'; ctx.beginPath(); ctx.ellipse(-6, 0, 40, 5, 0, 0, 6.3); ctx.fill();
      paintGhostable(pa, mixc([68, 48, 38], COLD, G * 0.5), fa, oa, 0.3 * PAL.warm);
      if (fa > 0.01) {
        ctx.strokeStyle = 'rgba(20,12,14,' + fa + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
        [-8, 24].forEach(function (wx) { for (var s = 0; s < 4; s++) { ctx.moveTo(wx, -16); ctx.lineTo(wx + Math.cos(rot + s * 0.785) * 13, -16 + Math.sin(rot + s * 0.785) * 13); ctx.moveTo(wx, -16); ctx.lineTo(wx - Math.cos(rot + s * 0.785) * 13, -16 - Math.sin(rot + s * 0.785) * 13); } });
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---- lamps */
    function lampBright(m, p) {
      var b = 1 - smooth((p - m.thr) / 0.05);
      if (p > m.thr - 0.1 && p < m.thr + 0.06) b *= 0.55 + 0.45 * Math.sin(TIME * 23 + m.ph) * Math.sin(TIME * 9 + m.ph);
      return clamp(b, 0, 1) * (1 - S.tension * 0.3 * (0.5 + 0.5 * Math.sin(TIME * 11 + m.ph)));
    }
    function lampPool(m) {
      var p = lp(m.wave, m.j), b = lampBright(m, p);
      if (b < 0.02) return;
      ctx.globalCompositeOperation = 'lighter';
      var r = 150 * m.s, gr = ctx.createRadialGradient(m.x, m.y + 4, 0, m.x, m.y + 4, r);
      gr.addColorStop(0, 'rgba(255,170,80,' + (0.34 * b).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,130,50,0)');
      ctx.save(); ctx.translate(0, m.y + 4); ctx.scale(1, 0.32); ctx.translate(0, -(m.y + 4)); ctx.fillStyle = gr; ctx.fillRect(m.x - r, m.y + 4 - r, r * 2, r * 2); ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    function drawLamp(m) {
      var p = lp(m.wave, m.j);
      var fall = smooth((p - m.thr - 0.08) / 0.2), fade = 1 - smooth((p - m.thr - 0.24) / 0.2);
      if (fade <= 0.01) return;
      var b = lampBright(m, p), s = m.s, hz = m.s < 0.8 ? 0.35 : 0.05;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(m.x, m.y); ctx.rotate(fall * 1.4 * m.side); ctx.scale(s, s);
      var col = rgb(mixc(mixc([30, 26, 32], COLD, G * 0.4), PAL.haze, hz));
      ctx.fillStyle = col; ctx.fillRect(-2.5, -118, 5, 118);
      ctx.fillRect(-6, -8, 12, 8); ctx.fillRect(-4, -20, 8, 3);
      ctx.beginPath(); ctx.moveTo(-9, -118); ctx.lineTo(9, -118); ctx.lineTo(6, -142); ctx.lineTo(-6, -142); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-10, -142); ctx.lineTo(0, -152); ctx.lineTo(10, -142); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgb(mixc([64, 56, 60], [255, 204, 120], b)); ctx.fillRect(-5, -138, 10, 18);
      if (b > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        var gr = ctx.createRadialGradient(0, -129, 0, 0, -129, 54);
        gr.addColorStop(0, 'rgba(255,200,120,' + (0.8 * b).toFixed(3) + ')'); gr.addColorStop(0.3, 'rgba(255,150,70,' + (0.28 * b).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = gr; ctx.fillRect(-54, -183, 108, 108);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }

    /* ---- boats */
    function drawBoat(bt) {
      var p = lp(bt.wave, bt.j); if (p >= 0.9) return;
      var e = smooth(p / 0.5), bob = Math.sin(TIME * 1.2 * S.motion + bt.ph) * 1.6;
      var bb = { x: bt.x - bt.w / 2 - 20, w: bt.w + 40, top: bt.top, base: bt.base + 4, h: bt.h, jag: bt.jag };
      ctx.save();
      if (e > 0.001) var info = eatClip(e, bb); else { ctx.beginPath(); ctx.rect(bb.x, bb.top - 60, bb.w, bb.h + 70); }
      ctx.clip();
      ctx.translate(bt.x, bt.y + bob + (info ? info.sink * 0.5 : 0)); ctx.scale(bt.dir, 1);
      var w = bt.w / 2, hz = 0.18;
      var hull = mixc(mixc([46, 30, 28], COLD, G * 0.5), PAL.haze, hz);
      ctx.fillStyle = rgb(hull);
      ctx.beginPath(); ctx.moveTo(-w, -9); ctx.quadraticCurveTo(-w * 0.6, 8, 0, 9); ctx.quadraticCurveTo(w * 0.7, 8, w, -14); ctx.lineTo(w * 0.92, -10); ctx.quadraticCurveTo(0, -4, -w, -9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgb(dark(hull, 0.6)); ctx.fillRect(-4, -34, 3, 26);
      ctx.fillStyle = rgb(mixc([88, 68, 60], PAL.haze, 0.2)); ctx.beginPath(); ctx.moveTo(-3, -34); ctx.lineTo(w * 0.7, -12); ctx.lineTo(-3, -12); ctx.closePath(); ctx.fill();
      var lb = clamp(1 - smooth((p - 0.1) / 0.1), 0, 1);
      ctx.fillStyle = rgb(mixc([60, 50, 50], [255, 190, 100], lb)); ctx.fillRect(w - 6, -30, 5, 7);
      if (lb > 0.02) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = lb * 0.7; ctx.drawImage(glow, w - 28, -52, 52, 52); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      ctx.restore();
      if (e > 0.001 && e < 0.995) { ctx.save(); inkEdge(e, bb, info, hz); ctx.restore(); }
    }

    /* ---- bridge */
    function drawBridgeSpan(s, idx) {
      var p = lp(s.wave, s.j); if (p >= 0.995) return;
      var e = smooth(p / 0.5), hz = 0.1;
      var wall = mixc(mixc([116, 100, 92], COLD, G * 0.5), PAL.haze, hz);
      ctx.save();
      if (e > 0.001) var info = eatClip(e, s); else { ctx.beginPath(); ctx.rect(s.x - 10, s.top - 40, s.w + 20, s.h + 50); }
      ctx.clip(); ctx.translate(0, info ? info.sink : 0);
      var gr = ctx.createLinearGradient(0, s.top, 0, s.base); gr.addColorStop(0, rgb(mixc(wall, PAL.hor, 0.16 * PAL.warm))); gr.addColorStop(1, rgb(dark(wall, 0.55)));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.rect(s.x, s.top + 12, s.w, s.base - s.top - 12);
      ctx.moveTo(s.x + 18, s.base + 1); ctx.lineTo(s.x + 18, s.top + 52); ctx.arc(s.x + s.w / 2, s.top + 52, s.w / 2 - 18, Math.PI, 0); ctx.lineTo(s.x + s.w - 18, s.base + 1); ctx.closePath();
      ctx.fill('evenodd');
      ctx.fillStyle = rgb(dark(wall, 0.75)); ctx.fillRect(s.x, s.top + 4, s.w, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(s.x, s.top + 12, s.w, 4);
      ctx.fillStyle = ctx.createPattern(brick, 'repeat'); ctx.globalAlpha = 0.35; ctx.fillRect(s.x, s.top + 12, s.w, s.base - s.top - 12); ctx.globalAlpha = 1;
      ctx.restore();
      if (e > 0.001 && e < 0.995) { ctx.save(); inkEdge(e, s, info, hz); ctx.restore(); }
      // arch water shadow line
      var fa = smooth((p - 0.45) / 0.15) * (1 - smooth((p - 0.8) / 0.18));
      if (fa > 0.02) { ctx.strokeStyle = 'rgba(190,176,150,' + (fa * 0.6).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.strokeRect(s.x + 16, s.base - 4, s.w - 32, 4); }
    }

    /* ---- sky, hills, water, ground */
    function drawSky() {
      var gr = ctx.createLinearGradient(0, 0, 0, 470);
      gr.addColorStop(0, rgb(PAL.top)); gr.addColorStop(0.55, rgb(PAL.mid)); gr.addColorStop(1, rgb(PAL.hor));
      ctx.fillStyle = gr; ctx.fillRect(-M - 40, -40, W + M * 2 + 80, 520);
      var sa = smooth((T - 0.45) / 0.45);
      if (sa > 0.01) for (var i = 0; i < stars.length; i++) {
        var st = stars[i], tw = 0.55 + 0.45 * Math.sin(TIME * 1.3 * S.motion + st.ph), a = sa * tw * (1 - st.y / 360) * clamp((T - 0.45 - st.thr * 0.3) * 6, 0, 1);
        if (a <= 0.01) continue; ctx.fillStyle = 'rgba(236,238,255,' + a.toFixed(3) + ')'; ctx.fillRect(st.x, st.y, st.r, st.r);
      }
      // low sun glow behind the hills
      var sx = 1090 + G * 160, sg = ctx.createRadialGradient(sx, 438, 0, sx, 438, 420);
      sg.addColorStop(0, rgb([255, 190, 110], 0.62 * PAL.warm + 0.18 * G)); sg.addColorStop(0.35, rgb([255, 130, 80], 0.2 * PAL.warm + 0.05 * G)); sg.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 420, 0, 840, 470);
      var off = (TIME * 3 * S.motion) % W;
      ctx.save(); ctx.translate(camX * 0.1, 0);
      ctx.globalAlpha = 1 - G; ctx.drawImage(cloudsOld, off - W, 0); ctx.drawImage(cloudsOld, off, 0);
      ctx.globalAlpha = G; ctx.drawImage(cloudsNew, off - W, 0); ctx.drawImage(cloudsNew, off, 0);
      ctx.globalAlpha = 1; ctx.restore();
    }
    function drawHills() {
      for (var h = 0; h < hills.length; h++) {
        var hl = hills[h]; ctx.save(); ctx.translate(camX * hl.par, 0);
        var c = mixc(mixc([58, 44, 62], [54, 66, 72], G), PAL.haze, hl.hz);
        ctx.fillStyle = rgb(c); ctx.beginPath(); ctx.moveTo(hl.pts[0][0], 520);
        hl.pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.lineTo(W + 120, 520); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.save(); ctx.translate(camX * 0.3, 0);
      hillLights.forEach(function (l) {
        var p = lp(waveAt(l.x, 600), l.thr); var a = (1 - smooth((p - l.thr) / 0.05)) * (p < 0.6 ? 1 : 0);
        if (p > 0.001 && p >= 0.6) return;
        a = 1 - smooth((p - l.thr * 0.8) / 0.06); if (a <= 0.02) return;
        ctx.fillStyle = 'rgba(255,196,110,' + (0.6 * a).toFixed(3) + ')'; ctx.fillRect(l.x, l.y, 1.6, 1.6);
      });
      ctx.restore();
    }
    // composite the cached ground in tiles, each with its own erasure progress
    function drawGround(y0, y1, par) {
      ctx.save(); ctx.translate(camX * par, 0);
      var TW = 20, TH = 38;
      for (var y = y0; y < y1; y += TH) {
        var hh = Math.min(TH, y1 - y), cy = y + hh / 2;
        for (var x = -M; x < W + M; x += TW) {
          var p = lp(waveAt(x + TW / 2, cy), 0.5 + 0.5 * Math.sin(x * 0.037 + y * 0.051) * 0.6);
          var sx = x + M, sy = y - BANK_TOP;
          if (p < 0.995) ctx.drawImage(gOld, sx, sy, TW + 0.6, hh + 0.6, x, y, TW + 0.6, hh + 0.6);
          var ta = smooth((p - 0.18) / 0.22) * (1 - smooth((p - 0.55) / 0.35));
          if (ta > 0.01) { ctx.globalAlpha = ta; ctx.drawImage(gTrack, sx, sy, TW + 0.6, hh + 0.6, x, y, TW + 0.6, hh + 0.6); }
          var na = smooth((p - 0.15) / 0.8);
          if (na > 0.005) { ctx.globalAlpha = na; ctx.drawImage(gNew, sx, sy, TW + 0.6, hh + 0.6, x, y, TW + 0.6, hh + 0.6); }
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
    function drawWater() {
      ctx.save(); ctx.translate(camX * 0.9, 0);
      var top = mixc(PAL.mid, [10, 12, 26], 0.5), bot = mixc(PAL.top, [8, 10, 18], 0.6);
      var gr = ctx.createLinearGradient(0, WATER_TOP, 0, WATER_BOT); gr.addColorStop(0, rgb(mixc(top, PAL.hor, 0.18))); gr.addColorStop(1, rgb(bot));
      ctx.fillStyle = gr; ctx.beginPath();
      var x;
      for (x = -M; x <= W + M; x += 16) { var yy = WATER_TOP - 3 * G * (1 + Math.sin(x * 0.012)) + 1.5 * G * Math.sin(x * 0.05); x === -M ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      for (x = W + M; x >= -M; x -= 16) ctx.lineTo(x, WATER_BOT + 5 * G * Math.sin(x * 0.008 + 1) + 3 * G * Math.sin(x * 0.03));
      ctx.closePath(); ctx.fill();
      // reflections: lamplight in the old world, sky shimmer in the new one
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 70; i++) {
        var rx = (i * 97.3) % (W + 100) - 50, ry = WATER_TOP + 4 + ((i * 53.7) % (WATER_BOT - WATER_TOP - 8));
        var sh = 0.5 + 0.5 * Math.sin(TIME * 1.6 * S.motion + i * 1.9);
        var warm = PAL.warm * (0.2 + (i % 3) * 0.1), cold = G * 0.08;
        ctx.fillStyle = 'rgba(' + (warm > cold ? '255,170,90' : '170,190,210') + ',' + ((warm > cold ? warm : cold) * sh).toFixed(3) + ')';
        ctx.fillRect(rx, ry, 10 + (i % 5) * 7, 1.4);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
    function drawQuay(y, h, par, hzf) {
      ctx.save(); ctx.translate(camX * par, 0);
      for (var x = -M; x < W + M; x += 40) {
        var p = lp(waveAt(x + 20, y + h), 0.5), a = 1 - smooth((p - 0.2) / 0.35);
        if (a <= 0.01) continue;
        var c = mixc(mixc([100, 84, 78], COLD, G * 0.5), PAL.haze, hzf);
        ctx.globalAlpha = a; ctx.fillStyle = rgb(c); ctx.fillRect(x, y, 41, h);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - 3, 41, 3);
        ctx.fillStyle = 'rgba(255,200,150,' + (0.12 * PAL.warm + 0.04).toFixed(3) + ')'; ctx.fillRect(x, y, 41, 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath();
        for (var yy = y + 6; yy < y + h - 2; yy += 6) { ctx.moveTo(x, yy); ctx.lineTo(x + 40, yy); }
        ctx.moveTo(x + 10, y + 2); ctx.lineTo(x + 10, y + 6); ctx.moveTo(x + 30, y + 8); ctx.lineTo(x + 30, y + 12);
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    /* ---- sign stone / notice board */
    function drawSignStone() {
      var s = signStone, p = lp(s.wave, s.j);
      var old = 1 - smooth((p - 0.3) / 0.12);              // painted signboard
      var wy = s.y;
      ctx.save(); ctx.translate(s.x, wy);
      ctx.fillStyle = 'rgba(6,4,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 56, 7, 0, 0, 6.3); ctx.fill();
      if (old > 0.01) {
        var bd = { x: -64, w: 128, top: -150, base: 0, h: 150, jag: buildings[2].jag };
        var e = 1 - old; ctx.save();
        if (e > 0.001) var info = eatClip(e, bd); else { ctx.beginPath(); ctx.rect(-90, -170, 180, 190); }
        ctx.clip(); ctx.translate(0, info ? info.sink : 0);
        ctx.fillStyle = rgb(mixc([40, 30, 30], COLD, G * 0.4)); ctx.fillRect(-46, -100, 6, 100); ctx.fillRect(40, -100, 6, 100);
        var bg = ctx.createLinearGradient(0, -150, 0, -92); bg.addColorStop(0, rgb([96, 52, 36])); bg.addColorStop(1, rgb([66, 36, 28]));
        ctx.fillStyle = bg; ctx.fillRect(-64, -148, 128, 56);
        ctx.strokeStyle = 'rgb(212,170,96)'; ctx.lineWidth = 2; ctx.strokeRect(-60, -144, 120, 48);
        ctx.fillStyle = 'rgb(236,206,138)'; ctx.textAlign = 'center'; ctx.font = 'bold 11px ' + FONT;
        ctx.fillText('CITY OF ASHMERE', 0, -123); ctx.font = '13px ' + FONT; ctx.fillText('灰堡市', 0, -104);
        ctx.restore();
        if (e > 0.001 && e < 0.995) { ctx.save(); inkEdge(e, bd, info, 0.05); ctx.restore(); }
      }
      // the standing stone that was always here
      var rise = smooth((p - 0.55) / 0.35);
      if (rise > 0.005) {
        ctx.save(); ctx.beginPath(); ctx.rect(-80, -140, 160, 142); ctx.clip();
        ctx.translate(0, (1 - rise) * 110);
        var sg = ctx.createLinearGradient(-30, -110, 36, 0); sg.addColorStop(0, rgb(mixc([118, 118, 112], COLD, 0.2))); sg.addColorStop(1, rgb([58, 62, 62]));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-34, 2); ctx.lineTo(-38, -60); ctx.lineTo(-22, -106); ctx.lineTo(8, -118); ctx.lineTo(30, -92); ctx.lineTo(38, -30); ctx.lineTo(34, 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(180,196,150,0.28)'; ctx.beginPath(); ctx.ellipse(-8, -104, 20, 7, -0.2, 0, 6.3); ctx.fill();
        for (var q = 0; q < 30; q++) { ctx.fillStyle = 'rgba(150,170,120,0.25)'; ctx.fillRect(-30 + (q * 37 % 60), -90 + (q * 53 % 80), 2, 2); }
        ctx.fillStyle = 'rgba(24,26,28,0.85)'; ctx.textAlign = 'center'; ctx.font = 'bold 9px ' + FONT;
        ctx.fillText('ASHMERE', 0, -70); ctx.fillText('MEADOW', 0, -58); ctx.font = '11px ' + FONT; ctx.fillText('灰堡草甸', 0, -40);
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(-36, -60, 3, 50);
        ctx.restore();
      }
      ctx.restore();
    }
    function drawBoard() {
      var bo = board, p = lp(bo.wave, bo.j);
      var s2 = smooth((p - 0.38) / 0.3), sx = bo.x, sy = bo.y;
      ctx.save(); ctx.translate(sx, sy);
      var tilt = smooth((p - 0.5) / 0.4) * 0.05; ctx.rotate(tilt);
      ctx.fillStyle = 'rgba(6,4,10,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 70, 6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = rgb(mixc([48, 34, 30], [70, 62, 54], G * 0.7)); ctx.fillRect(-64, -130, 6, 130); ctx.fillRect(58, -130, 6, 130);
      ctx.fillStyle = rgb(mixc([84, 56, 38], [86, 78, 64], G * 0.7)); ctx.fillRect(-72, -170, 144, 100);
      var pg = ctx.createLinearGradient(0, -164, 0, -76); pg.addColorStop(0, rgb(mixc([226, 204, 160], [190, 184, 160], G * 0.6))); pg.addColorStop(1, rgb(mixc([196, 168, 122], [166, 160, 140], G * 0.6)));
      ctx.fillStyle = pg; ctx.fillRect(-66, -164, 132, 88);
      ctx.strokeStyle = 'rgba(70,46,30,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(-66, -164, 132, 88);
      // river: the anchor that stays on both maps
      ctx.strokeStyle = 'rgba(70,98,120,0.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-66, -112); ctx.bezierCurveTo(-30, -126, 0, -96, 30, -108); ctx.bezierCurveTo(46, -114, 56, -118, 66, -116); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(60,40,30,0.8)'; ctx.fillStyle = 'rgba(60,40,30,0.85)'; ctx.textAlign = 'center';
      var oa = 1 - s2;
      if (oa > 0.01) {
        ctx.globalAlpha = oa;
        for (var gx = 0; gx < 6; gx++) for (var gy = 0; gy < 2; gy++) { ctx.fillStyle = 'rgba(96,60,44,0.65)'; ctx.fillRect(-58 + gx * 20 + (gy * 7), gy === 0 ? -150 : -98, 12 + (gx * 3) % 6, 10); }
        ctx.beginPath(); ctx.moveTo(-60, -135); ctx.lineTo(60, -133); ctx.moveTo(-60, -84); ctx.lineTo(60, -86); ctx.stroke();
        ctx.fillStyle = 'rgba(80,36,28,0.9)'; ctx.font = 'bold 8px ' + FONT; ctx.fillText('ASHMERE · 灰堡市', 0, -154 + 2);
        ctx.font = '7px ' + FONT; ctx.fillText('FOUNDED · 永昌四十二年', 0, -80);
        ctx.globalAlpha = 1;
      }
      if (s2 > 0.01) {
        ctx.globalAlpha = s2;
        ctx.strokeStyle = 'rgba(70,90,60,0.8)'; ctx.lineWidth = 1;
        for (var q = 0; q < 26; q++) { var hx = -58 + (q * 41 % 116), hy = -154 + ((q * 29) % 28) + (hx > -10 && hx < 40 ? 18 : 0); ctx.beginPath(); ctx.moveTo(hx, hy + 4); ctx.lineTo(hx - 1.5, hy); ctx.moveTo(hx, hy + 4); ctx.lineTo(hx + 1.5, hy); ctx.stroke(); }
        ctx.fillStyle = 'rgba(80,80,76,0.85)'; ctx.fillRect(-36, -146, 3, 7); ctx.fillRect(-28, -143, 2.4, 5); ctx.fillRect(22, -142, 3, 7);
        ctx.fillStyle = 'rgba(60,44,34,0.9)'; ctx.font = 'bold 7px ' + FONT; ctx.fillText('NO SETTLEMENT RECORDED', 0, -88); ctx.font = '7px ' + FONT; ctx.fillText('无聚落记录 · 灰堡草甸', 0, -80);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    /* ---- grass, reeds, stones, birds */
    function drawFarStones() {
      stones.forEach(function (s) {
        var p = lp(s.wave, s.j), rise = smooth((p - 0.6) / 0.35); if (rise < 0.01) return;
        ctx.save(); ctx.translate(s.x, s.y); ctx.beginPath(); ctx.rect(-s.w, -s.h - 6, s.w * 2, s.h + 6); ctx.clip(); ctx.translate(0, (1 - rise) * s.h);
        var c = mixc([86, 90, 90], PAL.haze, 0.25); ctx.fillStyle = rgb(c);
        ctx.beginPath(); ctx.moveTo(-s.w / 2, 0); ctx.lineTo(-s.w / 2 + 2, -s.h * 0.7); ctx.lineTo(0, -s.h); ctx.lineTo(s.w / 2 - 1, -s.h * 0.6); ctx.lineTo(s.w / 2, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(s.w * 0.1, -s.h * 0.8, s.w * 0.4, s.h * 0.8); ctx.restore();
      });
    }
    function drawBlades() {
      var cols = [rgb(mixc([54, 76, 54], PAL.haze, 0.1)), rgb(mixc([92, 112, 72], PAL.haze, 0.1)), rgb(mixc([132, 132, 90], PAL.haze, 0.1))];
      var wind = 1.2 * S.motion;
      for (var c = 0; c < 3; c++) {
        ctx.strokeStyle = cols[c]; ctx.lineWidth = 1.3; ctx.beginPath();
        for (var i = 0; i < blades.length; i++) {
          var b = blades[i]; if (b.c !== c) continue;
          var gr = smooth((lp(b.wave, b.j) - 0.45) / 0.45); if (gr < 0.02) continue;
          var h = b.h * gr, sw = (Math.sin(TIME * 1.6 + b.x * 0.012 + b.ph) + Math.sin(TIME * 0.7 + b.x * 0.004)) * h * 0.2 * wind;
          ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + sw * 0.3, b.y - h * 0.6, b.x + sw, b.y - h);
        }
        ctx.stroke();
      }
    }
    function drawReeds() {
      ctx.strokeStyle = rgb(mixc([80, 94, 60], PAL.haze, 0.12)); ctx.lineWidth = 1.5; ctx.beginPath();
      var heads = [];
      for (var i = 0; i < reeds.length; i++) {
        var r = reeds[i], gr = smooth((lp(r.wave, r.j) - 0.55) / 0.4); if (gr < 0.02) continue;
        var h = r.h * gr, sw = Math.sin(TIME * 1.3 + r.x * 0.01 + r.ph) * h * 0.14 * S.motion + Math.sin(r.ph) * 4;
        ctx.moveTo(r.x, r.y); ctx.quadraticCurveTo(r.x + sw * 0.2, r.y - h * 0.6, r.x + sw, r.y - h);
        if (r.head) heads.push([r.x + sw, r.y - h, gr]);
      }
      ctx.stroke();
      ctx.strokeStyle = rgb([70, 48, 38]); ctx.lineWidth = 3.4; ctx.beginPath();
      heads.forEach(function (h) { ctx.moveTo(h[0], h[1] + 2); ctx.lineTo(h[0] + 0.4, h[1] + 9 * h[2]); }); ctx.stroke();
    }
    function drawBirds() {
      ctx.strokeStyle = rgb(mixc([28, 20, 32], PAL.haze, 0.3)); ctx.lineWidth = 1.4;
      birds.forEach(function (b) {
        var x = ((b.x + TIME * b.v * S.motion) % (W + 200) + W + 200) % (W + 200) - 100, y = b.y + Math.sin(TIME * 0.5 * S.motion + b.ph) * 14;
        var f = Math.sin(TIME * 7 * S.motion + b.ph) * 5 * b.s;
        ctx.beginPath(); ctx.moveTo(x - 9 * b.s, y - f * 0.2 - 2); ctx.quadraticCurveTo(x - 4 * b.s, y - 4 - f, x, y); ctx.quadraticCurveTo(x + 4 * b.s, y - 4 - f, x + 9 * b.s, y - f * 0.2 - 2); ctx.stroke();
      });
    }

    /* ---- the lamplighter: the one person who should not exist */
    function drawFigure() {
      var f = figure, ap = smooth((S.newTime - 3.2) / 2.2) * (T >= 0.999 ? 1 : 0);
      if (S.forceFigure) ap = 1;
      if (ap <= 0.005) return;
      var turn = S.reduced ? 1 : smooth((S.newTime - 5.8) / 3.5);
      if (S.forceFigure) turn = 1;
      var gx = S.pointer.x * 1.0, gy = S.pointer.y * 1.0;
      var wv = lerp(0.62, 1, turn), s = f.s;
      ctx.save(); ctx.translate(f.x, f.y);
      // ghost traces of the old street, only here
      var gA = ap * smooth((S.newTime - 4.4) / 2.4); if (S.forceFigure) gA = ap;
      if (gA > 0.01) {
        ctx.save(); ctx.translate(-f.x, -f.y);
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 8, 112, 22, 0, 0, 6.3); ctx.clip();
        ctx.globalAlpha = gA * 0.55; ctx.drawImage(gOld, f.x - 130 + M, f.y - 24 - BANK_TOP, 260, 64, f.x - 130, f.y - 24, 260, 64);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = 'rgba(206,190,160,' + (gA * 0.5).toFixed(3) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 8, 112, 22, 0, 0, 6.3); ctx.stroke();
        ctx.fillStyle = 'rgba(120,112,100,' + (gA * 0.9).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(-70, 14, 14, 5, 0, 0, 6.3); ctx.ellipse(-34, 22, 10, 4, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(60,54,52,' + (gA * 0.9).toFixed(3) + ')'; ctx.fillRect(-72, 4, 6, 10);
        var fw = clamp(Math.sin(S.newTime * 0.5) * 2.2, 0, 1) * gA;   // a window that drifts in and out
        if (fw > 0.02) {
          ctx.fillStyle = 'rgba(255,200,120,' + (0.7 * fw).toFixed(3) + ')'; ctx.fillRect(-176, -210 + Math.sin(S.newTime) * 3, 14, 20);
          ctx.strokeStyle = 'rgba(40,26,24,' + fw.toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(-169, -210); ctx.lineTo(-169, -190); ctx.moveTo(-176, -200); ctx.lineTo(-162, -200); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fw * 0.5; ctx.drawImage(glow, -204, -236, 70, 70); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
      }
      ctx.globalAlpha = ap;
      ctx.fillStyle = 'rgba(6,4,10,0.38)'; ctx.beginPath(); ctx.ellipse(0, 2, 28 * wv + 8, 6, 0, 0, 6.3); ctx.fill();
      ctx.scale(s, s);
      var sway = Math.sin(TIME * 0.9 * S.motion) * 0.6;
      var coat = [46, 40, 50], coatLit = [96, 62, 52], skin = [190, 160, 140];
      // lantern light on the ground and body
      ctx.globalCompositeOperation = 'lighter';
      var lgx = 17 * wv + 6, lgy = -50, lg = ctx.createRadialGradient(lgx, lgy, 0, lgx, lgy, 80);
      lg.addColorStop(0, 'rgba(255,190,110,0.55)'); lg.addColorStop(0.4, 'rgba(255,150,70,0.18)'); lg.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = lg; ctx.fillRect(lgx - 80, lgy - 80, 160, 160);
      ctx.globalCompositeOperation = 'source-over';
      // pole
      ctx.strokeStyle = rgb([34, 28, 28]); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-14 * wv - 3, -58); ctx.lineTo(-30 * wv - 14, -176); ctx.stroke();
      ctx.beginPath(); ctx.arc(-30 * wv - 14 - 3, -178, 3.4, 0, 4.6); ctx.stroke();
      ctx.fillStyle = rgb([34, 28, 28]);
      // boots + legs
      ctx.fillRect(-8 * wv - 1, -8, 8 * wv, 8); ctx.fillRect(1, -8, 8 * wv, 8);
      ctx.fillStyle = rgb(dark(coat, 0.85)); ctx.fillRect(-7 * wv, -30, 6 * wv, 24); ctx.fillRect(1.5, -30, 6 * wv, 24);
      // coat
      var cg = ctx.createLinearGradient(-20, 0, 24, 0); cg.addColorStop(0, rgb(coat)); cg.addColorStop(0.7, rgb(mixc(coat, coatLit, 0.35))); cg.addColorStop(1, rgb(coatLit));
      ctx.fillStyle = cg; ctx.beginPath();
      ctx.moveTo(-17 * wv, -98); ctx.quadraticCurveTo(0, -106, 17 * wv, -98); ctx.lineTo(22 * wv, -24); ctx.lineTo(-22 * wv, -24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -98); ctx.lineTo(0, -24); ctx.stroke();
      ctx.fillStyle = 'rgb(176,138,70)'; for (var q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(-3 * turn, -88 + q * 14, 1.5, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = 'rgb(120,52,48)'; ctx.beginPath(); ctx.ellipse(0, -99, 11 * wv + 2, 4.5, 0, 0, 6.3); ctx.fill();
      // arm holding lantern
      ctx.strokeStyle = rgb(dark(coat, 1.05)); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(15 * wv, -94); ctx.lineTo(17 * wv + 6, -62); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgb(30,24,24)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lgx, -60); ctx.lineTo(lgx, -54); ctx.stroke();
      ctx.fillStyle = 'rgb(255,208,128)'; ctx.fillRect(lgx - 4, -53, 8, 11);
      ctx.strokeStyle = 'rgb(26,20,20)'; ctx.lineWidth = 1.4; ctx.strokeRect(lgx - 4.5, -53.5, 9, 12);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ap * 0.8; ctx.drawImage(glow, lgx - 18, -66, 36, 36); ctx.globalAlpha = ap; ctx.globalCompositeOperation = 'source-over';
      // head
      var hx = lerp(-6, 0, turn) + sway * 0.2 + gx * 1.6 * turn, hy = -113 + gy * 0.8 * turn;
      ctx.fillStyle = rgb(skin); ctx.beginPath(); ctx.ellipse(hx, hy, 8.6 * lerp(0.82, 1, turn), 10.6, 0, 0, 6.3); ctx.fill();
      if (turn < 0.95) { ctx.beginPath(); ctx.moveTo(hx - 7 * (1 - turn) - 4, hy - 1); ctx.lineTo(hx - 12 * (1 - turn) - 4, hy + 3); ctx.lineTo(hx - 6 * (1 - turn) - 4, hy + 4); ctx.closePath(); ctx.globalAlpha = ap * (1 - turn); ctx.fill(); ctx.globalAlpha = ap; }
      var fl = ctx.createLinearGradient(hx - 8, 0, hx + 9, 0); fl.addColorStop(0, 'rgba(20,12,20,0)'); fl.addColorStop(1, 'rgba(20,12,20,0.5)');
      ctx.fillStyle = fl; ctx.beginPath(); ctx.ellipse(hx, hy, 8.6 * lerp(0.82, 1, turn), 10.6, 0, 0, 6.3); ctx.fill();
      // cap
      ctx.fillStyle = 'rgb(30,26,36)'; ctx.beginPath(); ctx.ellipse(hx, hy - 7, 10.4 * lerp(0.85, 1, turn), 5.4, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(hx - 10 * lerp(0.85, 1, turn), hy - 8, 20 * lerp(0.85, 1, turn), 4);
      ctx.fillStyle = 'rgba(8,4,10,0.45)'; ctx.fillRect(hx - 8, hy - 4, 16, 3.4);
      // eyes: only once he has turned, and they follow the pointer
      if (turn > 0.35) {
        var ea = smooth((turn - 0.35) / 0.4);
        [-3.7, 3.7].forEach(function (ox) {
          ctx.fillStyle = 'rgba(236,232,220,' + ea + ')'; ctx.beginPath(); ctx.ellipse(hx + ox * turn, hy - 0.2, 2.5, 1.8, 0, 0, 6.3); ctx.fill();
          ctx.fillStyle = 'rgba(14,10,12,' + ea + ')'; ctx.beginPath(); ctx.arc(hx + ox * turn + gx * 1.1, hy - 0.2 + gy * 0.6, 1.1, 0, 6.3); ctx.fill();
        });
        ctx.strokeStyle = 'rgba(70,40,40,' + (ea * 0.6).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - 2.4, hy + 6); ctx.lineTo(hx + 2.4, hy + 6); ctx.stroke();
      }
      ctx.restore();
      // scale bookkeeping: expose the eye position for the caller (screen-space helper)
      S.figureEye = { x: f.x + hx * s, y: f.y + hy * s };
    }

    /* ---- compositing helpers */
    function drawVignetteGrain() {
      var vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.72);
      vg.addColorStop(0, 'rgba(6,4,10,0)'); vg.addColorStop(1, 'rgba(6,4,10,' + (0.5 + 0.1 * G).toFixed(2) + ')');
      ctx.fillStyle = vg; ctx.fillRect(-M, -40, W + M * 2, H + 80);
      // overall grade
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = rgb(mixc([255, 150, 80], [130, 170, 220], G), 0.22); ctx.fillRect(-M, -40, W + M * 2, H + 80);
      ctx.globalCompositeOperation = 'source-over';
      if (S.grain) {
        ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07;
        var ox = (Math.random() * 220) | 0, oy = (Math.random() * 220) | 0;
        ctx.save(); ctx.translate(-ox, -oy);
        ctx.fillStyle = ctx.createPattern(grain, 'repeat'); ctx.fillRect(ox - M, oy - 40, W + M * 2, H + 80); ctx.restore();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    function haze(y0, y1, k) {
      var gr = ctx.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, rgb(PAL.haze, 0)); gr.addColorStop(1, rgb(PAL.haze, k));
      ctx.fillStyle = gr; ctx.fillRect(-M, y0, W + M * 2, y1 - y0);
    }

    /* ---------------------------------------------------------------- frame */
    function render(c, st) {
      ctx = c; S = st; T = clamp(st.t, 0, 1); G = smooth(T); TIME = st.time; PAL = palette(G);
      camX = S.parallax ? Math.sin(TIME * 0.11) * 7 + S.pointer.x * 9 : 0;
      drawSky(); drawHills();
      // far bank
      drawGround(BANK_TOP, 612, 0.7);
      haze(450, 500, 0.45);
      drawFarStones();
      ctx.save(); var L0 = LAYERS;
      for (var layer = 0; layer < 3; layer++) {
        ctx.save(); ctx.translate(camX * L0[layer].par, 0);
        for (var i = 0; i < buildings.length; i++) if (buildings[i].layer === layer) drawBuilding(buildings[i]);
        if (layer === 0 || layer === 1) { ctx.restore(); haze(L0[layer].base - 120, L0[layer].base + 10, 0.2 + layer * 0.05); ctx.save(); ctx.translate(0, 0); }
        ctx.restore();
      }
      ctx.restore();
      // far-bank life
      ctx.save(); ctx.translate(camX * 0.8, 0);
      lamps.forEach(function (m) { if (m.s < 0.8) drawLamp(m); });
      people.forEach(function (pe) { if (pe.far) drawPerson(pe); });
      ctx.restore();
      drawQuay(590, 14, 0.88, 0.18);
      drawWater();
      ctx.save(); ctx.translate(camX * 0.88, 0);
      boats.forEach(drawBoat);
      ctx.restore();
      ctx.save(); ctx.translate(camX * 0.86, 0); bridge.forEach(drawBridgeSpan); ctx.restore();
      drawQuay(666, 22, 0.96, 0.04);
      // foreground
      drawGround(660 + 14, H, 1);
      ctx.save(); ctx.translate(camX, 0);
      lamps.forEach(function (m) { if (m.s >= 0.8) lampPool(m); });
      drawReeds(); drawBlades();
      var items = [];
      lamps.forEach(function (m) { if (m.s >= 0.8) items.push([m.y, function () { drawLamp(m); }]); });
      people.forEach(function (pe) { if (!pe.far) items.push([pe.y, function () { drawPerson(pe); }]); });
      items.push([cart.y, drawCart]); items.push([signStone.y, drawSignStone]); items.push([board.y, drawBoard]); items.push([figure.y, drawFigure]);
      items.sort(function (a, b) { return a[0] - b[0]; });
      items.forEach(function (it) { it[1](); });
      ctx.restore();
      drawBirds();
      haze(560, 700, 0.1);
      drawVignetteGrain();
    }
    function update(dt, st) {
      // walkers are integrated, not analytic, so they can stop and start smoothly
      var t = clamp(st.t, 0, 1);
      for (var i = 0; i < people.length; i++) {
        var pe = people[i], p = C.localProgress(t, pe.wave, pe.j), still = 1 - smooth((p - pe.freeze) / 0.06);
        var v = pe.v * still * st.motion; pe.x += v * dt; pe.ph += Math.abs(v) * dt * 0.28;
        if (pe.x > W + 60) pe.x = -60; if (pe.x < -60) pe.x = W + 60;
      }
      var cp = C.localProgress(t, cart.wave, cart.j), cs = 1 - smooth((cp - cart.freeze) / 0.06);
      cart.x += cart.v * cs * st.motion * dt; if (cart.x > W + 80) cart.x = -80;
      boats.forEach(function (b) { var p = C.localProgress(t, b.wave, b.j); b.x += b.v * (1 - smooth(p / 0.4)) * st.motion * dt; if (b.x > W + 120) b.x = -120; if (b.x < -120) b.x = W + 120; });
    }
    return { render: render, update: update, W: W, H: H, figure: figure };
  }

  window.SliceWorld = { createWorld: createWorld, W: W, H: H, PEN: PEN };
})();
