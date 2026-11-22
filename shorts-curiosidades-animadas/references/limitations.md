# Limitaciones reales (no ocultar nada)

## Qué es automático y qué NO
| Automático (código) | Requiere persona o herramienta externa |
|---|---|
| Estructura de carpetas, plantillas, linter de fuentes | **Investigar de verdad** (búsqueda + lectura de fuentes) lo hace Claude con herramientas web; que la fuente diga lo que el hecho afirma lo debe revisar una persona |
| Voz de reserva (edge-tts), tiempos palabra a palabra, subtítulos, música, SFX, mezcla, render, QC, hoja de contacto | **Escuchar** la voz y la mezcla; revisar **ortografía** de subtítulos; juzgar estética y consistencia visual |
| Alineación de una voz aportada (Whisper local) | **Grabar o aportar** la voz real del fundador |
| Personajes y escenarios procedurales | Diseñar el storyboard y las poses de cada escena (lo hace Claude, no es automático: depende de la historia) |
| Publicación | **Nunca automática**: subir el vídeo a YouTube lo hace una persona |

## Técnicas
- **edge-tts no es local:** envía el texto del guion a un servicio en línea de Microsoft. Sin internet no hay voz de reserva (Whisper + voz real sí funcionan sin conexión).
- **Voz de reserva:** su naturalidad no se ha escuchado ni medido; suena a TTS. La voz del fundador es la preferida y debe sustituirla.
- **Personajes frontales:** el cuerpo no gira en 3D; los sentidos de marcha se muestran con espejo + giro de cabeza. Sentarse = piernas en perfil; tumbado = tarjeta girada 84° (se ve la cara de frente y rotada). No hay manos con dedos ni perfiles reales.
- **Interacción objeto-personaje limitada:** los objetos se dibujan en la mano de la tarjeta 2D; no hay colisión real con objetos 3D (un personaje puede «atravesar» una silla si se coloca mal). Las sombras de los objetos 3D no caen sobre los personajes.
- **Sombra proyectada:** plana sobre el plano del suelo; no se adapta a escalones ni a muebles.
- **Escenarios:** 5 sets procedurales con estética propia (toon), no fotorrealistas; la «calle victoriana» es un tipo de calle, no una calle real concreta. Falta: oficina del XIX completa (hay variante `oficina` sin pulir), puerto detallado, interiores de fábrica.
- **Sin desenfoque de profundidad (DOF):** la profundidad se logra con niebla, paralaje, escala y viñeta.
- **SFX sintetizados:** efectos estilizados; no hay biblioteca de sonidos reales. Música original sencilla (4 estados de ánimo); no sustituye a una banda sonora compuesta.
- **Idioma y fuentes tipográficas:** subtítulos con Arial Black (sistema); en otro equipo sin esa fuente se usará otra gruesa.
- **Plataforma:** probado en Windows 11 con Chrome 157, RTX 4060 Ti. Linux/macOS deberían funcionar (rutas y flags están previstos) pero **no se han probado**. Sin GPU: `--cpu` es muy lento.
- **Windows y arranque simultáneo de navegadores:** se arrancan secuencialmente (dos a la vez se bloqueaban).
- **La cifra «10 minutos»** no se afirma: ver los tiempos medidos de cada Short.

## Cosas que NO hace (por seguridad y honestidad)
No imita instaladores de terceros, no copia plantillas/prompts/personajes de otros creadores, no guarda claves API, no sube nada a internet salvo el texto del guion a edge-tts (si se usa) y las búsquedas web de la investigación, no publica en YouTube, no promete resultados de visualizaciones (los «16 M» son de una referencia ajena).
