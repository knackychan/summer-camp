"""Planet close-ups for readability reviews (docs/plans/2026-10-03-planet-focus-readability/): snow, arcade and forest
at zoom 1.8 plus the whole planet at zoom 1, at 1280x800 and 1024x640, the camera set through the saved world view.

  python scripts/shoot-planet-views.py <out-dir>
"""
import functools, http.server, json, math, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
VIEWS = {"snow": (40, -50, 1.8), "arcade": (30, 55, 1.8), "forest": (-26, -45, 1.8), "whole": (10, 20, 1.0)}
SIZES = [(1280, 800), (1024, 640)]

def quat_axis(axis, a):
    s = math.sin(a / 2); return [axis[0]*s, axis[1]*s, axis[2]*s, math.cos(a / 2)]
def quat_mul(a, b):
    return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
            a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]
def facing(lat, lon):
    r = math.pi / 180; return quat_mul(quat_axis([1, 0, 0], lat*r), quat_axis([0, 1, 0], -lon*r))

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for w, h in SIZES:
        for name, (lat, lon, zoom) in VIEWS.items():
            view = {"rotation": facing(lat + 8, lon), "zoom": zoom, "selected": None}
            page = b.new_page(viewport={"width": w, "height": h})
            page.add_init_script("(() => { const v = %s; for (const k of ['luis','lili','lucien','maya','leo']) localStorage.setItem('sq:world-view:' + k, JSON.stringify(v)); })()" % json.dumps(view))
            page.goto(f"http://127.0.0.1:{srv.server_port}/index.html", wait_until="domcontentloaded")
            page.wait_for_function("window.SummerQuest")
            page.evaluate("SummerQuest.navigate('home')")
            page.wait_for_selector(".hero")
            page.locator(".hero").first.click()
            page.wait_for_selector("#worldMount canvas", timeout=15000)
            page.wait_for_timeout(1500)
            page.screenshot(path=str(OUT / f"{name}-{w}x{h}.png"))
            page.close()
    b.close()
srv.shutdown()
print("ok")
