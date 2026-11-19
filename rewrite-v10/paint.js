// V10 renderer: one Canvas 2D. Grains are drawn from a small set of pre-rendered sprites (role colour x three shades), no DOM per grain,
// no alpha on grains. The brass frame, glass and desk are static cached layers. Gate and keel are drawn from the core machine state.
(function (root) {
  'use strict';
  const C = root.V10Core;
  const CW = 960, CH = 560, OX = 80, OY = 70;   // canvas size and chamber origin (the chamber is 800 x 420 sim units at scale 1)
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rgb = (c, k) => 'rgb(' + Math.min(255, Math.round(c[0] * k)) + ',' + Math.min(255, Math.round(c[1] * k)) + ',' + Math.min(255, Math.round(c[2] * k)) + ')';

  // role base colours, only for colour and tests, never forces
  const BASE = { bed: [178, 148, 100], dam: [214, 138, 28], deck: [236, 218, 172], keeper: [255, 206, 60], reserve: [128, 164, 186] };
  const BLD = [[214, 64, 58], [46, 168, 160], [150, 84, 190], [64, 118, 214], [92, 176, 82], [240, 126, 100], [244, 244, 236], [226, 176, 40]];
  const SHADES = [0.84, 1, 1.14];

  function sprite(col, k) {
    const s = mk(7, 7), x = s.getContext('2d');
    const g = x.createRadialGradient(2.6, 2.4, 0.4, 3.5, 3.5, 3.2);
    g.addColorStop(0, rgb(col, k * 1.25)); g.addColorStop(0.6, rgb(col, k)); g.addColorStop(1, rgb(col, k * 0.62));
    x.fillStyle = g; x.beginPath(); x.arc(3.5, 3.5, 2.75, 0, 6.2832); x.fill();
    return s;
  }
  let sprites = null, sprIndex = null;
  function buildSprites(store) {
    const list = [], idx = {};
    const add = (key, col) => { idx[key] = list.length; for (let s = 0; s < 3; s++) list.push(sprite(col, SHADES[s])); };
    add('bed', BASE.bed); add('dam', BASE.dam); add('deck', BASE.deck); add('keeper', BASE.keeper); add('reserve', BASE.reserve);
    BLD.forEach((c, i) => add('b' + i, c));
    sprites = list; sprIndex = new Uint16Array(store.N);
    for (let i = 0; i < store.N; i++) {
      const r = store.role[i]; let key = C.ROLE_NAMES[r]; if (r === C.ROLE.bld) key = 'b' + (store.grp[i] % BLD.length);
      sprIndex[i] = idx[key] + Math.floor(C.hash(i, 5) * 2.999);
    }
  }

  // ---- static layers ----
  function gradV(x, y0, y1, stops) { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach((s) => g.addColorStop(s[0], s[1])); return g; }
  function brassRect(x, a, b, c, d, w) { // brass frame bar with a bevel
    x.fillStyle = gradV(x, b, d, [[0, '#e6c26a'], [0.5, '#a67a2e'], [1, '#5e4116']]); x.fillRect(a, b, c - a, d - b);
    x.strokeStyle = 'rgba(255,240,190,0.5)'; x.lineWidth = 1; x.strokeRect(a + 0.5, b + 0.5, c - a - 1, d - b - 1);
  }
  let back = null, front = null;
  function buildStatic() {
    back = mk(CW, CH); const x = back.getContext('2d');
    x.fillStyle = gradV(x, 0, CH, [[0, '#17110c'], [1, '#0b0805']]); x.fillRect(0, 0, CW, CH);
    // wood desk strip below the frame
    x.fillStyle = gradV(x, 510, CH, [[0, '#3c2812'], [1, '#22150a']]); x.fillRect(0, 512, CW, CH - 512);
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(0,0,0,' + (0.05 + C.hash(i, 3) * 0.07).toFixed(3) + ')'; x.fillRect(0, 514 + C.hash(i, 4) * 44, CW, 1); }
    // chamber interior
    x.fillStyle = gradV(x, OY, OY + 420, [[0, '#1b2733'], [0.6, '#131c25'], [1, '#0d141b']]); x.fillRect(OX, OY, 800, 420);
    x.strokeStyle = 'rgba(120,160,190,0.06)'; x.lineWidth = 1;
    for (let gx = 0; gx <= 800; gx += 50) { x.beginPath(); x.moveTo(OX + gx + 0.5, OY); x.lineTo(OX + gx + 0.5, OY + 420); x.stroke(); }
    for (let gy = 0; gy <= 420; gy += 50) { x.beginPath(); x.moveTo(OX, OY + gy + 0.5); x.lineTo(OX + 800, OY + gy + 0.5); x.stroke(); }
    // brass frame: four bars
    brassRect(x, OX - 20, OY - 20, OX + 820, OY, 20); brassRect(x, OX - 20, OY + 420, OX + 820, OY + 440, 20);
    brassRect(x, OX - 20, OY, OX, OY + 420, 20); brassRect(x, OX + 800, OY, OX + 820, OY + 420, 20);
    front = mk(CW, CH); const f = front.getContext('2d');
    // glass sheen over the sand
    f.save(); f.beginPath(); f.rect(OX, OY, 800, 420); f.clip();
    f.fillStyle = 'rgba(190,225,255,0.05)'; f.beginPath(); f.moveTo(OX + 80, OY); f.lineTo(OX + 220, OY); f.lineTo(OX + 20, OY + 420); f.lineTo(OX - 60, OY + 420); f.fill();
    f.fillStyle = 'rgba(190,225,255,0.035)'; f.beginPath(); f.moveTo(OX + 300, OY); f.lineTo(OX + 340, OY); f.lineTo(OX + 140, OY + 420); f.lineTo(OX + 100, OY + 420); f.fill();
    const sh = f.createLinearGradient(0, OY, 0, OY + 40); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = sh; f.fillRect(OX, OY, 800, 40);
    f.restore();
    f.strokeStyle = 'rgba(0,0,0,0.6)'; f.lineWidth = 2; f.strokeRect(OX - 1, OY - 1, 802, 422);
    // rivets
    [[OX - 10, OY - 10], [OX + 810, OY - 10], [OX - 10, OY + 430], [OX + 810, OY + 430], [OX + 400, OY - 10], [OX + 400, OY + 430]].forEach((p) => {
      f.fillStyle = '#d8b862'; f.beginPath(); f.arc(p[0], p[1], 3.2, 0, 6.2832); f.fill(); f.fillStyle = 'rgba(0,0,0,0.5)'; f.beginPath(); f.arc(p[0] + 1, p[1] + 1, 1.3, 0, 6.2832); f.fill();
    });
  }

  function gear(g, cx, cy, r, teeth, ang, w) {
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const a0 = (i / (teeth * 2)) * 6.2832, rr = i % 2 ? r : r + 4.5, a1 = a0 + 3.1416 / teeth * 0.82; g.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); g.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr); }
    g.closePath();
    const gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, w > 0.02 ? '#f2d070' : '#d6b25a'); gr.addColorStop(1, '#6b4a18');
    g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(40,24,6,0.8)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#2a1b08'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(Math.cos(i * 1.5708) * r * 0.55, Math.sin(i * 1.5708) * r * 0.55, r * 0.17, 0, 6.2832); g.fill(); }
    g.beginPath(); g.arc(0, 0, r * 0.2, 0, 6.2832); g.fillStyle = '#e8cd80'; g.fill();
    g.restore();
  }
  function hourglass(g, cx, cy, ang) { // decoration: the vessel rotates from near horizontal to upright over the rewrite
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.fillStyle = '#c9a24c'; g.fillRect(-18, -26, 36, 5); g.fillRect(-18, 21, 36, 5);
    g.fillStyle = 'rgba(180,215,240,0.28)'; g.beginPath(); g.moveTo(-13, -21); g.lineTo(13, -21); g.lineTo(2, 0); g.lineTo(13, 21); g.lineTo(-13, 21); g.lineTo(-2, 0); g.closePath(); g.fill();
    g.strokeStyle = '#e8cd80'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#d6a24a'; g.beginPath(); g.moveTo(-9, 21); g.lineTo(9, 21); g.lineTo(3, 9); g.lineTo(-3, 9); g.closePath(); g.fill();
    g.restore();
  }
  const span = (s, a, b) => { const v = Math.min(1, Math.max(0, (s - a) / (b - a))); return v * v * (3 - 2 * v); };

  let evCache = null;
  function draw(g, v) {
    if (!back) buildStatic();
    if (!sprites) buildSprites(v.store);
    if (!evCache) evCache = C.events();
    const store = v.store, xy = v.xy, step = v.pf * store.spf, m = C.machineAt(step), grav = C.gravityAt(step);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(back, 0, 0);
    // decoration tied to the timeline: gears turn with the playhead and bite in order while writing
    const tl = v.pf / store.fNew, w = v.w || 0, ang = tl * 9;
    gear(g, 38, 150, 24, 14, ang * 1.0 + w * 3.1, w); gear(g, 38, 214, 17, 10, -ang * 1.41 - w * 4.4 + 0.2, w > 0.3 ? w : 0); gear(g, 40, 300, 30, 16, ang * 0.8 + w * 2.6, w > 0.55 ? w : 0);
    gear(g, 922, 160, 28, 15, -ang * 0.9 - w * 2.8, w > 0.15 ? w : 0); gear(g, 922, 232, 17, 10, ang * 1.53 + w * 4.6, w > 0.45 ? w : 0); gear(g, 920, 320, 26, 14, -ang * 1.1 - w * 3.3, w > 0.7 ? w : 0);
    gear(g, 140, 536, 16, 9, ang * 1.2, 0); gear(g, 176, 540, 11, 7, -ang * 1.7, 0);
    hourglass(g, 64, 38, (1 - span(tl, 0, 1)) * 1.4);
    // tilt gauge on the desk: a plumb line whose angle is the gravity tilt of the machine
    g.save(); g.translate(880, 524); g.strokeStyle = '#8a6a2c'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 24, 0.35, 2.79); g.stroke();
    g.rotate(-grav.deg * Math.PI / 180 * 2.2); g.strokeStyle = '#e8cd80'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 26); g.stroke(); g.fillStyle = '#f2d070'; g.beginPath(); g.arc(0, 28, 4, 0, 6.2832); g.fill(); g.restore();
    // chamber contents (glass tremor only when not reduced)
    const trem = v.reduced ? 0 : (w * 1.1 + (m.keel > 0.05 && m.keel < 0.98 ? 0.6 : 0));
    g.save(); g.beginPath(); g.rect(OX, OY, 800, 420); g.clip();
    g.translate(OX + (trem ? Math.sin(v.time * 61) * trem : 0), OY + (trem ? Math.cos(v.time * 47) * trem : 0));
    for (let i = 0; i < store.N; i++) g.drawImage(sprites[sprIndex[i]], ((xy[2 * i] - 3.5) + 0.5) | 0, ((xy[2 * i + 1] - 3.5) + 0.5) | 0);
    // hopper walls and brass gate
    const hp = C.HOPPER, dy = m.hopperDy;
    if (dy > -hp.bot - 4) {
      g.strokeStyle = '#b08a38'; g.lineWidth = hp.wall * 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(C.CX - hp.hw, hp.top + dy); g.lineTo(C.CX - hp.hw, hp.bot + dy); g.moveTo(C.CX + hp.hw, hp.top + dy); g.lineTo(C.CX + hp.hw, hp.bot + dy); g.stroke();
      g.strokeStyle = 'rgba(255,236,170,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(C.CX - hp.hw - 1.5, hp.top + dy); g.lineTo(C.CX - hp.hw - 1.5, hp.bot + dy); g.moveTo(C.CX + hp.hw - 1.5, hp.top + dy); g.lineTo(C.CX + hp.hw - 1.5, hp.bot + dy); g.stroke();
      g.fillStyle = gradV(g, hp.gateY + dy - 3, hp.gateY + dy + 3, [[0, '#f0d078'], [1, '#7a5518']]);
      g.fillRect(C.CX - hp.hw - 2 + m.gateX - 3, hp.gateY + dy - 3, hp.hw * 2 + 10, 6);
    }
    // keel: brass wedge pushed down through the middle, then lifted
    if (m.keelY > -C.M.keelH - 12) {
      const kx = C.CX + m.keelX, hw = C.M.keelHW, kh = C.M.keelH, ya = m.keelY;
      const kg = g.createLinearGradient(kx - hw, 0, kx + hw, 0); kg.addColorStop(0, '#7a5a1e'); kg.addColorStop(0.5, '#e6c26a'); kg.addColorStop(1, '#7a5a1e');
      g.fillStyle = kg; g.strokeStyle = '#3a280c'; g.lineWidth = 2; g.beginPath(); g.moveTo(kx - hw, ya - kh); g.lineTo(kx + hw, ya - kh); g.lineTo(kx, ya); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(60,40,10,0.55)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { const yy = ya - kh + kh * k / 5, hh = hw * (1 - k / 5); g.beginPath(); g.moveTo(kx - hh, yy); g.lineTo(kx + hh, yy); g.stroke(); }
    }
    g.restore();
    // knock rings and cracks on the glass: pure functions of the playhead frame (reversible)
    g.save(); g.beginPath(); g.rect(OX, OY, 800, 420); g.clip();
    const kc = [C.CX + OX, 150 + OY];
    evCache.knocks.forEach((k, ki) => {
      const d = v.pf - k.f; if (d <= 0) return;
      if (!v.reduced && d < 36) { g.strokeStyle = 'rgba(210,235,255,' + (0.8 * (1 - d / 36)).toFixed(3) + ')'; g.lineWidth = 2.5 - d / 20; g.beginPath(); g.arc(kc[0], kc[1], 6 + d * 4.5, 0, 6.2832); g.stroke(); }
      const grow = Math.min(1, d / 8); g.strokeStyle = 'rgba(225,240,255,0.72)'; g.lineWidth = 1;
      const nl = 5 + ki * 2;
      for (let j = 0; j < nl; j++) {
        const a = C.hash(j + ki * 17, 9) * 6.2832, len = (34 + ki * 26) * (0.5 + C.hash(j, 21 + ki)) * grow;
        g.beginPath(); g.moveTo(kc[0], kc[1]); const mx = kc[0] + Math.cos(a) * len * 0.5 + Math.sin(a) * 4, my = kc[1] + Math.sin(a) * len * 0.5 - Math.cos(a) * 4;
        g.lineTo(mx, my); g.lineTo(kc[0] + Math.cos(a + 0.12) * len, kc[1] + Math.sin(a + 0.12) * len); g.stroke();
      }
    });
    g.restore();
    g.drawImage(front, 0, 0);
    return { gate: m.gate, keel: m.keel, tilt: grav.deg, tremor: trem };
  }

  root.V10Paint = { CW, CH, OX, OY, mk, draw, BASE, BLD };
})(typeof self !== 'undefined' ? self : this);
