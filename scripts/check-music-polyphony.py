"""Real WebAudio and multi-touch regression; run with Python Playwright.

Optional --browser selects a Chromium executable. Uses isolated local saves.
"""
import argparse
import functools
import http.server
import runpy
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RECOVERY = runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'))

PROBE = """(() => {
  window.synthProbe = {live:new Set(), peak:0, created:0};
  const create = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function() {
    const osc = create.call(this), start = osc.start, disconnect = osc.disconnect;
    osc.start = function(...args) {
      const result = start.apply(this,args);
      synthProbe.live.add(osc);
      synthProbe.created++;
      synthProbe.peak = Math.max(synthProbe.peak,synthProbe.live.size);
      return result;
    };
    osc.disconnect = function(...args) {
      const result = disconnect.apply(this,args);
      synthProbe.live.delete(osc);
      return result;
    };
    return osc;
  };
})();"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser')
    args = parser.parse_args()
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
        functools.partial(RECOVERY['Handler'], directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True,
                **({'executable_path': args.browser} if args.browser else {}))
            context = browser.new_context(viewport={'width':1280,'height':800},
                has_touch=True, service_workers='block')
            context.route('**/*', lambda route: route.continue_()
                if route.request.url.startswith('http://127.0.0.1:') else route.abort())
            context.add_init_script(PROBE)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            RECOVERY['boot'](page, f'http://127.0.0.1:{server.server_port}')
            page.evaluate('sqTestMode.set(true)')
            assert page.evaluate('SummerQuest.open("music:moog")')['ok']
            page.wait_for_selector('.sq-key-white')
            cdp = context.new_cdp_session(page)

            def touch(kind, points):
                cdp.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':points})

            def key_point(midi, pointer):
                box = page.locator(f'[data-midi="{midi}"]').bounding_box()
                return {'id':pointer, 'x':box['x']+box['width']/2,
                    'y':box['y']+box['height']*.8}

            def live():
                return page.evaluate('synthProbe.live.size')

            def settled():
                page.wait_for_function('synthProbe.live.size === 0')
                assert page.locator('.sq-key-active').count() == 0

            chord = [key_point(midi, i+1) for i, midi in enumerate((24,28,31))]
            touch('touchStart', chord)
            assert live() == 6
            assert page.locator('.sq-key-active').count() == 3
            knob = page.locator('[role="slider"]').first.bounding_box()
            finger = {'id':4,'x':knob['x']+knob['width']/2,'y':knob['y']+knob['height']/2}
            touch('touchStart', chord+[finger])
            finger['y'] -= 25
            touch('touchMove', chord+[finger])
            assert live() == 6, 'turning a knob must preserve held voices'
            touch('touchEnd', [])
            settled()
            print('PASS three real touches plus simultaneous knob drag', flush=True)

            first = key_point(24, 1)
            second = dict(first, id=2, x=first['x']+5)
            touch('touchStart', [first,second])
            assert live() == 2, 'two fingers on one note must share one voice'
            touch('touchEnd', [second])
            page.wait_for_timeout(400)
            assert live() == 2 and page.locator('.sq-key-active').count() == 1
            touch('touchCancel', [])
            settled()
            print('PASS overlapping fingers and touch cancellation', flush=True)

            # Burst beyond the limit in one JS turn, including long release tails.
            page.evaluate("""() => {
              [...document.querySelectorAll('button')].find(el=>el.textContent.startsWith('Pad '))
                .dispatchEvent(new PointerEvent('pointerdown',{pointerId:90,bubbles:true}));
              synthProbe.peak = 0;
              synthProbe.created = 0;
              for(let i=0;i<100;i++) for(const midi of [24,28,31]) {
                const key = document.querySelector(`[data-midi="${midi}"]`);
                key.dispatchEvent(new PointerEvent('pointerdown',{pointerId:midi,bubbles:true}));
                key.dispatchEvent(new PointerEvent('pointerup',{pointerId:midi,bubbles:true}));
              }
            }""")
            assert page.evaluate('synthProbe.created') == 600
            assert page.evaluate('synthProbe.peak') == 48, 'cap includes release tails'
            settled()
            print('PASS 300-note burst stays within 24 voices and releases every node', flush=True)

            # Steal held voices too; cleanup of older notes must leave newer ones usable.
            page.evaluate("""() => {
              for(const key of document.querySelectorAll('.sq-key')) {
                key.dispatchEvent(new PointerEvent('pointerdown',{pointerId:+key.dataset.midi,bubbles:true}));
              }
            }""")
            assert live() == 48
            assert page.evaluate('SQPlatform.triggerBack()')
            assert live() == 0, 'leaving stops held and fading voices immediately'
            assert page.evaluate('SummerQuest.open("music:moog")')['ok']
            page.wait_for_selector('.sq-key-white')
            touch('touchStart', [key_point(24, 1)])
            assert live() == 2
            touch('touchEnd', [])
            assert page.evaluate('SQPlatform.triggerBack()')
            assert live() == 0, 'leaving also stops voices already released'

            assert page.evaluate('SummerQuest.open("music:moog")')['ok']
            page.wait_for_selector('.sq-key-white')
            touch('touchStart', [key_point(24, 1)])
            page.evaluate("""() => {
              Object.defineProperty(document,'hidden',{configurable:true,value:true});
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            assert live() == 0
            touch('touchCancel', [])
            page.evaluate("""() => {
              delete document.hidden;
              document.dispatchEvent(new Event('visibilitychange'));
            }""")
            touch('touchStart', [key_point(28, 1)])
            assert live() == 2
            touch('touchEnd', [])
            settled()
            assert not errors, errors
            print(f'PASS voice stealing, exit/reopen, and background cleanup (Chromium {browser.version})', flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
