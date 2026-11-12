# 🛠️ Ecosistema Tecnológico y Herramientas — BiblioTech Scout
> **Autor:** Liam Durán  
> **Proyecto:** BiblioTech Scout (Plataforma Web, PWA & App Android)  
> **Versiones:** Web v8.4.4 / Android v2.3.4 (Build 30)

Este documento detalla todas las herramientas, lenguajes de programación, librerías, servicios en la nube, APIs y tipografías que componen la infraestructura de **BiblioTech Scout**, explicando con precisión la función técnica que cumple cada una dentro de la solución.

---

## 🔤 1. Tipografías y Fuentes Visuales

| Fuente / Tipografía | Tipo / Origen | Función en el Proyecto |
| :--- | :--- | :--- |
| **Outfit** | Google Fonts (`wght@600..900`) | **Tipografía de Títulos e Identidad:** Empleada en encabezados principales (`h1`, `h2`, `h3`, `h4`), el logotipo central *BiblioTech SCOUT*, números de contadores vivos y tarjetas destacadas. Aporta un corte geométrico moderno, limpio y con fuerte carácter institucional scout. |
| **Plus Jakarta Sans** | Google Fonts (`wght@400..800`) | **Tipografía de Lectura y UI:** Fuente principal de todo el cuerpo de texto, párrafos explicativos, pastillas de categorías, botones, modales, formularios y respuestas del buscador. Diseñada ergonómicamente para máxima legibilidad en pantallas móviles (Retina, AMOLED). |
| **System Fonts Fallback** | Local OS (`-apple-system`, `BlinkMacSystemFont`, `sans-serif`) | **Respaldo de Rendimiento:** En caso de conexión lenta o modo offline, garantiza que el navegador dibuje el texto instantáneamente con la tipografía nativa de Apple (San Francisco), Android (Roboto) o Windows (Segoe UI) sin saltos visuales (*FOIT*). |

---

## 📚 2. Fuentes de Contenido y Datos Oficiales

| Fuente Institucional | Entidad / Organización | Contenido Aportado |
| :--- | :--- | :--- |
| **ASMAC** | Asociación de Scouts de México, A.C. | Manuales de progresión (Manada, Tropa, Comunidad, Clan), esquema nacional de reconocimientos, estatutos, lineamientos de seguridad en campamentos, censos nacionales y directivas oficiales. |
| **WOSM** | Organización Mundial del Movimiento Scout | Programa Scouts del Mundo (Insignia del Medio Ambiente, Mensajeros de la Paz, Marco de Salud y Bienestar), historia del escultismo mundial e insignias internacionales. |
| **Documentos del Centenario** | Fondos Históricos y Especiales | Documentos conmemorativos, normativas técnicas, cancioneros scout, ceremonias y tradiciones históricas. |

---

## 💻 3. Frontend Web & Progressive Web App (PWA)

| Herramienta / Tecnología | Rol Técnico | Función Específica |
| :--- | :--- | :--- |
| **HTML5 Semántico** | Estructura base | Maquetado accesible (`<header>`, `<main>`, `<section>`, `<article>`, `<nav>`, `<footer>`) con soporte de accesibilidad web (WCAG 2.1), skip-links para lectores de pantalla y metaetiquetas Open Graph / Twitter Cards para compartir en redes. |
| **CSS3 Avanzado** | Diseño y Estilos | - **Variables Nativas (Design Tokens):** Paleta institucional (azul scout `#0096c7`, morado flor de lis `#6d28d9`, dorado sol `#ffb703`, fondo nocturno `#0b1536`).<br>- **Glassmorphism:** Efectos de desenfoque translúcido (`backdrop-filter: blur(18px)`).<br>- **Camp-Mode (Modo Noche):** Tema cósmico nocturno activado con el atributo `data-camp-mode="true"` para reducir deslumbramiento y consumo de batería en campamentos.<br>- **Hexágonos Clip-Path:** Recorte poligonal nativo (`polygon(...)`) y animaciones a 60 FPS sin ralentizar la GPU. |
| **JavaScript ES6+ (Vanilla)** | Lógica de Cliente | Programación pura sin sobrecarga de frameworks (React, Angular o Vue). Permite que la web pese menos de 1 MB y cargue en milisegundos. Controla el buscador de preguntas instantáneo, modales, acordeones, filtrado por secciones y renderizado dinámico del catálogo. |
| **Service Worker (`sw.js`)** | Motor PWA Offline | Intercepta peticiones de red y gestiona la caché local del navegador con estrategias *Cache-First* y *Stale-While-Revalidate*. Permite abrir BiblioTech Scout en el celular incluso sin señal en el bosque o campo. |
| **Web App Manifest (`manifest.webmanifest`)** | Identidad PWA | Configura la aplicación para ser instalable en iOS y Android como app independiente (`display: standalone`), con iconos adaptativos y color de barra de estado personalizado. |
| **Panel iOS Offline** | Utilidad Nativa Web | Módulo interactivo desarrollado en JavaScript que permite a usuarios de iPhone descargar y verificar los paquetes documentales en la caché del navegador para uso fuera de línea. |

