// Escenario: calle victoriana (casas adosadas de ladrillo, farolas de gas, adoquines, fábrica o muelles al fondo).
import * as THREE from 'three';
import { mat, box, cyl, sphere, floorPlane, group, at } from '../lib/toon.js';
import { mulberry32 } from '../lib/util.js';
import * as P from '../lib/props.js';

const FACADES = [
  { color: '#a85b3c', mortar: '#cdbfa6' }, { color: '#c4a86e', mortar: '#d9ccaa' }, { color: '#93503a', mortar: '#c2b79f' },
  { color: '#b06a45', mortar: '#d1c4a8' }, { color: '#8a5a4a', mortar: '#c7bba2' },
];
const DOORS = [P.COL.paintGreen, P.COL.paintNavy, P.COL.paintRed, '#2b2b30', '#7a5a2d'];
const CURTAINS = ['#a63d3d', '#d8c38a', '#4a6b8a', '#e6dcc8', null];

function house(w, i, rnd, side, litMask) {
  const g = group();
  const H = 9.2, fcol = FACADES[(i * 2 + (side > 0 ? 1 : 0)) % FACADES.length];
  const bm = mat({ color: '#ffffff', tex: 'brick', texOpts: { color: fcol.color, mortar: fcol.mortar, seed: 3 + i }, tile: 1.6 });
  const body = box(w, H, 8, bm, 0, 0, -4);
  g.add(body);
  g.add(box(w + 0.12, 0.55, 0.14, mat({ color: P.COL.stone, tex: 'slab', tile: 1.2 }), 0, 0, 0.07));
  for (const y of [3.35, 6.2]) g.add(box(w + 0.1, 0.16, 0.14, mat(P.COL.cream), 0, y, 0.07));
  g.add(box(w + 0.5, 0.36, 0.5, mat(P.COL.cream), 0, H, 0.14));
  g.add(box(w - 0.2, 0.5, 0.2, mat(fcol.color).clone(), 0, H + 0.36, -0.1));
  // tejado
  g.add(box(w + 0.1, 0.5, 6.5, mat({ color: '#ffffff', tex: 'slate', tile: 1.6 }), 0, H + 0.2, -4));
  // chimeneas
  const ch = P.chimneyStack(0.8, 1.7); ch.position.set(-w * 0.28, H + 0.6, -3); g.add(ch);
  if (i % 2 === 0) { const ch2 = P.chimneyStack(0.8, 1.5); ch2.position.set(w * 0.28, H + 0.6, -3); g.add(ch2); g.userData.chimneys = [[w * 0.28, H + 2.5, -3], [-w * 0.28, H + 2.7, -3]]; } else g.userData.chimneys = [[-w * 0.28, H + 2.7, -3]];
  // puerta + escalones
  const dx = (i % 2 ? 1 : -1) * w * 0.22;
  const d = P.door(1.1, 2.35, DOORS[(i * 3 + (side > 0 ? 2 : 0)) % DOORS.length]); d.position.set(dx, 0.3, 0.07); g.add(d);
  g.add(box(1.7, 0.15, 0.7, mat(P.COL.stone), dx, 0, 0.35));
  g.add(box(1.45, 0.15, 0.5, mat(P.COL.stone), dx, 0.15, 0.3));
  // ventanas
  const wins = {};
  const wxs = [(i % 2 ? -1 : 1) * w * 0.26];
  const addWin = (x, y, key, lit, curtain) => {
    const s = P.sash(1.0, 1.75, lit, curtain); s.position.set(x, y, 0.07); g.add(s); wins[key] = [x, y + 0.9, 0.2];
  };
  addWin(wxs[0], 0.95, 'w0', false, CURTAINS[(i + 1) % CURTAINS.length]);
  const upper = [-w * 0.25, w * 0.25];
  [3.85, 6.7].forEach((y, f) => upper.forEach((x, k) => {
    const lit = !!litMask[(i * 5 + f * 2 + k) % litMask.length];
    addWin(x, y, `w${f + 1}${k ? 'b' : 'a'}`, lit, CURTAINS[(i + f + k) % CURTAINS.length]);
  }));
  g.userData.dx = dx; g.userData.wins = wins; g.userData.w = w;
  return g;
}

