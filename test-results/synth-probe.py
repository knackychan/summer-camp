import functools, http.server, json, runpy, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
recovery = runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(recovery['Handler'], directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=['--autoplay-policy=no-user-gesture-required'])
        context = browser.new_context(viewport={'width':1280,'height':800}, has_touch=True, service_workers='block')
        context.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
        context.add_init_script('''(() => {
          window.probe = {live:0, peak:0, created:0, events:[]};
          const create = AudioContext.prototype.createOscillator;
          AudioContext.prototype.createOscillator = function() {
            const osc = create.call(this), start = osc.start;
            osc.start = function(...args) { probe.live++; probe.created++; probe.peak = Math.max(probe.peak,probe.live); return start.apply(this,args); };
            osc.addEventListener('ended', () => probe.live--);
            return osc;
          };
          for (const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])
            document.addEventListener(type, e => { if(e.target.dataset.midi)probe.events.push([type,e.pointerId,e.target.dataset.midi]); });
        })();''')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        recovery['boot'](page, f'http://127.0.0.1:{server.server_port}')
        page.evaluate('sqTestMode.set(true)')
        print('open', page.evaluate('SummerQuest.open("music:moog")'), flush=True)
        page.wait_for_selector('.sq-key-white')
        cdp = context.new_cdp_session(page)
        points = []
        for i,midi in enumerate([24,28,31]):
            box = page.locator(f'[data-midi="{midi}"]').bounding_box()
            points.append({'x':box['x']+box['width']/2,'y':box['y']+box['height']*.8,'id':i+1})
        cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':points})
        page.wait_for_timeout(300)
        print('chord',page.evaluate('({active:document.querySelectorAll(".sq-key-active").length,...probe})'),errors,flush=True)
        cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
        page.wait_for_timeout(500)
        print('release',page.evaluate('probe'),errors,flush=True)
        page.evaluate('''() => {
          const pad = [...document.querySelectorAll('button')].find(el=>el.textContent.startsWith('Pad '));
          pad.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:90}));
          probe.peak = probe.live;
          for(let i=0;i<100;i++) {
            for(const midi of [24,28,31]) {
              const key = document.querySelector(`[data-midi="${midi}"]`);
              key.dispatchEvent(new PointerEvent('pointerdown',{pointerId:midi,bubbles:true}));
              key.dispatchEvent(new PointerEvent('pointerup',{pointerId:midi,bubbles:true}));
            }
          }
        }''')
        print('stress',page.evaluate('({live:probe.live,peak:probe.peak,created:probe.created})'),errors,flush=True)
        page.wait_for_timeout(1300)
        print('settled',page.evaluate('({live:probe.live,active:document.querySelectorAll(".sq-key-active").length})'),errors,flush=True)
        browser.close()
finally:
    server.shutdown()
    server.server_close()
