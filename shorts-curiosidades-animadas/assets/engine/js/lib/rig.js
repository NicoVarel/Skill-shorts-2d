// Dibujo de personajes 2D "cutout" por capas (vectorial, Canvas2D).
// Un personaje = especificación JSON (character-bible) + pose (ángulos de articulaciones).
// Origen del dibujo: centro de las suelas, y hacia arriba es negativo. Unidad ≈ 2 mm (adulto ≈ 848 u ≈ 1,70 m).
import { D2R, clamp, lerp } from './util.js';

export const CARD_W = 720, CARD_H = 1120, FEET_Y = 1060, UNIT_M = 0.002;
export const INK = '#2a1b2e';

// ------------------------------------------------------------------ color
function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, f) { // f<0 oscurece, f>0 aclara
  const [r, g, b] = hex2rgb(hex);
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  const m = (c) => Math.round(lerp(c, t, p));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function grad(ctx, hex, x0, y0, x1, y1, dark = -0.22) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(hex, 0.06));
  g.addColorStop(0.55, hex);
  g.addColorStop(1, shade(hex, dark));
  return g;
}

// ------------------------------------------------------------------ expresiones
export const EXPRESSIONS = {
  neutral:   { eyeOpen: 1, pupilX: 0, pupilY: 0, browL: 0, browR: 0, tilt: 0, mouth: { open: 0, smile: 0.25, wide: 1, round: 0 } },
  happy:     { eyeOpen: 0.9, browL: 0.25, browR: 0.25, tilt: 0, mouth: { open: 0.35, smile: 1, wide: 1.15, round: 0 } },
  big_smile: { eyeOpen: 0.7, browL: 0.3, browR: 0.3, tilt: 0, mouth: { open: 0.65, smile: 1, wide: 1.3, round: 0, teeth: 1 } },
  sad:       { eyeOpen: 0.85, browL: 0.35, browR: 0.35, tilt: -0.9, mouth: { open: 0, smile: -0.9, wide: 0.8, round: 0 } },
  angry:     { eyeOpen: 0.85, browL: -0.2, browR: -0.2, tilt: 1, mouth: { open: 0.15, smile: -0.8, wide: 1, round: 0, teeth: 1 } },
  grumpy:    { eyeOpen: 0.55, browL: -0.1, browR: -0.1, tilt: 0.7, mouth: { open: 0, smile: -0.6, wide: 0.9, round: 0 } },
  surprised: { eyeOpen: 1.25, browL: 0.9, browR: 0.9, tilt: 0, mouth: { open: 0.8, smile: 0, wide: 0.5, round: 1 } },
  scared:    { eyeOpen: 1.3, browL: 0.8, browR: 0.8, tilt: -0.7, mouth: { open: 0.55, smile: -0.4, wide: 0.9, round: 0.2, teeth: 1 } },
  sleepy:    { eyeOpen: 0.3, browL: 0.1, browR: 0.1, tilt: -0.2, mouth: { open: 0.1, smile: 0, wide: 0.8, round: 0.4 } },
  sleep:     { eyeOpen: 0, browL: 0.1, browR: 0.1, tilt: -0.1, mouth: { open: 0.15, smile: 0.1, wide: 0.7, round: 0.4 } },
  yawn:      { eyeOpen: 0.05, browL: 0.5, browR: 0.5, tilt: -0.3, mouth: { open: 1, smile: 0, wide: 0.9, round: 0.7 } },
  smug:      { eyeOpen: 0.6, browL: 0.2, browR: -0.15, tilt: 0.2, mouth: { open: 0, smile: 0.7, wide: 1, round: 0, side: 0.6 } },
  thinking:  { eyeOpen: 0.9, pupilX: 0.5, pupilY: -0.5, browL: 0.5, browR: 0.1, tilt: 0.1, mouth: { open: 0, smile: -0.05, wide: 0.6, round: 0, side: -0.4 } },
  laugh:     { eyeOpen: 0.2, browL: 0.5, browR: 0.5, tilt: 0, mouth: { open: 1, smile: 1, wide: 1.3, round: 0, teeth: 1 } },
  worried:   { eyeOpen: 1.1, browL: 0.6, browR: 0.6, tilt: -1, mouth: { open: 0.05, smile: -0.4, wide: 0.8, round: 0 } },
  puff:      { eyeOpen: 0.9, browL: 0.1, browR: 0.1, tilt: 0, mouth: { open: 0.1, smile: 0, wide: 0.4, round: 1 } },
};

export const DEFAULT_POSE = () => ({
  x: 0, y: 0, lean: 0, headRot: 0, headTurn: 0, headDown: 0, squash: 1,
  armL: { o: 9, e: 6 }, armR: { o: 9, e: 6 },
  legL: { f: 0, k: 0, s: 3 }, legR: { f: 0, k: 0, s: 3 },
  sit: false,
});

