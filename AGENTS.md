# AGENTS.md — Protocolo de trabajo de BiblioTech

Este archivo explica cómo deben trabajar juntos los agentes de IA y las personas
en el repositorio **ey-liam/bibliotech-scouts**. Es la fuente de verdad para
OpenCode, Antigravity/Gemini, GitHub Copilot y cualquier colaborador humano.

## 1. Objetivo del proyecto

BiblioTech es un sitio estático publicado con GitHub Pages. Su prioridad es que
cualquier persona pueda consultar y descargar documentación oficial de ASMAC y
WOSM de forma clara, rápida y accesible.

- Sitio: <https://ey-liam.github.io/bibliotech-scouts/>
- Repositorio: <https://github.com/ey-liam/bibliotech-scouts>
- Rama publicada: `main`
- Sitio estático: HTML, CSS y JavaScript sin compilación.

## 2. Mapa de archivos y responsabilidades

| Ruta | Qué contiene | Se puede editar a mano |
| --- | --- | --- |
| `index.html` | Estructura, metadatos, secciones y textos visibles | Sí, con cuidado |
| `styles.css` | Diseño, responsive, accesibilidad visual y animaciones | Sí |
| `app.js` | Buscador, biblioteca, catálogo, lector y carga de datos | Sí |
| `data/catalog.json` | Catálogo de documentos | **No**: se genera con scripts |
| `data/knowledge_base.json` | 104 temas enciclopédicos | **No**: se genera con scripts |
| `data/questions_bank.json` | Banco de preguntas y respuestas | **No**: se genera con scripts |
| `data/chunks.json` | Fragmentos de texto para búsqueda profunda | **No**: se genera con scripts |
| `img/`, `assets/` | Imágenes y recursos visuales | Sí, optimizando peso |
| `README.md` | Presentación del proyecto | Sí |
| `AGENTS.md` | Este protocolo | Sí, con acuerdo del equipo |
| `GEMINI.md` | Instrucciones para Antigravity/Gemini | Sí |
| `.github/copilot-instructions.md` | Instrucciones para GitHub Copilot | Sí |

### Copia de publicación de Antigravity/Gemini

Antigravity trabaja en:

