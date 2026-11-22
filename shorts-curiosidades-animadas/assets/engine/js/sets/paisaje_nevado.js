// Escenario: paisaje nevado con cabaña, pinos, montañas lejanas y sendero. Sin descargas: terreno y árboles procedurales.
import * as THREE from 'three';
import { mat, box, cyl, sphere, cone, floorPlane, group } from '../lib/toon.js';
import { mulberry32 } from '../lib/util.js';
import * as P from '../lib/props.js';

function height(x, z) {
  const d = Math.hypot(x, z * 0.8);
  const flat = Math.min(1, Math.max(0, (d - 14) / 26));
  return flat * (Math.sin(x * 0.11) * 2.2 + Math.cos(z * 0.09) * 2.6 + Math.sin((x + z) * 0.05) * 3.2) * 1.0;
}

export function build(params = {}) {
  const rnd = mulberry32(params.seed || 11); const root = group(); const anchors = {}; const puffs = [];
  // terreno
  const N = 90, S = 220;
  const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, height(x, z)); uv.setXY(i, x / 6, z / 6); }
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, mat({ color: '#ffffff', tex: 'snow', texOpts: { color: '#eef3fb' }, tile: 1 }));
  ground.receiveShadow = true; root.add(ground);
  // sendero (zona más gris)
  const path = floorPlane(3.2, 40, mat({ color: '#d5deea' }), 4, 0.03, 12); path.rotation.z = 0.0; root.add(path);
  // cabaña
  const cab = group();
  const logs = mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#8a5a38', n: 12 }, tile: 1.4 });
  cab.add(box(5.6, 2.8, 4.4, logs, 0, 0, 0));
  const roofM = mat('#d9e2ee');
  const r1 = box(6.4, 0.3, 2.9, mat('#6a4a36'), 0, 0, 0); r1.rotation.z = 0;
  for (const s of [-1, 1]) { const r = box(6.4, 0.25, 2.8, roofM, 0, 0, 0); r.position.set(0, 3.5, s * 1.1); r.rotation.x = s * 0.62; cab.add(r); const rs = box(6.4, 0.12, 2.8, mat('#6a4a36'), 0, 0, 0); rs.position.set(0, 3.38, s * 1.1); rs.rotation.x = s * 0.62; cab.add(rs); }
  cab.add(box(5.2, 1.0, 0.2, logs, 0, 2.8, 0));
  const d = P.door(0.95, 2.0, '#5b3a24'); d.position.set(-1.3, 0, 2.2); cab.add(d);
  const w = P.sash(0.9, 1.1, true, '#d8c38a'); w.position.set(1.4, 1.0, 2.2); cab.add(w);
  cab.add(P.glowSprite(1.4, 1.6, 2.4, 2.8, '#ffc070', 0.7));
  const ch = P.chimneyStack(0.8, 2.6); ch.position.set(1.8, 3.4, -0.6); cab.add(ch);
  cab.add(box(2.4, 0.15, 1.0, mat('#e8eef7'), -1.3, 2.2, 2.7)); // nieve en el porche
  cab.position.set(0, height(0, -14), -14); cab.rotation.y = 0.15; root.add(cab);
  const cy = cab.position.y;
  anchors['cabin.door'] = [-1.3 * Math.cos(0.15) + 2.7 * Math.sin(0.15), cy, -14 + 2.7 * Math.cos(0.15) + 1.3 * Math.sin(0.15)];
  anchors['cabin.window'] = [1.4, cy + 1.5, -14 + 2.3];
  const smokeSrc = [cab.position.x + 1.8 * Math.cos(0.15) - -0.6 * Math.sin(0.15), cy + 6.2, -14 + (-0.6) * Math.cos(0.15) + 1.8 * Math.sin(0.15) * -1];
  for (let k = 0; k < 8; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.smokeTexture(), color: '#e8e8ee', transparent: true, depthWrite: false })); sp.layers.set(1); sp.renderOrder = 4; root.add(sp); puffs.push({ sp, k }); }
  // pinos
  const trees = [];
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 9 + rnd() * 70, x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
    if (Math.abs(x - 4) < 3 && z > -10) continue; if (Math.hypot(x, z + 14) < 7) continue;
    const t = P.pine(4 + rnd() * 5, ['#2f5a45', '#2a5240', '#356650'][i % 3], true); t.position.set(x, height(x, z), z); t.rotation.y = rnd() * 6; root.add(t); trees.push([x, z]);
  }
  // pinos "protagonistas" cerca del camino
  for (const [x, z, h] of [[-5, -4, 6], [9, -2, 5.5], [-8, 6, 5], [11, 8, 6.4]]) { const t = P.pine(h, '#2f5a45', true); t.position.set(x, height(x, z), z); root.add(t); }
  // montañas lejanas
  const mtn = mat({ color: '#a9bcd6' }), cap = mat('#f3f7fd');
  [[-90, -120, 60], [-30, -140, 80], [40, -130, 70], [95, -115, 55], [140, -90, 48]].forEach(([x, z, h], i) => {
    const m = cone(h * 0.8, h, mtn, x, 0, z, 6); m.castShadow = false; root.add(m);
    const c = cone(h * 0.32, h * 0.38, cap, x, h * 0.62, z, 6); c.castShadow = false; root.add(c);
  });
  // vallas, farol y trineo
  for (let i = 0; i < 8; i++) { const x = -9 + i * 2, z = 2; root.add(box(0.12, 1.0, 0.12, mat('#6a4a36'), x, height(x, z), z)); }
  root.add(box(14, 0.1, 0.1, mat('#6a4a36'), -2, 0.75, 2)); root.add(box(14, 0.1, 0.1, mat('#6a4a36'), -2, 0.45, 2));
  const lp = P.lampPost(true); lp.scale.setScalar(0.8); lp.position.set(2.8, height(2.8, -8), -8); root.add(lp);
  anchors['path.start'] = [4, 0.05, 14]; anchors['path.mid'] = [4, 0.05, 2]; anchors['path.end'] = [-1, 0.05, -10]; anchors.center = [2, 0, 2]; anchors.lamp = [2.8, 0, -8];
  anchors.far = [0, 0, -60];
  const update = (t) => {
    puffs.forEach((p) => {
      const life = ((t * 0.12 + p.k / 8) % 1);
      p.sp.position.set(smokeSrc[0] + life * 3, smokeSrc[1] + life * 7, smokeSrc[2]);
      const sc = 1.0 + life * 5; p.sp.scale.set(sc, sc, 1); p.sp.material.opacity = Math.sin(life * Math.PI) * 0.6;
    });
  };
  return { group: root, anchors, update, bounds: { x: 60, z: 60, cx: 2, cz: 0, h: 20 }, info: { snow: true } };
}
