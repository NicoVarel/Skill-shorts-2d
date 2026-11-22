# Guion

**Duración:** 45-60 s (adaptar a la historia) ≈ 130-170 palabras a ritmo de narración (≈ 2,7-3 palabras/s). Mide con el TTS: `tts.py` te da la duración real.

## Estructura base
| Tramo | Segundos | Función |
|---|---|---|
| Gancho | 0-3 (hasta ~5 si hace falta) | el dato más extraño, ya con imagen que lo demuestre |
| Contexto | 3-12 | quién, dónde, cuándo (una etiqueta visual lo refuerza) |
| Desarrollo | 12-30 | cómo funcionaba / qué pasó, en pasos que se vean |
| Giro / revelación | 30-45 | lo que cambia la lectura (la cifra no comprobada, el detalle inesperado, el mito) |
| Cierre | 45-60 | frase memorable que vuelve al presente; sin promesas ni «suscríbete» pegado |

## Estilo (español natural)
- Como quien cuenta algo fascinante: frases claras y cortas, verbos concretos, sin lenguaje académico ni muletillas, sin redundancias.
- **Nada de** «Hola», «Hoy hablamos de…», «En este video…», «¿Sabías que…?» salvo razón creativa.
- Una idea por frase; cada frase = una escena o medio plano. Lo que se oye debe poder verse.
- Cifras escritas como se dicen («sesenta y nueve años»); años en cifra si se leen como año («1934»). El subtítulo muestra el texto tal cual (mayúsculas automáticas).
- Cautela dicha con naturalidad: «según los relatos», «un titular decía», «no está comprobado». Es un valor del canal.
- Humor: solo si no contradice los hechos; el guiño final es del presente, no de la historia.
- Nunca atribuyas palabras a personas reales sin documento.

## Marcas
- `*palabra clave*` en el texto resalta en azul de marca en los subtítulos (1-2 por escena como máximo). Los números se resaltan solos.
- `script.md` lleva las etiquetas de hechos: `S01 | F1,F2 | texto`. El texto debe ser idéntico al `narration` de `scenes.json`.

## Checklist antes de pasar al storyboard
- [ ] Gancho en la primera frase · [ ] cada frase cita hechos · [ ] lo dudoso lleva cautela · [ ] duración medida · [ ] el cierre no promete resultados · [ ] suena bien leído en voz alta (léelo en voz alta mentalmente: sin trabalenguas)