`C:\Users\liamc\.gemini\antigravity\scratch\bibliotech-scouts\`

Ahí existen dos carpetas importantes:

- `public/`: fuente que usan los scripts de generación.
- `dist_web/`: clon git que se publica a `main`.

`prepare_public_site.py` copia `public/` sobre `dist_web/`. Por eso, **antes de
volver a publicar**, hay que sincronizar los archivos del sitio desde `main`
hacia `public/` (`index.html`, `styles.css`, `app.js`, `img/`, `assets/`). Si no
se hace, la siguiente publicación puede revertir mejoras hechas en el repo.

## 3. Reglas de oro

1. **Una tarea = una rama = un pull request.** No se trabaja directamente en
   `main`, aunque la rama no esté protegida.
2. **Nombres de rama:**
   - `agent/opencode/<tema>`
   - `agent/gemini/<tema>`
   - `agent/copilot/<tema>`
   - `human/<tema>`
3. **Antes de empezar:** `git fetch origin` y actualizar la rama desde
   `origin/main` (`git rebase origin/main` o `git merge origin/main`).
4. **Cambios pequeños y revisables.** Evita PRs gigantes que mezclen datos,
   diseño y lógica.
5. **No editar a mano** los JSON de `data/` ni los archivos generados.
6. **No ejecutar** `prepare_public_site.py`, `actualizar_bibliotech.bat` ni
   `PUBLICAR_WEB.bat` mientras otro agente esté editando el sitio. Esos scripts
   copian carpetas completas y pueden sobrescribir trabajo ajeno.
7. **No subir tokens, contraseñas, `.env` ni `service.json`.** El MCP de GitHub
   obtiene el token de `gh` en tiempo de ejecución.
8. **No inventar información documental.** Las respuestas deben salir de los
   documentos y de la base de conocimiento del proyecto.
9. **Respetar el trabajo de los demás.** Si un archivo tiene cambios que no son
   tuyos, investígalos antes de reemplazarlo.
10. **Accesibilidad y rendimiento no son opcionales.** Cada cambio debe mantener
    o mejorar el resultado anterior de Lighthouse.

## 4. Flujo de trabajo

1. Crear o tomar un issue con la plantilla correspondiente.
2. Etiquetarlo con `agent:opencode`, `agent:gemini` o `agent:copilot`, y con el
   área (`area:ui`, `area:data`, `area:a11y`, `area:performance`, `area:docs`).
3. Crear la rama desde `origin/main`.
4. Implementar el cambio más pequeño que resuelva el issue.
5. Validar en local (ver sección 5).
6. Abrir un PR usando `.github/PULL_REQUEST_TEMPLATE.md`.
7. Pedir revisión a otro agente o a Liam. Copilot puede revisar el PR.
8. Hacer merge con **squash** y borrar la rama.
9. Verificar GitHub Pages entre 1 y 2 minutos después del merge.

## 5. Validación mínima antes de abrir un PR

```powershell
# Desde la raíz del repositorio
python -m http.server 8765 --bind 127.0.0.1
```

Abrir <http://127.0.0.1:8765/> y comprobar:

- [ ] La consola del navegador no muestra errores.
- [ ] El buscador responde y muestra fuentes.
- [ ] Las pestañas de la biblioteca y del catálogo funcionan.
- [ ] El lector de documentos abre y permite descargar.
- [ ] La vista móvil (por ejemplo 390 px de ancho) no tiene desbordes.
- [ ] Los archivos JSON modificados son válidos:
      `python -m json.tool data/catalog.json > $null`
- [ ] Lighthouse de accesibilidad y SEO no baja respecto a la versión anterior.
- [ ] No se agregaron imágenes sin `loading="lazy"` ni `decoding="async"` fuera
      de la primera pantalla.

## 6. Reparto recomendado de trabajo

### OpenCode

- Implementación de mejoras de UI, accesibilidad, rendimiento y SEO.
- Refactorizaciones pequeñas de `app.js`.
- Validación local, Lighthouse y revisión técnica de PRs.
- Conexión con GitHub mediante el MCP oficial.

### Antigravity / Gemini

- Generación y actualización de `data/*.json`.
- Extracción de texto, portadas y documentos.
- Publicación de assets y del sitio desde `dist_web`.
- Revisión de contenido y consistencia documental.

### GitHub Copilot

- Revisión de pull requests y sugerencias de código.
- Correcciones pequeñas y tareas asignadas desde issues.
- Explicación de código y generación de pruebas cuando aplique.
- En el plan Student usa selección automática de modelo; Claude puede aparecer
  mediante esa selección automática, pero no se elige manualmente.

### Persona (Liam)

- Decide el alcance del contenido y aprueba merges.
- Confirma cambios que afecten la publicación o los datos oficiales.

## 7. Cómo pedir trabajo a cada agente

Ejemplos claros:

- `@opencode implementa el issue #12 en agent/opencode/mejoras-sitio`
- `@gemini regenera data/questions_bank.json y abre un PR en agent/gemini/datos`
- `Copilot, revisa el PR #15 y señala riesgos de accesibilidad`
- `OpenCode, valida el sitio en local y comparte el resultado de Lighthouse`

Si no se especifica agente, la persona que coordina decide según el reparto de la
sección 6.

## 8. Definición de terminado (Definition of Done)

Un cambio está terminado cuando:

- Resuelve el issue o la petición concreta.
- Funciona en escritorio y en móvil.
- No introduce errores en consola.
- Mantiene o mejora accesibilidad y SEO.
- No modifica datos generados a mano.
- El PR explica qué cambió, cómo se probó y qué riesgos quedan.
- La persona responsable aprueba el merge.

## 9. Situaciones de conflicto

- **Dos agentes tocaron el mismo archivo:** gana el PR que primero se revise y
  se fusione; el otro debe actualizar su rama y resolver el conflicto.
- **Cambios en `public/` y en el repo:** primero se sincroniza `public/` desde
  `main`, luego se regenera y se publica.
- **Datos generados diferentes:** no se sobrescriben sin comparar. Abrir un
  issue con el diff y pedir revisión a Liam o a Gemini.
- **El sitio publicado no refleja el merge:** esperar 1–2 minutos, revisar la
  pestaña Actions de GitHub Pages y volver a cargar sin caché.

## 10. Configuración de agentes en esta máquina

- **OpenCode:** MCP `github` configurado globalmente en
  `C:\Users\liamc\.config\opencode\opencode.json`. Usa el token de `gh` mediante
  `launcher.mjs`; no guarda el token en el JSON.
- **Antigravity:** MCP `github` configurado en
  `C:\Users\liamc\.gemini\config\mcp_config.json`. Reiniciar Antigravity después
  de cambiar ese archivo.
- **Copilot:** se usa desde GitHub.com, VS Code o GitHub Copilot CLI. Para que
  siga este protocolo, lee `.github/copilot-instructions.md`.

## 11. Enlaces útiles

- Documentación de GitHub Pages: <https://docs.github.com/pages>
- Accesibilidad web (WCAG 2.2): <https://www.w3.org/WAI/WCAG22/quickref/>
- Lighthouse: <https://developer.chrome.com/docs/lighthouse/overview/>
- Protocolo de agentes de OpenCode: <https://opencode.ai/docs/rules/>
