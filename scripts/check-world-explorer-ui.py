#!/usr/bin/env python3
from __future__ import annotations
import argparse, contextlib, http.server, json, os, socketserver, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "dist" / "android-web"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

@contextlib.contextmanager
def server(port: int):
    cwd = os.getcwd(); os.chdir(WEB)
    try:
        # Threaded: the runtime loads dozens of ES modules at once and a single-threaded
        # server refuses the overflow (ERR_CONNECTION_REFUSED), which looked like a dead world.
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), QuietHandler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True); thread.start()
        try: yield
        finally: httpd.shutdown(); httpd.server_close(); thread.join(timeout=2)
    finally:
        os.chdir(cwd)

def visible(page, selector: str) -> bool:
    return page.locator(selector).is_visible()

def run(browser_path: str, port: int, out: Path, file_mode: bool=False):
    # Resolve before server() chdirs into the payload, or screenshots land inside dist/android-web.
    out=out.resolve(); results=[]; errors=[]; out.mkdir(parents=True, exist_ok=True)
    with server(port), sync_playwright() as p:
        browser=p.chromium.launch(executable_path=browser_path, headless=True, args=[
            "--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist",
            "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--allow-file-access-from-files",
        ])
        page=browser.new_page(viewport={"width":1280,"height":800})
        page.on("pageerror", lambda exc: errors.append(f"pageerror: {exc}"))
        page.on("console", lambda msg: errors.append(f"console:{msg.type}: {msg.text}") if msg.type=="error" else None)
        try:
            target = (WEB / "index.html").resolve().as_uri() if file_mode else f"http://127.0.0.1:{port}/index.html"
            page.goto(target, wait_until="domcontentloaded", timeout=15000)
        except Exception as exc:
            errors.append(f"navigation: {exc}")
            report={"results":[],"errors":errors,"ok":False}
            (out/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
            browser.close(); return report

        page.wait_for_function("window.SummerQuest")
        page.evaluate("SummerQuest.navigate('home')")
        page.wait_for_selector(".hero")
        results.append(("heroes", page.locator(".hero").count()==3))
        results.append(("single_runtime", page.locator("iframe").count()==0 and page.locator(".mobile-app-shell").count()==0))
        page.locator(".hero").first.click()
        page.wait_for_function("!document.getElementById('world').classList.contains('hidden')")
        page.wait_for_selector("#worldMount canvas", timeout=15000)
        page.wait_for_timeout(800)
        results.append(("world_is_primary", visible(page,"#world") and not visible(page,"#hub")))
        results.append(("world_canvas", page.locator("#worldMount canvas").count()==1 and page.locator("#worldMount canvas").bounding_box()["height"]>300))
        results.append(("registry", page.evaluate("window.SQContentRegistry && ['section:games','section:books','section:music','game:solar','game:monster-truck','book:space'].every(id => !!SQContentRegistry.get(id))")))
        world_ctx=page.evaluate("window.SQAppNavigation.getSurface()")
        results.append(("router_reports_world", world_ctx.get("surface")=="world"))
        page.screenshot(path=str(out/"world-landscape-1280x800.png"), full_page=True)

        # Camera interaction: a drag should keep a healthy planet surface.
        box=page.locator("#worldMount canvas").bounding_box(); x=box["x"]+box["width"]*.58; y=box["y"]+box["height"]*.58
        page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x-150,y+15,steps=12); page.mouse.up(); page.wait_for_timeout(350)
        results.append(("camera_drag_alive", page.locator("#worldMount canvas").count()==1 and visible(page,"#world")))
        # Toys react in place; a sparkly toy opens a mini-game that native Back ends (design D7/D8).
        diag="SummerQuest.getDiagnostics().world"
        snap=page.evaluate(diag)
        toy=next((t for t in snap["toys"] if t["visible"]),None)
        if toy: page.mouse.click(toy["x"],toy["y"]); page.wait_for_timeout(150)
        results.append(("toy_tap_stays_on_world", toy is not None and visible(page,"#world") and page.evaluate(diag+".minigame") is None))
        game_toy=None
        for _ in range(12):
            snap=page.evaluate(diag)
            game_toy=next((t for t in snap["toys"] if t["visible"] and t["id"] in ("toy:whale","toy:molehill","toy:echo-stone")),None)
            if game_toy: break
            page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x-60,y,steps=6); page.mouse.up(); page.wait_for_timeout(1500)
        if game_toy:
            page.mouse.click(game_toy["x"],game_toy["y"]); page.wait_for_timeout(200)
            page.locator("#worldGo").click(); page.wait_for_timeout(300)
        results.append(("minigame_starts", page.evaluate(diag+".minigame") is not None))
        handled=page.evaluate("window.SQPlatform.triggerBack()")
        results.append(("back_ends_minigame", handled is True and visible(page,"#world") and page.evaluate(diag+".minigame") is None))

        # Direct real content launched with world origin returns to the world via shared Back.
        page.evaluate("SQContentRegistry.open('book:space',{origin:'world'})")
        page.wait_for_function("!document.getElementById('book').classList.contains('hidden')")
        results.append(("book_launch", visible(page,"#book")))
        handled=page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('world').classList.contains('hidden')")
        results.append(("book_returns_world", handled is True and visible(page,"#world")))

        # Section landmark opens a shelf; Back visits Adventure before the world.
        page.evaluate("SQContentRegistry.open('section:games',{origin:'world'})")
        page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        results.append(("section_launch", visible(page,"#hub")))
        handled=page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('tab-adventure').classList.contains('hidden')")
        shelves_ok=handled is True and visible(page,"#hub") and page.locator("#hubBack").inner_text().find("Planet")>=0
        for shelf in ("games","practice","acts"):
            page.evaluate("tab => SummerQuest.navigate(tab)",shelf)
            shelves_ok &= visible(page,"#hub") and page.locator("#hubBack").inner_text().find("Adventure")>=0
            page.evaluate("window.SQPlatform.triggerBack()")
            shelves_ok &= visible(page,"#tab-adventure")
        results.append(("shelves_return_adventure", shelves_ok))
        handled=page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('world').classList.contains('hidden')")
        results.append(("section_returns_world", handled is True and visible(page,"#world")))

        # Classic menu fallback also returns to the world.
        page.locator("#worldClassic").click(); page.wait_for_function("!document.getElementById('hub').classList.contains('hidden')")
        handled=page.evaluate("window.SQPlatform.triggerBack()")
        page.wait_for_function("!document.getElementById('world').classList.contains('hidden')")
        results.append(("classic_menu_returns_world", handled is True and visible(page,"#world")))

        # Landscape presentation stays usable and renders the same world.
        page.set_viewport_size({"width":1024,"height":768}); page.wait_for_timeout(500)
        results.append(("landscape_world", visible(page,"#world") and page.locator("#worldMount canvas").bounding_box()["width"]>700))
        page.screenshot(path=str(out/"world-landscape-1024x768.png"), full_page=True)
        browser.close()

    # Unreachable remote hosts (fonts, a configured Supabase realtime socket) say nothing about the world;
    # a DNS failure can never come from the 127.0.0.1 server under test.
    fatal=[e for e in errors if "favicon" not in e.lower() and "Failed to load resource" not in e and "net::ERR_NAME_NOT_RESOLVED" not in e]
    report={"results":[{"id":k,"ok":v} for k,v in results],"errors":fatal,"ok":all(v for _,v in results) and not fatal}
    (out/"report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    return report

if __name__=="__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--browser",default="/usr/bin/chromium"); ap.add_argument("--port",type=int,default=8146); ap.add_argument("--out",type=Path,default=Path("/mnt/data/v061-world-ui")); ap.add_argument("--file",action="store_true"); args=ap.parse_args()
    report=run(args.browser,args.port,args.out,args.file)
    for item in report["results"]: print(("PASS" if item["ok"] else "FAIL"),item["id"])
    for err in report["errors"]: print("ERROR",err)
    raise SystemExit(0 if report["ok"] else 1)
