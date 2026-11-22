// Biblioteca de poses, locomoción y clips procedurales. Todo es función pura del tiempo.
import { D2R, clamp, lerp, smooth } from './util.js';
import { DEFAULT_POSE } from './rig.js';

const L1 = 122, L2 = 116; // brazo y antebrazo
const SH = 98, SHY = -580;

// IK de dos huesos: devuelve {o,e} (grados) para que la mano llegue a (tx,ty) en el sistema de la tarjeta.
export function ikArm(side, tx, ty, bendOut = true) {
  const sx = side * SH, sy = SHY;
  let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy);
  const dmax = L1 + L2 - 2, dmin = Math.abs(L1 - L2) + 6;
  const dc = clamp(d, dmin, dmax);
  if (d > 1e-6) { dx *= dc / d; dy *= dc / d; d = dc; }
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const A = Math.acos(cosA);
  const base = Math.atan2(dy, dx);
  // el codo cae hacia abajo/afuera
  const cand = [base + A, base - A].map((a) => [sx + Math.cos(a) * L1, sy + Math.sin(a) * L1]);
  cand.sort((p, q) => (bendOut ? (q[1] - p[1]) + (side * (q[0] - p[0])) * 0.5 : p[1] - q[1]));
  const [ex, ey] = cand[0];
  const hx = sx + dx, hy = sy + dy;
  const o = Math.atan2(side * (ex - sx), ey - sy) / D2R;
  const a2 = Math.atan2(side * (hx - ex), hy - ey) / D2R;
  return { o, e: o - a2 };
}

const P = (over) => {
  const p = DEFAULT_POSE();
  for (const k of Object.keys(over)) {
    if (typeof over[k] === 'object' && !Array.isArray(over[k])) p[k] = Object.assign({}, p[k], over[k]);
    else p[k] = over[k];
  }
  return p;
};

// Poses estáticas. "expr" y "item" son opcionales.
export const POSES = {
  idle: { pose: P({}) },
  stand: { pose: P({ armL: { o: 8, e: 8 }, armR: { o: 8, e: 8 } }) },
  point: { pose: P({ armR: { o: 100, e: 0 }, lean: 2, headTurn: 0.4 }) },
  point_up: { pose: P({ armR: { o: 158, e: 4 }, lean: -2, headDown: -4 }) },
  point_left: { pose: P({ armL: { o: 100, e: 0 }, lean: -2, headTurn: -0.4 }) },
  surprised: { pose: P({ armL: { o: 62, e: 40 }, armR: { o: 62, e: 40 }, squash: 1.04, headDown: -8, legL: { f: 0, k: 0, s: 8 }, legR: { f: 0, k: 0, s: 8 } }), expr: 'surprised' },
  scared: { pose: P({ armL: { o: 40, e: 120 }, armR: { o: 40, e: 120 }, squash: 0.97, lean: -6, headDown: 8 }), expr: 'scared' },
  wave: { pose: P({ armR: { o: 150, e: 28 }, headRot: 4 }), expr: 'happy' },
  hands_hips: { pose: P({ armL: { o: 48, e: 95 }, armR: { o: 48, e: 95 }, headRot: -3 }) },
  cross_arms: { pose: P({ armL: { o: 6, e: 115 }, armR: { o: 6, e: 115 }, headRot: 3 }), expr: 'grumpy' },
  shrug: { pose: P({ armL: { o: 42, e: 60 }, armR: { o: 42, e: 60 }, headRot: 6, squash: 0.98 }) },
  hold_fwd: { pose: P({ armL: { o: 20, e: 70 }, armR: { o: 20, e: 70 } }) },
  carry_up: { pose: P({ armL: { o: 70, e: 110 }, armR: { o: 70, e: 110 } }) },
  stretch: { pose: P({ armL: { o: 172, e: 0 }, armR: { o: 172, e: 0 }, lean: -5, squash: 1.04, headDown: -8 }), expr: 'yawn' },
  sit: { pose: P({ legL: { f: 90, k: 90, s: 0 }, legR: { f: 90, k: 90, s: 0 }, armL: { o: 14, e: 52 }, armR: { o: 14, e: 52 }, sit: true }) },
  sit_lean: { pose: P({ legL: { f: 90, k: 90, s: 0 }, legR: { f: 90, k: 90, s: 0 }, armL: { o: 20, e: 70 }, armR: { o: 20, e: 70 }, lean: 6, sit: true }) },
  think: { pose: (() => { const a = ikArm(1, 30, -690); return P({ armR: a, armL: { o: 6, e: 100 }, headRot: -5, headTurn: 0.2 }); })(), expr: 'thinking' },
  shoot: { pose: (() => { const a = ikArm(1, 38, -628); return P({ armR: a, armL: { o: 10, e: 20 }, lean: -4, headDown: -4 }); })(), expr: 'puff', item: { name: 'peashooter', hand: 'R', angle: 0, rotAbs: 38 } },
  sleep: { pose: P({ armL: { o: 10, e: 26 }, armR: { o: 10, e: 26 } }), expr: 'sleep' },
  tired: { pose: P({ armL: { o: 3, e: 4 }, armR: { o: 3, e: 4 }, lean: 5, headDown: 14, squash: 0.985, headRot: 4 }), expr: 'sleepy' },
  walk1: { pose: null }, // marcador: se genera con walkPose
  run1: { pose: null },
};

