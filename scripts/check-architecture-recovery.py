"""Browser recovery gates. Use audit-architecture-runtime.py --historical for the
original audit. Only isolated synthetic profiles and local HTTP servers are used.
Requires Python Playwright and --browser pointing to a Chromium executable.
"""
import argparse
import functools
import http.server
import json
import math
import threading
import traceback
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {"source": ROOT, "web": ROOT / "dist/android-web",
           "native": ROOT / "apps/android/android/app/src/main/assets/public"}


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        # Also protects config fetches made inside the service worker.
        if urlparse(self.path).path.endswith("/js/config.js"):
            body = b"window.SQ_CONFIG = {};"
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def handle(self):
        try:
            super().handle()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
            pass  # Browser context shutdown closes its persistent connections.

    def log_message(self, *_args):
        pass


def snapshot(page):
    return page.evaluate("""() => ({
        screens:['home','world','hub','game','book','music','act'].filter(id=>!document.getElementById(id).classList.contains('hidden')),
        iframes:document.querySelectorAll('iframe').length,
        shells:document.querySelectorAll('.mobile-app-shell').length,
        flatSelector:document.body.innerText.includes('Where do you want to explore?'),
        hubBackCount:document.querySelectorAll('#hubBack').length,
        navigation:SQAppNavigation.getSurface().surface,
        diagnostics:SummerQuest.getDiagnostics()
    })""")


def invariant(page, screen=None):
    state = snapshot(page)
    assert len(state["screens"]) == 1, state
    assert not screen or state["screens"] == [screen], state
    assert state["iframes"] == state["shells"] == 0, state
    assert not state["flatSelector"] and state["hubBackCount"] == 1, state
    assert state["navigation"] == state["screens"][0], state
    return state


def wait_screen(page, screen):
    page.wait_for_function("id => !document.getElementById(id).classList.contains('hidden')", arg=screen)
    return invariant(page, screen)


def ready(page):
    page.wait_for_function("window.SummerQuest && window.SQContentRegistry && window.SQManifest && SQManifest.some(entry => entry.id === 'kitchen')")
    page.evaluate("SQContentRegistry.ready()")


def world(page):
    return page.evaluate("SummerQuest.getDiagnostics().world")


def wait_world(page):
    wait_screen(page, "world")
    page.wait_for_function("SummerQuest.getDiagnostics().world && SummerQuest.getDiagnostics().world.frames > 0 && SummerQuest.getDiagnostics().world.running")


def back(page, screen, button=None):
    if button:
        page.locator(button).click()
    else:
        assert page.evaluate("SQPlatform.triggerBack()") is True
    wait_screen(page, screen)


def close_overlays(page):
    for _ in range(5):
        if not page.locator("body > .overlay").count():
            return
        assert page.evaluate("SQPlatform.triggerBack()") is True
    assert not page.locator("body > .overlay").count()


def context_for(browser, seed=None, failure=None, offline=False):
    context = browser.new_context(viewport={"width": 1024, "height": 768}, service_workers="allow" if offline else "block")
    if seed:
        context.add_init_script("""(() => {
            if (location.protocol !== 'http:') return;
            if (localStorage.getItem('sq:recoveryFixture')) return;
            for (const [k,v] of Object.entries(%s)) localStorage.setItem(k,v);
            localStorage.setItem('sq:recoveryFixture','1');
        })();""" % json.dumps(seed))
    if failure == "canvas":
        context.add_init_script("""(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(kind,...args) {
                return this.dataset && this.dataset.sqWorld === 'planet' ? null : original.call(this,kind,...args);
            };
        })();""")

    def intercept(route):
        url = urlparse(route.request.url)
        if url.hostname not in ("127.0.0.1", "localhost"):
            route.abort()
        elif route.request.method != "GET":
            route.fulfill(status=405, body="Regression contexts never write to services")
        elif failure == "import" and url.path.endswith("/js/world/world-explorer.js"):
            route.abort()
        elif failure == "config" and url.path.endswith("/js/config.js"):
            route.fulfill(status=404, body="")
        elif failure == "game" and url.path.endswith("/js/games/balloon.js"):
            route.abort()
        else:
            route.continue_()
    context.route("**/*", intercept)
    return context


