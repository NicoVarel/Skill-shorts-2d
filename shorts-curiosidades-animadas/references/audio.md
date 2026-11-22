# Audio: voz, música, SFX y mezcla

La **voz manda en el tiempo**: escenas, acciones y subtítulos se anclan a las palabras (`@w3`).

## Modos de voz (en este orden de preferencia)
1. **Voz aportada por el usuario (preferida: la voz real del fundador).** `python transcribe.py <audio> --short $D`. Todo local (Whisper `small`, español): el audio no sale del equipo. Copia el audio a `06-audio/narration.wav` (48 kHz mono) **sin tocar el original** y alinea las palabras del guion con las de Whisper (`words.json`). Si más del 20 % de palabras salen interpoladas, el guion difiere del audio: corrígelo. Solo limpieza técnica; nunca cambies la voz de otra persona sin permiso.
   Si solo hay audio: `transcribe.py <audio> --out 06-audio/transcript.json`, escribe las escenas sobre esa transcripción y alinea.
2. **Voz de reserva: edge-tts** (`python tts.py $D [--voice es-MX-JorgeNeural --rate +10%]`). Sin clave API, gratis, pero **NO es local**: envía el texto del guion al servicio en línea de Microsoft Edge. Úsalo solo con guiones que puedan salir del equipo. Genera escena a escena con tiempos de palabra exactos, recorta silencios y une con pausas de 0,2 s. Es una voz de reserva: **no se ha escuchado la naturalidad** (solo se mide duración y timing); la persona debe escucharla.
3. **Proveedor de pago** (ElevenLabs u otros) solo si el usuario lo configura y autoriza. Nunca guardes claves en archivos: variables de entorno, comprobar su existencia sin mostrarlas. No simules APIs que no existan.

### Herramientas MCP de audio disponibles en este equipo (comprobado 2026-11-22)
Existen conectores MCP con `audio_tts`, `audio_music_generate`, `audio_sfx_generate` (Magnific/Freepik) y `generate_audio` (otro proveedor). La cuenta conectada es **plan gratuito con 0 créditos y sin voces clonadas** (`account_balance`, `audio_voices_list`): **no se usaron** y no se gastó nada. Si el usuario compra créditos, pueden sustituir a `tts.py`/`audiolib.py`, pero eso envía texto a un servicio externo (pedir permiso) y la licencia de lo generado debe revisarse en los términos del proveedor.

## SFX (sintetizados, originales, sin licencias)
`scripts/audiolib.py` genera todo con numpy: `footstep footsteps knock glass_tap pea_tic pea_burst whoosh thud alarm_bell ding tick paper wind birds crowd street snore boing pop sparkle bowling_roll pin_crash door_creak yawn_air cheer`. Úsalos **con intención** (cada SFX acompaña una acción visible, sin saturar): pasos al caminar, golpes al llamar, `glass_tap` cuando impacta algo en un cristal, ambientes (`street`, `wind`, `birds`, `crowd`) suaves por escena. Para uno nuevo: añade una función a `audiolib.py` y regístrala en `SFX`.
Los SFX sintetizados son más «de dibujos animados» que realistas: es una decisión de estilo y una limitación (ver `limitations.md`).

## Música
Original, procedural (`audiolib.music`): moods `curioso` (marimba/pluck, 104 bpm), `misterio`, `calido`, `tension`. Se genera a la duración exacta, con reverb, y **baja automáticamente bajo la voz** (ducking de −9 dB con ataque 50 ms y liberación 450 ms) a −22 dB relativos a la voz. No necesita créditos ni licencia (obra propia, `credits.md` lo declara). Si el usuario aporta música ajena: comprueba la licencia por escrito, guarda la prueba en `06-audio/` y añade el crédito en `credits.md`.

## Mezcla y sonoridad
`audio_build.py`: voz + SFX (estéreo con paneo) + música con ducking → limitador suave → `loudnorm` de **dos pasadas a −14 LUFS** (pico real ≤ −1,5 dBTP) → `06-audio/mix.wav` (48 kHz estéreo). Informe: `mix_report.json`. Lo que **no** se comprueba por máquina: que la voz suene natural, que la música acompañe el tono y que los SFX no molesten → revisión humana al escuchar el MP4.
