// Efectos 3D con intención narrativa (guisantes disparados, "zzz", polvo, etc.). Funciones puras del tiempo.
import * as THREE from 'three';
import { clamp, lerp, mulberry32 } from './util.js';

function zzzTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.font = '900 190px "Arial Black",Impact,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 22; g.strokeStyle = '#2a1b2e'; g.strokeText('Z', 128, 134); g.fillStyle = '#ffffff'; g.fillText('Z', 128, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildFx(spec, env) {
  const scene = env.scene; const objs = [];
  const type = spec.type;
  if (type === 'peas') {
    const n = Math.ceil((spec.t1 - spec.t0) * (spec.rate ?? 3)) + 1;
    const mesh = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(spec.size ?? 0.035, 10, 8), new THREE.MeshBasicMaterial({ color: spec.color || '#c8b878' }));
      m.layers.set(1); m.visible = false; m.renderOrder = 12; scene.add(m); mesh.push(m);
    }
    return {
      update(t) {
        mesh.forEach((m, i) => {
          const tl = spec.t0 + i / (spec.rate ?? 3), fl = spec.flight ?? 0.32;
          const u = (t - tl) / fl;
          if (u < 0 || u > 1.15) { m.visible = false; return; }
          const a = env.resolve(spec.from, tl, [0, 0, 0]), b = env.resolve(spec.to, tl, [0, 0, 0]);
          const r = mulberry32(i * 31 + 5); const jx = (r() - 0.5) * 0.25, jy = (r() - 0.5) * 0.2;
          const uu = clamp(u);
          m.position.set(lerp(a[0], b[0] + jx, uu), lerp(a[1], b[1] + jy, uu) + Math.sin(uu * Math.PI) * 0.12, lerp(a[2], b[2], uu));
          m.visible = true;
        });
      },
    };
  }
  if (type === 'zzz') {
    const tex = zzzTexture(); const sprites = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
      s.layers.set(1); s.renderOrder = 14; scene.add(s); sprites.push(s);
    }
    return {
      update(t) {
        sprites.forEach((s, i) => {
          const life = (((t - spec.t0) * 0.45 + i / 3) % 1 + 1) % 1;
          const on = t >= spec.t0 && t <= spec.t1;
          const p = env.resolve(spec.at, t, [0, 0, 0]);
          s.visible = on;
          s.position.set(p[0] + life * 0.5, p[1] + 0.4 + life * 0.9, p[2] + 0.1);
          const sz = 0.18 + life * 0.28; s.scale.set(sz, sz, 1); s.material.opacity = Math.sin(life * Math.PI);
        });
      },
    };
  }
  if (type === 'dust') {
    const n = spec.count ?? 14; const sprites = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: spec.color || '#d8cdb8', transparent: true, depthWrite: false, opacity: 0 }));
      s.layers.set(1); scene.add(s); sprites.push(s);
    }
    return {
      update(t) {
        const p = env.resolve(spec.at, t, [0, 0, 0]);
        sprites.forEach((s, i) => {
          const r = mulberry32(i + 3); const u = (t - spec.t0) / (spec.dur ?? 0.8);
          s.visible = u > 0 && u < 1;
          if (!s.visible) return;
          const ang = r() * 6.28, d = u * (0.5 + r()); s.position.set(p[0] + Math.cos(ang) * d, p[1] + 0.1 + u * 0.4, p[2] + Math.sin(ang) * d * 0.5);
          const sz = 0.25 + u * 0.5; s.scale.set(sz, sz, 1); s.material.opacity = (1 - u) * 0.5;
        });
      },
    };
  }
  if (type === 'snow') {
    const n = spec.count ?? 500; const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3);
    const r = mulberry32(99); const base = [];
    for (let i = 0; i < n; i++) { const b = [(r() - 0.5) * (spec.w ?? 40), r() * (spec.h ?? 14), (r() - 0.5) * (spec.d ?? 40), 0.6 + r() * 0.9, r() * 6.28]; base.push(b); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: spec.size ?? 0.09, transparent: true, opacity: 0.9, depthWrite: false, fog: true }));
    pts.layers.set(1); pts.frustumCulled = false; scene.add(pts);
    const c = spec.center || [0, 0, 0];
    return {
      update(t) {
        const a = geo.attributes.position;
        base.forEach((b, i) => {
          const y = (((b[1] - t * b[3]) % (spec.h ?? 14)) + (spec.h ?? 14)) % (spec.h ?? 14);
          a.setXYZ(i, c[0] + b[0] + Math.sin(t * 0.6 + b[4]) * 0.5, c[1] + y, c[2] + b[2] + Math.cos(t * 0.5 + b[4]) * 0.4);
        });
        a.needsUpdate = true;
      },
    };
  }
  return { update() {} };
}
