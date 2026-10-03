"""Cold-load measurements and saved-hero/lazy-book regressions in an isolated browser.

Run after build:android-web, or pass --target source. No family data or services are used.
"""
import argparse
import functools
import http.server
import importlib.util
import json
import threading
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recovery", ROOT / "scripts/check-architecture-recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


def measure(browser, base, throttled):
    context = recovery.context_for(browser)
    page = context.new_page()
    page.set_default_timeout(60000)
    session = context.new_cdp_session(page)
    session.send("Network.enable")
    session.send("Network.setCacheDisabled", {"cacheDisabled": True})
    if throttled:
        session.send("Network.emulateNetworkConditions", {
            "offline": False, "latency": 100,
            "downloadThroughput": 125000, "uploadThroughput": 62500,
        })
        session.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    page.add_init_script("""new PerformanceObserver(list => {
        window.longTasks = (window.longTasks || []).concat(list.getEntries().map(e => e.duration));
    }).observe({type:'longtask',buffered:true});""")
    started = time.perf_counter()
    page.goto(base, wait_until="domcontentloaded")
    page.wait_for_selector(".hero")
    home_seconds = time.perf_counter() - started
    startup = page.evaluate("""() => ({
        requests:performance.getEntriesByType('resource').length,
        bytes:performance.getEntriesByType('resource').reduce((sum,e)=>sum+e.encodedBodySize,0),
        longTasks:window.longTasks||[],
        deferred:!window.supabase && !window.SPACE_CARDS && !window.MINECRAFT_SPREADS
    })""")
    assert startup["deferred"], "Cloud SDK and book content should not load on local startup"
    started = time.perf_counter()
    page.locator(".hero").first.click()
    recovery.wait_world(page)
    world_seconds = time.perf_counter() - started
    assert not page.evaluate("performance.getEntriesByType('resource').some(e=>e.name.includes('/dist/mobile/'))"), "World boot must not wait for the lesson catalog"
    result = dict(throttled=throttled, homeSeconds=round(home_seconds, 3),
                  worldSeconds=round(world_seconds, 3), startup=startup)
    context.close()
    return result