// ------------------------------------------------------------------ primitivas
function limb(ctx, x0, y0, x1, y1, w0, w1, fill, lw = 7, stroke = INK) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke();
}
function circle(ctx, x, y, r, fill, lw = 6) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
function ell(ctx, x, y, rx, ry, fill, lw = 6, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fillStroke(ctx, fill, lw = 7) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}

// ------------------------------------------------------------------ cabeza
function headPath(ctx, W = 135, T = -128, B = 126) {
  ctx.beginPath();
  ctx.moveTo(0, T);
  ctx.bezierCurveTo(W * 0.78, T + 2, W * 1.02, -52, W, 6);
  ctx.bezierCurveTo(W * 0.96, 78, W * 0.54, B, 0, B);
  ctx.bezierCurveTo(-W * 0.54, B, -W * 0.96, 78, -W, 6);
  ctx.bezierCurveTo(-W * 1.02, -52, -W * 0.78, T + 2, 0, T);
  ctx.closePath();
}

function drawHairBack(ctx, spec, L) {
  const h = spec.hair || {}; const c = h.color || '#4a2c1a';
  if (h.style === 'long') {
    ctx.beginPath();
    ctx.moveTo(-138, -20); ctx.bezierCurveTo(-172, 90, -150, 210, -118, 232);
    ctx.lineTo(118, 232); ctx.bezierCurveTo(150, 210, 172, 90, 138, -20);
    ctx.bezierCurveTo(120, -140, -120, -140, -138, -20); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -140, 0, 140, 0), 7);
  } else if (h.style === 'bob') {
    ctx.beginPath();
    ctx.moveTo(-140, -10); ctx.bezierCurveTo(-170, 60, -150, 120, -120, 130);
    ctx.lineTo(120, 130); ctx.bezierCurveTo(150, 120, 170, 60, 140, -10);
    ctx.bezierCurveTo(120, -140, -120, -140, -140, -10); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -140, 0, 140, 0), 7);
  } else if (h.style === 'bun') {
    circle(ctx, 0, -150, 52, grad(ctx, c, -50, -190, 50, -110), 7);
  }
}

function drawHairFront(ctx, spec, L, hatOn) {
  const h = spec.hair || {}; const c = h.color || '#4a2c1a';
  const style = h.style || 'short';
  const fill = grad(ctx, c, -140, -120, 140, 0, -0.28);
  if (style === 'none') return;
  if (style === 'bald') { // solo patillas laterales
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sx * 128, -40);
      ctx.bezierCurveTo(sx * 150, -10, sx * 150, 50, sx * 118, 66);
      ctx.bezierCurveTo(sx * 122, 30, sx * 124, 0, sx * 128, -40); ctx.closePath(); fillStroke(ctx, fill, 6);
    }
    return;
  }
  ctx.beginPath();
  if (style === 'curly') {
    ctx.moveTo(-130, -30);
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI, x = Math.cos(a) * 140, y = Math.sin(a) * 140 - 10;
      ctx.arc(x * 0.98, y * 0.95, 34, 0, Math.PI * 2);
    }
    ctx.closePath(); fillStroke(ctx, fill, 7);
    // marco frontal
    ctx.beginPath(); ctx.moveTo(-124, -55); ctx.bezierCurveTo(-80, -100, 80, -100, 124, -55);
    ctx.lineTo(124, -80); ctx.bezierCurveTo(60, -130, -60, -130, -124, -80); ctx.closePath(); fillStroke(ctx, fill, 5);
    return;
  }
  const part = style === 'part' ? 0.5 : 0;
  ctx.moveTo(-136, 6);
  ctx.bezierCurveTo(-148, -80, -100, -140, 0, -138 + (hatOn ? 14 : 0));
  ctx.bezierCurveTo(100, -140, 148, -80, 136, 6);
  ctx.bezierCurveTo(130, -40, 96, -62, 58, -66);
  ctx.bezierCurveTo(30, -92 - part * 10, -30, -78, -70, -64);
  ctx.bezierCurveTo(-104, -58, -126, -36, -136, 6);
  ctx.closePath(); fillStroke(ctx, fill, 7);
}

