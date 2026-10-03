"""Focused desktop history regression in an isolated installed browser.

Uses visible controls and browser Back/Forward; evaluate is only for fixtures
and assertions. External services are blocked by the existing recovery helper.
"""
import argparse
import functools
import http.server
import importlib.util
import json
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

spec = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("check-architecture-recovery.py"))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


def history_checks(page, base):
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    recovery.boot(page, base)
    page.locator("#worldClassic").click()
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="books"]').click()
    page.locator('[data-book="animals"]').click()
    recovery.wait_screen(page, "book")
    page.locator("#bookNext").click()
    assert page.locator("#bookSpread img").evaluate("img => img.complete && img.naturalWidth > 0")
    page.go_back()
    recovery.wait_screen(page, "hub")
    assert page.locator("#tab-books").is_visible()
    page.go_forward()
    recovery.wait_screen(page, "book")
    page.reload(wait_until="domcontentloaded")
    recovery.ready(page)
    recovery.wait_screen(page, "book")
    assert "Animals" in page.locator("#bookTitle").inner_text()
    page.locator("#summerCompanion").click()
    page.wait_for_selector("body > .overlay")
    page.go_back()
    page.wait_for_function("!document.querySelector('body > .overlay') && history.state.summerQuest.destination === 'book:animals'")
    recovery.invariant(page, "book")
    page.locator("#bookPhotoPane").click()
    page.go_back()
    page.wait_for_function("!document.querySelector('.book-zoom') && history.state.summerQuest.destination === 'book:animals'")
    recovery.invariant(page, "book")
    page.locator("#bookViewToggle").click()
    page.go_back()
    page.wait_for_function("!bookState.grid && history.state.summerQuest.destination === 'book:animals'")
    recovery.invariant(page, "book")
    page.go_back()
    recovery.wait_screen(page, "hub")
    assert page.locator("#tab-books").is_visible()
    page.go_back()
    page.wait_for_selector("#tab-adventure:not(.hidden)")
    page.go_forward()
    page.wait_for_selector("#tab-books:not(.hidden)")
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="music"]').click()
    page.locator('[data-inst="piano"]').click()
    recovery.wait_screen(page, "music")
    page.go_back()
    recovery.wait_screen(page, "hub")
    assert page.locator("#tab-music").is_visible()
    assert page.evaluate("currentInstrument === null")
    page.go_forward()
    recovery.wait_screen(page, "music")
    page.wait_for_function("currentInstrument && currentInstrument.id === 'piano'")
    page.reload(wait_until="domcontentloaded")
    recovery.ready(page)
    recovery.wait_screen(page, "music")
    page.wait_for_function("currentInstrument && currentInstrument.id === 'piano'")
    page.go_back()
    recovery.wait_screen(page, "hub")
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="games"]').click()
    # Paint keeps its established Brain Gym exception, requiring no test mode.
    page.locator('#gameRow [data-l="paint"]').click()
    recovery.wait_screen(page, "game")
    page.go_back()
    recovery.wait_screen(page, "hub")
    assert page.locator("#tab-games").is_visible()
    assert page.evaluate("currentGame === null")
    page.go_forward()
    recovery.wait_screen(page, "game")
    page.go_back()
    recovery.wait_screen(page, "hub")
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="acts"]').click()
    page.locator('#actGrid [data-i="0"]').click()
    recovery.wait_screen(page, "act")
    page.go_back()
    recovery.wait_screen(page, "hub")
    # Simulate a parent changing access while an entry is in browser history.
    page.evaluate("SQHost.store.familySettings.catlock_luis_acts='Synthetic history gate'")
    page.go_forward()
    page.wait_for_function("!browserPlaceRestoring")
    recovery.invariant(page, "hub")
    assert page.locator("#tab-quests").is_visible()
    assert page.evaluate("currentGame === null")
    page.locator("#hubBack").click()
    recovery.wait_world(page)
    page.locator("#worldHeroes").click()
    recovery.wait_screen(page, "home")
    page.locator(".hero").first.click()
    page.locator("#pinTry").fill("0000")
    page.locator("#pinGo").click()
    recovery.invariant(page, "home")
    assert page.locator("#pinMsg").inner_text()
    page.locator("#pinTry").fill("2468")
    page.locator("#pinGo").click()
    recovery.wait_world(page)
    assert page.evaluate("SummerQuest.getCurrentChild().id") == "lucien"
    page.go_back()
    recovery.wait_screen(page, "home")
    page.go_back()
    page.wait_for_function("!browserPlaceRestoring")
    recovery.invariant(page, "home")
    assert page.evaluate("localStorage.getItem('sq:kid')") == "lucien"
    saved_index = page.evaluate("history.state.index")
    page.reload(wait_until="domcontentloaded")
    recovery.ready(page)
    recovery.wait_world(page)
    assert page.evaluate("history.state.index") == saved_index
    assert page.evaluate("JSON.parse(localStorage.getItem('sq:kidPins')).lucien") == "2468"
    page.locator("#summerCompanion").click()
    page.wait_for_selector("body > .overlay")
    page.go_back()
    page.wait_for_function("!document.querySelector('body > .overlay') && !browserPlaceUndo")
    recovery.invariant(page, "world")
    assert page.evaluate("history.state.index") == saved_index
    initial = page.context.new_page()
    initial.goto(base + "/manifest.webmanifest")
    initial.goto(base + "/index.html", wait_until="domcontentloaded")
    recovery.ready(initial)
    recovery.wait_world(initial)
    initial.go_back()
    assert initial.url.endswith("/manifest.webmanifest"), initial.url
    initial.close()
    assert not errors, errors
    return {"passed": True, "checks": ["hero/world/Classic/books through visible controls",
            "browser Back/Forward across tabs, books, games and instruments",
            "reload restores current book and instrument history entry",
            "Back dismisses overlays, zoom and book grid once without leaving the book",
            "Back from the initial home leaves the application naturally",
            "outgoing game/instrument teardown", "changed access checked on Forward",
            "wrong/right PIN and cross-child history cannot restore the prior child"],
            "pageErrors": errors}


