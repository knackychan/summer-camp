"""Sheet of all 28 finished pictures (slice 12) in Sakura paper. Usage: python finished-pictures.py out.png"""
import functools, http.server, threading, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = str(Path(__file__).resolve().parents[3])
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = """async () => {
  const D = await import('/js/vendor/origami-atelier/origami-data.js');
  const E = await import('/js/vendor/origami-atelier/origami-engine.js');
  const sakura = D.PAPER_COLORS.find(c => c.id === 'sakura') || D.PAPER_COLORS[0];
  document.head.innerHTML = '<link rel=stylesheet href="/js/vendor/origami-atelier/origami-atelier.css">';
  document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#fff;font:13px sans-serif;display:grid;grid-template-columns:repeat(7,180px);gap:4px';
  await new Promise(r => setTimeout(r, 300));
  for (const m of D.ORIGAMI_MODELS) {
    const cell = document.createElement('div'); cell.style.cssText = 'background:#fff8e9;text-align:center;padding:4px';
    cell.innerHTML = E.finishPicture(m, sakura.front, sakura.back) + `<div>${m.icon} ${m.name}</div>`;
    cell.querySelector('svg').style.cssText = 'width:172px;height:120px';
    document.body.append(cell);
  }
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    pg = b.new_page(viewport={'width': 1290, 'height': 700})
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/js/vendor/origami-atelier/origami-storage.js")
    pg.evaluate(JS); pg.wait_for_timeout(300)
    pg.screenshot(path=sys.argv[1], full_page=True); b.close()
srv.shutdown()
print("ok")