function drawHat(ctx, spec, pose) {
  const hat = (spec.outfit && spec.outfit.hat) || { type: 'none' };
  const c = hat.color || '#333';
  const band = hat.band;
  const t = hat.type;
  if (!t || t === 'none') return;
  if (t === 'top') {
    ell(ctx, 0, -104, 168, 30, shade(c, -0.1), 7);
    rrect(ctx, -88, -272, 176, 176, 14); fillStroke(ctx, grad(ctx, c, -90, 0, 90, 0, -0.35), 7);
    if (band) { rrect(ctx, -88, -146, 176, 34, 4); fillStroke(ctx, band, 6); }
    ell(ctx, 0, -272, 88, 20, shade(c, 0.08), 6);
  } else if (t === 'bowler') {
    ell(ctx, 0, -86, 158, 26, shade(c, -0.1), 7);
    ctx.beginPath(); ctx.moveTo(-104, -88); ctx.bezierCurveTo(-110, -200, 110, -200, 104, -88); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -100, 0, 100, 0, -0.35), 7);
    if (band) { ctx.beginPath(); ctx.moveTo(-104, -88); ctx.lineTo(104, -88); ctx.lineTo(100, -118); ctx.lineTo(-100, -118); ctx.closePath(); fillStroke(ctx, band, 6); }
  } else if (t === 'flatcap') {
    ctx.beginPath(); ctx.moveTo(-142, -66); ctx.bezierCurveTo(-148, -170, 130, -176, 144, -76);
    ctx.bezierCurveTo(100, -60, -80, -52, -142, -66); ctx.closePath(); fillStroke(ctx, grad(ctx, c, -140, 0, 140, 0, -0.3), 7);
    ctx.beginPath(); ctx.moveTo(60, -78); ctx.bezierCurveTo(120, -62, 190, -64, 196, -78); ctx.bezierCurveTo(170, -96, 110, -96, 60, -90);
    ctx.closePath(); fillStroke(ctx, shade(c, -0.2), 6);
  } else if (t === 'bonnet') {
    ctx.beginPath(); ctx.moveTo(-148, 30); ctx.bezierCurveTo(-170, -150, 170, -150, 148, 30);
    ctx.bezierCurveTo(130, -20, 100, -70, 0, -78); ctx.bezierCurveTo(-100, -70, -130, -20, -148, 30); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -150, 0, 150, 0, -0.3), 7);
    ctx.beginPath(); ctx.moveTo(-132, 30); ctx.quadraticCurveTo(-110, 130, -60, 168); ctx.lineTo(-30, 150); ctx.quadraticCurveTo(-90, 100, -104, 30); ctx.closePath();
    fillStroke(ctx, band || '#d6564a', 6);
    ctx.beginPath(); ctx.moveTo(132, 30); ctx.quadraticCurveTo(110, 130, 60, 168); ctx.lineTo(30, 150); ctx.quadraticCurveTo(90, 100, 104, 30); ctx.closePath();
    fillStroke(ctx, band || '#d6564a', 6);
  } else if (t === 'nightcap') {
    ctx.beginPath(); ctx.moveTo(-140, -52); ctx.bezierCurveTo(-130, -210, 40, -260, 180, -130);
    ctx.bezierCurveTo(120, -140, 80, -110, 140, -52); ctx.bezierCurveTo(60, -70, -60, -72, -140, -52); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -140, -200, 140, -50, -0.25), 7);
    circle(ctx, 186, -126, 26, '#fff', 6);
    rrect(ctx, -146, -76, 292, 32, 14); fillStroke(ctx, band || '#fff', 6);
  } else if (t === 'shawl') {
    ctx.beginPath(); ctx.moveTo(-150, 40); ctx.bezierCurveTo(-170, -160, 170, -160, 150, 40);
    ctx.bezierCurveTo(130, -30, 70, -70, 0, -70); ctx.bezierCurveTo(-70, -70, -130, -30, -150, 40); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -150, 0, 150, 0, -0.3), 7);
  } else if (t === 'helmet') {
    ctx.beginPath(); ctx.moveTo(-150, -50); ctx.bezierCurveTo(-150, -230, 150, -230, 150, -50); ctx.closePath();
    fillStroke(ctx, grad(ctx, c, -150, 0, 150, 0, -0.3), 7);
    rrect(ctx, -160, -64, 320, 22, 8); fillStroke(ctx, shade(c, -0.15), 6);
  }
}