def placement_history_checks(page, base):
    recovery.boot(page, base)
    page.locator("#worldClassic").click()
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="learn"]').click()
    before = page.evaluate("({stars:SQHost.store.starsFor('luis'),queue:SQHost.store.queue})")
    page.locator("#placementStart").click()
    recovery.wait_screen(page, "game")
    page.wait_for_function("learningDirectorLaunch && learningDirectorLaunch.flow === 'placement'")
    assert page.evaluate("history.state.summerQuest.destination") == "learning:placement"
    page.go_back()
    recovery.wait_screen(page, "hub")
    page.go_forward()
    page.wait_for_function("!browserPlaceRestoring")
    recovery.invariant(page, "hub")
    assert page.locator("#tab-learn").is_visible()
    assert page.evaluate("currentGame === null && learningDirectorLaunch === null")
    page.locator("#placementStart").click()
    recovery.wait_screen(page, "game")
    page.wait_for_function("learningDirectorLaunch && learningDirectorLaunch.flow === 'placement'")
    page.reload(wait_until="domcontentloaded")
    recovery.ready(page)
    recovery.wait_screen(page, "hub")
    assert page.locator("#tab-learn").is_visible()
    assert page.evaluate("currentGame === null && learningDirectorLaunch === null")
    assert page.evaluate("({stars:SQHost.store.starsFor('luis'),queue:SQHost.store.queue})") == before
    return "Placement Back/Forward and reload return to its saved learning session without arcade rewards"


def failed_history_checks(page, base):
    recovery.boot(page, base)
    page.locator("#worldClassic").click()
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="games"]').click()
    page.locator('#gameRow [data-l="paint"]').click()
    recovery.wait_screen(page, "game")
    page.wait_for_function("currentGame && currentGame.id === 'paint'")
    page.context.route("**/js/games/paint.js", lambda route: route.abort())
    page.reload(wait_until="domcontentloaded")
    recovery.ready(page)
    page.wait_for_selector("#game:not(.hidden) .msg")
    assert "Could not open" in page.locator("#game").inner_text()
    recovery.invariant(page, "game")
    page.locator("#back").click()
    recovery.wait_screen(page, "hub")
    page.context.unroute("**/js/games/paint.js")
    page.reload(wait_until="domcontentloaded")
    recovery.ready(page)
    page.locator('#gameRow [data-l="paint"]').click()
    recovery.wait_screen(page, "game")
    page.wait_for_function("currentGame && currentGame.id === 'paint'")
    return "Failed module on history reload keeps its visible error, Back works and retry recovers"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", required=True)
    parser.add_argument("--target", choices=["source", "web"], default="source")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--out", type=Path, default=recovery.ROOT / ".tmp/desktop-history.json")
    args = parser.parse_args()
    directory = recovery.TARGETS[args.target]
    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(recovery.Handler, directory=str(directory)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    report = {"target": args.target, "headed": not args.headless}
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=args.headless,
                    args=["--enable-webgl", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
            report["browser"] = browser.version
            context = recovery.context_for(browser, seed={"sq:kidPins": json.dumps({"lucien": "2468"})})
            page = context.new_page()
            page.set_default_timeout(15000)
            report.update(history_checks(page, f"http://127.0.0.1:{server.server_port}"))
            context.close()
            for check in (placement_history_checks, failed_history_checks):
                context = recovery.context_for(browser)
                page = context.new_page()
                page.set_default_timeout(15000)
                report["checks"].append(check(page, f"http://127.0.0.1:{server.server_port}"))
                context.close()
            browser.close()
    except Exception as error:
        report.update(passed=False, error=str(error))
        raise
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
