# DESIGN.md — Sistema de Diseño de BiblioTech Scout

Memoria viva del sistema visual y de interacción de **BiblioTech Scout** (Web/PWA iOS y App Android Capacitor). Toda nueva vista, componente, formulario o ajuste visual debe respetar este documento para evitar deriva estética o patrones genéricos.

---

## 1. Identidad y Principios No Negociables

1. **Identidad Scout ASMAC auténtica:** estético, cálido, editorial y práctico (línea *Scout Zine* moderna). Nunca reemplazar la identidad por plantillas genéricas grises o estética corporativa fría.
2. **Cero emojis en toda la plataforma:** prohibidos en HTML, CSS, JS, JSON, botones, badges, alertas, documentación y mensajes de error. Toda iconografía debe ser **SVG vectorial limpio** (`stroke="currentColor"`, `stroke-width="2"`, `aria-hidden="true"`).
3. **Práctico para novatos, profundo para expertos:** cada espacio muestra primero la acción más común de forma limpia y deja filtros avanzados, subcategorías, metadatos y normativa detallada accesibles en un toque (plegables o en sub-pestañas), sin saturar la pantalla inicial.
4. **Mobile-first real (390x844) y escritorio amplio (1440x900):** todo botón interactivo debe ofrecer zona táctil cómoda (`>= 40px`, ideal `44px`), sin texto recortado ni desbordamiento horizontal (`overflow-x: hidden` nunca se usa como excusa para cortar controles).
5. **Paridad Claro / Modo oscuro:** todo elemento nuevo debe definir estilos tanto para modo claro por defecto como para `html[data-camp-mode="true"]` con contraste legible (`>= 4.5:1` en texto normal y `>= 3:1` en controles). Se activa o desactiva automáticamente según `prefers-color-scheme: dark` del PC, celular o navegador y también mediante el botón manual en la cabecera (escritorio y móvil).

---

## 2. Tokens Reales de Color y Superficie (`src/styles.css`)

### Modo Claro (Base *Scout Zine*)
- **Fondo de página (`--paper` / `--bg-page`):** `#fbfaf7` (tinte cálido con gradientes radiales muy suaves)
- **Superficie elevada (`--surface` / `--bg-surface`):** `#ffffff`
- **Superficie secundaria (`--paper-2` / `--bg-subtle`):** `#f4f2ec`
- **Texto principal (`--ink` / `--text-main`):** `#101828`
- **Texto secundario (`--ink-soft` / `--text-secondary`):** `#475467`
- **Texto atenuado (`--text-muted`):** `#667085`
- **Bordes suaves / fuertes (`--line` / `--line-strong`):** `#e7e3d9` / `#d6d0c2`

### Paleta Scout y Acentos Semánticos
- **Morado Scout principal (`--violet` / `--scout-purple`):** `#6d28d9` (gradiente primario de acción: `linear-gradient(135deg, #6d28d9, #0284c7)` o `#7928ca -> #0284c7`)
- **Azul Scout (`--blue` / `--scout-blue`):** `#0ea5e9` / `#0096c7`
- **Verde (`--green`):** `#16a34a` (estados válidos, offline listo, Manada/Naturaleza)
- **Amarillo / Oro (`--yellow` / `--scout-gold`):** `#facc15` / `#ffb703` (destacados, badges `SCOUT`, Centenario)
- **Coral / Naranja (`--coral` / `--scout-orange`):** `#f97316` / `#ea580c` (avisos, Caminantes/Fogata)
- **Rojo (`--scout-red`):** `#e63946` (reportes, alertas críticas, Rover/Emergencias)

### Modo oscuro (`html[data-camp-mode="true"]`)
- **Superficies elevadas:** fondos nocturnos translúcidos violeta-pizarra (`rgba(21, 14, 44, 0.9)` / `#0f172a`)
- **Bordes:** `rgba(139, 92, 246, 0.36)` (sutiles, sin marcos blancos chillones)
- **Texto principal / secundario:** `#f8fafc` / `#cbd5e1`
- **Estado activo:** `linear-gradient(135deg, #7928ca, #0284c7)` con borde `#38bdf8` y texto `#ffffff`