---

## 📄 4. Visores de Documentos y Ofimática

| Componente | Proveedor / Tecnología | Función en la Plataforma |
| :--- | :--- | :--- |
| **Google Docs Viewer** | Google (`docs.google.com/viewer`) | Permite previsualizar PDFs, documentos de Word y diapositivas directamente dentro del navegador sin forzar la descarga en celulares que no cuentan con lector de PDF externo instalado. |
| **Visor Nativo de PDF** | Navegador (`<iframe>` / `<object>`) | Renderizado de alta definición para computadoras de escritorio y tablets que disponen del visor integrado de Chromium / WebKit. |
| **SheetJS / xlsx.js** | Librería Open Source (`xlsx.full.min.js`) | Motor JavaScript que lee, procesa y renderiza hojas de cálculo de Excel (`.xlsx`, `.xls`, `.csv`) directamente en tablas HTML dinámicas en el navegador, sin enviar el archivo a ningún servidor externo. |
| **Sistema Multicapa Fallback** | Lógica interna JS | Si un visor falla por restricciones del navegador o bloqueos CORS, activa automáticamente botones alternativos de descarga directa y apertura en visor secundario. |

---

## 📱 5. Capa Móvil Android (Compilación en APK)

| Herramienta | Versión / Entorno | Función en la Construcción del APK |
| :--- | :--- | :--- |
| **Java 17 / OpenJDK** | Runtime & SDK | Lenguaje nativo de la capa Android (`MainActivity.java`) que orquesta el ciclo de vida de la aplicación, el splash screen institucional y la conexión con el motor web. |
| **Android SDK (API 34 / Android 14)** | Google Android Tools | Herramientas de desarrollo nativo (`minSdkVersion 24`, `targetSdkVersion 34`) compatibles con más del 95% de los teléfonos Android en circulación. |
| **Gradle & Gradle Wrapper (`gradlew`)** | Sistema de Compilación | Automatizador de tareas que procesa el código fuente, optimiza recursos, genera los manifiestos binarios y compila el paquete ejecutable final (`bibliotech-scout.apk`). |
| **Android WebView (`android.webkit.WebView`)** | Chromium Embebido | Motor de renderizado interno de alto rendimiento con aceleración gráfica por hardware (`hardwareAccelerated="true"`), soporte de caché local `LOAD_DEFAULT` y puente de comunicación JavaScript-Java. |
| **Verificación SHA-256** | Criptografía Java | Algoritmo nativo de hashing en Java que valida la integridad de los datos descargados para asegurar que ningún archivo haya sido modificado o dañado durante la transferencia. |
| **Keytool & Jarsigner** | Java Security Tools | Utilidades criptográficas para generar el keystore oficial de firmado digital y firmar el APK en modo Release, permitiendo su instalación segura sin alertas de archivo corrupto. |

---

## ☁️ 6. Servicios en la Nube, Hosting e Infraestructura

