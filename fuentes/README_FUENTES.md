# 🔤 Guía y Mapa de Uso de Tipografías — BiblioTech Scout
> **Fuentes Oficiales del Proyecto:** Outfit y Plus Jakarta Sans  
> **Ubicación de archivos en tu computadora:** `C:\Users\liamc\bibliotech-scouts\fuentes\`

---

## 📥 1. Archivos Disponibles en tu Computadora

### A. Paquete Comprimido ZIP
* 📦 **[Fuentes_BiblioTech_Scout.zip](file:///C:/Users/liamc/bibliotech-scouts/fuentes/Fuentes_BiblioTech_Scout.zip)** (547 KB) — Contiene todas las fuentes organizadas en carpetas.

### B. Fuentes Estáticas Individuales (Formato TrueType `.ttf`)
Ideales para instalar directamente en Windows y utilizarlas en Word, PowerPoint, Photoshop, Illustrator, Premiere, Figma o Canva Desktop:
* **Outfit (Títulos y Gran Impacto):**
  * [Outfit-SemiBold.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/Outfit-SemiBold.ttf) (Peso 600)
  * [Outfit-Bold.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/Outfit-Bold.ttf) (Peso 700)
  * [Outfit-ExtraBold.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/Outfit-ExtraBold.ttf) (Peso 800)
  * [Outfit-Black.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/Outfit-Black.ttf) (Peso 900)
* **Plus Jakarta Sans (Lectura, Párrafos y UI):**
  * [PlusJakartaSans-Regular.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/PlusJakartaSans-Regular.ttf) (Peso 400)
  * [PlusJakartaSans-Medium.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/PlusJakartaSans-Medium.ttf) (Peso 500)
  * [PlusJakartaSans-SemiBold.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/PlusJakartaSans-SemiBold.ttf) (Peso 600)
  * [PlusJakartaSans-Bold.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/PlusJakartaSans-Bold.ttf) (Peso 700)
  * [PlusJakartaSans-ExtraBold.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf/PlusJakartaSans-ExtraBold.ttf) (Peso 800)

### C. Fuentes Variables (Variable Fonts `.ttf`)
Contienen todos los pesos intermedios en un solo archivo:
* [Outfit-VariableFont_wght.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/variables_ttf/Outfit-VariableFont_wght.ttf)
* [PlusJakartaSans-VariableFont_wght.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/variables_ttf/PlusJakartaSans-VariableFont_wght.ttf)
* [PlusJakartaSans-Italic-VariableFont_wght.ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/variables_ttf/PlusJakartaSans-Italic-VariableFont_wght.ttf)

---

## ⚡ 2. Cómo instalarlas en tu Computadora (Windows)

1. Abre la carpeta en tu explorador de Windows:
   📁 **[C:\Users\liamc\bibliotech-scouts\fuentes\estaticas_ttf](file:///C:/Users/liamc/bibliotech-scouts/fuentes/estaticas_ttf)**
2. Selecciona todos los archivos `.ttf` con `Ctrl + E`.
3. Haz clic derecho y selecciona **"Instalar"** o **"Instalar para todos los usuarios"**.
4. ¡Listo! A partir de ese momento aparecerán en todos tus programas de edición, diseño y ofimática.

---

## 🗺️ 3. Mapa Detallado: ¿En qué partes del sitio se utilizó cada fuente?

### 🅰️ **Outfit** (Tipografía de Títulos, Identidad y Énfasis)
`Outfit` se aplica estratégicamente en los elementos que requieren alto impacto visual, presencia institucional y personalidad scout:

| Elemento / Sección del Sitio | Selector CSS | Peso Usado | Función Visual |
| :--- | :--- | :---: | :--- |
| **Todos los Encabezados Principales** | `h1, h2, h3, h4` | `700` - `800` | Encabezados de todas las secciones del sitio: "¿Qué quieres descubrir hoy?", "Biblioteca Oficial", "Acerca de Liam Durán", "Servicios Oficiales ASMAC", "Preguntas Frecuentes", etc. |
| **Logotipo de la Barra de Navegación** | `.brand-name` | `900` (Black) | El texto principal **BiblioTech** en la cabecera fija superior. |
| **Badge Scout de la Marca** | `.brand-badge` | `800` (ExtraBold) | La etiqueta amarilla **SCOUT** que acompaña al logotipo. |
| **Título Gigante del Hero** | `.hero-big-bibliotech` | `900` (Black) | Letras gigantes de bienvenida en la portada principal. |
| **Subtítulo de Autoría** | `.hero-tiny-byliam` | `800` (ExtraBold) | Texto de crédito "por Liam Durán" debajo del título central. |
| **Números de Contadores Vivos** | `.hero-stat dd` | `800` (ExtraBold) | Las cifras animadas de documentos, preguntas y visitas en el Hero. |
| **Botón de Búsqueda Principal** | `.ask-submit-btn` | `800` (ExtraBold) | El botón **"Consultar →"** en la barra de preguntas. |
| **Botón de Preguntas al Azar** | `.btn-shuffle-questions` | `800` (ExtraBold) | El botón **"Recargar otras al azar"** para explorar la base de conocimiento. |
| **Pies de Foto Estilo Polaroid** | `.floating-polaroid span`, `.mini-polaroid-card span`, `.mosaic-polaroid span` | `800` (ExtraBold) | Textos de las fotografías scouts de Manada, Tropa, Comunidad y Clan. |
| **Botones de Lectura de Libros** | `.book-read-btn` | `800` (ExtraBold) | Botones **"Leer documento"** o **"Abrir en visor"** en las carátulas. |
| **Botones de Acción en Hero** | `.btn-hero-primary`, `.btn-hero-ghost` | `800` (ExtraBold) | Botones principales de acceso directo en la portada. |
| **Contacto Social del Creador** | `.btn-creator-instagram` | `700` (Bold) | Botón interactivo de Instagram en la tarjeta de Liam. |
| **Insignias y Pilares de Scouts del Mundo** | `.adc-hey-heading`, `.adc-projects-headline`, `.adc-btn-portal` | `800` (ExtraBold) | Títulos y botones de los 4 pilares: Salud, Habilidades, Sustentabilidad y Paz. |
| **Tarjetas de Servicios y Estantes** | `.bts-card-title`, `.bts-card-creator` | `900` / `800` | Encabezados de SISAS, RECME, CONECTA y Tienda Scout Oficial. |

---

### 🅱️ **Plus Jakarta Sans** (Tipografía Universal de Lectura, Párrafos y UI)
`Plus Jakarta Sans` es la **fuente base del sitio**. Está declarada en la etiqueta raíz `html`:
```css
html {
  font-family: Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, sans-serif;
}
```
Esto significa que todo el contenido no asignado explícitamente a `Outfit` se renderiza con `Plus Jakarta Sans`:

| Elemento / Sección del Sitio | Elemento HTML / Clase | Peso Usado | Función Visual |
| :--- | :--- | :---: | :--- |
| **Párrafos de Lectura Corrida** | `<p>`, `.hero-sub`, `.faq-answer` | `400` (Regular) | Explicaciones largas, biografías, dedicatorias, respuestas completas en Markdown y descripciones de libros. |
| **Pastillas de Categorías Temáticas** | `.quick-chip`, `.quick-q-chip`, `#askCategoryPillsRow button` | `600` / `700` | Etiquetas interactivas de temas (Insignias, Campismo, Manada, Tropa, Estatutos, etc.). |
| **Preguntas del Banco de Búsqueda** | `.starter-q-btn`, `#starterQuestions button` | `500` / `600` | Listado de preguntas frecuentes sugeridas en el buscador. |
| **Botones del Dock Inferior Móvil** | `.bt-dock-item`, `.bt-dock-label` | `600` (SemiBold) | Textos de navegación táctil: "Inicio", "Consultar", "Biblioteca", "Agentes", "Guardados", "Noche". |
| **Buscador y Campos de Formulario** | `input`, `textarea`, `select`, `.ask-input` | `500` (Medium) | La barra donde el usuario escribe su duda y los campos de reporte de errores. |
| **Formulario de Reporte de Bugs** | `.bt-bug-form`, `.bt-bug-field`, `.bt-bug-chip` | `600` / `700` | Opciones de tipos de error (imágenes faltantes, error en PDFs, respuestas, etc.). |
| **Modales de Visores de Documentos** | `.modal-body`, `.excel-preview-container` | `400` / `500` | Textos explicativos, tablas de datos de Excel y advertencias de navegación. |
| **Páginas de Políticas y Cookies** | `#cookieConsentBanner`, `.bt-web-toast` | `500` (Medium) | Mensajes legales de privacidad, avisos de telemetría y mensajes de estado. |
