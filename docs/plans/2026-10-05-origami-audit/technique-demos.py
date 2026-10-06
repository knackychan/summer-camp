"""Strip of the technique-card demos (slice 11): five moments of each loop. Usage: python technique-demos.py out.png"""
import functools, http.server, threading, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = str(Path(__file__).resolve().parents[3])
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = """async () => {
  const T = await import('/js/vendor/origami-atelier/origami-techniques.js');
  document.head.innerHTML = '<link rel=stylesheet href="/js/vendor/origami-atelier/origami-atelier.css">';
  document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#fff;font:12px sans-serif';
  await new Promise(r => setTimeout(r, 300));
  for (const id of Object.keys(T.TECHNIQUES)) {
    const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;border-bottom:1px solid #ccc';
    const lab = document.createElement('div'); lab.style.width = '110px'; lab.textContent = id; row.append(lab);
    for (const t of [0, 800, 1300, 1800, 2600]) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 120 90'); svg.style.cssText = 'width:180px;height:135px;background:#fff8e9';
      row.append(svg);
      const anims = T.drawTechniqueDemo(svg, { id, ...T.TECHNIQUES[id] }, { front: '#ef8f9f', back: '#ffe6e9' });
      anims.forEach(a => { a.pause(); a.currentTime = t; });
    }
    document.body.append(row);
  }
}"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    pg = b.new_page(viewport={'width': 1060, 'height': 900})
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/js/vendor/origami-atelier/origami-storage.js")
    pg.evaluate(JS); pg.wait_for_timeout(300)
    pg.screenshot(path=sys.argv[1], full_page=True); b.close()
srv.shutdown()
print("ok")
