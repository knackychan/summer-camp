"""Kitchen Quest v0.7: real cooking, saved progression, cookbook and prep planner.

Requires Python Playwright and Edge. Uses isolated synthetic local saves and the
recovery harness's offline config/server. Game snapshots are read only; cooking
runs at normal speed through the same controls used by a player.
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


def fixture(total):
    seed = RECOVERY['saved_fixture']('hub')
    saved = json.loads(seed['keyquest:v2'])
    # A supplied profile is authoritative even when the legacy best is higher.
    saved['progress']['luis']['best']['kitchen'] = 20
    saved['settings']['kitchen'] = {'profiles': {'luis': {
        'version': 1, 'totalServed': total,
        'recipeServes': {'cheese-burger': total}, 'completedShifts': 0,
        'shift': {'served': total, 'recipes': ['cheese-burger'], 'families': ['burger']}
    }}}
    seed['keyquest:v2'] = json.dumps(saved)
    seed['sq:famSettings'] = json.dumps({'tts_enabled': '1'})
    return seed


def run(args):
    directory = ROOT if args.target == 'source' else args.web_root.resolve()
    brain_ids = json.loads(subprocess.check_output(['node', '-e',
        'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).GAMES)))',
        str(directory / 'js/brain-data.js')], text=True))
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = {'target': args.target, 'directory': str(directory), 'checks': [], 'pageErrors': [], 'consoleErrors': [],
              'scope': 'Headless Edge; isolated local profiles; real pointer controls and normal-time cooking.'}

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
            contexts = []
            page = None

            def new_page(total):
                context = RECOVERY['context_for'](browser, seed=fixture(total), offline=True)
                contexts.append(context)
                context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
                context.add_init_script("""(() => {
                  window.kitchenSpoken = [];
                  const speak = speechSynthesis.speak.bind(speechSynthesis);
                  speechSynthesis.speak = utterance => {
                    window.kitchenSpoken.push({text:utterance.text, lang:utterance.lang});
                    speak(utterance);
                  };
                  if (location.protocol !== 'http:' || localStorage.getItem('sq:kitchenV07Fixture')) return;
                  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
                    .formatToParts(new Date()).reduce((result, part) => (result[part.type] = part.value, result), {});
                  const saved = JSON.parse(localStorage.getItem('keyquest:v2'));
                  const done = Object.fromEntries(%s
                    .map(id => [id, {score:8,ms:20000}]));
                  for (const kid of ['luis','lili']) {
                    saved.progress[kid] ||= {};
                    saved.progress[kid].brain = {d:`${parts.year}-${parts.month}-${parts.day}`,done,starred:true};
                  }
                  localStorage.setItem('keyquest:v2', JSON.stringify(saved));
                  localStorage.setItem('sq:kitchenV07Fixture','1');
                })();""" % json.dumps(brain_ids))
                tab = context.new_page()
                tab.set_default_timeout(12000)
                tab.set_viewport_size({'width': 1280, 'height': 800})
                tab.on('pageerror', lambda error: report['pageErrors'].append(str(error)))

                def console(message):
                    if message.type != 'error':
                        return
                    url = message.location.get('url', '')
                    if 'net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1'):
                        report.setdefault('blockedRemoteResources', []).append(url)
                    else:
                        report['consoleErrors'].append({'message': message.text, 'url': url})

                tab.on('console', console)
                tab.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](tab)
                RECOVERY['wait_screen'](tab, 'hub')
                return tab

            def open_game():
                page.evaluate("SummerQuest.navigate('hub')")
                RECOVERY['wait_screen'](page, 'hub')
                page.locator('#hubTabs [data-t="adventure"]').click()
                page.locator('[data-adventure="games"]').click()
                page.locator('#gameRow [data-l="kitchen"]').click()
                page.wait_for_selector('.kq[data-version="0.7.0"]')

            def state():
                return page.evaluate(SNAPSHOT)

            def tap(action):
                dialog = page.locator('.kq dialog[open]')
                scope = dialog if dialog.count() else page.locator('.kq > header') if action == 'pause' else (
                    page.locator('.kq-tabs') if action.startswith('tab:') else page.locator('.kq'))
                scope.locator(f'[data-action="{action}"]').click()

            def wait(expression, timeout=12000):
                page.wait_for_function('() => { const s = ' + SNAPSHOT + '; return ' + expression + '; }', timeout=timeout)

            def unlocked():
                return page.locator('.kq dialog[data-kind="book"] [data-unlocked="true"]').count()

            def layout(width, height, surface):
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_timeout(100)
                metrics = page.locator('.kq').evaluate('''root => {
                  const surface = root.querySelector('dialog[open]') || root;
                  return {
                    overflow: root.scrollWidth > root.clientWidth + 1 || surface.scrollWidth > surface.clientWidth + 1,
                    bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                    controls: [...surface.querySelectorAll('button')].filter(button => button.getClientRects().length)
                      .map(button => ({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))
                  };
                }''')
                check(f'{surface} fits {width}x{height}', not metrics['overflow'] and not metrics['bodyOverflow'])
                check(f'{surface} touch targets {width}x{height}', bool(metrics['controls']) and
                      all(button['width'] >= 43 and button['height'] >= 43 for button in metrics['controls']))
                page.screenshot(path=str(out / f'{surface}-{width}x{height}.png'), full_page=True)

            try:
                page = new_page(3)
                check('Browser fixture has no service credentials', page.evaluate('Object.keys(window.SQ_CONFIG).length === 0'))
                open_game()
                check('v0.7 opens natively with its existing child profile',
                      page.locator('iframe').count() == 0 and state()['profile']['totalServed'] == 3)
                check('Existing profile does not reimport a larger legacy best', state()['best'] == 20)
                check('Current shift exposes count and recipe-variety goals',
                      [(goal['id'], goal['current'], goal['target']) for goal in state()['goals']['targets']] ==
                      [('served', 3, 4), ('recipes', 1, 2)])
                tap('book')
                check('Cookbook starts with five unlocked recipes', unlocked() == 5)
                check('Fourth serve recipe is visibly locked',
                      page.locator('.kq dialog [data-recipe-id="pickle-crunch-burger"]').get_attribute('data-unlocked') == 'false')
                tap('book:close')
                tap('tab:plan')
                patty = page.locator('.kq-bench [data-ingredient="patty"]')
                check('Prep planner sees both customers need patties', patty.get_attribute('data-shortage') == '2')
                tap('cookPatty')
                wait("s.kitchen.grill[0].phase === 'side-one'")
                tap('tab:plan')
                check('Reserved patty reduces the remaining prep shortage', patty.get_attribute('data-shortage') == '1')
                tap('book')
                frozen = state()['kitchen']['clock']
                page.wait_for_timeout(450)
                check('Cookbook freezes active cooking', state()['paused'] and state()['kitchen']['clock'] == frozen)
                page.keyboard.press('Escape')
                check('Escape closes only cookbook and retains game',
                      page.locator('.kq').is_visible() and page.locator('.kq dialog[open]').count() == 0 and not state()['paused'])
                wait('s.kitchen.clock > ' + str(frozen))
                check('Closing cookbook resumes active cooking', state()['kitchen']['clock'] > frozen)
                tap('book')
                page.evaluate("window.dispatchEvent(new Event('summerquest:native-pause'))")
                tap('book:close')
                frozen = state()['kitchen']['clock']
                page.wait_for_timeout(350)
                check('Background pause survives closing cookbook', state()['paused'] and state()['kitchen']['clock'] == frozen)
                tap('pause')
                tap('tab:grill')
                wait("s.kitchen.grill[0].phase === 'flip'", 15000)
                tap('grill:0')
                wait("s.kitchen.grill[0].phase === 'ready'", 15000)
                tap('grill:0')
                tap('add:cheese')
                check('Original cheese burger is cooked through normal controls', state()['evaluation']['correct'])
                page.locator('.kq [data-action="serve"]').dblclick(delay=10)
                wait('s.ordersServed === 1')
                check('Double serve counts progression once', state()['profile']['totalServed'] == 4 and
                      state()['profile']['recipeServes']['cheese-burger'] == 4)
                check('Repeated dish completes count goal but still needs variety',
                      state()['goals']['targets'][0]['complete'] and not state()['goals']['completed'] and
                      state()['profile']['completedShifts'] == 0)
                check('New progression persists through host settings',
                      page.evaluate("JSON.parse(localStorage.getItem('keyquest:v2')).settings.kitchen.profiles.luis.totalServed") == 4)
                tap('book')
                check('Fourth successful dish unlocks the sixth recipe', unlocked() == 6 and
                      page.locator('.kq dialog [data-recipe-id="pickle-crunch-burger"]').get_attribute('data-unlocked') == 'true')
                check('New recipe retains bilingual labels',
                      bool(page.locator('.kq dialog [data-recipe-id="pickle-crunch-burger"] [lang="zh-Hant"]').count()))
                page.screenshot(path=str(out / 'first-unlock.png'), full_page=True)
                tap('book:close')
                page.reload(wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                open_game()
                check('Reload preserves profile and starts a fresh local round',
                      state()['profile']['totalServed'] == 4 and state()['ordersServed'] == 0)
                page.evaluate("SummerQuest.navigate('home')")
                RECOVERY['wait_screen'](page, 'home')
                page.locator('#heroes [data-kid="lili"]').click()
                RECOVERY['wait_world'](page)
                opened = page.evaluate("SQContentRegistry.open('game:kitchen', {origin:'world'})")
                check('Sibling child opens Kitchen Quest from world', opened['ok'])
                page.wait_for_selector('.kq[data-version="0.7.0"]')
                check('Sibling child inherits no chef progress', state()['profile']['totalServed'] == 0 and
                      not any(state()['profile']['recipeServes'].values()))
                tap('book')
                check('Sibling child keeps starter cookbook', unlocked() == 5)
                tap('book:close')
                check('Native Back still exits Kitchen Quest', page.evaluate('SQPlatform.triggerBack()') is True)
                RECOVERY['wait_world'](page)
                check('Native Back cleans Kitchen Quest stage', page.locator('#stage .kq').count() == 0)

                # A separate initial save exercises the complete nine-recipe book.
                page = new_page(16)
                open_game()
                tap('book')
                check('Experienced profile sees all nine recipes', unlocked() == 9)
                for width, height in [(1280, 800), (1024, 500), (768, 1024), (390, 844)]:
                    layout(width, height, 'cookbook')
                    last = page.locator('.kq dialog [data-recipe-id="lasagna-feast"]')
                    last.scroll_into_view_if_needed()
                    bounds = last.evaluate('el => { const r = el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,height:innerHeight}; }')
                    check(f'Last cookbook recipe reachable {width}x{height}',
                          last.is_visible() and bounds['bottom'] > 0 and bounds['top'] < bounds['height'])
                tap('book:close')
                tap('tab:grill')
                tap('grill:0')
                tap('tab:plan')
                patty = page.locator('.kq-bench [data-ingredient="patty"]')
                check('Prep planner accounts for a shared batch in progress',
                      patty.get_attribute('data-preparing') == '2' and patty.get_attribute('data-shortage') == '0')
                for width, height in [(1280, 800), (1024, 500), (768, 1024), (390, 844)]:
                    layout(width, height, 'planner')

                page.set_viewport_size({'width': 1280, 'height': 800})
                tap('difficulty:standard')
                tap('confirm:yes')
                tap('tab:oven')
                for ingredient in ['pasta', 'sauce', 'cheese', 'pasta', 'sauce', 'cheese']:
                    tap('lasagna:add:' + ingredient)
                tap('oven')
                tap('tab:grill')
                tap('grill:0')
                tap('grill:1')
                wait("s.kitchen.grill.every(pan => pan.phase === 'flip')", 15000)
                tap('grill:0')
                tap('grill:1')
                wait("s.kitchen.grill.every(pan => pan.phase === 'ready')", 15000)
                tap('grill:0')
                tap('grill:1')
                tap('tab:oven')
                wait("s.kitchen.oven.phase === 'ready'", 15000)
                tap('oven')
                check('Standard shift prepares burger and lasagna batches together',
                      state()['kitchen']['stock']['patty'] == 4 and state()['kitchen']['stock']['lasagna'] == 4)
                for served in range(6):
                    wait('s.stations.some(station => station.phase === "editing")', 25000)
                    customer = min((station for station in state()['stations'] if station['phase'] == 'editing'),
                                   key=lambda station: station['order']['id'])
                    tap('order:' + str(customer['slot']))
                    tap('tab:plate')
                    for ingredient in customer['order']['recipe']['sequence']:
                        tap('add:' + ingredient)
                    check('Standard dish follows its ticket: ' + customer['order']['recipe']['id'], state()['evaluation']['correct'])
                    tap('serve')
                    wait('s.ordersServed === ' + str(served + 1))
                wait('s.stations.some(station => station.phase === "editing" && station.order.request)', 25000)
                customer = next(station for station in state()['stations'] if station['order'].get('request'))
                tap('order:' + str(customer['slot']))
                check('Normal standard play introduces the authored custom request',
                      state()['order']['request'] == 'no-cheese' and state()['order']['recipe']['id'] == 'chef-salad')
                check('Custom ticket removes cheese and keeps every remaining step in order',
                      state()['order']['recipe']['sequence'] == ['lettuce', 'tomato', 'pickles', 'tomato', 'sauce'] and
                      page.locator('.kq-ticket ol li > span > span').all_text_contents() ==
                      ['Lettuce', 'Tomato', 'Pickles', 'Tomato', 'Sauce'])
                check('Customer request is visible and included in its accessible name',
                      'No cheese, please' in page.locator('.kq-ticket .kq-request').inner_text() and
                      '請不要加起司' in page.locator(f'.kq-customers [data-action="order:{customer["slot"]}"]').get_attribute('aria-label'))
                spoken_before = page.evaluate('kitchenSpoken.length')
                tap('read')
                spoken = page.evaluate('kitchenSpoken')[spoken_before:]
                check('Listen reads the customized ticket in English and Traditional Chinese',
                      len(spoken) == 2 and spoken[0]['lang'] == 'en-US' and spoken[1]['lang'] == 'zh-TW' and
                      'No cheese, please' in spoken[0]['text'] and '請不要加起司' in spoken[1]['text'] and
                      'Lettuce, Tomato, Pickles, Tomato, Sauce' in spoken[0]['text'])
                page.set_viewport_size({'width': 1024, 'height': 500})
                badge = page.locator('.kq-ticket .kq-request')
                badge.scroll_into_view_if_needed()
                check('Custom request remains visible in short landscape', badge.is_visible())
                page.screenshot(path=str(out / 'custom-request-1024x500.png'), full_page=True)
                check('No uncaught browser errors', not report['pageErrors'])
                check('No browser console errors', not report['consoleErrors'])
            except Exception as error:
                report['failure'] = str(error)
                report['traceback'] = traceback.format_exc()
                if page:
                    page.screenshot(path=str(out / 'failure.png'), full_page=True)
            finally:
                for context in contexts:
                    context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)
    report['ok'] = bool(report['checks']) and all(item['ok'] for item in report['checks']) and not (
        report.get('failure') or report['pageErrors'] or report['consoleErrors'])
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
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/kitchen-v07-ui')
    raise SystemExit(0 if run(parser.parse_args()) else 1)
