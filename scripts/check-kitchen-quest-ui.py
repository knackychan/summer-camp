"""Kitchen Quest browser check: real UI, isolated save, normal-time cooking.

Requires Python Playwright. --target web checks dist/android-web after a build.
No game model state is changed by the test; snapshots are read-only assertions.
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
RECOVERY = runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'))
SNAPSHOT = "SQGames.get('kitchen').snapshot()"


def run(args):
    directory = ROOT if args.target == 'source' else ROOT / 'dist/android-web'
    brain_ids = json.loads(subprocess.check_output(['node', '-e',
        'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).GAMES)))',
        str(directory / 'js/brain-data.js')], text=True))
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = {'target': args.target, 'checks': [], 'pageErrors': [], 'consoleErrors': [],
              'scope': 'Headless Edge, normal-time RAF and real pointer controls; synthetic local profile.'}

    def check(name, condition):
        report['checks'].append({'name': name, 'ok': bool(condition)})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
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
            context = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'), offline=True)
            context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
            # A synthetic completed daily set opens the normal game gate, without test mode.
            context.add_init_script("""(() => {
              if (location.protocol !== 'http:' || localStorage.getItem('sq:kitchenFixture')) return;
              const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
                .formatToParts(new Date()).reduce((result, part) => (result[part.type] = part.value, result), {});
              const saved = JSON.parse(localStorage.getItem('keyquest:v2'));
              const done = Object.fromEntries(%s
                .map(id => [id, {score:8,ms:20000}]));
              saved.progress.luis.brain = {d:`${parts.year}-${parts.month}-${parts.day}`,done,starred:true};
              localStorage.setItem('keyquest:v2', JSON.stringify(saved));
              localStorage.setItem('sq:kitchenFixture','1');
            })();""" % json.dumps(brain_ids))
            page = context.new_page()
            page.set_default_timeout(12000)
            page.set_viewport_size({'width': 1280, 'height': 800})
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
            def console(message):
                if message.type != 'error':
                    return
                url = message.location.get('url', '')
                if 'net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1'):
                    report.setdefault('blockedRemoteResources', []).append(url)
                else:
                    report['consoleErrors'].append({'message': message.text, 'url': url})
            page.on('console', console)

            def state():
                return page.evaluate(SNAPSHOT)

            def tap(action):
                dialog = page.locator('.kq dialog[open]')
                scope = dialog if dialog.count() else page.locator('.kq > header') if action == 'pause' else page.locator('.kq')
                scope.locator(f'[data-action="{action}"]').click()

            def wait(expression, timeout=12000):
                page.wait_for_function('() => { const s = ' + SNAPSHOT + '; return ' + expression + '; }', timeout=timeout)

            def back(surface):
                check('Back handled: ' + surface, page.evaluate('SQPlatform.triggerBack()') is True)
                RECOVERY['wait_screen'](page, surface)
                check('Game stage cleaned: ' + surface, page.locator('#stage .kq').count() == 0)

            try:
                base = f'http://127.0.0.1:{server.server_port}'
                page.goto(base + '/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                page.locator('#hubTabs [data-t="adventure"]').click()
                page.locator('[data-adventure="games"]').click()
                page.locator('#gameRow [data-l="kitchen"]').click()
                page.wait_for_selector('#stage .kq')
                check('Games tile opens native Kitchen Quest', page.locator('iframe').count() == 0)
                check('Two customers, zero cooked patties', len(state()['stations']) == 2 and state()['kitchen']['stock']['patty'] == 0)

                tap('cookPatty')
                wait("s.kitchen.grill[0].phase === 'side-one'")
                layer_id = state()['layers'][0]['id']
                check('Raw patty reserves its dish layer', state()['layers'][0]['pending'])
                tap('pause')
                frozen = state()['kitchen']['clock']
                page.wait_for_timeout(650)
                check('Pause freezes cooking clock', state()['paused'] and state()['kitchen']['clock'] == frozen)
                tap('pause')
                tap('tab:grill')
                wait("s.kitchen.grill[0].phase === 'flip'", 15000)
                tap('grill:0')
                wait("s.kitchen.grill[0].phase === 'side-two'")
                tap('order:1')
                tap('add:tomato')
                tap('tab:grill')
                wait("s.kitchen.grill[0].phase === 'ready'", 15000)
                tap('grill:0')
                check('Collection reaches original customer', state()['activeSlot'] == 1 and
                      state()['stations'][0]['layers'][0]['id'] == layer_id and
                      not state()['stations'][0]['layers'][0].get('pending'))
                tap('order:0')
                tap('tab:plate')
                tap('add:cheese')
                check('Cooked burger matches exact recipe', state()['evaluation']['correct'])
                check('Cooked layers and canvas are visible', page.locator('.kq-scene canvas').is_visible() and page.locator('.kq-layers button').count() == 2)
                page.screenshot(path=str(out / 'burger-ready.png'))
                tap('serve')
                wait('s.ordersServed === 1')
                check('Serving saves the host best', page.evaluate("SQHost.progress.luis.best.kitchen") == 1)
                check('Best is persisted locally', page.evaluate("JSON.parse(localStorage.getItem('keyquest:v2')).progress.luis.best.kitchen") == 1)
                wait('!s.stations.some(station => station.phase === "serving")')

                tap('order:1')
                parked = state()['layers']
                tap('difficulty:standard')
                wait('!!s.pendingMode')
                frozen = state()['kitchen']['clock']
                page.wait_for_timeout(400)
                check('Difficulty confirmation freezes cooking', state()['kitchen']['clock'] == frozen)
                page.keyboard.press('p')
                page.keyboard.press('p')
                check('Pause hotkey preserves pending confirmation', bool(state()['pendingMode']) and
                      page.locator('.kq dialog[open] [data-action="confirm:no"]').is_visible())
                tap('confirm:no')
                check('Cancel keeps both dishes and difficulty', state()['layers'] == parked and state()['difficulty'] == 'easy')

                tap('tab:board')
                initial_stock = state()['kitchen']['stock']['tomato']
                for _ in range(4):
                    tap('board:cut')
                check('Four chops replenish six portions', state()['kitchen']['stock']['tomato'] == initial_stock + 6)
                tap('tab:oven')
                for ingredient in ['pasta', 'sauce', 'cheese', 'pasta', 'sauce', 'cheese']:
                    tap('lasagna:add:' + ingredient)
                tap('oven')
                wait("s.kitchen.oven.phase === 'baking'")
                check('Lasagna remains unready during baking', state()['kitchen']['stock']['lasagna'] == 0)
                page.screenshot(path=str(out / 'lasagna-baking.png'))
                wait('s.stations[0].phase === "editing"')
                tap('order:0')
                check('Long replacement recipe has four steps', len(state()['order']['recipe']['sequence']) == 4)

                for width, height in [(1280, 800), (1024, 500), (768, 1024), (390, 844)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    tap('tab:plate')
                    page.locator('.kq').evaluate('root => { root.scrollTop = 0; }')
                    page.wait_for_timeout(150)
                    metrics = page.locator('.kq').evaluate('''root => ({
                      overflow: root.scrollWidth > root.clientWidth + 1,
                      bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                      controls: [...root.querySelectorAll('button')].filter(button => button.getClientRects().length)
                        .map(button => ({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))
                    })''')
                    check(f'Layout fits {width}x{height}', not metrics['overflow'] and not metrics['bodyOverflow'])
                    check(f'Touch targets {width}x{height}', all(button['width'] >= 43 and button['height'] >= 43 for button in metrics['controls']))
                    page.screenshot(path=str(out / f'kitchen-{width}x{height}.png'), full_page=True)
                    if height == 500 or width == 390:
                        page.locator('.kq [data-action="serve"]').evaluate('button => button.scrollIntoView({block:"nearest",behavior:"instant"})')
                        bounds = page.locator('.kq [data-action="serve"]').evaluate('button => { const r = button.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:innerHeight}; }')
                        report.setdefault('actionBounds', []).append({'viewport': [width, height], 'action': 'serve', **bounds})
                        check(f'Long recipe actions reachable {width}x{height}', bounds['top'] >= -1 and bounds['bottom'] <= bounds['height'] + 1)
                        tap('tab:oven')
                        page.locator('.kq [data-action="oven"]').evaluate('button => button.scrollIntoView({block:"nearest",behavior:"instant"})')
                        bounds = page.locator('.kq [data-action="oven"]').evaluate('button => { const r = button.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:innerHeight}; }')
                        report.setdefault('actionBounds', []).append({'viewport': [width, height], 'action': 'oven', **bounds})
                        check(f'Oven action reachable {width}x{height}', bounds['top'] >= -1 and bounds['bottom'] <= bounds['height'] + 1)
                        page.screenshot(path=str(out / f'kitchen-oven-{width}x{height}.png'), full_page=True)
                page.set_viewport_size({'width': 1280, 'height': 800})
                page.locator('#back').focus()
                page.keyboard.press('Enter')
                RECOVERY['wait_screen'](page, 'hub')
                check('Enter on host Back returns to hub and cleans game', page.locator('#stage .kq').count() == 0)
                page.evaluate("SummerQuest.navigate('world')")
                RECOVERY['wait_world'](page)
                opened = page.evaluate("SQContentRegistry.open('game:kitchen', {origin:'world'})")
                check('World registry opens Kitchen Quest', opened['ok'])
                page.wait_for_selector('#stage .kq')
                check('Reopen starts fresh with saved best', state()['ordersServed'] == 0 and state()['best'] == 1)
                back('world')

                if not args.skip_offline:
                    page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=45000)
                    context.set_offline(True)
                    page.reload(wait_until='domcontentloaded')
                    RECOVERY['ready'](page)
                    RECOVERY['wait_world'](page)
                    opened = page.evaluate("SQContentRegistry.open('game:kitchen', {origin:'world'})")
                    check('Kitchen opens after offline reload', opened['ok'])
                    page.wait_for_selector('#stage .kq')
                    check('Offline reload preserves best', state()['best'] == 1)
                    tap('cookPatty')
                    check('Offline raw cooking starts', state()['kitchen']['grill'][0]['phase'] == 'side-one')
                    back('world')
                    context.set_offline(False)
                check('No uncaught browser errors', not report['pageErrors'])
                check('No browser console errors', not report['consoleErrors'])
            except Exception as error:
                report['failure'] = str(error)
                report['traceback'] = traceback.format_exc()
                page.screenshot(path=str(out / 'failure.png'), full_page=True)
            finally:
                context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
    report['ok'] = bool(report['checks']) and all(check['ok'] for check in report['checks']) and not (
        report.get('failure') or report['pageErrors'] or report['consoleErrors'])
    (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"{sum(check['ok'] for check in report['checks'])}/{len(report['checks'])} browser checks passed", flush=True)
    if report.get('failure'):
        print(report['failure'], flush=True)
    return report['ok']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/kitchen-quest-ui')
    parser.add_argument('--skip-offline', action='store_true')
    raise SystemExit(0 if run(parser.parse_args()) else 1)