---

## 3. Tipografía, Radios y Elevación

- **Títulos (`h1`–`h4`):** `'Outfit', sans-serif`, `line-height: 1.2`, `letter-spacing: -0.02em`, pesos `700–900`.
- **Cuerpo y controles:** `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`, `line-height: 1.6`.
- **Escala de radios:**
  - `--radius-sm: 12px` (inputs, botones compactos, cajones)
  - `--radius-md: 18px` (tarjetas de contenido, paneles)
  - `--radius-lg: 24px` (contenedores principales, modales)
  - `--radius-xl: 32px` (tarjetas destacadas/hero)
  - `999px` (píldoras de filtro, segmented controls, badges)
- **Curva de movimiento:** `--spring: cubic-bezier(0.22, 1, 0.36, 1)`. Respetar cambios de espacio instantáneos (`window.scrollTo({ top: 0, behavior: "instant" })`) para evitar saltos visuales en blanco.
- **Anti-patrones prohibidos:**
  - No anidar tarjetas con borde grueso y sombra dentro de otras tarjetas con borde y sombra (máximo 2 niveles de superficie).
  - No poner texto gris apagado sobre fondos con color o gradiente.
  - No duplicar botones con la misma acción en la misma pantalla ni rebotar desde otro espacio a Biblioteca si ya existe el dock/navbar.
  - No usar `overflow-x` oculto sobre controles de ancho fijo que recorten texto en `390px`.
  - No encimar elementos `position: fixed` sobre `#unifiedBottomDock`: en `<= 960px`, los flotantes (`.bt-fab` a la izquierda y `#floatingQuickBar` solo con `↑` a la derecha) van a `bottom: calc(92px + env(safe-area-inset-bottom, 0px))` sin animación vertical `translateY`, los toasts a `96px`, el banner offline a `144px` y el pie de página reserva `padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px))`.

---

## 4. Arquitectura de los 8 Espacios y Navegación

- **Espacios (`data-bt-view`):** `inicio`, `biblioteca`, `ejes`, `guia`, `agentes`, `fogata`, `formatos`, `acerca`.
- **Espacio `ejes` (`#ejes-pjos` — Los 4 Ejes Temáticos del PJOS):** sub-pestañas horizontales limpias (`1. Guía de los 4 Ejes y Actividades`, `2. Salud: A Salvo y Salida Segura`, `3. Ambiente: Misión Planeta`, `4. Paz: Bitácora MoP y Emergencias`, `5. Habilidades: Constructor SMART`) con acentos semánticos por eje (`salud` carmesí `#e11d48`, `habilidades` azul `#0284c7`, `ambiente` verde `#16a34a`, `paz` violeta `#7c3aed`) y máximo 2 niveles de superficie tanto en claro como en `html[data-camp-mode="true"]`.
- **Barra superior escritorio (`.desktop-quick-nav`):** accesos en 1 sola línea (`Inicio`, `Biblioteca`, `4 Ejes PJOS`, `Guía Scout`, `Agentes de Cambio.MX`, `La Fogata`, `Editor de Archivos`, `¿Qué es BiblioTech?`, `App / Offline`) + modo oscuro + `Menú`.
- **Dock inferior móvil (`#unifiedBottomDock`):** exactamente 5 botones equilibrados (`Inicio`, `Biblioteca`, `Fogata`, `Archivos`, `Guardados`) con `flex: 1 1 0; min-width: 0`.
- **Controles de sub-vista:**
  - Biblioteca (`#btLibraryModeBar`): segmented control corto (`Estantes (883)` / `Catálogo y Filtros`) + botón `Mis Guardados y Notas`. Paginación uniforme de **12 archivos por defecto** y carga progresiva de `+12` con botón `Cargar más archivos`. Subcategorías contraídas en `Destacados`/`Todas` y abiertas automáticamente al entrar en un estante/categoría específica (`FAES`, `Especialidades FES`, etc.).
  - Guía Scout (`#btGuideSubnav`): barra de píldoras desplazable con 6 sub-pestañas (`Todo`, `Guía de Uso`, `Secciones`, `Servicios y Trámites`, `Cambios en Esquemas`, `App y Offline`), con acordeones `<details class="bt-acc-card">` desplegados por defecto y contraíbles.