function drawMouth(ctx, m, skin) {
  const w = 46 * (m.wide ?? 1), s = m.smile ?? 0, o = clamp(m.open ?? 0, 0, 1.2);
  const side = (m.side ?? 0) * 18;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o < 0.06) {
    ctx.beginPath(); ctx.moveTo(-w + side * 0.3, -s * 6); ctx.quadraticCurveTo(side, s * 26 + 4, w + side * 0.3, -s * 6 + (m.side ? -side * 0.3 : 0));
    ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
    return;
  }
  const hOpen = 12 + o * 48;
  if ((m.round ?? 0) > 0.5) { // boca en "o"
    const rx = 20 + o * 10, ry = 14 + o * 30;
    ctx.beginPath(); ctx.ellipse(0, ry * 0.6, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5b1f2f'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#e8737e'; ctx.beginPath(); ctx.ellipse(0, ry * 1.3, rx * 0.8, ry * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
    return;
  }
  const rw = w;
  ctx.beginPath();
  ctx.moveTo(-rw, -s * 5);
  ctx.quadraticCurveTo(0, s * 22 - 4 + 0, rw, -s * 5);
  ctx.quadraticCurveTo(rw * 0.9, hOpen + 6 + (s > 0 ? s * 6 : 0), 0, hOpen + 8);
  ctx.quadraticCurveTo(-rw * 0.9, hOpen + 6 + (s > 0 ? s * 6 : 0), -rw, -s * 5);
  ctx.closePath();
  ctx.fillStyle = '#5b1f2f'; ctx.fill();
  ctx.save(); ctx.clip();
  if (m.teeth) { ctx.fillStyle = '#fff'; ctx.fillRect(-rw, -12, rw * 2, 20); }
  ctx.fillStyle = '#e8737e'; ctx.beginPath(); ctx.ellipse(0, hOpen + 6, rw * 0.55, hOpen * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
}

function drawFace(ctx, spec, face, turn, skin, tHeadDown) {
  const f = spec.face || {};
  const tx = turn * 38;
  const eo = clamp(face.eyeOpen ?? 1, 0, 1.4);
  const eyeY = 6, eyeDX = 54 - Math.abs(turn) * 8;
  const ex = (side) => side * eyeDX + tx;
  // cejas
  const bt = face.tilt ?? 0;
  for (const side of [-1, 1]) {
    const lift = (side < 0 ? face.browL : face.browR) ?? 0;
    const cx = ex(side), cy = -40 - lift * 22 + (eo < 0.4 ? 8 : 0);
    const inner = side * -1; // dirección hacia el centro
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy + bt * -10 * (side > 0 ? 1 : -1) * -1 * 0 + (-side * bt * -9));
    ctx.quadraticCurveTo(cx, cy - 8 - lift * 4, cx + 28, cy + (-side * bt * 9) * -1);
    ctx.lineWidth = 11; ctx.strokeStyle = (f.brow || (spec.hair && spec.hair.color) || '#3a2a22'); ctx.lineCap = 'round'; ctx.stroke();
  }
  // ojos
  for (const side of [-1, 1]) {
    const x = ex(side);
    if (eo < 0.12) { // cerrados
      ctx.beginPath(); ctx.moveTo(x - 24, eyeY + 4); ctx.quadraticCurveTo(x, eyeY + 20, x + 24, eyeY + 4);
      ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
      continue;
    }
    const ry = 30 * eo, rx = 24;
    ctx.beginPath(); ctx.ellipse(x, eyeY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fffdf8'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    // pupila
    const px = clamp(face.pupilX ?? 0, -1, 1) * 10 + (turn * 6), py = clamp(face.pupilY ?? 0, -1, 1) * 9 + 2;
    const pr = (f.eyes === 'big' ? 13 : 11);
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, rx - 2, ry - 2, 0, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.arc(x + px, eyeY + py, pr, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
    // párpado (sueño)
    if (eo < 0.95) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(x, eyeY, rx, ry, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = shade(skin, -0.06); ctx.fillRect(x - 40, eyeY - 50, 80, 50 - ry * 2 * (eo) + 30 * (1 - eo) * 0 + (ry * 2 * (1 - eo)) * 0 + (1 - eo) * 40 * 0 + 0);
      ctx.restore();
    }
  }
  // nariz
  const nx = tx * 1.35;
  if (f.nose === 'pointy') {
    ctx.beginPath(); ctx.moveTo(nx - 10, 36); ctx.quadraticCurveTo(nx + 6, 22, nx + 22, 46); ctx.quadraticCurveTo(nx + 6, 52, nx - 10, 46);
    ctx.closePath(); fillStroke(ctx, shade(skin, -0.06), 5);
  } else {
    ell(ctx, nx, 38, 16, 13, shade(skin, -0.05), 5);
  }
  if (f.freckles) {
    ctx.fillStyle = 'rgba(150,80,40,.55)';
    for (const [dx, dy] of [[-70, 36], [-52, 46], [-86, 46], [70, 36], [52, 46], [86, 46]]) { ctx.beginPath(); ctx.arc(dx + tx, dy, 4, 0, Math.PI * 2); ctx.fill(); }
  }
  // boca
  ctx.save(); ctx.translate(tx * 1.2, 80); drawMouth(ctx, face.mouth || {}, skin); ctx.restore();
  // bigote / barba / gafas
  const acc = (spec.outfit && spec.outfit.accessories) || [];
  const hc = (spec.hair && spec.hair.color) || '#3a2a22';
  if (acc.includes('beard')) {
    ctx.beginPath(); ctx.moveTo(-118, 36); ctx.bezierCurveTo(-120, 130, -50, 160, 0, 160); ctx.bezierCurveTo(50, 160, 120, 130, 118, 36);
    ctx.bezierCurveTo(90, 70, 60, 76, 0, 70); ctx.bezierCurveTo(-60, 76, -90, 70, -118, 36); ctx.closePath();
    ctx.save(); ctx.translate(tx * 0.6, 0); fillStroke(ctx, grad(ctx, hc, -100, 0, 100, 0, -0.3), 6); ctx.restore();
    ctx.save(); ctx.translate(tx * 1.2, 80); drawMouth(ctx, face.mouth || {}, skin); ctx.restore();
  }
  if (acc.includes('mustache')) {
    ctx.save(); ctx.translate(tx * 1.3, 62);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(s * 20, -16, s * 62, -10, s * 78, 12); ctx.bezierCurveTo(s * 52, 14, s * 22, 20, 0, 12);
      ctx.closePath(); fillStroke(ctx, grad(ctx, hc, -60, 0, 60, 0, -0.3), 5);
    }
    ctx.restore();
  }
  if (acc.includes('glasses')) {
    ctx.lineWidth = 7; ctx.strokeStyle = INK;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex(s), eyeY, 38, 36, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(ex(-1) + 38, eyeY - 4); ctx.lineTo(ex(1) - 38, eyeY - 4); ctx.stroke();
  }
}

function drawHead(ctx, spec, pose, face) {
  const skin = spec.skin || '#f0c8a0';
  const turn = clamp(pose.headTurn || 0, -1, 1);
  const hatOn = ((spec.outfit && spec.outfit.hat && spec.outfit.hat.type) || 'none') !== 'none';
  drawHairBack(ctx, spec);
  // orejas
  for (const s of [-1, 1]) ell(ctx, s * (134 - Math.abs(turn) * 4) + turn * 10, 14, 22, 28, shade(skin, -0.06), 6);
  headPath(ctx);
  ctx.fillStyle = grad(ctx, skin, -140, -100, 140, 100, -0.16); ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
  drawHairFront(ctx, spec, null, hatOn);
  drawFace(ctx, spec, face, turn, skin);
  drawHat(ctx, spec, pose);
}

// ------------------------------------------------------------------ cuerpo
function drawTorso(ctx, spec, pose, sleeveHex) {
  const o = spec.outfit || {}, top = o.top || { type: 'jacket', color: '#556' };
  const tc = top.color || '#556';
  const type = top.type || 'jacket';
  const sw = 100, hw = 82; // semianchos hombro y cadera
  const topY = -596, botY = -345;
  ctx.beginPath();
  if (type === 'dress' || type === 'robe') {
    const hem = type === 'robe' ? 120 : 150;
    ctx.moveTo(-sw + 10, topY + 8);
    ctx.quadraticCurveTo(0, topY - 18, sw - 10, topY + 8);
    ctx.bezierCurveTo(sw + 4, topY + 80, hw - 6, botY - 90, hw + 4, botY - 70);
    ctx.bezierCurveTo(hw + 30, botY - 10, hw + hem, botY + 150, hw + hem * 0.95, botY + 188);
    ctx.quadraticCurveTo(0, botY + 214, -hw - hem * 0.95, botY + 188);
    ctx.bezierCurveTo(-hw - hem, botY + 150, -hw - 30, botY - 10, -hw - 4, botY - 70);
    ctx.bezierCurveTo(-hw + 6, botY - 90, -sw - 4, topY + 80, -sw + 10, topY + 8);
  } else if (type === 'coat') {
    ctx.moveTo(-sw + 8, topY + 8); ctx.quadraticCurveTo(0, topY - 16, sw - 8, topY + 8);
    ctx.bezierCurveTo(sw + 6, topY + 70, hw + 6, botY - 80, hw + 22, botY + 70);
    ctx.quadraticCurveTo(0, botY + 96, -hw - 22, botY + 70);
    ctx.bezierCurveTo(-hw - 6, botY - 80, -sw - 6, topY + 70, -sw + 8, topY + 8);
  } else {
    ctx.moveTo(-sw + 8, topY + 8); ctx.quadraticCurveTo(0, topY - 16, sw - 8, topY + 8);
    ctx.bezierCurveTo(sw + 4, topY + 70, hw + 2, botY - 70, hw, botY + 10);
    ctx.quadraticCurveTo(0, botY + 30, -hw, botY + 10);
    ctx.bezierCurveTo(-hw - 2, botY - 70, -sw - 4, topY + 70, -sw + 8, topY + 8);
  }
  ctx.closePath();
  ctx.fillStyle = grad(ctx, tc, -sw, -500, sw, -400, -0.24); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke();
  const bt = (type === 'dress' || type === 'robe') ? 120 : 0;
  // chaleco / camisa debajo
  if (top.vest) {
    ctx.save(); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-26, topY - 4); ctx.lineTo(0, topY + 120); ctx.lineTo(26, topY - 4); ctx.closePath();
    ctx.fillStyle = top.shirt || '#f1ead8'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-26, topY - 2); ctx.lineTo(0, topY + 120); ctx.lineTo(26, topY - 2); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  }
  // botones
  if (top.buttons) {
    for (let i = 0; i < 4; i++) { circle(ctx, 0, topY + 64 + i * 46, 7, top.buttons, 4); }
  }
  // costura central de abrigo
  if (type === 'coat' || type === 'jacket') {
    ctx.beginPath(); ctx.moveTo(0, topY + 30); ctx.lineTo(0, botY + (type === 'coat' ? 92 : 24)); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(42,27,46,.55)'; ctx.stroke();
  }
  if (top.trim && (type === 'dress' || type === 'coat' || type === 'robe')) {
    ctx.save(); ctx.clip();
    const hy = type === 'coat' ? botY + 70 : botY + 188 - 0;
    ctx.fillStyle = top.trim; ctx.fillRect(-400, hy - 18, 800, 40); ctx.restore();
  }
  // delantal
  const acc = o.accessories || [];
  const apron = o.apron || (acc.includes('apron') ? '#f3efe4' : null);
  if (apron) {
    ctx.beginPath(); ctx.moveTo(-66, topY + 70); ctx.lineTo(66, topY + 70); ctx.lineTo(hw + 40 + bt * 0.55, botY + 168 + (bt ? 20 : 0)); ctx.quadraticCurveTo(0, botY + 196 + (bt ? 20 : 0), -hw - 40 - bt * 0.55, botY + 168 + (bt ? 20 : 0)); ctx.closePath();
    ctx.fillStyle = grad(ctx, apron, -70, 0, 70, 0, -0.1); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-66, topY + 70); ctx.lineTo(-52, topY + 4); ctx.moveTo(66, topY + 70); ctx.lineTo(52, topY + 4); ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.stroke();
  }
  // cinturón
  if (top.belt) {
    rrect(ctx, -hw - 4, botY - 24, hw * 2 + 8, 26, 6); fillStroke(ctx, top.belt, 5);
  }
  // bufanda / cuello
  if (acc.includes('scarf')) {
    ctx.beginPath(); ctx.ellipse(0, topY - 6, 74, 26, 0, 0, Math.PI * 2); fillStroke(ctx, o.scarf || '#b4423a', 7);
    rrect(ctx, 20, topY, 34, 110, 12); fillStroke(ctx, o.scarf || '#b4423a', 6);
  }
  if (acc.includes('cravat')) {
    ctx.beginPath(); ctx.moveTo(0, topY + 2); ctx.lineTo(-22, topY + 40); ctx.lineTo(0, topY + 92); ctx.lineTo(22, topY + 40); ctx.closePath(); fillStroke(ctx, o.cravat || '#9c2f2f', 5);
  }
}

