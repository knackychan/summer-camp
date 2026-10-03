"""Kitchen Quest at 1280 x 600 with Chromium touch input.

Uses the recovery harness's isolated save and server. Gameplay uses touchscreen
taps without auto-scroll, and CDP touch gestures exercise native scrolling.
After real gameplay, a test-only module response forces a seven-step custom
order for the worst-case layout. Production files and model APIs stay unchanged.
--baseline captures all panels without requiring the layout checks to pass.
"""
import argparse
import functools
import http.server
import json
from pathlib import Path
import runpy
import subprocess
import sys
import threading
import traceback
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding='utf-8')
V07 = runpy.run_path(str(ROOT / 'scripts/check-kitchen-v07-ui.py'))
RECOVERY = V07['RECOVERY']
SNAPSHOT = V07['SNAPSHOT']


class TouchBrowser:
    def __init__(self, browser):
        self.browser = browser

    def new_context(self, **options):
        options.update(viewport={'width': 1280, 'height': 600}, has_touch=True, service_workers='block')
        return self.browser.new_context(**options)


def run(args):
    directory = ROOT if args.target == 'source' else args.web_root.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    brain_ids = json.loads(subprocess.check_output(['node', '-e',
        'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).GAMES)))',
        str(directory / 'js/brain-data.js')], text=True))
    report = {'target': args.target, 'checks': [], 'layouts': {}, 'pageErrors': [], 'consoleErrors': [],
              'scope': 'Headless Chromium at 1280x600; touch/coarse pointer; isolated local profile; normal-time cooking.'}

    def check(name, condition):
        report['checks'].append({'name': name, 'ok': bool(condition)})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        if not args.baseline:
            assert condition, name

    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
        functools.partial(RECOVERY['Handler'], directory=str(directory)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            report['browser'] = browser.version
            context = RECOVERY['context_for'](TouchBrowser(browser), seed=V07['fixture'](16), offline=True)
            context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
            context.add_init_script("""(() => {
              if (location.protocol !== 'http:' || localStorage.getItem('sq:kitchenTabletFixture')) return;
              const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
                .formatToParts(new Date()).reduce((result, part) => (result[part.type] = part.value, result), {});
              const saved = JSON.parse(localStorage.getItem('keyquest:v2'));
              const done = Object.fromEntries(%s.map(id => [id, {score:8,ms:20000}]));
              saved.progress.luis.brain = {d:`${parts.year}-${parts.month}-${parts.day}`,done,starred:true};
              localStorage.setItem('keyquest:v2', JSON.stringify(saved));
              localStorage.setItem('sq:kitchenTabletFixture','1');
            })();""" % json.dumps(brain_ids))
            page = context.new_page()
            cdp = context.new_cdp_session(page)
            page.set_default_timeout(12000)
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))

            def console(message):
                if message.type == 'error':
                    url = message.location.get('url', '')
                    if not ('net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1')):
                        report['consoleErrors'].append({'message': message.text, 'url': url})
            page.on('console', console)

            def state():
                return page.evaluate(SNAPSHOT)

            def wait(expression, timeout=18000):
                page.wait_for_function('() => { const s = ' + SNAPSHOT + '; return ' + expression + '; }', timeout=timeout)

            def swipe(x, y, distance):
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1}]})
                for step in range(1, 9):
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y + distance * step / 8, 'id': 1}]})
                    page.wait_for_timeout(30)
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                page.wait_for_timeout(250)

            def tap_element(target):
                for _ in range(5):
                    bounds = target.evaluate('''el => {
                      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);
                      return {connected:el.isConnected,x:r.x,y:r.y,width:r.width,height:r.height,hit:el.contains(hit),obstruction:hit&&hit.outerHTML.slice(0,200)};
                    }''')
                    if bounds['connected']:
                        break
                    # The timer can replace a node between Locator resolution and
                    # evaluate. Retry the selector, never scroll a primary control.
                    page.wait_for_timeout(25)
                viewport = page.viewport_size
                assert bounds and bounds['x'] >= 0 and bounds['y'] >= 0 and bounds['x']+bounds['width'] <= viewport['width']+1 and bounds['y']+bounds['height'] <= viewport['height']+1, f'Control outside viewport: {bounds}'
                x, y = bounds['x']+bounds['width']/2, bounds['y']+bounds['height']/2
                assert bounds['hit'], 'Control is obstructed: ' + str(bounds)
                page.touchscreen.tap(x, y)
                page.wait_for_timeout(40)

            def tap(action, scroll=False):
                dialog = page.locator('.kq dialog[open]')
                scope = dialog if dialog.count() else page.locator('.kq-tabs') if action.startswith('tab:') else page.locator('.kq')
                target = scope.locator(f'[data-action="{action}"]')
                if scroll:
                    for _ in range(8):
                        visible = target.evaluate('''el => {
                          const r=el.getBoundingClientRect();
                          return r.y>=0 && r.bottom<=innerHeight && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                        }''')
                        if visible:
                            break
                        bench = target.evaluate('''el => {
                          for(let parent=el.parentElement;parent;parent=parent.parentElement) {
                            if(parent.scrollHeight>parent.clientHeight+1 && ['auto','scroll'].includes(getComputedStyle(parent).overflowY)) {
                              const r=parent.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};
                            }
                          }
                          const r=el.closest('.kq-bench').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};
                        }''')
                        bounds = target.bounding_box()
                        direction = 1 if bounds['y'] < bench['y'] else -1
                        swipe(bench['x'] + bench['width'] - 10,
                              bench['y'] + bench['height'] * (0.3 if direction > 0 else 0.75), direction * bench['height'] * 0.45)
                tap_element(target)

            def layout(name, scrollable_pantry=False):
                metrics = page.locator('.kq').evaluate('''root => {
                  const surface = root.querySelector('dialog[open]') || root;
                  const rect = el => { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}; };
                  return {
                    root: {...rect(root),clientHeight:root.clientHeight,scrollHeight:root.scrollHeight,scrollTop:root.scrollTop},
                    overflow: root.scrollWidth > root.clientWidth+1 || surface.scrollWidth > surface.clientWidth+1 || document.documentElement.scrollWidth > innerWidth+1,
                    sections: Object.fromEntries(['.kq-top','.kq-career','.kq-customers','.kq-work','.kq-ticket','.kq-tabs','.kq-bench','.kq-pantry','.kq-bottom','.kq-notice'].map(s=>[s,rect(root.querySelector(s))])),
                    controls: [...surface.querySelectorAll('button')].filter(el=>el.getClientRects().length).map(el=>{
                      const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
                      return {action:el.dataset.action,pantry:!!el.closest('.kq-pantry'),primary:!!el.closest('.kq-tabs,.kq-customers,.kq-pantry,.kq-actions,.kq-top'),...rect(el),visible:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,unobstructed:el.contains(document.elementFromPoint(x,y))};
                    })
                  };
                }''')
                report['layouts'][name] = metrics
                page.screenshot(path=str(out / (name + '.png')))
                check(name + ': no horizontal overflow', not metrics['overflow'])
                check(name + ': all touch controls at least 44px', all(b['width'] >= 44 and b['height'] >= 44 for b in metrics['controls']))
                if not page.locator('.kq dialog[open]').count():
                    check(name + ': game fits without whole-game scrolling', metrics['root']['scrollHeight'] <= metrics['root']['clientHeight']+1 and metrics['root']['scrollTop'] == 0)
                    primary = [b for b in metrics['controls'] if b['primary'] and not (scrollable_pantry and b['pantry'])]
                    check(name + ': primary controls stay on-screen and unobstructed', all(b['visible'] and b['unobstructed'] for b in primary))
                    sections = [r for key, r in metrics['sections'].items() if key in ['.kq-top','.kq-career','.kq-customers','.kq-work','.kq-pantry','.kq-bottom','.kq-notice']]
                    overlap = any(min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']) > 1 and
                                  min(a['bottom'],b['bottom'])-max(a['y'],b['y']) > 1
                                  for i,a in enumerate(sections) for b in sections[i+1:])
                    check(name + ': main sections do not overlap', not overlap)
                return metrics

            try:
                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check('Coarse touch pointer emulation is active', page.evaluate("matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0"))
                # Registry navigation skips the unrelated home menu's scroll position.
                check('Native registry opens Kitchen Quest', page.evaluate("SQContentRegistry.open('game:kitchen', {origin:'hub'})")['ok'])
                page.wait_for_selector('.kq[data-version="0.7.0"]')
                page.wait_for_function("document.querySelectorAll('.sqtoast').length === 0")
                page.wait_for_timeout(300)
                layout('plate')
                if not args.baseline:
                    page.evaluate("SQNotify.toast({icon:'⭐',en:'Achievement unlocked',zh:'解鎖成就'})")
                    layout('notification')
                for panel in ['grill', 'board', 'oven', 'plan']:
                    tap('tab:' + panel)
                    layout(panel)
                tap('book')
                layout('cookbook')
                tap('book:close')
                tap('pause')
                layout('pause')
                tap('pause')
                if not args.baseline:
                    # A swipe beginning over a food button must never place food.
                    food = page.locator('.kq [data-action="add:cheese"]').bounding_box()
                    before = state()['layers']
                    swipe(food['x']+food['width']/2, food['y']+food['height']/2, -90)
                    check('Swiping over pantry food does not add an ingredient', state()['layers'] == before)
                    tap('add:cheese')
                    check('Touch tap adds exactly one ingredient', len(state()['layers']) == 1)
                    tap('difficulty:standard')
                    layout('mode-confirmation')
                    tap('confirm:no')
                    check('Touch cancel keeps the plate and difficulty', len(state()['layers']) == 1 and state()['difficulty'] == 'easy')
                    tap('difficulty:standard')
                    tap('confirm:yes')
                    check('Touch confirmation starts a standard shift', state()['difficulty'] == 'standard' and not state()['layers'])

                    # The longest possible player-built plate exercises independent
                    # scrolling and removal controls without test-only model access.
                    tap('tab:plate')
                    for _ in range(12):
                        tap('add:cheese')
                    layout('twelve-layer-plate')
                    layers_before = state()['layers']
                    layer = page.locator('.kq-layers button').first.bounding_box()
                    swipe(layer['x']+layer['width']/2, layer['y']+layer['height']/2, -80)
                    check('Swiping over a plated layer never removes it', state()['layers'] == layers_before)
                    tap('clear')
                    check('Clear remains reachable after scrolling the plate', not state()['layers'])

                    tap('tab:oven')
                    add = page.locator('.kq [data-action="lasagna:add:pasta"]').bounding_box()
                    # Only swipe from the control if it is currently in the bench.
                    bench = page.locator('.kq-bench').bounding_box()
                    if add['y']+add['height']/2 < bench['y']+bench['height']:
                        swipe(add['x']+add['width']/2, add['y']+add['height']/2, -90)
                        check('Swiping over oven ingredients does not alter the tray', state()['kitchen']['lasagnaLayers'] == [])
                    for ingredient in ['pasta','sauce','cheese','pasta','sauce','cheese']:
                        tap('lasagna:add:' + ingredient, scroll=True)
                    layout('full-oven-tray')
                    tap('oven', scroll=True)
                    tap('tab:grill')
                    tap('grill:0', scroll=True)
                    tap('grill:1', scroll=True)
                    tap_element(page.locator('#summerCompanion'))
                    page.wait_for_selector('#summerCompanionOverlay [data-summer-action="close"]')
                    page.wait_for_timeout(150)
                    frozen = state()['kitchen']['clock']
                    page.wait_for_timeout(500)
                    check('Opening Summer freezes active cooking', state()['paused'] and state()['kitchen']['clock'] == frozen)
                    page.keyboard.press('2')
                    check('Summer overlay blocks background kitchen shortcuts', not state()['layers'])
                    page.screenshot(path=str(out / 'summer-overlay.png'))
                    tap_element(page.locator('#summerCompanionOverlay [data-summer-action="close"]'))
                    page.wait_for_selector('.kq dialog[open]')
                    check('Closing Summer requires explicit cooking resume', state()['paused'] and state()['kitchen']['clock'] == frozen)
                    tap('pause')
                    tap_element(page.locator('#summerCompanion'))
                    page.wait_for_selector('#summerCompanionOverlay [data-summer-action="close"]')
                    page.wait_for_timeout(100)
                    frozen = state()['kitchen']['clock']
                    page.evaluate("window.dispatchEvent(new Event('summerquest:native-pause'))")
                    page.wait_for_selector('.kq dialog[open]')
                    tap('pause')
                    page.wait_for_timeout(150)
                    check('Native pause while Summer is open can resume without advancing cooking', state()['paused'] and state()['kitchen']['clock'] == frozen)
                    tap_element(page.locator('#summerCompanionOverlay [data-summer-action="close"]'))
                    page.wait_for_selector('.kq dialog[open]')
                    tap('pause')
                    check('Closing Summer after a native pause leaves the game usable', not state()['paused'])
                    wait("s.kitchen.grill.every(pan => pan.phase === 'flip')")
                    # Hold through a countdown rerender: touch-down does not flip;
                    # releasing the same button performs the action once.
                    grill = page.locator('.kq [data-action="grill:0"]').bounding_box()
                    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':grill['x']+grill['width']/2,'y':grill['y']+grill['height']/2,'id':1}]})
                    page.wait_for_timeout(1200)
                    check('Holding touch across a grill timer rerender does not act early', state()['kitchen']['grill'][0]['phase'] == 'flip')
                    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                    wait("s.kitchen.grill[0].phase === 'side-two'", 3000)
                    check('Held touch releases one flip after the timer rerender', state()['kitchen']['grill'][0]['phase'] == 'side-two')
                    tap('grill:1', scroll=True)
                    wait("s.kitchen.grill.every(pan => pan.phase === 'ready')")
                    tap('grill:0', scroll=True)
                    tap('grill:1', scroll=True)
                    tap('tab:oven')
                    wait("s.kitchen.oven.phase === 'ready'")
                    tap('oven', scroll=True)
                    check('Touch controls prepare patties and lasagna together', state()['kitchen']['stock']['patty'] == 4 and state()['kitchen']['stock']['lasagna'] == 4)
                    for served in range(6):
                        wait('s.stations.some(station => station.phase === "editing")', 25000)
                        customer = min((station for station in state()['stations'] if station['phase'] == 'editing'), key=lambda station: station['order']['id'])
                        tap('order:' + str(customer['slot']))
                        tap('tab:plate')
                        for ingredient in customer['order']['recipe']['sequence']:
                            tap('add:' + ingredient)
                        check('Touch recipe matches: ' + customer['order']['recipe']['id'], state()['evaluation']['correct'])
                        tap('serve')
                        wait('s.ordersServed === ' + str(served+1))
                    wait('s.stations.some(station => station.phase === "editing" && station.order.request)', 25000)
                    for customer in state()['stations']:
                        tap('order:' + str(customer['slot']))
                        layout('long-ticket-' + customer['order']['recipe']['id'])
                        ticket = page.locator('.kq-ticket').bounding_box()
                        swipe(ticket['x']+ticket['width']-10, ticket['y']+ticket['height']*.8, -ticket['height']*.5)
                        check('Ticket scroll keeps Serve and food on screen: ' + customer['order']['recipe']['id'], page.locator('.kq').evaluate('el=>el.scrollTop') == 0)
                    tap('book')
                    frozen = state()['kitchen']['clock']
                    for _ in range(8):
                        last = page.locator('.kq dialog article').last.bounding_box()
                        if last['y'] >= 0 and last['y'] + last['height'] <= 570:
                            break
                        swipe(1000, 490, -300)
                    last = page.locator('.kq dialog article').last.bounding_box()
                    check('Touch scrolling reaches the last cookbook recipe', last['y'] >= 0 and last['y']+last['height'] <= 570)
                    check('Reading and scrolling cookbook freezes cooking', state()['paused'] and state()['kitchen']['clock'] == frozen)
                    layout('cookbook-scrolled')
                    tap('book:close')
                    check('Sticky cookbook close resumes the game', not state()['paused'])

                    # Read-only production diagnostics plus a route-local model
                    # fixture cover the largest legal custom ticket deterministically.
                    model_source = (directory / 'js/games/kitchen/model.js').read_text(encoding='utf-8')
                    model_source += '''\nconst tabletNewOrder = KitchenModel.prototype.newOrder;
KitchenModel.prototype.newOrder = function(excluded) {
  const order = tabletNewOrder.call(this, excluded);
  order.recipe = customizeRecipe(MENU_RECIPES.find(recipe => recipe.id === 'chef-salad'), 'extra-tomato');
  order.request = 'extra-tomato';
  return order;
};\n'''
                    context.route('**/js/games/kitchen/model.js', lambda route: route.fulfill(body=model_source, content_type='text/javascript'))
                    report['worstCaseFixture'] = 'Only the served model module response overrides newOrder to choose chef-salad + extra-tomato (7 steps).'
                    page.reload(wait_until='domcontentloaded')
                    RECOVERY['ready'](page)
                    page.evaluate("SQContentRegistry.open('game:kitchen', {origin:'hub'})")
                    page.wait_for_selector('.kq')
                    check('Worst-case fixture renders a real seven-step custom recipe', len(state()['order']['recipe']['sequence']) == 7 and state()['order']['request'] == 'extra-tomato')
                    layout('seven-step-custom-ticket')
                    for panel in ['grill','board','oven','plan']:
                        tap('tab:' + panel)
                        layout('seven-step-' + panel)
                    ticket = page.locator('.kq-ticket').bounding_box()
                    for _ in range(5):
                        swipe(ticket['x']+ticket['width']-10, ticket['y']+ticket['height']*.8, -ticket['height']*.5)
                    check('Touch scroll reaches step seven while controls remain fixed', page.locator('.kq-ticket li').last.evaluate('el=>{const r=el.getBoundingClientRect(),p=el.closest(".kq-ticket").getBoundingClientRect(); return r.top>=p.top&&r.bottom<=p.bottom;}') and page.locator('.kq').evaluate('el=>el.scrollTop') == 0)
                    page.set_viewport_size({'width':1280,'height':520})
                    layout('browser-bars-520', scrollable_pantry=True)
                    pantry = page.locator('.kq-pantry').bounding_box()
                    swipe(pantry['x']+pantry['width']-8, pantry['y']+pantry['height']*.8, -pantry['height']*.5)
                    tap('add:sauce', scroll=True)
                    check('Shorter browser viewport can touch-scroll the ingredient shelf', len(state()['layers']) == 1 and state()['layers'][0]['ingredient'] == 'sauce')
                    tap('clear')
                    check('Serve and Clear stay reachable with browser bars', not state()['layers'])
                    page.set_viewport_size({'width':1280,'height':600})
                check('No uncaught browser errors', not report['pageErrors'])
                check('No browser console errors', not report['consoleErrors'])
            except Exception as error:
                report['failure'] = str(error)
                report['traceback'] = traceback.format_exc()
                page.screenshot(path=str(out / 'failure.png'))
            finally:
                context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
    report['ok'] = bool(report['checks']) and all(item['ok'] for item in report['checks']) and not (report.get('failure') or report['pageErrors'] or report['consoleErrors'])
    (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"{sum(item['ok'] for item in report['checks'])}/{len(report['checks'])} browser checks passed", flush=True)
    if report.get('failure'):
        print(report['failure'], flush=True)
    return report['ok']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--web-root', type=Path, default=ROOT / 'dist/android-web')
    parser.add_argument('--baseline', action='store_true')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/kitchen-tablet-ui')
    raise SystemExit(0 if run(parser.parse_args()) else 1)
