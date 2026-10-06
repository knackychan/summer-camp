"""Filmstrip of fold frames for the origami audit (audit.md). Usage: python fold-frames.py out.png ['[["model-id",[stepIndex,...]],...]']
Six frames per step (start, 30%, 58%, 90% of the fold, hold, fade back), reduced to the SVG diagram."""
import functools, http.server, json, threading, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=str(Path(__file__).resolve().parents[3]); OUT=sys.argv[1]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Q, directory=ROOT)); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
PICKS=json.loads(sys.argv[2]) if len(sys.argv)>2 else [("little-fox",[0,1,6]),("classic-crane",[0,4,8,12,14]),("jumping-frog",[3,10]),("swimming-fish",[5]),("paper-boat",[0,7])]
JS="""async (picks) => {
 const D = await import('/js/vendor/origami-atelier/origami-data.js');
 const E = await import('/js/vendor/origami-atelier/origami-engine.js');
 document.head.innerHTML='<link rel=stylesheet href="/js/vendor/origami-atelier/origami-atelier.css">';
 document.body.innerHTML=''; document.body.style.cssText='margin:0;background:#fff;font:12px sans-serif';
 await new Promise(r=>setTimeout(r,300));
 const times=[150,400+1850*0.3,400+1850*0.58,400+1850*0.9,2400,2900];
 for (const [id,idx] of picks){ const m=D.getOrigamiModel(id);
  for (const i of idx){ const s=m.steps[i];
   const row=document.createElement('div'); row.style.cssText='display:flex;gap:4px;align-items:center;border-bottom:1px solid #ccc';
   const lab=document.createElement('div'); lab.style.width='170px'; lab.textContent=`${id} #${i+1} [${s.diagram}] ${s.instruction.en}`; row.append(lab);
   for (const t of times){ const c=document.createElement('div'); c.style.cssText='position:relative;width:180px;height:126px;background:#fff9ec'; row.append(c);
     const st=document.createElement('div'); st.style.cssText='position:absolute;inset:0'; c.append(st);
     const e=new E.OrigamiFoldEngine(st,{front:'#ef8f9f',back:'#ffe6e9',reducedMotion:true}); e.show(s,{autoplay:false});
     e.anims.forEach(a=>{a.currentTime=t; a.pause();});
     const tl=document.createElement('span'); tl.textContent=Math.round(t)+'ms'; tl.style.cssText='position:absolute;right:2px;top:0;color:#888'; c.append(tl);}
   document.body.append(row);}}
}"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.goto(f"http://127.0.0.1:{port}/js/vendor/origami-atelier/origami-storage.js")
    pg.evaluate(JS, PICKS); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT, full_page=True); b.close()
print("ok")