function factory(x) {
  const g = group();
  const bm = mat({ color: '#ffffff', tex: 'brick', texOpts: { color: '#7d4636', mortar: '#b9ab94', seed: 21 }, tile: 1.6 });
  g.add(box(14, 13, 28, bm, 0, 0, 0));
  g.add(box(14.6, 0.5, 28.6, mat(P.COL.stone), 0, 13, 0));
  // portón en arco (rectangular con dintel)
  g.add(box(0.2, 5.2, 5.4, mat('#2e3a34'), -7.05, 0, 0));
  g.add(box(0.5, 0.5, 6.4, mat(P.COL.stone), -7.1, 5.2, 0));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const lit = (r + c) % 3 !== 1;
    const s = P.sash(1.2, 1.6, lit); s.rotation.y = -Math.PI / 2; s.position.set(-7.05, 6.0 + r * 2.2, -11 + c * 4.4);
    if (r === 0 && c === 2 || r === 0 && c === 3) s.visible = false; else g.add(s);
  }
  const chim = cyl(0.9, 1.4, 38, mat({ color: '#ffffff', tex: 'brick', texOpts: { color: '#8a4a38', mortar: '#b9ab94', seed: 33 }, tile: 1.6 }), 4, 13, 8, 18);
  g.add(chim); g.add(cyl(1.15, 0.95, 0.6, mat(P.COL.stone), 4, 50.5, 8, 18));
  g.position.set(x, 0, 0); g.userData.chimneys = [[x + 4, 51.2, 8]];
  return g;
}

function muelles(x) {
  const g = group();
  const wall = mat({ color: '#ffffff', tex: 'brick', texOpts: { color: '#7a5240', mortar: '#b9ab94', seed: 41 }, tile: 1.6 });
  g.add(box(9, 8, 22, wall, 0, 0, -6));
  g.add(box(9.6, 0.4, 22.6, mat(P.COL.stone), 0, 8, -6));
  // muelle de madera + agua
  g.add(box(12, 0.6, 30, mat({ color: P.COL.woodDark, tex: 'planks', texOpts: { color: '#6e5238', vertical: true, n: 10 }, tile: 2 }), 11, -0.1, 0));
  const water = floorPlane(60, 70, mat({ color: '#31506b', emissive: '#14283a', emissiveIntensity: 0.5 }), 40, -0.9, 0); g.add(water);
  // grúa
  g.add(box(0.5, 12, 0.5, mat(P.COL.darkIron), 12, 0, 8));
  g.add(box(10, 0.5, 0.5, mat(P.COL.darkIron), 8, 11.5, 8));
  const rope = box(0.05, 6, 0.05, mat('#2a2220'), 4, 5.5, 8); g.add(rope);
  g.add(box(1.2, 1.2, 1.2, mat(P.COL.woodLight), 4, 4.3, 8));
  // mástil de barco
  g.add(cyl(0.18, 0.2, 18, mat(P.COL.woodDark), 20, 0, -8, 8));
  g.add(box(6, 0.2, 0.2, mat(P.COL.woodDark), 20, 12, -8));
  g.add(box(10, 2.2, 3.6, mat('#2a2a35'), 20, -0.9, -8));
  g.position.set(x, 0, 0);
  return g;
}

