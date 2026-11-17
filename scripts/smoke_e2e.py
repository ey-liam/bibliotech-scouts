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

            # Verificar v9.0.0: cero emojis visibles, botón único Preguntas al azar con clase btn-shuffle-questions,
            # enlace ¿Qué es BiblioTech?, Proyecto sin fines de lucro, #btnReportDoc en lector y banner de actualización
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
            page.evaluate("window.__btShowUpdateBanner('Prueba E2E de actualización 9.0.0')")
            assert not page.locator("#updateAvailableBanner").evaluate("el => el.classList.contains('hidden')"), "Banner de actualización no se mostró"
            page.click("#btnDismissAppUpdate")
            assert page.locator("#updateAvailableBanner").evaluate("el => el.classList.contains('hidden')"), "Banner de actualización no se cerró"

            # Probar botón Reportar dentro del visor de archivos (#docModal -> #btnReportDoc)
            page.locator("#libraryBookshelfGrid .book-read-btn").first.click()
            page.wait_for_selector("#docModal:not(.hidden)", timeout=4000)
            page.click("#btnReportDoc")
            page.wait_for_selector("#bugReportModal:not(.hidden)", timeout=4000)
            assert page.locator("#bugReportSection").input_value() == "Lector / Visor PDF o Excel", "No prellenó apartado Lector"
            page.click("#closeBugReportBtn")
            page.locator("#bugReportModal").wait_for(state="hidden", timeout=2000)
            page.click("#closeDocModalBtn")
            page.locator("#docModal").wait_for(state="hidden", timeout=2000)

            # Probar búsqueda
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

            # Probar atajo '/' y modo oscuro
            page.keyboard.press("Escape")
            page.click("#btnToggleCampMode")
            assert page.evaluate("document.documentElement.getAttribute('data-camp-mode') === 'true'"), "Dark mode failed"

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
            page.locator("#bugReportModal").wait_for(state="hidden", timeout=4000)

            # Probar Bóveda Local de Autollenado y vista previa (#editor-formatos)
            page.fill("#afName", "Liam Durán Prueba")
            page.fill("#afAge", "16")
            page.fill("#afGroup", "Grupo 53")
            page.fill("#afProvince", "Tláhuac-Xochimilco")
            page.click("#btnSaveAutofillProfile")
            assert "Perfil listo" in page.locator("#autofillStatusBadge").inner_text(), "No actualizó estado autofill"
            page.click("#btnPreviewAutofillDemo")
            page.wait_for_selector("#autofillDemoPreview:not(.hidden)", timeout=3000)
            assert "Liam Durán Prueba" in page.locator("#autofillDemoPreview").inner_text(), "Demo autofill sin datos"

            # Probar Foro La Fogata (#foro): filtros, datos reales obligatorios, modo anónimo, edición, comentarios, likes y banderita de reporte
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
            page.locator("#bugReportModal").wait_for(state="hidden", timeout=4000)

            # Vista 1200px sin desborde
            page.set_viewport_size({"width": 1200, "height": 820})
            page.wait_for_timeout(150)
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Desktop 1200px horizontal overflow"

            # Vista móvil 390x844 sin desborde
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.on("pageerror", lambda err: errors.append(f"mobile pageerror: {err}"))
            mpage.goto("http://127.0.0.1:18775/", wait_until="networkidle")
            dismiss_consent(mpage)
            assert mpage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile horizontal overflow"
            mpage.locator("#foro").scroll_into_view_if_needed()
            forum_fit = mpage.evaluate(
                "() => Array.from(document.querySelectorAll('#foro .forum-post-card, #editor-formatos .editor-format-card')).every(el => el.getBoundingClientRect().right <= window.innerWidth + 1)"
            )
            assert forum_fit, "Tarjetas de foro o editor exceden el ancho móvil"
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
                wpage.goto("http://127.0.0.1:18775/", wait_until="networkidle")
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
