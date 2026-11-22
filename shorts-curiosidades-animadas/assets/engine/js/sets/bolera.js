// Escenario: bolera antigua (pista de madera, bolos, foso del "pinboy", lámparas colgantes, bancos).
import * as THREE from 'three';
import { mat, box, cyl, sphere, floorPlane, group } from '../lib/toon.js';
import * as P from '../lib/props.js';

function pin() {
  const g = group(); const w = mat('#f4f0e6'), r = mat('#c0392b');
  g.add(cyl(0.05, 0.06, 0.1, w, 0, 0, 0, 14)); g.add(cyl(0.11, 0.05, 0.12, w, 0, 0.1, 0, 14)); g.add(cyl(0.12, 0.11, 0.1, w, 0, 0.22, 0, 14));
  g.add(cyl(0.065, 0.12, 0.12, w, 0, 0.32, 0, 14)); g.add(cyl(0.055, 0.065, 0.1, r, 0, 0.4, 0, 14)); g.add(sphere(0.07, w, 0, 0.5, 0, 12));
  g.add(cyl(0.062, 0.062, 0.025, r, 0, 0.33, 0, 14));
  return g;
}
export function build(params = {}) {
  const root = group(); const anchors = {}; const L = 18;
  const lane = mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#d9a566', n: 12, vertical: true }, tile: 1.4 });
  root.add(floorPlane(40, 50, mat('#241c28'), 0, -0.05, -6));
  // suelo de aproximación y pista
  root.add(box(7, 0.1, 5, mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#9a6a42', n: 9 }, tile: 1.8 }), 0, -0.1, 3.5));
  root.add(box(1.4, 0.12, L + 4, lane, 0, -0.1, -L / 2 + 1));
  for (const s of [-1, 1]) {
    root.add(box(0.28, 0.08, L + 4, mat('#2b2530'), s * 0.85, -0.04, -L / 2 + 1));
    root.add(box(1.4, 0.35, L + 4, mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#7a5636', n: 6, vertical: true }, tile: 1.4 }), s * 1.95, -0.2, -L / 2 + 1));
  }
  // flechas de la pista
  for (let i = 0; i < 7; i++) { const a = box(0.05, 0.005, 0.5, mat('#5a3a22'), -0.45 + i * 0.15, 0.021, -5 - Math.abs(i - 3) * 0.2, { cast: false }); root.add(a); }
  root.add(box(1.3, 0.006, 0.05, mat('#5a3a22'), 0, 0.021, 0.0, { cast: false }));
  // bolos
  const rows = [[0], [-0.15, 0.15], [-0.3, 0, 0.3], [-0.45, -0.15, 0.15, 0.45]]; const pins = [];
  rows.forEach((r, ri) => r.forEach((x) => { const p = pin(); p.position.set(x, 0.02, -L + 1 - ri * 0.26); root.add(p); pins.push(p); }));
  // foso, plataforma del pinboy y cortina
  root.add(box(1.8, 0.1, 1.6, mat('#1a1418'), 0, -0.1, -L - 0.9));
  root.add(box(6, 0.9, 1.0, mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#5a3f27', n: 6 }, tile: 1.2 }), 0, -0.1, -L - 1.8));
  root.add(box(6.4, 3.2, 0.2, mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#6a4a33', n: 10, vertical: true }, tile: 1.3 }), 0, 0, -L - 2.3));
  root.add(box(3.4, 1.6, 0.1, mat('#6a1f2a'), 0, 0.9, -L - 1.2)); // cortina del foso
  root.add(box(3.8, 0.1, 0.1, mat(P.COL.brass), 0, 2.5, -L - 1.2));
  // paredes laterales y techo bajo
  for (const s of [-1, 1]) root.add(box(0.25, 3.4, L + 8, mat({ color: '#ffffff', tex: 'planks', texOpts: { color: '#8a6040', n: 10, vertical: true }, tile: 1.4 }), s * 4.2, 0, -L / 2 + 1));
  for (let i = 0; i < 5; i++) {
    const z = 1 - i * 4.6; const l = group();
    l.add(cyl(0.015, 0.015, 0.9, mat(P.COL.darkIron), 0, 0, 0, 6)); l.add(cyl(0.3, 0.1, 0.22, mat({ color: '#2f6b4a' }), 0, -0.2, 0, 16)); l.add(sphere(0.12, mat({ color: '#ffe0a0', emissive: '#ffd080', emissiveIntensity: 1.5 }), 0, -0.2, 0, 10));
    l.position.set(0, 3.2, z); root.add(l); root.add(P.glowSprite(0, 2.95, z, 2.4, '#ffc27a', 0.5));
  }
  // banco de espera + bolas
  const bn = box(2.2, 0.08, 0.45, mat(P.COL.wood), -3.0, 0.45, 3.2); root.add(bn); for (const dx of [-1, 1]) root.add(box(0.08, 0.45, 0.4, mat(P.COL.woodDark), -3.0 + dx * 0.95, 0, 3.2));
  const rack = box(1.4, 0.5, 0.5, mat(P.COL.woodDark), 2.6, 0, 1.6); root.add(rack);
  ['#223a8a', '#8a2a2a', '#2a6a3a'].forEach((c, i) => root.add(sphere(0.13, mat(c), 2.2 + i * 0.35, 0.65, 1.6, 14)));
  anchors.approach = [0, 0, 2.0]; anchors['lane.start'] = [0, 0, 0.6]; anchors['lane.mid'] = [0, 0, -8]; anchors['lane.pins'] = [0, 0, -L + 1.4]; anchors.pit = [0, 0.8, -L - 1.7];
  anchors.bench = [-3.0, 0.5, 3.2]; anchors.center = [0, 0, -4]; anchors.pitFront = [0, 0, -L - 0.6];
  return { group: root, anchors, update() {}, bounds: { x: 18, z: 36, cx: 0, cz: -8, h: 5 }, info: { pins: pins.length } };
}
