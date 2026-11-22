---
name: shorts-curiosidades-animadas
description: Produce un YouTube Short vertical terminado (1080x1920, MP4) de curiosidades, historias y hechos sorprendentes con personajes 2D recortables dentro de escenarios 3D, cámara dinámica, narración, subtítulos palabra a palabra, música y efectos. Úsala cuando el usuario pida un Short/Reel animado de curiosidades o historia ("hazme un short de…", "5 ideas de curiosidades animadas", "/shorts-curiosidades-animadas", "convierte este guion/audio en un short animado"). Cubre idea, investigación con fuentes verificadas, guion, storyboard, biblia visual, render automático, control de calidad y título/descripción. Canal NICO VAREL. No sirve para vídeos largos horizontales ni para editar metraje real.
---

# Shorts de curiosidades animadas (canal NICO VAREL)

Sistema de producción, no una lista de prompts: motor 3D propio (three.js en Chrome headless + ffmpeg), personajes 2D en capas, escenarios procedurales, voz, subtítulos, mezcla y control de calidad automáticos. Todo en español con acentos correctos. **Detalles técnicos: `references/`. Guía para personas: `README.md`.**

Rutas (la skill vive en `~/.claude/skills/shorts-curiosidades-animadas/`; abrevio `$SK`): scripts en `$SK/scripts`, motor en `$SK/assets/engine`, plantillas en `$SK/templates`. Los Shorts van en `SHORTS/NNN-nombre/` (raíz: `--root`, variable `NICOVAREL_SHORTS_DIR` o `./SHORTS`).

## Reglas que siempre aplican
1. **Veracidad antes que efecto.** Nada se afirma sin fuente leída; lo dudoso se dice con cautela («según los relatos…»); no se inventan diálogos, cifras ni atribuciones. Si hay versiones, se explica la incertidumbre o se omite el detalle. (`references/research.md`)
2. **Nunca prometer los 16 M de visitas** (ni insinuarlo) ni garantizar resultados. Son el resultado de una referencia ajena.
3. **No afirmes que algo está automatizado o comprobado si no lo está.** Si algo exige una persona o una herramienta externa, dilo (`references/limitations.md`). «10 minutos» solo con tiempos medidos.
4. **Seguridad:** nada de instaladores opacos ni `curl | bash`; no guardes claves API en archivos; no subas material privado a servicios externos sin permiso; originales intactos (trabaja en copias).
5. **Fidelidad a la referencia:** estudia estilo y experiencia, no copies la Skill, prompts, personajes ni recursos de otros creadores (Ale Ferr u otros). La arquitectura es propia.
6. Responde y escribe al usuario siempre en español.

## Primera vez / diagnóstico
`python $SK/scripts/doctor.py --gpu-test` (solo lee). Si falta algo, dilo y propón la alternativa documentada.

## Cómo empezar según lo que traiga el usuario
| Caso | Qué hacer |
|---|---|
| 1. Sin idea | Propón **5 ideas distintas y verificables** (`references/ideas.md`); espera elección |
| 2. Con idea (A: una de las 5 · B: propia, sin obligar a elegir) | Investiga y sigue desde el paso 2 |
| 3. Guion aportado | Valida hechos/fuentes, pasa a storyboard (paso 4) |
| 4. Narración (audio) aportada | `transcribe.py` → el audio es la base temporal; construye guion/escenas sobre él (`references/audio.md`) |
| 5. Material ya existente | Inspecciona qué hay y continúa desde el paso que corresponda |
Pregunta solo lo imprescindible (idea y, si quiere, su voz). Valores por defecto: 45-60 s, voz de reserva, música `curioso`.

## Flujo de 12 pasos (resumen; detalle en `references/pipeline.md`)
1. **Idea** → 2. **Investigar/verificar** (`01-research/sources.md` + `facts.md`) → 3. **Guion** (`02-script/script.md`, líneas `S01 | F1,F2 | texto`) → 4. **Storyboard** `03-storyboard/scenes.json` (6-10 escenas) → 5. **Personajes** (`04-characters/characters.json` + `character-bible.md`) → 6. **Escenarios** (sets del motor + parámetros) → 7. **Movimientos** (acciones y cámara dentro de `scenes.json`) → 8. **Narración** → 9. **Subtítulos** → 10. **Música y SFX** → 11. **Render** → 12. **Título y descripción**.

Orden de comandos (desde la carpeta del Short; `$D` = ruta del Short):
```
python $SK/scripts/new_short.py "nombre" --root <SHORTS>            # estructura + plantillas
python $SK/scripts/lint_research.py $D                              # hechos, fuentes, cautela, guion = storyboard
python $SK/scripts/character_sheet.py $D                            # hoja de personajes (revisar antes de las escenas)
python $SK/scripts/tts.py $D                                        # voz de reserva (edge-tts, EN LÍNEA) -> words.json
#   o: python $SK/scripts/transcribe.py <audio> --short $D           # voz real del usuario (Whisper local)
python $SK/scripts/build_project.py $D                              # short.json + subtitles.srt + sfx_cues.json
python $SK/scripts/export_storyboard.py $D                          # storyboard.md legible
python $SK/scripts/audio_build.py $D                                # música + SFX + mezcla -14 LUFS
python $SK/scripts/render.py --project $D/08-project --stills 30,200,400 --stills-dir $D/09-final/_stills   # revisar encuadres
python $SK/scripts/contact_sheet.py --dir $D/09-final/_stills --out $D/09-final/_stills/sheet.png           # y MIRARLA
python $SK/scripts/render.py --project $D/08-project --audio $D/06-audio/mix.wav --out $D/09-final/short.mp4 --workers 2
python $SK/scripts/qc.py $D                                         # control de calidad + hoja de contacto
```
Siempre revisa visualmente los stills **antes** del render completo (el render completo tarda minutos). Mide y reporta tiempos reales (`short.mp4.timing.json`, `tts_timing.json`).

## Qué leer en cada fase
- Idea → `references/ideas.md` · Investigación → `references/research.md` · Guion → `references/scriptwriting.md`
- Storyboard, acciones, cámara, FX, SFX, sintaxis de tiempos → `references/storyboard-schema.md`
- Personajes, escenarios, cámara, composición/zona segura → `references/visual-bible.md`
- Voz, música, SFX, herramientas MCP de audio → `references/audio.md`
- Subtítulos, render, QC → `references/render-qc.md`
- Decisiones técnicas → `references/architecture.md` · Fallos → `references/troubleshooting.md` · Límites reales → `references/limitations.md`

## Calidad: criterios que no se negocian
- Gancho en los primeros segundos con el dato más raro; sin «Hola», «En este video…» ni «¿Sabías que…?» sin razón creativa.
- Cada escena representa lo que se narra. Personaje principal visible, sobre el área de subtítulos (encuadre estándar: pies ≈ 58 % de la altura). Cámara con intención.
- Subtítulos: máx. 2 líneas, texto idéntico al guion, azul de marca solo en palabras clave.
- Tras el render: `qc.py` y **mirar la hoja de contacto**. Lo marcado `MANUAL` (ortografía, voz, estética) no está aprobado hasta que una persona lo revise; no lo des por bueno.
- Entregables por Short: MP4, guion, fuentes, storyboard, subtítulos, archivos del proyecto, título (sin engaños), descripción, hashtags, créditos.