def regressions(browser, base):
    context = recovery.context_for(browser)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base, wait_until="domcontentloaded")
    page.locator(".hero").first.click()
    recovery.wait_world(page)
    child = page.evaluate("SummerQuest.getCurrentChild().id")
    page.locator("#worldHeroes").click()
    recovery.wait_screen(page, "home")
    page.reload(wait_until="domcontentloaded")
    recovery.wait_world(page)
    assert page.evaluate("SummerQuest.getCurrentChild().id") == child
    restarted = context.new_page()
    restarted.goto(base, wait_until="domcontentloaded")
    recovery.wait_world(restarted)
    assert restarted.evaluate("SummerQuest.getCurrentChild().id") == child
    restarted.close()

    # Load just the requested book, then preserve that reading position on reload.
    assert page.evaluate("SummerQuest.openBook('animals')")["ok"]
    recovery.wait_screen(page, "book")
    assert page.evaluate("!!window.ANIMALS_CARDS && !window.MINECRAFT_SPREADS")
    page.reload(wait_until="domcontentloaded")
    recovery.wait_screen(page, "book")
    assert "Animals" in page.locator("#bookTitle").inner_text()
    assert page.evaluate("SummerQuest.openBook('minecraft')")["ok"]
    assert page.locator(".mcraft-page").count() == 2

    # A failed deferred download is retryable and leaves the current view intact.
    page.route("**/js/books/space-data.js", lambda route: route.abort())
    assert page.evaluate("SummerQuest.openBook('space')")["reason"] == "launch_failed"
    assert "Minecraft" in page.locator("#bookTitle").inner_text()
    page.unroute("**/js/books/space-data.js")
    assert page.evaluate("SummerQuest.openBook('space')")["ok"]
    assert "Space" in page.locator("#bookTitle").inner_text()

    held = []
    for book in ("construction", "giraffe"):
        page.route(f"**/js/books/{book}-data.js", lambda route: held.append(route))
    page.evaluate("window.firstBook=SummerQuest.openBook('construction'); window.lastBook=SummerQuest.openBook('giraffe'); true")
    deadline = time.perf_counter() + 5
    while len(held) < 2 and time.perf_counter() < deadline:
        page.wait_for_timeout(25)
    assert len(held) == 2
    first = next(route for route in held if "construction" in route.request.url)
    first.fulfill(content_type="application/javascript", body=(ROOT / "js/books/construction-data.js").read_text(encoding="utf-8"))
    assert page.evaluate("window.firstBook")["reason"] == "launch_cancelled"
    last = next(route for route in held if "giraffe" in route.request.url)
    last.fulfill(content_type="application/javascript", body=(ROOT / "js/books/giraffe-data.js").read_text(encoding="utf-8"))
    assert page.evaluate("window.lastBook")["ok"]
    assert "Giraffe" in page.locator("#bookTitle").inner_text()

    # A failed book resume lands in the child's Books menu with a retry control.
    page.route("**/js/books/giraffe-data.js", lambda route: route.abort())
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector("#tab-books:not(.hidden)")
    assert page.evaluate("SummerQuest.getCurrentChild().id") == child

    # Invalid persisted profiles do not crash or silently select another child.
    page.evaluate("localStorage.setItem('sq:kid','missing-child')")
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".hero")
    recovery.wait_screen(page, "home")
    assert not errors, errors
    context.close()

    # Cached PINs remain enforced when switching heroes; remembered hero stays trusted.
    context = recovery.context_for(browser, seed={"sq:kidPins": json.dumps({"lucien": "2468"})})
    page = context.new_page()
    page.goto(base, wait_until="domcontentloaded")
    page.locator(".hero").first.click()
    page.wait_for_selector("#pinTry")
    page.locator("#pinTry").fill("2468")
    page.locator("#pinGo").click()
    recovery.wait_world(page)
    page.reload(wait_until="domcontentloaded")
    recovery.wait_world(page)
    assert not page.locator("#pinTry").count()
    context.close()

    # An already selected hero opens while fonts and cloud reads are still stalled.
    context = recovery.context_for(browser, seed={"sq:kid": "lili", "sq:view": "home"})
    page = context.new_page()
    stalled = []
    page.route("**/js/config.js", lambda route: route.fulfill(content_type="application/javascript", body="window.SQ_CONFIG={SUPABASE_URL:'https://sync.invalid',SUPABASE_ANON_KEY:'test-anon-key'};"))
    page.route("https://sync.invalid/**", lambda route: stalled.append(route))
    page.route("https://fonts.googleapis.com/**", lambda route: stalled.append(route))
    page.goto(base, wait_until="domcontentloaded", timeout=5000)
    recovery.wait_world(page)
    assert page.evaluate("SummerQuest.getCurrentChild().id") == "lili"
    assert not page.evaluate("store.hydrated")
    assert any("sync.invalid" in route.request.url for route in stalled)
    for route in stalled:
        route.abort()
    context.close()
    return ["saved hero survives reload and new tab", "books load on demand and resume",
            "failed book download retries", "latest book request wins", "failed resume keeps child selected",
            "invalid hero falls back", "PIN policy preserved", "slow fonts and cloud do not block saved hero"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", required=True)
    parser.add_argument("--target", choices=["source", "web"], default="web")
    parser.add_argument("--out", type=Path, default=ROOT / "test-results/performance/after.json")
    args = parser.parse_args()
    directory = ROOT if args.target == "source" else ROOT / "dist/android-web"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(recovery.Handler, directory=str(directory)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    report = {"target": args.target, "ok": False}
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            base = f"http://127.0.0.1:{server.server_port}"
            try:
                report["measurements"] = [measure(browser, base, slow) for slow in (False, True)]
                report["checks"] = regressions(browser, base)
            finally:
                browser.close()
            report["ok"] = True
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
