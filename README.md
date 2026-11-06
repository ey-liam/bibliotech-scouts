# BiblioTech Scout — Biblioteca Digital y Buscador Documental Scout

**Creador:** Liam Durán - Provincia TLXH  
**Fuentes documentales:** Asociación de Scouts de México, A.C. (ASMAC) y World Scouting (WOSM)  
**Base de datos:** 03/11/2026 • **Versión del sitio web:** V4 Beta (05/11/2026)  
**Sitio web público:** https://ey-liam.github.io/bibliotech-scouts/

---

## 1. Propósito del proyecto

**BiblioTech Scout** es una plataforma web pública, personal y sin fines de lucro diseñada para que niñas, niños, adolescentes, jóvenes y adultos de toda la membresía cuenten con acceso directo, ágil y de fácil comprensión a la documentación oficial de la **Asociación de Scouts de México, A.C. (ASMAC)** y de **World Scouting (WOSM)**.

Todas las respuestas y resúmenes se fundamentan exclusivamente en los documentos oficiales, manuales, reglamentos, libros de la Colección Biblioteca del Centenario, revistas, formatos editables, comunicados nacionales y portales institucionales respaldados en la base de datos local (con corte al **03/11/2026**), priorizando siempre las ediciones vigentes (2024–2026).

---

## 2. Identidad e interfaz

- **Nombre del sitio:** BiblioTech Scout: By Liam.
- **Menú superior:** sigue el orden real de las secciones de la página: *Preguntar → Biblioteca → Propósito → Agentes de Cambio → Secciones → Evolución → Catálogo*.
- **Fondo animado:** una capa viva con malla de auras de color, orbes flotantes, haz de luz diagonal, hexágonos, cubos, anillos y destellos. Solo anima `transform` y `opacity` para no alterar el diseño ni el rendimiento.
- **Secciones translúcidas:** dejan ver la aurora de fondo sin sacrificar la legibilidad; las tarjetas de contenido permanecen blancas.
- **Accesibilidad:** con `prefers-reduced-motion` activo, todas las animaciones se detienen. El sitio conserva navegación por teclado, enlace para saltar al contenido y etiquetas ARIA.

---

## 3. Contenido del acervo documental

El sistema integra **104 temas enciclopédicos y literarios**, **5,412 preguntas y respuestas únicas de consulta directa** (desde preguntas básicas de iniciación hasta preguntas específicas por artículo, capítulo y página de cada libro, manual, guía y reglamento) y **498 documentos oficiales descargables** organizados en 8 categorías:

