// Escenario: habitación en diorama abierto por delante (dormitorio, comedor, oficina del XIX, taller).
// La pared del fondo tiene un hueco real para la ventana: el sol proyecta su luz sobre el suelo.
import * as THREE from 'three';
import { mat, box, cyl, sphere, floorPlane, group, at } from '../lib/toon.js';
import * as P from '../lib/props.js';

function skyTexture(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const sets = { amanecer: ['#6f86c0', '#e9a98a', '#ffd7a0'], dia: ['#5c9be0', '#a6cdee', '#e6f1fb'], noche: ['#0b1433', '#1c2b57', '#35487e'], nublado: ['#9aa6b8', '#b9c2cf', '#d2d8e0'] };
  const s = sets[kind] || sets.dia;
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, s[0]); gr.addColorStop(0.6, s[1]); gr.addColorStop(1, s[2]);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // siluetas de tejados y chimeneas
  g.fillStyle = kind === 'noche' ? '#0a0f22' : '#6d6070';
  for (let i = 0; i < 9; i++) { const x = i * 30, h = 40 + (i * 37) % 50; g.fillRect(x, 256 - h, 30, h); if (i % 3 === 1) g.fillRect(x + 8, 256 - h - 24, 8, 24); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function build(params = {}) {
  const variant = params.variant || 'dormitorio';
  const root = group(); const anchors = {}; const animated = [];
  const Wd = params.width || 7, Dp = params.depth || 5.2, Ht = params.height || 3.3;
  const zb = -Dp / 2; // pared del fondo
  const wall = mat({ color: params.wallColor || '#e3cfa1', tex: 'wallpaper', texOpts: { color: params.wallColor || '#e3cfa1', stripe: params.stripe || '#d7bd84', dot: params.dot || '#c49c5f' }, tile: 1.4 });
  const wood = mat({ color: '#ffffff', tex: 'planks', texOpts: { color: params.floorColor || '#a06f45', n: 8 }, tile: 2.2 });
  root.add(floorPlane(Wd + 8, Dp + 10, mat('#2a2030'), 0, -0.05, 0));
  root.add(floorPlane(Wd, Dp + 12, wood, 0, 0, 4.0));
  // pared del fondo con hueco de ventana
  const wx = params.winX ?? 1.5, ww = 1.5, wy0 = 0.95, wy1 = 2.55;
  root.add(box(Wd, wy0, 0.2, wall, 0, 0, zb));                      // bajo la ventana
  root.add(box(Wd, Ht - wy1, 0.2, wall, 0, wy1, zb));               // sobre la ventana
  root.add(box(wx - ww / 2 + Wd / 2, wy1 - wy0, 0.2, wall, (-Wd / 2 + (wx - ww / 2)) / 2, wy0, zb));
  root.add(box(Wd / 2 - (wx + ww / 2), wy1 - wy0, 0.2, wall, ((wx + ww / 2) + Wd / 2) / 2, wy0, zb));
  // paredes laterales
  for (const s of [-1, 1]) root.add(box(0.2, Ht, Dp + 4, wall, s * (Wd / 2), 0, 1.0));
  // techo (no proyecta sombra para que el sol entre por la ventana)
  root.add(box(Wd + 0.2, 0.15, Dp + 4, mat('#d9c9a8'), 0, Ht, 1.0, { cast: false }));
  for (let i = -2; i <= 2; i++) root.add(box(0.18, 0.2, Dp + 4, mat('#6a4a33'), i * 1.4, Ht - 0.2, 1.0, { cast: false }));
  // zócalo de madera
  root.add(box(Wd, 1.0, 0.06, mat({ color: '#7a5636', tex: 'planks', texOpts: { color: '#7a5636', n: 6, vertical: true }, tile: 1.3 }), 0, 0, zb + 0.13));
  root.add(box(Wd, 0.1, 0.1, mat('#5a3f27'), 0, 0, zb + 0.1));
  root.add(box(Wd, 0.08, 0.1, mat('#5a3f27'), 0, 1.0, zb + 0.14));
  for (const s of [-1, 1]) root.add(box(0.06, 1.0, Dp + 4, mat('#7a5636'), s * (Wd / 2 - 0.13), 0, 1.0));
  // ventana + exterior luminoso
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(ww + 1.4, 3.2), new THREE.MeshBasicMaterial({ map: skyTexture(params.exterior || 'amanecer'), fog: false }));
  outside.position.set(wx, 1.9, zb - 0.9); root.add(outside);
  const win = P.sash(ww / 2 - 0.02, 1.55, false, null); win.visible = false;
  // marcos de la ventana (sin cristal opaco) + cortinas
  const fr = mat(P.COL.warmWhite);
  root.add(box(ww + 0.2, 0.1, 0.18, fr, wx, wy0 - 0.08, zb + 0.08)); root.add(box(ww + 0.2, 0.1, 0.18, fr, wx, wy1, zb + 0.08));
  root.add(box(0.1, wy1 - wy0 + 0.1, 0.18, fr, wx - ww / 2 - 0.05, wy0 - 0.05, zb + 0.08)); root.add(box(0.1, wy1 - wy0 + 0.1, 0.18, fr, wx + ww / 2 + 0.05, wy0 - 0.05, zb + 0.08));
  root.add(box(0.06, wy1 - wy0, 0.1, fr, wx, wy0, zb + 0.08)); root.add(box(ww, 0.06, 0.1, fr, wx, (wy0 + wy1) / 2, zb + 0.08));
  const cur = params.curtain || '#a63d3d';
  root.add(box(0.5, 1.9, 0.12, mat(cur), wx - ww / 2 - 0.2, 0.75, zb + 0.18)); root.add(box(0.5, 1.9, 0.12, mat(cur), wx + ww / 2 + 0.2, 0.75, zb + 0.18));
  root.add(box(ww + 1.3, 0.07, 0.07, mat(P.COL.brass), wx, 2.7, zb + 0.2));
  anchors.window = [wx, 1.4, zb + 0.3]; anchors['window.below'] = [wx, 0, zb + 1.2];
  // puerta lateral
  const d = P.door(1.0, 2.2, params.doorColor || '#5b3a24'); d.rotation.y = -Math.PI / 2; d.position.set(Wd / 2 - 0.1, 0, 0.6); root.add(d);
  anchors.door = [Wd / 2 - 1.0, 0, 0.6];
  // cuadros y reloj
  const pic = P.picture(0.6, 0.8, '#7f9f78'); pic.position.set(-2.2, 1.7, zb + 0.12); root.add(pic);
  const pic2 = P.picture(0.45, 0.6, '#b08a5a'); pic2.position.set(-1.2, 1.9, zb + 0.12); root.add(pic2);
  const clk = P.clockWall(); clk.position.set(2.7, 1.5, zb + 0.14); root.add(clk);
  // lámpara de techo (colgada, luz cálida)
  const lamp = group(); lamp.add(cyl(0.02, 0.02, 0.8, mat(P.COL.darkIron), 0, 0, 0, 6)); lamp.add(sphere(0.2, mat({ color: '#f1c36a', emissive: '#ffcf80', emissiveIntensity: 1.2 }), 0, -0.1, 0, 14)); lamp.position.set(-0.4, Ht - 0.8, 0.2); root.add(lamp);
  root.add(P.glowSprite(-0.4, Ht - 0.9, 0.2, 2.4, '#ffc27a', 0.55));

  if (variant === 'dormitorio') {
    root.add(P.rug(2.8, 1.8, '#7b3a3a', '#d9c28d')); root.children[root.children.length - 1].position.set(-0.4, 0.012, 0.8);
    const bd = P.bed(1.35, 2.2, params.blanket || '#b0463a'); bd.rotation.y = Math.PI / 2; bd.position.set(-1.6, 0, zb + 1.35); root.add(bd);
    anchors.bed = [-1.6, 0.8, zb + 1.35]; anchors['bed.head'] = [-2.5, 0.85, zb + 1.35]; anchors['bed.side'] = [-1.4, 0, zb + 2.5];
    anchors['bed.pillow'] = [-2.45, 0.9, zb + 1.35]; anchors['bed.out'] = [-0.4, 0, zb + 1.6];
    const nsx = params.nightstandX ?? -1.0, nsz = params.nightstandZ ?? -0.3; // mesilla delante de la cama, a la vista
    const ns = P.table(0.55, 0.45, 0.62); ns.position.set(nsx, 0, nsz); root.add(ns);
    const cl = P.candleLamp(true); cl.position.set(nsx + 0.14, 0.62, nsz); root.add(cl);
    anchors.nightstand = [nsx, 0.7, nsz];
    // despertador sobre la mesilla
    const ac = group(); const body = cyl(0.1, 0.1, 0.06, mat('#d8cfae'), 0, 0, 0, 20); body.rotation.x = Math.PI / 2; body.position.y = 0.15; ac.add(body);
    ac.add(sphere(0.045, mat(P.COL.brass), -0.07, 0.25, 0, 10)); ac.add(sphere(0.045, mat(P.COL.brass), 0.07, 0.25, 0, 10)); ac.scale.setScalar(1.7); ac.position.set(nsx - 0.1, 0.62, nsz); ac.visible = !!params.alarmClock; root.add(ac);
    const wd = P.wardrobe(); wd.position.set(2.5, 0, zb + 0.5); root.add(wd);
    const ch = P.crate(0.7, '#8a5c34'); ch.scale.set(1.2, 0.7, 0.8); ch.position.set(1.0, 0, zb + 0.5); root.add(ch);
  } else if (variant === 'comedor') {
    root.add(P.rug(3.6, 2.6, '#4a5f7a', '#d9c28d')); root.children[root.children.length - 1].position.set(0, 0.012, 0.6);
    const tb = P.table(2.0, 1.0, 0.78, '#c0463a'); tb.position.set(0, 0, 0.3); root.add(tb);
    for (const [cx, cz, ry] of [[-0.6, 1.1, Math.PI], [0.6, 1.1, Math.PI], [-0.6, -0.5, 0], [0.6, -0.5, 0], [-1.3, 0.3, Math.PI / 2], [1.3, 0.3, -Math.PI / 2]]) { const c = P.chair(); c.position.set(cx, 0, cz + 0.3); c.rotation.y = ry; root.add(c); }
    const cl = P.candleLamp(true); cl.position.set(0, 0.8, 0.3); root.add(cl);
    for (const [px, pz] of [[-0.6, 0.0], [0.6, 0.0], [-0.6, 0.65], [0.6, 0.65]]) { const pl = cyl(0.14, 0.12, 0.02, mat('#f3efe4'), px, 0.8, pz + 0.0, 16); root.add(pl); }
    const sb = P.bookshelf(1.7, 1.0, 0.45); sb.position.set(-2.4, 0, zb + 0.4); root.add(sb);
    anchors.table = [0, 0.8, 0.3]; anchors.seat1 = [-0.6, 0, 1.4]; anchors.seat2 = [0.6, 0, 1.4]; anchors.seat3 = [-0.6, 0, -0.2]; anchors.seat4 = [0.6, 0, -0.2];
  } else if (variant === 'oficina') {
    root.add(P.rug(3.0, 2.0, '#2f5a46', '#d9c28d')); root.children[root.children.length - 1].position.set(-0.4, 0.012, 0.6);
    const ds = P.desk(); ds.position.set(-0.8, 0, zb + 1.5); root.add(ds);
    const st = P.stool(0.62); st.position.set(-0.8, 0, zb + 2.35); root.add(st);
    const bs = P.bookshelf(); bs.position.set(-2.5, 0, zb + 0.35); root.add(bs);
    const bs2 = P.bookshelf(); bs2.position.set(2.4, 0, zb + 0.35); root.add(bs2);
    const cl = P.candleLamp(true); cl.position.set(-1.4, 0.78, zb + 1.5); root.add(cl);
    anchors.desk = [-0.8, 0.8, zb + 1.5]; anchors.stool = [-0.8, 0, zb + 2.4]; anchors.seat = [-0.8, 0, zb + 2.4];
  }
  anchors.center = [0, 0, 0.8]; anchors.front = [0, 0, 2.6]; anchors.back = [0, 0, zb + 1.2];
  return { group: root, anchors, update() {}, bounds: { x: Wd + 2, z: Dp + 4, cx: 0, cz: 0.5, h: Ht }, info: { variant } };
}
