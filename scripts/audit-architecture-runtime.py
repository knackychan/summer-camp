"""Run architecture recovery checks in isolated browser contexts.

Default: current source/web/native checks in check-architecture-recovery.py.
--historical: original audit reproduction (including its obsolete shell expectations).
No builds, existing browser profiles, native state, or remote services are changed.
Requires the workstation's existing Python Playwright and an installed browser.
"""
import argparse
import functools
import http.server
import json
import threading
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def snapshot(page):
    return page.evaluate("""() => ({
        pathname: location.pathname,
        screens: ['home','world','hub','game','book','music','act'].filter(id => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        }),
        heroes: document.querySelectorAll('.hero').length,
        worlds: document.querySelectorAll('#worldMount canvas').length,
        worldError: !!document.querySelector('#worldStatus:not(.hidden)'),
        iframes: document.querySelectorAll('iframe').length,
        shells: document.querySelectorAll('.mobile-app-shell').length,
        flatSelector: document.body.innerText.includes('Where do you want to explore?'),
        legacyBadge: /\\bLEGACY\\b/.test(document.body.innerText),
        registryCount: window.SQContentRegistry ? SQContentRegistry.list().length : null,
        manifestCount: window.SQManifest ? SQManifest.length : 0,
        navigation: window.SQAppNavigation ? SQAppNavigation.getSurface().surface : null
    })""")


def probe(browser, base, path, fail_webgl=False):
    context = browser.new_context(viewport={"width": 1024, "height": 768}, service_workers="block")
    if fail_webgl:
        context.add_init_script("""(() => {
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
                return kind.startsWith('webgl') ? null : getContext.call(this, kind, ...args);
            };
        })();""")
    # A fresh profile and local-only config prevent writes to the family's live data.
    def route_request(route):
        url = urlparse(route.request.url)
        if url.path.endswith('/js/config.js'):
            route.fulfill(content_type="application/javascript", body="window.SQ_CONFIG = {};")
        elif url.hostname not in ("127.0.0.1", "localhost"):
            route.abort()
        else:
            route.continue_()
    context.route("**/*", route_request)
    page = context.new_page()
    page.set_default_timeout(8000)
    errors, failures, console_errors, requests = [], [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    page.on("requestfailed", lambda request: requests.append({"path": urlparse(request.url).path, "error": request.failure}))
    page.on("response", lambda response: failures.append({"path": urlparse(response.url).path, "status": response.status}) if response.status >= 400 else None)
    result = {"path": path, "scenario": "WebGL unavailable" if fail_webgl else "normal", "steps": [], "pageErrors": errors, "consoleErrors": console_errors, "httpFailures": failures, "requestFailures": requests}

    def step(name, action, expected):
        try:
            action()
            page.wait_for_timeout(400)
            state = snapshot(page)
            result["steps"].append({"name": name, "ok": expected(state), "state": state})
        except Exception as error:
            result["steps"].append({"name": name, "ok": False, "error": str(error).split('Call log:')[0].strip(), "state": snapshot(page)})

    try:
        page.goto(base + path, wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(1000)
        state = snapshot(page)
        result["startup"] = state
        if state["flatSelector"]:
            result["ok"] = state["shells"] == 1 and state["legacyBadge"]
            return result
        step("game manifest ready", lambda: page.wait_for_function("window.SQManifest && SQManifest.length === 24"), lambda s: s["manifestCount"] == 24)
        if fail_webgl:
            step("WebGL failure stays in world with visible error", lambda: (page.locator('.hero').first.click(), page.wait_for_selector('#worldStatus:not(.hidden)')), lambda s: s["screens"] == ["world"] and s["worldError"] and not s["flatSelector"] and s["shells"] == 0)
            result["ok"] = all(item["ok"] for item in result["steps"]) and not errors
            return result
        step("choose child -> world", lambda: (page.locator('.hero').first.click(), page.wait_for_selector('#worldMount canvas')), lambda s: s["screens"] == ["world"] and s["worlds"] == 1 and not s["worldError"])
        if not result["steps"][-1]["ok"]:
            result["ok"] = False
            return result
        page.evaluate("window.sqTestMode.set(true)")
        for content, screen in [('book:space', 'book'), ('book:animals', 'book'), ('game:calc', 'game'), ('music:piano', 'music')]:
            if snapshot(page)["screens"] != ["world"]:
                break
            step('world -> ' + content, lambda content=content, screen=screen: (page.evaluate("id => SQContentRegistry.open(id, {origin:'world'})", content), page.wait_for_function("id => !document.getElementById(id).classList.contains('hidden')", arg=screen)), lambda s, screen=screen: s["screens"] == [screen] and s["iframes"] == 0 and s["shells"] == 0)
            step(content + ' -> Back -> world', lambda: (page.evaluate('SQPlatform.triggerBack()'), page.wait_for_function("!document.getElementById('world').classList.contains('hidden')")), lambda s: s["screens"] == ["world"] and s["iframes"] == 0)
        result["ok"] = all(step["ok"] for step in result["steps"]) and not errors and not failures
        return result
    except Exception as error:
        result.update(ok=False, error=str(error).split('Call log:')[0].strip())
        return result
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    if args.out.resolve() == (ROOT / 'docs/audits/runtime-probe.json').resolve():
        parser.error('Preserve the original audit capture; choose another --out path.')
    handler = functools.partial(Handler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True, args=['--enable-webgl', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'])
            report = {"browser": browser.version, "serviceWorkers": "blocked", "remoteServices": "blocked", "webgl": "desktop software renderer; not Android evidence", "cases": []}
            for path in ['/index.html', '/dist/android-web/index.html', '/apps/kid/index.html']:
                case = probe(browser, f'http://127.0.0.1:{server.server_port}', path)
                report['cases'].append(case)
                print(path, 'PASS' if case['ok'] else 'FAIL', flush=True)
            for path in ['/index.html', '/dist/android-web/index.html']:
                case = probe(browser, f'http://127.0.0.1:{server.server_port}', path, fail_webgl=True)
                report['cases'].append(case)
                print(path, 'WebGL failure:', 'PASS' if case['ok'] else 'FAIL', flush=True)
            browser.close()
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        return 0 if all(case['ok'] for case in report['cases']) else 1
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)


if __name__ == '__main__':
    import runpy
    import sys
    if '--historical' in sys.argv:
        sys.argv.remove('--historical')
        raise SystemExit(main())
    runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'), run_name='__main__')
