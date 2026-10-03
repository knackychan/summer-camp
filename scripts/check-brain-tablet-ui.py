"""Check Brain Gym fits small landscape tablets. Requires Python Playwright."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import re
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def run(browser_path, out):
    out.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    results, errors = [], []
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
            page.evaluate('''() => {
              const build = SQBrainCore.buildRound;
              SQBrainCore.buildRound = (game,tier) => {
                const round=build(game,tier,SQBrainCore.mulberry32(4100));
                if(window.tabletItemIndex==='longest') round.items.sort((a,b)=>(b.prompt.tokens||[]).join(' ').length-(a.prompt.tokens||[]).join(' ').length);
                window.tabletItem=round.items[Number(window.tabletItemIndex)||0];
                round.items[0]=tabletItem;
                return round;
              };
            }''')

            def open_round(game, tier, index=0, script='abc'):
                page.evaluate('''async ([gameId,tier,index,inputScript]) => {
                  window.tabletItemIndex=index;
                  SQBrainData.setInputScript(inputScript);
                  window.tabletRound=await SQBrain.openRound({gameId,tier,inputScript,kid:'lili',mount:document.getElementById('stage'),isMuted:()=>true});
                }''', [game, tier, index, script])
                page.wait_for_function("tabletRound.debugState()==='active'")

            def check(label, overlay=False):
                metrics = page.locator('.brain-learning-support' if overlay else '.brain-scene').evaluate('''s => {
                  const bounds=s.getBoundingClientRect();
                  const shell=document.querySelector('.brain-round').getBoundingClientRect();
                  const companion=document.querySelector('.summer-companion').getBoundingClientRect();
                  const controls=[...s.querySelectorAll('button,textarea')].filter(b=>b.getBoundingClientRect().width>0);
                  const clips=[s,...s.querySelectorAll('*')].filter(el=>['auto','scroll','hidden'].includes(getComputedStyle(el).overflowY));
                  return {width:s.clientWidth,height:s.clientHeight,scrollWidth:s.scrollWidth,scrollHeight:s.scrollHeight,
                    inside:bounds.top>=0&&bounds.bottom<=innerHeight+1&&shell.right<=innerWidth+1&&shell.bottom<=innerHeight+1,
                    companionClear:['#back','#mute'].every(selector=>{const b=document.querySelector(selector).getBoundingClientRect();return companion.right<=b.left||companion.left>=b.right||companion.bottom<=b.top||companion.top>=b.bottom;}),
                    clipped:clips.filter(el=>el.scrollHeight>el.clientHeight+1).map(el=>el.className),
                    badControls:controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<43||r.height<43||r.top<bounds.top-1||r.bottom>bounds.bottom+1||r.left<bounds.left-1||r.right>bounds.right+1;}).map(el=>el.className)};
                }''')
                ok = metrics['inside'] and metrics['companionClear'] and metrics['scrollWidth'] <= metrics['width'] + 1 and not metrics['clipped'] and not metrics['badControls']
                results.append({'id': label, 'ok': ok, **({} if ok else {'metrics': metrics})})
                if not ok:
                    page.screenshot(path=str(out / f'{label}.png'))

            games = page.evaluate('Object.keys(SQBrainData.GAMES)')
            for width, height in [(1280, 600), (1280, 800), (1024, 640)]:
                page.set_viewport_size({'width': width, 'height': height})
                size = f'{width}x{height}'
                for game in games:
                    for tier in ['tot', 'mid', 'hard']:
                        open_round(game, tier)
                        check(f'{size}-{game}-{tier}')
                for game, index in [('memorymatch', 5), ('patternecho', 5), ('circuit', 7), ('fractions', 7), ('sentence', 'longest'), ('recall', 1)]:
                    open_round(game, 'hard', index)
                    if game == 'sentence':
                        answer = page.evaluate('tabletItem.answer.split(" ")')
                        for word in answer:
                            page.locator('.brain-sentence__word:not(:disabled)').filter(has_text=re.compile('^' + re.escape(word) + '$')).first.click()
                    check(f'{size}-{game}-advanced')
                    if width == 1280 and height == 600:
                        page.screenshot(path=str(out / f'{game}-1280x600.png'))
                open_round('wordmem', 'hard', script='bpmf')
                check(f'{size}-wordmem-bopomofo')
                open_round('soundmatch', 'mid')
                page.locator('.brain-sound__reveal').click()
                check(f'{size}-soundmatch-word-revealed')
                page.locator('[data-lesson-clue]').click()
                check(f'{size}-lesson-clue', overlay=True)
                page.locator('[data-learning-action="resume"]').click()
                page.evaluate('''() => [...document.querySelectorAll('.brain-sound__choice')].find(b=>b.dataset.value!==tabletItem.answer).click()''')
                page.wait_for_function("tabletRound.debugState()==='lesson-review'")
                check(f'{size}-lesson-review', overlay=True)
                print(f'{size}: all {len(games)} games, advanced scenes, Zhuyin and lesson overlays checked', flush=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    report = {'ok': all(row['ok'] for row in results) and not errors, 'results': results, 'errors': errors}
    (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f"{sum(row['ok'] for row in results)}/{len(results)} checks passed; {len(errors)} page errors")
    for row in results:
        if not row['ok']: print('FAIL', row)
    return report['ok']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/brain-tablet-ui')
    args = parser.parse_args()
    raise SystemExit(0 if run(args.browser, args.out.resolve()) else 1)
