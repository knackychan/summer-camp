"""Verify the first visible screen without waiting for the rest of the app.

Uses isolated profiles and the recovery server; no family services are contacted.
Run with --browser <Chromium executable> --target source (or web after a build).
"""
import argparse
import base64
import functools
import http.server
import importlib.util
import json
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recovery", ROOT / "scripts/check-architecture-recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

MEASURE = """(() => {
  const result = window.instantStartup = {heroMs:null,loadingMs:null,fcpMs:null,clickMs:null,feedbackMs:null};
  const visible = selector => {
    const el = document.querySelector(selector);
    if (!el || !el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  };
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) if (entry.name === 'first-contentful-paint') result.fcpMs = entry.startTime;
  }).observe({type:'paint',buffered:true});
  document.addEventListener('click', event => {
    if (event.target.closest('#heroes .hero')) result.clickMs = performance.now();
  }, true);
  function sample() {
    if (result.heroMs === null && visible('#heroes .hero[data-kid]')) result.heroMs = performance.now();
    if (visible('#bootStatus')) {
      if (result.loadingMs === null) result.loadingMs = performance.now();
      if (result.clickMs !== null && result.feedbackMs === null) result.feedbackMs = performance.now() - result.clickMs;
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
})();"""


def check(browser, base, screenshot_dir, *, stalled=False, saved=False):
    seed = {"sq:kidPins": json.dumps({"lucien": "2468"})}
    if saved:
        seed.update({"sq:kid": "lili", "sq:view": "home"})
    context = recovery.context_for(browser, seed=seed)
    page = context.new_page()
    page.set_viewport_size({"width": 768, "height": 1024})
    page.set_default_timeout(15000)
    page.add_init_script(MEASURE)
    errors, held = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    if stalled:
        page.route("**/js/config.js", lambda route: held.append(route))
        page.route("**/css/*.css", lambda route: held.append(route))
    session = context.new_cdp_session(page)
    session.send("Network.enable")
    session.send("Network.setCacheDisabled", {"cacheDisabled": True})
    session.send("Network.emulateNetworkConditions", {
        "offline": False, "latency": 100,
        "downloadThroughput": 125000, "uploadThroughput": 62500,
    })
    session.send("Emulation.setCPUThrottlingRate", {"rate": 4})
    def screenshot(name):
        # Playwright screenshots wait for fonts, which these tests deliberately stall.
        image = session.send("Page.captureScreenshot", {"format": "png"})
        (screenshot_dir / name).write_bytes(base64.b64decode(image["data"]))

    result = {"stalled": stalled, "savedChild": saved, "ok": False}
    try:
        # DOMContentLoaded waits for the runtime. It cannot measure this requirement.
        page.goto(base + "/index.html", wait_until="commit")
        first = "loadingMs" if saved else "heroMs"
        page.wait_for_function("key => window.instantStartup && instantStartup[key] !== null && instantStartup.fcpMs !== null", arg=first)
        timing = page.evaluate("window.instantStartup")
        result["firstContentfulPaintMs"] = round(timing["fcpMs"], 1)
        result["firstScreenMs"] = round(timing[first], 1)
        assert timing[first] < 1000, f"First screen appeared at {timing[first]:.1f}ms"
        assert timing["fcpMs"] < 1000, f"First contentful paint took {timing['fcpMs']:.1f}ms"

        if saved:
            assert page.locator("#bootStatus").is_visible()
            assert not page.locator("#heroes .hero:visible").count(), "Returning child should see loading, without choosing again"
            assert page.evaluate("localStorage.getItem('sq:kid')") == "lili"
        else:
            assert page.locator("#heroes .hero[data-kid]:visible").count() == 3
            assert page.evaluate("typeof SQBoot.choose === 'function'")
            if stalled:
                screenshot("instant-heroes-768x1024.png")
            page.locator('#heroes .hero[data-kid="lucien"]').click()
            page.wait_for_function("instantStartup.feedbackMs !== null")
            result["clickFeedbackMs"] = round(page.evaluate("instantStartup.feedbackMs"), 1)
            assert result["clickFeedbackMs"] < 250, result
            assert page.locator("#bootStatus").is_visible(), "Click must visibly acknowledge the selection"
            assert page.evaluate("SQBoot.requestedKid") == "lucien"
            assert page.evaluate("localStorage.getItem('sq:kid')") is None, "Early selection must wait for PIN validation"

        if stalled:
            deadline = time.perf_counter() + 5
            while time.perf_counter() < deadline:
                paths = [urlparse(route.request.url).path for route in held]
                if "/js/config.js" in paths and any(path.endswith(".css") for path in paths):
                    break
                page.wait_for_timeout(25)
            result["heldRequests"] = paths
            assert "/js/config.js" in paths and any(path.endswith(".css") for path in paths), paths
            assert page.evaluate("typeof window.SummerQuest") == "undefined", "Runtime should still be blocked"
            assert page.locator("#bootStatus").is_visible(), "Loading remains visible while downloads are stalled"
            name = "instant-returning-loading-768x1024.png" if saved else "instant-selected-loading-768x1024.png"
            screenshot(name)
        else:
            # The early click must hand over to the existing PIN flow when ready.
            page.wait_for_selector("#pinTry", timeout=60000)
            assert page.evaluate("localStorage.getItem('sq:kid')") is None
        assert not errors, errors
        result["ok"] = True
    except Exception as error:
        result["error"] = str(error)
        result["pageErrors"] = errors
    finally:
        # Keep them pending through every assertion, then settle the route callbacks.
        for route in held:
            route.abort()
        context.close()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", required=True)
    parser.add_argument("--target", choices=["source", "web"], default="source")
    parser.add_argument("--out", type=Path, default=ROOT / "test-results/performance/instant-startup.json")
    args = parser.parse_args()
    directory = ROOT if args.target == "source" else ROOT / "dist/android-web"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(recovery.Handler, directory=str(directory)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    report = {"target": args.target, "network": "100ms latency, 1Mbps download", "cpuSlowdown": 4, "checks": []}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                for stalled, saved in [(False, False), (True, False), (True, True)]:
                    result = check(browser, base, args.out.parent, stalled=stalled, saved=saved)
                    report["checks"].append(result)
                    print(json.dumps(result), flush=True)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
        report["ok"] = len(report["checks"]) == 3 and all(check["ok"] for check in report["checks"])
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