function drawLegs(ctx, spec, pose, parts) {
  const o = spec.outfit || {};
  const bottom = o.bottom || { type: 'trousers', color: '#3a3a4a' };
  const shoeC = (o.shoes && o.shoes.color) || '#2d2320';
  const skirty = (o.top && (o.top.type === 'dress' || o.top.type === 'robe'));
  const legC = skirty ? ((o.stockings) || '#efe6d6') : (bottom.color || '#3a3a4a');
  const draw = (leg, side, back) => {
    const hx = side * 42, hy = -345;
    const f = leg.f * D2R, k = leg.k * D2R, spread = ((leg.s || 0) * side) * D2R;
    const t0 = f + spread * 0, ang1 = t0, ang2 = f - k;
    const a1 = [Math.sin(ang1 + spread), Math.cos(ang1 + spread)];
    const kx = hx + a1[0] * 172, ky = hy + a1[1] * 172;
    const a2 = [Math.sin(ang2 + spread), Math.cos(ang2 + spread)];
    const ax = kx + a2[0] * 156, ay = ky + a2[1] * 156;
    parts.push({ side, hx, hy, kx, ky, ax, ay, ang2: ang2 + spread, back });
  };
  draw(pose.legL, -1, false); draw(pose.legR, 1, false);
  // dibuja detrás hacia delante: el que más avanza va delante
  parts.sort((a, b) => a.ax - b.ax);
  for (const p of parts) {
    limb(ctx, p.hx, p.hy, p.kx, p.ky, 50, 44, grad(ctx, legC, -22, 0, 22, 0, -0.2), 7);
    limb(ctx, p.kx, p.ky, p.ax, p.ay, 44, 36, grad(ctx, legC, -22, 0, 22, 0, -0.2), 7);
    circle(ctx, p.kx, p.ky, 14, 'rgba(0,0,0,0)', 0);
    // zapato (apunta hacia +x)
    ctx.save(); ctx.translate(p.ax, p.ay + 4); ctx.rotate(-(p.ang2) * 0.35);
    ctx.beginPath(); ctx.moveTo(-22, -16); ctx.lineTo(18, -16); ctx.bezierCurveTo(70, -14, 84, 10, 78, 22);
    ctx.lineTo(-24, 22); ctx.bezierCurveTo(-30, 10, -28, -6, -22, -16); ctx.closePath();
    fillStroke(ctx, grad(ctx, shoeC, 0, -16, 0, 22, -0.3), 7);
    ctx.beginPath(); ctx.moveTo(-24, 17); ctx.lineTo(78, 17); ctx.lineWidth = 5; ctx.strokeStyle = shade('#000000', 0); ctx.strokeStyle = '#1b1218'; ctx.stroke();
    ctx.restore();
  }
}

