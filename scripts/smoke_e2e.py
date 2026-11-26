"""Prueba E2E reproducible (local y GitHub Actions CI) para BiblioTech Scout."""
import functools
import http.server
import re
import socketserver
import sys
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
EMOJI_RE = re.compile(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B50\u2728\u2705\u274C\u2764\u23F0-\u23FF\u200D\uFE0F]")


def start_server(port: int = 18775):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def dismiss_consent(page):
    try:
        wbtn = page.locator("#startWelcomeModalBtn")
        if wbtn.is_visible(timeout=2500):
            wbtn.click()
            page.locator("#welcomeModal").wait_for(state="hidden", timeout=2000)
    except Exception:
        pass
    try:
        btn = page.locator("#consentAcceptBtn")
        if btn.is_visible(timeout=1000):
            btn.click()
            page.locator("#cookieConsentBanner").wait_for(state="hidden", timeout=2000)
    except Exception:
        pass
    try:
        page.evaluate("document.querySelectorAll('.bt-web-toast').forEach(el => el.remove())")
    except Exception:
        pass


def run_e2e(test_webkit: bool = False):
    server = start_server(18775)
    errors = []
    telemetry_reqs = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            ctx = browser.new_context(viewport={"width": 1366, "height": 860})

            def trap_telemetry(route):
                telemetry_reqs.append(route.request.url)
                route.abort()

            ctx.route("**/formsubmit.co/**", trap_telemetry)
            ctx.route("**/workers.dev/**", trap_telemetry)
            ctx.route("**/docs.google.com/**", lambda route: route.fulfill(status=200, content_type="text/html", body="<html><body>Mock PDF Viewer</body></html>"))
            page = ctx.new_page()
            page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
            page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)

            page.goto("http://127.0.0.1:18775/", wait_until="networkidle")

            # Verificar que el modal de bienvenida en 3 páginas + QR aparece en la primera visita
            page.wait_for_selector("#welcomeModal:not(.hidden)", timeout=4000)
            assert "Página 1 de 3" in page.locator("#welcomePageIndicator").inner_text(), "Bienvenida no inició en página 1 de 3"
            page.click("#nextWelcomePageBtn")
            assert "Página 2 de 3" in page.locator("#welcomePageIndicator").inner_text(), "Bienvenida no avanzó a página 2 de 3"
            page.click("#nextWelcomePageBtn")
            assert "Página 3 de 3" in page.locator("#welcomePageIndicator").inner_text(), "Bienvenida no avanzó a página 3 de 3"
            qr_loaded = page.evaluate(
                "() => { const img = document.querySelector('#welcomeModal img[src*=\"qr-bibliotech.png\"]'); return Boolean(img && img.complete && img.naturalWidth > 100); }"
            )
            assert qr_loaded, "El código QR de bienvenida no cargó correctamente"
            dismiss_consent(page)
            assert page.evaluate("localStorage.getItem('bt_welcome_seen_v1') === '1'"), "No se guardó bt_welcome_seen_v1"

            # Verificar que al recargar YA NO aparece automáticamente
            page.reload(wait_until="networkidle")
            assert page.locator("#welcomeModal").evaluate("el => el.classList.contains('hidden')"), "El modal de bienvenida volvió a salir tras recargar"

            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Desktop horizontal overflow"

            # Verificar v9.1.0: Espacios dedicados (inicio activo por defecto), cero emojis visibles,
            # botón único Preguntas al azar con clase btn-shuffle-questions, menú ¿Qué es BiblioTech?, banner y Lector compacto
            assert page.evaluate("document.documentElement.getAttribute('data-bt-active-view') === 'inicio'"), "Vista inicial no es inicio"
            assert page.locator("#btWorkspaceHub").is_visible(), "Hub de espacios en Inicio no visible"
            assert not page.locator("#foro").is_visible(), "La Fogata no debe mostrarse en la vista Inicio"

            body_text = page.evaluate("document.body.innerText")
            bad_emojis = [ch for ch in EMOJI_RE.findall(body_text) if ch not in ("✓", "✕", "✔", "→", "←", "↗", "–", "—", "•", "·")]
            assert not bad_emojis, f"Se encontraron emojis visibles en el DOM: {set(bad_emojis)}"

            assert page.locator("#shuffleQuestionsBtn").count() == 0, "Sigue existiendo el segundo botón #shuffleQuestionsBtn"
            rand_btn = page.locator("#randomPoolBtn")
            assert "Preguntas al azar" in rand_btn.inner_text(), "Texto incorrecto en #randomPoolBtn"
            assert rand_btn.evaluate("el => el.classList.contains('btn-shuffle-questions')"), "#randomPoolBtn no usa el estilo .btn-shuffle-questions"
            rand_btn.click()
            page.wait_for_timeout(350)

            assert (page.locator('#navegacion-principal a[href="#acerca"]').text_content() or "").strip() == "¿Qué es BiblioTech?", "Enlace menú ¿Qué es BiblioTech? incorrecto"
            assert (page.locator("#acerca .section-eyebrow").text_content() or "").strip() == "Proyecto sin fines de lucro", "Eyebrow #acerca incorrecto"

            # Probar banner superior de actualización disponible
            page.evaluate("window.__btShowUpdateBanner('Prueba E2E de actualización 9.1.0')")
            assert not page.locator("#updateAvailableBanner").evaluate("el => el.classList.contains('hidden')"), "Banner de actualización no se mostró"
            page.click("#btnDismissAppUpdate")
            assert page.locator("#updateAvailableBanner").evaluate("el => el.classList.contains('hidden')"), "Banner de actualización no se cerró"

            # Probar búsqueda en Inicio
            page.fill("#askInput", "SMART")
            page.click("#askSubmitBtn")
            page.wait_for_selector("#answerContainer:not(.hidden)", timeout=15000)
            ans_text = page.locator("#answerBody").inner_text()
            assert len(ans_text.strip()) > 30, "Respuesta vacía en buscador"

            # Probar pregunta con topic_id y pregunta sobre BiblioTech
            page.fill("#askInput", "¿Qué es BiblioTech Scout y quién la creó?")
            page.click("#askSubmitBtn")
            page.wait_for_timeout(250)
            ans_bt = page.locator("#answerBody").inner_text()
            assert "Liam Durán" in ans_bt, "Respuesta sobre BiblioTech no incluyó autor"

            # Probar búsqueda de FAES y Convocatoria Intercultural Challenge 2026
            page.fill("#askInput", "Intercultural Challenge 2026")
            page.click("#askSubmitBtn")
            page.wait_for_timeout(300)
            ans_ic = page.locator("#answerBody").inner_text()
            assert "17 de octubre" in ans_ic or "Embajador" in ans_ic, "Respuesta Intercultural Challenge 2026 incompleta"

            # Probar v10.0.0: código anónimo BT-XXXXXX, respuestas específicas de Aventura/FES/Go Solar y espacio 4 Ejes PJOS
            dev_uid = page.evaluate("window.__btGetDeviceUid && window.__btGetDeviceUid()")
            assert dev_uid and re.match(r"^BT-[A-Z0-9]{6,10}$", dev_uid), f"Código de dispositivo inválido: {dev_uid}"

            page.fill("#askInput", "¿Qué es «Aventura Agua (Protección y cuidado)» en Clan de Rovers y cómo se acredita?")
            page.click("#askSubmitBtn")
            page.wait_for_timeout(350)
            ans_agua = page.locator("#answerBody").inner_text()
            assert "Carnet Aventuras en la Naturaleza" in ans_agua and "cuarta competencia" in ans_agua, f"Aventura Agua devolvió respuesta inesperada: {ans_agua[:160]}"

            page.fill("#askInput", "¿Qué es y para qué sirve «Especialidad Scout (Comunidad): Cocina en campamento»?")
            page.click("#askSubmitBtn")
            page.wait_for_timeout(350)
            ans_fes = page.locator("#answerBody").inner_text()
            assert "Conozco" in ans_fes and "Aplico" in ans_fes and "Texto16" not in ans_fes, f"Especialidad FES no mostró fases reales limpias: {ans_fes[:180]}"

            page.fill("#askInput", "Go Solar")
            page.click("#askSubmitBtn")
            page.wait_for_timeout(300)
            ans_solar = page.locator("#answerBody").inner_text()
            assert "Scouts Go Solar" in ans_solar and "P8.7" in ans_solar, "Go Solar no mostró P8.7"

            # Navegar al nuevo espacio Los 4 Ejes del PJOS (#ejes-pjos) y probar los 5 paneles interactivos
            page.click('.desktop-quick-nav [data-bt-go-view="ejes"]')
            assert page.locator("#ejes-pjos").is_visible(), "Espacio #ejes-pjos no visible"
            assert "Salud y Bienestar" in page.locator("#btAxisDetailPanel").inner_text(), "Detalle inicial de Salud no visible"
            page.click('[data-axis-pick="ambiente"]')
            assert "Tribu de la Tierra" in page.locator("#btAxisDetailPanel").inner_text(), "Cambio de eje a Ambiente falló"
            assert page.locator("#btPickerResultsGrid .bt-picker-doc-card").count() >= 1, "Armador de actividades no sugirió fichas"
            page.click("#btSuggestAxisDocsBtn")
            assert page.locator("#btPickerResultsGrid .bt-picker-doc-card").count() >= 1, "Recarga de fichas por eje falló"

            # Pestaña 2: Salud (Escudo A Salvo + Semáforo Salida Segura)
            page.click('[data-ejes-tab="salud"]')
            page.click('[data-sfh-step="comunicar"]')
            assert "CONECTA" in page.locator("#btSfhStepDetail").inner_text(), "Paso Comunicar de A Salvo no actualizó"
            page.locator('#btSafeTripChecklist [data-safe-trip-chk="jl304"]').check()
            assert "1 / 8" in page.locator("#btSafeTripBadge").inner_text(), "Semáforo de salida segura no sumó check"

            # Pestaña 3: Ambiente (Impacto Cero Papel + Misión Planeta)
            page.click('[data-ejes-tab="ambiente"]')
            sheets_before = int(page.locator("#btEcoTotalSheets").inner_text().strip() or "0")
            page.click("#btEcoAddPaperlessSessionBtn")
            sheets_after = int(page.locator("#btEcoTotalSheets").inner_text().strip() or "0")
            assert sheets_after >= sheets_before + 5, "Contador Cero Papel no incrementó +5 hojas"
            page.click('[data-eco-mission="plasticos"]')
            assert "Plastic Tide Turners" in page.locator("#btEcoMissionBody").inner_text(), "Misión Cero Plásticos no cargó"

            # Pestaña 4: Paz (Bitácora Mensajeros de la Paz -> Solicitud P8.3)
            page.click('[data-ejes-tab="paz"]')
            page.fill("#btMopProjectInput", "Colecta Invernal Patrulla E2E")
            page.fill("#btMopHoursInput", "12")
            page.click('#btMopLogForm button[type="submit"]')
            assert "12 h" in page.locator("#btMopTotalHoursBadge").inner_text(), "Bitácora MoP no registró 12 horas"
            page.click("#btMopSendToP8Btn")
            assert page.locator("#editor-formatos").is_visible(), "Botón MoP P8.3 no llevó al Editor de Archivos"
            assert page.locator("#sfTemplateSelect").input_value() == "p8_mop", "MoP no seleccionó plantilla p8_mop"

            # Pestaña 5: Habilidades (Constructor Guiado SMART -> Cédula Oficial P6.2)
            page.click('.desktop-quick-nav [data-bt-go-view="ejes"]')
            page.click('[data-ejes-tab="habilidades"]')
            page.click('[data-smart-example="s"]')
            page.click('[data-smart-example="m"]')
            page.click('[data-smart-example="a"]')
            page.click('[data-smart-example="r"]')
            page.click('[data-smart-example="t"]')
            assert "5 / 5 bloques SMART" in page.locator("#btSmartScoreBadge").inner_text(), "Constructor SMART no marcó 5/5"
            ejes_text = page.locator("#ejes-pjos").inner_text()
            bad_ejes_emojis = [ch for ch in EMOJI_RE.findall(ejes_text) if ch not in ("✓", "✕", "✔", "→", "←", "↗", "–", "—", "•", "·")]
            assert not bad_ejes_emojis, f"Emojis detectados en #ejes-pjos: {set(bad_ejes_emojis)}"
            page.click("#btSmartTransferBtn")
            assert page.locator("#editor-formatos").is_visible(), "Constructor SMART no abrió Editor de Archivos"
            assert page.locator("#sfTemplateSelect").input_value() == "smart", "Constructor SMART no seleccionó plantilla smart"
            page.select_option("#sfTemplateSelect", "salud")

            # Verificar filtro por Eje Temático en Biblioteca
            page.click('.desktop-quick-nav [data-bt-go-view="biblioteca"]')
            page.select_option("#libraryAxisFilter", "ambiente")
            assert page.locator("#libraryBookshelfGrid .book-card").count() >= 1, "Filtro #libraryAxisFilter=ambiente quedó vacío"
            page.click("#resetLibraryFiltersBtn")

            # Navegar al espacio Biblioteca y Catálogo unificados, verificar 12 archivos por defecto y carga progresiva (+12)
            page.click('.desktop-quick-nav [data-bt-go-view="biblioteca"]')
            assert page.locator("#btLibraryModeBar").is_visible(), "Barra de modos de Biblioteca no visible"
            assert page.locator("#biblioteca").is_visible(), "Estantes Visuales no visibles"
            assert not page.locator("#explorar").is_visible(), "Catálogo Avanzado debe iniciar oculto en modo Estantes"
            assert page.locator("#libraryBookshelfGrid .book-card").count() == 12, "Biblioteca debe mostrar 12 archivos por defecto"
            assert "Cargar más archivos" in page.locator("#libraryShowMoreBtn").inner_text(), "Botón Cargar más archivos no visible"
            page.click("#libraryShowMoreBtn")
            assert page.locator("#libraryBookshelfGrid .book-card").count() == 24, "Cargar más archivos no cargó +12 en Biblioteca"
            page.click('#libraryShelfTabs [data-shelf="faes"]')
            assert page.locator("#libraryBookshelfGrid .book-card").count() == 12, "Estante FAES debe mostrar 12 archivos inicialmente"
            page.click('#libraryShelfTabs [data-shelf="featured"]')
            page.click('#btLibraryModeBar [data-lib-mode="catalog"]')
            assert page.locator("#explorar").is_visible(), "Catálogo Avanzado no se mostró al cambiar pestaña"
            assert page.locator("#catalogGrid .doc-card").count() == 12, "Catálogo debe mostrar 12 archivos por defecto"
            page.click('#btLibraryModeBar [data-lib-mode="shelves"]')
            assert page.locator("#biblioteca").is_visible(), "Estantes Visuales no volvieron al cambiar pestaña"

            # Probar Lector compacto (#docModal): cajón Info oculto por defecto + Guardar + botón Reportar
            page.locator("#libraryBookshelfGrid .book-read-btn").first.click()
            page.wait_for_selector("#docModal:not(.hidden)", timeout=4000)
            assert page.locator("#modalDocInfoDrawer").evaluate("el => el.classList.contains('hidden')"), "Cajón Info debe iniciar oculto"
            page.click("#btnToggleDocInfo")
            assert not page.locator("#modalDocInfoDrawer").evaluate("el => el.classList.contains('hidden')"), "Cajón Info no se desplegó"
            page.click("#btnPinDoc")
            page.click("#btnReportDoc")
            page.wait_for_selector("#bugReportModal:not(.hidden)", timeout=4000)
            assert page.locator("#bugReportSection").input_value() == "Lector / Visor PDF o Excel", "No prellenó apartado Lector"
            page.click("#closeBugReportBtn")
            page.locator("#bugReportModal").wait_for(state="hidden", timeout=2000)
            page.click("#closeDocModalBtn")
            page.locator("#docModal").wait_for(state="hidden", timeout=2000)

            # Verificar acceso directo a Guardados en la barra superior de escritorio desde cualquier vista
            page.click('.desktop-quick-nav [data-bt-go-view="inicio"]')
            assert page.locator("#btnHeaderSaved").is_visible(), "Botón Guardados en barra superior desktop no visible"
            assert page.locator("#headerSavedCount").inner_text().strip() == "1", "Contador de guardados en cabecera desktop no actualizó"
            page.click("#btnHeaderSaved")
            page.wait_for_selector("#savedPanel:not(.hidden)", timeout=3000)
            assert page.locator("#savedPanelList .saved-card").count() == 1, "Panel de guardados no mostró el archivo guardado en escritorio"
            page.click("#savedPanel .saved-panel-close")
            page.locator("#savedPanel").wait_for(state="hidden", timeout=2000)

            # Probar modo oscuro
            page.keyboard.press("Escape")
            page.click("#btnToggleCampMode")
            assert page.evaluate("document.documentElement.getAttribute('data-camp-mode') === 'true'"), "Dark mode failed"

            # Navegar a los apartados propios de Agentes de Cambio.MX y ¿Qué es BiblioTech? desde la barra superior
            page.click('.desktop-quick-nav [data-bt-go-view="agentes"]')
            assert page.locator("#agentes").is_visible(), "Apartado propio Agentes de Cambio.MX no visible"
            page.click('.desktop-quick-nav [data-bt-go-view="acerca"]')
            assert page.locator("#acerca").is_visible(), "Apartado propio ¿Qué es BiblioTech? no visible"

            # Navegar a Guía Scout y verificar que los acordeones vienen desplegados por defecto y se pueden contraer
            page.click('.desktop-quick-nav [data-bt-go-view="guia"]')
            assert page.locator("#guia-inicio").is_visible(), "Guía de Uso no visible"
            first_acc = page.locator("#guia-inicio details.bt-acc-card").first
            assert first_acc.evaluate("el => el.hasAttribute('open')"), "Los acordeones de Guía deben venir desplegados por defecto"
            first_acc.locator("summary").click()
            assert not first_acc.evaluate("el => el.hasAttribute('open')"), "El acordeón no se contrajo al tocar su encabezado"
            first_acc.locator("summary").click()
            assert first_acc.evaluate("el => el.hasAttribute('open')"), "El acordeón no se volvió a desplegar"

            # Navegar a sub-pestaña App y Modo Offline
            page.click('.desktop-quick-nav [data-bt-guide-jump="app"]')
            assert page.locator("#btGuideSubnav").is_visible(), "Sub-barra de Guía Scout no visible"
            assert page.locator("#app").is_visible(), "Sección App / Offline no visible en Guía -> App"
            assert not page.locator("#guia-inicio").is_visible(), "Guía de Uso debe estar oculta en sub-pestaña App"

            # Probar descarga Modo Offline iOS / Web y verificación offline real
            page.click("#tabAppIos")
            page.click("#btnDownloadWebOffline")
            page.wait_for_function(
                "() => document.getElementById('iosOfflineStatusBadge')?.classList.contains('ready')",
                timeout=35000,
            )
            badge_text = page.locator("#iosOfflineStatusBadge").inner_text()
            assert "Listo offline" in badge_text, f"Badge inesperado: {badge_text}"

            # Simular sin conexión
            ctx.set_offline(True)
            page.evaluate("window.dispatchEvent(new Event('offline'))")
            page.wait_for_timeout(150)
            assert not page.locator("#webOfflineNetBanner").evaluate("el => el.classList.contains('hidden')"), "Banner offline no visible"
            ctx.set_offline(False)
            page.evaluate("window.dispatchEvent(new Event('online'))")

            # Probar menú desplegable -> Reportar error o bug -> formulario
            page.click("#navToggle")
            page.click("#openBugReportMenuBtn")
            page.wait_for_selector("#bugReportModal:not(.hidden)", timeout=4000)
            page.locator("#bugReportReasons .bt-bug-chip").first.click()
            assert page.locator("#bugReportReasons input[type='checkbox']").first.is_checked()
            page.fill("#bugReportDetails", "Prueba automatizada E2E de reporte")
            page.click("#submitBugReportBtn")
            page.wait_for_selector("#bugReportStatus.is-ok", state="attached", timeout=4000)
            page.locator("#bugReportModal").wait_for(state="hidden", timeout=6000)

            # Navegar al espacio Editor de Archivos y probar Bóveda Local de Autollenado
            page.click('.desktop-quick-nav [data-bt-go-view="formatos"]')
            assert page.locator("#editor-formatos").is_visible(), "Espacio Editor de Archivos no visible"
            assert page.locator("#editorFormatosTitle").inner_text().strip() == "Editor de Archivos", "Título de Editor de Archivos incorrecto"
            assert "HERRAMIENTA ACTIVA" not in page.locator("#editor-formatos").inner_text(), "Leyenda HERRAMIENTA ACTIVA no se eliminó"
            page.fill("#afName", "Liam Durán Prueba")
            page.fill("#afAge", "16")
            page.fill("#afGroup", "Grupo 53")
            page.fill("#afProvince", "Tláhuac-Xochimilco")
            page.click("#btnSaveAutofillProfile")
            assert "Perfil listo" in page.locator("#autofillStatusBadge").inner_text(), "No actualizó estado autofill"
            page.click("#btnPreviewAutofillDemo")
            page.wait_for_selector("#autofillDemoPreview:not(.hidden)", timeout=3000)
            assert "Liam Durán Prueba" in page.locator("#autofillDemoPreview").inner_text(), "Demo autofill sin datos"
            assert page.locator("#sfDocumentSheet .bt-sf-official-page").count() >= 1, "No se renderizó la página oficial de base en el Editor"
            page.wait_for_selector("#sfDocumentSheet canvas.bt-sf-preview-canvas", timeout=4000)
            canvas_ready = page.wait_for_function(
                "() => { const c = document.querySelector('#sfDocumentSheet canvas.bt-sf-preview-canvas'); return Boolean(c && c.width > 200 && c.height > 200); }",
                timeout=5000,
            )
            assert canvas_ready, "Canvas en vivo del Editor no pintó la hoja oficial"
            assert page.locator("#sfDocumentSheet .bt-sf-hitbox").count() >= 1, "Faltan áreas clicables interactivas sobre la vista previa"

            # Navegar al espacio La Fogata (#foro) y probar flujo completo
            page.click('.desktop-quick-nav [data-bt-go-view="fogata"]')
            assert page.locator("#foro").is_visible(), "Espacio La Fogata no visible"
            assert "COMUNIDAD SCOUT" not in page.locator("#foro").inner_text(), "Leyenda COMUNIDAD SCOUT no se eliminó"
            assert "La Fogata: Recomendaciones" in page.locator("#forumSectionTitle").inner_text(), "Título La Fogata incorrecto"
            assert "Todos" in page.locator('#forumChannelTabs [data-forum-channel="all"]').inner_text(), "Pestaña Todos faltante"
            page.click('#forumChannelTabs [data-forum-channel="adultos"]')
            adult_cards = page.locator("#forumPostsGrid .forum-post-card.is-adult").count()
            assert adult_cards >= 4, f"Faltan tarjetas adultos: {adult_cards}"
            page.click('#forumChannelTabs [data-forum-channel="jovenes"]')
            assert page.locator("#forumPostsGrid .forum-post-card:not(.is-adult)").count() >= 4, "Faltan tarjetas jóvenes"
            page.click('#forumTagBar [data-forum-tag="#meztitla"]')
            assert page.locator("#forumPostsGrid .forum-post-card").count() >= 1, "Filtro hashtag meztitla falló"
            page.click("#resetForumFiltersBtn")

            # Abrir compositor y comprobar validación de campos obligatorios (si quitamos el nombre real)
            page.click("#btnOpenForumComposer")
            page.wait_for_selector("#forumComposerModal:not(.hidden)", timeout=3000)
            assert page.locator("#forumPostRealName").input_value() == "Liam Durán Prueba", "Nombre real no autocompletado"
            page.fill("#forumPostRealName", "")
            page.fill("#forumPostTitle", "Botiquín compacto de Patrulla E2E")
            page.fill("#forumPostBody", "Llevar gasas estériles, cinta micropore y suero oral sobres en bolsa impermeable.")
            page.click("#submitForumPostBtn")
            page.wait_for_selector("#forumComposerStatus.is-error", timeout=2000)

            # Completar datos reales de seguridad pero elegir aparecer 100 % Anónimo en público
            page.fill("#forumPostRealName", "Nombre Privado E2E Secreto")
            page.fill("#forumPostGroup", "Grupo 53")
            page.fill("#forumPostProvince", "Tláhuac-Xochimilco")
            page.select_option("#forumPostVisibility", "anonymous")
            page.fill("#forumCustomTags", "#botiquin #e2e")
            page.click("#submitForumPostBtn")
            page.locator("#forumComposerModal").wait_for(state="hidden", timeout=3000)
            anon_card = page.locator('#forumPostsGrid .forum-post-card:has-text("Botiquín compacto de Patrulla E2E")')
            anon_text = anon_card.inner_text()
            assert "Scout Anónimo" in anon_text, "Modo anónimo no mostró Scout Anónimo"
            assert "Nombre Privado E2E Secreto" not in anon_text, "Nombre real se filtró en tarjeta anónima pública"
            outbox_has_secret = page.evaluate(
                "() => { const ob = JSON.parse(localStorage.getItem('bt_forum_outbox_v1') || '[]'); return ob.some(x => x.payload?.securityRecord?.realName === 'Nombre Privado E2E Secreto'); }"
            )
            assert outbox_has_secret, "Registro interno privado de seguridad no guardó el nombre real"

            # Editar publicación recién creada
            anon_card.locator("[data-edit-post]").click()
            page.wait_for_selector("#forumComposerModal:not(.hidden)", timeout=3000)
            page.fill("#forumPostTitle", "Botiquín compacto de Patrulla Editado E2E")
            page.click("#submitForumPostBtn")
            page.locator("#forumComposerModal").wait_for(state="hidden", timeout=3000)
            edited_card = page.locator('#forumPostsGrid .forum-post-card:has-text("Botiquín compacto de Patrulla Editado E2E")')
            assert "Editado" in edited_card.inner_text(), "Insignia Editado ausente"

            # Comentar y dar like en comentario
            edited_card.locator("[data-toggle-comments]").click()
            edited_card.locator(".forum-comment-form .forum-comment-input").fill("Buen consejo para campamentos largos.")
            edited_card.locator(".forum-comment-form .forum-comment-submit").click()
            edited_card.locator(".forum-comment-item [data-like-comment]").first.click()
            assert "Respuesta más útil" in edited_card.inner_text(), "Best comment badge no apareció"

            # Probar banderita de reporte en comentario exigiendo motivo
            edited_card.locator(".forum-comment-item [data-report-comment]").first.click()
            page.wait_for_selector("#bugReportModal:not(.hidden)", timeout=3000)
            assert page.locator("#forumModerationReasons").is_visible(), "Motivos de moderación no visibles"
            page.locator("#forumModerationReasons .bt-bug-chip").first.click()
            page.fill("#bugReportDetails", "Prueba E2E de reporte con explicación del motivo.")
            page.click("#submitBugReportBtn")
            page.wait_for_selector("#bugReportStatus.is-ok", state="attached", timeout=4000)
            page.locator("#bugReportModal").wait_for(state="hidden", timeout=6000)

            # Probar espacio interactivo Skills (#skills): 20 Claves, Nudos 3D, Tu Mochila, Pistas, Botiquín, Fogatas, Silbato y Reto
            page.click('.desktop-quick-nav [data-bt-go-view="skills"]')
            assert page.locator("#skills").is_visible(), "Espacio #skills no visible"
            skills_text = page.locator("#skills").inner_text()
            bad_skills_emojis = [ch for ch in EMOJI_RE.findall(skills_text) if ch not in ("✓", "✕", "✔", "→", "←", "↗", "–", "—", "•", "·", "↔")]
            assert not bad_skills_emojis, f"Emojis detectados en #skills: {set(bad_skills_emojis)}"
            assert page.locator("#btCipherOutputArea .bt-cipher-glyph-card svg").count() >= 5, "Semáforo SVG no se renderizó"
            page.click("#btSemaFlagStyleBtn")
            assert "Rojo/Amarillo" in page.locator("#btSemaFlagStyleBtn").inner_text(), "Toggle de banderines Semáforo falló"
            page.click("#btSemaFlagStyleBtn")

            page.click('#btCipherTypePills [data-cipher-kind="morse"]')
            assert "-" in page.locator("#btCipherOutputArea").inner_text() or "." in page.locator("#btCipherOutputArea").inner_text(), "Morse no tradujo"
            page.click('#btCipherTypePills [data-cipher-kind="murcielago"]')
            murc_out = page.locator("#btCipherOutputArea").inner_text()
            assert "450" in murc_out and "64" in murc_out, f"Murciélago SIEMPRE LISTOS inesperado: {murc_out}"

            page.fill("#btCipherTextInput", "MANADA SEEONEE")
            page.click('#btCipherTypePills [data-cipher-kind="badenpowell"]')
            assert "MOLOWO SEEALEE" in page.locator("#btCipherOutputArea").inner_text(), "Baden Powell falló"

            page.fill("#btCipherTextInput", "SCOUT")
            page.click('#btCipherTypePills [data-cipher-kind="agujerito"]')
            assert "SC938" in page.locator("#btCipherOutputArea").inner_text(), "Agujerito SCOUT falló"
            page.click('#btCipherTypePills [data-cipher-kind="alfabeto_rev"]')
            assert "HXLFG" in page.locator("#btCipherOutputArea").inner_text(), "Alfabeto al revés SCOUT falló"
            page.click('#btCipherTypePills [data-cipher-kind="alfabeto_med"]')
            assert "FPBHG" in page.locator("#btCipherOutputArea").inner_text(), "Alfabeto medio SCOUT falló"
            page.click('#btCipherTypePills [data-cipher-kind="palabra_clave"]')
            assert "QAMUS" in page.locator("#btCipherOutputArea").inner_text(), "Palabra clave CLARINET falló"
            page.click('#btCipherTypePills [data-cipher-kind="criptografo"]')
            assert "RBÑTS" in page.locator("#btCipherOutputArea").inner_text(), "Criptógrafo SCOUT falló"
            page.click('#btCipherTypePills [data-cipher-kind="brujula"]')
            assert "O5 S1 O4 E6 N6" in page.locator("#btCipherOutputArea").inner_text(), "Brújula SCOUT falló"
            page.click('#btCipherTypePills [data-cipher-kind="pigpen"]')
            assert page.locator("#btCipherMasterDiagram svg").count() >= 2, "Faltan diagramas maestros Pigpen (# y X)"
            page.click('#btCipherTypePills [data-cipher-kind="gato"]')
            assert page.locator("#btCipherMasterDiagram svg").count() == 1, "Falta cuadrícula Gato 3x3"
            page.click('#btCipherTypePills [data-cipher-kind="caracol"]')
            assert page.locator("#btCipherOutputArea .bt-spiral-cell.is-center").count() == 1, "Falta celda central de Caracol"

            page.click('#btSkillsTabs [data-skills-tab="nudos"]')
            assert page.locator("#btKnotsGrid .bt-knot-card").count() >= 10, "Faltan nudos en #skills"
            page.locator('#btKnotsGrid [data-knot-step="rizo:1"]').click()
            assert page.locator('#btKnotsGrid [data-knot-step="rizo:1"]').evaluate("el => el.classList.contains('is-active')"), "Paso 2 de nudo no quedó activo"

            page.click('#btSkillsTabs [data-skills-tab="mochila"]')
            assert page.locator('#btPackZonePills [data-pack-zone-btn]').count() == 4, "Faltan botones de zona en Tu Mochila"
            page.click('#btPackZonePills [data-pack-zone-btn="cabezal"]')
            assert "1. Cabezal" in page.locator("#btPackZoneInfo").inner_text(), "Cambio de zona en Tu Mochila falló"
            page.fill("#btUserWeightKg", "60")
            assert "9.0 – 12.0 kg" in page.locator("#btPackMaxWeightLabel").inner_text(), "Cálculo de carga segura 60kg falló"
            page.locator("#btPackChecklist input[type='checkbox']").first.check()
            assert page.locator("#btPackCountBadge").inner_text().startswith("1 /"), "Checklist Tu Mochila no actualizó contador"
            assert "Peso empacado:" in page.locator("#btPackLoadStatus").inner_text() and "0.0 kg" not in page.locator("#btPackLoadStatus").inner_text(), "Medidor de carga no sumó peso empacado"

            page.click('#btSkillsTabs [data-skills-tab="pistas"]')
            assert page.locator("#btTracksGrid .bt-track-card").count() == 12, "Faltan 12 señales de pista"
            assert "225°" in page.locator("#btCompassBackText").inner_text(), "Contra-azimut inicial incorrecto"
            page.click('#btCompassPresets [data-compass-deg="90"]')
            assert "270°" in page.locator("#btCompassBackText").inner_text(), "Botón rápido E 90° no calculó regreso 270°"

            page.click('#btSkillsTabs [data-skills-tab="botiquin"]')
            assert page.locator("#btFirstAidGrid .bt-firstaid-card").count() >= 5, "Faltan tarjetas de primeros auxilios"

            page.click('#btSkillsTabs [data-skills-tab="fogatas"]')
            assert page.locator("#btFiresGrid .bt-knot-card").count() == 5, "Faltan 5 tipos de fogata"

            page.click('#btSkillsTabs [data-skills-tab="silbato"]')
            wh_txt = page.locator("#btWhistlesList").inner_text()
            assert "CC" in wh_txt and "QQ" in wh_txt and "RR" in wh_txt, "Faltan toques oficiales ASMAC en Silbato"
            assert page.locator("#btFormationDiagram svg").count() == 1, "Falta diagrama de formación"

            page.click('#btSkillsTabs [data-skills-tab="reto"]')
            page.locator("#btQuizArea [data-quiz-pick]").first.click()
            assert page.locator("#btQuizArea .bt-quiz-exp").count() == 1, "Reto no mostró retroalimentación al responder"

            # Probar salto directo desde Buscador hacia Skills + consultas reales corregidas
            page.click('.desktop-quick-nav [data-bt-go-view="inicio"]')
            page.fill("#askInput", "clave murcielago")
            page.click("#askSubmitBtn")
            page.wait_for_selector("#answerContainer:not(.hidden)", timeout=5000)
            jump_btn = page.locator("#answerBody [data-bt-jump-skill]")
            assert jump_btn.is_visible(), "Falta botón directo Abrir en Skills en respuesta de buscador"
            jump_btn.click()
            assert page.locator("#skills").is_visible(), "Botón del buscador no abrió Skills"

            page.click('.desktop-quick-nav [data-bt-go-view="inicio"]')
            page.fill("#askInput", "Ficha especialidad en matemáticas")
            page.click("#askSubmitBtn")
            page.wait_for_selector("#answerContainer:not(.hidden)", timeout=5000)
            ans_math = page.locator("#answerBody").inner_text()
            assert "P5.1" in ans_math and "no existe actualmente" in ans_math, f"Detector FES matemáticas falló: {ans_math}"

            page.fill("#askInput", "Puedo participar sin pertenecer a un grupo pero con vigencia activa")
            page.click("#askSubmitBtn")
            page.wait_for_selector("#answerContainer:not(.hidden)", timeout=5000)
            ans_nogrp = page.locator("#answerBody").inner_text()
            assert "Estatutos 2023" in ans_nogrp and "Cambio de Grupo" in ans_nogrp and "$750" not in ans_nogrp, f"Detector sin grupo falló: {ans_nogrp}"

            page.fill("#askInput", "Con trabajo las progresiones en manada")
            page.click("#askSubmitBtn")
            page.wait_for_selector("#answerContainer:not(.hidden)", timeout=5000)
            ans_manada = page.locator("#answerBody").inner_text()
            assert "Cazaderos" in ans_manada and "P2.1" in ans_manada, f"Consulta Manada con typo falló: {ans_manada}"

            # Verificar contraste real en Modo oscuro (esperando >=350ms tras activar transiciones CSS)
            page.emulate_media(color_scheme="dark")
            page.wait_for_function("() => document.documentElement.getAttribute('data-camp-mode') === 'true'", timeout=3000)
            page.wait_for_timeout(380)

            dark_check_js = """(selList) => {
              const parseRgbAll = (str) => {
                const out = [];
                const re = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/g;
                let m;
                while ((m = re.exec(String(str || '')))) {
                  out.push({ r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) });
                }
                return out;
              };
              const over = (fg, bg) => {
                const a = fg.a === undefined ? 1 : fg.a;
                return {
                  r: Math.round(fg.r * a + bg.r * (1 - a)),
                  g: Math.round(fg.g * a + bg.g * (1 - a)),
                  b: Math.round(fg.b * a + bg.b * (1 - a)),
                  a: 1
                };
              };
              const lum = (c) => {
                const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
                return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
              };
              const effectiveBg = (node) => {
                const base = { r: 10, g: 12, b: 28, a: 1 };
                const layers = [];
                let cur = node;
                while (cur && cur.nodeType === 1) {
                  const st = getComputedStyle(cur);
                  const sol = parseRgbAll(st.backgroundColor)[0];
                  if (sol && sol.a > 0.02) layers.unshift(sol);
                  if (st.backgroundImage && st.backgroundImage !== 'none') {
                    const stops = parseRgbAll(st.backgroundImage);
                    if (stops.length) layers.unshift(stops[0]);
                  }
                  cur = cur.parentElement;
                }
                let acc = base;
                for (const l of layers) acc = over(l, acc);
                return acc;
              };
              return selList.map((sel) => {
                const el = document.querySelector(sel);
                if (!el) return { sel, missing: true };
                const st = getComputedStyle(el);
                const bgCol = effectiveBg(el);
                const fg = parseRgbAll(st.color)[0] || { r: 248, g: 250, b: 252, a: 1 };
                const bgLum = lum(bgCol);
                const fgLum = lum(fg);
                const ratio = (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05);
                return { sel, bgComp: bgCol, color: st.color, bgLum: Number(bgLum.toFixed(3)), ratio: Number(ratio.toFixed(2)) };
              });
            }"""

            page.click('.desktop-quick-nav [data-bt-go-view="formatos"]')
            page.click('#btWizardSecPills [data-wiz-sec="manada"]')
            page.wait_for_timeout(380)
            wiz_check = page.evaluate(dark_check_js, ["#btProcedureWizard", "#btProcedureWizard h3", "#btProcedureWizard .bt-wiz-pill", "#btProcedureWizard .bt-wiz-pill.is-active"])
            for item in wiz_check:
                assert not item.get("missing"), f"Falta {item['sel']}"
                assert item["ratio"] >= 4.5, f"Bajo contraste oscuro en {item['sel']}: {item}"
            assert wiz_check[0]["bgLum"] < 0.2, f"#btProcedureWizard no tiene fondo oscuro en camp-mode: {wiz_check[0]}"

            page.click('.desktop-quick-nav [data-bt-go-view="ejes"]')
            page.click('[data-ejes-tab="explorar"]')
            page.click('[data-axis-pick="salud"]')
            page.wait_for_timeout(380)
            axis_check = page.evaluate(dark_check_js, [".bt-axis-card.is-salud.is-active", ".bt-axis-card.is-salud.is-active h3", ".bt-axis-card.is-salud.is-active p"])
            for item in axis_check:
                assert not item.get("missing"), f"Falta {item['sel']}"
                assert item["ratio"] >= 4.5, f"Bajo contraste oscuro en {item['sel']}: {item}"
            assert axis_check[0]["bgLum"] < 0.25, f".bt-axis-card.is-active quedó blanca en modo oscuro: {axis_check[0]}"

            page.emulate_media(color_scheme="light")
            page.wait_for_function("() => document.documentElement.getAttribute('data-camp-mode') === 'false'", timeout=3000)

            # Vista 1200px sin desborde
            page.set_viewport_size({"width": 1200, "height": 820})
            page.wait_for_timeout(150)
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Desktop 1200px horizontal overflow"

            # Vista móvil 390x844 sin desborde y prueba del Dock inferior de 6 botones
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.on("pageerror", lambda err: errors.append(f"mobile pageerror: {err}"))
            mpage.goto("http://127.0.0.1:18775/", wait_until="networkidle")
            dismiss_consent(mpage)
            assert mpage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile horizontal overflow (inicio)"
            assert mpage.locator("#unifiedBottomDock .bt-dock-item").count() == 6, "Dock móvil debe tener 6 botones"
            assert mpage.locator("#navegacion-principal #openSettingsMenuBtn").count() == 0, "Ajustes no debe duplicarse en el menú"
            assert mpage.locator("#navegacion-principal #openSavedMenuBtn").count() == 0, "Guardados no debe duplicarse en el menú"
            assert mpage.locator('#navegacion-principal a[href="#aportar"]').count() == 0, "Aportar y Contacto no debe estar en el menú"
            assert mpage.locator('#navegacion-principal a[href="#app"]').count() == 0, "App / Offline no debe duplicarse en el menú"
            mpage.click("#dockBtnSettings")
            mpage.wait_for_selector("#btSettingsModal:not(.hidden)", timeout=3000)
            assert "Modo Estándar" in mpage.locator("#labelModeFull").inner_text(), "Falta etiqueta Modo Estándar"
            assert mpage.locator("#settingsCampLabel").inner_text().strip() == "Modo oscuro", "Modo oscuro debe mostrarse sin (Campamento)"
            assert mpage.locator('#btSettingsModal [data-settings-tab="offline"]').is_visible(), "Falta pestaña App y Modo Offline en Ajustes"
            mpage.click("#closeSettingsModalBtn")
            mpage.locator("#btSettingsModal").wait_for(state="hidden", timeout=3000)
            mpage.click('#unifiedBottomDock [data-bt-go-view="fogata"]')
            assert mpage.locator("#foro").is_visible(), "Dock móvil no abrió La Fogata"
            forum_fit = mpage.evaluate(
                "() => Array.from(document.querySelectorAll('#foro .forum-post-card')).every(el => el.getBoundingClientRect().right <= window.innerWidth + 1)"
            )
            assert forum_fit, "Tarjetas de foro exceden el ancho móvil"
            mpage.click('#unifiedBottomDock [data-bt-go-view="formatos"]')
            assert mpage.locator("#editor-formatos").is_visible(), "Dock móvil no abrió Formatos"
            assert mpage.locator("#smartFormWorkspace").is_visible(), "Editor Inteligente de Formatos no visible"
            assert mpage.locator("#sfTemplateSelect option").count() == 16, "Se esperaban 16 plantillas en sfTemplateSelect"

            # Probar Asistente en 3 pasos y apertura directa de plantilla P9.2
            mpage.click('[data-wiz-sec="tropa"]')
            mpage.click('[data-wiz-goal="insignia_final"]')
            assert "Águila Real" in mpage.locator("#btWizardResult").inner_text(), "Wizard no generó paquete de Tropa"
            mpage.click('[data-wiz-open-tpl="p9"]')
            assert mpage.locator("#sfTemplateSelect").input_value() == "p9", "Wizard no seleccionó plantilla p9"

            # Probar Checklist de Progresión + balance de 4 Ejes PJOS + paso en 1 clic
            assert mpage.locator("#btProgressionChecker").is_visible(), "Falta Checklist de Progresión"
            mpage.click('[data-prog-sec="tropa"]')
            assert "Rumbo Tortuga Lora" in mpage.locator("#btProgAxisBalance").inner_text(), "Balance de 4 Ejes en Tropa no mostró Rumbo Tortuga Lora"
            mpage.click('#btProgAxisBalance [data-prog-axis-toggle="salud"]')
            assert "1 / 4 Ejes PJOS" in mpage.locator("#btProgAxisBalance").inner_text(), "Toggle de eje en Progresión no actualizó estado"
            first_prog_chk = mpage.locator('#btProgChecklistBody [data-prog-check]').first
            if not first_prog_chk.is_checked():
                first_prog_chk.check()
            mpage.click("#btProgOpenFormBtn")
            assert mpage.locator("#sfTemplateSelect").input_value() == "p9", "Checklist no abrió P9"

            # Probar vista previa live <canvas>, checkbox interactivo y firma digital
            mpage.select_option("#sfTemplateSelect", "p1")
            mpage.click('[data-sf-mob-pane="preview"]')
            mpage.wait_for_selector("#sfDocumentSheet canvas.bt-sf-preview-canvas", timeout=4000)
            mpage.click('[data-sf-mob-pane="edit"]')
            p1_chk = mpage.locator('#sfFormFieldsContainer [data-sf-check="apoyo_si"]')
            p1_chk.check()
            assert p1_chk.is_checked(), "Checkbox de P1.0.1 no se marcó"
            mpage.click('[data-sig-mode="draw"]')
            assert mpage.locator("#btSigPadCanvas").is_visible(), "Lienzo de firma táctil no se mostró"
            mpage.click('[data-sig-mode="blank"]')

            # Probar QR Offline de Autollenado y su enlace ?af=
            mpage.fill("#afName", "Scout Prueba QR")
            mpage.fill("#afGroup", "Grupo 15")
            mpage.click("#btnQrAutofillProfile")
            mpage.wait_for_selector("#btAutofillQrModal:not(.hidden)", timeout=3000)
            assert mpage.locator("#btAutofillQrSvgWrap svg").count() == 1, "QR SVG no se generó"
            qr_url = mpage.locator("#btAutofillQrUrlInput").input_value()
            assert "?af=" in qr_url, "URL QR de perfil no contiene ?af="
            mpage.click("#btnCloseAutofillQrModal")
            mpage.locator("#btAutofillQrModal").wait_for(state="hidden", timeout=3000)

            mpage.select_option("#sfTemplateSelect", "jl304")
            mpage.click("#btnSfApplyProfile")
            mpage.click('[data-sf-mob-pane="preview"]')
            mpage.wait_for_timeout(180)
            assert mpage.locator("#sfDocumentSheet canvas.bt-sf-preview-canvas").count() == 2, "Hoja JL304 debe renderizar 2 canvas en vivo"
            assert mpage.locator("#sfDocumentSheet canvas.bt-sf-preview-canvas").first.is_visible(), "Canvas JL304 no visible en pestaña Vista previa móvil"
            editor_fit = mpage.evaluate(
                "() => Array.from(document.querySelectorAll('#editor-formatos .editor-format-card')).every(el => el.getBoundingClientRect().right <= window.innerWidth + 1)"
            )
            assert editor_fit, "Tarjetas de editor exceden el ancho móvil"

            # Probar traducción EN completa y escala tipográfica
            mpage.click("#dockBtnSettings")
            mpage.wait_for_selector("#btSettingsModal:not(.hidden)", timeout=3000)
            mpage.click('[data-font-scale="115"]')
            assert mpage.evaluate("document.documentElement.getAttribute('data-bt-font-scale')") == "115", "Escala 115 no aplicada"
            mpage.click('[data-lang-choice="en"]')
            assert "Ask now" in mpage.locator(".btn-hero-primary").inner_text(), "Traducción EN no se aplicó en Hero"
            mpage.click('[data-lang-choice="es"]')
            mpage.click("#closeSettingsModalBtn")
            mpage.locator("#btSettingsModal").wait_for(state="hidden", timeout=3000)

            mpage.click('#unifiedBottomDock [data-bt-go-view="inicio"]')
            mpage.fill("#askInput", "P8.8")
            mpage.click("#askForm button[type='submit']")
            mpage.wait_for_selector("#answerContainer:not(.hidden)", timeout=5000)
            assert "P8.1" in mpage.locator("#answerBody").inner_text(), "Detector P8.8 no mostró rango real de serie P8"
            assert mpage.locator("#btnSpeakAnswer").is_visible(), "Falta botón Escuchar en respuesta"
            assert mpage.locator("#btnShareAnswerLink").is_visible(), "Falta botón Compartir enlace en respuesta"
            assert mpage.locator("#btnPrintAnswerPdf").is_visible(), "Falta botón Imprimir / PDF en respuesta"

            # Probar Modo oscuro visible en móvil y detección automática de sistema (prefers-color-scheme)
            assert mpage.locator("#btnToggleCampMode").is_visible(), "Botón Modo oscuro oculto en móvil"
            mpage.emulate_media(color_scheme="dark")
            mpage.wait_for_function("() => document.documentElement.getAttribute('data-camp-mode') === 'true'", timeout=3000)
            mpage.emulate_media(color_scheme="light")
            mpage.wait_for_function("() => document.documentElement.getAttribute('data-camp-mode') === 'false'", timeout=3000)
            mctx.close()
            ctx.close()
            browser.close()

            if test_webkit:
                wbrowser = p.webkit.launch()
                wctx = wbrowser.new_context(
                    viewport={"width": 390, "height": 844},
                    has_touch=True,
                    user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
                )
                wpage = wctx.new_page()
                wpage.on("pageerror", lambda err: errors.append(f"webkit pageerror: {err}"))
                wpage.goto("http://127.0.0.1:18775/#app", wait_until="load")
                wpage.wait_for_selector("#appDetectedOsBadge", timeout=6000)
                dismiss_consent(wpage)
                badge = wpage.locator("#appDetectedOsBadge").inner_text()
                assert "iPhone / iPad" in badge, f"iOS detection failed: {badge}"
                assert wpage.locator("#iosOfflineCard").is_visible(), "iOS offline card no visible"
                wpage.goto("http://127.0.0.1:18775/?q=Eagle+Scout", wait_until="load")
                dismiss_consent(wpage)
                wpage.wait_for_selector("#answerContainer:not(.hidden)", timeout=8000)
                wpage.wait_for_function(
                    "() => { const el = document.getElementById('answerBody'); return Boolean(el && (el.innerText.includes('Águila Real') || el.innerText.includes('Baden Powell'))); }",
                    timeout=12000,
                )
                wans = wpage.locator("#answerBody").inner_text()
                assert "Águila Real" in wans or "Baden Powell" in wans, "Deep link ?q=Eagle+Scout falló en WebKit"
                wctx.close()
                wbrowser.close()
    finally:
        server.shutdown()

    assert not telemetry_reqs, f"Fuga de telemetría en localhost: {telemetry_reqs}"
    assert not errors, f"Errores en consola/JS: {errors}"
    print("SMOKE_E2E_OK", {"webkit": test_webkit, "errors": len(errors), "telemetry_leaks": len(telemetry_reqs)})


if __name__ == "__main__":
    run_e2e("--webkit" in sys.argv)
