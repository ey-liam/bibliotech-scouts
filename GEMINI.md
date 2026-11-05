# GEMINI.md — Instrucciones para Antigravity / Gemini

Lee y sigue **AGENTS.md** como protocolo principal. Este archivo solo resume lo
más importante para tu flujo de trabajo.

## Contexto

Trabajas sobre todo en la generación de datos y en la publicación del sitio:

- `C:\Users\liamc\.gemini\antigravity\scratch\bibliotech-scouts\public\`
- `C:\Users\liamc\.gemini\antigravity\scratch\bibliotech-scouts\dist_web\`

`dist_web` es el clon git que se publica. `public` es la fuente que usa
`prepare_public_site.py` para copiar sobre `dist_web`.

## Reglas específicas

1. Antes de publicar, sincroniza `index.html`, `styles.css`, `app.js`, `img/` y
   `assets/` desde `main` hacia `public/`. Si no, puedes revertir mejoras hechas
   por OpenCode o Copilot.
2. No ejecutes `prepare_public_site.py` ni `actualizar_bibliotech.bat` si otro
   agente está editando esos archivos. Revisa el issue o el PR activo.
3. Los datos generados (`data/catalog.json`, `knowledge_base.json`,
   `questions_bank.json`, `chunks.json`) no se editan a mano. Si cambian, explica
   de qué script salieron y adjunta un resumen del diff.
4. Trabaja en una rama `agent/gemini/<tema>` y abre un PR. No hagas push directo
   a `main`.
5. En los PRs incluye:
   - Qué datos o archivos cambiaste.
   - Qué script ejecutaste.
   - Cómo comprobaste que el sitio sigue funcionando.
   - Si el peso de los archivos aumentó y cuánto.
6. Respeta la accesibilidad: no elimines textos alternativos, etiquetas ARIA ni
   el enlace para saltar al contenido.

## Publicación

Después de fusionar un PR que cambie datos:

1. `git -C dist_web pull --ff-only`
2. Sincronizar los archivos de sitio desde `dist_web` hacia `public/`.
3. Ejecutar el generador correspondiente.
4. Ejecutar `prepare_public_site.py`.
5. Revisar `git -C dist_web status` antes de hacer commit.
6. Commit y push a `main`.
7. Verificar el sitio publicado y avisar en el issue o PR.