function armGeom(pose, side, spec) {
  const arm = side < 0 ? pose.armL : pose.armR;
  const sx = side * 98, sy = -580;
  const o = arm.o * D2R, e = arm.e * D2R;
  const a1 = o; // desde "abajo" hacia fuera
  const ex_ = sx + side * Math.sin(a1) * 122, ey_ = sy + Math.cos(a1) * 122;
  const a2 = o - e;
  const hx = ex_ + side * Math.sin(a2) * 116, hy = ey_ + Math.cos(a2) * 116;
  return { sx, sy, ex: ex_, ey: ey_, hx, hy, a2, side };
}

function drawArm(ctx, spec, g, skin) {
  const o = spec.outfit || {}, top = o.top || {};
  const sleeve = top.sleeve || top.color || '#556';
  const bare = top.bareArms;
  const c = bare ? skin : sleeve;
  limb(ctx, g.sx, g.sy, g.ex, g.ey, 38, 33, grad(ctx, c, -20, 0, 20, 0, -0.22), 7);
  limb(ctx, g.ex, g.ey, g.hx, g.hy, 33, 28, grad(ctx, c, -20, 0, 20, 0, -0.22), 7);
  if (!bare && top.cuff) { const k = 0.9; limb(ctx, g.ex + (g.hx - g.ex) * k, g.ey + (g.hy - g.ey) * k, g.hx, g.hy, 34, 30, top.cuff, 5); }
  circle(ctx, g.hx, g.hy, 25, grad(ctx, skin, -20, -20, 20, 20, -0.16), 6);
}

