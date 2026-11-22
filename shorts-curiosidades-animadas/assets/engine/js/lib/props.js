// Biblioteca de props 3D procedurales (metros). Cada función devuelve un THREE.Group con origen en el suelo.
import * as THREE from 'three';
import { mat, box, cyl, sphere, cone, floorPlane, group, at } from './toon.js';
import { getTexture } from './textures.js';

export const COL = {
  cream: '#eadfc6', stone: '#b9ae9c', darkIron: '#2b3330', brass: '#c79a3b', slate: '#4b5268',
  woodDark: '#6e4a2c', wood: '#a06f45', woodLight: '#c79a68', warmWhite: '#f3ead4', brickRed: '#a65a3c',
  glassDark: '#2b3a52', glassLit: '#ffcf7a', paintGreen: '#2f5d4a', paintNavy: '#2d3f6e', paintRed: '#8c2f2f',
};

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,230,170,0.95)'); gr.addColorStop(0.35, 'rgba(255,190,100,0.35)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
let smokeTex;
export function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 64 + Math.cos(i * 1.9) * 22, y = 64 + Math.sin(i * 2.3) * 22, r = 30 + (i % 3) * 6;
    const gr = g.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(235,228,220,0.9)'); gr.addColorStop(1, 'rgba(235,228,220,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  smokeTex = new THREE.CanvasTexture(c); smokeTex.colorSpace = THREE.SRGBColorSpace;
  return smokeTex;
}
export function glowSprite(x, y, z, size, color = '#ffc070', opacity = 0.8) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(size, size, 1); s.layers.set(1); s.renderOrder = 5;
  s.userData.glow = true;
  return s;
}

// ---------- ventana de guillotina
export function sash(w = 1.0, h = 1.7, lit = false, curtain = null, glassColor = null) {
  const g = group();
  const frame = mat(COL.warmWhite);
  const glass = lit ? mat({ color: '#8a6a3a', emissive: COL.glassLit, emissiveIntensity: 1.1 }) : mat({ color: glassColor || COL.glassDark, emissive: '#1a2438', emissiveIntensity: 0.4 });
  const fw = 0.08;
  g.add(box(w, h, 0.04, glass, 0, 0, 0.0, { cast: false }));
  // marco
  g.add(box(w + fw * 2, fw, 0.12, frame, 0, -fw, 0.03, { cast: false }));
  g.add(box(w + fw * 2, fw, 0.12, frame, 0, h, 0.03, { cast: false }));
  g.add(box(fw, h + fw * 2, 0.12, frame, -w / 2 - fw / 2, -fw, 0.03, { cast: false }));
  g.add(box(fw, h + fw * 2, 0.12, frame, w / 2 + fw / 2, -fw, 0.03, { cast: false }));
  // astiles
  g.add(box(w, 0.05, 0.1, frame, 0, h / 2 - 0.02, 0.04, { cast: false }));
  g.add(box(0.05, h, 0.1, frame, 0, 0, 0.04, { cast: false }));
  if (curtain) {
    g.add(box(w * 0.46, h * 0.8, 0.03, mat(curtain), -w * 0.26, h * 0.12, 0.07, { cast: false }));
    g.add(box(w * 0.46, h * 0.8, 0.03, mat(curtain), w * 0.26, h * 0.12, 0.07, { cast: false }));
  }
  // dintel y alféizar de piedra
  g.add(box(w + 0.42, 0.2, 0.18, mat(COL.stone), 0, h + fw, 0.04));
  g.add(box(w + 0.3, 0.1, 0.26, mat(COL.stone), 0, -fw - 0.1, 0.08));
  return g;
}

export function door(w = 1.1, h = 2.35, color = COL.paintGreen) {
  const g = group();
  g.add(box(w + 0.3, h + 0.15, 0.14, mat(COL.warmWhite), 0, 0, 0.0));
  g.add(box(w, h, 0.1, mat(color), 0, 0, 0.07));
  // paneles
  for (const [dx, dy, ww, hh] of [[-0.24, 0.15, 0.38, 0.85], [0.24, 0.15, 0.38, 0.85], [-0.24, 1.15, 0.38, 0.55], [0.24, 1.15, 0.38, 0.55]]) {
    g.add(box(ww, hh, 0.04, mat(color).clone(), dx, dy, 0.13, { cast: false }));
  }
  g.add(sphere(0.045, mat(COL.brass), 0.35, 1.1, 0.16));
  g.add(box(0.28, 0.06, 0.03, mat(COL.brass), 0, 1.95, 0.15, { cast: false }));
  // montera
  g.add(box(w - 0.1, 0.3, 0.06, mat({ color: '#f1c066', emissive: '#e8a640', emissiveIntensity: 0.55 }), 0, h + 0.1, 0.07, { cast: false }));
  g.add(box(w + 0.5, 0.18, 0.4, mat(COL.stone), 0, h + 0.45, 0.14));
  return g;
}