export function walkPose(phase, amp = 1, lean = 3) {
  const p = DEFAULT_POSE();
  const A = 27 * amp, K = 38 * amp, B = 26 * amp;
  const s = Math.sin(phase), c = Math.cos(phase);
  p.legR = { f: A * s, k: K * Math.max(0, c) + 4, s: 2 };
  p.legL = { f: -A * s, k: K * Math.max(0, -c) + 4, s: 2 };
  p.armR = { o: 9 - B * s * 0.9, e: 14 + 10 * Math.max(0, s) };
  p.armL = { o: 9 - B * s * 0.9, e: 14 + 10 * Math.max(0, -s) };
  // en el lado izquierdo "adelante" es o negativo; invertimos
  p.armL.o = 9 + B * s * 0.9;
  p.lean = lean * amp;
  p.headRot = Math.sin(phase * 2) * 1.2 * amp;
  return p;
}

export function makePose(name, t = 0) {
  if (name === 'walk1') return { pose: walkPose(t * 6.0, 1), expr: 'neutral' };
  if (name === 'run1') return { pose: walkPose(t * 9.0, 1.6, 9), expr: 'surprised' };
  const d = POSES[name] || POSES.idle;
  return { pose: clonePose(d.pose), expr: d.expr, item: d.item };
}

export function clonePose(p) { return JSON.parse(JSON.stringify(p)); }

export function blendPose(a, b, u) {
  const out = {};
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k];
    if (typeof va === 'number') out[k] = lerp(va, vb ?? va, u);
    else if (typeof va === 'object' && va) out[k] = blendPose(va, vb ?? va, u);
    else out[k] = u < 0.5 ? va : (vb ?? va);
  }
  return out;
}
export function addPose(base, add, w = 1) { // suma de deltas numéricos
  for (const k of Object.keys(add)) {
    if (typeof add[k] === 'number') base[k] = (base[k] || 0) + add[k] * w;
    else if (typeof add[k] === 'object') addPose(base[k], add[k], w);
  }
  return base;
}
export function blendFace(a, b, u) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[k], vb = b[k];
    if (typeof va === 'number' || typeof vb === 'number') out[k] = lerp(va ?? 0, vb ?? 0, u);
    else if (typeof (va || vb) === 'object') out[k] = blendFace(va || {}, vb || {}, u);
  }
  return out;
}

// ---- clips: devuelven deltas o sobreescrituras de pose en función de u (0..1) y t (s)
// kind: 'add' (suma deltas) | 'set' (sobrescribe articulaciones)
export const CLIPS = {
  knock(u, t) { // golpea con el palo: brazo derecho arriba con vaivén
    const swing = Math.sin(t * 28) * 0.5 + 0.5;
    const w = smooth(Math.min(u * 6, 1)) * smooth(Math.min((1 - u) * 6, 1));
    return { kind: 'set', w, set: { armR: { o: 128 + swing * 22, e: 18 + swing * 34 }, lean: 3 + swing * 3 } };
  },
  wave(u, t) {
    const w = smooth(Math.min(u * 5, 1)) * smooth(Math.min((1 - u) * 5, 1));
    return { kind: 'set', w, set: { armR: { o: 148, e: 30 + Math.sin(t * 14) * 28 } } };
  },
  jump(u) { // salto con anticipación
    const a = u < 0.2 ? -smooth(u / 0.2) * 0.08 : 0;
    const air = u > 0.2 && u < 0.85 ? Math.sin((u - 0.2) / 0.65 * Math.PI) : 0;
    return { kind: 'add', w: 1, add: { y: -air * 90, squash: a + air * 0.06, armL: { o: air * 50 }, armR: { o: air * 50 } }, plant: air < 0.01 };
  },
  shake_head(u, t) { const w = Math.sin(u * Math.PI); return { kind: 'add', w: 1, add: { headRot: Math.sin(t * 16) * 9 * w, headTurn: 0 } }; },
  nod(u, t) { const w = Math.sin(u * Math.PI); return { kind: 'add', w: 1, add: { headDown: Math.sin(t * 12) * 9 * w } }; },
  shiver(u, t) { return { kind: 'add', w: 1, add: { x: Math.sin(t * 60) * 3, lean: Math.sin(t * 47) * 1.2 } }; },
  laugh(u, t) { return { kind: 'add', w: 1, add: { squash: Math.sin(t * 20) * 0.03, headRot: Math.sin(t * 10) * 3, y: 0 } }; },
  breathe(u, t) { return { kind: 'add', w: 1, add: { squash: Math.sin(t * 2.2) * 0.008 } }; },
  yawn(u) {
    const w = Math.sin(clamp(u) * Math.PI);
    const a = ikArm(1, 40, -640);
    return { kind: 'mix', w: Math.min(1, w * 1.6), set: { armR: a, headDown: -10, lean: -4 }, expr: 'yawn' };
  },
  stretch(u) {
    const w = Math.sin(clamp(u) * Math.PI);
    return { kind: 'mix', w: Math.min(1, w * 1.5), set: { armL: { o: 172, e: 0 }, armR: { o: 172, e: 0 }, lean: -5, squash: 1.04, headDown: -8 }, expr: 'yawn' };
  },
  puff(u, t) { // soplar por la cerbatana: rebote suave
    const w = Math.min(1, Math.sin(clamp(u) * Math.PI) * 4);
    const a = ikArm(1, 38, -628);
    return { kind: 'mix', w, set: { armR: a, lean: -4 - Math.sin(t * 20) * 1 }, expr: 'puff', item: { name: 'peashooter', hand: 'R', rotAbs: 38 } };
  },
  tremble(u, t) { return { kind: 'add', w: 1, add: { x: Math.sin(t * 38) * 4, headRot: Math.sin(t * 31) * 2 } }; },
  hop(u) { const a = Math.abs(Math.sin(u * Math.PI * 3)); return { kind: 'add', w: 1, add: { y: -a * 36 }, plant: a < 0.02 }; },
};
