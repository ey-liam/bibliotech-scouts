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
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
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

            # Verificar que el modal de bienvenida + QR aparece en la primera visita
            page.wait_for_selector("#welcomeModal:not(.hidden)", timeout=4000)
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
            assert "Liam Durán Prueba" in page.locator("#sfDocumentSheet .bt-sf-official-overlays").first.inner_text(), "Los datos no se superpusieron sobre la página oficial de base"

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

            # Vista 1200px sin desborde
            page.set_viewport_size({"width": 1200, "height": 820})
            page.wait_for_timeout(150)
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Desktop 1200px horizontal overflow"

            # Vista móvil 390x844 sin desborde y prueba del Dock inferior de 5 botones
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.on("pageerror", lambda err: errors.append(f"mobile pageerror: {err}"))
            mpage.goto("http://127.0.0.1:18775/", wait_until="networkidle")
            dismiss_consent(mpage)
            assert mpage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile horizontal overflow (inicio)"
            assert mpage.locator("#unifiedBottomDock .bt-dock-item").count() == 5, "Dock móvil debe tener 5 botones"
            mpage.click('#unifiedBottomDock [data-bt-go-view="fogata"]')
            assert mpage.locator("#foro").is_visible(), "Dock móvil no abrió La Fogata"
            forum_fit = mpage.evaluate(
                "() => Array.from(document.querySelectorAll('#foro .forum-post-card')).every(el => el.getBoundingClientRect().right <= window.innerWidth + 1)"
            )
            assert forum_fit, "Tarjetas de foro exceden el ancho móvil"
            mpage.click('#unifiedBottomDock [data-bt-go-view="formatos"]')
            assert mpage.locator("#editor-formatos").is_visible(), "Dock móvil no abrió Formatos"
            assert mpage.locator("#smartFormWorkspace").is_visible(), "Editor Inteligente de Formatos no visible"
            mpage.select_option("#sfTemplateSelect", "jl304")
            mpage.click("#btnSfApplyProfile")
            assert "ASMAC/DNGDI/CNAR/JL306" in mpage.locator("#sfDocumentSheet").inner_text(), "Hoja JL304 no renderizó en el Editor"
            editor_fit = mpage.evaluate(
                "() => Array.from(document.querySelectorAll('#editor-formatos .editor-format-card')).every(el => el.getBoundingClientRect().right <= window.innerWidth + 1)"
            )
            assert editor_fit, "Tarjetas de editor exceden el ancho móvil"

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
                wpage.goto("http://127.0.0.1:18775/#app", wait_until="networkidle")
                dismiss_consent(wpage)
                badge = wpage.locator("#appDetectedOsBadge").inner_text()
                assert "iPhone / iPad" in badge, f"iOS detection failed: {badge}"
                assert wpage.locator("#iosOfflineCard").is_visible(), "iOS offline card no visible"
                wctx.close()
                wbrowser.close()
    finally:
        server.shutdown()

    assert not telemetry_reqs, f"Fuga de telemetría en localhost: {telemetry_reqs}"
    assert not errors, f"Errores en consola/JS: {errors}"
    print("SMOKE_E2E_OK", {"webkit": test_webkit, "errors": len(errors), "telemetry_leaks": len(telemetry_reqs)})


if __name__ == "__main__":
    run_e2e("--webkit" in sys.argv)
