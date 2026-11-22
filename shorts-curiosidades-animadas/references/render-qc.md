# Subtítulos, render y control de calidad

## Subtítulos
- Sincronizados palabra a palabra (tiempos del TTS o de Whisper), mayúsculas, **Arial Black / Segoe UI Black / Impact** con trazo negro grueso y sombra, tamaño 7,1 % del ancho, **máx. 2 líneas y 17 caracteres por línea**, posición fija a 65,5 % de la altura (zona segura de Shorts: no tapa la interfaz inferior ni la figura, que va por encima).
- Texto = guion (misma secuencia de palabras; el QC lo comprueba). Resaltado de claves con `*…*` en azul de marca `#2f7bff`; los números se resaltan solos. La palabra que se está diciendo «salta» un 13 %.
- `07-subtitles/subtitles.srt` se genera siempre (para subir a YouTube como pista aparte si se desea); los subtítulos del vídeo están quemados.
- Fuentes: son del sistema (no se redistribuyen). Si falta Arial Black, el navegador usa otra gruesa; compruébalo en la hoja de contacto.

## Render (`render.py`)
- 1080×1920, 9:16, **H.264 (libx264, CRF 16, yuv420p, BT.709 etiquetado) + AAC 192 kbps 48 kHz, 30 fps**, `+faststart`, pantalla completa (sin marcos ni mockups).
- Tubería: Chrome headless con GPU (ANGLE/D3D11) → captura PNG de cada fotograma → ffmpeg por `stdin` (sin carpetas de fotogramas: ahorra disco). `--workers 2` renderiza en paralelo y ordena la salida.
- Previa rápida: `--scale 0.5`, `--range 0-90`, `--fmt jpeg`. Stills: `--stills 30,200 --stills-dir …`. Informe de visibilidad: `--report 5`.
- Resultado y tiempos: `short.mp4` y `short.mp4.timing.json` (arranque del motor, fotogramas, fps de render).
- Determinista: el mismo `short.json` produce el mismo vídeo (todo es función del tiempo).

## Control de calidad: `qc.py`
Estados: **OK / AVISO / FALLO / MANUAL**. No marca como aprobado lo no comprobado.
| Área | Automático | MANUAL (persona) |
|---|---|---|
| Vídeo | resolución, fps, códec, color, duración, tamaño; negros, tramos congelados, escenas vacías/planas, exposición, saltos de brillo | estética, estilo, consistencia |
| Animación | personaje principal visible y dentro del cuadro (informe del motor cada 5 fotogramas), cámara sin valores inválidos, subtítulos en zona segura | integración personaje-escenario, fluidez, rigidez, cámara «con intención» |
| Audio | −14 LUFS ±1,5, pico real, recorte, silencios largos dentro de frases, pausas entre escenas, narración completa | naturalidad de la voz, mezcla, SFX |
| Subtítulos | ≤2 líneas, ≤20 car/línea, solapes, velocidad de lectura, texto = guion, sincronía por construcción | **ortografía y acentos**, legibilidad en móvil |
| Investigación | `lint_research.py` | que cada fuente diga lo que el hecho afirma |
Genera `09-final/qc-report.md`, `qc.json`, `contact_sheet.png` (24 fotogramas). **Mira la hoja de contacto** y los stills: es la revisión visual obligatoria; anota en el informe lo que viste.

## Checklist visual (hoja de contacto)
- [ ] Ningún plano vacío, negro o con la cámara dentro de un objeto · [ ] el personaje se ve entero y por encima de los subtítulos · [ ] sombra coherente con el sol · [ ] etiquetas legibles y sin pisar al personaje · [ ] la acción de la escena es la que se narra · [ ] mismo personaje = misma cara y ropa · [ ] los fundidos/transiciones no dejan negros largos
