# Biblia visual, personajes, escenarios y cámara

La biblia se escribe **antes** de generar escenas y se reutiliza. Mismo personaje = misma cara, ropa y proporciones (salvo razón narrativa).

## Estilo
Personajes 2D de recorte (cabeza grande «judía», ojos blancos con pupila, cejas gruesas, manos de círculo, contorno ciruela #2a1b2e, sombreado de 2 tonos) **dentro de escenarios 3D** toon con luz solar real, sombras, niebla atmosférica y tinta de contorno automática. Los personajes se integran: escala real (≈ 1,7 m), sombra proyectada según el sol, mancha de contacto, oclusión por profundidad (pasan detrás de objetos), apoyo en el suelo (los pies se alinean solos).
Azul de marca (#2f7bff) solo en subtítulos y etiquetas.

## Personajes: `characters.json`
```json
{ "characters": { "mary": {
  "name": "…", "skin": "#f2cba6",
  "hair": {"style": "short|bun|bald|long|bob|curly|none", "color": "#a3a3ab"},
  "outfit": {"top": {"type": "dress|coat|jacket|shirt|robe", "color": "#3f5280", "sleeve": "…", "trim": "…", "buttons": "…", "belt": "…", "vest": true, "shirt": "#eee6d0", "bareArms": false},
             "bottom": {"type": "trousers", "color": "…"}, "apron": "#f1ebdd", "stockings": "#d9d0c2",
             "hat": {"type": "top|bowler|flatcap|bonnet|nightcap|shawl|helmet|none", "color": "…", "band": "…"},
             "accessories": ["mustache","beard","glasses","scarf","cravat","apron"], "scarf": "#b4423a", "shoes": {"color": "…"}},
  "face": {"nose": "round|pointy", "freckles": false, "eyes": "big"}, "body": {"height": 0.96} } } }
```
Genera la **hoja de personaje** para revisarla: servir `assets/engine/sheet.html?chars=/project/characters.json&poses=idle,point,surprised,sit,shoot,walk1&expr=…` y capturarla (ver `render-qc.md`). Revisa: coherencia, expresiones legibles, proporciones, nada cortado.
Si el personaje es una **persona real**: es una representación estilizada; dilo en `character-bible.md` y en la descripción. Personajes genéricos (obrero, policía): nómbralos como genéricos.
Rig: articulaciones con IK (`ikArm`), pies que se plantan, parpadeo automático, mirada, giro de cabeza, boca por energía de voz. Limitación: el cuerpo es frontal (el sentido de marcha se indica con giro de cabeza y espejo), no hay perfil real.

## Escenarios (`set.name` + `params`)
| Set | Params clave | Anclas útiles |
|---|---|---|
| `calle_victoriana` | `houses` (8), `end` (`muelles`\|`fabrica`), `nearHouses` (false), `lit`, `bollards`, `allLamps` | `F{0-7}.pave` (acera frente a la puerta), `.door`, `.below`, `.w0 .w1a .w1b .w2a .w2b` (ventanas) y `….below`, `lamp…`, `postbox`, `street_start`, `street_end` |
| `habitacion` | `variant` (`dormitorio`\|`comedor`\|`oficina`), `exterior` (`amanecer\|dia\|noche\|nublado`), `winX`, `wallColor`, `blanket`, `curtain`, `alarmClock` | `center`, `front`, `back`, `window`, `bed`, `bed.head`, `bed.pillow`, `nightstand`, `door`, `table`, `seat1-4`, `desk`, `stool` |
| `paisaje_nevado` | — | `path.start/mid/end`, `cabin.door`, `cabin.window`, `lamp`, `center` |
| `bolera` | — | `approach`, `lane.start/mid/pins`, `pit`, `pitFront`, `bench` |
| `mercado` | — | `center`, `plaza.w/e`, `fountain`, `stall0-7` |
Luz (`light`): `amanecer dia atardecer nublado noche nieve interior interior_amanecer interior_noche` + `lightOverrides` (`sun: {az, el, color, i}`, `exposure`, `fog`). **Dirige el sol** para que ilumine lo que se ve (en la calle, `az` ≈ 280-300 ilumina las fachadas del fondo; si no, quedan en sombra violácea).
Añadir un escenario nuevo: crea `sets/<nombre>.js` (`build(params)` → `{group, anchors, update(t), bounds}`) y regístralo en `sets/index.js`. Usa las utilidades de `lib/toon.js` (`box`, `cyl`, `mat` con textura procedural) y `lib/props.js`. Todo es procedural: sin descargas ni licencias. **Elección justificada** (ver `architecture.md`): 3D procedural frente a modelos descargados/fondos de IA/2.5D.

## Cámara con intención
Cada plano responde a una pregunta narrativa: *¿qué quiero que mire el espectador ahora?*
- **Push-in** → atención/tensión · **Pull-out** → revelación del contexto · **Travelling lateral** → seguir a alguien / ritmo · **Grúa hacia arriba** → escala (muchas ventanas, «seiscientos») · **Paneo** → relacionar dos cosas · **Whip** (transición) → cambio brusco de tiempo/lugar.
- Nada aleatorio: si un movimiento no tiene motivo, plano casi fijo con `creep`.
- El paralaje sale del 3D real (farolas, fachadas, personajes a distintas profundidades).

## Composición para vertical (zona segura)
- Etiquetas de contexto (`chips`) arriba: `y` = 0.14 de la altura. Subtítulos fijos en `y` = 0.655 (zona ≈ 0.60-0.72).
- **Encuadre estándar del personaje:** pies ≈ 0.58 de la altura, cabeza ≈ 0.22 → la figura queda por encima de los subtítulos. Receta: `orbit` con `dist` 6-8, `height` ≈ 1.0, `lookY` ≈ 0.45-0.55, `fov` 40-44.
- Plano de ventana/altura (gancho): `dist` ≈ 8-11, `fov` 48-52, `lookY` ≈ 1.0.
- No pongas la cámara dentro de una casa: en `calle_victoriana` las casas del lado de la cámara se omiten por defecto (`nearHouses:false`); mantén `dist·cos(az)` < 7.
- Revisa SIEMPRE stills de inicio/medio/fin antes de renderizar todo.
