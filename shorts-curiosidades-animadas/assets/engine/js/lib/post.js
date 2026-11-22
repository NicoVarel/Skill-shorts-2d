// Tubería de render: mundo (MSAA, half float) -> tinta de contorno -> personajes/efectos -> composición (grade, transiciones).
// Capas: 0 = mundo con tinta, 2 = cielo (sin tinta), 1 = personajes, sombras y efectos (sin tinta, con oclusión por profundidad).
import * as THREE from 'three';

const FS_VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';

export class Pipeline {
  constructor(canvas, W, H) {
    this.W = W; this.H = H;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
    r.setPixelRatio(1); r.setSize(W, H, false);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.shadowMap.autoUpdate = false;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
    r.autoClear = false;
    const mk = (samples) => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
    this.rtA = mk(4); this.rtB = mk(4);
    this.rtN = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsGeo = new THREE.PlaneGeometry(2, 2);
    this.scale = H / 1920;

    this.normalMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vN; varying float vD; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vN; varying float vD; void main(){ gl_FragColor=vec4(normalize(vN)*0.5+0.5, vD); }',
    });
    this.inkMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { tN: { value: this.rtN.texture }, px: { value: new THREE.Vector2(1 / W, 1 / H) }, rad: { value: 2.0 * this.scale }, ink: { value: new THREE.Color('#1d1218') }, strength: { value: 0.92 }, far: { value: 120 } },
      vertexShader: FS_VERT,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tN; uniform vec2 px; uniform float rad,strength,far; uniform vec3 ink;
      vec4 S(vec2 o){ return texture2D(tN, vUv+o*px); }
      void main(){
        vec4 c=texture2D(tN,vUv); float d=c.a; if(d<=0.0) d=1000.0; vec3 n=c.rgb*2.0-1.0;
        float fade = 1.0 - smoothstep(far*0.5, far, d);
        float r = rad * mix(1.15, 0.55, smoothstep(6.0, 70.0, d));
        float e=0.0;
        vec2 dirs[4]; dirs[0]=vec2(1,0); dirs[1]=vec2(0,1); dirs[2]=vec2(0.7071,0.7071); dirs[3]=vec2(0.7071,-0.7071);
        for(int i=0;i<4;i++){
          vec4 a=S(dirs[i]*r), b=S(-dirs[i]*r);
          float da = a.a<=0.0?1000.0:a.a, db = b.a<=0.0?1000.0:b.a;
          float lap = abs(da+db-2.0*d);
          float ed = smoothstep(0.045*d, 0.11*d, lap) * step(0.0, 1.0);
          vec3 na=a.rgb*2.0-1.0, nb=b.rgb*2.0-1.0;
          float cr = 1.0 - min(dot(n,na), dot(n,nb));
          float en = smoothstep(0.42, 0.85, cr) * step(abs(da-d)+abs(db-d), 0.5*d+0.6);
          e = max(e, max(ed, en*0.9));
        }
        gl_FragColor = vec4(ink, e*strength*fade);
      }`,
    });
    this.inkQuad = new THREE.Mesh(this.fsGeo, this.inkMat); this.inkQuad.frustumCulled = false;
    this.inkScene = new THREE.Scene(); this.inkScene.add(this.inkQuad);

    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tA: { value: null }, tB: { value: null }, mixv: { value: 0 }, mode: { value: 0 }, dir: { value: 1 }, dipCol: { value: new THREE.Color('#000') },
        exposure: { value: 1 }, contrast: { value: 1.06 }, sat: { value: 1.08 }, tint: { value: new THREE.Vector3(1, 1, 1) }, vig: { value: 0.22 }, flash: { value: 0 }, px: { value: new THREE.Vector2(1 / W, 1 / H) },
        time: { value: 0 }, grain: { value: 0.012 }, tintB: { value: new THREE.Vector3(1, 1, 1) }, expB: { value: 1 },
      },
      vertexShader: FS_VERT,
      fragmentShader: `varying vec2 vUv; uniform sampler2D tA,tB; uniform float mixv,mode,dir,exposure,contrast,sat,vig,flash,time,grain,expB; uniform vec3 dipCol,tint,tintB; uniform vec2 px;
      vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,0.0),vec3(1.0/2.4))-0.055, step(0.0031308,c)); }
      vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
      vec3 grade(vec3 c,float ex,vec3 ti){
        c*=ex*ti; c=mix(c, aces(c*0.9)*1.04, 0.55);
        float l=dot(c,vec3(0.2126,0.7152,0.0722)); c=mix(vec3(l),c,sat);
        c=(c-0.18)*contrast+0.18; return max(c,0.0);
      }
      vec3 sampleBlur(sampler2D t, vec2 uv, float amt){ vec3 s=vec3(0.0); for(int i=-6;i<=6;i++){ s+=texture2D(t, uv+vec2(float(i)/6.0*amt*dir,0.0)).rgb; } return s/13.0; }
      float h21(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 uv=vUv; vec3 a, b;
        a=texture2D(tA,uv).rgb;
        vec3 col;
        if(mode<0.5){ col=grade(a,exposure,tint); }
        else {
          b=texture2D(tB,uv).rgb;
          if(mode<1.5){ col=mix(grade(a,exposure,tint), grade(b,expB,tintB), smoothstep(0.0,1.0,mixv)); }
          else if(mode<2.5){ float m=mixv; vec3 ga=grade(a,exposure,tint), gb=grade(b,expB,tintB); col = m<0.5 ? mix(ga,dipCol,m*2.0) : mix(dipCol,gb,(m-0.5)*2.0); }
          else { // whip: desenfoque direccional + cambio de escena a mitad
            float m=mixv; float amt=sin(m*3.14159)*0.16; vec3 sa=sampleBlur(tA,uv+vec2(-m*0.25*dir,0.0),amt), sb=sampleBlur(tB,uv+vec2((1.0-m)*0.25*dir,0.0),amt);
            col = m<0.5 ? grade(sa,exposure,tint) : grade(sb,expB,tintB);
            col = mix(col, mix(grade(sa,exposure,tint),grade(sb,expB,tintB), smoothstep(0.35,0.65,m)), 0.5);
          }
        }
        vec2 q=uv-0.5; float v=1.0-vig*smoothstep(0.25,0.95,length(q*vec2(1.0,0.8))*1.5);
        col*=v; col+=flash; col=toSRGB(col);
        col+= (h21(uv*vec2(1080.0,1920.0)+time)-0.5)*grain;
        gl_FragColor=vec4(col,1.0);
      }`,
    });
    this.compQuad = new THREE.Mesh(this.fsGeo, this.compMat); this.compQuad.frustumCulled = false;
    this.compScene = new THREE.Scene(); this.compScene.add(this.compQuad);
  }

  // Renderiza una escena a un target usando la tubería con tinta.
  renderScene(sc, camera, rt, clearColor) {
    const r = this.renderer;
    r.setRenderTarget(rt);
    r.setClearColor(clearColor, 1); r.clear(true, true, true);
    // 1) mundo + cielo
    camera.layers.set(0); camera.layers.enable(2);
    r.render(sc.scene, camera);
    // 2) normales/profundidad (solo mundo con tinta)
    r.setRenderTarget(this.rtN);
    r.setClearColor(0x000000, 0); r.clear(true, true, true);
    camera.layers.set(0);
    const bg = sc.scene.background, fog = sc.scene.fog; sc.scene.fog = null;
    sc.scene.overrideMaterial = this.normalMat;
    r.render(sc.scene, camera);
    sc.scene.overrideMaterial = null; sc.scene.fog = fog; sc.scene.background = bg;
    // 3) tinta sobre el color
    r.setRenderTarget(rt);
    this.inkMat.uniforms.far.value = (sc.inkFar || 120);
    r.render(this.inkScene, this.fsCam);
    // 4) personajes y efectos (comparten la profundidad del mundo)
    camera.layers.set(1);
    r.render(sc.scene, camera);
    camera.layers.set(0);
  }

  composite(params) {
    const r = this.renderer, u = this.compMat.uniforms;
    u.tA.value = params.a; u.tB.value = params.b || params.a;
    u.mode.value = params.mode || 0; u.mixv.value = params.mix || 0; u.dir.value = params.dir || 1;
    u.exposure.value = params.exposure ?? 1; u.tint.value.set(...(params.tint || [1, 1, 1]));
    u.expB.value = params.expB ?? 1; u.tintB.value.set(...(params.tintB || [1, 1, 1]));
    u.flash.value = params.flash || 0; u.time.value = params.time || 0; u.vig.value = params.vig ?? 0.2;
    if (params.dip) u.dipCol.value.set(params.dip);
    r.setRenderTarget(null);
    r.setClearColor(0x000000, 1); r.clear(true, true, true);
    r.render(this.compScene, this.fsCam);
  }
}