// ------------------------------------------------------------------ objetos en la mano
export function drawItem(ctx, name, x, y, ang, side) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const dir = side; // +1 = brazo derecho del canvas
  switch (name) {
    case 'peashooter': { // tubo largo
      ctx.rotate(-dir * 0.0);
      rrect(ctx, -14, -160, 28, 230, 12); fillStroke(ctx, grad(ctx, '#8a5a34', -14, 0, 14, 0, -0.35), 6);
      ctx.fillStyle = '#c9a063'; ctx.fillRect(-14, -160, 28, 14); rrect(ctx, -16, -166, 32, 14, 6); ctx.fillStyle = '#c9a063'; ctx.fill(); ctx.stroke();
      break;
    }
    case 'pole': { // palo largo con alambre
      rrect(ctx, -9, -420, 18, 560, 8); fillStroke(ctx, grad(ctx, '#a67c52', -9, 0, 9, 0, -0.3), 6);
      ctx.beginPath(); ctx.moveTo(0, -420); ctx.lineTo(18, -450); ctx.lineTo(0, -470); ctx.lineTo(18, -498);
      ctx.lineWidth = 4; ctx.strokeStyle = '#555'; ctx.stroke(); break;
    }
    case 'mug': { rrect(ctx, -26, -48, 52, 60, 10); fillStroke(ctx, '#e9e2d2', 6); ctx.beginPath(); ctx.arc(30 * dir, -20, 16, -1.2, 1.2, dir < 0); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); break; }
    case 'candle': { rrect(ctx, -12, -70, 24, 80, 6); fillStroke(ctx, '#f4eed6', 5); ctx.beginPath(); ctx.moveTo(0, -112); ctx.quadraticCurveTo(18, -88, 0, -72); ctx.quadraticCurveTo(-18, -88, 0, -112); ctx.fillStyle = '#ffb02e'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke(); break; }
    case 'lantern': { ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 30); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); rrect(ctx, -30, 30, 60, 74, 10); fillStroke(ctx, '#ffd36a', 6); rrect(ctx, -34, 24, 68, 12, 4); fillStroke(ctx, '#3b3033', 5); break; }
    case 'letter': { ctx.rotate(0.2 * dir); rrect(ctx, -44, -70, 88, 62, 4); fillStroke(ctx, '#f6f0df', 5); ctx.beginPath(); ctx.moveTo(-44, -70); ctx.lineTo(0, -36); ctx.lineTo(44, -70); ctx.lineWidth = 4; ctx.stroke(); break; }
    case 'newspaper': { ctx.rotate(0.15 * dir); rrect(ctx, -66, -120, 132, 150, 4); fillStroke(ctx, '#ece4cd', 5); ctx.fillStyle = '#6b6258'; for (let i = 0; i < 7; i++) ctx.fillRect(-52, -104 + i * 18, i % 3 === 0 ? 100 : 84, 7); ctx.fillStyle = '#2a1b2e'; ctx.fillRect(-52, -108, 104, 14); break; }
    case 'book': { rrect(ctx, -44, -86, 88, 112, 6); fillStroke(ctx, '#6b3a2e', 6); ctx.fillStyle = '#e8d9a8'; ctx.fillRect(-36, -78, 8, 96); break; }
    case 'clock': { circle(ctx, 0, -40, 44, '#e9e2d2', 7); ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -66); ctx.moveTo(0, -40); ctx.lineTo(18, -36); ctx.lineWidth = 6; ctx.stroke(); circle(ctx, -28, -88, 14, '#c9a063', 5); circle(ctx, 28, -88, 14, '#c9a063', 5); break; }
    case 'ball': { circle(ctx, 0, -34, 40, grad(ctx, '#223a8a', -40, -60, 40, 10, -0.5), 7); circle(ctx, -10, -52, 6, '#111', 0); circle(ctx, 8, -56, 6, '#111', 0); circle(ctx, 0, -40, 6, '#111', 0); break; }
    case 'broom': { rrect(ctx, -8, -300, 16, 330, 6); fillStroke(ctx, '#a67c52', 5); ctx.beginPath(); ctx.moveTo(-30, 30); ctx.lineTo(30, 30); ctx.lineTo(44, 100); ctx.lineTo(-44, 100); ctx.closePath(); fillStroke(ctx, '#d3b05a', 6); break; }
    case 'phone': { ctx.rotate(0.25 * dir); rrect(ctx, -26, -92, 52, 92, 9); fillStroke(ctx, '#23242c', 6); rrect(ctx, -19, -82, 38, 66, 4); ctx.fillStyle = '#8fd3ff'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-12, -66, 24, 6); break; }
    case 'coin': { circle(ctx, 0, -20, 22, '#e3b341', 6); break; }
    case 'hammer': { rrect(ctx, -7, -100, 14, 130, 5); fillStroke(ctx, '#9b6b3f', 5); rrect(ctx, -34, -126, 68, 34, 6); fillStroke(ctx, '#7a7a86', 6); break; }
    case 'umbrella': { rrect(ctx, -5, -150, 10, 190, 4); fillStroke(ctx, '#3b3033', 4); ctx.beginPath(); ctx.moveTo(-110, -150); ctx.bezierCurveTo(-90, -250, 90, -250, 110, -150); ctx.quadraticCurveTo(55, -170, 0, -150); ctx.quadraticCurveTo(-55, -170, -110, -150); fillStroke(ctx, '#2d3b6b', 6); break; }
    default: break;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ personaje completo
