# AGENTS.md — BiblioTech Scout (Web / PWA / iOS / Cloudflare Worker)

Reglas permanentes para cualquier trabajo dentro de este repositorio (`bibliotech-scouts`).

## 1. Stack y Restricciones Clave

- **Stack real:** HTML5 + CSS3 nativo (`src/styles.css` -> `styles.css`) + JavaScript Vanilla (`src/app.js` -> `app.js`) + Service Worker (`sw.js`) + datos estáticos JSON (`data/`) + Cloudflare Worker (`cloudflare-worker/worker.js`).
- **NO introducir frameworks SPA** (React, Next.js, Vue, Tailwind, etc.). El proyecto debe seguir siendo ligero, sin dependencias en runtime y 100% funcional offline en GitHub Pages y Capacitor Android.
- **CERO emojis** en todo el repositorio (código, textos, JSON, botones, comentarios visibles, README). Usar solo texto limpio e íconos SVG vectoriales.
- **Fuente vs Compilado:** editar siempre `src/styles.css` y `src/app.js`, y luego compilar con `npm run build` para regenerar `styles.css` y `app.js` en la raíz. Nunca editar solo los archivos minificados/compilados de raíz.
- **Sparse-checkout activo:** antes de crear carpetas nuevas en la raíz del repo, revisar `.git/info/sparse-checkout`. Los archivos `.md` en raíz y todo lo bajo `/src/**`, `/data/*`, `/scripts`, `/cloudflare-worker/**` ya están incluidos. Verificar siempre antes de cada commit que `git ls-files files` conserve exactamente los `682` archivos rastreados (`0` eliminaciones en `files/`).

## 2. Sistema de Diseño y Persistencia

- Leer `DESIGN.md` antes de cualquier cambio de interfaz, estilos o nuevos módulos (incluyendo el Editor de Archivos).
- Mantener las claves de almacenamiento local y cookies estables:
  - Guardados/favoritos: `bt_saved_docs`
  - Notas por documento: `bt_note_<docId>`
  - Puente con App Android: `window.__btSavedBridge` (`getSavedPins`, `toggleSavedPin`, `getDocNote`, `setDocNote`)
  - Esquema de versión/cookies: `APP_WEB_VERSION`, `APP_MOBILE_VERSION`, `APP_COOKIE_SCHEMA`, `WEB_OFFLINE_CACHE` sincronizados entre `src/app.js`, `version.json`, `sw.js`, `package.json` y `index.html`.
- Al cambiar entre los 7 Espacios (`btSwitchView`: `inicio`, `biblioteca`, `guia`, `agentes`, `fogata`, `formatos`, `acerca`), usar `window.scrollTo({ top: 0, behavior: "instant" })` para evitar desplazamientos incompletos.

## 3. Verificación Obligatoria Antes de Publicar

1. `npm run build`
2. `npm run check`
3. `npm run validate`
4. `py -3.11 scripts/smoke_e2e.py --webkit` (debe terminar en `SMOKE_E2E_OK` con `errors: 0` y `telemetry_leaks: 0`)
5. Verificar `0` emojis en archivos modificados.
6. En cambios visuales relevantes, validar capturas en escritorio (`1440x900`) y móvil (`390x844`) en modo claro y modo oscuro (`html[data-camp-mode="true"]`).
7. **Orden de release:** hacer `git commit` + `git push origin main` aquí **primero**, y solo después ejecutar `npm run sync` en `../bibliotech-scouts-app` para que `www/app-build.json` registre el commit `HEAD` real.

## 4. Skills Especializadas del Proyecto

Consultar las skills globales `bibliotech-*` según la tarea:
- `bibliotech-design-craft`: diseño UI, auditoría visual, contraste, móvil, baja gama y pulido.
- `bibliotech-engineering-workflow`: planeación ligera, rendimiento Vanilla JS, depuración y release dual.
- `bibliotech-resilience-offline`: manejo de errores, modo offline, visor streaming de PDFs pesados, Service Worker y Cloudflare Worker KV.
- `bibliotech-forms-engine`: arquitectura, privacidad local y exportación del Editor de Archivos.
