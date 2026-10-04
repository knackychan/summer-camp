"""Code Quest Laboratory of Curiosity UI harness, in a real browser (lab slice 07).

Touch emulation (coarse pointer) at 1280x800 and 1280x600, the recovery harness's
isolated save and server, the network cut after load for the brewing checks.
Drives the Lab the way a kid does: drag and tap on the canvas hit rects, dock
buttons, the host bar and host Back. Screenshots + report.json land in --out.

  python scripts/check-codequest-lab-ui.py [--browser PATH] [--target web]
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
SNAPSHOT = "SQGames.get('codequest').snapshot()"
SIZES = [(1280, 800), (1280, 600), (1024, 600), (1366, 768)]


def fixture(completed):
    seed = RECOVERY['saved_fixture']('hub')
    saved = json.loads(seed['keyquest:v2'])
    # Early quests only: the bag is empty (D5 must brew anyway) and the potion scroll is locked.
    saved.setdefault('settings', {})['codequest'] = {'profiles': {'luis': {'version': 12, 'completed': completed}}}
    seed['keyquest:v2'] = json.dumps(saved)
    return seed


def overlaps(a, b):
    return min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x']) > 0.5 and min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y']) > 0.5


def run(args):
    directory = ROOT if args.target == 'source' else args.web_root.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    level_ids = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        "import { LEVELS } from './js/games/codequest/levels.js'; process.stdout.write(JSON.stringify(LEVELS.map(l => l.id)))"], text=True, cwd=str(directory)))
    brain_ids = json.loads(subprocess.check_output(['node', '-e',
        'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).GAMES)))', str(directory / 'js/brain-data.js')], text=True))
    report = {'target': args.target, 'checks': [], 'pageErrors': [], 'consoleErrors': []}

    def check(name, condition, detail=None):
        report['checks'].append({'name': name, 'ok': bool(condition), **({'detail': detail} if detail is not None and not condition else {})})
        print(('PASS ' if condition else 'FAIL ') + name + ('' if condition or detail is None else f'  {detail}'), flush=True)
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

                context = RECOVERY['context_for'](Touch(), seed=fixture(level_ids[:4]), offline=True)
                context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
                # Today's Brain Gym trio is done, so games are open.
                context.add_init_script("""(() => {
                  if (location.protocol !== 'http:' || localStorage.getItem('sq:labFixture')) return;
                  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
                    .formatToParts(new Date()).reduce((r, p) => (r[p.type] = p.value, r), {});
                  const saved = JSON.parse(localStorage.getItem('keyquest:v2'));
                  saved.progress.luis.brain = {d:`${parts.year}-${parts.month}-${parts.day}`,done:Object.fromEntries(%s.map(id => [id, {score:8,ms:20000}])),starred:true};
                  localStorage.setItem('keyquest:v2', JSON.stringify(saved));
                  localStorage.setItem('sq:labFixture','1');
                })();""" % json.dumps(brain_ids))
                page = context.new_page()
                page.set_default_timeout(15000)
                page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))

                def console(message):
                    if message.type == 'error':
                        url = message.location.get('url', '')
                        if not ('net::ERR_' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1')):
                            report['consoleErrors'].append({'message': message.text, 'url': url})
                page.on('console', console)

                def state():
                    return page.evaluate(SNAPSHOT)

                def lab():
                    return state()['lab']

                def tap_el(selector):
                    # A host toast (e.g. "Achievement unlocked") can sit over the bar for a moment; a kid would wait too.
                    page.wait_for_function("![...document.querySelectorAll('.sqtoast')].some(t => t.getClientRects().length)", timeout=20000)
                    # Coordinate taps: a pointerdown that opens a dialog makes Playwright's own actionability retry.
                    box = page.locator(selector).first.bounding_box()
                    page.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
                    page.wait_for_timeout(120)

                def centre(hit_id):
                    origin = page.evaluate("(() => { const r = document.querySelector('.cq-lab canvas').getBoundingClientRect(); return {x:r.x,y:r.y}; })()")
                    hit = next(h for h in lab()['hits'] if h['id'] == hit_id)
                    return origin['x'] + hit['x'] + hit['w'] / 2, origin['y'] + hit['y'] + hit['h'] / 2

                def tap(hit_id):
                    x, y = centre(hit_id)
                    page.touchscreen.tap(x, y)
                    page.wait_for_timeout(60)

                def drag(hit_id):
                    (x0, y0), (x1, y1) = centre(hit_id), centre('cauldron')
                    page.mouse.move(x0, y0); page.mouse.down()
                    page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=6); page.mouse.move(x1, y1, steps=6); page.mouse.up()
                    page.wait_for_timeout(60)

                def dock(selector):
                    tap_el('.cq-lab ' + selector)

                def clear():
                    if lab()['mix'] or lab()['steps'] or lab()['effect']:
                        dock('[data-lab="clear"]')

                def brew_ids(ids, steps=()):
                    clear()
                    for hit_id in ids:
                        tap(hit_id); tap('cauldron')
                    for step in steps:
                        tap('prop:' + step)
                    dock('.cq-lab-brew')
                    return lab()

                bubble_problems = []

                def audit_bubble(where):
                    geo = page.evaluate("""() => {
                      const scene = document.querySelector('.cq-lab-scene').getBoundingClientRect(), b = document.querySelector('.cq-lab-bubble');
                      const dock = document.querySelector('.cq-lab-dock').getBoundingClientRect(), r = b.getBoundingClientRect();
                      return {hidden: b.hidden, bubble: {x: r.x - scene.x, y: r.y - scene.y, w: r.width, h: r.height},
                        dock: {x: dock.x - scene.x, y: dock.y - scene.y, w: dock.width, h: dock.height}};
                    }""")
                    if geo['hidden']:
                        return
                    cauldron = next(h for h in lab()['hits'] if h['id'] == 'cauldron')
                    for name, rect in (('cauldron', cauldron), ('strip', geo['dock'])):
                        if overlaps(geo['bubble'], rect):
                            bubble_problems.append(f'{where}: bubble covers the {name}')

                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check(f'{tag}: registry opens Code Quest', page.evaluate("SQContentRegistry.open('game:codequest',{origin:'hub'})")['ok'])
                page.wait_for_selector('.cq .cq-scene canvas')
                page.wait_for_timeout(300)
                if state()['dialog']:
                    page.keyboard.press('Escape')
                page.evaluate("document.querySelector('.cq-library [data-action=\"add:move\"]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}))")
                before = state()
                healing0, bag0 = before['profile']['potions']['healing'], before['profile']['ingredients']

                # 1. Lab button → Lab mounted, dungeon paused.
                tap_el('[data-action="lab"]')
                page.wait_for_function(SNAPSHOT + '.lab.open && ' + SNAPSHOT + '.lab.hits.length > 0')
                check(f'{tag}: 1 Lab opens over a hidden dungeon', page.evaluate("document.querySelector('.cq-play').hidden && !!document.querySelector('.cq-lab canvas')"))
                page.screenshot(path=str(out / f'harness-open-{tag}.png'))

                # 8. Tablet-sized, separate targets; no page scroll.
                hits = lab()['hits']
                small = [h['id'] for h in hits if min(h['w'], h['h']) < 48]
                buttons = page.evaluate("[...document.querySelectorAll('.cq-lab button, .cq-setbar button')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return [b.dataset.lab || b.dataset.action, r.width, r.height]; }).filter(([, w, h]) => w < 47.5 || h < 47.5)")
                check(f'{tag}: 8 every hit rect and button >= 48 CSS px', not small and not buttons, (small, buttons))
                check(f'{tag}: 8 no page scroll', page.evaluate('document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1'))

                # 9. Network blocked after load: the brewing checks below run offline.
                context.set_offline(True)

                # 2. Drag Echo Crystal + Red Mushroom → duplication, Journal tag.
                drag('jar:echoCrystal'); drag('jar:redMushroom')
                check(f'{tag}: 2 drag puts two jars in the cauldron', lab()['mix'] == ['echoCrystal', 'redMushroom'], lab()['mix'])
                dock('.cq-lab-brew')
                now = lab()
                check(f'{tag}: 2 Echo + Mushroom → duplication', (now['lastResult'] or {}).get('ruleId') == 'duplication', now['lastResult'])
                check(f'{tag}: 2 "New page!" on the Journal', now['newPage'] and page.evaluate("!document.querySelector('.cq-lab-tag').hidden"))
                audit_bubble('duplication')
                page.wait_for_timeout(700)
                page.screenshot(path=str(out / f'harness-duplication-{tag}.png'))

                # 3. Tap-tap Sun Herb ×2 + Water Crystal, mortar, spoon → Healing +1, bag unchanged.
                now = brew_ids(['bag:sunHerb', 'bag:sunHerb', 'bag:waterCrystal'], ['grind', 'stir'])
                profile = state()['profile']
                check(f'{tag}: 3 Healing recipe in order → Healing +1', profile['potions']['healing'] == healing0 + 1 and (now['lastResult'] or {}).get('kind') == 'potion', (profile['potions'], now['lastResult']))
                check(f'{tag}: 3 bag counts unchanged (D5)', profile['ingredients'] == bag0, profile['ingredients'])
                audit_bubble('healing')

                # 4. Same mix, steps reversed → reaction + order hint, no potion.
                now = brew_ids(['bag:sunHerb', 'bag:sunHerb', 'bag:waterCrystal'], ['stir', 'grind'])
                check(f'{tag}: 4 reversed steps → reaction + order hint, no potion',
                      now['lastResult']['kind'] == 'reaction' and now['lastResult'].get('hint') == 'order' and state()['profile']['potions']['healing'] == healing0 + 1, now['lastResult'])
                audit_bubble('order hint')
                context.set_offline(False)

                # 5. A fifth ingredient → owl line, mix still 4.
                while len(lab()['mix']) < 4:
                    tap('jar:moonflower'); tap('cauldron')
                tap('jar:starDust'); tap('cauldron')
                check(f'{tag}: 5 fifth ingredient → owl says full, mix stays 4', len(lab()['mix']) == 4 and lab()['line'][0].startswith('The cauldron is full'), lab())
                audit_bubble('full')

                # 6. Journal opens with the found pages, closes.
                found = len(state()['profile']['lab']['found'])
                tap('book'); page.wait_for_timeout(150)
                pages = page.locator('.cq-lab-journal .cq-lab-card:not(.unknown)').count()
                unknown = page.locator('.cq-lab-journal .cq-lab-card.unknown').count()
                check(f'{tag}: 6 Journal shows the found pages', lab()['journal'] == 'reactions' and pages == found and pages + unknown == 18 and not lab()['newPage'], (pages, unknown, found))
                page.screenshot(path=str(out / f'harness-journal-{tag}.png'))
                dock('[data-lab="journal:close"]')
                check(f'{tag}: 6 Journal closes', lab()['journal'] is None and page.evaluate("document.querySelector('.cq-lab-journal').hidden"))
                check(f'{tag}: 8 bubble never covers the cauldron or the strip', not bubble_problems, bubble_problems)

                # S. Ingredient states (docs/plans/2026-10-04-lab-states): lift → tool → cauldron, by taps and by drag.
                clear()
                tap('jar:redMushroom'); tap('prop:cool')
                check(f'{tag}: S lift + frost plate → frozen, still in hand', lab()['held'] == 'redMushroom:frozen' and lab()['selection'] == 'jar:redMushroom' and lab()['steps'] == [], lab()['held'])
                tap('cauldron'); tap('jar:echoCrystal'); tap('cauldron')
                dock('.cq-lab-brew')
                check(f'{tag}: S Frozen Mushroom + Echo Crystal → Snowflake Copies', (lab()['lastResult'] or {}).get('ruleId') == 'snowflakeCopies', lab()['lastResult'])
                now = brew_ids(['jar:redMushroom', 'jar:echoCrystal'])
                check(f'{tag}: S the fresh pair is still Duplication', (now['lastResult'] or {}).get('ruleId') == 'duplication', now['lastResult'])
                clear()
                (x0, y0), (x1, y1) = centre('jar:moonflower'), centre('prop:grind')
                page.mouse.move(x0, y0); page.mouse.down()
                page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=6); page.mouse.move(x1, y1, steps=6); page.mouse.up()
                page.wait_for_timeout(60)
                check(f'{tag}: S drag onto the mortar → crushed, still in hand', lab()['held'] == 'moonflower:crushed', lab()['held'])
                drag('jar:moonflower')
                dock('.cq-lab-brew')
                check(f'{tag}: S crushed Moonflower dragged in → Glitter Storm', lab()['mix'] == ['moonflower:crushed'] and (lab()['lastResult'] or {}).get('ruleId') == 'glitterStorm', lab())
                clear()
                tap('bag:sunHerb'); tap('prop:grind'); tap('cauldron')
                for hit_id in ['bag:sunHerb', 'bag:waterCrystal']:
                    tap(hit_id); tap('cauldron')
                tap('prop:grind'); tap('prop:stir')
                healing = state()['profile']['potions']['healing']
                dock('.cq-lab-brew')
                check(f'{tag}: S a crushed Sun Herb in Healing → fresh hint, no potion',
                      (lab()['lastResult'] or {}).get('hint') == 'fresh' and state()['profile']['potions']['healing'] == healing, lab()['lastResult'])
                tap('book'); page.wait_for_timeout(150)
                dock('[data-lab="journal:tab:ingredients"]')
                forms = page.locator('.cq-lab-journal .cq-lab-form').count()
                check(f'{tag}: S Journal shows the brewed forms', forms == len(state()['profile']['lab']['states']) >= 3, (forms, state()['profile']['lab']['states']))
                page.screenshot(path=str(out / f'harness-forms-{tag}.png'))
                dock('[data-lab="journal:close"]')
                check(f'{tag}: 8 bubble never covers the cauldron or the strip (states)', not bubble_problems, bubble_problems)

                # 7. Back → same room, program unchanged; Camp has the Lab button and no bench.
                assert page.evaluate('SQPlatform.triggerBack()') is True
                page.wait_for_timeout(150)
                after = state()
                check(f'{tag}: 7 host Back returns to the dungeon, not out of Code Quest',
                      not after['lab']['open'] and page.evaluate("!document.getElementById('game').classList.contains('hidden') && !document.querySelector('.cq-play').hidden"))
                check(f'{tag}: 7 same room, program unchanged', after['level'] == before['level'] and after['program'] == before['program'], (after['level'], after['program']))
                tap_el('[data-action="camp"]')
                check(f'{tag}: 7 Camp has the Lab button and no bench',
                      page.evaluate("!!document.querySelector('.cq-dialog [data-action=\"lab\"]') && !document.querySelector('.cq-dialog .cq-bench, .cq-dialog .cq-cauldron, .cq-dialog .cq-potion-code')"))
                tap_el('.cq-dialog [data-action="lab"]')
                check(f'{tag}: 7 Camp opens the Lab', lab()['open'] and not state()['dialog'])
                tap_el('[data-action="lab:exit"]')
                check(f'{tag}: 7 ‹ Dungeon closes the Lab', not lab()['open'])
                page.close(); context.close()
            check('No page errors', not report['pageErrors'], report['pageErrors'][:3])
            check('No console errors', not report['consoleErrors'], report['consoleErrors'][:3])
            browser.close()
    except Exception:
        report['failure'] = traceback.format_exc()
        raise
    finally:
        server.shutdown()
        report['ok'] = bool(report['checks']) and all(c['ok'] for c in report['checks']) and 'failure' not in report
        (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default=None, help='Chromium-family executable; default is Playwright Chromium')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--web-root', type=Path, default=ROOT / 'dist/android-web')
    parser.add_argument('--out', type=Path, default=ROOT / 'test-results/codequest-lab')
    run(parser.parse_args())
