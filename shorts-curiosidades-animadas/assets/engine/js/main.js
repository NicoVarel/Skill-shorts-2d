// Motor de render determinista: window.__nv.frame(i) dibuja el fotograma i; el orquestador (render.py) lo captura.
import * as THREE from 'three';
import { Pipeline } from './lib/post.js';
import { applyLighting, LIGHT_PRESETS } from './lib/lights.js';
import { Actor } from './lib/cast.js';
import { evalCamera } from './lib/camera.js';
import { buildFx } from './lib/fx.js';
import { drawSubtitles, drawChip } from './lib/overlay.js';
import * as PROPS from './lib/props.js';
import { SETS } from './sets/index.js';
import { clamp, D2R } from './lib/util.js';

const q = new URLSearchParams(location.search);
const W = parseInt(q.get('w') || '1080'), H = parseInt(q.get('h') || '1920');
const PROJECT = q.get('project') || '/project/short.json';

const log = (...a) => console.log('[nv]', ...a);

async function boot() {
  const project = await (await fetch(PROJECT + '?v=' + Date.now())).json();
  const fps = project.meta.fps || 30;
  const canvas = document.getElementById('gl'), ov = document.getElementById('ov');
  canvas.width = W; canvas.height = H; ov.width = W; ov.height = H;
  document.body.style.width = W + 'px'; document.body.style.height = H + 'px';
  canvas.style.width = ov.style.width = W + 'px'; canvas.style.height = ov.style.height = H + 'px';
  const g = ov.getContext('2d');
  const pipe = new Pipeline(canvas, W, H);

  const scenes = [];
  for (const sp of project.scenes) {
    const scene = new THREE.Scene();
    const setMod = SETS[sp.set.name];
    if (!setMod) throw new Error('Escenario desconocido: ' + sp.set.name);
    const set = setMod.build(sp.set.params || {});
    scene.add(set.group);
    const L = applyLighting(scene, sp.light || 'dia', set.bounds, sp.lightOverrides || {});
    const preset = L.preset;
    const light = { tint: sp.tint || preset.tint, lightDirDown: L.lightDirDown, charGain: sp.charGain ?? 1, shadowOpacity: sp.shadowOpacity ?? (preset.interior ? 0.26 : (sp.light === 'nublado' ? 0.16 : 0.34)), shadows: sp.shadows };
    const anchors = Object.assign({}, set.anchors, sp.anchors || {});
    const actors = {};
    const env = { scene, light, actors, audioEnv: project.audioEnv, audioFps: project.audioEnvFps || 30, sceneStart: sp.start };
    env.resolve = (ref, t, fallback) => {
      if (ref === undefined || ref === null) return fallback;
      if (Array.isArray(ref)) return ref;
      if (typeof ref === 'object' && ref.anchor) { const a = env.resolve('anchor:' + ref.anchor, t, fallback), o = ref.off || [0, 0, 0]; return [a[0] + o[0], a[1] + o[1], a[2] + o[2]]; }
      if (typeof ref === 'string') {
        let s = ref, off = [0, 0, 0];
        if (s.includes('|')) { const [a, b] = s.split('|'); s = a; off = b.split(',').map(Number); }
        let r;
        if (s.startsWith('anchor:')) { r = anchors[s.slice(7)]; if (!r) throw new Error('Ancla desconocida: ' + s + ' en escena ' + sp.id); }
        else if (s.startsWith('char:')) {
          const [id, part] = s.slice(5).split('.'); const a = actors[id]; if (!a) throw new Error('Personaje desconocido: ' + id);
          const p = a.posAt(t).p; const sc = a.scale;
          if (part === 'head') r = [p[0], p[1] + 1.55 * sc + (a.state ? 0 : 0), p[2]];
          else if (part === 'chest') r = [p[0], p[1] + 1.15 * sc, p[2]];
          else if (part === 'mouth') r = [p[0] + 0.12 * sc, p[1] + 1.46 * sc, p[2] + 0.05];
          else if (part === 'feet') r = [p[0], p[1], p[2]];
          else r = [p[0], p[1], p[2]];
        } else throw new Error('Referencia no válida: ' + s);
        return [r[0] + off[0], r[1] + off[1], r[2] + off[2]];
      }
      return fallback;
    };
    // props extra definidos en la escena
    for (const pr of (sp.props || [])) {
      const fn = PROPS[pr.kind]; if (!fn) throw new Error('Prop desconocido: ' + pr.kind);
      const o = fn(...(pr.args || []));
      const p = env.resolve(pr.at, 0, [0, 0, 0]); o.position.set(p[0], p[1], p[2]); o.rotation.y = (pr.rotY || 0) * D2R;
      if (pr.scale) o.scale.setScalar(pr.scale);
      scene.add(o);
    }
    for (const tr of (sp.characters || [])) {
      const spec = project.characters[tr.char || tr.id];
      if (!spec) throw new Error('Personaje sin definir en la biblioteca: ' + (tr.char || tr.id));
      actors[tr.id] = new Actor(tr, spec, env);
    }
    const fxs = (sp.fx || []).map((f) => buildFx(f, env));
    const cam = new THREE.PerspectiveCamera(38, W / H, 0.08, 400);
    scenes.push({ sp, scene, set, light, env, actors, fxs, cam, sky: L.sky, clear: new THREE.Color(preset.fog.color), exposure: preset.exposure || 1, tint: preset.tint, preset });
    log('escena lista', sp.id);
  }

  function renderOne(S, t, rt) {
    const lt = Math.max(0, t - S.sp.start);
    S.set.update && S.set.update(lt + (S.sp.timeOffset || 0));
    S.fxs.forEach((f) => f.update(lt));
    const ev = evalCamera(S.sp.camera, lt, S.env.resolve);
    S.cam.fov = ev.fov; S.cam.updateProjectionMatrix();
    S.cam.position.set(...ev.pos); S.cam.lookAt(...ev.look); S.cam.rotateZ(ev.roll * D2R);
    S.cam.updateMatrixWorld(true);
    S.sky.position.copy(S.cam.position);
    const states = {};
    for (const a of Object.values(S.actors)) states[a.id] = a.update(lt, S.cam);
    if (!S.shadowDone) { pipe.renderer.shadowMap.needsUpdate = true; S.shadowDone = true; } // el sol y el decorado son estáticos: el mapa de sombras se calcula una vez por escena
    pipe.renderScene(S, S.cam, rt, S.clear);
    S.lastCam = ev; S.lastStates = states; S.lastT = lt;
  }

  function sceneIndexAt(t) {
    let idx = 0;
    for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].sp.start - 1e-6) idx = i;
    return idx;
  }

  let lastSub = null;
  function frame(i) {
    const t = i / fps;
    const idx = sceneIndexAt(t);
    const S = scenes[idx], N = scenes[idx + 1];
    // transición hacia la siguiente escena (ventana centrada en la frontera)
    let trans = null;
    if (N) {
      const tr = S.sp.transition || { type: 'cut', dur: 0 };
      const b = N.sp.start, d = tr.dur || 0;
      if (tr.type !== 'cut' && d > 0 && t >= b - d / 2 && t <= b + d / 2) trans = { tr, b, d, mix: (t - (b - d / 2)) / d, next: N };
    }
    // si estamos justo después de la frontera, la anterior sigue en transición
    const prev = scenes[idx - 1];
    if (!trans && prev) {
      const tr = prev.sp.transition || { type: 'cut', dur: 0 }; const b = S.sp.start, d = tr.dur || 0;
      if (tr.type !== 'cut' && d > 0 && t >= b - d / 2 && t <= b + d / 2) trans = { tr, b, d, mix: (t - (b - d / 2)) / d, prev };
    }
    const modeMap = { fade: 1, dissolve: 1, dip: 2, whip: 3, flash: 1 };
    if (trans) {
      const A = trans.prev || S, B = trans.next || S;
      const first = trans.prev ? trans.prev : S, second = trans.prev ? S : trans.next;
      renderOne(first, t, pipe.rtA); renderOne(second, t, pipe.rtB);
      let flash = 0;
      if (trans.tr.type === 'flash') flash = Math.sin(trans.mix * Math.PI) * 0.9;
      pipe.composite({ a: pipe.rtA.texture, b: pipe.rtB.texture, mode: modeMap[trans.tr.type] || 1, mix: trans.mix, dir: trans.tr.dir || 1, exposure: first.exposure, tint: first.tint, expB: second.exposure, tintB: second.tint, flash, dip: trans.tr.color || '#000000', time: i % 97 });
    } else {
      renderOne(S, t, pipe.rtA);
      pipe.composite({ a: pipe.rtA.texture, mode: 0, exposure: S.exposure, tint: S.tint, time: i % 97 });
    }
    // overlay
    g.clearRect(0, 0, W, H);
    const sc = W / 1080; g.save(); g.scale(sc, sc);
    const Sx = trans && trans.mix > 0.5 && trans.next ? trans.next : S;
    for (const chip of (project.chips || [])) drawChip(g, 1080, 1920, t, chip);
    lastSub = drawSubtitles(g, 1080, 1920, t, project.subtitles || [], project.subtitleStyle || {});
    const fadeIn = project.meta.fadeIn ?? 0.2, fadeOut = project.meta.fadeOut ?? 0.35, dur = project.meta.duration;
    const fa = Math.max(0, 1 - t / fadeIn), fb = Math.max(0, 1 - (dur - t) / fadeOut);
    const f = Math.max(fa, fb); if (f > 0) { g.fillStyle = `rgba(7,10,20,${clamp(f)})`; g.fillRect(0, 0, 1080, 1920); }
    g.restore();
    return true;
  }

  function report(i) {
    const t = i / fps; frame(i);
    const idx = sceneIndexAt(t); const S = scenes[idx];
    const actors = Object.values(S.actors).map((a) => {
      const box = a.screenBox(S.cam, W, H);
      const onScreen = !!box && !box.behind && box.x1 > 0 && box.x0 < W && box.y1 > 0 && box.y0 < H;
      const inside = !!box && box.x0 >= -20 && box.x1 <= W + 20;
      return { id: a.id, visible: a.pivot.visible, box, onScreen, inside, mustShow: a.track.mustShow !== false };
    });
    return { frame: i, t, scene: S.sp.id, camera: S.lastCam, actors, subtitle: lastSub };
  }

  window.__nv = { scenes, ready: true, fps, frames: Math.ceil(project.meta.duration * fps), W, H, frame, report, project };
  window.__ready = true;
}

boot().catch((e) => { console.error('ERROR_BOOT ' + (e && e.stack || e)); window.__error = String(e && e.stack || e); });