| Servicio Cloud | Plataforma | Función que Cumple |
| :--- | :--- | :--- |
| **GitHub Pages** | GitHub | Servidor de alojamiento web estático de alta disponibilidad. Entrega el sitio web con compresión Gzip/Brotli, conexión segura HTTPS mediante certificados SSL/TLS automáticos y CDN global sin costo. |
| **GitHub Releases** | GitHub | Plataforma de almacenamiento binario donde se distribuyen públicamente las versiones compiladas de la aplicación móvil (`bibliotech-scout.apk`) y sus checksums criptográficos (`.sha256`). |
| **Cloudflare Workers** | Cloudflare Serverless (`workers.dev`) | Microservicio serverless en el edge (`bibliotech-telemetry.liamchuchundra1.workers.dev`) encargado de: <br>1. Recibir telemetría y métricas operativas de la app (búsquedas, aperturas de documentos, clics en servicios).<br>2. Proteger la privacidad de los scouts mediante anonimización de IPs.<br>3. Servir de proxy seguro con cabeceras CORS (`Access-Control-Allow-Origin: *`).<br>4. Monitorear logs de salud del sistema mediante Cloudflare Observability a costo $0. |
| **FormSubmit** | `formsubmit.co` | Endpoint de mensajería seguro sin necesidad de base de datos. Recibe los reportes del formulario de bugs y sugerencias de los usuarios, adjunta datos técnicos de diagnóstico (versión, navegador, pantalla) y los envía instantáneamente a tu correo de soporte. |
| **Cloudflare Observability** | Cloudflare Dashboard | Panel analítico en tiempo real donde puedes visualizar gráficas de peticiones, códigos de estado HTTP (200, 404, 500) y tiempos de respuesta de la telemetría en milisegundos. |

---

## 🐍 7. Automatización, Datos y Pruebas (Python & Node.js)

| Herramienta / Script | Tecnología | Función Técnica |
| :--- | :--- | :--- |
| **`scripts/build_data.py`** | Python 3.11 | Procesa las fuentes de datos scouts, extrae metadatos de documentos, sanitiza nombres de archivo e indexa el banco de preguntas frecuentes (`data/faq_v4.json` y `data/catalog.json`). |
| **`scripts/smoke_e2e.py`** | Python 3.11 (HTTP Client) | Suite de pruebas End-to-End (E2E) que simula el entorno de producción, verifica que no existan enlaces rotos (404), comprueba que todas las portadas existan y certifica las versiones antes de publicar. |
| **`scripts/record_ios_clips.py`** | Python 3.11 + Playwright | Script automatizado que levanta un servidor de pruebas local, abre la interfaz móvil de iOS, ejecuta interacciones táctiles y captura los 6 clips de video promocionales a 60 FPS. |
| **Playwright** | Node.js / Python API | Automatizador de navegador Chromium Headless que simula con precisión nanométrica el viewport táctil de un iPhone (`393x852`), grabando la pantalla a 60 cuadros por segundo. |
| **FFmpeg** | `AutoSubs\ffmpeg.exe` | Motor multimedia utilizado para:<br>1. Escalar clips con algoritmo `lanczos` a resolución vertical iPhone (`1080x2340`) y estándar (`1080x1920`).<br>2. Codificar en formato H.264 (`yuv420p`, CRF 18) a 60 FPS con `-movflags +faststart`.<br>3. Extraer miniaturas oficiales en formato PNG de alta fidelidad. |
| **Git** | Git SCM | Control de versiones distribuido para rastrear cada cambio, administrar ramas y coordinar despliegues automatizados hacia GitHub. |

---

## 🎯 Resumen de Arquitectura

```
                        ┌───────────────────────────────┐
                        │   Usuario (Web / iOS / Android)│
                        └───────────────┬───────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
  │   GitHub Pages   │        │ Cloudflare Edge  │        │   FormSubmit API │
  │ (HTML/CSS/JS/SW) │        │ (Workers Telemetry)│      │  (Reporte Bugs)  │
  └────────┬─────────┘        └────────┬─────────┘        └────────┬─────────┘
           │                           │                           │
           ▼                           ▼                           ▼
  PWA Offline Cache            Cloudflare Logs             Correo de Soporte
  + Visores Docs/Sheets        (Observability)             (Bandeja Entrada)
```
