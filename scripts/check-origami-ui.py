"""Origami Atelier browser check: opens on the library; library and prep fit the frame, plus the lesson screen (docs/plans/2026-10-04-origami-lesson/).

Real UI and real taps on a synthetic local profile. At 1280x600, 1024x768 and 1280x800 it opens a
lesson and checks: nothing scrolls, the fold loops on its own, Pause freezes it mid-fold, Resume
continues from that frame, Replay restarts the cycle, Back/Next stay reachable, every control is a
tablet-sized target, the step text is bilingual and reduced motion waits for Play. Screenshots land in --out.
Requires Python Playwright. --target web checks dist/android-web after a build.
"""
import argparse
import functools
import http.server
import json
from pathlib import Path
import runpy
import sys
import threading
import traceback
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
RECOVERY = runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'))
SIZES = [(1280, 600), (1024, 768), (1280, 800)]

# Every box that must sit fully inside the frame, and the root that must not scroll.
FIT = """() => {
  const root = document.querySelector('.oa-root');
  const host = root.parentElement;
  const vw = innerWidth, vh = innerHeight;
  const sel = ['.oa-instruction', '.oa-step-badge', '.oa-stage svg', '.oa-progress',
               '[data-action="pause"],[data-action="resume"]', '[data-action="replay"]',
               '[data-action="prev-step"]', '[data-action="next-step"]'];
  const boxes = {};
  for (const s of sel) { const r = document.querySelector('.oa-root').querySelector(s).getBoundingClientRect();
    boxes[s] = {x: r.x, y: r.y, w: r.width, h: r.height, inside: r.top >= 0 && r.left >= 0 && r.bottom <= vh + 0.5 && r.right <= vw + 0.5}; }
  const stage = document.querySelector('.oa-stage').getBoundingClientRect();
  return { boxes,
    hostScroll: host.scrollHeight - host.clientHeight, hostScrollX: host.scrollWidth - host.clientWidth,
    docScroll: document.scrollingElement.scrollHeight - innerHeight,
    stageShare: stage.height / vh };
}"""
FLAP_T = "document.querySelector('.oa-paper-flap').getAnimations()[0]"