---

## 5. Estándar del Lector y Herramientas Productivas

- **Sistema unificado de controles, superficies y rendimiento baja gama (v9.7.0):**
  - Todos los `<button>`, `<input>`, `<select>` y `<textarea>` usan `Plus Jakarta Sans`; todos los títulos de sección usan `Outfit` con escala fluida única `clamp(1.72rem, 2.85vw, 2.38rem)`.
  - Botones primarios y píldoras activas usan el mismo gradiente de marca (`linear-gradient(135deg, #6d28d9 0%, #4f46e5 52%, #0284c7 100%)`), radio uniforme (`12px` botones, `999px` píldoras, `18px–20px` tarjetas, `24px` contenedores y fotografías destacadas), contornos finos `1px` y transición ligera GPU-only (`transform`, `opacity`, `background-color`, `border-color`, `box-shadow` en `0.18s cubic-bezier(0.22, 1, 0.36, 1)`).
  - **Optimización para dispositivos de baja gama sin pérdida de calidad en assets:** cero animaciones infinitas de fondo (sin cubos 3D, sin filtros SVG `feDropShadow` sobre viewBoxes gigantes, sin `backdrop-filter` pesado sobre tarjetas con scroll), `content-visibility: auto` + `contain: layout style` en cuadrículas largas y detección adaptativa `html[data-bt-perf="lite"]` (`deviceMemory <= 4`, `hardwareConcurrency <= 4`, `saveData` o `prefers-reduced-motion`).
  - **Encuadre editorial de fotografías:** marcos limpios con `border-radius: 20px–24px`, anillo interior sutil `1px`, scrim de contraste donde existe texto encima y micro-zoom `scale(1.02)` en escritorio sin recortes poligonales deformantes ni compresión de imágenes.
- **Web/iOS (`#docModal.bt-reader-v2`):**
  - Cabecera en 1 sola fila compacta con título (máximo 2 líneas), botón `Info` plegable (`#btnToggleDocInfo` con descripción, fecha RECME, ODS y etiquetas), guardado, reporte y cerrar.
  - Metadatos y etiquetas viven dentro del cajón `#modalDocInfoDrawer` (cerrado por defecto) y nunca compiten con `#modalFieldNoteBox` (cierre mutuo).
  - Barra unificada (`.bt-reader-unified-bar`) arriba en escritorio y **al pie del modal en móvil (`<= 768px`)** respetando `env(safe-area-inset-bottom)`.
  - **Visor PDF interactivo por página con streaming HTTP 206 (`.bt-pdfjs-stage` / `.pdf-quick-bar-interactive`):** para todos los PDFs pesados o alojados en GitHub Releases (`50 MB` a `300+ MB`, sin el límite de `25 MB` de Google Docs Viewer) y en navegadores móviles, renderiza cada página bajo demanda en `<canvas>` de alta definición mediante peticiones de rango (`256 KB` por bloque a través de Cloudflare Worker `v2.1`), mostrando de inmediato la portada real y controles de página (`Anterior`, `Pág. X / N`, `Siguiente`, zoom `- / 100% / +`, `Visor Nativo`, `Abrir en pestaña` y `Texto`), además de la barra de **Preguntas relacionadas con este documento** con botón `Otras preguntas`.
- **App Android nativa (`#bt-pdf-viewer`):**
  - Controles esenciales siempre a mano: volver, título, salto a página `#`, zoom, Guardar (`bt_saved_docs`), Notas (`bt_note_<id>`), Reportar y descarga/abrir externo.
  - Modo lectura inmersivo (`.is-immersive`) alternado con toque simple en el centro de la página.
- **Editor de Archivos (Espacio `formatos`):**
  - Herramienta profesional limpia 100% local y offline sobre los formatos oficiales de base (Ficha de Salud 2 hojas, Permiso JL304, Especialidades FES, Cédula SMART, Convocatoria/Programa y Acta de Consejo/MASC), con autollenado de perfil local, borradores y exportación directa a PDF/PNG/Impresión.