def step(result, name, action):
    try:
        detail = action()
        passed = not isinstance(detail, dict) or detail.get("passed", True)
        result["steps"].append({"name": name, "ok": passed, "detail": detail})
        print(" ", "PASS" if passed else "FAIL", name, flush=True)
        return passed
    except Exception as error:
        message = str(error).split("Call log:")[0].strip()
        result["steps"].append({"name": name, "ok": False, "error": message, "trace": traceback.format_exc()})
        print("  FAIL", name, message[:220], flush=True)
        return False


def boot(page, base, child=True):
    page.goto(base + "/index.html", wait_until="domcontentloaded")
    ready(page)
    invariant(page, "home")
    assert page.locator(".hero").count() == 3
    if child:
        page.locator(".hero").last.click()
        wait_world(page)


def retired_entry(page, base):
    response = page.request.get(base + "/apps/kid/index.html")
    if response.status == 404:
        return {"prototype": "absent from payload"}
    assert response.ok, response.status
    page.goto(base + "/apps/kid/index.html", wait_until="domcontentloaded")
    page.wait_for_url(base + "/index.html*")
    ready(page)
    invariant(page)
    return {"prototype": "compatibility entry redirects to authoritative root"}


def clickthrough(page):
    page.locator("#worldClassic").click()
    wait_screen(page, "hub")
    rounds = [("games", '#gameRow [data-l="calc"]', "game", "#back"),
              ("books", '[data-book="space"]', "book", "#bookBack"),
              ("books", '[data-book="animals"]', "book", None),
              ("music", '[data-inst="piano"]', "music", "#musicBack"),
              ("acts", '#actGrid [data-i="0"]', "act", "#actBack")]
    for _ in range(2):
        for tab, selector, screen, button in rounds:
            tab_button = page.locator(f'#hubTabs [data-t="{tab}"]')
            if tab_button.is_visible():
                tab_button.click()
            else:
                page.locator('#hubTabs [data-t="adventure"]').click()
                page.locator(f'[data-adventure="{tab}"]').click()
            page.locator(selector).click()
            wait_screen(page, screen)
            back(page, "hub", button)
    back(page, "world", "#hubBack")
    return {"rounds": 2, "launches": 10, "back": "UI buttons and shared native handler"}


def tab_to(page, selector):
    for _ in range(100):
        if page.evaluate("selector => document.activeElement.matches(selector)", selector):
            return
        page.keyboard.press("Tab")
    raise AssertionError("Keyboard cannot reach " + selector)


def keyboard_books(page):
    previous_viewport = page.viewport_size
    page.set_viewport_size({"width": 1280, "height": 720})
    tab_to(page, "#worldClassic")
    page.keyboard.press("Enter")
    wait_screen(page, "hub")
    tab_to(page, '#hubTabs [data-t="adventure"]')
    page.keyboard.press("Enter")
    tab_to(page, '[data-adventure="books"]')
    page.keyboard.press("Enter")
    for book, photo in (("space", "#bookPhotoPane"), ("minecraft", ".mcraft-page.photo")):
        tab_to(page, '[data-book="' + book + '"]')
        page.keyboard.press("Enter")
        wait_screen(page, "book")
        tab_to(page, "#bookViewToggle")
        page.keyboard.press("Enter")
        assert page.locator("#bookGridView").is_visible()
        tab_to(page, '#bookGridView [data-page="2"]')
        page.keyboard.press("Escape")
        invariant(page, "book")
        assert not page.locator("#bookGridView").is_visible()
        assert page.evaluate("document.activeElement.id") == "bookViewToggle"
        page.keyboard.press("Enter")
        tab_to(page, '#bookGridView [data-page="2"]')
        page.keyboard.press("Enter")
        assert page.evaluate("bookState.idx") == 2
        assert page.evaluate("document.activeElement.id") == "bookViewToggle"
        tab_to(page, photo)
        page.keyboard.press("Space")
        assert page.locator(".book-zoom").is_visible()
        for selector in (".book-zoom img", ".z-close", ".z-cap"):
            bounds = page.locator(selector).bounding_box()
            assert bounds and bounds["x"] >= 0 and bounds["y"] >= 0 and bounds["x"] + bounds["width"] <= 1280 and bounds["y"] + bounds["height"] <= 720, (selector, bounds)
        page.keyboard.press("ArrowRight")
        assert page.evaluate("bookState.idx") == 2
        page.keyboard.press("Tab")
        assert page.evaluate("document.activeElement.matches('.z-close')")
        page.keyboard.press("Escape")
        invariant(page, "book")
        assert page.locator(".book-zoom").count() == 0
        assert page.evaluate("selector => document.activeElement.matches(selector)", photo)
        page.keyboard.press("Escape")
        wait_screen(page, "hub")
    page.keyboard.press("Escape")
    wait_world(page)
    page.set_viewport_size(previous_viewport)
    return {"books": ["space", "minecraft"], "input": "Tab, Enter, Space, Escape and ArrowRight", "focus": "reachable cards, page selection and zoom return"}


