"""Check first-use rhythm timing with real WebAudio and synthetic timed taps.

Requires Python Playwright; --browser optionally selects a Chromium executable.
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
  window.timingProbe = {times:[], autoTap:true, keyboard:false};
  const create = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function() {
    const ctx = this, osc = create.call(this), start = osc.start;
    osc.start = function(at) {
      const result = start.call(this,at);
      if (!timingProbe.times.includes(at)) {
        timingProbe.times.push(at);
        if (timingProbe.autoTap) setTimeout(() => {
          const event = timingProbe.keyboard
            ? new KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true})
            : new PointerEvent('pointerdown',{isPrimary:true,bubbles:true});
          document.getElementById('calibPad').dispatchEvent(event);
        }, Math.max(0,at-ctx.currentTime)*1000+50);
      }
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
            for width, height, touch in ((1280,800,False),(1024,640,True)):
                context = browser.new_context(viewport={'width':width,'height':height},
                    has_touch=touch, service_workers='block')
                context.route('**/*', lambda route: route.continue_()
                    if route.request.url.startswith('http://127.0.0.1:') else route.abort())
                context.add_init_script(PROBE)
                page = context.new_page()
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                RECOVERY['boot'](page, f'http://127.0.0.1:{server.server_port}')
                if touch:
                    page.evaluate('async () => (await import("./js/game-services/audio.js")).getSharedAudio().setMuted(true)')
                else:
                    page.evaluate('timingProbe.keyboard=true')
                assert page.evaluate('SummerQuest.open("section:music")')['ok']
                assert not page.locator('#musicTiming').get_attribute('open')
                assert page.locator('#musicGrid [data-inst]').count() == 3
                page.locator('#musicTiming summary').click()
                page.wait_for_function('!document.getElementById("calibStart").disabled')
                if touch:
                    assert page.locator('#calibStart').inner_text().startswith('Turn on sound & start')
                page.locator('#calibStart').click()
                assert page.locator('#calibPad').is_visible()
                page.wait_for_function('document.getElementById("calibOut").textContent.startsWith("Timing saved.")', timeout=10000)
                result = page.evaluate('JSON.parse(localStorage.getItem("sq.music.latency"))')
                assert result['confident'] and 10 <= result['offsetMs'] <= 120, result
                times = page.evaluate('timingProbe.times')
                assert len(times) == 8, times
                assert all(abs(times[i]-times[i-1]-.6) < .002 for i in range(1,8)), times
                assert page.locator('#calibPad').is_hidden()
                page.locator('#musicTiming').screenshot(path=str(ROOT / f'test-results/music-timing-{width}x{height}.png'))

                # An incomplete attempt keeps the last successful setting.
                page.evaluate('timingProbe.autoTap=false')
                page.locator('#calibStart').click()
                page.wait_for_function('document.getElementById("calibOut").textContent.startsWith("Try once more:")', timeout=10000)
                assert page.evaluate('JSON.parse(localStorage.getItem("sq.music.latency"))') == result

                page.locator('#calibStart').click()
                page.locator('#calibCancel').click()
                assert page.locator('#calibPad').is_hidden()
                page.locator('#calibStart').click()
                page.locator('#musicTiming summary').click()
                page.wait_for_function('document.getElementById("calibPad").classList.contains("hidden")')
                page.locator('#musicTiming summary').click()
                page.locator('#calibStart').click()
                assert page.evaluate('SummerQuest.open("section:books")')['ok']
                assert page.evaluate('calibRun === null')
                assert page.evaluate('SummerQuest.open("section:music")')['ok']
                page.locator('#calibReset').click()
                assert page.evaluate('localStorage.getItem("sq.music.latency")') is None
                assert page.locator('#calibOut').inner_text().startswith('Automatic timing')
                assert not errors, errors
                print(f'PASS {width}x{height}: first-use sound, eight clicks, saved timing, retry, stop, close, navigation, reset', flush=True)
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