1. **Colección Biblioteca del Centenario (39 volúmenes):** Los 39 libros oficiales numerados de la Colección Biblioteca del Centenario, incluyendo las obras clásicas de Robert Baden-Powell (*Escultismo para Muchachos, Manual de Lobatos, Guía para el Jefe de Tropa, Roverismo hacia el Éxito, Tropiezos de la Vida, Juegos Scouts*), obras históricas de Gilcraft y César Macazaga Ordoño, y publicaciones formativas y literarias (*Cuentos de la Selva, Francisco de Asís y el Lobo de Gubbio*).
2. **Guías, Carnets y Programa de Jóvenes — PJOS (42 documentos):** Guías de sección actualizadas (*Mis Rastros en la Selva 2024, Pistas de Aventura 2024, El Desafío de ser Caminante 2024, Las Rutas del Rover, Las Rutas de la Precursora*), Carnets de *Aventuras en la Naturaleza 2024*, Guías de *Punta de Flecha 2025*, *Tribu de la Tierra*, *Campeones de la Naturaleza*, *Mensajeros de la Paz*, *Go Solar*, *Plastic Tide Turners*, *De FOROS a CASA* y *Agentes de Cambio.MX*.
3. **Manuales Oficiales y de Operación (70 documentos):** Incluye el *Manual del Uniforme Actualizado Junio 2026* (107 páginas), el *Manual ExplorApp* (septiembre de 2026), el *Manual del Pie Tierno*, el *Manual Scout de Honores a la Bandera Nacional*, el *Manual Scout de Primeros Auxilios*, el *Manual de Apertura y Cierre de Grupo 2023* y los manuales de administración de grupo, provincia y gestión de adultos.
4. **Reglamentos, Estatutos y Políticas (24 documentos):** *Estatutos 2023*, *Reglamento 2023*, *Código de Conducta 2025*, *Reglamento de la Corte Nacional de Honor (CNH) 2025*, *Política Nacional A Salvo del Peligro (SFH) 2024*, *Política Nacional de Diversidad, Equidad e Inclusión 2024*, *Política Nacional de Adultos en el Movimiento Scout (AMS) 2024* y *Política Nacional sobre Bullying*.
5. **Convocatorias y Comunicados Nacionales (187 documentos):** Comunicados oficiales de la Jefatura Scout Nacional (`JSN`), Dirección Nacional de Métodos Educativos (`DNME`) y Comisión Nacional de Programa de Jóvenes (`CNPJ`) sobre la aplicación del esquema *PJOS 2026*, reglas de transición y combinación de insignias con el *ENPE* (`JSN 25.051`, `DNME-CNPJ 25.024`), conteo exacto de insignias por sección (`DNME 26.003–26.017`), *ExplorApp y CarpetApp* (`DNME-CNPJ 26.014`), cuotas nacionales 2026 (`JSN 25.136`), *EEAS 2026*, *Philia 2026* y eventos internacionales (*26° Jamboree Scout Mundial Polonia 2027* y *17° World Scout Moot Taiwán 2029*).
6. **Revistas Foro Joven y Boletines (44 documentos):** Colección de ediciones de la revista oficial *Foro Joven* y boletines informativos.
7. **Formatos, Actas y Seguro Scout (66 documentos):** Plantillas editables en Word (`.docx`) y Excel (`.xlsx`), actas de *Diálogo Directo* (`DD.prov.2026.01`), *Mediación Asociativa* (`MED.prov.2026.01`), *Arbitraje* (`AR.2026.PROV.01`), fichas médicas y formatos de aviso de accidente y reembolso de la póliza de Seguro Scout.
8. **Identidad Gráfica y Recursos Visuales (26 documentos):** Manuales de identidad gráfica institucional, lineamientos de uso de marca del Centenario Scout en México (1926–2026) y recursos visuales por sección.

Adicionalmente, el portal incorpora la información estructurada de las páginas oficiales de la ASMAC sobre el **Directorio Nacional y Órganos de Gobierno** (Jefe Scout Nacional, Presidente Nacional, Subcomisiones Nacionales de Sección, Dirección Internacional y Presidentes de Provincia), la **Tienda Scout Nacional en Línea** (`https://tiendaenlinea.scouts.org.mx`), la sede física en Córdoba 73 (Col. Roma Norte, CDMX), los Distribuidores Nacionales Autorizados, el sistema **SISAS**, el **Centro de Capacitación Digital (CDC)**, el **Fondo Scout Nacional**, **Servicio Social**, **Descuento Scout**, **Pago a Plazos**, **Office 365** y el canal **CONECTA**.

---

## 4. Cómo utilizar BiblioTech Scout en el sitio web público

1. Ingresa a `https://ey-liam.github.io/bibliotech-scouts/`.
2. En el **Buscador Principal**, escribe cualquier pregunta en lenguaje natural o selecciona una sección específica (*Manada, Tropa, Comunidad, Clan, Adultos o World Scouting*).
3. Revisa la respuesta obtenida de los documentos oficiales y, en la parte inferior del recuadro (`Documentos oficiales de donde se obtuvo esta información`), haz clic sobre cualquiera de las fuentes citadas para abrir el lector en la página correspondiente o descargar el archivo original.
4. En el apartado **Biblioteca Scout**, utiliza la barra de búsqueda y el selector de sección (*Manada, Tropa, Comunidad, Clan, Adultos, Nacional o World Scouting*) o selecciona cualquiera de los estantes temáticos (incluyendo los **39 libros de la Colección Biblioteca del Centenario**) para leer los documentos página por página dentro del navegador.
5. En el apartado **Catálogo Organizado por Categorías**, filtra por categoría, sección, formato (`PDF`, `DOCX`, `XLSX`, `IMAGE`) o año de publicación.
6. Usa el menú superior para saltar entre secciones; el enlace activo se resalta automáticamente según el punto de la página en el que te encuentres.

