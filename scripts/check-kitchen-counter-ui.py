"""Kitchen Quest v0.8 counter + the Games / Practice split, in a real browser.

Supersedes check-kitchen-quest-ui.py, check-kitchen-v07-ui.py and
check-kitchen-tablet-ui.py for the Kitchen UI (those drive the retired v0.7
tab layout and are kept for history). Uses the recovery harness's isolated save
and server, coarse-pointer touch emulation, and normal-time cooking.

  python scripts/check-kitchen-counter-ui.py [--browser PATH] [--target web]
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
SNAPSHOT = "SQGames.get('kitchen').snapshot()"
SIZES = [(1280, 800), (1280, 600)]


def run(args):
    directory = ROOT if args.target == 'source' else args.web_root.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    brain_ids = json.loads(subprocess.check_output(['node', '-e',
        'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).GAMES)))',
        str(directory / 'js/brain-data.js')], text=True))
    # The expected Games / Practice split comes from the manifest, so adding a game never stales this script.
    split = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import('file://' + process.argv[1]).then(m => process.stdout.write(JSON.stringify({"
        "games: m.MANIFEST.filter(e => !e.brain && !e.practice).map(e => e.id),"
        "practice: m.MANIFEST.filter(e => e.brain || e.practice).map(e => e.id)})))",
        str(directory / 'js/games/index.js')], text=True))
    report = {'target': args.target, 'checks': [], 'pageErrors': [], 'consoleErrors': [], 'layouts': {}}

    def check(name, condition):
        report['checks'].append({'name': name, 'ok': bool(condition)})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        assert condition, name

    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(RECOVERY['Handler'], directory=str(directory)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            launch = {'headless': True}
            if args.browser:
                launch['executable_path'] = args.browser
            browser = playwright.chromium.launch(**launch)
            report['browser'] = browser.version
            for width, height in SIZES:
                tag = f'{width}x{height}'

                class Touch:
                    def new_context(self, **options):
                        options.update(viewport={'width': width, 'height': height}, has_touch=True, service_workers='block')
                        return browser.new_context(**options)

                context = RECOVERY['context_for'](Touch(), seed=V07['fixture'](16, pin='counter-ui-26'), offline=True)
                context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
                # Today's Brain Gym trio is done, so games are open; the lock test re-closes it.
                context.add_init_script("""(() => {
                  if (location.protocol !== 'http:' || localStorage.getItem('sq:kitchenCounterFixture')) return;
                  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
                    .formatToParts(new Date()).reduce((r, p) => (r[p.type] = p.value, r), {});
                  const saved = JSON.parse(localStorage.getItem('keyquest:v2'));
                  saved.progress.luis.brain = {d:`${parts.year}-${parts.month}-${parts.day}`,done:Object.fromEntries(%s.map(id => [id, {score:8,ms:20000}])),starred:true};
                  localStorage.setItem('keyquest:v2', JSON.stringify(saved));
                  localStorage.setItem('sq:kitchenCounterFixture','1');
                })();""" % json.dumps(brain_ids))
                page = context.new_page()
                page.set_default_timeout(15000)
                page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))

                def console(message):
                    if message.type == 'error':
                        url = message.location.get('url', '')
                        if not ('net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1')):
                            report['consoleErrors'].append({'message': message.text, 'url': url})
                page.on('console', console)

                def state():
                    return page.evaluate(SNAPSHOT)

                def wait(expression, timeout=20000):
                    page.wait_for_function('() => { const s = ' + SNAPSHOT + '; return ' + expression + '; }', timeout=timeout)

                def tap(selector):
                    target = page.locator(selector).first
                    box = target.evaluate('''el => { const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
                      return {x,y,w:r.width,h:r.height,on:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:el.contains(document.elementFromPoint(x,y))}; }''')
                    assert box['on'] and box['hit'], f'{selector} not tappable: {box}'
                    page.touchscreen.tap(box['x'], box['y'])
                    page.wait_for_timeout(60)

                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')

                if (width, height) == SIZES[0]:
                    # ---- Games / Practice split ----
                    page.evaluate("SummerQuest.navigate('adventure')")
                    page.wait_for_selector('[data-adventure="practice"]')
                    check('Adventure lists Games and Practice', page.locator('[data-adventure="games"]').count() == 1 and page.locator('[data-adventure="practice"]').count() == 1)
                    page.evaluate("SummerQuest.navigate('games')")
                    games = page.evaluate("[...document.querySelectorAll('#gameRow .gamecard')].map(c=>c.dataset.l)")
                    page.evaluate("SummerQuest.navigate('practice')")
                    practice = page.evaluate("[...document.querySelectorAll('#practiceRow .gamecard')].map(c=>c.dataset.l)")
                    report['games'], report['practice'] = games, practice
                    # Music Room instruments (pads, piano, moog) are manifest games reached through their own tile, so the tab may list fewer.
                    check('Games tab lists manifest games only, with the core arcade and Kitchen', {'kitchen', 'machines', 'monster-truck', 'solar'} <= set(games) <= set(split['games']))
                    check('Practice tab has Brain Gym plus typing and word drills', {'calc', 'hunt', 'home', 'vocab'} <= set(practice) <= set(split['practice']) and not set(practice) & set(games))
                    check('Dig Site and Change Maker are gone', 'dig' not in games + practice and 'change' not in games + practice)
                    check('Dig Site and Change Maker no longer open', page.evaluate("Promise.all([SQContentRegistry.open('game:dig'),SQContentRegistry.open('game:change')]).then(r=>r.every(x=>!x.ok))"))
                    page.evaluate("progress.luis.brain.done={}; SummerQuest.navigate('games')")
                    page.wait_for_selector('#lockToPractice')
                    check('Brain-locked Games tab points to Practice', page.locator('#gamesLockCard').count() == 1)
                    page.wait_for_function("document.querySelectorAll('.sqtoast').length === 0", timeout=20000)  # the fixture's achievement toast covers the button
                    tap('#lockToPractice')
                    check('Practice button opens the Practice tab', page.evaluate('hubTab') == 'practice' and not page.locator('#tab-practice').evaluate('el=>el.classList.contains("hidden")'))
                    page.evaluate("progress.luis.brain.done=Object.fromEntries(brainTrio('luis').map(id=>[id,{score:8,ms:1}]))")
                    page.evaluate("SQContentRegistry.open('game:hunt',{origin:'hub'})")
                    page.wait_for_selector('#levelChips .chip')
                    rail = page.evaluate("({fs:document.body.classList.contains('game-fs'),chips:[...document.querySelectorAll('#levelChips .chip')].map(c=>c.dataset.l),visible:!!document.getElementById('levelChips').getClientRects().length})")
                    check('Practice keeps its rail, listing practice only', not rail['fs'] and rail['visible'] and 'hunt' in rail['chips'] and 'kitchen' not in rail['chips'])
                    for game in ['monster-truck', 'solar']:
                        page.evaluate(f"SQContentRegistry.open('game:{game}',{{origin:'hub'}})")
                        page.wait_for_timeout(2500)
                        fs = page.evaluate("({fs:document.body.classList.contains('game-fs'),rail:!!document.getElementById('levelChips').getClientRects().length,stage:document.getElementById('stage').getBoundingClientRect().width})")
                        check(f'{game} opens full screen without the rail', fs['fs'] and not fs['rail'] and fs['stage'] >= width - 40)
                    page.evaluate("goHome()")

                # ---- Kitchen counter ----
                check(f'{tag}: registry opens Kitchen Quest', page.evaluate("SQContentRegistry.open('game:kitchen',{origin:'hub'})")['ok'])
                page.wait_for_selector('.kq[data-version="0.8.0"]')
                if (width, height) == SIZES[0]:
                    page.wait_for_function(SNAPSHOT + ".scene.talks >= 1", timeout=8000)
                    page.wait_for_timeout(700)
                    page.screenshot(path=str(out / 'customer-talking.png'))
                page.wait_for_function("document.querySelectorAll('.sqtoast').length === 0", timeout=20000)
                page.wait_for_timeout(300)
                metrics = page.evaluate('''() => {
                  const r = el => { const b = el.getBoundingClientRect(); return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right}; };
                  const controls = [...document.querySelectorAll('.kq button, .kq-setbar button, #back, #mute')].filter(b => b.getClientRects().length && !b.closest('.kq-ticket,.kq-orders,dialog'));
                  return { fs: document.body.classList.contains('game-fs'), rail: !!document.getElementById('levelChips').getClientRects().length,
                    overflow: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
                    counter: r(document.querySelector('.kq-counter')),
                    small: controls.filter(b => { const q = b.getBoundingClientRect(); return q.width < 44 || q.height < 44; }).map(b => b.dataset.action || b.id),
                    off: controls.filter(b => { const q = b.getBoundingClientRect(), x = q.x + q.width / 2, y = q.y + q.height / 2;
                      return q.x < 0 || q.y < 0 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1 || !b.contains(document.elementFromPoint(x, y)); }).map(b => b.dataset.action || b.id) };
                }''')
                report['layouts'][tag] = metrics
                page.screenshot(path=str(out / f'counter-{tag}.png'))
                check(f'{tag}: kitchen is full screen with no rail', metrics['fs'] and not metrics['rail'])
                check(f'{tag}: no page scroll', not metrics['overflow'])
                check(f'{tag}: every control is at least 44px', not metrics['small'])
                check(f'{tag}: every control is on screen and unobstructed', not metrics['off'])
                check(f'{tag}: the counter is the biggest area', metrics['counter']['w'] >= width * .45 and metrics['counter']['h'] >= height * .35)

                if (width, height) != SIZES[0]:
                    page.close(); context.close(); continue

                s = state()
                check('Starts on Very Easy with two customers', s['difficulty'] == 'easy' and len(s['stations']) == 2 and s['view'] == 'plate')
                check('Idle grill and oven shrink to icons in the strip', page.locator('.kq-strip .kq-chip--idle[data-action="view:grill"]').count() == 1 and page.locator('.kq-strip .kq-chip--idle[data-action="view:oven"]').count() == 1)
                page.wait_for_function(SNAPSHOT + ".scene.customers.every(c => c && c.state === 'here')")
                # Customers come in one at a time, two more line up, and each one speaks their order.
                page.wait_for_function(SNAPSHOT + ".scene.line.length === 2 && " + SNAPSHOT + ".scene.line.every(l => l.state === 'standing')", timeout=15000)
                s = state()
                times = sorted(a['at'] for a in s['scene']['arrivals'])
                check('Customers walk in one at a time', len(times) >= 4 and all(b - a >= .5 for a, b in zip(times, times[1:])))
                people = [c['who'] for c in s['scene']['customers']] + [l['who'] for l in s['scene']['line']]
                check('Each customer is a different named regular', len(set(people)) == 4 and all(people))
                page.wait_for_function(SNAPSHOT + ".scene.talks >= 2", timeout=15000)
                check('Both seated customers say what they want', state()['scene']['talks'] >= 2)
                queue = page.evaluate("[...document.querySelectorAll('.kq-queue .kq-order:not(.kq-toast-out)')].map(e => ({line: e.classList.contains('kq-order--line'), name: e.querySelector('b').innerText}))")
                check('Customer queue lists the two at the counter, then the two in line, by name', [q['line'] for q in queue] == [False, False, True, True] and len({q['name'] for q in queue}) == 4)
                page.screenshot(path=str(out / 'customer-queue.png'))
                # Raw patty: reserved layer, grill opens, flip, collect.
                tap('.kq-tray[data-action="cookPatty"]')
                s = state()
                check('Raw patty reserves its place and opens the grill', s['layers'][0]['pending'] and s['view'] == 'grill' and s['kitchen']['grill'][0]['phase'] == 'side-one')

                def patty_words():
                    # What the plate's reserved patty is called on the ticket, on the customer card and in the hint.
                    return page.evaluate('''() => ({
                      heat: document.querySelector('.kq-ticket li.pending').dataset.heat,
                      row: document.querySelector('.kq-ticket li.pending em').innerText,
                      card: document.querySelector('.kq-queue .kq-order[aria-pressed="true"] .kq-order-status').innerText,
                      hint: document.querySelector('.kq-hint').innerText })''')
                words = patty_words()
                check('While the patty cooks, the ticket, the customer card and the hint say it is on the grill',
                      words == {'heat': 'side-one', 'row': 'On the grill', 'card': 'On the grill', 'hint': 'Patty on the grill. It needs a flip soon.'})
                wait("s.kitchen.grill[0].phase === 'flip'")
                page.wait_for_timeout(250)
                words = patty_words()
                check('When the pan needs a flip, the ticket, the customer card and the hint all say flip',
                      words == {'heat': 'flip', 'row': 'Flip it!', 'card': 'Flip it!', 'hint': 'Flip the patty!'})
                check('A busy pan shows in full in the strip', page.locator('.kq-strip [data-pan="0"]').count() == 1)
                check('A big FLIP prompt appears on the grill', page.evaluate("(() => { const p = document.querySelector('.kq-prompt'); return p.hidden ? null : p.dataset.action; })()") == 'grill:0')
                tap('.kq-station [data-action="grill:0"]')
                check('Flip on the pan button', state()['kitchen']['grill'][0]['phase'] == 'side-two')
                wait("s.kitchen.grill[0].phase === 'ready'")
                check('A big TAKE IT OUT prompt appears when the patty is done', page.evaluate("(() => { const p = document.querySelector('.kq-prompt'); return p.hidden ? null : p.dataset.action; })()") == 'grill:0')
                page.wait_for_timeout(250)
                words = patty_words()
                check('When the patty is done, the ticket, the customer card and the hint all say ready',
                      words == {'heat': 'ready', 'row': 'Ready!', 'card': 'Ready!', 'hint': 'Take the patty out of the pan!'})
                page.screenshot(path=str(out / 'grill-ready.png'))
                tap('.kq-station [data-action="grill:0"]')
                s = state()
                check('Collect returns the cooked patty to its reserved place', not s['layers'][0].get('pending') and s['view'] == 'plate')
                contacts = s['scene']['contacts']
                tap('.kq-tray[data-action="add:cheese"]')
                page.wait_for_timeout(260)
                s = state()
                check('Cheese snaps onto the plate with one contact', s['layers'][-1]['ingredient'] == 'cheese' and s['scene']['contacts'] == contacts + 2 and 'FLOUP!' in s['scene']['captions'])
                page.screenshot(path=str(out / 'cheese-landed.png'))
                cheese = s['layers'][-1]['id']
                point = page.evaluate(f"SQGames.get('kitchen').layerPoint({cheese})")
                page.touchscreen.tap(point['x'], point['y'])
                page.wait_for_timeout(250)
                check('Tapping the real cheese on the plate removes that layer', all(l['id'] != cheese for l in state()['layers']))
                tap('.kq-tray[data-action="add:cheese"]')
                page.wait_for_timeout(250)
                check('Recipe is complete', state()['evaluation']['correct'])
                check('A big SERVE IT prompt appears over the counter', page.evaluate("(() => { const p = document.querySelector('.kq-prompt'); return !p.hidden && p.dataset.action; })()") == 'serve')
                page.screenshot(path=str(out / 'serve-prompt.png'))
                tap('.kq-serve')
                page.wait_for_timeout(300)
                s = state()
                check('Serve counts the order and shows YUM', s['ordersServed'] == 1 and 'YUM!' in s['scene']['captions'])
                check('The served customer says thank you', s['scene']['customers'][0]['thanks'])
                page.screenshot(path=str(out / 'served.png'))
                wait("s.stations[0].phase === 'editing' && s.stations[0].order.id !== 1", 15000)
                page.wait_for_timeout(900)
                check('The next customer walks in', state()['scene']['customers'][0]['state'] == 'here')
                # Customer tap in the scene selects the other order.
                region = page.evaluate("(() => { const r = document.querySelector('.kq-counter canvas').getBoundingClientRect(); return {x: r.x + r.width * .3, y: r.y + r.height * .3}; })()")
                page.touchscreen.tap(region['x'], region['y'])
                page.wait_for_timeout(120)
                check('Tapping customer B in the scene selects their order', state()['activeSlot'] == 1)
                # Stations
                for view in ['board', 'oven', 'plan']:
                    tap(f'.kq-strip [data-action="view:{view}"]')
                    page.wait_for_timeout(120)
                    page.screenshot(path=str(out / f'view-{view}.png'))
                    check(f'{view} view opens in the middle', state()['view'] == view)
                tap('.kq-strip [data-action="view:board"]')
                before = state()['kitchen']['board']['cuts']
                tap('.kq-station [data-action="board:cut"]')
                check('CHOP cuts the vegetable', state()['kitchen']['board']['cuts'] == before + 1)
                # Lasagna: layer the glass dish, then the centred prompt bakes it and takes it out.
                tap('.kq-strip [data-action="view:oven"]')
                steps = ['pasta', 'sauce', 'cheese', 'pasta', 'sauce', 'cheese']
                for food in steps:
                    tap(f'.kq-station [data-action="lasagna:add:{food}"]')
                    page.wait_for_timeout(150)
                page.wait_for_timeout(300)
                check('Six layers fill the glass dish', state()['kitchen']['lasagnaLayers'] == steps)
                prompt = page.evaluate('''(() => { const p = document.querySelector('.kq-prompt'), c = document.querySelector('.kq-counter').getBoundingClientRect(), r = p.getBoundingClientRect();
                  return {shown: !p.hidden, action: p.dataset.action, off: Math.abs(r.x + r.width / 2 - (c.x + c.width / 2)), w: r.width, h: r.height}; })()''')
                check('BAKE IT prompt appears big and centred over the counter', prompt['shown'] and prompt['action'] == 'oven' and prompt['off'] < 4 and prompt['w'] >= 200 and prompt['h'] >= 56)
                page.screenshot(path=str(out / 'lasagna-ready-to-bake.png'))
                tap('.kq-prompt')
                page.wait_for_timeout(450)
                page.screenshot(path=str(out / 'lasagna-into-oven.png'))
                s = state()
                check('Baking starts and the tray slides into the oven', s['kitchen']['oven']['phase'] == 'baking' and s['kitchen']['lasagnaLayers'] == [])
                stock = s['kitchen']['stock']['lasagna']
                wait("s.kitchen.oven.phase === 'ready'", 30000)
                page.wait_for_timeout(200)
                check('TAKE IT OUT prompt appears when the lasagna is ready', page.evaluate("!document.querySelector('.kq-prompt').hidden"))
                page.screenshot(path=str(out / 'lasagna-ready.png'))
                tap('.kq-prompt')
                check('Taking it out stocks four portions', state()['kitchen']['stock']['lasagna'] == stock + 4)
                # Pause / cookbook from the shared top row.
                tap('.kq-setbar [data-action="book"]')
                check('Cookbook pauses the kitchen', state()['paused'] and state()['dialog'] == 'book')
                page.screenshot(path=str(out / 'cookbook.png'))
                tap('dialog [data-action="book:close"]')
                check('Closing the cookbook resumes', not state()['paused'])
                tap('.kq-setbar [data-action="book"]')
                tap('dialog [data-action="tutorial"]')
                page.wait_for_timeout(250)
                check('Show me how turns on the pointing guide', state()['tutorial'] and not state()['paused'] and page.evaluate("!document.querySelector('.kq-hand').hidden"))
                page.screenshot(path=str(out / 'tutorial-hand.png'))
                tap('.kq-setbar [data-action="pause"]')
                check('Pause opens the pause dialog', state()['dialog'] == 'pause')
                tap('dialog [data-action="pause"]')
                check('Keep cooking resumes', not state()['paused'])
                # One language on screen at a time; the setbar switch flips it and it sticks per kid.
                has_cjk = "/[\u3400-\u9fff]/.test(document.querySelector('.kq').innerText)"
                tap('.kq-strip [data-action="view:plate"]')
                check('English by default: no Chinese on the kitchen screen', state()['lang'] == 'en' and not page.evaluate(has_cjk))
                page.screenshot(path=str(out / 'lang-en.png'))
                tap('.kq-setbar [data-action="lang"]')
                page.wait_for_timeout(150)
                page.screenshot(path=str(out / 'lang-zh.png'))
                check('中文 switch shows Chinese only', state()['lang'] == 'zh'
                      and page.evaluate("[...document.querySelectorAll('.kq-tray b')].every(b => /[\u3400-\u9fff]/.test(b.innerText))")
                      and not page.evaluate(r"/\b(Cheese|Patty|Tomato|Lettuce|SERVE)\b/i.test(document.querySelector('.kq').innerText)"))
                check('Language choice is saved for the kid', page.evaluate("settings.kitchen.lang.luis") == 'zh')
                tap('.kq-setbar [data-action="lang"]')
                check('English switch returns to English only', state()['lang'] == 'en' and not page.evaluate(has_cjk))
                page.close(); context.close()
            check('No page errors', not report['pageErrors'])
            check('No console errors', not report['consoleErrors'])
    except Exception:
        report['failure'] = traceback.format_exc()
        raise
    finally:
        server.shutdown()
        (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default=None, help='Chromium-family executable; default is Playwright Chromium')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--web-root', type=Path, default=ROOT / 'dist/android-web')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/kitchen-counter-ui')
    run(parser.parse_args())
