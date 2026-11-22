# Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `El motor no arrancó` en render | arranque de varios Chrome a la vez, o error de JS | `render.py` ya arranca en secuencia; mira la consola que imprime; prueba `--workers 1`; comprueba `doctor.py --gpu-test` |
| Imagen toda de un color (p. ej. durazno) | cámara dentro de una casa/objeto, o `NaN` por un tiempo mal escrito | revisa `dist·cos(az)` (<7 en la calle), que `walk` lleve `t`/`t0` y `t1`; mira el still |
| Columna negra enorme en pantalla | un objeto (farola, bolardo) pegado a la lente | mueve la cámara o el objeto; las farolas ya se colocan en juntas de casas |
| Fachadas negras/violetas | el sol les da por detrás | `lightOverrides.sun.az` ≈ 280-300 en la calle (ilumina la fachada del fondo) |
| Personaje sobre los subtítulos | encuadre demasiado bajo | usa el encuadre estándar (`visual-bible.md`): `lookY` ≈ 0.5, `dist` 6-8 |
| `Ancla desconocida` / `Personaje desconocido` | nombre mal escrito | anclas: ver `visual-bible.md`; usa `char:id` con el `id` de la escena |
| `la escena tiene N palabras…` / `K palabras en el guion y M en words.json` | cambió la narración tras generar la voz | vuelve a ejecutar `tts.py` (o `transcribe.py --short`) y `build_project.py` |
| `SFX desconocido` | nombre fuera de la lista | ver `audio.md` o añade la función a `audiolib.py` |
| `UnicodeDecodeError` al leer JSON | archivo guardado en cp1252 | guarda siempre en UTF-8; en PowerShell `$env:PYTHONUTF8=1` |
| edge-tts falla / sin voz | sin internet o servicio caído | usa la voz del fundador con `transcribe.py`, o reintenta más tarde |
| `qc.py` marca «escenas planas» | cámara en un plano liso (cielo/pared) | revisa los stills de esa franja de tiempo |
| Disco lleno | otros proyectos (los bundles de Remotion de `cartoon-3d-remotion` ocupan decenas de GB) | esta skill no crea carpetas de fotogramas; libera espacio fuera de la skill, con permiso del usuario |
| Fuente de subtítulos distinta | falta Arial Black | instala la fuente o cambia `FONT` en `overlay.js` |
