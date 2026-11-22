// Materiales toon y constructores de geometría con UV en metros (las texturas no se estiran).
import * as THREE from 'three';
import { getTexture } from './textures.js';

let gradient;
export function toonGradient() {
  if (gradient) return gradient;
  const d = new Uint8Array([74, 150, 215, 255]);
  gradient = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const matCache = new Map();
// mat('#aabbcc') o mat({color, tex:'brick', texOpts:{...}, emissive, transparent, opacity, side})
export function mat(c, extra = {}) {
  const o = typeof c === 'string' ? { color: c } : c;
  const opts = { ...o, ...extra };
  const key = JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const params = {
    color: new THREE.Color(opts.color || '#cccccc'),
    gradientMap: toonGradient(),
  };
  if (opts.tex) { params.map = getTexture(opts.tex, opts.texOpts || {}); params.map.repeat.set(1, 1); }
  if (opts.emissive) { params.emissive = new THREE.Color(opts.emissive); params.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.transparent) { params.transparent = true; params.opacity = opts.opacity ?? 0.5; params.depthWrite = false; }
  if (opts.side === 'double') params.side = THREE.DoubleSide;
  const m = new THREE.MeshToonMaterial(params);
  m.userData.tileM = opts.tile || 1.6; // tamaño en metros de una repetición de la textura
  matCache.set(key, m);
  return m;
}
export function unlit(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: !!opts.opacity, opacity: opts.opacity ?? 1, depthWrite: opts.depthWrite ?? true, fog: opts.fog ?? true, side: opts.double ? THREE.DoubleSide : THREE.FrontSide });
}

function scaleBoxUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // +x -x +y -y +z -z
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * a / tile, uv.getY(k) * b / tile);
    }
  }
  uv.needsUpdate = true;
}

const geoCache = new Map();
function cachedBox(w, h, d, tile) {
  const key = `b${w},${h},${d},${tile}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d);
  scaleBoxUV(g, w, h, d, tile);
  geoCache.set(key, g);
  return g;
}

export function box(w, h, d, material, x = 0, y = 0, z = 0, opts = {}) {
  const m = typeof material === 'string' ? mat(material) : material;
  const g = cachedBox(w, h, d, m.userData.tileM || 1.6);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y + h / 2, z); // y = base de la caja
  mesh.castShadow = opts.cast ?? true; mesh.receiveShadow = opts.receive ?? true;
  return mesh;
}
export function cyl(rTop, rBot, h, material, x = 0, y = 0, z = 0, seg = 20, opts = {}) {
  const m = typeof material === 'string' ? mat(material) : material;
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  const uv = g.attributes.uv; const tile = m.userData.tileM || 1.6;
  const circ = Math.PI * 2 * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile, uv.getY(i) * h / tile);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = opts.cast ?? true; mesh.receiveShadow = opts.receive ?? true;
  return mesh;
}
export function sphere(r, material, x = 0, y = 0, z = 0, seg = 20) {
  const m = typeof material === 'string' ? mat(material) : material;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.75)), m);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
export function cone(r, h, material, x = 0, y = 0, z = 0, seg = 16) {
  const m = typeof material === 'string' ? mat(material) : material;
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);
  mesh.position.set(x, y + h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
// plano horizontal con textura en metros
export function floorPlane(w, d, material, x = 0, y = 0, z = 0) {
  const m = typeof material === 'string' ? mat(material) : material;
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv; const tile = m.userData.tileM || 1.6;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true;
  return mesh;
}
export function wallPlane(w, h, material, x = 0, y = 0, z = 0, rotY = 0) {
  const m = typeof material === 'string' ? mat(material) : material;
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv; const tile = m.userData.tileM || 1.6;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * h / tile);
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.y = rotY; mesh.position.set(x, y + h / 2, z); mesh.receiveShadow = true;
  return mesh;
}
export function group(...children) { const g = new THREE.Group(); children.forEach((c) => c && g.add(c)); return g; }
export function at(obj, x = 0, y = 0, z = 0, rotY = 0) { obj.position.set(x, y, z); obj.rotation.y = rotY; return obj; }