export function lampPost(lit = true) {
  const g = group();
  g.add(cyl(0.16, 0.2, 0.5, mat(COL.darkIron), 0, 0, 0));
  g.add(cyl(0.06, 0.1, 3.4, mat(COL.darkIron), 0, 0.5, 0));
  g.add(box(0.7, 0.05, 0.05, mat(COL.darkIron), 0, 2.6, 0));
  g.add(cyl(0.05, 0.05, 0.1, mat(COL.darkIron), 0, 3.85, 0));
  const lantern = group();
  lantern.add(box(0.4, 0.06, 0.4, mat(COL.darkIron), 0, 0, 0));
  lantern.add(box(0.32, 0.5, 0.32, mat({ color: '#f0c36a', emissive: '#ffcf80', emissiveIntensity: lit ? 1.6 : 0.2 }), 0, 0.06, 0, { cast: false }));
  const roof = cone(0.3, 0.26, mat(COL.darkIron), 0, 0.56, 0, 4); roof.rotation.y = Math.PI / 4; lantern.add(roof);
  lantern.position.set(0, 3.8, 0); g.add(lantern);
  if (lit) g.add(glowSprite(0, 4.15, 0, 2.2, '#ffc27a', 0.7));
  g.userData.lanternY = 4.15;
  return g;
}

export function pillarBox() {
  const g = group();
  g.add(cyl(0.4, 0.44, 0.2, mat('#7a1d1d'), 0, 0, 0));
  g.add(cyl(0.36, 0.36, 1.35, mat('#b02828'), 0, 0.2, 0));
  g.add(cyl(0.42, 0.36, 0.14, mat('#8f1f1f'), 0, 1.55, 0));
  g.add(cyl(0.2, 0.42, 0.18, mat('#b02828'), 0, 1.69, 0));
  g.add(box(0.4, 0.07, 0.04, mat('#161012'), 0, 1.15, 0.36, { cast: false }));
  return g;
}
export function barrel(r = 0.4, h = 0.9, color = COL.wood) {
  const g = group();
  g.add(cyl(r * 0.92, r * 0.92, h, mat({ color, tex: 'planks', texOpts: { vertical: true, n: 6, color }, tile: 0.8 }), 0, 0, 0, 16));
  for (const y of [0.12, h * 0.5, h - 0.2]) g.add(cyl(r * 0.97, r * 0.97, 0.06, mat('#2c2c33'), 0, y, 0, 16));
  return g;
}
export function crate(s = 0.7, color = COL.woodLight) {
  const g = group();
  g.add(box(s, s, s, mat({ color, tex: 'planks', texOpts: { n: 5, color }, tile: 0.7 }), 0, 0, 0));
  for (const dx of [-1, 1]) g.add(box(0.06, s + 0.02, s + 0.02, mat(COL.woodDark), dx * (s / 2 - 0.05), 0, 0, { cast: false }));
  return g;
}
export function bollard() { const g = group(); g.add(cyl(0.11, 0.14, 0.75, mat(COL.darkIron), 0, 0, 0, 12)); g.add(sphere(0.12, mat(COL.darkIron), 0, 0.78, 0, 12)); return g; }
export function cart() {
  const g = group();
  g.add(box(2.2, 0.15, 1.2, mat(COL.woodDark), 0, 0.7, 0));
  g.add(box(2.2, 0.5, 0.08, mat(COL.wood), 0, 0.85, 0.56)); g.add(box(2.2, 0.5, 0.08, mat(COL.wood), 0, 0.85, -0.56));
  g.add(box(0.08, 0.5, 1.2, mat(COL.wood), -1.06, 0.85, 0));
  for (const dz of [-0.68, 0.68]) { const w = cyl(0.5, 0.5, 0.1, mat(COL.woodDark), -0.5, 0.0, dz, 18); w.rotation.x = Math.PI / 2; w.position.y = 0.5; g.add(w); }
  g.add(box(1.4, 0.06, 0.06, mat(COL.woodDark), 1.7, 0.7, 0));
  return g;
}
export function tree(h = 4, leaf = '#5f8a4a') {
  const g = group();
  g.add(cyl(0.12, 0.2, h * 0.45, mat(COL.woodDark), 0, 0, 0, 8));
  g.add(sphere(h * 0.32, mat(leaf), 0, h * 0.62, 0, 10));
  g.add(sphere(h * 0.22, mat(leaf), h * 0.14, h * 0.85, 0.1, 10));
  return g;
}
export function pine(h = 5, col = '#2f5a45', snow = true) {
  const g = group();
  g.add(cyl(0.1, 0.16, h * 0.2, mat(COL.woodDark), 0, 0, 0, 8));
  const n = 4;
  for (let i = 0; i < n; i++) {
    const r = h * 0.28 * (1 - i / (n + 0.6)), y = h * 0.14 + i * h * 0.19;
    g.add(cone(r, h * 0.3, mat(col), 0, y, 0, 10));
    if (snow) g.add(cone(r * 0.82, h * 0.2, mat('#eef4fb'), 0, y + h * 0.1, 0, 10));
  }
  return g;
}
export function chimneyStack(w = 0.8, h = 1.5) {
  const g = group();
  g.add(box(w, h, w, mat({ color: '#8f5a43', tex: 'brick', texOpts: { color: '#8f5a43', seed: 7 }, tile: 1.6 }), 0, 0, 0));
  g.add(box(w + 0.16, 0.14, w + 0.16, mat(COL.stone), 0, h, 0));
  for (const dx of [-0.17, 0.17]) g.add(cyl(0.1, 0.12, 0.45, mat('#b5583a'), dx, h + 0.14, 0, 10));
  return g;
}
export function cloud(scale = 1, seed = 1) {
  const g = group();
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.88, fog: false });
  const parts = [[0, 0, 0, 9], [8, -1, 1, 7], [-8, -1, -1, 7], [3, 4, 0, 6], [-4, 3, 1, 5]];
  for (const [x, y, z, r] of parts) { const s = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 12, 8), m); s.position.set(x * scale, y * scale, z * scale); s.scale.set(1, 0.55, 0.7); g.add(s); }
  g.traverse((o) => o.layers.set(2));
  return g;
}

