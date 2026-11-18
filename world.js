/* 岁月史书 · 世界改写
   落笔之后，全屏播放「世界被改写」：旧世界沿墨线崩塌，一片漆黑，新世界一笔一笔写出，代价留在新世界里。
   全部为程序生成的 SVG + CSS，无图片、无网络。样式见 world.css。
   对外：window.ChroniclesWorld = { play, cancel, active, variant, build } */
(function (root) {
  'use strict';

  var W = 1600, H = 900;
  var DR = false;          // true：画新世界（描边逐笔写出）；false：画旧世界（直接上色）
  var dn = 0;              // 新世界每个形状的描边延迟序号
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  /* ---------- 基本图形 ---------- */
  function rect(x, y, w, h) { return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h' + (-w) + 'z'; }
  function circ(cx, cy, r) { return 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0z'; }
  function pth(d, fill, cls, sw) {
    if (DR) {
      var dl = Math.min(1.5, dn * 0.04); dn++;
      return '<path class="dr' + (cls ? ' ' + cls : '') + '" pathLength="1" style="--d:' + dl.toFixed(2) + 's" d="' + d + '" fill="' + fill + '"/>';
    }
    return '<path' + (cls ? ' class="' + cls + '"' : '') + ' d="' + d + '" fill="' + fill + '" stroke="#150e09" stroke-width="' + (sw || 2.5) + '" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  /* 墨为眼：两只纯黑的眼，往下淌墨 */
  function eyes(cx, cy, s, d, rim) {
    var o = '<g class="eyes" style="--d:' + (d || 0).toFixed(2) + 's">';
    [-1, 1].forEach(function (sg) {
      var x = cx + sg * s * 0.9;
      o += '<ellipse cx="' + x.toFixed(1) + '" cy="' + cy + '" rx="' + (s * 0.5).toFixed(1) + '" ry="' + (s * 0.8).toFixed(1) + '" fill="#050302"' + (rim ? ' stroke="rgba(240,225,190,.55)" stroke-width="1"' : '') + '/>' +
        '<path d="M' + x.toFixed(1) + ' ' + (cy + s * 0.6) + 'q' + (sg * 1.5) + ' ' + (s * 1.6) + ' 0 ' + (s * 3.2) + '" stroke="#050302" stroke-width="' + Math.max(1.2, s * 0.22).toFixed(1) + '" fill="none" stroke-linecap="round"/>';
    });
    return o + '</g>';
  }
  /* 窗中的脸（代价的一部分，随墨的笔数增多） */
  function watcher(cx, cy, d) {
    return '<g class="eyes watcher" style="--d:' + d.toFixed(2) + 's"><ellipse cx="' + cx + '" cy="' + cy + '" rx="11" ry="14" fill="#d8c9a2"/></g>' + eyes(cx, cy - 1, 3.4, d + 0.15, false);
  }

  /* 人影。mode：up 仰望 / blank 无面 / eyes 墨为眼 / back 背影 */
  function fig(x, b, h, P, mode, d) {
    var s = pth('M' + (x - h * 0.17) + ' ' + b + 'L' + (x - h * 0.1) + ' ' + (b - h * 0.7) + 'Q' + x + ' ' + (b - h * 0.8) + ' ' + (x + h * 0.1) + ' ' + (b - h * 0.7) + 'L' + (x + h * 0.17) + ' ' + b + 'z', P.cloth);
    var hy = b - h * 0.84, hr = h * 0.1;
    s += pth(circ(x, hy, hr), mode === 'back' ? P.cloth : P.skin);
    if (mode === 'up') {
      s += pth(circ(x - hr * 0.35, hy - hr * 0.25, hr * 0.12), '#150e09', 'o-face', 1.5) + pth(circ(x + hr * 0.35, hy - hr * 0.25, hr * 0.12), '#150e09', 'o-face', 1.5);
    } else if (mode === 'eyes') {
      s += eyes(x, hy - hr * 0.05, hr * 0.28, d || 0, false);
    }
    return s;
  }

  function house(x, b, w, h, P, lit) {
    var s = pth(rect(x - w / 2, b - h, w, h), P.wall) +
      pth('M' + (x - w / 2 - 12) + ' ' + (b - h) + 'L' + x + ' ' + (b - h - h * 0.6) + 'L' + (x + w / 2 + 12) + ' ' + (b - h) + 'z', P.roof);
    var wins = [], wy = b - h * 0.72;
    [-0.24, 0.24].forEach(function (f) {
      var wx = x + w * f;
      s += pth(rect(wx - 11, wy, 22, 28), lit ? P.win : '#0b0705', lit ? 'o-win' : '');
      wins.push([wx, wy + 14]);
    });
    s += pth(rect(x - 10, b - 38, 20, 38), '#120b07');
    return { s: s, wins: wins };
  }
  var HOUSES = [{ x: 340, b: 692, w: 170, h: 120 }, { x: 560, b: 672, w: 130, h: 96 }, { x: 1060, b: 674, w: 130, h: 98 }, { x: 1270, b: 694, w: 170, h: 122 }];
  function town(P, lit, wrapCls) {
    var s = '', wins = [];
    HOUSES.forEach(function (o, i) {
      var h = house(o.x, o.b, o.w, o.h, P, lit);
      s += (wrapCls ? '<g class="' + wrapCls + '" style="--i:' + i + '">' + h.s + '</g>' : h.s);
      wins = wins.concat(h.wins);
    });
    return { s: s, wins: wins };
  }

  /* 钟楼：base 在 (x,b)，高 hh */
  function tower(x, b, hh, P, o) {
    o = o || {};
    var top = b - hh, cy = b - hh * 0.62;
    var s = pth('M' + (x - 46) + ' ' + b + 'L' + (x - 36) + ' ' + top + 'L' + (x + 36) + ' ' + top + 'L' + (x + 46) + ' ' + b + 'z', P.tower);
    s += pth('M' + (x - 41) + ' ' + (b - hh * 0.25) + 'h82M' + (x - 38) + ' ' + (b - hh * 0.45) + 'h76M' + (x - 36) + ' ' + (b - hh * 0.85) + 'h72', 'none', 'course', 1.5);
    s += pth(rect(x - 42, top - 62, 84, 62), P.tower2);
    s += pth('M' + (x - 22) + ' ' + (top - 8) + 'v-34a22 22 0 0 1 44 0v34z', '#0d0805');
    s += '<g class="' + (o.bellCls || 'bell') + '" style="transform-origin:' + x + 'px ' + (top - 52) + 'px">' +
      pth('M' + (x - 14) + ' ' + (top - 12) + 'q0 -24 14 -24q14 0 14 24z', o.bell || '#d9a441') + '</g>';
    s += pth('M' + (x - 54) + ' ' + (top - 62) + 'L' + x + ' ' + (top - 140) + 'L' + (x + 54) + ' ' + (top - 62) + 'z', P.roof);
    s += (o.clockGlow || '') + pth(circ(x, cy, 34), P.clock, o.clockCls || 'o-clock');
    if (o.hands !== false) s += pth('M' + x + ' ' + cy + 'v-22M' + x + ' ' + cy + 'l15 8', 'none', 'hands', 3);
    if (o.clockEyes) s += eyes(x, cy - 2, 5.5, o.clockEyes, true);
    return s;
  }

  function well(x, y, P, gone) {
    if (gone) return pth('M' + (x - 38) + ' ' + (y + 6) + 'a38 9 0 1 0 76 0a38 9 0 1 0 -76 0z', 'none', 'dashed', 2);
    return pth(rect(x - 24, y - 14, 48, 22), '#6f6252') + pth('M' + (x - 24) + ' ' + (y - 14) + 'v-30M' + (x + 24) + ' ' + (y - 14) + 'v-30', 'none', '', 3) +
      pth('M' + (x - 34) + ' ' + (y - 44) + 'L' + x + ' ' + (y - 66) + 'L' + (x + 34) + ' ' + (y - 44) + 'z', P.roof);
  }

  function hills(c) { return pth('M0 626Q200 556 420 606T820 596T1240 586T1600 606L1600 640L0 640z', c); }
  function ground(c) { return pth(rect(0, 628, W, H - 628), c); }
  function tufts(c) {
    var s = '';
    for (var i = 0; i < 22; i++) {
      var x = 40 + rnd() * 1520, y = 660 + rnd() * 220, k = 8 + rnd() * 10;
      s += pth('M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q3 ' + (-k) + ' 9 ' + (-k - 4) + 'M' + x.toFixed(0) + ' ' + y.toFixed(0) + 'q-3 ' + (-k) + ' -8 ' + (-k - 2), 'none', 'tuft', 1.6);
    }
    return s;
  }
  function grad(id, stops) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + stops.map(function (c, i) { return '<stop offset="' + (i / (stops.length - 1)) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient>';
  }
  function sky(id) { return pth(rect(0, 0, W, 632), 'url(#' + id + ')'); }

  /* ---------- 旧世界（案例一：沙下之钟） ---------- */
  var P_OLD = { wall: '#6b4a30', roof: '#3a2218', tower: '#7a5638', tower2: '#5e3f29', clock: '#ffe0a0', win: '#ffcf70', cloth: '#1d130d', skin: '#c9a27a' };
  function oldWorld() {
    DR = false; seed = 11;
    var s = '<rect class="o-sky" width="1600" height="632" fill="url(#gOldSky)"/>' +
      '<circle cx="1150" cy="590" r="300" fill="url(#gOldSun)"/>' +
      pth('M120 150q200 -30 420 10M900 110q220 -40 460 20M300 260q160 -20 330 6', 'none', 'cloud', 5) +
      hills('#4a3326') + ground('#3a281a') +
      pth('M700 900L780 630L820 630L930 900z', '#5a4130', 'road') + tufts();
    s += well(220, 650, P_OLD, false);
    s += pth('M770 470Q500 300 240 600', 'none', 'dashed o-sound', 2) + pth('M770 500Q520 360 250 610', 'none', 'dashed o-sound', 2);
    s += town(P_OLD, true, 'o-house').s;
    s += '<g class="o-tower" style="transform-origin:800px 650px">' + tower(800, 650, 380, P_OLD, { clockGlow: '<circle class="o-glow" cx="800" cy="414" r="90" fill="url(#gOldGlow)"/>' }) + '</g>';
    [[600, 150], [690, 165], [750, 130], [860, 130], [930, 168], [1020, 152]].forEach(function (f, i) {
      s += '<g class="o-folk" style="--i:' + i + '">' + fig(f[0], 800 + (i % 2) * 8, f[1], P_OLD, 'up') + '</g>';
    });
    return s;
  }

  /* ---------- 新世界 ---------- */
  function newWorld(key, k) {
    DR = true; dn = 0; seed = 23;
    var s = '', wins = [], P, defs = '';
    var kk = Math.max(0, Math.min(2, k | 0));
    if (key === 'c1-00') {          // 钟楼留下，过路人的影子脱落并爬行
      P = { wall: '#5d5a47', roof: '#2c2b22', tower: '#6e6a52', tower2: '#55523f', clock: '#e4dcae', win: '#d9d3a6', cloth: '#1a1812', skin: '#d6ccaa' };
      defs = grad('gNew', ['#d0c79c', '#8c876b', '#4a493c']);
      s += sky('gNew') + hills('#3b3a2c') + ground('#2b291e') + tufts();
      s += well(220, 650, P, false);
      var t0 = town(P, true); s += t0.s; wins = t0.wins;
      s += tower(800, 650, 380, P, { clockCls: 'pale-clock' });
      [[600, 150], [690, 165], [750, 130], [860, 130], [930, 168]].forEach(function (f, i) { s += fig(f[0], 800 + (i % 2) * 8, f[1], P, 'up'); });
      s += fig(1320, 820, 270, P, 'eyes', 0.4);
      s += '<g class="crawl">' + pth('M1180 862q60 -26 150 -8l70 -8l-8 16l-70 10q-70 14 -150 14l-40 14l6 -26z', '#050302') +
        pth('M1128 856q-30 -16 -44 -2q14 12 40 8z', '#050302') + pth('M1084 856l-40 -8M1084 860l-38 10M1090 864l-36 20', 'none', '', 3) + '</g>';
    } else if (key === 'c1-01') {   // 井没有了，镇子空了，钟对着空房子响
      P = { wall: '#4a5348', roof: '#1f2520', tower: '#59604f', tower2: '#444a3d', clock: '#1a1510', win: '#0b0705', cloth: '#111', skin: '#cfc3a0' };
      defs = grad('gNew', ['#7d8a78', '#3f4a43', '#1c231f']);
      s += sky('gNew') + hills('#26302a') + ground('#1d241d') + tufts();
      s += well(220, 650, P, true);
      var t1 = town(P, false); s += t1.s; wins = t1.wins;
      s += pth('M340 692L318 654L318 692z', '#0a0604') + pth('M1270 694L1292 656L1292 694z', '#0a0604');
      s += tower(800, 650, 380, P, { clockCls: 'dead-clock', hands: false, bellCls: 'bell swing' });
      s += pth('M640 560Q560 520 500 420M960 560Q1040 520 1100 420', 'none', 'dashed', 2);
      s += '<g class="eyes watcher cost-main" style="--d:0s"><ellipse cx="340" cy="630" rx="20" ry="26" fill="#d8c9a2"/></g>' + eyes(340, 626, 5.2, 0.15, false);
    } else if (key === 'c1-10') {   // 天变了颜色，无人抬头，面孔空白
      P = { wall: '#5b4a5c', roof: '#2a1e2e', tower: '#7a6a7c', tower2: '#5d4e60', clock: '#e8d36a', win: '#e8d36a', cloth: '#161018', skin: '#d9d0c4' };
      defs = grad('gNew', ['#1f8c86', '#b0397a', '#e8d36a']);
      s += sky('gNew') + hills('#3a2a3e') + ground('#2a1f2c') + tufts();
      s += well(220, 650, P, false);
      var t2 = town(P, true); s += t2.s; wins = t2.wins;
      s += pth(rect(740, 170, 120, 170), 'url(#gOldSky)', 'patch', 3) + pth(circ(800, 300, 26), '#ffe0a0', 'patch');
      s += pth(rect(720, 632, 160, 22), '#6a5a52', 'flat');
      [[560, 150], [640, 165], [720, 130], [880, 130], [960, 168], [1040, 152]].forEach(function (f, i) { s += fig(f[0], 800 + (i % 2) * 8, f[1], P, 'blank'); });
      s += fig(800, 860, 250, P, 'eyes', 0.4);
    } else if (key === 'c1-11') {   // 孩子站在空地，第二座钟楼从草里升起
      P = { wall: '#2e2b4a', roof: '#15132a', tower: '#4a456e', tower2: '#38345a', clock: '#cfc6e0', win: '#8a7fb0', cloth: '#0c0a16', skin: '#d6cfdc' };
      defs = grad('gNew', ['#101230', '#2d2a60', '#7a5a8a']) + '<clipPath id="cAbove"><rect x="0" y="0" width="1600" height="640"/></clipPath>';
      s += sky('gNew') + hills('#1c1a3a');
      s += '<g clip-path="url(#cAbove)"><g class="rise" style="transform-origin:800px 650px"><g transform="rotate(5 800 650)">' + tower(800, 650, 380, P, { clockEyes: 1.6, clockCls: 'child-clock', hands: false }) + '</g></g></g>';
      s += ground('#14122a') + tufts();
      s += well(220, 650, P, false);
      var t3 = town(P, false); s += t3.s; wins = t3.wins;
      s += fig(800, 840, 130, P, 'eyes', 0.4);
    } else {                        // 其他史事的通用后果
      var alt = /1$/.test(key);
      P = { wall: '#5a463c', roof: '#2a1c16', tower: '#6b5a4a', tower2: '#4d4034', clock: '#e0d2a8', win: '#d9c690', cloth: '#16100c', skin: '#d6c9ac' };
      defs = grad('gNew', alt ? ['#3a1020', '#8a2a2a', '#c07a4a'] : ['#c9c4a0', '#7c7a62', '#3e3d32']);
      s += sky('gNew') + hills('#2c2420') + ground('#221a14') + tufts();
      s += pth('M740 650L750 380Q800 350 850 380L860 650z', '#4d4034') + eyes(800, 470, 8, 0.2, true);
      [[560, 150], [640, 165], [960, 150], [1040, 160]].forEach(function (f, i) { s += fig(f[0], 800 + (i % 2) * 8, f[1], P, 'blank'); });
      s += fig(800, 860, 240, P, 'eyes', 0.4);
    }
    // 代价：墨越深，窗里的脸越多
    var extra = '';
    var order = [0, 3, 1, 2, 4, 5, 6, 7];
    for (var i = 0; i < kk * 3 && i < wins.length; i++) {
      var w = wins[order[i % order.length]];
      if (key === 'c1-01' && w[0] === 340 && w[1] < 640) continue;
      extra += watcher(w[0], w[1], 0.5 + i * 0.25);
    }
    DR = false;
    return { defs: defs, svg: s + extra };
  }

  /* ---------- 变体选择与整体组装 ---------- */
  function variant(e, n, a) { return e === 0 ? 'c1-' + (n | 0) + (a | 0) : 'gen-' + (e | 0) + '-' + ((a | 0) ? 1 : 0); }

  function ptsRift(py) {
    var top = '', bot = '';
    seed = 5;
    for (var x = -1400; x <= 1400; x += 70) { top += (x === -1400 ? 'M' : 'L') + x + ' ' + (-20 - rnd() * 16).toFixed(1); }
    for (var x2 = 1400; x2 >= -1400; x2 -= 70) { bot += 'L' + x2 + ' ' + (20 + rnd() * 16).toFixed(1); }
    return top + bot + 'z';
  }

  function build(key, k, px, py) {
    var nw = newWorld(key, k);
    var old = oldWorld();
    px = Math.max(0.2, Math.min(0.8, px == null ? 0.5 : px)) * W;
    py = Math.max(0.2, Math.min(0.7, py == null ? 0.4 : py)) * H;
    var ang = -14, rad = ang * Math.PI / 180, ex = 1800;
    var x1 = px - ex, y1 = py + (-ex) * Math.tan(rad), x2 = px + ex, y2 = py + ex * Math.tan(rad);
    var defs = '<defs>' + nw.defs + grad('gOldSky', ['#3b2a45', '#b5603c', '#f0b86a']) +
      '<radialGradient id="gOldSun"><stop offset="0" stop-color="#ffd48a" stop-opacity=".8"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gOldGlow"><stop offset="0" stop-color="#ffe3a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe3a0" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gDim" cx=".5" cy=".5" r=".75"><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="1"/></radialGradient>';
    var strips = '', i;
    for (i = 0; i < 5; i++) {
      var sy = 80 + i * 170 + (i % 2) * 20;
      defs += '<clipPath id="cStrip' + i + '"><rect x="0" y="' + sy + '" width="1600" height="' + (26 + (i * 13) % 30) + '"/></clipPath>';
      strips += '<g clip-path="url(#cStrip' + i + ')"><use class="o-strip" style="--i:' + i + '" href="#w-old"/></g>';
    }
    defs += '</defs>';
    var drops = '';
    seed = 31;
    for (i = 0; i < 16; i++) {
      drops += '<circle class="o-drop" cx="' + (770 + rnd() * 60).toFixed(0) + '" cy="' + (200 + rnd() * 220).toFixed(0) + '" r="' + (3 + rnd() * 6).toFixed(1) + '" style="--dx:' + ((rnd() - 0.5) * 80).toFixed(0) + 'px;--fy:' + (260 + rnd() * 300).toFixed(0) + 'px;--d:' + (0.2 + rnd() * 1.2).toFixed(2) + 's"/>';
    }
    var lines = 'M' + px.toFixed(0) + ' ' + py.toFixed(0) + 'L' + x1.toFixed(0) + ' ' + y1.toFixed(0);
    var lines2 = 'M' + px.toFixed(0) + ' ' + py.toFixed(0) + 'L' + x2.toFixed(0) + ' ' + y2.toFixed(0);
    return '<svg class="w-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true">' + defs +
      '<g class="w-new">' + nw.svg + '</g>' +
      '<rect class="w-dim" width="1600" height="900" fill="url(#gDim)" style="--dim:' + [0.3, 0.55, 0.8][Math.max(0, Math.min(2, k | 0))] + '"/>' +
      '<g class="w-oldwrap"><g id="w-old">' + old + '</g>' + strips + '<rect class="o-invert" width="1600" height="900" fill="#fff"/>' + drops + '</g>' +
      '<g class="w-rift" transform="translate(' + px.toFixed(0) + ' ' + py.toFixed(0) + ') rotate(' + ang + ')"><path class="w-rift-p" d="' + ptsRift() + '" fill="#050302"/></g>' +
      '<path class="w-ink" pathLength="1" d="' + lines + '"/><path class="w-ink" pathLength="1" d="' + lines2 + '"/>' +
      '<circle class="w-blot" cx="' + px.toFixed(0) + '" cy="' + py.toFixed(0) + '" r="14"/></svg>';
  }

  /* ---------- 播放 ---------- */
  var cur = null;

  function ensure() {
    var el = document.getElementById('world');
    if (el) return el;
    el = document.createElement('section'); el.id = 'world'; el.hidden = true;
    (document.getElementById('app') || document.body).appendChild(el);
    return el;
  }

  /* opts: { e, n, a, k, x, y, captions:[3], skipLabel, label, reduced } */
  function play(opts) {
    if (cur) cur.skip();
    var host = ensure(), chamber = document.getElementById('chamber');
    var prevFocus = document.activeElement;
    var key = variant(opts.e, opts.n, opts.a), k = Math.max(0, Math.min(2, opts.k | 0));
    var caps = opts.captions || ['', '', ''];
    var timers = [], done = false, resolveFn;
    var promise = new Promise(function (r) { resolveFn = r; });

    host.className = 'w-root rm-' + (opts.reduced ? '1' : '0') + ' v-' + key + ' k' + k + (opts.reduced ? ' rm' : '');
    host.setAttribute('aria-label', opts.label || '');
    host.innerHTML = '<div class="w-plate">' + build(key, k, opts.x, opts.y) +
      '<div class="w-burn b1"></div><div class="w-burn b2"></div><div class="w-burn b3"></div><div class="w-burn b4"></div>' +
      '<div class="w-black"><div class="w-beat"></div></div><div class="w-paper"></div>' +
      '<p class="w-cap" id="w-cap"></p></div>' +
      '<button type="button" class="w-skip" id="w-skip"></button>';
    var capEl = host.querySelector('#w-cap'), skipBtn = host.querySelector('#w-skip');
    skipBtn.textContent = opts.skipLabel || 'Skip';
    host.hidden = false;
    if (chamber) { chamber.setAttribute('inert', ''); chamber.setAttribute('aria-hidden', 'true'); }

    function at(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function stage() { for (var i = 0; i < arguments.length; i++) host.classList.add(arguments[i]); }
    function cap(i) {
      capEl.classList.remove('show');
      void capEl.offsetWidth;
      capEl.textContent = caps[i] || '';
      capEl.classList.add('show');
    }
    function finish() {
      if (done) return; done = true;
      timers.forEach(clearTimeout); timers = [];
      document.removeEventListener('keydown', onKey, true);
      host.hidden = true; host.innerHTML = ''; host.className = '';
      if (chamber) { chamber.removeAttribute('inert'); chamber.removeAttribute('aria-hidden'); }
      if (cur === api) cur = null;
      try { if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      resolveFn();
    }
    function skip() {
      if (done) return;
      timers.forEach(clearTimeout); timers = [];
      stage('s1', 's2', 's3', 's4', 's5', 'sf');
      cap(2);
      at(opts.reduced ? 400 : 700, function () { host.classList.add('out'); });
      at(opts.reduced ? 700 : 1200, finish);
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); skip(); }
      else if (ev.key === 'Tab') { ev.preventDefault(); skipBtn.focus(); }
    }
    skipBtn.addEventListener('click', skip);
    document.addEventListener('keydown', onKey, true);
    try { skipBtn.focus({ preventScroll: true }); } catch (e) { skipBtn.focus(); }

    if (opts.reduced) {
      // 减少动态：旧世界与新世界淡入淡出，不播放动画
      stage('s1');
      cap(0);
      at(1800, function () { stage('s3', 's4', 'sf'); cap(1); });
      at(3400, function () { stage('s5'); cap(2); });
      at(5400, function () { host.classList.add('out'); });
      at(5900, finish);
    } else {
      at(60, function () { stage('s1'); cap(0); });
      at(1000, function () { stage('s2'); });
      at(3600, function () { stage('s3'); cap(1); });
      at(4600, function () { stage('s4'); });
      at(6400, function () { stage('s5'); cap(2); });
      at(8500, function () { host.classList.add('out'); });
      at(9100, finish);
    }
    var api = { promise: promise, skip: skip, cancel: finish };
    cur = api;
    return api;
  }

  var api = {
    play: play,
    cancel: function () { if (cur) cur.cancel(); },
    active: function () { return !!cur; },
    variant: variant,
    build: build
  };
  root.ChroniclesWorld = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
