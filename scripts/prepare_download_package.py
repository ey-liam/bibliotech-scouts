"""
Script para empaquetar y entregar todos los archivos de BiblioTech Scout en la computadora del usuario.
Genera formatos HTML (para abrir en navegador/imprimir a PDF), TXT (para bloc de notas), MD y organiza los videos a 60 FPS.
"""
import shutil
import zipfile
from pathlib import Path

ROOT = Path(r"C:\Users\liamc\bibliotech-scouts")
DOWNLOADS = Path(r"C:\Users\liamc\Downloads")
PACKAGE_DIR = DOWNLOADS / "BiblioTech_Scout_Archivos"

DOCS_DIR = PACKAGE_DIR / "01_Documentacion"
IPHONE_DIR = PACKAGE_DIR / "02_Videos_iPhone_Mockup_1080x2340"
SOCIAL_DIR = PACKAGE_DIR / "03_Videos_Redes_Sociales_1080x1920"
THUMBS_DIR = PACKAGE_DIR / "04_Miniaturas_PNG"

for d in [DOCS_DIR, IPHONE_DIR, SOCIAL_DIR, THUMBS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# 1. Leer Markdown original
md_path = ROOT / "HERRAMIENTAS_Y_TECNOLOGIAS.md"
md_content = md_path.read_text(encoding="utf-8")

# 2. Generar versión HTML moderna
html_template = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ecosistema Tecnológico y Herramientas — BiblioTech Scout</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {{
      --scout-navy: #0b1536;
      --scout-blue: #0096c7;
      --scout-purple: #6d28d9;
      --scout-gold: #ffb703;
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #475569;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.65;
      padding: 2.5rem 1.5rem;
    }}
    .container {{
      max-width: 1040px;
      margin: 0 auto;
      background: var(--surface);
      padding: 3rem 3.5rem;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(11, 21, 54, 0.08);
      border: 1px solid var(--border);
    }}
    .badge {{
      display: inline-block;
      background: linear-gradient(135deg, #6d28d9, #0096c7);
      color: #fff;
      font-size: 0.8rem;
      font-weight: 800;
      padding: 0.3rem 0.8rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }}
    h1 {{
      font-family: 'Outfit', sans-serif;
      font-size: 2.3rem;
      color: var(--scout-navy);
      margin-bottom: 0.5rem;
      line-height: 1.2;
    }}
    .meta {{
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 2rem;
      padding-bottom: 1.2rem;
      border-bottom: 2px solid var(--border);
    }}
    h2 {{
      font-family: 'Outfit', sans-serif;
      font-size: 1.45rem;
      color: var(--scout-purple);
      margin: 2.2rem 0 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }}
    p {{
      margin-bottom: 1rem;
      color: var(--text-muted);
    }}
    table {{
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 1.2rem 0 2rem;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
    }}
    th {{
      background: #f1f5f9;
      color: var(--scout-navy);
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      text-align: left;
      padding: 0.85rem 1rem;
      font-size: 0.92rem;
      border-bottom: 2px solid var(--border);
    }}
    td {{
      padding: 0.9rem 1rem;
      border-bottom: 1px solid var(--border);
      font-size: 0.9rem;
      vertical-align: top;
    }}
    tr:last-child td {{
      border-bottom: none;
    }}
    tr:nth-child(even) td {{
      background: #fafcff;
    }}
    td strong {{
      color: var(--scout-navy);
    }}
    code {{
      background: #f1f5f9;
      color: #b91c1c;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
      font-size: 0.85em;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }}
    pre {{
      background: #0b1536;
      color: #38bdf8;
      padding: 1.5rem;
      border-radius: 14px;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.85rem;
      line-height: 1.4;
      margin: 1.5rem 0;
    }}
    .footer-note {{
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }}
    @media print {{
      body {{ background: #fff; padding: 0; }}
      .container {{ box-shadow: none; border: none; padding: 0; max-width: 100%; }}
      h2 {{ page-break-after: avoid; }}
      table {{ page-break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">Documentación Oficial de Arquitectura</div>
    <h1>Ecosistema Tecnológico y Herramientas — BiblioTech Scout</h1>
    <div class="meta">
      <strong>Autor:</strong> Liam Durán &nbsp;|&nbsp; 
      <strong>Proyecto:</strong> BiblioTech Scout (PWA & Android) &nbsp;|&nbsp; 
      <strong>Versiones:</strong> Web v8.4.4 / Android v2.3.4 (Build 30)
    </div>

    <p>Este informe detalla las herramientas, lenguajes de programación, librerías, servicios en la nube, APIs y tipografías que componen la infraestructura tecnológica de <strong>BiblioTech Scout</strong>, explicando la función técnica que cumple cada una dentro de la solución.</p>

    <h2>🔤 1. Tipografías y Fuentes Visuales</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Fuente / Tipografía</th>
          <th style="width: 25%;">Origen</th>
          <th>Función en el Proyecto</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Outfit</strong></td>
          <td>Google Fonts (600..900)</td>
          <td><strong>Tipografía de Títulos e Identidad:</strong> Encabezados principales, logotipo oficial <em>BiblioTech SCOUT</em>, contadores numéricos y tarjetas destacadas. Aporta presencia institucional geométrica y moderna.</td>
        </tr>
        <tr>
          <td><strong>Plus Jakarta Sans</strong></td>
          <td>Google Fonts (400..800)</td>
          <td><strong>Tipografía de Lectura y UI:</strong> Párrafos, botones, modales, formularios y respuestas del buscador. Optimizada para máxima legibilidad ergonómica en pantallas móviles de alta densidad.</td>
        </tr>
        <tr>
          <td><strong>System Fonts Fallback</strong></td>
          <td>Nativas del SO</td>
          <td>Garantiza que el texto se dibuje de inmediato en modo offline o conexiones lentas con San Francisco (Apple), Roboto (Android) o Segoe UI (Windows).</td>
        </tr>
      </tbody>
    </table>

    <h2>📚 2. Fuentes de Contenido y Datos Oficiales</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Fuente Institucional</th>
          <th style="width: 25%;">Organización</th>
          <th>Contenido Aportado</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>ASMAC</strong></td>
          <td>Asociación de Scouts de México, A.C.</td>
          <td>Manuales de progresión (Manada, Tropa, Comunidad, Clan), esquema nacional de reconocimientos, estatutos, lineamientos de seguridad en campamentos, censos nacionales y directivas oficiales.</td>
        </tr>
        <tr>
          <td><strong>WOSM</strong></td>
          <td>Organización Mundial del Movimiento Scout</td>
          <td>Programa Scouts del Mundo (Insignia del Medio Ambiente, Mensajeros de la Paz, Salud y Bienestar), historia del escultismo mundial e insignias internacionales.</td>
        </tr>
        <tr>
          <td><strong>Fondos del Centenario</strong></td>
          <td>Archivos Conmemorativos</td>
          <td>Documentos conmemorativos, normativas técnicas, cancioneros scout, ceremonias y tradiciones históricas.</td>
        </tr>
      </tbody>
    </table>

    <h2>💻 3. Frontend Web & Progressive Web App (PWA)</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Herramienta</th>
          <th style="width: 25%;">Rol</th>
          <th>Función Específica</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>HTML5 Semántico</strong></td>
          <td>Estructura</td>
          <td>Maquetado accesible (WCAG 2.1), skip-links para lectores de pantalla y metaetiquetas Open Graph / Twitter Cards.</td>
        </tr>
        <tr>
          <td><strong>CSS3 Moderno</strong></td>
          <td>Diseño Visual</td>
          <td>Variables nativas (tokens de color scout), Glassmorphism con <code>backdrop-filter</code>, tema cósmico nocturno <em>Camp-Mode</em> (<code>data-camp-mode="true"</code>) y hexágonos con <code>clip-path</code> poligonal a 60 FPS.</td>
        </tr>
        <tr>
          <td><strong>JavaScript ES6+ (Vanilla)</strong></td>
          <td>Lógica de Cliente</td>
          <td>Sin sobrecarga de frameworks pesados (0 KB de runtime innecesario). Controla el buscador instantáneo, acordeones, modales y renderizado del catálogo en milisegundos.</td>
        </tr>
        <tr>
          <td><strong>Service Worker (sw.js)</strong></td>
          <td>Motor Offline</td>
          <td>Intercepta peticiones y almacena en caché estática con estrategia <em>Cache-First</em> y <em>Stale-While-Revalidate</em>. Permite navegación completa sin internet.</td>
        </tr>
        <tr>
          <td><strong>Web App Manifest</strong></td>
          <td>Identidad PWA</td>
          <td>Permite la instalación en pantalla de inicio de iPhone y Android como app independiente (<code>display: standalone</code>).</td>
        </tr>
        <tr>
          <td><strong>Módulo Offline iOS</strong></td>
          <td>Gestor de Descarga</td>
          <td>Panel interactivo para usuarios de Safari/iOS que descarga y valida la base documental completa en la memoria del dispositivo.</td>
        </tr>
      </tbody>
    </table>

    <h2>📄 4. Visores de Documentos y Ofimática</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Componente</th>
          <th style="width: 25%;">Proveedor</th>
          <th>Función en la Plataforma</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Google Docs Viewer</strong></td>
          <td>Google</td>
          <td>Previsualiza PDFs, Word y presentaciones embebidas dentro de la web sin obligar a descargar lectores externos en el teléfono.</td>
        </tr>
        <tr>
          <td><strong>Visor Nativo PDF</strong></td>
          <td>Navegador</td>
          <td>Renderizado en alta definición mediante <code>&lt;iframe&gt;</code> para ordenadores de escritorio y tablets.</td>
        </tr>
        <tr>
          <td><strong>SheetJS (xlsx.js)</strong></td>
          <td>Open Source</td>
          <td>Motor JavaScript en el cliente para leer, procesar y mostrar libros de Excel (<code>.xlsx</code>) directamente en tablas interactivas.</td>
        </tr>
        <tr>
          <td><strong>Fallback Multicapa</strong></td>
          <td>Lógica interna</td>
          <td>Garantiza que si un visor no responde, aparezcan de inmediato botones directos de descarga y enlace alternativo.</td>
        </tr>
      </tbody>
    </table>

    <h2>📱 5. Capa Móvil Android (Compilación en APK)</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Herramienta</th>
          <th style="width: 25%;">Entorno</th>
          <th>Función en el APK</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Java 17 / OpenJDK</strong></td>
          <td>Lenguaje Nativo</td>
          <td>Controla la actividad principal (<code>MainActivity.java</code>), ciclo de vida, Splash Screen nocturno y comunicación con la web.</td>
        </tr>
        <tr>
          <td><strong>Android SDK (API 34)</strong></td>
          <td>Google Android</td>
          <td>Framework nativo configurado con <code>minSdkVersion 24</code> (Android 7.0+) y <code>targetSdkVersion 34</code> (Android 14).</td>
        </tr>
        <tr>
          <td><strong>Gradle (gradlew)</strong></td>
          <td>Motor de Compilación</td>
          <td>Compila el código, enlaza recursos, optimiza dependencias y empaqueta el binario final <code>bibliotech-scout.apk</code>.</td>
        </tr>
        <tr>
          <td><strong>Android WebView</strong></td>
          <td>Chromium Embebido</td>
          <td>Renderizador con aceleración por hardware (<code>hardwareAccelerated="true"</code>) y caché local persistente.</td>
        </tr>
        <tr>
          <td><strong>Verificación SHA-256</strong></td>
          <td>Seguridad Nativa</td>
          <td>Algoritmo de comprobación en Java para garantizar la integridad de los paquetes y assets locales del usuario.</td>
        </tr>
        <tr>
          <td><strong>Keytool & Jarsigner</strong></td>
          <td>Firma Digital</td>
          <td>Generación del almacén de claves (keystore) y firma criptográfica del APK en modo Release para instalación segura.</td>
        </tr>
      </tbody>
    </table>

    <h2>☁️ 6. Servicios en la Nube y Backend Serverless</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Servicio Cloud</th>
          <th style="width: 25%;">Plataforma</th>
          <th>Función que Cumple</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>GitHub Pages</strong></td>
          <td>GitHub</td>
          <td>Hosting web estático de alta velocidad con SSL/TLS automático, CDN mundial y despliegue continuo con <code>git push</code>.</td>
        </tr>
        <tr>
          <td><strong>GitHub Releases</strong></td>
          <td>GitHub</td>
          <td>Distribución pública de los instaladores <code>bibliotech-scout.apk</code> y sus hashes de validación <code>.sha256</code>.</td>
        </tr>
        <tr>
          <td><strong>Cloudflare Workers</strong></td>
          <td>Cloudflare Serverless</td>
          <td>Microservicio en el Edge (<code>bibliotech-telemetry...workers.dev</code>) que procesa métricas y telemetría anónima a costo $0.</td>
        </tr>
        <tr>
          <td><strong>FormSubmit</strong></td>
          <td>formsubmit.co</td>
          <td>Endpoint de mensajería sin base de datos que envía los reportes de fallas y sugerencias directamente a tu correo.</td>
        </tr>
        <tr>
          <td><strong>Cloudflare Observability</strong></td>
          <td>Cloudflare</td>
          <td>Consola de monitoreo en tiempo real para visualizar gráficos de tráfico, latencias y códigos de estado HTTP.</td>
        </tr>
      </tbody>
    </table>

    <h2>🐍 7. Automatización, Datos y Pruebas</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Herramienta</th>
          <th style="width: 25%;">Tecnología</th>
          <th>Función Técnica</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>scripts/build_data.py</strong></td>
          <td>Python 3.11</td>
          <td>Indexa preguntas frecuentes, limpia nombres de archivos y estructura el catálogo de documentos (<code>catalog.json</code>).</td>
        </tr>
        <tr>
          <td><strong>scripts/smoke_e2e.py</strong></td>
          <td>Python 3.11</td>
          <td>Auditoría automatizada de enlaces, imágenes y versiones para asegurar 0 errores antes de cada lanzamiento.</td>
        </tr>
        <tr>
          <td><strong>scripts/record_ios_clips.py</strong></td>
          <td>Python + Playwright</td>
          <td>Robot que simula la interacción en iOS y graba los 6 videos de demostración a 60 FPS en resolución 1080p.</td>
        </tr>
        <tr>
          <td><strong>Playwright</strong></td>
          <td>Chromium Headless</td>
          <td>Controlador táctil que emula la pantalla del iPhone (393x852) y captura los cuadros por segundo en tiempo real.</td>
        </tr>
        <tr>
          <td><strong>FFmpeg</strong></td>
          <td>AutoSubs / bin</td>
          <td>Filtro de escalado <code>lanczos</code> a 1080x2340 y 1080x1920 a 60 FPS con códec H.264 y extracción de portadas PNG.</td>
        </tr>
      </tbody>
    </table>

    <h2>🎯 Arquitectura General</h2>
    <pre>
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
    </pre>

    <div class="footer-note">
      Documento generado automáticamente para <strong>BiblioTech Scout</strong> • Desarrollado por Liam Durán
    </div>
  </div>
</body>
</html>
"""

# Guardar HTML y Markdown en 01_Documentacion
html_path = DOCS_DIR / "HERRAMIENTAS_Y_TECNOLOGIAS.html"
html_path.write_text(html_template, encoding="utf-8")

shutil.copy2(md_path, DOCS_DIR / "HERRAMIENTAS_Y_TECNOLOGIAS.md")

# 3. Generar versión TXT limpia para el Bloc de Notas
txt_lines = [
    "==========================================================================",
    "  ECOSISTEMA TECNOLOGICO Y HERRAMIENTAS - BIBLIOTECH SCOUT",
    "==========================================================================",
    "  Autor: Liam Duran",
    "  Proyecto: BiblioTech Scout (Plataforma Web, PWA y App Android)",
    "  Versiones: Web v8.4.4 / Android v2.3.4 (Build 30)",
    "==========================================================================\n",
    md_content
]
txt_path = DOCS_DIR / "HERRAMIENTAS_Y_TECNOLOGIAS.txt"
txt_path.write_text("\n".join(txt_lines), encoding="utf-8")

# También colocar copias directas en la raíz de Downloads para acceso inmediato
shutil.copy2(html_path, DOWNLOADS / "HERRAMIENTAS_Y_TECNOLOGIAS_BIBLIOTECH.html")
shutil.copy2(txt_path, DOWNLOADS / "HERRAMIENTAS_Y_TECNOLOGIAS_BIBLIOTECH.txt")

# 4. Copiar videos y miniaturas organizados
recordings_src = ROOT / "recordings"

for f in recordings_src.glob("*_iphone_1080x2340.mp4"):
    shutil.copy2(f, IPHONE_DIR / f.name)

for f in recordings_src.glob("*_1080x1920.mp4"):
    shutil.copy2(f, SOCIAL_DIR / f.name)

for f in recordings_src.glob("*_thumb.png"):
    shutil.copy2(f, THUMBS_DIR / f.name)

# 5. Generar archivo comprimido .ZIP con todo incluido
zip_path = DOWNLOADS / "BiblioTech_Scout_Archivos.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for file in PACKAGE_DIR.rglob("*"):
        if file.is_file():
            arcname = file.relative_to(PACKAGE_DIR)
            zipf.write(file, arcname)

print("Paquete completado exitosamente:")
print(f"- Carpeta organizada: {PACKAGE_DIR}")
print(f"- Archivo ZIP: {zip_path}")
print(f"- Documento HTML directo: {DOWNLOADS / 'HERRAMIENTAS_Y_TECNOLOGIAS_BIBLIOTECH.html'}")
print(f"- Documento TXT directo: {DOWNLOADS / 'HERRAMIENTAS_Y_TECNOLOGIAS_BIBLIOTECH.txt'}")
