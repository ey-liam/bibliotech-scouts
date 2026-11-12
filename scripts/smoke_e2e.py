"""Prueba E2E reproducible (local y GitHub Actions CI) para BiblioTech Scout."""
import functools
import http.server
import socketserver
import sys
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def start_server(port: int = 18775):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def dismiss_consent(page):
    try:
        btn = page.locator("#consentAcceptBtn")
        btn.wait_for(state="visible", timeout=3500)
        btn.click()
        page.locator("#cookieConsentBanner").wait_for(state="hidden", timeout=2000)
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
            page = ctx.new_page()
            page.on("pageerror", lambda err: errors.append(f"pageerror: {err}"))
            page.on("console", lambda msg: errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)

            page.goto("http://127.0.0.1:18775/", wait_until="networkidle")
            dismiss_consent(page)

            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Desktop horizontal overflow"

            # Probar búsqueda
            page.fill("#askInput", "SMART")
            page.click("#askSubmitBtn")
            page.wait_for_selector("#answerContainer:not(.hidden)", timeout=15000)
            ans_text = page.locator("#answerBody").inner_text()
            assert len(ans_text.strip()) > 30, "Respuesta vacía en buscador"

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
            page.locator("#bugReportReasons input[type='checkbox']").first.check(force=True)
            page.fill("#bugReportDetails", "Prueba automatizada E2E de reporte")
            page.click("#submitBugReportBtn")
            page.wait_for_selector("#bugReportStatus.is-ok", timeout=4000)
            page.wait_for_selector("#bugReportModal.hidden", timeout=4000)

            # Vista móvil 390x844 sin desborde
            mctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            mpage = mctx.new_page()
            mpage.on("pageerror", lambda err: errors.append(f"mobile pageerror: {err}"))
            mpage.goto("http://127.0.0.1:18775/", wait_until="networkidle")
            dismiss_consent(mpage)
            assert mpage.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Mobile horizontal overflow"
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
