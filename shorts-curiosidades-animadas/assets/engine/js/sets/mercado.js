// Escenario: mercado al aire libre (puestos con toldos, fachadas de yeso, banderines, fuente central).
import * as THREE from 'three';
import { mat, box, cyl, sphere, floorPlane, group } from '../lib/toon.js';
import { mulberry32 } from '../lib/util.js';
import * as P from '../lib/props.js';

export function build(params = {}) {
  const rnd = mulberry32(params.seed || 5); const root = group(); const anchors = {}; const clouds = [];
  root.add(floorPlane(300, 300, mat('#5a5040'), 0, -0.03, 0));
  root.add(floorPlane(40, 36, mat({ color: '#ffffff', tex: 'cobble', texOpts: { color: '#9a9284' }, tile: 2.4 }), 0, 0, 0));
  // fachadas de fondo
  const cols = ['#e6d3a8', '#d9b6a0', '#c9d3b3', '#e8c8a0', '#b9c7d6'];
  for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
    const w = 5.2, x = -13 + i * 5.3, z = side * 13;
    const g = group(); g.add(box(w, 8.5 + (i % 3) * 0.8, 6, mat({ color: '#ffffff', tex: 'plaster', texOpts: { color: cols[(i + (side > 0 ? 2 : 0)) % cols.length] }, tile: 1.5 }), 0, 0, -3));
    g.add(box(w + 0.3, 0.35, 0.5, mat(P.COL.cream), 0, 8.5 + (i % 3) * 0.8, 0.1));
    for (let f = 0; f < 2; f++) for (const dx of [-1.2, 1.2]) { const s = P.sash(0.9, 1.5, (i + f + (dx > 0 ? 1 : 0)) % 3 === 0, ['#a63d3d', '#d8c38a', null][(i + f) % 3]); s.position.set(dx, 3.3 + f * 2.7, 0.04); g.add(s); }
    const d = P.door(1.0, 2.2, ['#2f5d4a', '#2d3f6e', '#8c2f2f'][i % 3]); d.position.set(0, 0, 0.04); g.add(d);
    g.position.set(x, 0, z); if (side > 0) g.rotation.y = Math.PI; root.add(g);
  }
  // puestos
  const awn = [['#c0463a', '#f4ead5'], ['#2f6b8a', '#f4ead5'], ['#c79a3b', '#f4ead5'], ['#4a7a3a', '#f4ead5']];
  [[-7, -7, 0.15], [-2, -8, -0.1], [4, -7.5, 0.1], [9, -7, -0.2], [-8, 6, Math.PI - 0.1], [-2.5, 7.5, Math.PI + 0.12], [4, 7, Math.PI - 0.05], [9.5, 6.5, Math.PI + 0.2]].forEach(([x, z, ry], i) => {
    const s = P.stall(2.6, awn[i % 4][0], awn[i % 4][1]); s.position.set(x, 0, z); s.rotation.y = ry; root.add(s); anchors[`stall${i}`] = [x, 0, z + (z < 0 ? 1.6 : -1.6)];
  });
  // fuente central
  const fn = group(); fn.add(cyl(1.6, 1.7, 0.6, mat(P.COL.stone), 0, 0, 0, 20)); fn.add(cyl(1.35, 1.35, 0.1, mat({ color: '#4b7fa0', emissive: '#1a3548', emissiveIntensity: 0.5 }), 0, 0.5, 0, 20)); fn.add(cyl(0.2, 0.28, 1.5, mat(P.COL.stone), 0, 0.5, 0, 12)); fn.add(cyl(0.6, 0.2, 0.2, mat(P.COL.stone), 0, 1.8, 0, 14));
  fn.position.set(0, 0, 0); root.add(fn);
  // banderines
  const flagCols = ['#c0463a', '#e0b13a', '#2f6b8a', '#4a7a3a'];
  for (let i = 0; i < 14; i++) { const t = i / 13; const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 3), new THREE.MeshToonMaterial({ color: flagCols[i % 4], gradientMap: mat('#fff').gradientMap })); f.rotation.x = Math.PI; f.position.set(-14 + t * 28, 6.0 - Math.sin(t * Math.PI) * 0.6 - 0.25, -1 + Math.sin(t * 3) * 0.2); f.castShadow = true; root.add(f); }
  root.add(box(28, 0.03, 0.03, mat('#2a2220'), 0, 6.0, -1.0));
  // barriles y cajas sueltas
  for (let i = 0; i < 6; i++) { const o = i % 2 ? P.barrel() : P.crate(0.7 + rnd() * 0.3); o.position.set(-12 + rnd() * 24, 0, (rnd() - 0.5) * 6); o.rotation.y = rnd() * 3; root.add(o); }
  for (let i = 0; i < 4; i++) { const c = P.cloud(1.3); c.position.set(-120 + i * 80, 60, -140); root.add(c); clouds.push(c); }
  anchors.center = [0, 0, 3.5]; anchors['plaza.w'] = [-8, 0, 2]; anchors['plaza.e'] = [8, 0, 2]; anchors.fountain = [0, 0, 2.2];
  return { group: root, anchors, update(t) { clouds.forEach((c, i) => { c.position.x = ((-120 + i * 80 + t * 0.4 + 120) % 320) - 120; }); }, bounds: { x: 40, z: 36, cx: 0, cz: 0, h: 12 }, info: {} };
}
