# Investigación y veracidad

Antes del guion. Honestidad intelectual por encima del gancho.

## Qué buscar (por orden de peso)
1. Fuentes primarias y de época (periódicos, censos, fotografías con ficha, documentos oficiales).
2. Museos, archivos, bibliotecas nacionales, instituciones académicas, publicaciones científicas.
3. Divulgación académica (JSTOR Daily, blogs de revistas con autor y afiliación).
4. Prensa de referencia y enciclopedias **como punto de partida**: úsalas para llegar a sus referencias, no como prueba final.
Contrasta cada hecho importante con **≥ 2 fuentes independientes** cuando se pueda («independientes»: una que copia a la otra no cuenta).

## Cómo registrarlo (archivos obligatorios por Short)
- `01-research/sources.md`: un bloque `## S1 — título` con **URL, Tipo, Estado (leída | citada | no accedida), Aporta, Cautela**. «Leída» solo si abriste la página. Si una fuente dio error (de pago, bloqueada), regístrala como **no accedida** y no la uses.
- `01-research/facts.md`: un bloque `## F1 — título` con **Afirmación, Estado, Fuentes** y, si no es «confirmado», **Cómo se dice**. Termina con «Dichos que NO afirmamos».
  - `confirmado` ≥ 2 fuentes leídas (o documento de época) · `parcial` una fuente · `discutido` fuentes contradictorias · `no_comprobado` solo relato/titular.
- Registra: fechas, lugares, personajes, contexto, **qué está demostrado, qué es discutido, qué no se puede confirmar**.

## Reglas de redacción
- No conviertas leyendas en hechos. No inventes diálogos, pensamientos ni atribuciones («dijo…») sin documento.
- Una cifra de un titular es «un titular decía…», no un dato.
- Fechas discutidas: no elijas una; di «hacia…» o evítala.
- Las escenas son **ilustraciones**; si el personaje es una persona real, es una representación estilizada (nota en `character-bible.md` y en la descripción).
- Si la historia popular es falsa o matizable, el Short puede ser precisamente eso (mito vs realidad).

## Cómo investigar con las herramientas
- `WebSearch` para localizar; leer las páginas completas (agente `web-fetch` si no tienes `WebFetch`) antes de citarlas. Anota fecha de consulta.
- Desconfía de listas virales («datos curiosos»): úsalas solo para descubrir temas, nunca como fuente.
- Si un dato solo aparece en blogs sin cita, es `no_comprobado`.

## Linter
`python $SK/scripts/lint_research.py $D` comprueba formato, que cada frase cite hechos existentes, que «confirmado» tenga ≥ 2 fuentes, que no haya fuentes «no accedidas», que lo discutido lleve cautela y que `script.md` = `scenes.json`.
**No puede** comprobar que la fuente diga realmente lo que el hecho afirma: eso es revisión humana (o tuya, releyendo la fuente).
