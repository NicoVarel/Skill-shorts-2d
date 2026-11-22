# `scenes.json` — fuente de verdad del storyboard

Ejemplo completo y válido: `templates/scenes.example.json`. Un Short real: `NicoVarel/SHORTS/001-despertadores-humanos/03-storyboard/scenes.json`.
Además escribe `03-storyboard/storyboard.md` (tabla legible: escena · duración · narración · personajes · escenario · acción · cámara · luz · subtítulos · SFX).

## Raíz
```json
{ "title": "…", "meta": { "fps": 30, "subtitle_upper": true,
    "voice": {"name": "es-MX-JorgeNeural", "rate": "+10%"},
    "music": {"mood": "curioso|misterio|calido|tension|none", "level_db": -22, "duck_db": -9, "seed": 3, "bpm": 104} },
  "scenes": [ … ] }
```

## Escena
```json
{ "id": "s01", "narration": "Texto exacto de la voz, con *palabras clave* resaltadas.",
  "set": {"name": "calle_victoriana", "params": {"houses": 8, "end": "muelles"}},
  "light": "amanecer", "lightOverrides": {"sun": {"az": 300, "el": 13, "color": "#ffb27a", "i": 2.8}},
  "camera": {"segments": [ … ], "shakes": [{"t": 1.2, "amp": 0.1, "dur": 0.3}]},
  "characters": [ … ], "props": [ … ], "fx": [ … ], "chips": [ … ], "sfx": [ … ], "ambience": [ … ],
  "transition": {"type": "cut|dissolve|dip|whip|flash", "dur": 0.4, "dir": 1} }
```
`transition` describe el paso **hacia la siguiente escena** (ventana centrada en la frontera).
La duración de cada escena **sale de la voz** (no se escribe): empieza ≈ 0,12 s antes de su primera palabra y termina donde empieza la siguiente.

## Tiempos
Números = segundos desde el inicio de la escena. También `"@w3"` (inicio de la palabra 3 de la narración de la escena, empezando en 0), `"@w3e"` (fin de esa palabra), `"@end"`, con sufijo `+0.2`/`-0.4`. Sirven en `t`, `t0`, `t1`. Anclar acciones a palabras = imagen y voz sincronizadas aunque cambie el audio.

## Referencias de lugar
`[x,y,z]` en metros · `"anchor:NOMBRE"` (anclas del escenario, ver `visual-bible.md`) · `"anchor:NOMBRE|dx,dy,dz"` (con desplazamiento) · `"char:id"` (pies), `"char:id.head"`, `.chest`, `.mouth`, `.feet` (dinámico: sigue al personaje).

## Personajes (`characters[]`)
```json
{ "id": "mary", "char": "mary",           // id en la escena / entrada en characters.json
  "start": {"at": "anchor:F3.pave", "pose": "stand", "expr": "neutral"},
  "scale": 1.0, "seat": 0.46, "mustShow": true, "walkAmp": 1, "tint": [1,1,1],
  "actions": [ … ] }
```
`mustShow:false` para figurantes (el QC no exige que se vean).
Acciones (`do`):
| do | campos | efecto |
|---|---|---|
| `walk` | `t`/`t0`, `t1`, `to`, `ease` | camina (ciclo de pasos por distancia; orienta hacia el movimiento) |
| `move` | igual | se desliza sin ciclo de paso |
| `pose` | `t`, `name`, `dur`, `args`, `pose` (articulaciones propias), `item` | transición suave a una pose |
| `clip` | `t0`, `t1`, `name` | gesto procedural: `knock`, `wave`, `puff`, `yawn`, `stretch`, `jump`, `hop`, `shake_head`, `nod`, `shiver`, `laugh`, `tremble`, `breathe` |
| `expr` | `t`, `name`, `dur` | expresión: `neutral happy big_smile sad angry grumpy surprised scared sleepy sleep yawn smug thinking laugh worried puff` |
| `look` | `t`, `at` (`left right up down camera`, `[x,y]`, `toward:<ref>`), `head` | mirada y giro de cabeza |
| `face` | `t`, `dir` (`left right camera move toward:<ref>`) | orientación del cuerpo respecto a pantalla |
| `hold` | `t`, `item`, `hand` (`R`/`L`), `rotAbs`, `angle` | objeto en la mano: `peashooter pole mug candle lantern letter newspaper book clock ball broom coin hammer umbrella phone`; `item:null` lo suelta |
| `talk` | `t0`, `t1` | mueve la boca con la energía de la voz (solo cuando ESE personaje habla de verdad) |
| `lie` | `t`, `angle`, `dur` | tumbado (ángulo −84 = cabeza a la izquierda) |
| `lift` | `t`, `y`, `dur` | desplazamiento vertical (subir a un escalón) |
| `show` / `hide` | `t` | visibilidad |
Poses: `idle stand point point_up point_left surprised scared wave hands_hips cross_arms shrug hold_fwd carry_up stretch sit sit_lean think shoot tired sleep walk1 run1`. **No inventes diálogos**: `talk` solo si la narración cita palabras documentadas.

## Cámara (`camera.segments[]`)
Dos tipos, con `t0`,`t1`, `ease` (`smooth|smoother|linear|in|out`), `fov`, `roll`, `creep` (avance lento, def. 0.02 m/s):
- **Orbit/push/pull**: `{"target":"char:mary|anchor:…","az":[26,12],"dist":[10.8,6.6],"height":1.0,"lookY":0.95,"fov":48,"offset":[x,y,z],"absHeight":false}` (los rangos `[a,b]` se interpolan). `height`/`lookY` son relativos a la altura de `target` salvo `absHeight`.
- **Lerp** (travelling, grúa, paneo): `{"from":{"pos":…,"look":…,"fov":…},"to":{…}}` con referencias de lugar.
Los segmentos deben cubrir toda la escena (el último se mantiene). Encuadre estándar: ver `visual-bible.md` §Composición.

## Otros campos
- `props`: `[{"kind":"chair","args":[…],"at":"anchor:…","rotY":0,"scale":1}]` (kinds = funciones de `props.js`: `barrel crate bollard cart pillarBox lampPost bed table chair stool wardrobe bookshelf desk rug candleLamp picture tree pine …`).
- `fx`: `peas` (`from`,`to`,`t0`,`t1`,`rate`), `zzz` (`at`,`t0`,`t1`), `dust`, `snow` (`center`,`w`,`d`,`h`,`count`).
- `chips`: etiquetas de contexto `{"t0","t1","text","sub","y":0.14}` (lugar, fecha, cifra): arriba, fuera de la zona de subtítulos.
- `sfx`: `[{"t":0.4,"name":"knock","vol":0.7,"pan":-0.3}]`; nombres en `audio.md`. `ambience`: `[{"name":"street|wind|birds|crowd","vol":0.5}]` (dura toda la escena).
- `anchors`: anclas extra de la escena.