---

## 5. Aportes de documentos y reporte de temas faltantes

Cuando una consulta no cuenta con información suficiente dentro de los archivos respaldados, el sistema lo indica de manera transparente sin inventar datos.

> **Estado del proyecto (Fase Beta):** BiblioTech Scout se encuentra actualmente en **versión Beta**, por lo que podría contener detalles o errores imprevistos. Si detectas alguna falla, inconsistencia o deseas sugerir mejoras y aportar documentos oficiales, tu retroalimentación es muy valiosa a través del canal de contacto.

Para aportar nuevos documentos, convocatorias, plantillas, actividades de progresión o reportar algún tema (issue) para su próxima incorporación, puedes escribir al correo:

- **Correo de contacto y aportes:** `rdc.tlxh@gmail.com`

---

## 6. Aviso de proyecto independiente y propiedad intelectual

**BiblioTech Scout** es un proyecto personal independiente y sin fines de lucro desarrollado con fines exclusivamente educativos, informativos y de consulta para la membresía. No cuenta con afiliación institucional, comercial ni representación oficial directa de la **Asociación de Scouts de México, A.C. (ASMAC)** ni de la **Organización Mundial del Movimiento Scout (WOSM / World Scouting)**. Todos los manuales, reglamentos, libros, logotipos, insignias, comunicados y documentos oficiales citados o recopilados pertenecen a sus respectivos titulares oficiales.

---

## 7. Cómo colaborar y trabajar con agentes de IA

El repositorio está preparado para que varias personas y agentes trabajen sin pisarse:

- **`AGENTS.md`**: protocolo completo de ramas, validación, publicación y reparto de trabajo.
- **`GEMINI.md`**: instrucciones específicas para Antigravity / Gemini.
- **`.github/copilot-instructions.md`**: instrucciones que lee GitHub Copilot.
- **`.github/ISSUE_TEMPLATE/`**: plantillas para reportar errores, proponer mejoras o pedir una tarea a un agente.
- **`.github/PULL_REQUEST_TEMPLATE.md`**: lista de comprobación para cada pull request.

Regla principal: **una tarea = una rama = un pull request**. Los datos de `data/` se generan con scripts y no se editan a mano. Antes de volver a publicar desde Antigravity, hay que sincronizar `public/` con los archivos actuales de `main` para no revertir mejoras del sitio.

---

## 8. Novedades de la versión V4 Beta (05/11/2026)

