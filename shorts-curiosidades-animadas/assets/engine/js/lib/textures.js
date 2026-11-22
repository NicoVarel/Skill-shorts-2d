// Texturas procedurales (Canvas2D) para los escenarios: sin descargas, sin licencias.
import * as THREE from 'three';
import { mulberry32, clamp, lerp } from './util.js';

const cache = new Map();

function tex(canvas, repeatX = 1, repeatY = 1, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
function cv(w = 512, h = 512) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function jitter(hex, r, amt) {
  const n = parseInt(hex.slice(1), 16);
  const d = (r() - 0.5) * amt, h = (r() - 0.5) * amt * 0.18;
  const base = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const ch = base.map((v, i) => clamp(Math.round(v + d + (i === 0 ? h : i === 2 ? -h : 0)), 0, 255));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}
function speckle(g, w, h, r, n, a = 0.06) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
}

const makers = {
  brick(o) {
    const [c, g] = cv(512, 512); const r = mulberry32(o.seed || 3);
    const base = o.color || '#a65a3c', mortar = o.mortar || '#cdbfa6';
    g.fillStyle = mortar; g.fillRect(0, 0, 512, 512);
    const bh = 32, bw = 80, gap = 4;
    for (let y = 0, row = 0; y < 512; y += bh, row++) {
      const off = (row % 2) * (bw / 2);
      for (let x = -bw; x < 512 + bw; x += bw) {
        g.fillStyle = jitter(base, r, 42);
        g.fillRect(x + off + gap / 2, y + gap / 2, bw - gap, bh - gap);
        g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + off + gap / 2, y + bh - gap - 3, bw - gap, 3);
      }
    }
    speckle(g, 512, 512, r, 900, 0.07);
    return tex(c, o.rx || 1, o.ry || 1);
  },
  cobble(o) {
    const [c, g] = cv(512, 512); const r = mulberry32(o.seed || 5);
    g.fillStyle = o.gap || '#4b4640'; g.fillRect(0, 0, 512, 512);
    const base = o.color || '#8d867b';
    const cell = 64;
    for (let y = -cell; y < 512 + cell; y += 48) {
      for (let x = -cell; x < 512 + cell; x += 64) {
        const ox = ((y / 48) % 2) * 32 + (r() - 0.5) * 8, oy = (r() - 0.5) * 8;
        const rx = 26 + r() * 4, ry = 20 + r() * 3;
        const grd = g.createRadialGradient(x + ox - 6, y + oy - 6, 4, x + ox, y + oy, 34);
        const col = jitter(base, r, 38);
        grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(60,55,50,0.95)');
        g.fillStyle = grd; g.beginPath(); g.ellipse(x + ox + 32, y + oy + 24, rx, ry, 0, 0, Math.PI * 2); g.fill();
      }
    }
    speckle(g, 512, 512, r, 700, 0.06);
    return tex(c, o.rx || 1, o.ry || 1);
  },
  slab(o) { // losas de acera
    const [c, g] = cv(512, 512); const r = mulberry32(o.seed || 9);
    g.fillStyle = '#6f6a62'; g.fillRect(0, 0, 512, 512);
    const base = o.color || '#b4aca0';
    const w = 256, h = 128;
    for (let y = 0; y < 512; y += h) for (let x = 0; x < 512; x += w) {
      g.fillStyle = jitter(base, r, 26); g.fillRect(x + 3, y + 3, w - 6, h - 6);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 3, y + 3, w - 6, 6);
    }
    speckle(g, 512, 512, r, 1200, 0.07);
    return tex(c, o.rx || 1, o.ry || 1);
  },
  planks(o) {
    const [c, g] = cv(512, 512); const r = mulberry32(o.seed || 11);
    const base = o.color || '#9a6b43', n = o.n || 8, vertical = !!o.vertical;
    const pw = 512 / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = jitter(base, r, 34);
      if (vertical) g.fillRect(i * pw, 0, pw, 512); else g.fillRect(0, i * pw, 512, pw);
      g.strokeStyle = 'rgba(40,20,10,0.5)'; g.lineWidth = 3;
      g.beginPath(); if (vertical) { g.moveTo(i * pw, 0); g.lineTo(i * pw, 512); } else { g.moveTo(0, i * pw); g.lineTo(512, i * pw); } g.stroke();
      g.strokeStyle = 'rgba(60,30,12,0.18)'; g.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const p = i * pw + 4 + r() * (pw - 8);
        g.beginPath();
        if (vertical) { g.moveTo(p, 0); g.bezierCurveTo(p + 6, 170, p - 6, 340, p + 3, 512); } else { g.moveTo(0, p); g.bezierCurveTo(170, p + 6, 340, p - 6, 512, p + 3); }
        g.stroke();
      }
      // juntas de tablas
      const jx = r() * 512; g.strokeStyle = 'rgba(40,20,10,0.45)'; g.lineWidth = 3;
      g.beginPath(); if (vertical) { g.moveTo(i * pw, jx); g.lineTo(i * pw + pw, jx); } else { g.moveTo(jx, i * pw); g.lineTo(jx, i * pw + pw); } g.stroke();
    }
    return tex(c, o.rx || 1, o.ry || 1);
  },
  wallpaper(o) {
    const [c, g] = cv(512, 512); const r = mulberry32(o.seed || 13);
    const base = o.color || '#d9b98a', stripe = o.stripe || '#c9a56f', dot = o.dot || '#b98a54';
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) { g.fillStyle = stripe; g.fillRect(x, 0, 24, 512); }
    for (let y = 16; y < 512; y += 64) for (let x = 32; x < 512; x += 64) {
      g.fillStyle = dot; g.beginPath(); g.arc(x + 12, y, 5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + 12, y + 18, 3, 7, 0, 0, Math.PI * 2); g.fill();
    }
    speckle(g, 512, 512, r, 800, 0.05);
    return tex(c, o.rx || 1, o.ry || 1);
  },
  plaster(o) {
    const [c, g] = cv(256, 256); const r = mulberry32(o.seed || 17);
    g.fillStyle = o.color || '#e6d9bd'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, r, 1800, 0.07);
    return tex(c, o.rx || 1, o.ry || 1);
  },
  snow(o) {
    const [c, g] = cv(256, 256); const r = mulberry32(o.seed || 19);
    g.fillStyle = o.color || '#eef3fb'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = r() > 0.5 ? 'rgba(180,200,235,0.18)' : 'rgba(255,255,255,0.5)'; g.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 2); }
    return tex(c, o.rx || 1, o.ry || 1);
  },
  slate(o) {
    const [c, g] = cv(512, 512); const r = mulberry32(o.seed || 23);
    g.fillStyle = '#3c4152'; g.fillRect(0, 0, 512, 512);
    for (let y = 0, row = 0; y < 512; y += 36, row++) for (let x = -40; x < 520; x += 56) {
      g.fillStyle = jitter(o.color || '#566078', r, 30);
      g.beginPath(); g.moveTo(x + (row % 2) * 28, y); g.lineTo(x + (row % 2) * 28 + 54, y); g.lineTo(x + (row % 2) * 28 + 54, y + 28);
      g.quadraticCurveTo(x + (row % 2) * 28 + 27, y + 40, x + (row % 2) * 28, y + 28); g.closePath(); g.fill();
    }
    return tex(c, o.rx || 1, o.ry || 1);
  },
  tiles(o) {
    const [c, g] = cv(256, 256);
    const a = o.a || '#d9d1c0', b = o.b || '#4a4a52';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * 64, y * 64, 64, 64); }
    return tex(c, o.rx || 1, o.ry || 1);
  },
  cloth(o) { // mantel/manta con cuadros
    const [c, g] = cv(256, 256);
    const a = o.a || '#c0463a', b = o.b || '#f1e4cf';
    g.fillStyle = b; g.fillRect(0, 0, 256, 256);
    g.fillStyle = a; for (let i = 0; i < 256; i += 64) { g.globalAlpha = 0.9; g.fillRect(i, 0, 32, 256); g.fillRect(0, i, 256, 32); }
    g.globalAlpha = 1;
    return tex(c, o.rx || 1, o.ry || 1);
  },
  stripes(o) { // toldos rayados
    const [c, g] = cv(256, 64);
    const a = o.a || '#c0463a', b = o.b || '#f4ead5';
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * 32, 0, 32, 64); }
    return tex(c, o.rx || 1, o.ry || 1);
  },
  dirt(o) {
    const [c, g] = cv(256, 256); const r = mulberry32(o.seed || 29);
    g.fillStyle = o.color || '#8a7b62'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, r, 2200, 0.1);
    return tex(c, o.rx || 1, o.ry || 1);
  },
};

export function getTexture(kind, opts = {}) {
  const key = kind + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const t = makers[kind](opts);
  cache.set(key, t);
  return t;
}
