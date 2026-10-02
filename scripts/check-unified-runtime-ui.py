#!/usr/bin/env python3
from __future__ import annotations
import argparse, contextlib, http.server, json, os, socketserver, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "dist" / "android-web"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

@contextlib.contextmanager
def server(port: int):
    cwd = os.getcwd()
    os.chdir(WEB)
    try:
        httpd = socketserver.TCPServer(("127.0.0.1", port), QuietHandler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield
        finally:
            httpd.shutdown(); httpd.server_close(); thread.join(timeout=2)
    finally:
        os.chdir(cwd)

def visible(page, selector: str) -> bool:
    return page.locator(selector).is_visible()

def run(browser_path: str, port: int, out: Path):
    results = []
    errors = []
    out.mkdir(parents=True, exist_ok=True)
    with server(port), sync_playwright() as p:
        browser = p.chromium.launch(executable_path=browser_path, headless=True, args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1024, "height": 768})
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: errors.append(f"console:{msg.type}: {msg.text}") if msg.type == "error" else None)
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="domcontentloaded")
        page.wait_for_selector(".hero")
        results.append(("heroes", page.locator(".hero").count() == 3))
        results.append(("no_secondary_shell", page.locator(".mobile-app-shell").count() == 0 and page.locator("iframe").count() == 0))

        page.locator(".hero").first.click()
        page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        page.evaluate("window.sqTestMode && window.sqTestMode.set(true)")
        page.wait_for_function("window.SQManifest && window.SQManifest.length > 0")
        page.wait_for_function("window.SQContentRegistry && window.SQContentRegistry.list().length > 10")
        catalog = page.evaluate("window.SQContentRegistry.list().map(x => ({id:x.id,kind:x.kind,zone:x.zone,available:x.available}))")
        kinds = {item["kind"] for item in catalog}
        results.append(("content_registry", {"section","game","book","activity","music"}.issubset(kinds)))

        # Books: real root book -> native/shared Back -> same hub, no nested shell.
        page.locator('[data-t="books"]').click()
        page.locator('[data-book="space"]').click()
        page.wait_for_function("!document.getElementById('book').classList.contains('hidden')")
        results.append(("book_opens", visible(page, "#book")))
        handled = page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        results.append(("book_back", handled is True and visible(page, "#hub")))

        # Music: real instrument surface -> Back -> hub.
        page.locator('[data-t="music"]').click()
        page.wait_for_selector('#musicGrid .gamecard[data-inst]')
        page.locator('#musicGrid .gamecard[data-inst]').first.click()
        page.wait_for_function("!document.getElementById('music').classList.contains('hidden')")
        results.append(("music_opens", visible(page, "#music")))
        handled = page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        results.append(("music_back", handled is True and visible(page, "#hub")))

        # Games: test mode guarantees access. Open a real Brain Gym tile and Back.
        page.locator('[data-t="games"]').click()
        page.wait_for_selector('#gameRow .gamecard[data-l="calc"]')
        page.locator('#gameRow .gamecard[data-l="calc"]').click()
        page.wait_for_function("!document.getElementById('game').classList.contains('hidden')")
        results.append(("game_opens", visible(page, "#game")))
        handled = page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        results.append(("game_back", handled is True and visible(page, "#hub")))

        # Repeat menu/content cycles: regression for shell-in-shell/back-chevron accumulation.
        for _ in range(3):
            page.locator('[data-t="books"]').click(); page.locator('[data-book="space"]').click()
            page.wait_for_function("!document.getElementById('book').classList.contains('hidden')")
            page.evaluate("window.SQPlatform.triggerBack()")
            page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        results.append(("no_iframe_recursion_after_repeats", page.locator("iframe").count() == 0 and page.locator("#hubBack").count() == 1))

        page.screenshot(path=str(out / "unified-runtime-tablet.png"), full_page=True)
        browser.close()

    fatal = [e for e in errors if "favicon" not in e.lower()]
    report = {"results": [{"id": k, "ok": v} for k,v in results], "errors": fatal, "ok": all(v for _,v in results) and not fatal}
    (out / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report

if __name__ == "__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--browser", default="/usr/bin/chromium"); ap.add_argument("--port", type=int, default=8143); ap.add_argument("--out", type=Path, default=Path("/mnt/data/v060-unified-ui")); args=ap.parse_args()
    report=run(args.browser,args.port,args.out)
    for item in report["results"]: print(("PASS" if item["ok"] else "FAIL"), item["id"])
    for error in report["errors"]: print("ERROR", error)
    raise SystemExit(0 if report["ok"] else 1)
