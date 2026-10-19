"""Check every Brain Gym exercise keeps kid-facing text readable on tablets.

Opens each exercise and tier at each tablet size down to 1280x600, reads the
computed font size of every visible text node in the round (study phase and
answer phase), and fails on anything under the floor: 16 px, or 15 px for the
small card numbers in Memory Match corners. Requires Python Playwright.

    python scripts/check-brain-text-size.py --browser <chrome>
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import os
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(1280, 600), (1280, 800), (1340, 800), (1920, 1200)]

if os.environ.get('BRAIN_TEXT_SIZES'): SIZES = [tuple(map(int, s.split('x'))) for s in os.environ['BRAIN_TEXT_SIZES'].split(',')]
FLOOR = 16
SMALL_OK = {'brain-memory__card-number': 15}
MEASURE = '''() => {
  const out=[], root=document.querySelector('.brain-round');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    const text=node.textContent.trim(); if(!text) continue;
    const el=node.parentElement;
    if(el.closest('.sr-only,[hidden],[aria-hidden="true"]')) continue;
    const box=el.getBoundingClientRect(); if(!box.width||!box.height) continue;
    const style=getComputedStyle(el); if(style.visibility==='hidden') continue;
    const card=el.tagName==='SMALL'&&el.closest('.brain-memory__card');
    out.push({size:parseFloat(style.fontSize),text:text.slice(0,40),
      cls:card?'brain-memory__card-number':(typeof el.className==='string'&&el.className)||el.tagName});
  }
  return out;
}'''


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def run(browser_path, out):
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    failures, errors, checked = [], [], 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=browser_path, headless=True)
            context = browser.new_context(viewport={'width': 1280, 'height': 600}, has_touch=True, service_workers='block', reduced_motion='reduce')
            context.route('**/js/config.js', lambda route: route.fulfill(body='window.SQ_CONFIG={};', content_type='text/javascript'))
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
            page.locator('.hero').first.click()
            page.wait_for_function('!!window.SummerQuest && !!window.SQBrain')
            page.evaluate("SummerQuest.openGame('calc',{origin:'world'})")
            page.wait_for_selector('.brain-round')
            games = page.evaluate('Object.keys(SQBrainData.GAMES).filter(id=>!SQBrainData.GAMES[id].retired)')

            def measure(label):
                nonlocal checked
                for row in page.evaluate(MEASURE):
                    checked += 1
                    if row['size'] + 0.05 < SMALL_OK.get(row['cls'], FLOOR):
                        failures.append({'id': label, **row})

            for width, height in SIZES:
                page.set_viewport_size({'width': width, 'height': height})
                for game in games:
                    for tier in ['tot', 'mid', 'hard']:
                        label = f'{width}x{height}-{game}-{tier}'
                        # Not awaited: Memory Match's ready waits out its study phase.
                        page.evaluate('''([gameId,tier]) => {
                          SQBrainData.setInputScript('abc');
                          window.textRound=SQBrain.openRound({gameId,tier,kid:'lili',mount:document.getElementById('stage'),isMuted:()=>true});
                        }''', [game, tier])
                        page.wait_for_selector('.brain-scene > *')
                        page.wait_for_timeout(300)
                        measure(label + '-start')
                        page.wait_for_function("window.textRound.then(r => r && r.debugState() === 'active')", timeout=15000)
                        page.wait_for_function("!document.querySelector('[data-role=\"study-timer\"]:not([hidden])')", timeout=70000)
                        measure(label + '-answer')
                # The Clue and "Let's work it out" overlays, on a scene that has lessons.
                page.evaluate("window.textRound=SQBrain.openRound({gameId:'soundmatch',tier:'mid',kid:'lili',mount:document.getElementById('stage'),isMuted:()=>true})")
                page.wait_for_function("window.textRound.then(r => r && r.debugState() === 'active')", timeout=15000)
                page.locator('[data-lesson-clue]').click()
                measure(f'{width}x{height}-soundmatch-clue')
                page.locator('[data-learning-action="resume"]').click()
                for _ in range(10):
                    page.locator('.brain-sound__choice:not(:disabled)').last.click()
                    page.wait_for_timeout(1200)
                    if page.evaluate("document.querySelector('[data-learning-action=\"retry\"]') !== null"): break
                measure(f'{width}x{height}-soundmatch-review')
                print(f'{width}x{height}: {len(games)} exercises x 3 tiers and lesson overlays measured', flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    report = {'ok': not failures and not errors, 'checked': checked, 'failures': failures, 'errors': errors}
    (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'{checked} text runs measured; {len(failures)} under {FLOOR}px; {len(errors)} page errors')
    seen = set()
    for row in failures:
        key = (row['cls'], round(row['size'], 1), row['id'].split('-')[1])
        if key in seen: continue
        seen.add(key)
        print('SMALL', row['id'], f"{row['size']:.1f}px", row['cls'], repr(row['text']))
    for error in errors: print('ERROR', error)
    return report['ok']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/brain-text-size')
    args = parser.parse_args()
    raise SystemExit(0 if run(args.browser, args.out.resolve()) else 1)
