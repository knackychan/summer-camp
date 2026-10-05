"""Code Quest redesign UI harness, in a real browser.

Started by UX polish slice 07 (speech-bubble placement); slice 06 adds its layout,
q01-by-taps, language and sheet checks to this same file. Uses the recovery
harness's isolated save and server and coarse-pointer touch emulation.

  python scripts/check-codequest-ui.py [--browser PATH] [--target web]
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
SIZES = [(1280, 800), (1280, 600)]
HARD = ['.cq-goal', '.cq-vitals', '.cq-goal-pop', '.cq-debug-toggle', '.cq-debug', '.cq-zoom']


def fixture(level_ids):
    seed = RECOVERY['saved_fixture']('hub')
    saved = json.loads(seed['keyquest:v2'])
    # Every authored room cleared, so the Map can open any of them.
    saved.setdefault('settings', {})['codequest'] = {'profiles': {'luis': {'version': 12, 'completed': level_ids}}}
    seed['keyquest:v2'] = json.dumps(saved)
    return seed


# Bubble rect, scene box and every visible hard rect, all relative to the scene canvas.
BUBBLE_GEOMETRY = '''(hard) => {
  const canvas = document.querySelector('.cq-scene canvas'), box = canvas.getBoundingClientRect();
  const rel = el => { const r = el.getBoundingClientRect(); return {x:r.left-box.left, y:r.top-box.top, w:r.width, h:r.height}; };
  const bubble = document.querySelector('.cq-bubble');
  return {
    box: {w: box.width, h: box.height},
    bubble: bubble.hidden ? null : rel(bubble),
    hard: hard.map(sel => document.querySelector(sel)).filter(el => el && !el.hidden && el.getClientRects().length).map(el => ({sel: el.className, ...rel(el)}))
  };
}'''


def intersects(a, b):
    return min(a['x'] + a['w'], b['x'] + b['w']) - max(a['x'], b['x']) > 0.5 and min(a['y'] + a['h'], b['y'] + b['h']) - max(a['y'], b['y']) > 0.5


def run(args):
    directory = ROOT if args.target == 'source' else args.web_root.resolve()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    node = lambda script: json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], text=True, cwd=str(directory)))
    level_ids = node("import { LEVELS } from './js/games/codequest/levels.js'; process.stdout.write(JSON.stringify(LEVELS.map(l => l.id)))")
    brain_ids = json.loads(subprocess.check_output(['node', '-e',
        'process.stdout.write(JSON.stringify(Object.keys(require(process.argv[1]).GAMES)))',
        str(directory / 'js/brain-data.js')], text=True))
    report = {'target': args.target, 'checks': [], 'pageErrors': [], 'consoleErrors': [], 'bubbles': {}}

    def check(name, condition, detail=None):
        report['checks'].append({'name': name, 'ok': bool(condition), **({'detail': detail} if detail and not condition else {})})
        print(('PASS ' if condition else 'FAIL ') + name + ('' if condition or not detail else f'  {detail}'), flush=True)
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

                context = RECOVERY['context_for'](Touch(), seed=fixture(level_ids), offline=True)
                context.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(body='', content_type='text/css'))
                # Today's Brain Gym trio is done, so games are open.
                context.add_init_script("""(() => {
                  if (location.protocol !== 'http:' || localStorage.getItem('sq:codequestFixture')) return;
                  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'})
                    .formatToParts(new Date()).reduce((r, p) => (r[p.type] = p.value, r), {});
                  const saved = JSON.parse(localStorage.getItem('keyquest:v2'));
                  saved.progress.luis.brain = {d:`${parts.year}-${parts.month}-${parts.day}`,done:Object.fromEntries(%s.map(id => [id, {score:8,ms:20000}])),starred:true};
                  localStorage.setItem('keyquest:v2', JSON.stringify(saved));
                  localStorage.setItem('sq:codequestFixture','1');
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

                def act(action):
                    # Keyboard-style activation (click with detail 0) runs the same perform() path as a tap.
                    page.evaluate("a => { const b = document.querySelector('[data-action=\"' + a + '\"]'); b.dispatchEvent(new MouseEvent('click', {bubbles:true, detail:0})); }", action)
                    page.wait_for_timeout(40)

                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check(f'{tag}: registry opens Code Quest', page.evaluate("SQContentRegistry.open('game:codequest',{origin:'hub'})")['ok'])
                page.wait_for_selector('.cq .cq-scene canvas')
                page.wait_for_timeout(300)
                if state()['dialog']:
                    page.keyboard.press('Escape')

                # ---- Slice 08: card menu. q05's reference (×5 Move, Right, ×3 Move) built by taps only. ----
                def tap(selector):
                    target = page.locator(selector).first
                    box = target.evaluate("""el => { const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
                      return {x,y,w:r.width,h:r.height,on:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:el.contains(document.elementFromPoint(x,y))}; }""")
                    assert box['on'] and box['hit'], f'{selector} not tappable: {box}'
                    page.touchscreen.tap(box['x'], box['y'])
                    page.wait_for_timeout(80)

                def program():
                    return [(n['type'], n.get('times') or n.get('op') or n.get('test')) for n in state()['program']]

                menu_problems = []

                def audit_menu(where):
                    m = page.evaluate("""() => {
                      const menu = document.querySelector('.cq-card-menu'), run = document.querySelector('[data-action="run"]').getBoundingClientRect();
                      const r = menu.getBoundingClientRect(), btns = [...menu.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return {a: b.dataset.action, w: q.width, h: q.height, hit: b.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2))}; });
                      return {hidden: menu.hidden, r: {x: r.x, y: r.y, w: r.width, h: r.height}, run: {x: run.x, y: run.y, w: run.width, h: run.height}, btns, vw: innerWidth, vh: innerHeight};
                    }""")
                    if m['hidden']:
                        menu_problems.append(f'{where}: menu hidden')
                        return
                    r = m['r']
                    if r['x'] < 0 or r['y'] < 0 or r['x'] + r['w'] > m['vw'] + 1 or r['y'] + r['h'] > m['vh'] + 1:
                        menu_problems.append(f'{where}: menu off screen {r}')
                    if intersects(r, m['run']):
                        menu_problems.append(f'{where}: menu covers Run')
                    for b in m['btns']:
                        if b['w'] < 47.5 or b['h'] < 47.5 or not b['hit']:
                            menu_problems.append(f"{where}: {b['a']} {b['w']:.0f}x{b['h']:.0f} hit={b['hit']}")

                act('map')
                page.wait_for_selector('[data-action="level:4"]', state='attached')
                act('level:4')
                page.wait_for_function(SNAPSHOT + ".level === 'q05' && !" + SNAPSHOT + ".dialog")
                tap('.cq-library [data-action="add:move"]')
                check(f'{tag}: library tap adds a card marked to pulse', program() == [('action', 'move')]
                      and page.evaluate("!!document.querySelector('.cq-strip .just-added')"))
                tap('.cq-strip [data-action="select:0"]')
                check(f'{tag}: tapping a card opens the card menu; the pulse does not replay', state()['menuOpen'] and state()['selection'] == [0]
                      and page.evaluate("!document.querySelector('.cq-strip .just-added')"))
                audit_menu('action card')
                tap('.cq-card-menu [data-action="menu:wrap"]')
                audit_menu('wrap choices')
                page.screenshot(path=str(out / f'menu-open-{tag}.png'))
                tap('.cq-card-menu [data-action="logic:repeat2"]')
                check(f'{tag}: Wrap ▸ ×2 wraps the card in one tap', program() == [('repeat', 2)])
                tap('.cq-strip [data-action="select:0"]')
                audit_menu('repeat head')
                tap('.cq-card-menu [data-action="menu:count"]')
                tap('.cq-card-menu [data-action="menu:count"]')
                check(f'{tag}: ×N chip cycles the room counts 2 → 3 → 5', program() == [('repeat', 5)] and state()['menuOpen'])
                tap('.cq-scene canvas')
                check(f'{tag}: tapping the scene closes the menu', not state()['menuOpen'])
                tap('.cq-library [data-action="add:turnRight"]')
                tap('.cq-library [data-action="add:move"]')
                tap('.cq-strip [data-action="select:2"]')
                tap('.cq-library [data-action="logic:repeat3"]')
                check(f'{tag}: q05 reference built by taps', program() == [('repeat', 5), ('action', 'turnRight'), ('repeat', 3)])
                tap('.cq-strip [data-action="select:2"]')
                tap('.cq-card-menu [data-action="menu:unwrap"]')
                unwrapped = program()
                tap('.cq-tools [data-action="undo"]')
                check(f'{tag}: Unwrap then Undo', unwrapped == [('repeat', 5), ('action', 'turnRight'), ('action', 'move')] and program()[-1] == ('repeat', 3))
                tap('.cq-strip [data-action="select:0"]')
                tap('.cq-library [data-action="add:turnLeft"]')
                inserted = program()
                tap('.cq-tools [data-action="undo"]')
                check(f'{tag}: library tap inserts after the selected card', inserted[1] == ('action', 'turnLeft') and len(inserted) == 4 and len(program()) == 3)
                page.screenshot(path=str(out / f'menu-{tag}.png'))
                tap('.cq-runbox [data-action="run"]')
                page.wait_for_function(SNAPSHOT + ".model.phase === 'won' || " + SNAPSHOT + ".dialog === 'win'", timeout=30000)
                check(f'{tag}: q05 built with the card menu wins', True)
                check(f'{tag}: card menu on screen, clear of Run, every button ≥ 48 px and hittable', not menu_problems, menu_problems[:8])
                page.wait_for_selector('[data-action="win:continue"]', state='attached')
                act('win:continue')
                page.wait_for_function('!' + SNAPSHOT + '.dialog')

                # ---- Slice 09: zoom in, pan, Home; Run while zoomed keeps the hero on screen. q02 by taps. ----
                def camera():
                    return state()['camera']

                def zoom_buttons_ok():
                    return page.evaluate("""() => [...document.querySelectorAll('.cq-zoom button')].every(b => { const r = b.getBoundingClientRect();
                      return r.width >= 47.5 && r.height >= 47.5 && b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })""")

                act('map')
                page.wait_for_selector('[data-action="level:1"]', state='attached')
                act('level:1')
                page.wait_for_function(SNAPSHOT + ".level === 'q02' && !" + SNAPSHOT + ".dialog")
                scene = page.locator('.cq-scene canvas').bounding_box()
                cx, cy = scene['x'] + scene['width'] * 0.55, scene['y'] + scene['height'] * 0.5
                check(f'{tag}: room opens at the whole-room Home framing', camera()['zoom'] == 0 and page.locator('.cq-zoom [data-action="zoom:home"]').count() == 0)
                # Button taps first: headless Chrome 138 reports later touch clicks with detail 0 once
                # mouse / raw CDP touch input has been mixed in, which the game reads as a second press.
                tap('.cq-zoom [data-action="zoom:in"]')
                tap('.cq-zoom [data-action="zoom:in"]')
                check(f'{tag}: ＋ steps to +2 and stops there', camera()['zoom'] == 2 and page.locator('.cq-zoom [data-action="zoom:in"]').is_disabled())
                check(f'{tag}: zoom buttons ≥ 48 px and hittable (zoomed)', zoom_buttons_ok())
                tap('.cq-zoom [data-action="zoom:out"]')
                check(f'{tag}: − steps back to +1', camera()['zoom'] == 1)
                tap('.cq-zoom [data-action="zoom:home"]')
                home = camera()
                check(f'{tag}: ⌂ returns to the exact Home framing', home['zoom'] == 0 and all(v is None or v != v for v in (home['cx'], home['cy']))
                      and page.locator('.cq-zoom [data-action="zoom:home"]').count() == 0)
                page.mouse.move(cx, cy)
                page.mouse.wheel(0, -120)
                page.wait_for_timeout(120)
                check(f'{tag}: wheel zooms in one step', camera()['zoom'] == 1)
                before = camera()
                page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 3000, cy + 3000, steps=6); page.mouse.up()
                edge = camera()
                page.mouse.move(cx, cy); page.mouse.down(); page.mouse.move(cx + 600, cy + 600, steps=4); page.mouse.up()
                check(f'{tag}: drag pans while zoomed and clamps at the room edge', (edge['cx'], edge['cy']) != (before['cx'], before['cy'])
                      and abs(camera()['cx'] - edge['cx']) < 1e-6 and abs(camera()['cy'] - edge['cy']) < 1e-6)
                # Two-finger pinch out (raw CDP touch points) steps the zoom in.
                cdp = context.new_cdp_session(page)
                def touches(kind, gap):
                    cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [
                        {'x': cx - gap, 'y': cy, 'id': 1}, {'x': cx + gap, 'y': cy, 'id': 2}]})
                touches('touchStart', 40)
                for gap in (50, 60):
                    touches('touchMove', gap)
                touches('touchEnd', 0)
                page.wait_for_timeout(120)
                check(f'{tag}: pinch out zooms in one step', camera()['zoom'] == 2)
                act('zoom:out')
                page.screenshot(path=str(out / f'zoom-{tag}.png'))
                # Keyboard-style activation from here on (see the Chrome 138 note above); taps are covered by slice 08's checks.
                for op in ['move', 'move', 'move', 'turnRight', 'move', 'move', 'move']:
                    act(f'add:{op}')
                act('run')
                off_screen = []
                for _ in range(40):
                    st = state()
                    hb = st.get('heroBox')
                    if hb and (hb['x'] < -1 or hb['y'] < -1 or hb['x'] + hb['w'] > scene['width'] + 1 or hb['y'] + hb['h'] > scene['height'] + 1):
                        off_screen.append(hb)
                    if st['model']['phase'] == 'won' or st['dialog'] == 'win':
                        break
                    page.wait_for_timeout(250)
                check(f'{tag}: q02 runs and wins while zoomed', state()['model']['phase'] == 'won' or state()['dialog'] == 'win')
                check(f'{tag}: the camera keeps the hero on screen during the run', not off_screen, off_screen[:3])
                page.wait_for_selector('[data-action="win:continue"]', state='attached')
                act('win:continue')
                page.wait_for_function('!' + SNAPSHOT + '.dialog')
                check(f'{tag}: the next room starts back at Home', camera()['zoom'] == 0)

                # ---- Facing + Rune plan (2026-10-05). q10 Function Forge. ----
                def library_has(action):
                    return page.evaluate(f"!!document.querySelector('.cq-library [data-action=\"{action}\"]')")

                # Slice 02: every turn shows the beat and, in Step, the hand rule.
                act('map')
                page.wait_for_selector('[data-action="level:1"]', state='attached')
                act('level:1')
                page.wait_for_function(SNAPSHOT + ".level === 'q02' && !" + SNAPSHOT + ".dialog")
                for _ in range(4):
                    act('add:turnRight')
                facings, beats = [], []
                for i in range(4):
                    act('step')
                    s = state()
                    facings.append(s['model']['hero']['dir'])
                    beats.append(page.evaluate("(() => { const n = SQGames.get('codequest').snapshot().notice; return n && n[0]; })()"))
                    page.wait_for_timeout(420)
                    page.screenshot(path=str(out / f'facing-{tag}-{i + 1}.png'))
                check(f'{tag}: Right ×4 by Step faces S, W, N, E', facings == ['S', 'W', 'N', 'E'], facings)
                check(f'{tag}: each Step turn says the hand rule', all(b and 'right hand' in b for b in beats), beats)
                act('reset')

                q10 = level_ids.index('q10')
                act('map')
                page.wait_for_selector(f'[data-action="level:{q10}"]', state='attached')
                act(f'level:{q10}')
                page.wait_for_function(SNAPSHOT + ".level === 'q10' && !" + SNAPSHOT + ".dialog")
                # Slice 01: Rune can't call itself.
                check(f'{tag}: q10 library offers the Rune card on Main', library_has('logic:callRune'))
                act('strip:rune')
                act('add:move')
                check(f'{tag}: editing Rune hides the Rune card', state()['editor'] == 'rune' and not library_has('logic:callRune'))
                rune_before = state()['runeProgram']
                page.evaluate("""() => { const b = document.createElement('button'); b.dataset.action = 'logic:callRune'; b.hidden = true;
                  document.querySelector('.cq-library').appendChild(b); b.dispatchEvent(new MouseEvent('click', {bubbles:true, detail:0})); }""")
                page.wait_for_timeout(60)
                check(f'{tag}: a Rune call can never land inside Rune', state()['runeProgram'] == rune_before)
                act('strip:main')
                check(f'{tag}: back on Main the Rune card returns', state()['editor'] == 'main' and library_has('logic:callRune'))
                # Slice 03: the strip follows a running Rune and lights exactly the running card.
                act('strip:rune')
                act('add:move')
                act('strip:main')
                for a_id in ('logic:callRune', 'add:turnRight', 'logic:callRune'):
                    act(a_id)
                check(f'{tag}: q10 program built (Rune = Move ×2; Main = Rune, Right, Rune)',
                      [n['type'] for n in state()['program']] == ['call', 'action', 'call'] and len(state()['runeProgram']) == 2)
                act('strip:rune')
                trail = []
                for _ in range(3):
                    act('step')
                    trail.append((state()['editor'], page.evaluate("document.querySelectorAll('.cq-strip .executing').length")))
                page.screenshot(path=str(out / f'rune-step-{tag}.png'))
                check(f'{tag}: stepping shows Rune while it runs, then Main, one lit card each time',
                      trail == [('rune', 1), ('rune', 1), ('main', 1)], trail)
                act('reset')
                check(f'{tag}: reset hands the strip back to the tab being edited before Step', state()['editor'] == 'rune')
                act('strip:main')
                page.screenshot(path=str(out / f'rune-call-cards-{tag}.png'))
                check(f'{tag}: a Rune call card shows the cards inside the Rune', page.evaluate(
                    "[...document.querySelectorAll('.cq-strip .cq-bracket.cat-func')].map(b => b.querySelectorAll('.cq-bracket-body .cq-mini').length).join()") == '2,2')
                act('run')
                page.wait_for_function(SNAPSHOT + ".model.phase === 'won' || " + SNAPSHOT + ".dialog === 'win'", timeout=30000)
                check(f'{tag}: q10 wins with the Rune program and the strip is back on Main', state()['editor'] == 'main')
                page.wait_for_selector('[data-action="win:continue"]', state='attached')
                act('win:continue')
                page.wait_for_function('!' + SNAPSHOT + '.dialog')

                problems, sides = [], {}

                def assert_bubble(where):
                    page.wait_for_timeout(120)
                    g = page.evaluate(BUBBLE_GEOMETRY, HARD)
                    s = state()
                    b, hero = g['bubble'], s.get('heroBox')
                    if not b:
                        problems.append(f'{where}: bubble hidden')
                        return
                    sides[s.get('bubbleSide')] = sides.get(s.get('bubbleSide'), 0) + 1
                    if b['x'] < -0.5 or b['y'] < -0.5 or b['x'] + b['w'] > g['box']['w'] + 0.5 or b['y'] + b['h'] > g['box']['h'] + 0.5:
                        problems.append(f'{where}: outside the scene {b}')
                    for r in g['hard']:
                        if intersects(b, r):
                            problems.append(f"{where}: covers {r['sel']}")
                    if hero and s.get('bubbleSide') != 'caption' and intersects(b, hero):
                        problems.append(f'{where}: covers the hero')

                for index, level_id in enumerate(level_ids):
                    act('map')
                    page.wait_for_selector(f'[data-action="level:{index}"]', state='attached')
                    act(f'level:{index}')
                    page.wait_for_function(SNAPSHOT + f".level === '{level_id}' && !" + SNAPSHOT + ".dialog")
                    assert_bubble(f'{level_id} start')
                    # Goal popover open (+ debug panel where the room has one), then a notice.
                    act('goal')
                    if page.evaluate("!document.querySelector('[data-action=\"debug\"]').hidden"):
                        act('debug')
                    act('reset')
                    assert_bubble(f'{level_id} goal+debug open')
                    if index in (0, len(level_ids) - 1):
                        page.screenshot(path=str(out / f'bubble-{tag}-{level_id}.png'))
                    act('goal')
                report['bubbles'][tag] = sides
                check(f'{tag}: bubble inside the scene, clear of HUD / debug / hero in all {len(level_ids)} rooms', not problems, problems[:8])
                page.close(); context.close()
            check('No page errors', not report['pageErrors'], report['pageErrors'][:3])
            check('No console errors', not report['consoleErrors'], report['consoleErrors'][:3])
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
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/codequest-ui')
    run(parser.parse_args())