def keyboard_instruments(page):
    page.locator("#worldClassic").click()
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="music"]').click()
    peaks = {}
    for instrument in ("piano", "moog", "pads"):
        page.locator('[data-inst="' + instrument + '"]').click()
        wait_screen(page, "music")
        page.wait_for_selector("#musicStage .sq-pad" if instrument == "pads" else "#musicStage .sq-key")
        page.evaluate("""async () => {
            const audio = (await import('./js/game-services/audio.js')).getSharedAudio();
            const graph = audio.graph(), analyser = graph.ctx.createAnalyser();
            graph.master.connect(analyser);
            window.desktopAudioPeak = () => {
                const data = new Float32Array(analyser.fftSize);
                analyser.getFloatTimeDomainData(data);
                return Math.max(...data.map(Math.abs));
            };
            window.disconnectDesktopAudio = () => graph.master.disconnect(analyser);
        }""")
        if instrument == "pads":
            page.locator("#musicStage .sq-pad").first.click()
        else:
            tab_to(page, "#musicStage .sq-key-white")
            page.keyboard.down("Enter")
            page.keyboard.down("Enter")  # Holding/repeat must not retrigger.
        page.wait_for_function("desktopAudioPeak() > 0.001")
        peaks[instrument] = page.evaluate("desktopAudioPeak()")
        if instrument != "pads":
            page.keyboard.up("Enter")
            page.wait_for_function("desktopAudioPeak() < 0.00001")
            page.keyboard.down("Space")
            page.wait_for_function("desktopAudioPeak() > 0.001")
            page.keyboard.press("Tab")  # Losing focus releases a held note.
            page.keyboard.up("Space")
            page.wait_for_function("desktopAudioPeak() < 0.00001")
        page.locator("#musicBack").click()
        wait_screen(page, "hub")
        page.wait_for_function("desktopAudioPeak() < 0.00001")
        page.evaluate("disconnectDesktopAudio()")
    page.keyboard.press("Escape")
    wait_world(page)
    return {"signalPeaks": peaks, "exitSilence": True, "keyboard": "Piano/Synth Enter, Space, keyup and blur", "audio": "WebAudio waveform; not a human listening check"}


def knowledge_interaction(page):
    page.locator("#worldClassic").click()
    page.locator('#hubTabs [data-t="adventure"]').click()
    page.locator('[data-adventure="learn"]').click()
    page.locator('[data-knowledge-lesson="science-plants-parts"]').click()
    page.locator('[data-knowledge-item="roots"]').click()
    assert "Roots" in page.locator("#scienceObservation").inner_text()
    page.locator("#scienceHelpOpen").click()
    page.locator("#scienceStartQuestions").click()
    for answer in ("roots", "leaves"):
        page.locator('[data-knowledge-answer="' + answer + '"]').click()
        page.locator("#scienceNext").click()
    page.wait_for_selector("#scienceRepeat")
    assert "2 / 2" in page.locator("#scienceLessonBody").inner_text()
    page.keyboard.press("Escape")
    wait_world(page)
    return {"lesson": "science-plants-parts", "visualClue": True, "localHelp": True, "correctAnswers": 2}