export function drawCharacter(ctx, spec, st, S = 1.5) {
  const pose = st.pose, face = st.face;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.translate(CARD_W / 2, FEET_Y);
  if (st.flip < 0) ctx.scale(-1, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const skin = spec.skin || '#f0c8a0';
  const sq = pose.squash || 1;

  // 1) alinear los pies al suelo (apoyo) calculando la posición real de los pies
  const probe = [];
  const lp = (leg, side) => {
    const f = leg.f * D2R, k = leg.k * D2R, sp = (leg.s || 0) * side * D2R;
    const ky = Math.cos(f + sp) * 172, ay = ky + Math.cos(f - k + sp) * 156;
    return -345 + ay + 22;
  };
  const lowest = Math.max(lp(pose.legL, -1), lp(pose.legR, 1));
  const plantShift = st.plant === false ? 0 : -lowest;

  ctx.translate(pose.x || 0, (pose.y || 0) + plantShift);
  // squash & stretch alrededor de las suelas
  ctx.scale(1 / Math.sqrt(sq), sq);

  // piernas
  drawLegs(ctx, spec, pose, []);

  // torso + cabeza + brazos con inclinación
  ctx.save();
  ctx.translate(0, -345); ctx.rotate((pose.lean || 0) * D2R); ctx.translate(0, 345);

  // brazo trasero (más alejado del espectador no existe: ambos delante). Dibujamos brazos tras el torso si están muy abiertos hacia arriba
  const gL = armGeom(pose, -1, spec), gR = armGeom(pose, 1, spec);
  drawTorso(ctx, spec, pose);
  // cuello
  ctx.beginPath(); rrect(ctx, -26, -616, 52, 40, 10); ctx.fillStyle = shade(skin, -0.12); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  // brazos
  drawArm(ctx, spec, gL, skin); drawArm(ctx, spec, gR, skin);
  // cabeza
  ctx.save();
  ctx.translate(0, -603 - 118 + (pose.headDown || 0));
  ctx.rotate((pose.headRot || 0) * D2R);
  drawHead(ctx, spec, pose, face);
  ctx.restore();
  // objeto en mano (delante de todo)
  if (st.item && st.item.name) {
    const g = st.item.hand === 'L' ? gL : gR;
    const sideN = g.side;
    const ang = (st.item.angle ?? 0) * D2R + Math.atan2(g.hy - g.ey, (g.hx - g.ex)) - Math.PI / 2 + (sideN < 0 ? 0 : 0);
    drawItem(ctx, st.item.name, g.hx, g.hy, st.item.rotAbs !== undefined ? st.item.rotAbs * D2R * sideN : ang * 0 + (st.item.angle ?? 0) * D2R * sideN, sideN);
    // mano sobre el objeto
    circle(ctx, g.hx, g.hy, 25, grad(ctx, skin, -20, -20, 20, 20, -0.16), 6);
  }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// puntos útiles para efectos (en unidades de la tarjeta, origen = suelas)
export function jointPositions(pose) {
  const gL = armGeom(pose, -1), gR = armGeom(pose, 1);
  return { handL: [gL.hx, gL.hy], handR: [gR.hx, gR.hy], mouth: [0, -603 - 118 + 80], head: [0, -721] };
}
