# Arquitectura y decisiones (con justificación)

Prioridad pedida: **calidad > consistencia > velocidad > automatización > mantenimiento > compatibilidad**.

## Inspección del entorno (2026-11-22, Windows 11)
Chrome 157, ffmpeg/ffprobe, Node 20, Python 3.12 (numpy, scipy, pillow, aiohttp, edge-tts, openai-whisper + torch), **RTX 4060 Ti**, 32 GB RAM, disco C: con solo ~13 GB libres. Blender 4.5/5.2 instalado (fuera del PATH), MCP de Blender, MCP de audio (plan gratuito), skill existente `cartoon-3d-short` (three.js dentro de Remotion; R3F 8 obligatorio).

## Decisión: three.js en Chrome headless + ffmpeg (motor propio)
| Opción | Veredicto |
|---|---|
| **three.js + Chrome headless + ffmpeg (elegida)** | GPU real (se verificó ANGLE/D3D11 en la 4060 Ti), render determinista fotograma a fotograma, **cero instalaciones** (three.js r160 MIT va incluido, 1,2 MB; Chrome y ffmpeg ya estaban; solo aiohttp, que ya viene con edge-tts), sin carpetas de PNG (ahorra disco: crítico con 13 GB libres), el usuario no toca Blender ni código. |
| Remotion + three.js (`cartoon-3d-short`) | Funciona pero: cada bundle copia ~1,3 GB a la carpeta temporal (disco casi lleno), requiere R3F 8 (con 9 sale negro), faltan modelos GLB (descarga a autorizar) y su estilo/ reglas son de otro canal (sin subtítulos, inglés). No se sobrescribió ni duplicó; se reutilizó la **idea** (2D en 3D, tinta, cámara) con arquitectura propia. |
| Blender (headless o MCP) | Calidad alta, pero sin GPU rápida para 1.750 fotogramas a 1080×1920, scripts pesados, depende de que Blender esté abierto/MCP conectado, y obliga a mantener rigs 3D; queda como mejora opcional (importar GLB). |
| Fondos de IA / 2.5D | Incoherencia entre planos y sin cámara real; se descarta como base. Útil para un fondo puntual si hay créditos (ver `limitations.md`). |
| Modelos 3D descargados | Procedencia/licencia por archivo y descargas que pedir; el 3D procedural no tiene ese riesgo. |

## Piezas
```
assets/engine/            motor (se sirve por HTTP local; solo lee short.json)
  index.html, sheet.html  página de render / hoja de personaje
  vendor/three.module.js  three r160 (MIT, ver THREE_LICENSE.txt)
  js/main.js              bucle determinista: frame(i), report(i)
  js/lib/                 rig (personajes 2D), poses, cast (actores y sombras), camera, post (tinta, MSAA, grade, transiciones),
                          lights (presets+cielo), toon/props/textures (3D procedural), fx, overlay (subtítulos y etiquetas)
  js/sets/                calle_victoriana, habitacion, paisaje_nevado, bolera, mercado
scripts/                  new_short, doctor, tts, transcribe, align, build_project, audiolib, audio_build, render, cdp, qc, lint_research, contact_sheet
templates/ references/ examples/
```
- **Render:** `cdp.py` es un cliente mínimo del protocolo de DevTools (aiohttp): lanza Chrome headless con flags de GPU, sirve `engine/` y el proyecto por HTTP y captura fotogramas. Se eligió sobre Playwright para **no instalar nada**.
- **Pipeline gráfico:** mundo (MSAA 4×, half-float) → pasada de normales/profundidad → **tinta de contorno** por laplaciano de profundidad y cambio de normal → personajes y efectos (capa 1, con oclusión por la profundidad del mundo) → composición (tono, contraste, viñeta, transiciones).
- **Personajes:** `rig.js` dibuja en Canvas2D por capas (piernas, torso, brazos, cabeza, pelo, sombrero, objeto) a 1080×1680 px por tarjeta; la tarjeta es un plano que mira a la cámara (billboard cilíndrico), con sombra proyectada sobre el suelo desde el sol y mancha de contacto. Es **un solo diseño reutilizable** (no una imagen distinta por escena).
- **Animación:** poses + IK de brazos + ciclo de paso por distancia + clips procedurales; todo función pura del tiempo.
- **Audio:** síntesis procedural (numpy/scipy) → mezcla con ducking → loudnorm.
- **Velocidad:** escenarios y personajes reutilizables, plantillas, render por tubería con 2 hilos y sin disco intermedio; ver tiempos medidos en el informe de cada Short.

## Qué se reutilizó de `cartoon-3d-short` y qué no
Idea de estilo y lecciones (tinta antes del desenfoque, la tinta como pase propio, flip-kicks, cámara con creep, cuidado con props pegados a la lente). No se copió código ni se tocó la skill. La skill `cartoon-3d-short` **no se modificó** (solo se leyó), por lo que no hizo falta copia de seguridad; sigue intacta en `~/.claude/skills/cartoon-3d-short/`.
