// Actores: personajes 2D (tarjetas) integrados en el mundo 3D con sombra proyectada, contacto y oclusión.
import * as THREE from 'three';
import { drawCharacter, CARD_W, CARD_H, FEET_Y, UNIT_M, EXPRESSIONS, DEFAULT_POSE } from './rig.js';
import { POSES, makePose, walkPose, blendPose, addPose, blendFace, CLIPS, clonePose } from './poses.js';
import { clamp, lerp, smooth, ease, hashStr, mulberry32 } from './util.js';

const TEX_SS = 1.5; // supermuestreo de la tarjeta

function toVec(v) { return new THREE.Vector3(v[0], v[1], v[2]); }

let blobTex;
function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(10,6,16,0.65)'); gr.addColorStop(0.55, 'rgba(10,6,16,0.35)'); gr.addColorStop(1, 'rgba(10,6,16,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c); blobTex.colorSpace = THREE.SRGBColorSpace;
  return blobTex;
}

const shadowVert = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); }';
const shadowFrag = 'varying vec2 vUv; uniform sampler2D map; uniform float opacity; void main(){ float a=texture2D(map,vUv).a; if(a<0.4) discard; gl_FragColor=vec4(0.04,0.03,0.08,opacity); }';

export class Actor {
  constructor(track, spec, env) {
    this.track = track; this.spec = spec; this.env = env; // env: {resolve, scene, light, actors, audioEnv, fps}
    this.id = track.id; this.scale = (track.scale ?? 1) * (spec.body && spec.body.height ? spec.body.height : 1);
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(CARD_W * TEX_SS); this.canvas.height = Math.round(CARD_H * TEX_SS);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.generateMipmaps = false;
    this.tex.minFilter = THREE.LinearFilter; this.tex.magFilter = THREE.LinearFilter;
    const w = CARD_W * UNIT_M, h = CARD_H * UNIT_M;
    const geo = new THREE.PlaneGeometry(w, h);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: false, alphaTest: 0.01, alphaToCoverage: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.layers.set(1); this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
    this.pivot = new THREE.Group(); // pies en el origen
    this.mesh.position.y = (CARD_H / 2 - (CARD_H - FEET_Y)) * UNIT_M;
    this.pivot.add(this.mesh);
    env.scene.add(this.pivot);
    // sombra proyectada (planar)
    this.shadowMat = new THREE.ShaderMaterial({ uniforms: { map: { value: this.tex }, opacity: { value: 0.34 } }, vertexShader: shadowVert, fragmentShader: shadowFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.shadow = new THREE.Mesh(geo, this.shadowMat);
    this.shadow.layers.set(1); this.shadow.matrixAutoUpdate = false; this.shadow.matrixWorldAutoUpdate = false; this.shadow.frustumCulled = false; this.shadow.renderOrder = 6;
    env.scene.add(this.shadow);
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.layers.set(1); this.blob.renderOrder = 7; this.blob.scale.set(0.9 * this.scale, 0.9 * this.scale, 1);
    env.scene.add(this.blob);
    this._prepare();
  }

  _prepare() {
    const tr = this.track; const A = (tr.actions || []).slice().sort((a, b) => (a.t ?? a.t0 ?? 0) - (b.t ?? b.t0 ?? 0));
    A.forEach((a) => { if (a.t0 === undefined && a.t !== undefined) a.t0 = a.t; if (a.t === undefined && a.t0 !== undefined) a.t = a.t0; });
    this.A = A;
    this.moves = A.filter((a) => a.do === 'walk' || a.do === 'move');
    this.poseActs = A.filter((a) => a.do === 'pose');
    this.exprActs = A.filter((a) => a.do === 'expr');
    this.clipActs = A.filter((a) => a.do === 'clip');
    this.talkActs = A.filter((a) => a.do === 'talk');
    this.holdActs = A.filter((a) => a.do === 'hold');
    this.lookActs = A.filter((a) => a.do === 'look');
    this.faceActs = A.filter((a) => a.do === 'face');
    this.liftActs = A.filter((a) => a.do === 'lift'); // desplazamiento vertical (sentarse, tumbarse)
    this.lieActs = A.filter((a) => a.do === 'lie');
    this.visActs = A.filter((a) => a.do === 'show' || a.do === 'hide');
    this._segs = null;
  }

  startPos() {
    const s = this.track.start || {};
    return this.env.resolve(s.at || [0, 0, 0], 0);
  }

  // segmentos de movimiento resueltos (from/to en coordenadas de mundo)
  segs() {
    if (this._segs) return this._segs;
    let cur = this.startPos().slice();
    this._segs = this.moves.map((m) => {
      const to = this.env.resolve(m.to, m.t0 ?? m.t, cur);
      const from = m.from ? this.env.resolve(m.from, m.t0, cur) : cur.slice();
      const seg = { ...m, from, to };
      if (m.t1 === undefined && m.speed) { const dist = Math.hypot(to[0] - from[0], to[2] - from[2]); seg.t1 = m.t0 + dist / m.speed; }
      cur = to.slice();
      return seg;
    });
    return this._segs;
  }

  posAt(t) {
    const segs = this.segs(); let p = this.startPos().slice(); let walking = 0, dist = 0, dir = null;
    for (const s of segs) {
      const L = Math.hypot(s.to[0] - s.from[0], s.to[2] - s.from[2]);
      if (t < s.t0) break;
      const u = clamp((t - s.t0) / Math.max(1e-6, s.t1 - s.t0));
      const e = s.do === 'walk' ? ease(s.ease || 'smooth', u) : ease(s.ease || 'smooth', u);
      p = [lerp(s.from[0], s.to[0], e), lerp(s.from[1], s.to[1], e), lerp(s.from[2], s.to[2], e)];
      dir = [s.to[0] - s.from[0], s.to[2] - s.from[2]];
      if (t <= s.t1) {
        if (s.do === 'walk') { walking = Math.min(1, smooth(Math.min(u * 12, 1)) * smooth(Math.min((1 - u) * 12, 1) + 0.0001)); walking = Math.max(walking, 0.001); dist = L * e; this._walkDist = dist; }
        // distancia acumulada de segmentos previos
      }
      if (t > s.t1) { p = s.to.slice(); }
    }
    // distancia total recorrida hasta t (para el ciclo de paso)
    let total = 0;
    for (const s of segs) {
      if (s.do !== 'walk') continue;
      const L = Math.hypot(s.to[0] - s.from[0], s.to[2] - s.from[2]);
      if (t >= s.t1) total += L; else if (t > s.t0) total += L * ease(s.ease || 'smooth', (t - s.t0) / (s.t1 - s.t0));
    }
    return { p, walking, total, dir };
  }

  facingAt(t) {
    // devuelve {sx: ±1 relativo a pantalla | null, world:[x,z] | null, frontal:bool}
    let f = { frontal: true };
    const ev = [];
    for (const a of this.faceActs) ev.push({ t: a.t, f: a });
    for (const s of this.segs()) if (s.do === 'walk') ev.push({ t: s.t0, f: { dir: 'move', seg: s } });
    ev.sort((a, b) => a.t - b.t);
    for (const e of ev) {
      if (e.t > t) break;
      const d = e.f.dir;
      if (d === 'camera') f = { frontal: true };
      else if (d === 'left') f = { sx: -1, frontal: false };
      else if (d === 'right') f = { sx: 1, frontal: false };
      else if (d === 'move') { const s = e.f.seg; f = { world: [s.to[0] - s.from[0], s.to[2] - s.from[2]], frontal: false }; }
      else if (typeof d === 'string' && d.startsWith('toward:')) { const tgt = this.env.resolve(d.slice(7), t, null); const p = this.posAt(e.t).p; f = { world: [tgt[0] - p[0], tgt[2] - p[2]], frontal: false }; }
      else if (Array.isArray(d)) f = { world: [d[0], d[1]], frontal: false };
    }
    return f;
  }

  poseAt(t, walk) {
    this._poseItem = (POSES[(this.track.start && this.track.start.pose) || 'idle'] || {}).item || null;
    let cur = clonePose(POSES[(this.track.start && this.track.start.pose) || 'idle'].pose);
    let expr = (this.track.start && this.track.start.expr) || 'neutral';
    for (const a of this.poseActs) {
      if (t < a.t) break;
      const dur = a.dur ?? 0.35;
      let target;
      if (a.name === 'walk1' || a.name === 'run1') target = makePose(a.name, 0).pose;
      else if (a.pose) target = Object.assign(clonePose(DEFAULT_POSE()), JSON.parse(JSON.stringify(a.pose)));
      else target = clonePose((POSES[a.name] || POSES.idle).pose);
      if (a.args) addPose(target, a.args, 1);
      this._poseItem = a.item === undefined ? ((POSES[a.name] || {}).item || null) : (a.item ? { name: a.item, hand: a.hand || 'R', rotAbs: a.rotAbs } : null);
      const u = (t - a.t) / Math.max(1e-3, dur);
      cur = u >= 1 ? target : blendPose(cur, target, ease('smooth', u));
      if (u < 1) break;
    }
    return cur;
  }

  state(t) {
    const mv = this.posAt(t);
    let pose = this.poseAt(t);
    let faceExpr = null; let item = null; let plant = true; let talkOpen = 0;
    // locomoción
    if (mv.walking > 0.01 || this._anyWalk(t)) {
      const speedK = 1;
      const wp = walkPose(mv.total / 1.5 * Math.PI * 2 * speedK, (this.track.walkAmp ?? 1), (this.track.walkLean ?? 3));
      const w = this._walkWeight(t);
      pose = blendPose(pose, wp, w);
    }
    // clips
    let exprOverride = null, exprW = 0;
    for (const c of this.clipActs) {
      if (t < c.t0 || t > c.t1) continue;
      const fn = CLIPS[c.name]; if (!fn) continue;
      const u = (t - c.t0) / Math.max(1e-3, c.t1 - c.t0);
      const r = fn(u, t - c.t0, c);
      if (r.kind === 'add') { addPose(pose, r.add, r.w ?? 1); if (r.plant === false) plant = false; if (r.plant === true) {} }
      else if (r.kind === 'set' || r.kind === 'mix') {
        for (const k of Object.keys(r.set)) {
          if (typeof r.set[k] === 'object') pose[k] = blendPose(pose[k], Object.assign({}, pose[k], r.set[k]), r.w ?? 1);
          else pose[k] = lerp(pose[k], r.set[k], r.w ?? 1);
        }
        if (r.expr) { exprOverride = r.expr; exprW = r.w ?? 1; }
        if (r.item && (r.w ?? 1) > 0.3) item = r.item;
      }
    }
    // expresión
    let exprName = (this.track.start && this.track.start.expr) || 'neutral', prev = EXPRESSIONS[exprName];
    let face = Object.assign({}, EXPRESSIONS.neutral, prev);
    for (const a of this.exprActs) {
      if (t < a.t) break;
      const tgt = Object.assign({}, EXPRESSIONS.neutral, EXPRESSIONS[a.name] || {});
      const u = (t - a.t) / Math.max(1e-3, a.dur ?? 0.22);
      face = u >= 1 ? tgt : blendFace(face, tgt, ease('smooth', u));
      if (u < 1) break;
    }
    // expresión que viene de la pose base
    if (exprOverride) face = blendFace(face, Object.assign({}, EXPRESSIONS.neutral, EXPRESSIONS[exprOverride]), exprW);
    // mirada
    let look = null;
    for (const a of this.lookActs) { if (t >= a.t) look = a; }
    face = JSON.parse(JSON.stringify(face));
    if (look) {
      const tgt = look.at;
      let dx = 0, dy = 0;
      if (tgt === 'camera') { dx = 0; dy = 0; }
      else if (tgt === 'left') dx = -1; else if (tgt === 'right') dx = 1; else if (tgt === 'up') dy = -1; else if (tgt === 'down') dy = 1;
      else if (typeof tgt === 'string' && tgt.startsWith('toward:')) { /* se resuelve al dibujar con la cámara */ face.__lookRef = tgt.slice(7); }
      else if (Array.isArray(tgt)) { dx = tgt[0]; dy = tgt[1] || 0; }
      face.pupilX = dx; face.pupilY = dy; face.__lookHead = look.head ?? 0.35;
      const u = clamp((t - look.t) / 0.2);
      face.pupilX *= u; face.pupilY *= u;
    }
    // parpadeo determinista
    const seed = hashStr(this.id) % 1000;
    const per = 3.1 + (seed % 17) / 10, ph = ((t + seed * 0.37) % per);
    const blink = ph < 0.13 ? Math.sin(ph / 0.13 * Math.PI) : 0;
    face.eyeOpen = (face.eyeOpen ?? 1) * (1 - blink * 0.95);
    // hablar
    for (const a of this.talkActs) {
      if (t >= a.t0 && t <= a.t1) {
        const env = this.env.audioEnv;
        let open;
        if (env && env.length) { const i = Math.min(env.length - 1, Math.floor(t * (this.env.audioFps || 30) + (this.env.sceneStart || 0) * (this.env.audioFps || 30))); open = clamp(env[i] * 1.5, 0, 1); }
        else open = (Math.sin(t * 17) * 0.5 + 0.5) * (Math.sin(t * 5.3) * 0.5 + 0.55);
        face.mouth = Object.assign({}, face.mouth, { open: Math.max(face.mouth.open || 0, open * 0.9), round: 0, smile: 0.15, wide: 0.9 });
      }
    }
    // objeto en mano
    for (const a of this.holdActs) { if (t >= a.t) item = a.item ? { name: a.item, hand: a.hand || 'R', angle: a.angle ?? 0, rotAbs: a.rotAbs } : null; }
    if (!item && this._poseItem) item = this._poseItem;
    const clipItem = item; // clips pueden forzar objeto
    let lift = 0;
    for (const a of this.liftActs) { if (t >= a.t) { const u = clamp((t - a.t) / (a.dur ?? 0.4)); lift = lerp(a.from ?? lift, a.y, ease('smooth', u)); } }
    let lie = 0, lieX = 0;
    for (const a of this.lieActs) { if (t >= a.t) { const u = clamp((t - a.t) / (a.dur ?? 0.6)); lie = lerp(a.from ?? 0, a.angle ?? 85, ease('smooth', u)); lieX = a.dx ?? 0; } }
    if (pose.sit) plant = false;
    return { mv, pose, face, item: clipItem, plant, lift, lie, lieX, sitSeat: pose.sit };
  }

  _anyWalk(t) { return this.segs().some((s) => s.do === 'walk' && t >= s.t0 - 0.2 && t <= s.t1 + 0.2); }
  _walkWeight(t) {
    let w = 0;
    for (const s of this.segs()) {
      if (s.do !== 'walk') continue;
      const a = smooth((t - s.t0) / 0.18 + 0.0), b = 1 - smooth((t - s.t1) / 0.22);
      w = Math.max(w, clamp(Math.min(a, b)));
    }
    return w;
  }

  visibleAt(t) {
    let v = this.track.visible !== false;
    for (const a of this.visActs) { if (t >= a.t) v = a.do === 'show'; }
    return v;
  }

  update(t, camera) {
    const st = this.state(t);
    const vis = this.visibleAt(t);
    this.pivot.visible = vis; this.shadow.visible = vis; this.blob.visible = vis;
    if (!vis) return null;
    const p = st.mv.p;
    // orientación respecto a la cámara
    camera.updateMatrixWorld();
    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
    const fa = this.facingAt(t);
    let flip = 1, turn = 0;
    if (!fa.frontal) {
      if (fa.sx) flip = fa.sx; else if (fa.world) { const d = fa.world[0] * right.x + fa.world[1] * right.z; flip = d >= 0 ? 1 : -1; }
      turn = 0.55;
    }
    st.pose.headTurn = (st.pose.headTurn || 0) * (flip >= 0 ? 1 : -1) * 0 + (st.pose.headTurn || 0) + turn * 0.7;
    if (st.face.__lookRef) {
      const tg = this.env.resolve(st.face.__lookRef, t, p);
      const d = (tg[0] - p[0]) * right.x + (tg[2] - p[2]) * right.z;
      const sgn = d >= 0 ? 1 : -1; st.face.pupilX = sgn * Math.min(1, Math.abs(d) / 2); st.pose.headTurn += sgn * flip * 0.4 * Math.min(1, Math.abs(d) / 1.5) * (flip >= 0 ? 1 : 1);
      const dy = tg[1] - (p[1] + 1.5); st.face.pupilY = clamp(-dy / 2, -1, 1);
    }
    if (st.face.__lookHead && !st.face.__lookRef) st.pose.headTurn += (st.face.pupilX || 0) * (flip) * st.face.__lookHead * (1) * 0 + (st.face.pupilX || 0) * flip * st.face.__lookHead;
    st.pose.headTurn = clamp(st.pose.headTurn, -1, 1);
    // dibujar
    drawCharacter(this.ctx, this.spec, { pose: st.pose, face: st.face, item: st.item, flip, plant: st.plant, lightSide: 1 }, TEX_SS);
    this.tex.needsUpdate = true;
    // posición 3D
    const sc = this.scale;
    this.pivot.position.set(p[0], p[1], p[2]);
    let liftY = st.lift;
    if (st.sitSeat && !st.plant) { liftY += (this.track.seat ?? 0.46) - 0.69 * sc; }
    this.pivot.scale.set(sc, sc, sc);
    const yaw = Math.atan2(camPos.x - p[0], camPos.z - p[2]);
    this.pivot.rotation.set(0, yaw, 0);
    this.mesh.rotation.z = 0;
    this.mesh.position.set(0, (CARD_H / 2 - (CARD_H - FEET_Y)) * UNIT_M + liftY / sc, 0);
    if (st.lie) { // tumbado: gira alrededor de la cadera
      const hipH = 0.69;
      this.mesh.position.set(0, 0, 0);
      const g = this.mesh;
      g.position.set(0, (CARD_H / 2 - (CARD_H - FEET_Y)) * UNIT_M, 0);
      this.pivot.rotation.set(0, yaw, 0);
      this.pivot.position.set(p[0], p[1] + liftY + hipH * sc, p[2]);
      this.mesh.position.y = (CARD_H / 2 - (CARD_H - FEET_Y)) * UNIT_M - hipH;
      this.mesh.parent.rotation.z = -st.lie * Math.PI / 180 * (flip >= 0 ? 1 : -1);
    } else { this.pivot.rotation.z = 0; }
    this.pivot.updateMatrixWorld(true);
    // tinte por iluminación
    const L = this.env.light; const tint = this.track.tint || L.tint || [1, 1, 1];
    this.mat.color.setRGB(tint[0] * (L.charGain ?? 1), tint[1] * (L.charGain ?? 1), tint[2] * (L.charGain ?? 1));
    // sombra proyectada sobre el suelo y mancha de contacto
    const gy = p[1] + 0.012;
    const d = L.lightDirDown; // dirección en que viaja la luz (hacia abajo)
    const M = new THREE.Matrix4();
    const dxn = d.x / d.y, dzn = d.z / d.y;
    M.set(1, -dxn, 0, dxn * gy, 0, 0, 0, gy, 0, -dzn, 1, dzn * gy, 0, 0, 0, 1);
    this.shadow.matrixWorld.multiplyMatrices(M, this.mesh.matrixWorld);
    const lowSun = L.shadowOpacity ?? 0.34;
    this.shadowMat.uniforms.opacity.value = lowSun;
    this.blob.position.set(p[0], gy + 0.004, p[2]);
    this.blob.visible = vis && !st.lie;
    this.shadow.visible = vis && (L.shadows !== false);
    return st;
  }

  // caja en pantalla (px) de la figura completa, para el control de calidad
  screenBox(camera, W, H) {
    if (!this.pivot.visible) return null;
    const sc = this.pivot.scale.x; const base = this.pivot.position;
    const pts = [];
    const yaw = this.pivot.rotation.y;
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    for (const [dx, dy] of [[-0.35, 0], [0.35, 0], [-0.35, 1.75], [0.35, 1.75], [0, 1.95]]) {
      const v = new THREE.Vector3(base.x + dx * rx * sc, base.y + dy * sc, base.z + dx * rz * sc);
      v.project(camera); pts.push([(v.x * 0.5 + 0.5) * W, (1 - (v.y * 0.5 + 0.5)) * H, v.z]);
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), behind: pts.some((p) => p[2] > 1) };
  }
  worldHead(t) { const p = this.posAt(t).p; return [p[0], p[1] + 1.55 * this.scale, p[2]]; }
  dispose(scene) { scene.remove(this.pivot); scene.remove(this.shadow); scene.remove(this.blob); this.tex.dispose(); }
}