def catalog_sweep(page, origin):
    outcomes = []
    catalog = page.evaluate("SQContentRegistry.list()")
    for kind, count in {"section": 8, "game": 29, "music": 3, "book": 8, "activity": 11,
                        "guide": 3, "lesson": 18, "learning": 2, "reward": 4}.items():
        assert sum(entry["kind"] == kind for entry in catalog) == count, (kind, count)
    # Daily quests vary with the child's plan and today's weekday.
    assert any(entry["kind"] == "quest" for entry in catalog)
    assert len({entry["id"] for entry in catalog}) == len(catalog)
    for entry in catalog:
        item = {"id": entry["id"], "available": entry["available"]}
        try:
            close_overlays(page)
            page.evaluate("origin => SummerQuest.navigate(origin)", origin)
            wait_screen(page, "world" if origin == "world" else "hub")
            before = snapshot(page)["screens"]
            opened = page.evaluate("id => SummerQuest.open(id)", entry["id"])
            item["result"] = opened
            assert isinstance(opened, dict), item
            if not entry["available"]:
                assert opened.get("ok") is False and opened.get("reason"), item
                assert snapshot(page)["screens"] == before, item
            else:
                assert opened.get("ok") is True, item
                kind = entry["kind"]
                screen = {"game": "game", "music": "music", "book": "book", "activity": "act", "guide": "act", "lesson": "hub", "learning": "hub", "section": "hub", "reward": "hub"}.get(kind)
                wait_screen(page, screen) if screen else invariant(page)
                if kind in ("game", "music"):
                    page.wait_for_function("selector => {const el=document.querySelector(selector); return el && el.childElementCount > 0 && !/Still loading/.test(el.innerText);}", arg="#stage" if kind == "game" else "#musicStage")
                if kind == "quest":
                    assert page.locator("#questOverlay").is_visible(), item
                if kind == "lesson":
                    assert page.locator('[data-knowledge-lesson="' + entry["id"].split(":", 1)[1] + '"].is-active').count() == 1, item
                if kind in ("game", "music", "book", "activity", "guide"):
                    back(page, "world" if origin == "world" else "hub")
                else:
                    close_overlays(page)
            item["ok"] = True
        except Exception as error:
            item.update(ok=False, error=str(error).split("Call log:")[0].strip())
            print("   ", origin, entry["id"], "FAIL", item["error"][:160], flush=True)
        outcomes.append(item)
    return {"passed": all(item["ok"] for item in outcomes), "outcomes": outcomes}


def book_assets(page):
    return page.evaluate(r"""async () => {
        await Promise.all(BOOK_SHELF.map(book => loadBook(book)));
        const paths = new Set();
        function walk(value) {
            if (typeof value === 'string') {
                for (const m of value.matchAll(/(?:\.\.\/)?assets\/[^\s"'<>]+?\.(?:png|jpe?g|webp|svg)/g)) paths.add(m[0].replace(/^\.\.\//,''));
            } else if (Array.isArray(value)) value.forEach(walk);
            else if (value && typeof value === 'object') Object.values(value).forEach(walk);
        }
        for (const book of BOOK_SHELF) walk(window[book.data]);
        const failures = [];
        for (const path of paths) {
            try { const img = new Image(); img.src = path; await img.decode(); if (!img.naturalWidth) failures.push(path); }
            catch (_) { failures.push(path); }
        }
        if (paths.size < 178 || failures.length) throw new Error(JSON.stringify({count:paths.size,failures}));
        return {decoded:paths.size,failures};
    }""")