def run(args):
    directory = ROOT if args.target == 'source' else ROOT / 'dist/android-web'
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = {'target': args.target, 'checks': [], 'pageErrors': [], 'consoleErrors': []}

    def check(name, condition):
        report['checks'].append({'name': name, 'ok': bool(condition)})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        assert condition, name

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
        functools.partial(RECOVERY['Handler'], directory=str(directory)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            report['browser'] = browser.version
            context = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
            def console(message):
                if message.type != 'error':
                    return
                url = message.location.get('url', '')
                if 'net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1'):
                    return
                report['consoleErrors'].append(message.text + ' @ ' + url)
            page.on('console', console)

            try:
                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check('Origami opens', page.evaluate("SummerQuest.openGame('origami')")['ok'])
                page.wait_for_selector('#stage .oa-root [data-model]')
                check('Opens straight on the model library (no home screen)', page.locator('.oa-root .oa-model-card').count() == 28
                      and page.locator('.oa-root [data-action="collection"]').count() == 1
                      and page.locator('.oa-root [data-action="screen-back"]').count() == 0)
                PAGE_SCROLL = "() => { const h = document.querySelector('.oa-root').parentElement; return h.scrollHeight - h.clientHeight; }"
                def frame_fits(name):
                    for w, h in SIZES:
                        page.set_viewport_size({'width': w, 'height': h})
                        page.wait_for_timeout(150)
                        check(f'{name} {w}x{h}: page does not scroll', page.evaluate(PAGE_SCROLL) <= 1)
                frame_fits('Library (grid scrolls inside)')
                page.locator('.oa-root [data-model]').first.click()
                frame_fits('Prep')
                page.locator('.oa-root [data-action="start-lesson"]').click()
                page.wait_for_selector('.oa-root.oa-lesson-mode .oa-stage svg')
                page.locator('.oa-root [data-action="next-step"]').click()
                page.wait_for_selector('.oa-root [data-action="pause"]')

                for w, h in SIZES:
                    page.set_viewport_size({'width': w, 'height': h})
                    page.wait_for_timeout(300)
                    fit = page.evaluate(FIT)
                    tag = f'{w}x{h}'
                    check(f'{tag}: lesson does not scroll', fit['hostScroll'] <= 1 and fit['hostScrollX'] <= 1 and fit['docScroll'] <= 1)
                    outside = [s for s, b in fit['boxes'].items() if not b['inside']]
                    check(f'{tag}: text, diagram and every control inside the frame {outside}', not outside)
                    check(f'{tag}: diagram gets most of the height ({fit["stageShare"]:.2f})', fit['stageShare'] >= 0.42)
                    small = [s for s, b in fit['boxes'].items() if 'action' in s and (b['h'] < 48 or b['w'] < 48)]
                    check(f'{tag}: every control is a >=48px target {small}', not small)
                    play = fit['boxes']['[data-action="pause"],[data-action="resume"]']
                    check(f'{tag}: Pause is the big primary control', play['h'] >= 60
                          and play['w'] >= fit['boxes']['[data-action="replay"]']['w'])
                    page.screenshot(path=str(out / f'lesson-{tag}.png'))

                check('Fold loops forever', page.evaluate(FLAP_T + ".effect.getTiming().iterations") == float('inf'))
                t0 = page.evaluate(FLAP_T + ".currentTime")
                page.wait_for_timeout(400)
                check('Fold autoplays', page.evaluate(FLAP_T + ".currentTime") > t0 and page.evaluate(FLAP_T + ".playState") == 'running')
                cycle = page.evaluate(FLAP_T + ".effect.getTiming().duration")
                check(f'Cycle holds the folded shape after the fold ({cycle} ms)', cycle >= 1850 + 500)
                page.locator('.oa-root [data-action="pause"]').click()
                page.wait_for_timeout(100)  # a WAAPI pause settles on the next frame
                frozen = page.evaluate(FLAP_T + ".currentTime")
                page.wait_for_timeout(400)
                check('Pause freezes the fold', page.evaluate(FLAP_T + ".playState") == 'paused'
                      and page.evaluate(FLAP_T + ".currentTime") == frozen)
                check('Pause turns into Resume', page.locator('.oa-root [data-action="resume"]').count() == 1
                      and page.locator('.oa-root [data-action="pause"]').count() == 0)
                page.screenshot(path=str(out / 'paused.png'))
                page.locator('.oa-root [data-action="resume"]').click()
                resumed = page.evaluate(FLAP_T + ".currentTime")
                check('Resume continues from the paused frame', abs(resumed - frozen) < 120
                      and page.evaluate(FLAP_T + ".playState") == 'running')
                page.wait_for_timeout(300)
                page.locator('.oa-root [data-action="replay"]').click()
                check('Replay restarts the cycle', page.evaluate(FLAP_T + ".currentTime") % cycle < 150)
                page.wait_for_timeout(700)
                page.locator('.oa-root [data-action="pause"]').click()
                page.wait_for_timeout(100)
                held = page.evaluate(FLAP_T + ".currentTime") % cycle
                page.locator('.oa-root [data-action="locale-zh"]').click()
                page.wait_for_timeout(100)
                check('Language switch keeps the paused frame', page.locator('.oa-root [data-action="resume"]').count() == 1
                      and page.evaluate(FLAP_T + ".playState") == 'paused'
                      and abs(page.evaluate(FLAP_T + ".currentTime") - held) < 1)
                check('Step text is bilingual', '步驟' in page.locator('.oa-step-badge').inner_text()
                      and '繼續' in page.locator('.oa-root [data-action="resume"]').inner_text())
                page.screenshot(path=str(out / 'lesson-zh.png'))
                before = page.locator('.oa-step-badge').inner_text()
                page.locator('.oa-root [data-action="prev-step"]').click()
                check('Back goes to the previous step and autoplays',
                      page.locator('.oa-step-badge').inner_text() != before and page.locator('.oa-root [data-action="pause"]').count() == 1)
                page.emulate_media(reduced_motion='reduce')
                page.locator('.oa-root [data-action="next-step"]').click()
                page.wait_for_timeout(100)
                check('Reduced motion rests on the start frame until Play is tapped',
                      page.evaluate(FLAP_T + ".playState") == 'paused'
                      and '播放' in page.locator('.oa-root [data-action="resume"]').inner_text())
                page.locator('.oa-root [data-action="resume"]').click()
                check('Play starts the loop on request', page.evaluate(FLAP_T + ".playState") == 'running')
                page.emulate_media(reduced_motion='no-preference')
                page.locator('.oa-root [data-action="screen-back"]').click()
                page.locator('.oa-root [data-action="screen-back"]').click()
                check('Back from a model returns to the library, which offers Continue',
                      page.locator('.oa-root .oa-model-card').count() == 28
                      and page.locator('.oa-root [data-action="continue"]').count() == 1)
                page.locator('.oa-root [data-action="continue"]').click()
                check('Continue reopens the lesson', page.locator('.oa-root.oa-lesson-mode').count() == 1)
                check('No page errors', not report['pageErrors'] and not report['consoleErrors'])
            except Exception:
                page.screenshot(path=str(out / 'failure.png'))
                raise
            finally:
                browser.close()
    except Exception:
        traceback.print_exc()
        report['error'] = traceback.format_exc()
    finally:
        server.shutdown()
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return 0 if 'error' not in report else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/origami-ui')
    sys.exit(run(parser.parse_args()))
