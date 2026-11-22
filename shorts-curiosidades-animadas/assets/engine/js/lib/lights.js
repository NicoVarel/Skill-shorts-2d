// Presets de iluminación + cielo. La luz de la escena también tiñe las tarjetas de los personajes.
import * as THREE from 'three';
import { D2R } from './util.js';

export const LIGHT_PRESETS = {
  amanecer:   { sun: { az: 215, el: 11, color: '#ffb27a', i: 2.7 }, hemi: { sky: '#8aa0d6', ground: '#6f5a52', i: 1.05 }, sky: { top: '#5d7cba', mid: '#c9a0a0', horizon: '#f6bf92' }, fog: { color: '#e7bea1', near: 22, far: 95 }, tint: [1.0, 0.95, 0.9], exposure: 1.02, sunDisc: true },
  dia:        { sun: { az: 140, el: 46, color: '#fff0d4', i: 2.5 }, hemi: { sky: '#aac8ee', ground: '#8b7d68', i: 1.0 }, sky: { top: '#4a8fe0', mid: '#8dbbea', horizon: '#d6e8f8' }, fog: { color: '#d6e8f8', near: 30, far: 140 }, tint: [1, 0.99, 0.96], exposure: 1.0 },
  atardecer:  { sun: { az: 250, el: 9, color: '#ff8c4d', i: 2.8 }, hemi: { sky: '#8a78b8', ground: '#6a4c4c', i: 0.95 }, sky: { top: '#58487f', mid: '#d78a7e', horizon: '#ffb578' }, fog: { color: '#f3a87c', near: 20, far: 90 }, tint: [1.0, 0.92, 0.86], exposure: 1.0, sunDisc: true },
  nublado:    { sun: { az: 120, el: 40, color: '#dfe6f2', i: 1.3 }, hemi: { sky: '#b6c2d4', ground: '#807868', i: 1.5 }, sky: { top: '#8f9bad', mid: '#aeb8c6', horizon: '#c5ccd6' }, fog: { color: '#b4bdc9', near: 16, far: 80 }, tint: [0.97, 0.98, 1.0], exposure: 1.02 },
  noche:      { sun: { az: 300, el: 38, color: '#9db8ff', i: 1.6 }, hemi: { sky: '#5a70b8', ground: '#3a3350', i: 0.95 }, sky: { top: '#0a1230', mid: '#18274f', horizon: '#33457a' }, fog: { color: '#1b2750', near: 14, far: 70 }, tint: [0.8, 0.86, 1.0], exposure: 1.2, stars: true },
  nieve:      { sun: { az: 120, el: 23, color: '#fff0d6', i: 2.3 }, hemi: { sky: '#bad2f2', ground: '#e8eefc', i: 1.25 }, sky: { top: '#7aa5d8', mid: '#b9d3ee', horizon: '#eaf2fb' }, fog: { color: '#e1edf8', near: 28, far: 120 }, tint: [0.98, 0.99, 1.0], exposure: 1.0 },
  interior:   { sun: { az: 150, el: 52, color: '#ffd9a0', i: 1.9 }, hemi: { sky: '#ffe6c2', ground: '#80604a', i: 1.15 }, sky: { top: '#2a2030', mid: '#2a2030', horizon: '#2a2030' }, fog: { color: '#4a3a34', near: 40, far: 120 }, tint: [1.0, 0.95, 0.88], exposure: 1.0, interior: true },
  interior_noche: { sun: { az: 160, el: 40, color: '#9db8ff', i: 0.5 }, hemi: { sky: '#e8c08a', ground: '#54402f', i: 0.9 }, sky: { top: '#0a1230', mid: '#0a1230', horizon: '#14204a' }, fog: { color: '#1c1830', near: 40, far: 120 }, tint: [1.0, 0.9, 0.78], exposure: 1.0, interior: true, lamps: true },
  interior_amanecer: { sun: { az: 200, el: 14, color: '#ffbb82', i: 2.2 }, hemi: { sky: '#ffd9b0', ground: '#6c5444', i: 0.95 }, sky: { top: '#4a3b4a', mid: '#4a3b4a', horizon: '#4a3b4a' }, fog: { color: '#3a3040', near: 40, far: 120 }, tint: [1.0, 0.93, 0.85], exposure: 1.0, interior: true },
};

const skyMat = (p) => new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color(p.sky.top) }, mid: { value: new THREE.Color(p.sky.mid) }, hor: { value: new THREE.Color(p.sky.horizon) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(p.sun.color) }, disc: { value: p.sunDisc ? 1 : 0 }, stars: { value: p.stars ? 1 : 0 },
  },
  vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `varying vec3 vDir; uniform vec3 top,mid,hor,sunDir,sunCol; uniform float disc,stars;
    float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){
      float y=clamp(vDir.y,-0.2,1.0);
      vec3 c=mix(hor,mid,smoothstep(0.0,0.22,y)); c=mix(c,top,smoothstep(0.18,0.85,y));
      float sd=max(dot(normalize(vDir),normalize(sunDir)),0.0);
      c+=sunCol*pow(sd,6.0)*0.35 + sunCol*pow(sd,64.0)*0.5;
      if(disc>0.5){ c=mix(c,vec3(1.0,0.95,0.8), smoothstep(0.9987,0.9992,sd)); }
      if(stars>0.5 && y>0.05){ vec2 g=floor(vDir.xz/(vDir.y+0.3)*60.0); float s=step(0.992,h21(g)); c+=s*vec3(0.9,0.95,1.0)*smoothstep(0.05,0.4,y); }
      gl_FragColor=vec4(c,1.0);
    }`,
});

export function applyLighting(scene, presetName, bounds = { x: 40, z: 40, h: 25 }, overrides = {}) {
  const p = JSON.parse(JSON.stringify(LIGHT_PRESETS[presetName] || LIGHT_PRESETS.dia));
  Object.assign(p, overrides);
  const sunDir = new THREE.Vector3(
    Math.cos(p.sun.el * D2R) * Math.sin(p.sun.az * D2R), Math.sin(p.sun.el * D2R), Math.cos(p.sun.el * D2R) * Math.cos(p.sun.az * D2R));
  const sun = new THREE.DirectionalLight(p.sun.color, p.sun.i);
  const cx = bounds.cx || 0, cz = bounds.cz || 0;
  sun.position.set(cx + sunDir.x * 60, sunDir.y * 60, cz + sunDir.z * 60);
  sun.target.position.set(cx, 0, cz); scene.add(sun.target);
  sun.castShadow = true;
  const s = sun.shadow; s.mapSize.set(4096, 4096);
  const ex = Math.max(bounds.x, bounds.z) * 0.5;
  Object.assign(s.camera, { left: -ex, right: ex, top: ex, bottom: -ex, near: 1, far: 160 });
  s.bias = -0.0004; s.normalBias = 0.03; s.radius = 3;
  s.camera.updateProjectionMatrix();
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(p.hemi.sky, p.hemi.ground, p.hemi.i * Math.PI * 0.85);
  scene.add(hemi);
  scene.fog = new THREE.Fog(p.fog.color, p.fog.near, p.fog.far);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMat(p));
  sky.material.uniforms.sunDir.value.copy(sunDir); if (p.interior) sky.material.uniforms.sunCol.value.set('#000000');
  sky.layers.set(2); sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  scene.background = null;
  return { preset: p, sunDir, sun, hemi, sky, lightDirDown: sunDir.clone().multiplyScalar(-1) };
}