def world_interaction(page):
    page.evaluate("SummerQuest.navigate('world')")
    wait_world(page)
    canvas = page.locator("#worldMount canvas")
    box, before = canvas.bounding_box(), world(page)
    x, y = box["x"] + box["width"] * .6, box["y"] + box["height"] * .5
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x - 170, y + 35, steps=12)
    page.mouse.up()
    page.wait_for_timeout(700)
    rotated = world(page)
    delta = math.dist(before["camera"]["position"], rotated["camera"]["position"])
    assert delta > .5, (before, rotated)
    cdp = page.context.new_cdp_session(page)
    pinch_distances = []
    for distances in ([40, 70, 130, 210], [210, 100, 40, 5]):
        for index, distance in enumerate(distances):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart" if index == 0 else "touchMove", "touchPoints": [{"x": x-distance, "y": y, "id": 1}, {"x": x+distance, "y": y, "id": 2}]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(200)
        pinch_distances.append(world(page)["camera"]["distance"])
    page.wait_for_timeout(500)
    pinched = world(page)
    camera = pinched["camera"]
    assert camera["minDistance"] - .02 <= camera["distance"] <= camera["maxDistance"] + .02, pinched
    assert abs(pinch_distances[0] - pinch_distances[1]) > 1, pinch_distances
    assert pinched["selected"] == rotated["selected"], pinched
    hit = None
    for mark in pinched["landmarks"]:
        if not mark["visible"]:
            continue
        page.mouse.click(mark["x"], mark["y"])
        page.wait_for_timeout(60)
        hit = world(page)["selected"]
        if hit:
            break
    assert hit, pinched
    page.locator("#worldGo").click()
    page.wait_for_function("SummerQuest.getDiagnostics().screen !== 'world' || !!document.getElementById('questOverlay')")
    invariant(page)
    close_overlays(page)
    if snapshot(page)["screens"] != ["world"]:
        back(page, "world")
    wait_world(page)
    page.wait_for_timeout(800)
    saved = world(page)["camera"]
    assert page.evaluate("SummerQuest.openBook('space')")["ok"]
    wait_screen(page, "book")
    paused = world(page)
    page.wait_for_timeout(250)
    assert not paused["running"] and world(page)["frames"] == paused["frames"]
    back(page, "world")
    wait_world(page)
    assert math.dist(saved["position"], world(page)["camera"]["position"]) < .1
    page.set_viewport_size({"width": 768, "height": 1024})
    page.wait_for_timeout(200)
    assert canvas.bounding_box()["height"] > 600
    page.set_viewport_size({"width": 1024, "height": 768})
    page.evaluate("window.dispatchEvent(new Event('summerquest:native-pause'))")
    assert not world(page)["running"]
    page.evaluate("window.dispatchEvent(new Event('summerquest:native-resume'))")
    wait_world(page)
    frames = world(page)["frames"]
    page.set_viewport_size({"width": 800, "height": 600})
    page.wait_for_function("SummerQuest.getDiagnostics().world.frames > %d" % (frames + 5))
    assert canvas.bounding_box()["width"] >= 790 and not page.locator("#worldStatus").is_visible()
    page.set_viewport_size({"width": 1024, "height": 768})
    cdp.detach()
    page.wait_for_timeout(500)
    persisted = world(page)
    page.reload(wait_until="domcontentloaded")
    ready(page)
    wait_world(page)
    assert math.dist(persisted["camera"]["position"], world(page)["camera"]["position"]) < .1
    assert world(page)["selected"] == persisted["selected"]
    for child_index in (0, 2):
        page.locator("#worldHeroes").click()
        invariant(page, "home")
        page.locator(".hero").nth(child_index).click()
        wait_world(page)
        assert page.locator("#worldMount canvas").count() == 1
    return {"dragDelta": delta, "pinchDistances": pinch_distances, "raycastSelection": hit, "resizeRedraw": True, "simulatedNativeLifecycle": True, "cameraReload": True, "childSwitches": 2}


