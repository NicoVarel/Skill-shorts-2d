# Pipeline de 12 pasos

Cada paso termina en un archivo concreto dentro de `SHORTS/NNN-nombre/`. No se pasa al siguiente sin el anterior (salvo en los casos 3-5 de «Cómo empezar»).

| # | Paso | Archivo de salida | Quién lo hace | Puerta de salida |
|---|---|---|---|---|
| 1 | Idea | (conversación) | Claude propone / usuario trae | idea elegida, con imagen que la represente |
| 2 | Investigar y verificar | `01-research/sources.md`, `facts.md` | Claude (web) | `lint_research.py` sin errores |
| 3 | Guion | `02-script/script.md` | Claude | 130-170 palabras (≈ 50-60 s), cada frase con `F…` |
| 4 | Storyboard | `03-storyboard/scenes.json` (+ `storyboard.md` legible) | Claude | 6-10 escenas, cada una ilustra su frase |
| 5 | Personajes | `04-characters/characters.json`, `character-bible.md` | Claude | hoja de personaje revisada (`sheet.html`) |
| 6 | Escenarios | parámetros `set` en `scenes.json` (+ `05-environments/NOTAS.md`) | Claude | stills revisados |
| 7 | Movimientos y cámara | acciones/cámara en `scenes.json` | Claude | stills de inicio/medio/fin de cada escena |
| 8 | Narración | `06-audio/narration.wav`, `words.json` | TTS de reserva o voz real del usuario | duración 45-60 s, palabras = guion |
| 9 | Subtítulos | `07-subtitles/subtitles.srt`, `cues.json` | `build_project.py` | `qc.py` sin fallos |
| 10 | Música y SFX | `06-audio/mix.wav`, `credits.md` | `audio_build.py` | -14 LUFS, pico ≤ -1 dBTP |
| 11 | Render | `09-final/short.mp4` | `render.py` | `qc.py` + hoja de contacto mirada |
| 12 | Título y descripción | `09-final/title-description.md` | Claude | sin engaños, con fuentes y créditos |

## Casos de entrada
1. **Sin idea:** 5 ideas (ver `ideas.md`). Modo A (elige una) / Modo B (idea propia; no obligar a elegir de las 5).
2. **Con idea:** pasa al paso 2.
3. **Guion aportado:** verifica sus hechos (paso 2 sobre el texto del usuario), registra fuentes, no cambies su voz; storyboard sobre su texto.
4. **Narración aportada:** `transcribe.py <audio> --out 06-audio/transcript.json` → escribe guion/escenas que reproduzcan **literalmente** lo dicho (o recortes) → `transcribe.py <audio> --short $D` alinea. El audio manda en el tiempo.
5. **Materiales existentes:** mira `SHORTS/` y qué archivos hay (`ls`), continúa desde el primer paso incompleto; no rehagas lo que funciona.

## Cambios posteriores («pídele cambios»)
- Cambiar una frase de guion → editar `script.md` **y** `scenes.json` (deben coincidir) → `tts.py` → `build_project.py` → `audio_build.py` → render.
- Cambiar solo imagen (cámara, pose, luz) → editar `scenes.json` → `build_project.py` → stills → render (no hace falta rehacer la voz).
- Haz copia de `scenes.json` y `characters.json` antes de tocar (`scenes.vN.json`).

## Tiempos: qué se mide
`tts_timing.json` (voz), `short.mp4.timing.json` (arranque del motor, fotogramas, fps). Anota aparte la **intervención humana** (elección de idea, escuchar la voz, revisar ortografía). El «Cómo hacer Shorts en 10 minutos» solo se afirma con la suma real de las columnas medidas: configuración inicial, investigación, generación, render, intervención.
