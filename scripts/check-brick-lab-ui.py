"""Brick Lab browser check (docs/plans/2026-10-03-brick-lab/).

Real UI and real pointer taps on a synthetic local profile. It covers: opening from
the Games tab with the Brain Gym gate still closed and through the Games category lock (creative-tool
door, D4), and a Papa app pause still blocking it. Then place, rotate, undo, move, copy and remove
a piece; slice 05: the tool bubble sits by the piece, selecting never resizes the view or
rebuilds the colour tray, tapping the selected piece turns it, dragging it moves it, pieces sit
on the stud grid and an old save is re-settled. Explore -> tap -> Build selects that piece. Back tears the game down and
reopening restores the build. Slices 09-11: every new part builds fast, a rail snaps onto a free rail end, four
curves close a glowing circuit, rails never overlap, and the tray searches (EN + 中文), filters by size, pins
favourites and recents and opens an info card. Slice 12: the parts browser lives in the left rail
(categories, then a category's parts with a Back arrow), the rail keeps one width so the view never
resizes, and there is no bottom tray. A pre-reader profile shows the icon-first UI.
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
SNAP = "SQGames.get('bricklab').snapshot()"
STARTER = 59  # pieces in the starter village (slice 06)


def pick(page, category):
    """Open a category from the left rail (slice 12): Back to the list first if a parts view is open."""
    back = page.locator('.sqbl-rail-back')
    if back.is_visible():
        back.click()
    page.locator(f'.sqbl-category[data-category="{category}"]').click()


NEW_PARTS = ('brick_1x3', 'brick_2x5', 'plate_1x4', 'plate_2x6', 'slope_45', 'wheel_med', 'axle',
             'rail_curve_90', 'rail_junction_t', 'rail_cross', 'platform_4x4')


def lab_slices_09_11(page, snap, check, out):
    """Slices 09-11 on the reopened lab (starter village + 1 piece)."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(120)

    def toast():
        return page.locator('.sqbl-toast').inner_text()

    pieces0 = len(snap()['pieces'])
    box = page.locator('.sqbl-stage canvas').bounding_box()

    # Slice 09: each new part is in its category, bilingual, and builds in < 50 ms.
    slow = []
    for part in NEW_PARTS:
        for c in ('bricks', 'plates', 'slopes', 'wheels', 'connectors', 'rails', 'structure'):
            pick(page, c)
            if page.locator(f'.sqbl-part[data-part="{part}"]').count():
                break
        ms = page.evaluate(f"(() => {{ const t = performance.now(); document.querySelector('.sqbl-part[data-part=\"{part}\"]').click(); return performance.now() - t; }})()")
        page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.55)
        page.wait_for_timeout(60)
        if ms >= 50:
            slow.append((part, round(ms, 1)))
    check(f'Every new part arms and builds its geometry in < 50 ms {slow}', not slow)
    info = page.locator('.sqbl-info')
    check('Tapping a part opens its info card (name EN + 中文, size, colours)', info.is_visible()
          and '平台' in info.inner_text() and '4×4' in info.inner_text() and snap()['tray']['info'] == 'platform_4x4')
    page.locator('.sqbl-tray-title').click()
    check('Tapping elsewhere closes the card', not info.is_visible() and snap()['tray']['info'] is None)
    tap(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.62)
    s = snap()
    check('A new part places and is selected', len(s['pieces']) == pieces0 + 1
          and next(p for p in s['pieces'] if p['id'] == s['selectedId'])['partId'] == 'platform_4x4')
    page.locator('.sqbl-app [data-action="delete"]').click()

    # Slice 10: rail joins. Extend the starter line: hover a straight rail one length past a free end.
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    s = snap()
    end = max(s['rails']['free'], key=lambda e: e['z'])
    rail = next(p for p in s['pieces'] if p['id'] == end['id'])
    links0 = s['rails']['links']
    pick(page, 'rails')
    check('Rails tray: four rails, count in the header', snap()['tray']['count'] == 4
          and '4' in page.locator('.sqbl-tray-title').inner_text())
    page.locator('.sqbl-part[data-part="rail_straight"]').click()
    hx = end['screen']['x'] + (end['screen']['x'] - rail['screen']['x']) * 0.9
    hy = end['screen']['y'] + (end['screen']['y'] - rail['screen']['y']) * 0.9
    page.mouse.move(hx, hy)
    page.wait_for_timeout(120)
    s = snap()
    check('A rail near a free end snaps: rail ends glow, the join guide shows', s['rails']['guide'] and s['rails']['markers'] >= 2)
    tap(hx, hy)
    s = snap()
    joined = next(p for p in s['pieces'] if p['id'] == s['selectedId'])
    check('Dropped rail joins the line end to end', s['rails']['links'] == links0 + 1
          and (joined['x'], joined['z']) == (end['x'], end['z'] + 3) and 'Rails connected' in toast())
    check('Recent shows the last placed part first', s['tray']['recents'][:1] == ['rail_straight'])
    check('A selected rail shows its two ends', s['rails']['markers'] == 2)

    # Rails never overlap: moving the new rail onto the middle of the line is refused.
    middle = next(p for p in s['pieces'] if p['partId'] == 'rail_straight' and (p['x'], p['z']) == (end['x'], end['z'] - 3))
    page.locator('.sqbl-app [data-action="move"]').click()
    tap(middle['screen']['x'], middle['screen']['y'])
    s = snap()
    check('A rail cannot be dropped onto another rail', s['moving'] and '軌道不能疊在一起' in page.locator('[data-stage-hint]').inner_text()
          and next(p for p in s['pieces'] if p['id'] == joined['id'])['z'] == joined['z'])
    tap(joined['screen']['x'], joined['screen']['y'])
    check('…and drops back where it fits', not snap()['moving'])

    # A ring of four curves: place one beside a far tree, Copy three times.
    tree = next(p for p in s['pieces'] if p['partId'] == 'tree_small' and (p['x'], p['z']) == (-12, 12))
    page.locator('.sqbl-part[data-part="rail_curve_90"]').click()
    tap(tree['screen']['x'], tree['screen']['y'])
    for _ in range(3):
        page.locator('.sqbl-app [data-action="duplicate"]').click()
        page.wait_for_timeout(150)
    s = snap()
    curves = [p for p in s['pieces'] if p['partId'] == 'rail_curve_90']
    check('Copying a curve continues the track: four curves close a circuit', len(curves) == 4
          and all(c['id'] in s['rails']['circuit'] for c in curves) and 'Circuit complete' in toast())
    page.wait_for_timeout(700)
    page.screenshot(path=str(out / 'circuit.png'))

    # Slice 11: search (EN + 中文, "2x4" finds 2×4), size filter, favourites.
    canvas0 = page.locator('.sqbl-stage canvas').bounding_box()
    check('Search is folded under 🔍 until asked for', not page.locator('.sqbl-search').is_visible() and not snap()['tray']['finding'])
    page.locator('.sqbl-rail-find').click()
    search = page.locator('.sqbl-search input')
    check('🔍 opens search + size and focuses the box, without resizing the view', snap()['tray']['finding']
          and search.is_visible() and page.locator('.sqbl-size').is_visible()
          and page.evaluate("document.activeElement === document.querySelector('.sqbl-search input')")
          and page.locator('.sqbl-stage canvas').bounding_box() == canvas0)
    search.fill('軌道')
    check('Search finds parts by their 中文 name', sorted(snap()['tray']['parts']) == sorted(
          ['rail_straight', 'rail_curve_90', 'rail_junction_t', 'rail_cross']))
    search.fill('2x4')
    check('Search reads 2x4 as 2×4', set(snap()['tray']['parts']) == {'brick_2x4', 'plate_2x4'})
    search.fill('')
    page.locator('.sqbl-size').select_option('2×2')
    parts = set(snap()['tray']['parts'])
    check('Size filter shows every 2×2 part', {'brick_2x2', 'plate_2x2', 'slope_2x2', 'slope_45', 'rail_cross', 'tree_small'} <= parts
          and 'brick_2x4' not in parts)
    check('A search shows its results in the parts view', snap()['tray']['view'] == 'parts')
    page.locator('.sqbl-rail-back').click()
    check('Back clears the filters, folds search and shows the categories', snap()['tray']['size'] == ''
          and snap()['tray']['view'] == 'categories' and not snap()['tray']['finding'] and not page.locator('.sqbl-search').is_visible())
    page.locator('.sqbl-rail-find').click()
    search.fill('wheel')
    check('A search from the categories opens its results', snap()['tray']['view'] == 'parts' and snap()['tray']['query'] == 'wheel')
    page.locator('.sqbl-rail-find').click()
    check('🔍 again clears the search and folds it', snap()['tray']['query'] == '' and not snap()['tray']['finding'])
    pick(page, 'bricks')
    check('Picking a category opens its parts', snap()['tray']['category'] == 'bricks' and snap()['tray']['view'] == 'parts')
    page.locator('.sqbl-fav[data-fav="brick_1x3"]').first.click()
    s = snap()
    check('Star pins a favourite at the front of the tray', s['tray']['favorites'] == ['brick_1x3'] and s['tray']['parts'][0] == 'brick_1x3'
          and page.locator('.sqbl-tray-sep[data-section="favorites"]').count() == 1)
    app = page.locator('.sqbl-app').bounding_box()
    check('A long parts list scrolls inside the rail instead of widening the app', page.locator('.sqbl-parts').evaluate('e => e.scrollHeight > e.clientHeight')
          and app['x'] + app['width'] <= page.viewport_size['width'] + 1
          and page.locator('.sqbl-save-btn').bounding_box()['x'] + page.locator('.sqbl-save-btn').bounding_box()['width'] <= app['x'] + app['width'])
    check('Favourites and recents are saved per kid', page.evaluate(
          "JSON.parse(localStorage.getItem('sq:brick-lab:prefs:v1:luis')).favorites") == ['brick_1x3'])
    page.locator('.sqbl-fav[data-fav="brick_1x3"]').first.click()
    check('Star again removes it', snap()['tray']['favorites'] == [])
    page.screenshot(path=str(out / 'library.png'))


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
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True,
                                                 args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            report['browser'] = browser.version
            context = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
            page = context.new_page()
            page.set_default_timeout(15000)
            page.set_viewport_size({'width': 1280, 'height': 800})
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
            def console(message):
                url = message.location.get('url', '')
                if message.type != 'error':
                    return
                # the harness blocks every remote host (offline tablet); that is not an app error
                if 'net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1'):
                    report.setdefault('blockedRemoteResources', []).append(url)
                else:
                    report['consoleErrors'].append(message.text + ' @ ' + url)
            page.on('console', console)

            def snap():
                return page.evaluate(SNAP)

            def act(action):
                page.locator(f'.sqbl-app [data-action="{action}"]').click()

            def canvas_tap(x, y):
                page.mouse.click(x, y)
                page.wait_for_timeout(120)

            try:
                base = f'http://127.0.0.1:{server.server_port}'
                page.goto(base + '/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check('Brain Gym gate is closed for regular games', page.evaluate("SQContentRegistry.get('game:solar').available") is False)
                check('Brick Lab stays open through it', page.evaluate("SQContentRegistry.get('game:bricklab').available") is True)
                page.locator('#hubTabs [data-t="adventure"]').click()
                page.locator('[data-adventure="games"]').click()
                page.locator('#gameRow [data-l="bricklab"]').click()
                page.wait_for_selector('#stage .sqbl-app canvas')
                page.wait_for_function(SNAP + ' && ' + SNAP + '.pieces.length > 0')
                s = snap()
                check('Games tile opens Brick Lab (no iframe, own Back gone)', page.locator('iframe').count() == 0
                      and page.locator('.sqbl-app [data-action="exit"]').count() == 0)
                check('Starter village on a fresh save', len(s['pieces']) == STARTER and s['mode'] == 'build')
                check('Graphics through three-runtime', s['graphics'] in ('webgl2', 'webgl1'))
                check('Studded 64×64 baseplate, no side tool rail (slices 05–06)', s['baseplateStuds'] == 4096
                      and page.locator('.sqbl-right-rail').count() == 0)
                check('Kid-facing chrome is bilingual', '建造' in page.locator('.sqbl-mode-toggle').inner_text()
                      and '積木' in page.locator('.sqbl-tray-title').inner_text())
                page.screenshot(path=str(out / 'open.png'))

                # Slice 12: the parts browser is the left rail; the 3D view runs to the bottom of the app.
                app = page.locator('.sqbl-app').bounding_box()
                b = page.locator('.sqbl-stage canvas').bounding_box()
                check('No bottom tray: the 3D view reaches the bottom of the app', page.locator('.sqbl-bottom-tray').count() == 0
                      and abs((b['y'] + b['height']) - (app['y'] + app['height'])) <= 1)
                check('The rail opens on the categories', snap()['tray']['view'] == 'categories'
                      and page.locator('.sqbl-category-list').is_visible() and not page.locator('.sqbl-parts').is_visible()
                      and not page.locator('.sqbl-rail-back').is_visible() and page.locator('.sqbl-colors').is_visible())
                # Slice 08 / 12: neither switching category nor switching rail view resizes the 3D view (flash).
                sizes = {(round(b['width']), round(b['height']))}
                rail = page.locator('.sqbl-left-rail').bounding_box()['width']
                for cat in ('plates', 'slopes', 'wheels', 'connectors', 'rails', 'structure', 'nature', 'bricks'):
                    pick(page, cat)
                    b = page.locator('.sqbl-stage canvas').bounding_box()
                    sizes.add((round(b['width']), round(b['height'])))
                check('Switching category or rail view keeps the 3D view size (no flash)', len(sizes) == 1
                      and page.locator('.sqbl-left-rail').bounding_box()['width'] == rail)
                slots = page.locator('.sqbl-part-slot')
                xs = {round(slots.nth(i).bounding_box()['x']) for i in range(min(4, slots.count()))}
                check('A category opens its parts in two columns, with Back and colours', snap()['tray']['view'] == 'parts'
                      and len(xs) == 2 and page.locator('.sqbl-rail-back').is_visible()
                      and not page.locator('.sqbl-category-list').is_visible() and page.locator('.sqbl-colors').is_visible())
                check('Rail targets are tablet-sized', all(min(page.locator(sel).bounding_box()['width'], page.locator(sel).bounding_box()['height']) >= 44
                      for sel in ('.sqbl-rail-back', '.sqbl-rail-find', '.sqbl-part-slot >> nth=0')))
                box = page.locator('.sqbl-stage canvas').bounding_box()
                cx, cy = box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.62
                page.locator('.sqbl-part[data-part="brick_2x2"]').click()
                check('Tray arms one placement', snap()['placementArmed'])
                canvas_tap(cx, cy)
                s = snap()
                check('Tap places a piece and selects it', len(s['pieces']) == STARTER + 1 and s['selectedId'] and not s['placementArmed'])
                placed = s['selectedId']
                act('rotate')
                rotated = next(p for p in snap()['pieces'] if p['id'] == placed)['rotation']
                check('Rotate turns 90°', rotated == 90)
                act('undo')
                check('Undo restores rotation', next(p for p in snap()['pieces'] if p['id'] == placed)['rotation'] == 0)
                check('Tools hide with no selection', not snap()['toolsShown'])
                target = next(p for p in snap()['pieces'] if p['id'] == placed)
                page.evaluate("document.querySelector('.sqbl-color').dataset.sqTag = 'kept'")
                before = page.locator('.sqbl-stage canvas').bounding_box()
                canvas_tap(target['screen']['x'], target['screen']['y'])
                check('Tap on a piece selects it', snap()['selectedId'] == placed)
                page.wait_for_timeout(250)
                check('Selecting keeps the 3D view size (no flash)', page.locator('.sqbl-stage canvas').bounding_box() == before)
                check('Selecting keeps the colour tray nodes', page.evaluate("document.querySelector('.sqbl-color').dataset.sqTag") == 'kept')
                tools = page.locator('.sqbl-bubble-card').bounding_box()
                check('Tools appear next to the piece', snap()['toolsShown'] and abs(tools['x'] + tools['width'] / 2 - target['screen']['x']) < 120
                      and target['screen']['y'] - 260 < tools['y'] < target['screen']['y'] + 120)
                check('Tool targets are tablet-sized', all(b['height'] >= 48 and b['width'] >= 48 for b in
                      (page.locator(f'.sqbl-bubble [data-action="{a}"]').bounding_box() for a in ('move', 'rotate', 'duplicate', 'delete'))))
                canvas_tap(target['screen']['x'], target['screen']['y'])
                s = snap()
                check('Tapping the selected piece again turns it', s['selectedId'] == placed
                      and next(p for p in s['pieces'] if p['id'] == placed)['rotation'] == 90)
                undo_before = s['undo']
                page.mouse.move(target['screen']['x'], target['screen']['y'])
                page.mouse.down()
                for step in range(1, 9):
                    page.mouse.move(target['screen']['x'] + step * 14, target['screen']['y'] + step * 6)
                page.mouse.up()
                page.wait_for_timeout(120)
                s = snap()
                dragged = next(p for p in s['pieces'] if p['id'] == placed)
                check('Dragging the selected piece moves it in one gesture', (dragged['x'], dragged['z']) != (target['x'], target['z'])
                      and s['selectedId'] == placed and not s['dragging'] and s['undo'] == undo_before + 1)
                check('Pieces sit on the stud grid', all((p['x'] * 2) % 1 == 0 and (p['z'] * 2) % 1 == 0 for p in s['pieces']))
                target = dragged
                act('move')
                check('Move arms a relocation', snap()['moving'])
                path = next(p for p in snap()['pieces'] if p['partId'] == 'plate_2x4' and (p['x'], p['z']) == (0, 8))
                canvas_tap(path['screen']['x'], path['screen']['y'])
                moved = next(p for p in snap()['pieces'] if p['id'] == placed)
                check('Tap drops the moved piece elsewhere', not snap()['moving'] and (moved['x'], moved['z']) != (target['x'], target['z']))
                act('duplicate')
                check('Copy adds a piece', len(snap()['pieces']) == STARTER + 2)
                act('delete')
                check('Remove deletes the selected piece', len(snap()['pieces']) == STARTER + 1 and snap()['selectedId'] is None)

                # Slice 07: the view pans along the ground in Build too, and never leaves the island.
                act('home-view')
                # The Home camera tween can finish late on a slow GPU; a fixed wait read it mid-flight.
                page.wait_for_function(SNAP + '.target && Math.abs(' + SNAP + '.target.y + 8) < 1e-6 && Math.abs(' + SNAP + '.target.x - 5) < 1e-6')
                page.wait_for_timeout(300)
                start = snap()['target']
                page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5)
                page.mouse.down(button='right')
                for step in range(1, 11):
                    page.mouse.move(box['x'] + box['width'] * 0.5 - step * 25, box['y'] + box['height'] * 0.5 - step * 10)
                page.mouse.up(button='right')
                page.wait_for_timeout(700)
                moved_to = snap()['target']
                check('Build view pans along the ground', abs(moved_to['x'] - start['x']) + abs(moved_to['z'] - start['z']) > 3
                      and abs(moved_to['y'] - start['y']) < 0.01)
                page.mouse.move(box['x'] + 20, box['y'] + 20)
                page.mouse.down(button='right')
                for step in range(1, 30):
                    page.mouse.move(box['x'] + 20 + step * 40, box['y'] + 20 + step * 25)
                page.mouse.up(button='right')
                page.wait_for_timeout(900)
                far = snap()['target']
                check('Panning stops over the island', abs(far['x']) <= 36.01 and abs(far['z']) <= 36.01)
                act('home-view')
                page.wait_for_timeout(900)
                page.locator('.sqbl-mode-toggle [data-mode-button="explore"]').click()
                check('Explore keeps the scene full size', page.locator('.sqbl-stage canvas').bounding_box()['height'] > 500)
                check('Explore hides the parts rail', snap()['mode'] == 'explore' and not page.locator('.sqbl-left-rail').is_visible())
                act('home-view')
                page.wait_for_timeout(900)
                target = next(p for p in snap()['pieces'] if p['id'] == placed)
                canvas_tap(target['screen']['x'], target['screen']['y'])
                s = snap()
                check('Explore tap returns to Build with that piece selected', s['mode'] == 'build' and s['selectedId'] == placed)
                page.screenshot(path=str(out / 'focus.png'))

                check('Back handled', page.evaluate('SQPlatform.triggerBack()') is True)
                page.wait_for_function("!document.querySelector('#stage .sqbl-app')")
                check('Stage cleaned on Back', page.locator('#stage .sqbl-host').count() == 0)
                saved = page.evaluate("JSON.parse(localStorage.getItem('sq:brick-lab:v1:luis')).pieces.length")
                check('Build saved per kid', saved == STARTER + 1)
                check('Reopen restores the build', page.evaluate("SummerQuest.openGame('bricklab')")['ok'])
                page.wait_for_function(SNAP + ' && ' + SNAP + f'.pieces.length === {STARTER + 1}')
                lab_slices_09_11(page, snap, check, out)
                page.evaluate('SQPlatform.triggerBack()')
                page.wait_for_function("!document.querySelector('#stage .sqbl-app')")

                # Same door as Paint: through the Games category lock, stopped only by a Papa app pause.
                page.evaluate("SQHost.store.familySettings.catlock_luis_games='Synthetic pause'")
                check('Passes the Games category lock like Paint', page.evaluate("SQContentRegistry.get('game:bricklab').available") is True)
                page.evaluate("SQHost.store.familySettings.applock_luis='Synthetic break'")
                check('Papa app pause blocks it', page.evaluate("SummerQuest.openGame('bricklab')")['ok'] is False)
                page.evaluate("delete SQHost.store.familySettings.catlock_luis_games; delete SQHost.store.familySettings.applock_luis")

                # Lucien (age 4) gets the icon-first pre-reader UI and his own save.
                # His save predates slice 05 (old 0.96 brick height, no grid field): it is re-settled.
                legacy = {'format': 'summer-quest-brick-build', 'version': 1, 'pieces': [
                    {'id': 'a', 'partId': 'brick_2x2', 'colorId': 'blue', 'x': 1, 'y': 0.48, 'z': 1, 'rotation': 0},
                    {'id': 'b', 'partId': 'plate_2x2', 'colorId': 'red', 'x': 1, 'y': 1.12, 'z': 1, 'rotation': 0},
                    {'id': 'c', 'partId': 'brick_1x1', 'colorId': 'red', 'x': -2, 'y': 0.48, 'z': 3, 'rotation': 0}]}
                page.evaluate("legacy => localStorage.setItem('sq:brick-lab:v1:lucien', JSON.stringify(legacy))", legacy)
                page.evaluate("localStorage.setItem('sq:kid','lucien'); localStorage.setItem('sq:view','hub')")
                page.reload(wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check('Lucien opens Brick Lab', page.evaluate("SummerQuest.openGame('bricklab')")['ok'])
                page.wait_for_function(SNAP + ' && ' + SNAP + '.pieces.length > 0')
                check('Pre-reader UI is icon-first', page.evaluate(SNAP + '.preReader') and page.locator('.sqbl-app.is-pre-reader').count() == 1
                      and 'Build' not in page.locator('.sqbl-mode-toggle').inner_text())
                ys = {p['id']: (p['x'], p['y'], p['z']) for p in snap()['pieces']}
                check('Each kid has their own build, an old save re-settled to brick proportions',
                      ys == {'a': (1, 0.6, 1), 'b': (1, 1.4, 1), 'c': (-1.5, 0.6, 3.5)})
                page.wait_for_timeout(400)
                check('Re-settled save is stored with the new grid', page.evaluate(
                      "JSON.parse(localStorage.getItem('sq:brick-lab:v1:lucien')).grid") == 2)
                page.screenshot(path=str(out / 'pre-reader.png'))
                page.evaluate('SQPlatform.triggerBack()')
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
    report['ok'] = bool(report['checks']) and all(c['ok'] for c in report['checks']) and not (
        report.get('failure') or report['pageErrors'] or report['consoleErrors'])
    (out / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"{sum(c['ok'] for c in report['checks'])}/{len(report['checks'])} browser checks passed", flush=True)
    for key in ('failure', 'note'):
        if report.get(key):
            print(key + ': ' + report[key], flush=True)
    if report['pageErrors'] or report['consoleErrors']:
        print('errors:', report['pageErrors'], report['consoleErrors'], flush=True)
    return report['ok']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/brick-lab-ui')
    raise SystemExit(0 if run(parser.parse_args()) else 1)
