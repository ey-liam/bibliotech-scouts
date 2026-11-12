"""
Grabador automatizado de clips de video a 60 FPS en resolucion vertical 1080p y formato iPhone
para BiblioTech Scout Web App (iOS).
"""
import http.server
import socketserver
import threading
import functools
import shutil
import time
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(r"C:\Users\liamc\bibliotech-scouts")
FFMPEG = r"C:\Users\liamc\AppData\Local\AutoSubs\ffmpeg.exe"
ARTIFACTS_DIR = Path(r"C:\Users\liamc\.gemini\antigravity\brain\dc865d9a-effc-4438-a5e0-8b8b7edae51e\recordings")
REPO_RECORDINGS_DIR = ROOT / "recordings"

ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
REPO_RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

TEMP_DIR = Path(r"C:\Users\liamc\.gemini\antigravity\brain\dc865d9a-effc-4438-a5e0-8b8b7edae51e\scratch\raw_clips")
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# 1. Iniciar servidor HTTP local
PORT = 19890
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE_URL = f"http://127.0.0.1:{PORT}"

def setup_page(page, active_dock_target="inicio"):
    page.goto(BASE_URL)
    page.wait_for_timeout(600)
    # Aceptar cookies, modo noche (camp-mode) y activar dock correspondiente
    page.evaluate(f"""() => {{
        document.documentElement.setAttribute('data-camp-mode', 'true');
        const b = document.getElementById('consentAcceptBtn');
        if (b) b.click();
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) banner.remove();
        document.querySelectorAll('.bt-web-toast').forEach(el => el.remove());
        
        document.querySelectorAll('.bt-dock-item').forEach(d => {{
            if (d.getAttribute('data-target') === '{active_dock_target}') {{
                d.classList.add('is-active');
            }} else {{
                d.classList.remove('is-active');
            }}
        }});
    }}""")
    page.wait_for_timeout(400)

def smooth_scroll_js(start_y, target_y, duration_ms):
    return f"""() => new Promise(resolve => {{
        const start = {start_y};
        const target = {target_y};
        const duration = {duration_ms};
        const startTime = performance.now();
        function step(now) {{
            const elapsed = now - startTime;
            const p = Math.min(elapsed / duration, 1);
            // easeInOutQuad
            const ease = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
            window.scrollTo(0, start + (target - start) * ease);
            if (p < 1) requestAnimationFrame(step);
            else resolve();
        }}
        requestAnimationFrame(step);
    }})"""

