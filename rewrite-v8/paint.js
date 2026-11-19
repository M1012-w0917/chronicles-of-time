// V8 paint: Canvas 2D oblique height-field renderer. One fixed camera at the kiln mouth looking down at the piece.
// Every frame is shaded from the same fields H (body), G (glaze), T (heat); nothing is blended between two images.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.V8Paint = factory(root.V8Core);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const W = 960, HC = 370, NX = C.NX, NY = C.NY, NC = C.NC, NS = NY * 2;
  const YT = 0.255 * HC, YB = 0.865 * HC;
  const clamp = C.clamp, smooth = C.smooth;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // camera: p(y) is the screen depth of grid row fraction y (0 far, 1 near); sc narrows the far edge, hs scales heights
  const pDepth = (y) => y * (0.7 + 0.3 * y), scAt = (y) => 0.8 + 0.2 * y, hsAt = (y) => 300 * (0.72 + 0.28 * y);
  const sy0 = (y) => YT + (YB - YT) * pDepth(y);
  function project(fx, fy, h) { return [W * 0.5 + (fx - 0.5) * W * scAt(fy), sy0(fy) - hsAt(fy) * h]; }

  // per-sample camera table, near to far
  const TAB = { sc: new Float32Array(NS + 1), ys: new Float32Array(NS + 1), hs: new Float32Array(NS + 1), gy: new Float32Array(NS + 1) };
  for (let k = 0; k <= NS; k++) { const y = 1 - k / NS; TAB.sc[k] = scAt(y) * W; TAB.ys[k] = sy0(y); TAB.hs[k] = hsAt(y); TAB.gy[k] = y * (NY - 1); }

  // ---- static craquelure map (jittered cells, thin lines where the two nearest seeds are almost equally far) ----
  const CRW = 480, CRH = 192;
  const CRACK = (function () {
    const out = new Uint8Array(CRW * CRH), R = C.rng(2024), cs = 11, gw = Math.ceil(CRW / cs) + 2, gh = Math.ceil(CRH / cs) + 2, sx = new Float32Array(gw * gh), sy = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { sx[j * gw + i] = (i - 1 + 0.15 + 0.7 * R()) * cs; sy[j * gw + i] = (j - 1 + 0.15 + 0.7 * R()) * cs; }
    for (let y = 0; y < CRH; y++) for (let x = 0; x < CRW; x++) {
      const ci = Math.floor(x / cs) + 1, cj = Math.floor(y / cs) + 1; let d1 = 1e9, d2 = 1e9;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const q = (cj + b) * gw + ci + a, d = Math.hypot(x - sx[q], (y - sy[q]) * 1.0); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const e = d2 - d1; out[y * CRW + x] = e < 0.9 ? 255 : e < 1.7 ? 140 : 0;
    }
    return out;
  })();

  // ---- colour helpers ----
  const GLZ = [[0, 0.96, 0.94, 0.88], [0.5, 0.74, 0.86, 0.80], [1.0, 0.36, 0.60, 0.56], [1.6, 0.11, 0.36, 0.37], [2.3, 0.03, 0.2, 0.25]];
  function glazeColor(th, o) {
    if (th >= GLZ[4][0]) { o[0] = GLZ[4][1]; o[1] = GLZ[4][2]; o[2] = GLZ[4][3]; return; }
    let q = 0; while (th > GLZ[q + 1][0]) q++;
    const a = GLZ[q], b = GLZ[q + 1], k = (th - a[0]) / (b[0] - a[0]);
    o[0] = a[1] + (b[1] - a[1]) * k; o[1] = a[2] + (b[2] - a[2]) * k; o[2] = a[3] + (b[3] - a[3]) * k;
  }
  const tone = (v) => 255 * Math.pow(1 - Math.exp(-1.2 * Math.max(0, v)), 0.85);

  const LX = -0.34, LY = 0.62, LZ = 0.56, LL = Math.hypot(LX, LY, LZ), lx = LX / LL, ly = LY / LL, lz = LZ / LL;
  const VX = 0, VY = 0.57, VZ = 0.82, hx0 = lx + VX, hy0 = ly + VY, hz0 = lz + VZ, HL = Math.hypot(hx0, hy0, hz0), hx = hx0 / HL, hy = hy0 / HL, hz = hz0 / HL;
  const CR_ = new Float32Array(NC), CG_ = new Float32Array(NC), CB_ = new Float32Array(NC), CA_ = new Float32Array(NC), SS = new Float32Array(NC), RAD = new Float32Array(NC);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) RAD[j * NX + i] = Math.exp(-(1 - j / (NY - 1)) * 1.5 - (i / (NX - 1)) * 0.3);
  const GRAIN = new Float32Array(NC);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) GRAIN[j * NX + i] = 0.8 + 0.4 * C.n2(i * 0.5, j * 0.5, 31);

  // shade every grid cell: normal of H+G, ember diffuse, glaze specular, thin-glaze translucency, heat emission, craquelure strength
  function shade(F, base, td, hd, w, time, reduced) {
    const H = F.H, G = F.G, T = F.T, PC = hd > 0 ? F.PC : null;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i, l = i > 0 ? k - 1 : k, rr = i < NX - 1 ? k + 1 : k, u = j > 0 ? k - NX : k, d = j < NY - 1 ? k + NX : k; SS[k] = H[k] + 0.5 * G[k] + 0.125 * (G[l] + G[rr] + G[u] + G[d]); }
    const gl = [0, 0, 0], cool = smooth((td - 0.55) / 0.4);
    let tg = 0; for (let k = 0; k < NC; k += 37) tg += T[k]; tg /= Math.ceil(NC / 37);
    const flick = reduced ? 1 : 1 + 0.05 * Math.sin(time * 6.1) + 0.03 * Math.sin(time * 11.7 + 1);
    const key = (0.85 + 0.3 * clamp(tg * 2.2) + 0.2 * w) * flick;
    for (let j = 0; j < NY; j++) {
      const jm = j > 0 ? j - 1 : j, jp = j < NY - 1 ? j + 1 : j;
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i, im = i > 0 ? i - 1 : i, ip = i < NX - 1 ? i + 1 : i;
        const dsx = (SS[j * NX + ip] - SS[j * NX + im]) / (ip - im) * NY, dsy = (SS[jp * NX + i] - SS[jm * NX + i]) / (jp - jm) * NY;
        const nl = 1 / Math.sqrt(dsx * dsx + dsy * dsy + 1), nx = -dsx * nl, ny = -dsy * nl, nz = nl;
        const g = G[k], th = g / C.G0, cov = 1 - Math.exp(-g / 0.0035);
        const tv = clamp(T[k] + w * 0.5 * RAD[k], 0, 1.3);
        glazeColor(th, gl);
        const gr = GRAIN[k], bR = 0.04 * gr, bG = 0.03 * gr, bB = 0.028 * gr;
        let r = bR + (gl[0] - bR) * cov, gg = bG + (gl[1] - bG) * cov, b = bB + (gl[2] - bB) * cov;
        const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
        const lr = key * (1.2 * diff) + 0.07 * nz + 0.04, lg = key * (0.92 * diff) + 0.09 * nz + 0.035, lb = key * (0.66 * diff) + 0.12 * nz + 0.04;
        r *= lr; gg *= lg; b *= lb;
        // glaze specular: sharper when hot and molten, softer once cooled
        const gloss = (0.38 + 0.62 * smooth(tv * 2.2)) * (1 - 0.35 * cool);
        const nh = Math.max(0, nx * hx + ny * hy + nz * hz), sp = (Math.pow(nh, 70) * 1.5 + Math.pow(nh, 9) * 0.12) * cov * gloss * key;
        r += sp * 1.0; gg += sp * 0.78; b += sp * 0.55;
        // incandescence
        const e = clamp(tv, 0, 1.2), em = smooth(e / 0.9) * 0.5;
        r += em * Math.min(1.3, e * 2.1); gg += em * clamp((e - 0.28) * 1.5, 0, 1) * 0.72; b += em * clamp((e - 0.72) * 1.4, 0, 1) * 0.45;
        if (hd > 0) {
          const pb = clamp((H[k] - base.H[k]) / 0.05), pc = PC[k];
          r += pb * 0.18 * hd + pc * 0.35; gg += pb * 0.05 * hd + pc * 0.09; b += pb * 0.01 * hd;
          const dk = 1 - 0.75 * pc * (1 - 0.3 * pb); r *= dk; gg *= dk; b *= dk;
        }
        CR_[k] = tone(r); CG_[k] = tone(gg); CB_[k] = tone(b);
        CA_[k] = cool * clamp(1 - T[k] * 2.5) * cov * (0.35 + 0.65 * Math.min(1, th));
      }
    }
  }

  // ---- background: the kiln wall with its firebox, drawn once ----
  let BG = null, TER = null, TERC = null, TERD = null, TER32 = null;
  function buildBG() {
    BG = mk(W, HC); const g = BG.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, HC); gr.addColorStop(0, '#060302'); gr.addColorStop(0.5, '#150a06'); gr.addColorStop(1, '#2a140a'); g.fillStyle = gr; g.fillRect(0, 0, W, HC);
    // brick courses
    const R = C.rng(5);
    for (let row = 0; row < 11; row++) {
      const y = row * 11 + 2, off = (row % 2) * 24;
      for (let x = -off; x < W; x += 48) { const v = 0.6 + 0.4 * R(); g.fillStyle = 'rgba(' + Math.round(70 * v) + ',' + Math.round(34 * v) + ',' + Math.round(20 * v) + ',' + (0.35 - row * 0.012).toFixed(3) + ')'; g.fillRect(x + 1, y, 46, 9); }
    }
    // firebox arch (left) and a small flue (right): dark openings that the heat lights up
    g.fillStyle = '#030100'; g.beginPath(); g.moveTo(70, 118); g.lineTo(70, 62); g.quadraticCurveTo(140, 8, 210, 62); g.lineTo(210, 118); g.closePath(); g.fill();
    g.fillStyle = '#020100'; g.beginPath(); g.moveTo(770, 118); g.lineTo(770, 80); g.quadraticCurveTo(810, 46, 850, 80); g.lineTo(850, 118); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,60,30,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(66, 118); g.lineTo(66, 62); g.quadraticCurveTo(140, 2, 214, 62); g.lineTo(214, 118); g.stroke();
    g.beginPath(); g.moveTo(766, 118); g.lineTo(766, 80); g.quadraticCurveTo(810, 40, 854, 80); g.lineTo(854, 118); g.stroke();
    TER = mk(W, HC); TERC = TER.getContext('2d', { willReadFrequently: true }); TERD = TERC.createImageData(W, HC); TER32 = new Uint32Array(TERD.data.buffer);
  }
  // little sparks rising from the mouth side
  const SPARKS = []; { const R = C.rng(404); for (let q = 0; q < 26; q++) SPARKS.push({ x: R(), p: R(), sp: 0.04 + 0.08 * R(), sw: R() * 6.28 }); }

  const last = { fields: null, base: null, pose: null, td: 0, hd: 0 };
  function draw(g, o) {
    if (!BG) buildBG();
    const td = o.td, hd = o.hd, w = o.w || 0, time = o.time || 0;
    const base = C.fieldsAt(td);
    let F = base, pose = null;
    if (hd > 0) { const r = C.applyPalm(base, hd, o.bookX); F = r.fields; pose = r.pose; }
    last.fields = F; last.base = base; last.pose = pose; last.td = td; last.hd = hd;
    shade(F, base, td, hd, w, time, o.reduced);
    TER32.fill(0);
    const px = TER32, S = SS, ncr = 0.5;
    const cx = W / 2;
    for (let sx = 0; sx < W; sx++) {
      let top = HC;
      // front face of the slab: glaze lip, then bare dark clay lit from the ember
      {
        const gxf = (sx / (W - 1)) * (NX - 1), i0 = Math.min(NX - 2, gxf | 0), fx = gxf - i0, k = (NY - 1) * NX + i0;
        const h = S[k] * (1 - fx) + S[k + 1] * fx, sy = Math.max(0, Math.ceil(sy0(1) - hsAt(1) * h));
        const lr = CR_[k] * (1 - fx) + CR_[k + 1] * fx, lg = CG_[k] * (1 - fx) + CG_[k + 1] * fx, lb = CB_[k] * (1 - fx) + CB_[k + 1] * fx;
        const heat = F.T[k] * (1 - fx) + F.T[k + 1] * fx;
        for (let y = sy; y < HC; y++) {
          const d = y - sy, lip = d < 5 ? 1 : 0, fade = clamp(1 - d / 70), shd = 0.35 + 0.65 * fade;
          let r = lip ? lr : (26 + 38 * fade) * shd * (0.9 + 0.2 * Math.sin(sx * 0.3 + y * 0.11)) + heat * 150 * fade, gq = lip ? lg : (18 + 16 * fade) * shd + heat * 55 * fade, b = lip ? lb : (15 + 10 * fade) * shd + heat * 10 * fade;
          if (d >= 5 && d < 9) { r *= 0.55; gq *= 0.55; b *= 0.55; }
          px[y * W + sx] = (255 << 24) | (Math.min(255, b) << 16) | (Math.min(255, gq) << 8) | Math.min(255, r);
        }
        top = sy;
      }
      for (let kk = 0; kk <= NS; kk++) {
        const sc = TAB.sc[kk], gxf = ((sx - cx) / sc + 0.5) * (NX - 1);
        if (gxf < 0 || gxf > NX - 1) continue;
        const gy = TAB.gy[kk], j0 = Math.min(NY - 2, gy | 0), fy = gy - j0, i0 = Math.min(NX - 2, gxf | 0), fx = gxf - i0;
        const k = j0 * NX + i0, k1 = k + NX;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        const h = S[k] * w00 + S[k + 1] * w10 + S[k1] * w01 + S[k1 + 1] * w11;
        const sy = TAB.ys[kk] - TAB.hs[kk] * h;
        if (sy >= top) continue;
        let r = CR_[k] * w00 + CR_[k + 1] * w10 + CR_[k1] * w01 + CR_[k1 + 1] * w11, gq = CG_[k] * w00 + CG_[k + 1] * w10 + CG_[k1] * w01 + CG_[k1 + 1] * w11, b = CB_[k] * w00 + CB_[k + 1] * w10 + CB_[k1] * w01 + CB_[k1 + 1] * w11;
        const ca = CA_[k] * w00 + CA_[k + 1] * w10 + CA_[k1] * w01 + CA_[k1 + 1] * w11;
        if (ca > 0.02) {
          const xm = gxf - F.U[k], mx = clamp(xm / (NX - 1)) * (CRW - 1), my = (gy / (NY - 1)) * (CRH - 1);
          const c = CRACK[(my | 0) * CRW + (mx | 0)] / 255;
          if (c > 0) { const m = 1 - ncr * ca * c; r *= m; gq *= m; b *= m; }
        }
        const y0 = Math.max(0, Math.ceil(sy)), col = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((gq > 255 ? 255 : gq) << 8) | (r > 255 ? 255 : r);
        for (let y = y0; y < top; y++) px[y * W + sx] = col;
        top = y0;
        if (top <= 0) break;
      }
    }
    TERC.putImageData(TERD, 0, 0);
    // compose: wall, firebox glow, piece, lamp, sparks, vignette
    let tg = 0; for (let k = 0; k < NC; k += 41) tg += base.T[k]; tg /= Math.ceil(NC / 41);
    const heat = clamp(0.12 + tg * 1.5 + w * 0.5);
    g.globalCompositeOperation = 'source-over'; g.drawImage(BG, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const [gx, gy, rx] of [[140, 100, 150], [810, 108, 90]]) { const gr = g.createRadialGradient(gx, gy, 6, gx, gy, rx); gr.addColorStop(0, 'rgba(255,' + Math.round(110 + 80 * heat) + ',40,' + (0.12 + 0.75 * heat).toFixed(3) + ')'); gr.addColorStop(0.5, 'rgba(180,50,10,' + (0.06 + 0.3 * heat).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(120,30,5,0)'); g.fillStyle = gr; g.fillRect(gx - rx, gy - rx, rx * 2, rx * 2); }
    g.globalCompositeOperation = 'source-over';
    g.drawImage(TER, 0, 0);
    // the keeper's lamp: a small flame on the crown of the fourth arch, only while that crown stands
    {
      const j = C.BR_ROWS[3], i = Math.round(C.XC[j]), k = j * NX + i, ht = base.H[k] - C.BANK;
      const lit = smooth((ht - 0.03) / 0.05);
      if (lit > 0.02) {
        const p = project(i / (NX - 1), j / (NY - 1), base.H[k] + base.G[k] + 0.012), fl = o.reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 9);
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(p[0], p[1], 0.5, p[0], p[1], 15); gr.addColorStop(0, 'rgba(255,220,140,' + (0.9 * lit * fl).toFixed(3) + ')'); gr.addColorStop(0.3, 'rgba(255,140,50,' + (0.4 * lit * fl).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)');
        g.fillStyle = gr; g.fillRect(p[0] - 16, p[1] - 16, 32, 32); g.globalCompositeOperation = 'source-over';
      }
    }
    if (!o.reduced) {
      g.globalCompositeOperation = 'lighter';
      for (const s of SPARKS) { const ph = (s.p + time * s.sp) % 1, x = (s.x * 0.5 + 0.02) * W + Math.sin(time * 1.3 + s.sw) * 14, y = HC * 0.94 - ph * HC * 0.7, a = Math.sin(ph * 3.14159) * (0.15 + 0.5 * heat); g.fillStyle = 'rgba(255,150,60,' + a.toFixed(3) + ')'; g.fillRect(x, y, 1.6, 1.6); }
      g.globalCompositeOperation = 'source-over';
    }
    const vg = g.createRadialGradient(W / 2, HC * 0.55, HC * 0.35, W / 2, HC * 0.55, W * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)'); g.fillStyle = vg; g.fillRect(0, 0, W, HC);
  }

  // field sample at grid fractions (fx along the river-crossing axis, fy 0 far..1 near) of the shown fields, palm included
  function sample(fx, fy) {
    const F = last.fields || C.fieldsAt(0), gx = clamp(fx) * (NX - 1), gy = clamp(fy) * (NY - 1), i0 = Math.min(NX - 2, gx | 0), j0 = Math.min(NY - 2, gy | 0), ax = gx - i0, ay = gy - j0;
    const bl = (A) => { const k = j0 * NX + i0; return (A[k] * (1 - ax) + A[k + 1] * ax) * (1 - ay) + (A[k + NX] * (1 - ax) + A[k + NX + 1] * ax) * ay; };
    return { H: bl(F.H), G: bl(F.G), T: bl(F.T), U: bl(F.U) };
  }
  return { W, HC, mk, draw, project, sample, last, shade };
});