def saved_fixture(view="hub"):
    return {"sq:kid": "luis", "sq:view": view, "sq:hubTab": "books", "sq:kidPins": json.dumps({"luis": "4321"}),
            "keyquest:v2": json.dumps({"progress": {"luis": {"best": {"balloon": 123}, "vocab": {"cat": 4}, "missions": 7}}, "settings": {}}),
            "sq:serverStars": json.dumps({"luis": 40}),
            "sq:queue": json.dumps([{"id": "recovery-fixture-star", "type": "stars", "kid": "luis", "delta": 3, "reason": "synthetic regression"}])}


def saved_state(page, base):
    page.goto(base + "/index.html", wait_until="domcontentloaded")
    ready(page)
    wait_screen(page, "hub")
    assert page.locator("#tab-books").is_visible()
    state = page.evaluate("""() => ({best:SQHost.progress.luis.best.balloon,vocab:SQHost.progress.luis.vocab.cat,missions:SQHost.progress.luis.missions,stars:SQHost.store.starsFor('luis'),queue:SQHost.store.queue})""")
    assert state["best"] == 123 and state["vocab"] == 4 and state["missions"] == 7 and state["stars"] == 43, state
    assert any(op["id"] == "recovery-fixture-star" for op in state["queue"]), state
    return state


def locks(page):
    page.evaluate("SQHost.store.familySettings.catlock_luis_games='Synthetic pause'")
    assert page.evaluate("SummerQuest.openGame('balloon')")["ok"] is False
    for content in ("game:calc", "game:paint", "book:space", "music:moog"):
        assert page.evaluate("id => SQContentRegistry.get(id).available", content), content
        assert page.evaluate("id => SummerQuest.open(id)", content)["ok"], content
        back(page, "hub")
    page.evaluate("SQHost.store.familySettings.applock_luis='Synthetic break'")
    assert page.evaluate("SummerQuest.openGame('calc')")["ok"] is False
    assert page.evaluate("SummerQuest.openBook('space')")["ok"] is False


def pin_flow(page, base):
    boot(page, base, child=False)
    tab_to(page, ".hero:last-child")
    page.keyboard.press("Enter")
    page.keyboard.press("Shift+Tab")
    assert page.evaluate("document.activeElement.id") == "pinCancel"
    page.keyboard.press("Enter")
    assert page.evaluate("document.activeElement.matches('.hero:last-child')")
    page.keyboard.press("Enter")
    page.keyboard.press("Escape")
    assert page.evaluate("document.activeElement.matches('.hero:last-child')")
    page.keyboard.press("Enter")
    page.locator("#pinTry").fill("0000")
    page.keyboard.press("Enter")
    invariant(page, "home")
    assert page.locator("#pinMsg").inner_text()
    page.locator("#pinTry").fill("4321")
    page.keyboard.press("Enter")
    wait_world(page)
    page.reload(wait_until="domcontentloaded")
    ready(page)
    wait_world(page)
    assert page.locator("#pinTry").count() == 0
    page.goto(base + "/books/space.html", wait_until="domcontentloaded")
    page.get_by_role("button", name="← Shelf 書架").click()
    ready(page)
    wait_screen(page, "hub")
    assert page.locator("#tab-books").is_visible()


def age_rules(page, base):
    boot(page, base, child=False)
    page.locator(".hero").first.click()
    wait_world(page)
    restricted = page.evaluate("SQContentRegistry.list().filter(entry => entry.reason === 'age_restricted').map(entry => entry.id)")
    assert restricted, "Youngest child should retain discoverable age-restricted lessons"
    for origin in ("world", "classic"):
        page.evaluate("origin => SummerQuest.navigate(origin)", origin)
        screen = "world" if origin == "world" else "hub"
        wait_screen(page, screen)
        for content in restricted:
            result = page.evaluate("id => SummerQuest.open(id)", content)
            assert result["ok"] is False and result["reason"] == "age_restricted", result
            invariant(page, screen)
    return {"restricted": restricted, "origins": ["world", "classic"]}