def convert_clip(raw_webm: Path, clip_name: str):
    print(f"--> Procesando con FFmpeg: {clip_name}...")
    
    # 1. Version iPhone Mockup (1080x2340 @ 60 FPS, ratio 9:19.5 exacto para encajar en la pantalla del telefono)
    out_iphone = ARTIFACTS_DIR / f"{clip_name}_iphone_1080x2340.mp4"
    subprocess.run([
        FFMPEG, "-y", "-i", str(raw_webm),
        "-vf", "scale=1080:2340:flags=lanczos",
        "-r", "60", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "fast", "-crf", "18", "-b:v", "9M",
        "-movflags", "+faststart",
        str(out_iphone)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 2. Version Estandar 1080p Vertical (1080x1920 @ 60 FPS, ratio 9:16 para Reels/Shorts/TikTok)
    out_1080p = ARTIFACTS_DIR / f"{clip_name}_1080x1920.mp4"
    subprocess.run([
        FFMPEG, "-y", "-i", str(raw_webm),
        "-vf", "scale=1080:1920:flags=lanczos",
        "-r", "60", "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "fast", "-crf", "18", "-b:v", "8M",
        "-movflags", "+faststart",
        str(out_1080p)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # 3. Miniatura PNG para previsualizacion
    thumb_png = ARTIFACTS_DIR / f"{clip_name}_thumb.png"
    subprocess.run([
        FFMPEG, "-y", "-i", str(out_iphone),
        "-ss", "00:00:02", "-vframes", "1",
        str(thumb_png)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Copiar a repo recordings
    shutil.copy2(out_iphone, REPO_RECORDINGS_DIR / out_iphone.name)
    shutil.copy2(out_1080p, REPO_RECORDINGS_DIR / out_1080p.name)
    shutil.copy2(thumb_png, REPO_RECORDINGS_DIR / thumb_png.name)
    
    print(f"✓ {clip_name} generado: {out_iphone.name} y {out_1080p.name}")

def record_all():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        
        # ----------------------------------------------------
        # CLIP 1: Inicio (Hero / Portada y Contadores)
        # ----------------------------------------------------
        print("\n[1/6] Grabando Clip 1: Inicio (Hero)...")
        clip1_dir = TEMP_DIR / "clip1"
        clip1_dir.mkdir(parents=True, exist_ok=True)
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True, has_touch=True,
            record_video_dir=str(clip1_dir),
            record_video_size={"width": 393, "height": 852}
        )
        page = ctx.new_page()
        setup_page(page, "inicio")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(2000)
        # Micro-scroll bajando por el hero para ver los contadores vivos y botones
        page.evaluate(smooth_scroll_js(0, 360, 2200))
        page.wait_for_timeout(1800)
        ctx.close()
        
        raw1 = list(clip1_dir.glob("*.webm"))[0]
        convert_clip(raw1, "01_inicio_hero")

        # ----------------------------------------------------
        # CLIP 2: Buscador de Preguntas (Consultar)
        # ----------------------------------------------------
        print("\n[2/6] Grabando Clip 2: Buscador de Preguntas...")
        clip2_dir = TEMP_DIR / "clip2"
        clip2_dir.mkdir(parents=True, exist_ok=True)
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True, has_touch=True,
            record_video_dir=str(clip2_dir),
            record_video_size={"width": 393, "height": 852}
        )
        page = ctx.new_page()
        setup_page(page, "buscador")
        page.evaluate("""() => {
            const el = document.getElementById('seccion-buscador') || document.getElementById('buscador');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }""")
        page.wait_for_timeout(1200)
        
        # Desplazar pastillas de categorias hacia la derecha
        page.evaluate("""() => {
            const row = document.getElementById('askCategoryPillsRow');
            if (row) row.scrollTo({ left: 160, behavior: 'smooth' });
        }""")
        page.wait_for_timeout(1000)
        
        # Hacer click en la primera pregunta sugerida
        page.evaluate("""() => {
            const btn = document.querySelector('#starterQuestions .starter-q-btn, .quick-q-chip, .quick-chip');
            if (btn) btn.click();
        }""")
        page.wait_for_timeout(1200)
        
        # Desplazar suavemente hacia la respuesta generada
        page.evaluate("""() => {
            const ans = document.getElementById('answerQuestionTitle');
            if (ans) ans.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }""")
        page.wait_for_timeout(3000)
        ctx.close()
        
        raw2 = list(clip2_dir.glob("*.webm"))[0]
        convert_clip(raw2, "02_buscador_preguntas")

        # ----------------------------------------------------
        # CLIP 3: El Creador (Liam Durán)
        # ----------------------------------------------------
        print("\n[3/6] Grabando Clip 3: El Creador (Liam Durán)...")
        clip3_dir = TEMP_DIR / "clip3"
        clip3_dir.mkdir(parents=True, exist_ok=True)
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True, has_touch=True,
            record_video_dir=str(clip3_dir),
            record_video_size={"width": 393, "height": 852}
        )
        page = ctx.new_page()
        setup_page(page, "inicio")
        page.evaluate("""() => {
            const el = document.getElementById('acerca');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }""")
        page.wait_for_timeout(1500)
        # Micro-scroll mostrando la tarjeta completa, foto animada y firma oficial
        page.evaluate(smooth_scroll_js(2200, 2450, 2000))
        page.wait_for_timeout(2500)
        ctx.close()
        
        raw3 = list(clip3_dir.glob("*.webm"))[0]
        convert_clip(raw3, "03_creador_liam")

        # ----------------------------------------------------
        # CLIP 4: La Biblioteca Oficial (Estantes y Portadas HD)
        # ----------------------------------------------------
        print("\n[4/6] Grabando Clip 4: Biblioteca Oficial...")
        clip4_dir = TEMP_DIR / "clip4"
        clip4_dir.mkdir(parents=True, exist_ok=True)
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True, has_touch=True,
            record_video_dir=str(clip4_dir),
            record_video_size={"width": 393, "height": 852}
        )
        page = ctx.new_page()
        setup_page(page, "biblioteca")
        page.evaluate("""() => {
            const el = document.getElementById('biblioteca');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }""")
        page.wait_for_timeout(1500)
        
        # Desplazar suavemente entre los libros y estantes
        page.evaluate("""() => {
            const grid = document.getElementById('libraryBookshelfGrid');
            if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }""")
        page.wait_for_timeout(2000)
        
        # Cambiar de filtro de seccion en la biblioteca
        page.evaluate("""() => {
            const pill = document.querySelector('#librarySectionPills button:nth-child(3)');
            if (pill) pill.click();
        }""")
        page.wait_for_timeout(2500)
        ctx.close()
        
        raw4 = list(clip4_dir.glob("*.webm"))[0]
        convert_clip(raw4, "04_biblioteca_estantes")

        # ----------------------------------------------------
        # CLIP 5: Sitios Web Anclados y Servicios Oficiales
        # ----------------------------------------------------
        print("\n[5/6] Grabando Clip 5: Sitios Web Anclados y Servicios...")
        clip5_dir = TEMP_DIR / "clip5"
        clip5_dir.mkdir(parents=True, exist_ok=True)
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True, has_touch=True,
            record_video_dir=str(clip5_dir),
            record_video_size={"width": 393, "height": 852}
        )
        page = ctx.new_page()
        setup_page(page, "inicio")
        page.evaluate("""() => {
            const el = document.getElementById('servicios');
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }""")
        page.wait_for_timeout(1500)
        # Desplazar suavemente por las tarjetas oficiales de SISAS, RECME, CONECTA, Tienda Scout
        page.evaluate(smooth_scroll_js(4200, 4700, 2500))
        page.wait_for_timeout(2000)
        ctx.close()
        
        raw5 = list(clip5_dir.glob("*.webm"))[0]
        convert_clip(raw5, "05_servicios_oficiales")

        # ----------------------------------------------------
        # CLIP 6: Scroll Completo de Todo el Sitio (Recorrido)
        # ----------------------------------------------------
        print("\n[6/6] Grabando Clip 6: Recorrido Scroll Completo...")
        clip6_dir = TEMP_DIR / "clip6"
        clip6_dir.mkdir(parents=True, exist_ok=True)
        ctx = browser.new_context(
            viewport={"width": 393, "height": 852},
            is_mobile=True, has_touch=True,
            record_video_dir=str(clip6_dir),
            record_video_size={"width": 393, "height": 852}
        )
        page = ctx.new_page()
        setup_page(page, "inicio")
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1200)
        
        # Obtener altura total del documento y hacer un scroll continuo y suave a lo largo de 16 segundos
        page.evaluate("""() => new Promise(resolve => {
            const maxScroll = document.body.scrollHeight - window.innerHeight;
            const duration = 16000; // 16 segundos
            const startTime = performance.now();
            function step(now) {
                const elapsed = now - startTime;
                const p = Math.min(elapsed / duration, 1);
                // Linear con ligera desaceleracion al final
                window.scrollTo(0, maxScroll * p);
                if (p < 1) requestAnimationFrame(step);
                else resolve();
            }
            requestAnimationFrame(step);
        })""")
        page.wait_for_timeout(1500)
        ctx.close()
        
        raw6 = list(clip6_dir.glob("*.webm"))[0]
        convert_clip(raw6, "06_recorrido_scroll_completo")

        browser.close()

    print("\n¡Todos los clips han sido grabados y exportados exitosamente a 60 FPS!")

if __name__ == "__main__":
    record_all()
