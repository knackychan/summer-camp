"""Code Quest redesign UI harness, in a real browser.

Started by UX polish slice 07 (speech-bubble placement); slice 06 adds its layout,
q01-by-taps, language and sheet checks to this same file. The simple-cards plan
(2026-10-05) replaces the Wrap and Main/Rune-tab checks with stickers, the picker
column and the two program rows. Uses the recovery harness's isolated save and
server and coarse-pointer touch emulation.

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
    # Reference solutions by room id ('q11:rune' for a room's Rune), to compare tapped programs with.
    refs = node("import { LEVELS } from './js/games/codequest/levels.js'; const o = {}; for (const l of LEVELS) { o[l.id] = l.reference.main; "
                "for (const [k, v] of Object.entries(l.reference.functions || {})) o[l.id + ':' + k] = v; } process.stdout.write(JSON.stringify(o))")
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
                # Launch opens the quest card for the first uncleared quest (quest-clarity D2).
                check(f'{tag}: launch opens the quest card', state()['dialog'] == 'brief', state()['dialog'])
                act('brief:start')

                # ---- Simple cards (2026-10-05). Taps only: stickers, slim card menu, picker column. ----
                def tap(selector):
                    target = page.locator(selector).first
                    target.evaluate("el => el.scrollIntoView({block: 'nearest', inline: 'nearest'})")
                    box = target.evaluate("""el => { const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
                      return {x,y,w:r.width,h:r.height,on:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:el.contains(document.elementFromPoint(x,y))}; }""")
                    assert box['on'] and box['hit'], f'{selector} not tappable: {box}'
                    page.touchscreen.tap(box['x'], box['y'])
                    page.wait_for_timeout(80)

                def bare(value):
                    if isinstance(value, dict):
                        return {k: bare(v) for k, v in value.items() if k != 'uid'}
                    if isinstance(value, list):
                        return [bare(v) for v in value]
                    return value

                def program(key='program'):
                    return [(n['type'], n.get('times') or n.get('op') or n.get('test') or n.get('name')) for n in state()[key]]

                def enter_level(level_id):
                    # Entering from the Map opens the quest card (quest-clarity D2).
                    act('map')
                    page.wait_for_selector(f'[data-action="level:{level_ids.index(level_id)}"]', state='attached')
                    act(f'level:{level_ids.index(level_id)}')
                    page.wait_for_function(SNAPSHOT + f".level === '{level_id}' && " + SNAPSHOT + ".dialog === 'brief'")

                def open_level(level_id):
                    enter_level(level_id)
                    act('brief:start')
                    page.wait_for_function('!' + SNAPSHOT + '.dialog')

                def win(where):
                    page.wait_for_function(SNAPSHOT + ".model.phase === 'won' || " + SNAPSHOT + ".dialog === 'win'", timeout=30000)
                    check(f'{tag}: {where} wins', True)
                    page.wait_for_selector('[data-action="win:continue"]', state='attached')
                    act('win:continue')
                    page.wait_for_function(SNAPSHOT + ".dialog === 'brief' || " + SNAPSHOT + ".dialog === 'map'")
                    act('brief:start')
                    page.wait_for_function('!' + SNAPSHOT + '.dialog')

                def notice():
                    n = state()['notice']
                    return n and n[0]

                menu_problems, picker_problems = [], []

                def audit_menu(where):
                    m = page.evaluate("""() => {
                      const menu = document.querySelector('.cq-card-menu'), picker = document.querySelector('.cq-picker').getBoundingClientRect();
                      const r = menu.getBoundingClientRect(), btns = [...menu.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return {a: b.dataset.action, w: q.width, h: q.height, hit: b.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2))}; });
                      return {hidden: menu.hidden, r: {x: r.x, y: r.y, w: r.width, h: r.height}, picker: {x: picker.x, y: picker.y, w: picker.width, h: picker.height}, btns, vw: innerWidth, vh: innerHeight};
                    }""")
                    if m['hidden']:
                        menu_problems.append(f'{where}: menu hidden')
                        return []
                    r = m['r']
                    if r['x'] < 0 or r['y'] < 0 or r['x'] + r['w'] > m['vw'] + 1 or r['y'] + r['h'] > m['vh'] + 1:
                        menu_problems.append(f'{where}: menu off screen {r}')
                    if intersects(r, m['picker']):
                        menu_problems.append(f'{where}: menu covers the picker')
                    for b in m['btns']:
                        if b['w'] < 47.5 or b['h'] < 47.5 or not b['hit']:
                            menu_problems.append(f"{where}: {b['a']} {b['w']:.0f}x{b['h']:.0f} hit={b['hit']}")
                    return [b['a'] for b in m['btns']]

                def cards_readable():
                    # Every card's name and sticker tags fit inside the card (nothing squeezed or cut off).
                    return page.evaluate("""() => [...document.querySelectorAll('.cq-strip .cq-card')].filter(card => {
                      const c = card.getBoundingClientRect(), name = card.querySelector(':scope > b'), tags = card.querySelector('.cq-stickers');
                      const n = name.getBoundingClientRect(), t = tags ? tags.getBoundingClientRect() : n;
                      return name.clientHeight < 10 || n.top < c.top || t.bottom > c.bottom - 2 || n.bottom > t.top + (tags ? 1 : 0) + (tags ? 0 : 99);
                    }).map(card => card.getAttribute('aria-label'))""")

                def audit_picker(where):
                    # Every picker button (pin, tabs, every list card scrolled into view, Run / Step / Reset) ≥ 48 px and hittable.
                    bad = page.evaluate("""() => {
                      const out = [], list = document.querySelector('.cq-library');
                      for (const b of document.querySelectorAll('.cq-picker button')) {
                        if (list.contains(b)) b.scrollIntoView({block: 'nearest'});
                        const q = b.getBoundingClientRect(), x = q.x + q.width / 2, y = q.y + q.height / 2;
                        const ok = q.width >= 47.5 && q.height >= 47.5 && q.x >= 0 && q.bottom <= innerHeight + 1 && q.right <= innerWidth + 1 && b.contains(document.elementFromPoint(x, y));
                        if (!ok) out.push(b.dataset.action + ' ' + Math.round(q.width) + 'x' + Math.round(q.height) + ' @' + Math.round(q.x) + ',' + Math.round(q.y));
                      }
                      list.scrollTop = 0;
                      const page = document.scrollingElement;
                      if (page.scrollHeight > innerHeight + 1 || page.scrollWidth > innerWidth + 1) out.push('page scrolls ' + page.scrollWidth + 'x' + page.scrollHeight);
                      const scene = document.querySelector('.cq-scene canvas').getBoundingClientRect(), picker = document.querySelector('.cq-picker').getBoundingClientRect();
                      if (scene.right > picker.left + 0.5) out.push('picker covers the scene');
                      return out;
                    }""")
                    picker_problems.extend(f'{where}: {b}' for b in bad)

                # Slice 02: q05 — Move, ×5 sticker, Right, Move, ×3 sticker.
                open_level('q05')
                audit_picker('q05')
                check(f'{tag}: q05 picker is one list (6 cards + stickers), no tabs', page.evaluate("document.querySelector('.cq-picker-tabs').hidden"))
                tap('.cq-library [data-action="add:move"]')
                check(f'{tag}: library tap adds a card marked to pulse', program() == [('action', 'move')]
                      and page.evaluate("!!document.querySelector('.cq-strip .just-added')"))
                tap('.cq-strip [data-action="select:main:0"]')
                check(f'{tag}: tapping a card selects that one card and opens the menu', state()['menuOpen'] and state()['selection'] == [0])
                check(f'{tag}: a plain card menu is ◀ ▶ 🗑', audit_menu('plain card') == ['nudge:-1', 'nudge:1', 'delete'])
                tap('.cq-scene canvas')
                check(f'{tag}: tapping the scene closes the menu', not state()['menuOpen'])
                tap('.cq-library [data-action="sticker:repeat:5"]')
                check(f'{tag}: ×5 sticker goes on the last card', program() == [('repeat', 5)])
                check(f'{tag}: the sticker shows its words on the card', page.evaluate(
                    "document.querySelector('.cq-strip [data-action=\"select:main:0\"] .cq-sticker.cat-loop').textContent") == '5 times')
                tap('.cq-library [data-action="add:turnRight"]')
                tap('.cq-library [data-action="add:move"]')
                tap('.cq-library [data-action="sticker:repeat:3"]')
                check(f'{tag}: q05 program equals the reference shape', bare(state()['program']) == refs['q05'])
                page.screenshot(path=str(out / f'stickers-q05-{tag}.png'))
                tap('.cq-strip [data-action="select:main:0"]')
                check(f'{tag}: a sticker card menu is ◀ ▶ (stickers off) 🗑', audit_menu('sticker card') == ['nudge:-1', 'nudge:1', 'menu:unstick', 'delete'])
                tap('.cq-card-menu [data-action="menu:unstick"]')
                unstuck = program()
                tap('.cq-tools [data-action="undo"]')
                check(f'{tag}: Take stickers off, then Undo', unstuck[0] == ('action', 'move') and program()[0] == ('repeat', 5))
                tap('.cq-strip [data-action="select:main:0"]')
                tap('.cq-library [data-action="add:turnLeft"]')
                inserted = program()
                tap('.cq-tools [data-action="undo"]')
                check(f'{tag}: library tap inserts after the selected card', inserted[1] == ('action', 'turnLeft') and len(inserted) == 4 and len(program()) == 3)
                check(f'{tag}: no Wrap, count or test control anywhere', page.evaluate(
                    "!document.querySelector('[data-action=\"menu:wrap\"],[data-action=\"menu:unwrap\"],[data-action=\"menu:count\"],[data-action^=\"menu:test\"],[data-action^=\"logic:repeat\"],[data-action^=\"logic:if\"]')"))
                tap('.cq-runbox [data-action="run"]')
                win('q05 built with stickers')

                # q16 — tabs: Fight ▸ Heavy, Stickers ▸ if armored, ×2 → R2[IF enemyArmoredAhead[heavyAttack]], then the rest.
                open_level('q16')
                check(f'{tag}: q16 picker has tabs and opens on Walk', not page.evaluate("document.querySelector('.cq-picker-tabs').hidden") and state()['pickerTab'] == 'walk')
                for sel in ['picker:fight', 'add:heavyAttack', 'picker:stickers', 'sticker:if:enemyArmoredAhead', 'sticker:repeat:2']:
                    tap(f'.cq-picker [data-action="{sel}"]')
                check(f'{tag}: q16 Heavy + if armored + ×2 is one card R2[IF enemyArmoredAhead[heavyAttack]]',
                      bare(state()['program']) == refs['q16'][:1], state()['program'])
                check(f'{tag}: one card carries both stickers', page.evaluate("document.querySelectorAll('.cq-strip [data-action=\"select:main:0\"] .cq-sticker').length") == 2)
                check(f'{tag}: the card name and both tags are fully visible', not cards_readable(), cards_readable())
                page.screenshot(path=str(out / f'stickers-q16-{tag}.png'))
                for sel in ['picker:walk', 'add:move', 'picker:stickers', 'sticker:repeat:2', 'picker:walk', 'add:turnRight', 'add:move', 'picker:stickers', 'sticker:repeat:2']:
                    tap(f'.cq-picker [data-action="{sel}"]')
                check(f'{tag}: q16 program equals the reference shape', bare(state()['program']) == refs['q16'])
                audit_picker('q16')
                tap('.cq-runbox [data-action="run"]')
                win('q16 built through tabs')

                # q07 — a sticker on an empty row says so and changes nothing.
                open_level('q07')
                tap('.cq-library [data-action="sticker:repeat:3"]')
                check(f'{tag}: ×3 on an empty row says "card first" and changes nothing', state()['program'] == [] and notice() == 'Put a card first, then its sticker.')
                check(f'{tag}: card menu on screen, clear of the picker, every button ≥ 48 px and hittable', not menu_problems, menu_problems[:8])

                # ---- Slice 09: zoom in, pan, Home; Run while zoomed keeps the hero on screen. q02 by taps. ----
                def camera():
                    return state()['camera']

                def zoom_buttons_ok():
                    return page.evaluate("""() => [...document.querySelectorAll('.cq-zoom button')].every(b => { const r = b.getBoundingClientRect();
                      return r.width >= 47.5 && r.height >= 47.5 && b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })""")

                open_level('q02')
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
                page.wait_for_function(SNAPSHOT + ".dialog === 'brief'")
                act('brief:start')
                page.wait_for_function('!' + SNAPSHOT + '.dialog')
                check(f'{tag}: the next room starts back at Home', camera()['zoom'] == 0)

                # ---- Facing + Rune plan (2026-10-05). ----
                # Slice 02: every turn shows the beat and, in Step, the hand rule.
                open_level('q02')
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
                check(f'{tag}: a room without the Rune shows no coach', page.evaluate("document.querySelector('.cq-coach').hidden"))
                act('reset')

                # ---- Simple cards slice 03: the picker column. ----
                open_level('q01')
                check(f'{tag}: q01 (3 cards) shows no tabs and every card', page.evaluate("""() => document.querySelector('.cq-picker-tabs').hidden
                  && ['add:move', 'add:turnLeft', 'add:turnRight'].filter(a => document.querySelector('.cq-library [data-action=\"' + a + '\"]')).length === 3"""))
                audit_picker('q01')
                page.screenshot(path=str(out / f'picker-q01-{tag}.png'))
                open_level('q15')
                tabs = page.evaluate("[...document.querySelectorAll('.cq-picker-tabs button')].map(b => b.dataset.action)")
                check(f'{tag}: q15 (64 offered) shows tabs for its groups', tabs[0] == 'picker:walk' and 'picker:fight' in tabs and tabs[-1] == 'picker:stickers', tabs)
                tap('.cq-picker [data-action="picker:fight"]')
                fight = page.evaluate("[...document.querySelectorAll('.cq-library button')].map(b => b.classList.contains('cat-attack'))")
                check(f'{tag}: Fight tab shows only attack cards', fight and all(fight), fight)
                tap('.cq-picker [data-action="picker:stickers"]')
                stickers = page.evaluate("[...document.querySelectorAll('.cq-library button')].map(b => b.dataset.action)")
                check(f'{tag}: Stickers tab shows only stickers', stickers and all(a.startswith('sticker:') for a in stickers), stickers[:4])
                check(f'{tag}: the picker list scrolls inside itself', page.evaluate("(() => { const l = document.querySelector('.cq-library'); return l.scrollHeight > l.clientHeight && getComputedStyle(l).overflowY === 'auto'; })()"))
                audit_picker('q15 stickers')
                page.screenshot(path=str(out / f'picker-q15-{tag}.png'))
                open_level('q01')
                open_level('q15')
                check(f'{tag}: the open tab is remembered per room', state()['pickerTab'] == 'stickers')
                for name in ['fight', 'use', 'care', 'walk']:
                    if f'picker:{name}' in tabs:
                        tap(f'.cq-picker [data-action="picker:{name}"]')
                        audit_picker(f'q15 {name}')
                check(f'{tag}: picker buttons ≥ 48 px, on screen, hittable; no page scroll; scene clear of the column', not picker_problems, picker_problems[:8])

                # ---- Quest clarity slice 02: the quest card at entry. ----
                def brief():
                    return page.evaluate("""() => { const d = document.querySelector('.cq-dialog'), b = d.querySelector('[data-action="brief:start"]');
                      if (!d.open || !b) return null; const q = b.getBoundingClientRect(), r = d.getBoundingClientRect();
                      return {text: d.innerText, chips: [...d.querySelectorAll('.cq-skill')].map(c => c.innerText.trim()), pips: d.querySelector('.cq-pips').innerText,
                        checks: d.querySelectorAll('.cq-checks li').length, scroll: d.scrollHeight - d.clientHeight, inside: r.top >= 0 && r.bottom <= innerHeight + 1,
                        w: q.width, h: q.height, hit: b.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)),
                        page: document.scrollingElement.scrollHeight - innerHeight}; }""")

                enter_level('q12')
                b = brief()
                page.screenshot(path=str(out / f'brief-q12-{tag}.png'))
                check(f'{tag}: q12 quest card names Rune + Repeat, Hard, the win checks and the gentle hint',
                      b and [c.split()[-1] for c in b['chips']] == ['Rune', 'Repeat'] and 'Hard' in b['pips'] and b['checks'] == 3
                      and 'one hit' in b['text'] and 'This quest needs' in b['text'], b)
                check(f'{tag}: the Rune coach waits behind the quest card', page.evaluate("document.querySelector('.cq-coach').hidden"))
                check(f'{tag}: quest card fits without scrolling; Start ≥ 48 px and hittable',
                      b['scroll'] <= 1 and b['inside'] and b['page'] <= 1 and b['w'] >= 47.5 and b['h'] >= 47.5 and b['hit'], b)
                tap('.cq-dialog [data-action="brief:start"]')
                check(f'{tag}: Start closes the quest card', not state()['dialog'])
                act('reset')
                check(f'{tag}: Reset room does not reopen the quest card', not state()['dialog'])
                act('goal')
                meta = page.evaluate("(() => { const m = document.querySelector('.cq-goal-pop .cq-goal-meta'); return m ? m.innerText : ''; })()")
                check(f'{tag}: goal pop shows the chips and the difficulty', 'Rune' in meta and 'Repeat' in meta and 'Hard' in meta, meta)
                act('goal')
                enter_level('q01')
                b = brief()
                check(f"{tag}: q01 says You'll practise + Sequence, Easy", b and "You'll practise" in b['text'] and b['chips'] and b['chips'][0].endswith('Sequence') and 'Easy' in b['pips'], b)
                act('brief:start')
                enter_level('q05')
                check(f'{tag}: q05 is Medium', 'Medium' in brief()['pips'])
                act('brief:start')
                act('map')
                pips = page.evaluate(f"document.querySelector('[data-action=\"level:{level_ids.index('q12')}\"] .cq-map-pips').textContent")
                check(f'{tag}: the q12 map row shows ●●●', pips == '●●●', pips)
                act('dialog:close')

                # ---- Simple cards slice 04: two rows for the Rune. ----
                def coach():
                    return page.evaluate("""() => { const c = document.querySelector('.cq-coach');
                      if (!c || c.hidden) return null;
                      const r = c.getBoundingClientRect(), b = c.querySelector('button'), q = b.getBoundingClientRect();
                      return {text: c.querySelector('p').textContent, bottom: r.bottom, left: r.left, right: r.right, top: r.top,
                        tail: r.left + parseFloat(c.style.getPropertyValue('--tail')), action: b.dataset.action, w: q.width, h: q.height,
                        hit: b.contains(document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2)), vw: innerWidth, vh: innerHeight}; }""")

                open_level('q10')
                c = coach()
                row = page.locator('.cq-row[data-row="rune"]').bounding_box()
                check(f'{tag}: q10 coach is one card above the Rune row with a ≥ 48 px Got it',
                      c and c['action'] == 'coach:done' and 'Rune row' in c['text'] and c['w'] >= 47.5 and c['h'] >= 47.5 and c['hit']
                      and c['top'] >= 0 and c['bottom'] <= row['y'] + 1 and row['x'] - 2 <= c['tail'] <= row['x'] + row['width'] + 2, c)
                page.screenshot(path=str(out / f'coach-{tag}.png'))
                tap('.cq-coach [data-action="coach:done"]')
                check(f'{tag}: Got it hides the coach and saves it on the profile', coach() is None and 'rune' in state()['profile'].get('coach', []))
                open_level('q10')
                check(f'{tag}: the coach does not come back', coach() is None)
                tap('.cq-row[data-row="rune"] [data-action="row:rune"]')
                pin = page.evaluate("(() => { const b = document.querySelector('.cq-picker-pin [data-action=\"logic:callRune\"]'); return {dim: b.classList.contains('dim'), aria: b.getAttribute('aria-disabled'), text: b.textContent}; })()")
                check(f'{tag}: the 🪨 card is dimmed while the Rune row glows', state()['editor'] == 'rune' and pin['dim'] and pin['aria'] == 'true' and 'Hero row' in pin['text'], pin)
                tap('.cq-library [data-action="add:move"]')
                tap('.cq-picker-pin [data-action="logic:callRune"]')
                check(f'{tag}: a 🪨 card never lands in the Rune row', program('runeProgram') == [('action', 'move')] and notice() == "A Rune can't use itself. Use it from Main.")
                tap('.cq-row[data-row="main"] [data-action="row:main"]')
                check(f'{tag}: back on the Hero row the 🪨 card is bright', state()['editor'] == 'main' and not page.evaluate("document.querySelector('.cq-picker-pin button').classList.contains('dim')"))

                open_level('q11')
                rows = page.evaluate("""() => [...document.querySelectorAll('.cq-row')].map(r => { const q = r.getBoundingClientRect(), l = r.querySelector('.cq-row-label').getBoundingClientRect();
                  return {row: r.dataset.row, hidden: r.hidden, on: q.top >= 0 && q.bottom <= innerHeight + 1 && q.height > 40, label: l.width >= 47.5 && l.height >= 47.5}; })""")
                check(f'{tag}: q11 shows the Rune row above the Hero row, both on screen', [r['row'] for r in rows] == ['rune', 'main'] and all(not r['hidden'] and r['on'] and r['label'] for r in rows), rows)
                tap('.cq-row[data-row="rune"] [data-action="row:rune"]')
                tap('.cq-library [data-action="add:attack"]')
                tap('.cq-library [data-action="sticker:repeat:2"]')
                tap('.cq-row[data-row="main"] [data-action="row:main"]')
                tap('.cq-runbox [data-action="run"]')
                check(f'{tag}: Rune built, Hero row empty: Run says the Rune is ready', notice() == 'Your Rune is ready! Put the 🪨 card in the Hero row.' and state()['model']['phase'] == 'programming')
                for sel in ['.cq-picker-pin [data-action="logic:callRune"]', '.cq-library [data-action="add:move"]', '.cq-library [data-action="add:turnRight"]', '.cq-picker-pin [data-action="logic:callRune"]']:
                    tap(sel)
                check(f'{tag}: q11 cards in both rows are fully readable', not cards_readable(), cards_readable())
                check(f'{tag}: q11 program equals the reference shape', bare(state()['program']) == refs['q11'] and bare(state()['runeProgram']) == refs['q11:rune'])
                page.screenshot(path=str(out / f'rows-q11-{tag}.png'))
                trail, editors = [], set()
                for _ in range(60):
                    if state()['model']['phase'] != 'programming' and state()['model']['phase'] != 'executing':
                        break
                    act('step')
                    s = state()
                    editors.add(s['editor'])
                    trail.append(page.evaluate("""() => ({calling: document.querySelectorAll('.cq-strip[data-row="main"] .calling').length,
                      lit: document.querySelectorAll('.cq-strip .executing').length, rune: document.querySelectorAll('.cq-strip[data-row="rune"] .executing').length})"""))
                    if len(trail) == 2:
                        page.screenshot(path=str(out / f'rows-step-{tag}.png'))
                    if s['model']['phase'] == 'won' or s['dialog'] == 'win':
                        break
                # Rune = Attack ×2, called twice: four Rune steps. Every step lights exactly one card; while a 🪨 card rings, the lit card is in the Rune row.
                check(f'{tag}: at every Rune step exactly one card is lit and it is in the Rune row',
                      sum(t['rune'] for t in trail) == 4 and all(t['lit'] == 1 for t in trail) and all(t['rune'] == 1 for t in trail if t['calling']), trail)
                check(f'{tag}: the glowing row never changes during the run', editors == {'main'}, editors)
                win('q11 with two rows')

                open_level('q05')
                check(f'{tag}: q05 has one row and no row-label tap target', page.evaluate("""() => document.querySelector('.cq-row[data-row="rune"]').hidden
                  && document.querySelector('[data-action="row:main"]').getClientRects().length === 0"""))
                open_level('q11')
                page.screenshot(path=str(out / f'picker-q11-{tag}.png'))

                problems, sides, shots, small = [], {}, [], []

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
                    if problems and not shots:
                        shots.append(where)
                        page.screenshot(path=str(out / f'bubble-fail-{tag}.png'))

                for index, level_id in enumerate(level_ids):
                    open_level(level_id)
                    assert_bubble(f'{level_id} start')
                    # The program rows and picker never squeeze a room below a 2× pixel scale (simple-cards D7).
                    if (state().get('roomScale') or 0) < 2:
                        small.append(f"{level_id} ×{state().get('roomScale')}")
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
                check(f'{tag}: every room draws at 2× or more beside the picker and program rows', not small, small[:8])
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
