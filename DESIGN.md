# DESIGN.md — Sistema de Diseño de BiblioTech Scout

Memoria viva del sistema visual y de interacción de **BiblioTech Scout** (Web/PWA iOS y App Android Capacitor). Toda nueva vista, componente, formulario o ajuste visual debe respetar este documento para evitar deriva estética o patrones genéricos.

---

## 1. Identidad y Principios No Negociables

1. **Identidad Scout ASMAC auténtica:** estético, cálido, editorial y práctico (línea *Scout Zine* moderna). Nunca reemplazar la identidad por plantillas genéricas grises o estética corporativa fría.
2. **Cero emojis en toda la plataforma:** prohibidos en HTML, CSS, JS, JSON, botones, badges, alertas, documentación y mensajes de error. Toda iconografía debe ser **SVG vectorial limpio** (`stroke="currentColor"`, `stroke-width="2"`, `aria-hidden="true"`).
3. **Práctico para novatos, profundo para expertos:** cada espacio muestra primero la acción más común de forma limpia y deja filtros avanzados, subcategorías, metadatos y normativa detallada accesibles en un toque (plegables o en sub-pestañas), sin saturar la pantalla inicial.
4. **Mobile-first real (390x844) y escritorio amplio (1440x900):** todo botón interactivo debe ofrecer zona táctil cómoda (`>= 40px`, ideal `44px`), sin texto recortado ni desbordamiento horizontal (`overflow-x: hidden` nunca se usa como excusa para cortar controles).
5. **Paridad Claro / Modo Campamento (Oscuro):** todo elemento nuevo debe definir estilos tanto para modo claro por defecto como para `html[data-camp-mode="true"]` con contraste legible (`>= 4.5:1` en texto normal y `>= 3:1` en controles).

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

### Modo Campamento / Oscuro (`html[data-camp-mode="true"]`)
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

## 4. Arquitectura de los 5 Espacios y Navegación

- **Espacios (`data-bt-view`):** `inicio`, `biblioteca`, `guia`, `fogata`, `formatos`.
- **Barra superior escritorio (`.desktop-quick-nav`):** exactamente 6 accesos (`Inicio`, `Biblioteca`, `Guía Scout`, `La Fogata`, `Formatos`, `App / Offline`) + modo campamento + `Menú`.
- **Dock inferior móvil (`#unifiedBottomDock`):** exactamente 5 botones equilibrados (`Inicio`, `Biblioteca`, `Fogata`, `Formatos`, `Guardados`) con `flex: 1 1 0; min-width: 0`.
- **Controles de sub-vista:**
  - Biblioteca (`#btLibraryModeBar`): segmented control corto (`Estantes (599)` / `Catálogo y Filtros`) + botón `Mis Guardados y Notas`.
  - Guía Scout (`#btGuideSubnav`): barra de píldoras desplazable con 8 sub-pestañas (`Todo`, `Guía de Uso`, `Secciones`, `Agentes de Cambio.MX`, `Servicios y Trámites`, `Cambios en Esquemas`, `¿Qué es BiblioTech?`, `App y Offline`).

---

## 5. Estándar del Lector y Herramientas Productivas

- **Web/iOS (`#docModal.bt-reader-v2`):**
  - Cabecera en 1 sola fila compacta con título (máximo 2 líneas), botón `Info` plegable (`#btnToggleDocInfo`), guardado, reporte y cerrar.
  - Metadatos y etiquetas viven dentro del cajón `#modalDocInfoDrawer` (cerrado por defecto) y nunca compiten con `#modalFieldNoteBox` (cierre mutuo).
  - Barra unificada (`.bt-reader-unified-bar`) arriba en escritorio y **al pie del modal en móvil (`<= 768px`)** respetando `env(safe-area-inset-bottom)`.
- **App Android nativa (`#bt-pdf-viewer`):**
  - Controles esenciales siempre a mano: volver, título, salto a página `#`, zoom, Guardar (`bt_saved_docs`), Notas (`bt_note_<id>`), Reportar y descarga/abrir externo.
  - Modo lectura inmersivo (`.is-immersive`) alternado con toque simple en el centro de la página.
- **Editor Inteligente de Formatos (Espacio `formatos`):**
  - Seguir estética de herramienta profesional limpia: barra de estado de perfil local (autorelleno), formulario estructurado por pasos o bloques claros, vista previa fiel del documento y exportación/impresión en un clic, funcionando 100% offline.
