# shorts-curiosidades-animadas — guía de uso

Skill de Claude Code del canal **NICO VAREL**: convierte una idea en un **Short vertical terminado** (1080×1920, MP4) de curiosidades e historias reales, con personajes 2D en escenarios 3D, cámara, voz, subtítulos, música y efectos. No necesitas saber Blender, programar ni editar.

## Cómo se usa (3 frases)
1. Abre Claude Code en tu carpeta de trabajo y escribe: **`/shorts-curiosidades-animadas`** (o «hazme un short de curiosidades sobre…»).
2. Si no tienes idea, Claude te propone **5 ideas verificadas**; elige una (Modo A) o dile la tuya (Modo B). También puedes darle un guion, un audio con tu voz o material que ya tengas.
3. Claude investiga, escribe guion y storyboard, te enseña fotogramas, y entrega el Short en `SHORTS/NNN-nombre/09-final/`.

## Qué tienes que hacer tú (y qué no)
- **Elegir la idea** y **escuchar/dar tu voz.** La voz del fundador es la preferida; si no la das, se usa una voz de reserva (edge-tts), que **envía el texto del guion a Microsoft** y suena a máquina.
- **Revisar** ortografía de los subtítulos y escuchar el MP4. Claude marca como *pendiente de revisión* lo que no puede comprobar una máquina.
- **Subir el vídeo a YouTube lo haces tú.** La skill nunca publica.

## Pedir cambios
«Cambia la frase 4», «más zoom en la escena 3», «que el policía entre antes», «música más misteriosa», «con mi voz». Claude edita `scenes.json`/`script.md`, regenera lo necesario y vuelve a renderizar (lo visual no obliga a rehacer la voz).

## Dónde queda todo
```
SHORTS/NNN-nombre/
  01-research/   sources.md, facts.md           fuentes y hechos verificados
  02-script/     script.md                      guion con etiquetas de hechos
  03-storyboard/ scenes.json (+ storyboard.md)  escenas, acciones, cámara
  04-characters/ characters.json, character-bible.md
  05-environments/ notas de escenarios
  06-audio/      narration.wav, mix.wav, music.wav, words.json, credits.md
  07-subtitles/  subtitles.srt
  08-project/    short.json (lo que lee el motor)
  09-final/      short.mp4, title-description.md, qc-report.md, contact_sheet.png   ← carpeta lista para publicar
```

## Dependencias
Obligatorias (ya instaladas en este equipo): Windows/macOS/Linux, **Chrome o Edge**, **ffmpeg + ffprobe**, **Python 3.10+** con `numpy`, `scipy`, `pillow`, `aiohttp`; GPU recomendada. Opcionales: `edge-tts` (voz de reserva), `openai-whisper` (voz propia). three.js ya va incluido (MIT). `python scripts/doctor.py --gpu-test` lo comprueba todo sin instalar nada.

## Si algo falla
`references/troubleshooting.md`. Límites y qué no está automatizado: `references/limitations.md`.

## Licencias y créditos
three.js (MIT, `assets/engine/vendor/THREE_LICENSE.txt`). Música, SFX, personajes y escenarios: generados por el código de esta skill (sin recursos de terceros). Estilo estudiado de referencias públicas; **no se copió** ninguna skill, prompt, personaje ni recurso ajeno.