// ---------- interior
export function bed(w = 1.3, l = 2.1, blanket = '#b0463a') {
  const g = group();
  g.add(box(w + 0.1, 0.9, 0.08, mat(COL.darkIron), 0, 0.1, -l / 2 - 0.04)); // cabecero
  g.add(box(w + 0.1, 0.55, 0.08, mat(COL.darkIron), 0, 0.1, l / 2 + 0.04));
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) g.add(cyl(0.04, 0.04, 0.5, mat(COL.darkIron), dx * (w / 2 + 0.03), 0, dz * (l / 2 + 0.04), 8));
  g.add(box(w, 0.2, l, mat(COL.woodDark), 0, 0.3, 0));
  g.add(box(w - 0.04, 0.22, l - 0.06, mat('#efe6d2'), 0, 0.5, 0));
  g.add(box(w - 0.02, 0.1, l * 0.62, mat({ color: blanket, tex: 'cloth', texOpts: { a: blanket, b: '#e8d9c0' }, tile: 0.5 }), 0, 0.7, l * 0.17));
  g.add(box(w * 0.72, 0.16, 0.44, mat('#f6efe0'), 0, 0.72, -l / 2 + 0.3));
  return g;
}
export function table(w = 1.8, d = 0.9, h = 0.78, cloth = null) {
  const g = group();
  g.add(box(w, 0.07, d, mat({ color: COL.wood, tex: 'planks', texOpts: { color: COL.wood, n: 6, vertical: false }, tile: 1.2 }), 0, h - 0.07, 0));
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) g.add(box(0.08, h - 0.07, 0.08, mat(COL.woodDark), dx * (w / 2 - 0.1), 0, dz * (d / 2 - 0.1)));
  if (cloth) g.add(box(w + 0.1, 0.03, d + 0.1, mat({ color: cloth, tex: 'cloth', texOpts: { a: cloth, b: '#f1e4cf' }, tile: 0.5 }), 0, h, 0));
  return g;
}
export function chair(color = COL.woodDark) {
  const g = group();
  g.add(box(0.5, 0.06, 0.5, mat(color), 0, 0.45, 0));
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) g.add(box(0.05, 0.45, 0.05, mat(color), dx * 0.21, 0, dz * 0.21));
  g.add(box(0.5, 0.5, 0.05, mat(color), 0, 0.52, -0.22));
  return g;
}
export function stool(h = 0.65, color = COL.woodDark) {
  const g = group();
  g.add(cyl(0.22, 0.22, 0.06, mat(color), 0, h - 0.06, 0, 14));
  for (const a of [0, 2.1, 4.2]) g.add(box(0.05, h - 0.06, 0.05, mat(color), Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15));
  return g;
}
export function wardrobe(w = 1.3, h = 2.1, d = 0.6) {
  const g = group();
  g.add(box(w, h, d, mat({ color: COL.woodDark, tex: 'planks', texOpts: { color: COL.woodDark, vertical: true, n: 5 }, tile: 1.2 }), 0, 0, 0));
  g.add(box(0.03, h - 0.3, 0.04, mat('#2a1a10'), 0, 0.15, d / 2 + 0.01, { cast: false }));
  g.add(box(w + 0.1, 0.12, d + 0.1, mat(COL.woodDark), 0, h, 0));
  for (const dx of [-0.08, 0.08]) g.add(sphere(0.03, mat(COL.brass), dx, h * 0.5, d / 2 + 0.04));
  return g;
}
export function bookshelf(w = 1.6, h = 2.2, d = 0.35) {
  const g = group();
  g.add(box(w, h, d, mat(COL.woodDark), 0, 0, 0));
  const cols = ['#8b2f2f', '#2e4f7a', '#3f6b4a', '#b8892f', '#5a3a6b', '#9a5a3a'];
  for (let r = 0; r < 5; r++) {
    g.add(box(w - 0.1, 0.04, d, mat('#4a2f1a'), 0, 0.2 + r * 0.42, 0.01, { cast: false }));
    let x = -w / 2 + 0.1;
    for (let i = 0; x < w / 2 - 0.15; i++) { const bw = 0.06 + ((i * 7 + r * 3) % 5) * 0.012, bh = 0.26 + ((i * 5 + r) % 4) * 0.03; g.add(box(bw, bh, d - 0.08, mat(cols[(i + r) % cols.length]), x + bw / 2, 0.24 + r * 0.42, 0.04, { cast: false })); x += bw + 0.01; }
  }
  return g;
}
export function desk(w = 1.7, d = 0.8, h = 0.78) {
  const g = group();
  g.add(box(w, 0.06, d, mat(COL.woodDark), 0, h - 0.06, 0));
  g.add(box(0.5, h - 0.06, d - 0.08, mat(COL.wood), -w / 2 + 0.3, 0, 0));
  g.add(box(0.5, h - 0.06, d - 0.08, mat(COL.wood), w / 2 - 0.3, 0, 0));
  g.add(box(0.5, 0.012, 0.36, mat('#2c5a46'), 0, h, 0.0, { cast: false }));
  return g;
}
export function rug(w = 2.6, d = 1.8, a = '#8c2f2f', b = '#e0c58c') {
  return floorPlane(w, d, mat({ color: a, tex: 'cloth', texOpts: { a, b }, tile: 0.7 }), 0, 0.012, 0);
}
export function candleLamp(lit = true) {
  const g = group();
  g.add(cyl(0.08, 0.1, 0.05, mat(COL.brass), 0, 0, 0, 10));
  g.add(cyl(0.03, 0.03, 0.2, mat('#f4eed6'), 0, 0.05, 0, 8));
  g.add(cone(0.035, 0.09, mat({ color: '#ffb02e', emissive: '#ffb02e', emissiveIntensity: 2 }), 0, 0.25, 0, 6));
  if (lit) g.add(glowSprite(0, 0.3, 0, 0.9, '#ffc070', 0.9));
  return g;
}
export function picture(w = 0.6, h = 0.8, color = '#8aa07a') {
  const g = group();
  g.add(box(w + 0.1, h + 0.1, 0.05, mat(COL.woodDark), 0, 0, 0));
  g.add(box(w, h, 0.03, mat(color), 0, 0.05, 0.03, { cast: false }));
  return g;
}
export function clockWall() {
  const g = group();
  const face = cyl(0.3, 0.3, 0.06, mat('#efe6d0'), 0, 0, 0, 24); face.rotation.x = Math.PI / 2; face.position.y = 0.3; g.add(face);
  g.add(box(0.03, 0.2, 0.02, mat('#222'), 0, 0.3, 0.05, { cast: false }));
  g.add(box(0.14, 0.03, 0.02, mat('#222'), 0.05, 0.3, 0.05, { cast: false }));
  return g;
}
export function stall(w = 2.6, awnA = '#c0463a', awnB = '#f4ead5') {
  const g = group();
  g.add(box(w, 0.9, 1.1, mat({ color: COL.wood, tex: 'planks', texOpts: { color: COL.wood, n: 6 }, tile: 1.2 }), 0, 0, 0));
  for (const dx of [-1, 1]) g.add(cyl(0.05, 0.05, 2.7, mat(COL.woodDark), dx * (w / 2 - 0.05), 0, -0.5, 8));
  const awn = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.08, 1.7), mat({ color: '#ffffff', tex: 'stripes', texOpts: { a: awnA, b: awnB, rx: 3 }, tile: 1 }));
  awn.position.set(0, 2.6, -0.1); awn.rotation.x = 0.28; awn.castShadow = true; g.add(awn);
  for (let i = 0; i < 5; i++) g.add(sphere(0.12, mat(['#c0463a', '#e0a53a', '#6b9a3a'][i % 3]), -w / 2 + 0.4 + i * (w - 0.8) / 4, 1.02, 0.1, 10));
  return g;
}