export function build(params = {}) {
  const rnd = mulberry32(params.seed || 7);
  const root = group();
  const anchors = {};
  const n = params.houses || 8;
  const lit = params.lit || [0, 1, 0, 0, 1, 0, 0, 0, 1, 0];
  const ROAD = params.roadHalf || 3.3, SIDE = ROAD + 1.7;
  const x0 = -n * 2.45;
  const smokeSources = [];
  const animated = [];

  // suelo
  root.add(floorPlane(300, 300, mat({ color: '#4c4639', tex: 'dirt', tile: 3 }), 0, -0.02, 0));
  root.add(floorPlane(90, ROAD * 2, mat({ color: '#ffffff', tex: 'cobble', texOpts: { color: '#8a8478' }, tile: 2.4 }), 0, 0, 0));
  // aceras
  for (const s of [-1, 1]) {
    root.add(box(90, 0.14, SIDE - ROAD, mat({ color: '#ffffff', tex: 'slab', tile: 1.8 }), 0, 0, s * (ROAD + (SIDE - ROAD) / 2)));
    root.add(box(90, 0.2, 0.18, mat('#9a9288'), 0, 0, s * (ROAD + 0.05)));
  }
  const sides = [{ s: -1, key: 'F', z: -SIDE }, { s: 1, key: 'N', z: SIDE }];
  const bounds = [];
  for (const sd of sides) {
    if (sd.s > 0 && params.nearHouses !== true) continue;
    let x = x0;
    for (let i = 0; i < n; i++) {
      const w = 4.4 + ((i * 37) % 7) * 0.12;
      const h = house(w, i + (sd.s > 0 ? 3 : 0), rnd, sd.s, lit);
      const cx = x + w / 2;
      h.position.set(cx, 0, sd.z);
      if (sd.s > 0) h.rotation.y = Math.PI;
      root.add(h);
      // anclas (coordenadas de mundo)
      const toWorld = (lx, ly, lz) => sd.s > 0 ? [cx - lx, ly, sd.z - lz] : [cx + lx, ly, sd.z + lz];
      const nm = `${sd.key}${i}`;
      anchors[`${nm}.door`] = toWorld(h.userData.dx, 0.4, 0.9);
      anchors[`${nm}.pave`] = toWorld(h.userData.dx, 0.14, 1.9);
      anchors[`${nm}.below`] = toWorld(0, 0.14, 1.9);
      for (const [k, v] of Object.entries(h.userData.wins)) {
        anchors[`${nm}.${k}`] = toWorld(v[0], v[1], v[2]);
        anchors[`${nm}.${k}.below`] = toWorld(v[0], 0.14, 1.9);
      }
      (h.userData.chimneys || []).forEach((c) => smokeSources.push(toWorld(c[0], c[1], c[2])));
      x += w + 0.02;
      if (sd.s < 0) bounds.push(x);
    }
  }
  // farolas (en las juntas entre casas, lejos de puertas y ventanas)
  const lampPositions = [];
  bounds.forEach((bx, i) => {
    if (![0, 1, 5, 6].includes(i) && !params.allLamps) return;
    for (const s of (params.nearHouses === true ? [-1, 1] : [-1])) {
      const lz = s * (ROAD + 0.45);
      const lp = P.lampPost(true); lp.position.set(bx, 0.14, lz); root.add(lp);
      anchors[`lamp${i}${s < 0 ? 'F' : 'N'}`] = [bx, 0.14, lz];
      lampPositions.push([bx, 4.2, lz]);
    }
  });
  // mobiliario
  const pb = P.pillarBox(); pb.position.set(x0 + n * 4.9 - 2.4, 0.14, -ROAD - 0.6); root.add(pb); anchors.postbox = [x0 + n * 4.9 - 2.4, 0.14, -ROAD - 0.6];
  for (const [bx, bz, kind] of [[bounds[0] || x0 + 4, -(ROAD + 0.9), 'barrel'], [(bounds[0] || x0 + 4) + 0.9, -(ROAD + 0.8), 'barrel'], [bounds[4] || x0 + 20, -(ROAD + 0.9), 'crate'], [(bounds[4] || x0 + 20) + 0.8, -(ROAD + 0.95), 'crate']]) {
    const o = kind === 'barrel' ? P.barrel() : P.crate(0.75); o.position.set(bx, 0.14, bz); root.add(o);
  }
  const c = P.cart(); c.position.set(x0 + 30, 0.0, ROAD - 0.2); c.rotation.y = 0.12; root.add(c);
  if (params.bollards) for (let i = 0; i < 6; i++) { const b = P.bollard(); b.position.set(x0 + 6 + i * 7.5, 0.14, ROAD + 0.2); root.add(b); }
  // fondo
  const endX = x0 + n * 4.9 + 4;
  const endKind = params.end || 'fabrica';
  const endObj = endKind === 'muelles' ? muelles(endX + 2) : factory(endX + 8);
  root.add(endObj);
  (endObj.userData.chimneys || []).forEach((c) => smokeSources.push(c));
  anchors.end = [endX, 0, 0];
  anchors.street_start = [x0 + 1, 0.14, 0];
  anchors.street_end = [endX - 3, 0.14, 0];
  anchors.center = [0, 0, 0];

  // humo de chimeneas (animado, determinista)
  const puffs = [];
  smokeSources.forEach((src, si) => {
    for (let k = 0; k < 9; k++) {
      const m = new THREE.SpriteMaterial({ map: P.smokeTexture(), color: '#d9d2c8', transparent: true, opacity: 0.0, depthWrite: false, fog: true });
      const sp = new THREE.Sprite(m); sp.layers.set(1); sp.renderOrder = 4; root.add(sp);
      puffs.push({ sp, src, k, si });
    }
  });
  // nubes
  const clouds = [];
  for (let i = 0; i < 5; i++) { const cl = P.cloud(1.2 + (i % 3) * 0.4); cl.position.set(-140 + i * 70, 55 + (i % 2) * 14, -120 - (i % 3) * 30); root.add(cl); clouds.push(cl); }

  const update = (t) => {
    for (const p of puffs) {
      const life = ((t * 0.09 + p.k / 9 + p.si * 0.13) % 1);
      const sc = 1.6 + life * 7.5, rise = life * 11;
      p.sp.position.set(p.src[0] + life * 5.0 + Math.sin(p.k * 3 + life * 2) * 0.6, p.src[1] + rise, p.src[2] + Math.cos(p.k * 2) * 0.4);
      p.sp.scale.set(sc, sc, 1);
      p.sp.material.opacity = Math.sin(life * Math.PI) * 0.55;
    }
    clouds.forEach((c, i) => { c.position.x = ((-140 + i * 70 + t * 0.35 + 140) % 350) - 140; });
  };
  return { group: root, anchors, update, bounds: { x: 90, z: 40, cx: 0, cz: 0, h: 30 }, info: { houses: n, end: endKind } };
}