def fail_flow(page, base, failure):
    page.goto(base + "/index.html", wait_until="domcontentloaded")
    ready(page)
    page.locator(".hero").last.click()
    if failure in ("canvas", "import"):
        page.wait_for_selector("#worldStatus:not(.hidden)")
        invariant(page, "world")
        assert page.locator("#worldStatus").inner_text().strip()
        page.locator("#worldClassic").click()
        wait_screen(page, "hub")
    else:
        wait_world(page)
        if failure == "game":
            page.evaluate("sqTestMode.set(true)")
            outcome = page.evaluate("SummerQuest.openGame('balloon')")
            assert outcome["ok"] is False and outcome["reason"], outcome
            invariant(page)
            return outcome
        assert page.evaluate("SQHost.store.mode") == "local-only"


def offline_flow(page, base):
    page.goto(base + "/index.html", wait_until="domcontentloaded")
    ready(page)
    wait_world(page)
    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=60000)
    caches = page.evaluate("caches.keys()")
    assert caches
    page.context.set_offline(True)
    page.reload(wait_until="domcontentloaded")
    ready(page)
    wait_world(page)
    images = book_assets(page)
    page.evaluate("sqTestMode.set(true)")
    for content in ("game:calc", "book:animals", "music:pads"):
        assert page.evaluate("id => SummerQuest.open(id)", content)["ok"], content
        back(page, "world")
    # A second document has no live JS module memory from the first one.
    cold = page.context.new_page()
    cold.goto(base + "/index.html", wait_until="domcontentloaded")
    ready(cold)
    wait_world(cold)
    assert cold.evaluate("SQHost.store.starsFor('luis')") == 43
    assert cold.evaluate("SQHost.store.queue.some(op => op.id === 'recovery-fixture-star')")
    cold.close()
    return {"cacheNames": caches, "warmReload": True, "coldDocument": True, "offlineBookImages": images, "offlineContent": ["game:calc", "book:animals", "music:pads"], "scope": "new document in isolated PWA context; physical cold process not tested"}