- **Filtro estricto de sección en el buscador:** al seleccionar una sección (como *Comunidad*), el autocompletado en vivo y las preguntas relacionadas bajo cada respuesta se restringen o priorizan a esa sección específica, evitando que aparezcan preguntas o sugerencias de otras secciones (como *Tropa* o *Manada*).
- **Sincronización instantánea de pestañas temáticas:** al hacer clic en las pastillas de sección del buscador (*Manada, Tropa, Comunidad, Clan, Adultos, World Scouting*), el explorador dinámico de preguntas cambia en tiempo real a las preguntas de esa sección.
- **Títulos descriptivos para infografías de membresía (Issue #12):** los archivos de imagen previamente titulados `WhatsApp-Image` ahora cuentan con títulos oficiales e informativos sobre insignias de sección, progresión y requisitos de membresía nacional ASMAC.
- **Apertura de documentos en pestaña nueva sin descarga forzada:** el botón «Abrir en pestaña» ahora abre un visor web limpio para imágenes y visualización adecuada para documentos PDF, evitando que GitHub Releases obligue al navegador a descargarlos.
- **Modo de lectura optimizado y navegación fluida:** al abrir cualquier documento, el lector inicia siempre en la pestaña principal de lectura y bloquea el desplazamiento del fondo mientras el modal permanece activo.
- **Buscador más claro:** al elegir una pregunta sugerida, la barra de búsqueda ya no se llena automáticamente; la consulta queda visible en el panel de respuesta y el buscador queda despejado para seguir navegando.
- **Aviso visible de versión Beta:** incorporación de nota informativa en el bloque de aportes invitando a la membresía a reportar incidencias y compartir retroalimentación.
- **Botón «Nueva búsqueda»** en el panel de respuesta para limpiar la barra, cerrar la respuesta y volver al buscador.
- **Filtros de la biblioteca juntos:** los estantes por categoría están junto al buscador y los selectores, antes del banner del Centenario. Al elegir un estante, el foco y la vista pasan a los resultados.
- **Vista previa de imágenes:** el lector muestra las imágenes remotas (PNG, JPG, WEBP y AVIF) en la pestaña de vista previa, aunque el archivo original se sirva como descarga. Cada imagen abre en esa pestaña con el título del documento y el nombre del archivo visibles.
- **Pantalla completa del lector:** la barra de acciones (anterior, siguiente, abrir en pestaña, descargar y cerrar) permanece visible. Escape sale del modo o cierra el lector, y el fondo no se desplaza.
- **Rueda del mouse:** siempre desplaza el documento abierto, incluso con el cursor sobre el encabezado, las pestañas o el fondo del modal, y también sin pantalla completa.
- **Cambio de lectura:** al alternar entre «Lectura del Documento» y «Texto Extraído / Lectura Rápida», la vista empieza arriba y la rueda funciona de inmediato.
- **Accesibilidad y rendimiento:** Lighthouse en 100 de accesibilidad, buenas prácticas y SEO; sin errores propios en consola.
- El contador del sitio se mantiene en **5,412 preguntas y respuestas**.

### Versión V3 (04/11/2026)

- Menú superior reordenado según el recorrido real de la página.
- Nuevo fondo aurora animado con auras, orbes, haz de luz, hexágonos, cubos, anillos y destellos.
- Secciones translúcidas para integrar el fondo sin perder legibilidad.
- Corrección del desplazamiento acumulado (CLS) al cargar: el fondo ahora no mueve el contenido.
- **Banner de la Colección Biblioteca del Centenario:** el título usa texto blanco con sombra suave para garantizar contraste sobre el fondo oscuro, y el logo conserva su proporción real (320×131 px) en un marco rectangular, sin espacios blancos desperdiciados.
- **Banco ampliado de preguntas frecuentes:** 56 nuevas respuestas fundamentadas, generadas con `scripts/build_faq_v3.js` a partir de `scripts/faq_v3_source.js` y publicadas en `data/faq_v3.json`. Cubren primeros auxilios y seguridad (16), campismo y naturaleza (18), ceremonial y símbolos (10), historia del escultismo mexicano (5), uniforme (4) y protección juvenil (3). El buscador carga ambos bancos en paralelo y elimina duplicados.
- **Nueva pestaña «Primeros Auxilios y Seguridad»** en el explorador de preguntas, con chips destacados para atragantamiento, purificación de agua y la Política Nacional A Salvo del Peligro.
- El contador del sitio y el README se actualizaron a **5,412 preguntas y respuestas**.

### Pendientes conocidos

- **«Abrir en pestaña» en archivos alojados solo en el release:** el servidor entrega esos archivos con `Content-Disposition: attachment`, por lo que el navegador los descarga en lugar de mostrarlos. La solución definitiva es publicar copias web en `files/`; se sigue en el issue #12.
- **Portadas `WhatsApp-Image` de Identidad Gráfica:** 7 registros siguen pendientes de reemplazo por contenido documental útil; también se siguen en el issue #12.