def run_case(browser, base, name):
    seed = saved_fixture("world" if name == "offline" else "hub") if name in ("state", "offline") else {"sq:kidPins": json.dumps({"luis": "4321"})} if name == "pin" else None
    context = context_for(browser, seed=seed, failure=name, offline=name == "offline")
    result = {"scenario": name, "steps": [], "pageErrors": [], "consoleErrors": [], "httpFailures": [], "requestFailures": [], "shellImports": []}
    def observe(page):
        page.set_default_timeout(12000)
        page.on("pageerror", lambda error: result["pageErrors"].append(str(error)))
        page.on("console", lambda message: result["consoleErrors"].append(message.text) if message.type == "error" else None)
        page.on("response", lambda response: result["httpFailures"].append({"path": urlparse(response.url).path, "status": response.status}) if response.status >= 400 else None)
        page.on("requestfailed", lambda request: result["requestFailures"].append({"url": request.url, "error": request.failure}))
        page.on("request", lambda request: result["shellImports"].append(request.url) if request.resource_type == "script" and any(part in request.url for part in ("/apps/kid/", "/packages/navigation/", "/AppSessionStore.")) else None)
    context.on("page", observe)
    page = context.new_page()
    try:
        if name == "normal":
            if step(result, "fresh Hero -> rendered world", lambda: boot(page, base)):
                page.evaluate("sqTestMode.set(true)")
                step(result, "Classic clicks and repeated UI/native Back", lambda: clickthrough(page))
                step(result, "keyboard book cards, grid, zoom and single Escape", lambda: keyboard_books(page))
                step(result, "instrument keyboard input and audio stops on exit", lambda: keyboard_instruments(page))
                step(result, "knowledge visual clue, local help and two answers", lambda: knowledge_interaction(page))
                step(result, "world camera/pinch/tap/lifecycle/resize redraw", lambda: world_interaction(page))
                for origin in ("world", "classic"):
                    step(result, origin + " every catalog entry", lambda origin=origin: catalog_sweep(page, origin))
                step(result, "all integrated book-data images decode", lambda: book_assets(page))
                def invalid():
                    before = snapshot(page)["screens"]
                    outcome = page.evaluate("SummerQuest.open('game:does-not-exist')")
                    assert outcome["ok"] is False and outcome["reason"], outcome
                    assert snapshot(page)["screens"] == before
                    return outcome
                step(result, "invalid content returns a truthful failure", invalid)
                step(result, "retired entry absent or redirects to root", lambda: retired_entry(page, base))
        elif name == "state":
            step(result, "saved Classic, scores, vocab, missions and pending ledger stars", lambda: saved_state(page, base))
            step(result, "same saved state after reload", lambda: saved_state(page, base))
            step(result, "category exceptions and full app pause", lambda: locks(page))
        elif name == "pin":
            step(result, "wrong/right PIN, saved world and Shelf deep link", lambda: pin_flow(page, base))
        elif name == "ages":
            step(result, "youngest profile age restrictions match launch policy", lambda: age_rules(page, base))
        elif name == "offline":
            step(result, "offline reload, cold document and pending queue", lambda: offline_flow(page, base))
        else:
            step(result, "failure diagnostic and single root surface", lambda: fail_flow(page, base, name))
        expected_console = {"canvas": ("Summer Quest 3D world failed",),
                            "import": ("Summer Quest 3D world failed",),
                            "game": ("game module failed to load: balloon", "Summer Quest game launch failed")}.get(name, ())
        result["unexpectedConsoleErrors"] = [error for error in result["consoleErrors"] if not error.startswith(("Failed to load resource", *expected_console))]
        unexpected_http = [failure for failure in result["httpFailures"] if not (name == "config" and failure["path"].endswith("/js/config.js") and failure["status"] == 404)]
        result["ok"] = all(item["ok"] for item in result["steps"]) and not (result["shellImports"] or result["pageErrors"] or result["unexpectedConsoleErrors"] or unexpected_http)
        return result
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "apps/android/.reports/architecture-recovery-runtime.json")
    parser.add_argument("--target", choices=["auto", *TARGETS], default="auto")
    parser.add_argument("--scenario", choices=["all", "normal", "state", "ages", "failures", "offline"], default="all")
    args = parser.parse_args()
    if args.out.resolve() == (ROOT / "docs/audits/runtime-probe.json").resolve():
        parser.error("Preserve original evidence; choose another --out path.")
    targets = TARGETS if args.target == "auto" else {args.target: TARGETS[args.target]}
    report = {"remoteServices": "blocked; synthetic config also served to service workers", "world": "2D canvas pixel planet; desktop Chromium is not Android hardware evidence", "targets": [], "unavailable": []}
    scenarios = {"normal": ["normal"], "state": ["state", "pin"], "ages": ["ages"], "failures": ["canvas", "import", "config", "game"], "offline": ["offline"]}
    names = sum(scenarios.values(), []) if args.scenario == "all" else scenarios[args.scenario]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.browser, headless=True, args=["--enable-webgl", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
        report["browser"] = browser.version
        for label, directory in targets.items():
            if not (directory / "index.html").is_file():
                report["unavailable"].append({"target": label, "path": str(directory), "reason": "payload absent"})
                print(label, "UNAVAILABLE", flush=True)
                continue
            # Chromium opens many local asset connections at startup; Python's
            # five-slot default backlog can refuse them on Windows.
            http.server.ThreadingHTTPServer.request_queue_size = 128
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=str(directory)))
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            target = {"target": label, "path": str(directory), "cases": []}
            report["targets"].append(target)
            try:
                for name in names:
                    print(label, name, "RUN", flush=True)
                    case = run_case(browser, f"http://127.0.0.1:{server.server_port}", name)
                    target["cases"].append(case)
                    print(label, name, "PASS" if case["ok"] else "FAIL", flush=True)
                    args.out.parent.mkdir(parents=True, exist_ok=True)
                    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            finally:
                server.shutdown()
                server.server_close()
                worker.join(timeout=2)
        browser.close()
    report["ok"] = bool(report["targets"]) and all(case["ok"] for target in report["targets"] for case in target["cases"])
    if args.target != "auto" and report["unavailable"]:
        report["ok"] = False
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
