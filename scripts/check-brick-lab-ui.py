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
resizes, and there is no bottom tray. Slice 13: an idle lab draws no frames, and a low-memory tablet
gets the reduced tier (studs painted on the plate, Lambert light, a fraction of the triangles) and still
places pieces. Slice 14: a standard tablet that can't keep up steps down (painted studs, no shadows)
without resizing the view. Slice 15: a part slid sideways out of the rail places where it is let go.
Multiplayer plan slice 08: part icons are the real part, in the picked colour, drawn on the lab's own canvas.
Multiplayer plan slice 02: every change goes through the op sequencer (placed pieces carry `by`).
Multiplayer plan slice 05: on a pretend home wifi (in-page loopback), a sibling joins the open world, builds,
undoes and leaves; then this tablet joins a sibling's world, builds in it and is sent home when it closes.
Multiplayer plan slice 01: the lab opens on the kid's worlds (the old single build becomes world 1); a new
world starts empty; rename and delete from a card; Back leaves a world for the menu with its picture saved.
A pre-reader profile shows the icon-first UI.
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


def enter_world(page, nth=0):
    """Brick Lab opens on the world menu (multiplayer plan slice 01): open a world from it."""
    page.wait_for_function(f"window.SQGames && SQGames.get('bricklab') && {SNAP} && {SNAP}.menu")
    page.locator('.sqbl-world-open').nth(nth).click()
    page.wait_for_function(f"{SNAP} && !{SNAP}.menu && {SNAP}.world")


def leave_lab(page):
    """Back out of a world, then out of Brick Lab."""
    for _ in range(3):
        if not page.locator('#stage .sqbl-app').count():
            return
        page.evaluate('SQPlatform.triggerBack()')
        page.wait_for_timeout(120)
    page.wait_for_function("!document.querySelector('#stage .sqbl-app')")


def world_build(page, kid, field):
    """A field of a kid's most recently played world, read from storage."""
    return page.evaluate("""([kid, field]) => {
      const list = JSON.parse(localStorage.getItem('sq:brick-lab:worlds:v1:' + kid));
      const top = list.slice().sort((a, b) => b.played - a.played)[0];
      return JSON.parse(localStorage.getItem('sq:brick-lab:world:v1:' + kid + ':' + top.id))[field]; }""", [kid, field])


# A pretend home wifi in the page (lan-session loopback) and a scripted sibling tablet.
WIFI = """async () => {
  const lan = await import('/js/game-services/lan-session.js');
  const share = await import('/js/brick-lab/brick-share.js');
  const { BrickTogether } = await import('/js/brick-lab/brick-together.js');
  const cat = await import('/js/brick-lab/brick-catalog.js');
  const wifi = lan.createLoopback();
  window.__sqLanTransport = wifi.device();
  const rules = { part: (id) => cat.PARTS.find((p) => p.id === id) || null, color: (id) => id in cat.COLORS, half: 32 };
  /* A sibling tablet: what BrickTogether needs from a lab, nothing drawn. */
  const fake = (kid) => {
    const lab = { kidId: kid, pieces: new Map(), sequencer: null, events: [], kidName: (k) => k, currentWorldName: () => 'Treehouse',
      renderJoin() {}, renderCrew() {}, sharedChanged() {}, showOp() {}, afterRemoteOp() {}, updateUndoUI() {},
      crewToast: (k, j) => lab.events.push(['crew', k, j]), loadShared(w) { lab.pieces.clear(); w.forEach((p) => lab.pieces.set(p.id, { ...p })); },
      ownChangeApplied: (op) => lab.events.push(['mine', op.type]), ownChangeRefused: (op, why) => lab.events.push(['refused', why]),
      sessionEnded: (r) => lab.events.push(['ended', r]) };
    lab.together = new BrickTogether(lab, lan.createLanSession(wifi.device()), kid);
    return lab;
  };
  window.__sqSib = { wifi, share, rules, fake, lili: fake('lili') };
  return true; }"""


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


def lab_together(browser, base, report, console, check, out):
    ctx = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
    pg = ctx.new_page()
    pg.set_viewport_size({'width': 1280, 'height': 800})
    pg.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
    pg.on('console', console)
    pg.goto(base + '/index.html', wait_until='domcontentloaded')
    RECOVERY['ready'](pg)
    RECOVERY['wait_screen'](pg, 'hub')
    pg.evaluate(WIFI)
    snap = lambda: pg.evaluate(SNAP)
    sib = lambda js: pg.evaluate(f"(async () => {{ const S = window.__sqSib; {js} }})()")
    pg.evaluate("SummerQuest.openGame('bricklab')")
    pg.wait_for_function(f"window.SQGames && SQGames.get('bricklab') && {SNAP} && {SNAP}.menu")
    check('With the home wifi, Join looks for worlds nearby', snap()['lan'] is True
          and '附近沒有' in pg.locator('[data-join]').inner_text())

    # Host: opening a world puts it on the wifi; Lili's tablet finds it and joins.
    enter_world(pg)
    n0 = len(snap()['pieces'])
    box0 = pg.locator('.sqbl-stage canvas').bounding_box()
    found = sib("""const t = S.lili.together; t.startLooking(); await new Promise((r) => setTimeout(r, 50));
        return t.joinable().map((w) => ({ kid: w.kid, world: w.world }));""")
    check('Opening a world puts it on the home wifi, named for the kid and the world',
          found == [{'kid': 'luis', 'world': 'My Brick World · 我的積木世界'}])
    sib("""const t = S.lili.together; await t.join(t.joinable()[0]); await new Promise((r) => setTimeout(r, 80)); return true;""")
    pg.wait_for_timeout(200)
    s = snap()
    check('Lili joins at any time: she gets the whole world, no one confirms anything',
          sib("return S.lili.pieces.size") == n0 and s['together']['peers'] == 1 and s['together']['shared'])
    check('Crew chips show who is building, each in their colour', pg.locator('.sqbl-crew-chip').count() == 2
          and pg.locator('.sqbl-crew').is_visible())
    check('A toast says Lili joined, in both languages', 'Lili' in pg.locator('.sqbl-toast').inner_text()
          and '加入了' in pg.locator('.sqbl-toast').inner_text())
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(out / 'together-host.png'))

    # Lili builds: the brick lands in this world, as hers.
    sib("""S.lili.together.request({ type: 'add', piece: { id: 'lili-1', partId: 'brick_2x2', colorId: 'pink', x: 10, y: 0.6, z: 10, rotation: 0 } });
        await new Promise((r) => setTimeout(r, 80)); return true;""")
    pg.wait_for_timeout(150)
    lili_brick = next((p for p in snap()['pieces'] if p['id'] == 'lili-1'), None)
    check("Lili's brick lands here, marked as hers", lili_brick is not None and lili_brick.get('by') == 'lili')
    pg.mouse.click(lili_brick['screen']['x'], lili_brick['screen']['y'])
    pg.wait_for_timeout(150)
    check("Tapping Lili's brick says she put it there; its outline is her colour, the brick keeps its own",
          snap()['selectedId'] == 'lili-1' and 'Lili' in pg.locator('.sqbl-stage-hint').inner_text()
          and snap()['selectionColor'] == '#ff6fb5' and lili_brick['colorId'] == 'pink')
    pg.screenshot(path=str(out / 'together-placer.png'))
    pg.mouse.click(box0['x'] + 30, box0['y'] + box0['height'] - 30)

    # This tablet builds: Lili's tablet gets it; undo only takes back our own brick.
    pick(pg, 'bricks')
    pg.locator('.sqbl-part[data-part="brick_1x1"]').click()
    box = pg.locator('.sqbl-stage canvas').bounding_box()
    pg.mouse.click(box['x'] + box['width'] * 0.42, box['y'] + box['height'] * 0.7)
    pg.wait_for_timeout(200)
    mine = snap()['selectedId']
    check("Our brick reaches Lili's tablet", mine and sib(f"return S.lili.pieces.has('{mine}')"))
    check('Undo is on for our own change', not pg.locator('.sqbl-app [data-action="undo"]').is_disabled())
    pg.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
    pg.wait_for_timeout(200)
    check("Undo takes back our brick only, everywhere; Lili's stays", not any(p['id'] == mine for p in snap()['pieces'])
          and sib(f"return !S.lili.pieces.has('{mine}') && S.lili.pieces.has('lili-1')")
          and any(p['id'] == 'lili-1' for p in snap()['pieces']))

    # Lili leaves: chips go, the world (with her brick) is saved here.
    sib("S.lili.together.leave(); await new Promise((r) => setTimeout(r, 80)); return true;")
    pg.wait_for_timeout(150)
    check('Lili leaves: a toast, the chips go', '離開了' in pg.locator('.sqbl-toast').inner_text()
          and not pg.locator('.sqbl-crew').is_visible())
    pg.evaluate('SQPlatform.triggerBack()')
    check("Lili's brick is saved in this tablet's world", any(p['id'] == 'lili-1' for p in world_build(pg, 'luis', 'pieces')))
    check('Leaving the world takes it off the wifi', sib("""const t = S.lili.together; t.startLooking();
        await new Promise((r) => setTimeout(r, 50)); return t.joinable().length;""") == 0)

    # Guest: Lili opens her Treehouse; it shows in our Join list; we join and build in it.
    sib("""const lab = S.lili; lab.together.stopLooking();
        lab.pieces.clear(); lab.pieces.set('t1', { id: 't1', partId: 'plate_2x2', colorId: 'green', x: 1, y: 0.2, z: 1, rotation: 0, by: 'lili' });
        lab.sequencer = S.share.createSequencer({ world: lab.pieces, rules: S.rules });
        await lab.together.host('Treehouse'); return true;""")
    pg.wait_for_selector('.sqbl-join-card')
    check("Lili's open world shows in Join with her name and colour", 'Lili' in pg.locator('.sqbl-join-card').inner_text()
          and 'Treehouse' in pg.locator('.sqbl-join-card').inner_text())
    pg.screenshot(path=str(out / 'together-join.png'))
    worlds_before = len(snap()['worlds'])
    pg.locator('.sqbl-join-card').click()
    pg.wait_for_function(f"{SNAP}.together.role === 'guest' && !{SNAP}.menu")
    s = snap()
    check("Joining shows Lili's world, not ours", [p['id'] for p in s['pieces']] == ['t1'] and s['world'] is None)
    check('A guest has no Save button (nothing is kept here)', not pg.locator('.sqbl-save-btn').is_visible())
    pick(pg, 'bricks')
    pg.locator('.sqbl-part[data-part="brick_2x2"]').click()
    pg.mouse.click(box['x'] + box['width'] * 0.58, box['y'] + box['height'] * 0.66)
    pg.wait_for_timeout(250)
    s = snap()
    added = [p for p in s['pieces'] if p['id'] != 't1']
    check("Our brick goes to Lili's tablet, comes back numbered, and is selected", len(added) == 1 and added[0].get('by') == 'luis'
          and s['selectedId'] == added[0]['id'] and sib(f"return S.lili.pieces.get('{added[0]['id']}').by") == 'luis')
    pg.screenshot(path=str(out / 'together-guest.png'))

    # Lili closes her world: we land on our own menu, our worlds untouched.
    sib("S.lili.together.stopHosting(); await new Promise((r) => setTimeout(r, 80)); return true;")
    pg.wait_for_function(f"{SNAP}.menu")
    s = snap()
    check("Lili closes her world: a gentle toast, back to our own menu", s['together']['role'] is None
          and '關閉了' in pg.locator('.sqbl-toast').inner_text() and len(s['worlds']) == worlds_before)
    check("Nothing of Lili's world was saved here", not any(p['id'] == 't1' for p in world_build(pg, 'luis', 'pieces')))
    leave_lab(pg)
    ctx.close()


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
                page.wait_for_function(f"window.SQGames && SQGames.get('bricklab') && {SNAP} && {SNAP}.menu")
                s = snap()
                check('Brick Lab opens on the world menu: one world, the starter village', s['menu'] and s['world'] is None
                      and [w['count'] for w in s['worlds']] == [STARTER] and len(s['pieces']) == 0
                      and '我的世界' in page.locator('.sqbl-menu').inner_text() and '加入' in page.locator('.sqbl-menu').inner_text())
                check('In a browser, Join says building together needs the app (no plugin, solo as before)', s['lan'] is False
                      and '應用程式' in page.locator('[data-join]').inner_text())
                check('World cards are tablet-sized', all(page.locator(sel).first.bounding_box()['height'] >= 48
                      for sel in ('.sqbl-world-open', '.sqbl-world-new', '.sqbl-world-more')))
                page.screenshot(path=str(out / 'menu.png'))
                enter_world(page)
                s = snap()
                check('Games tile opens Brick Lab (no iframe, own Back gone)', page.locator('iframe').count() == 0
                      and page.locator('.sqbl-app [data-action="exit"]').count() == 0)
                check('Starter village on a fresh save', len(s['pieces']) == STARTER and s['mode'] == 'build')
                check('Graphics through three-runtime', s['graphics'] in ('webgl2', 'webgl1'))
                check('Studded 64×64 baseplate, no side tool rail (slices 05–06)', s['baseplateStuds'] == 4096
                      and page.locator('.sqbl-right-rail').count() == 0)
                # Slice 13: render on demand. Idle, no frames are drawn; input brings them back.
                page.wait_for_timeout(1600)
                f0 = snap()['render']['frames']
                page.wait_for_timeout(800)
                check('An idle lab draws no frames', snap()['render']['frames'] == f0 and snap()['render']['studs'] == 'mesh')
                cb = page.locator('.sqbl-stage canvas').bounding_box()
                page.mouse.move(cb['x'] + cb['width'] * 0.5, cb['y'] + cb['height'] * 0.5)
                page.mouse.move(cb['x'] + cb['width'] * 0.52, cb['y'] + cb['height'] * 0.5)
                page.wait_for_timeout(150)
                check('Input brings frames back', snap()['render']['frames'] > f0)
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
                # Multiplayer plan slice 08 (D12): each icon on screen is the real part in the picked colour.
                on_screen = """() => { const r = document.querySelector('.sqbl-parts').getBoundingClientRect();
                    return [...document.querySelectorAll('.sqbl-parts .sqbl-part-preview')].filter((e) => {
                      const b = e.getBoundingClientRect(); return b.bottom > r.top && b.top < r.bottom; }).length; }"""
                rail_box = page.locator('.sqbl-left-rail').bounding_box()

                def icons(suffix, wait=900):
                    page.wait_for_timeout(wait)
                    keys = snap()['tray']['icons']
                    return len(keys) >= page.evaluate(on_screen) and keys and all(suffix(k) for k in keys)

                check('Every part icon on screen is the real part, in the picked colour (red)', icons(lambda k: k.endswith(':red')))
                check('An icon is the part on a clear background (see-through corner, solid middle)', page.evaluate("""async () => {
                    const img = document.querySelector('.sqbl-parts .sqbl-part-preview.has-pic img'); await img.decode();
                    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
                    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
                    const at = (x, y) => g.getImageData(x, y, 1, 1).data[3];
                    return at(0, 0) === 0 && at(c.width >> 1, c.height >> 1) === 255; }"""))
                check('Icons draw on the lab canvas, no second 3D canvas', page.locator('.sqbl-app canvas').count() == 1)
                page.screenshot(path=str(out / 'icons-red.png'), clip=rail_box)
                page.locator('.sqbl-color[data-color="blue"]').click()
                check('Picking blue redraws the icons on screen in blue', icons(lambda k: k.endswith(':blue')))
                page.screenshot(path=str(out / 'icons-blue.png'), clip=rail_box)
                pick(page, 'rails')
                check('Rails keep their own colours: one icon per rail part', icons(lambda k: ':' not in k))
                page.screenshot(path=str(out / 'icons-rails.png'), clip=rail_box)
                page.locator('.sqbl-color[data-color="red"]').click()
                drawn = snap()['tray']['iconsCached']
                pick(page, 'bricks')
                check('Back to red: icons come from the cache, nothing redrawn', icons(lambda k: k.endswith(':red'), wait=400)
                      and snap()['tray']['iconsCached'] == drawn)
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
                check('A placed piece remembers who placed it (multiplayer plan slice 02)',
                      next(p for p in s['pieces'] if p['id'] == placed).get('by') == 'luis')
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

                # Slice 15: slide a part sideways out of the rail onto the plate.
                pick(page, 'bricks')
                tb = page.locator('.sqbl-part[data-part="brick_1x2"]').last.bounding_box()
                cb = page.locator('.sqbl-stage canvas').bounding_box()
                n0 = len(snap()['pieces'])
                tx, ty = tb['x'] + tb['width'] / 2, tb['y'] + tb['height'] / 2
                dx, dy = cb['x'] + cb['width'] * 0.56, cb['y'] + cb['height'] * 0.66
                page.mouse.move(tx, ty)
                page.mouse.down()
                for i in range(1, 13):
                    page.mouse.move(tx + (dx - tx) * i / 12, ty + (dy - ty) * i / 12)
                s = snap()
                check('Dragging a part out of the rail arms it, the ghost follows', s['render']['trayDrag'] and s['placementArmed'])
                page.mouse.up()
                page.wait_for_timeout(150)
                s = snap()
                check('Letting go over the plate places it, no info card', len(s['pieces']) == n0 + 1 and not s['placementArmed']
                      and next(p for p in s['pieces'] if p['id'] == s['selectedId'])['partId'] == 'brick_1x2'
                      and not page.locator('.sqbl-info').is_visible())
                tb = page.locator('.sqbl-part[data-part="brick_1x2"]').last.bounding_box()
                page.mouse.move(tb['x'] + 20, tb['y'] + 40)
                page.mouse.down()
                page.mouse.move(tb['x'] + 45, tb['y'] + 42)
                page.mouse.move(tb['x'] + 70, tb['y'] + 44)
                page.mouse.up()
                page.wait_for_timeout(100)
                s = snap()
                check('Letting go over the rail leaves the part armed, places nothing', s['placementArmed'] and len(s['pieces']) == n0 + 1
                      and not s['render']['trayDrag'])
                page.mouse.move(tb['x'] + 30, tb['y'] + 30)
                page.mouse.down()
                page.mouse.move(tb['x'] + 32, tb['y'] + 70)
                page.mouse.up()
                check('A vertical slide on a tile is not a drag', not snap()['render']['trayDrag'])
                act('undo')

                check('Back handled', page.evaluate('SQPlatform.triggerBack()') is True)
                s = snap()
                check('Back leaves the world for the menu, saved with its picture', s['menu'] and s['world'] is None
                      and len(s['pieces']) == 0 and s['worlds'][0]['count'] == STARTER + 1 and s['worlds'][0]['thumb']
                      and page.locator('.sqbl-world-pic img').count() == 1)
                # Slice 01: a new world starts empty and goes to the front; rename and delete from its card.
                page.locator('.sqbl-world-new').click()
                page.wait_for_function(f"{SNAP} && !{SNAP}.menu")
                s = snap()
                check('A new world opens empty', len(s['pieces']) == 0 and s['world'] and s['mode'] == 'build')
                page.evaluate('SQPlatform.triggerBack()')
                s = snap()
                check('The new world is listed first, named World 2 · 世界 2', s['menu'] and len(s['worlds']) == 2
                      and s['worlds'][0]['name'] == 'World 2 · 世界 2' and s['worlds'][1]['count'] == STARTER + 1)
                card = page.locator('.sqbl-world').first
                card.locator('.sqbl-world-more').click()
                check('Back closes a card\'s actions and stays in Brick Lab', page.evaluate('SQPlatform.triggerBack()') is True
                      and snap()['menu'] and page.locator('.sqbl-world.is-editing').count() == 0)
                card.locator('.sqbl-world-more').click()
                card.locator('[data-world-act="rename"]').click()
                page.locator('[data-world-name]').fill('Castle 城堡')
                page.locator('[data-world-name]').press('Enter')
                check('Rename a world', snap()['worlds'][0]['name'] == 'Castle 城堡'
                      and 'Castle 城堡' in page.locator('.sqbl-world').first.inner_text())
                card.locator('.sqbl-world-more').click()
                card.locator('[data-world-act="delete"]').click()
                check('Delete asks first, in both languages', '要刪除' in card.inner_text() and len(snap()['worlds']) == 2)
                card.locator('[data-world-act="delete-yes"]').click()
                check('Delete removes the world and its build', [w['count'] for w in snap()['worlds']] == [STARTER + 1]
                      and page.evaluate("Object.keys(localStorage).filter((k) => k.startsWith('sq:brick-lab:world:v1:luis:')).length") == 1)
                check('Back on the menu leaves Brick Lab', page.evaluate('SQPlatform.triggerBack()') is True)
                page.wait_for_function("!document.querySelector('#stage .sqbl-app')")
                check('Stage cleaned on Back', page.locator('#stage .sqbl-host').count() == 0)
                check('Build saved per kid, in its world', len(world_build(page, 'luis', 'pieces')) == STARTER + 1)
                check('Reopen restores the build', page.evaluate("SummerQuest.openGame('bricklab')")['ok'])
                enter_world(page)
                check('The world comes back as it was left', len(snap()['pieces']) == STARTER + 1)
                lab_slices_09_11(page, snap, check, out)
                leave_lab(page)

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
                page.wait_for_function(f"window.SQGames && SQGames.get('bricklab') && {SNAP} && {SNAP}.menu")
                check('His old single build is his world 1, the old save left in place', [w['count'] for w in snap()['worlds']] == [3]
                      and page.evaluate("localStorage.getItem('sq:brick-lab:v1:lucien')") is not None)
                page.screenshot(path=str(out / 'menu-pre-reader.png'))
                enter_world(page)
                check('Pre-reader UI is icon-first', page.evaluate(SNAP + '.preReader') and page.locator('.sqbl-app.is-pre-reader').count() == 1
                      and 'Build' not in page.locator('.sqbl-mode-toggle').inner_text())
                ys = {p['id']: (p['x'], p['y'], p['z']) for p in snap()['pieces']}
                check('Each kid has their own build, an old save re-settled to brick proportions',
                      ys == {'a': (1, 0.6, 1), 'b': (1, 1.4, 1), 'c': (-1.5, 0.6, 3.5)})
                page.wait_for_timeout(400)
                check('Re-settled save is stored with the new grid', world_build(page, 'lucien', 'grid') == 2)
                page.screenshot(path=str(out / 'pre-reader.png'))
                page.evaluate('SQPlatform.triggerBack()')

                # Slice 13: a 4 GB tablet gets the reduced tier and still builds.
                weak = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
                weak.add_init_script("Object.defineProperty(Navigator.prototype, 'deviceMemory', {get: () => 4})")
                wp = weak.new_page()
                wp.set_viewport_size({'width': 1280, 'height': 800})
                wp.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
                wp.on('console', console)
                wp.goto(base + '/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](wp)
                RECOVERY['wait_screen'](wp, 'hub')
                check('Low-memory tablet opens Brick Lab', wp.evaluate("SummerQuest.openGame('bricklab')")['ok'])
                enter_world(wp)
                wp.wait_for_timeout(400)
                r = wp.evaluate(SNAP)['render']
                check(f'Reduced tier: studs painted, under 60k triangles {r}', r['quality'] == 'reduced'
                      and r['studs'] == 'painted' and r['triangles'] < 60000)
                n0 = len(wp.evaluate(SNAP)['pieces'])
                pick(wp, 'bricks')
                wp.locator('.sqbl-part[data-part="brick_2x2"]').click()
                wb = wp.locator('.sqbl-stage canvas').bounding_box()
                wp.mouse.click(wb['x'] + wb['width'] * 0.5, wb['y'] + wb['height'] * 0.62)
                wp.wait_for_timeout(150)
                check('Reduced tier still places a piece', len(wp.evaluate(SNAP)['pieces']) == n0 + 1)
                wp.screenshot(path=str(out / 'reduced.png'))
                wp.evaluate('SQPlatform.triggerBack()')
                weak.close()

                # Slice 14: a standard-tier tablet that can't keep up steps down quietly while the view moves.
                slow = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
                sp = slow.new_page()
                sp.set_viewport_size({'width': 1280, 'height': 800})
                sp.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
                sp.on('console', console)
                sp.goto(base + '/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](sp)
                RECOVERY['wait_screen'](sp, 'hub')
                sp.evaluate("SummerQuest.openGame('bricklab')")
                enter_world(sp)
                r = sp.evaluate(SNAP)['render']
                check('Standard tier opens with full detail', r['quality'] == 'standard' and r['studs'] == 'mesh'
                      and r['shadows'] and r['level'] == 0)
                # Every animation frame now costs 45 ms: a GPU that can't keep up.
                sp.evaluate("""(() => { const raf = window.requestAnimationFrame.bind(window);
                  window.requestAnimationFrame = (cb) => raf((t) => { const end = performance.now() + 45; while (performance.now() < end); cb(t); }); })()""")
                sb = sp.locator('.sqbl-stage canvas').bounding_box()
                size0 = (round(sb['width']), round(sb['height']))
                sp.mouse.move(sb['x'] + 300, sb['y'] + 420)
                sp.mouse.down()
                for step in range(400):
                    sp.mouse.move(sb['x'] + 300 + (step % 120) * 3, sb['y'] + 420)
                    if step % 20 == 0 and sp.evaluate(SNAP)['render']['level'] >= 3:
                        break
                sp.mouse.up()
                r = sp.evaluate(SNAP)['render']
                sb = sp.locator('.sqbl-stage canvas').bounding_box()
                check(f'A slow standard tablet steps down: painted studs, then no shadows {r}', r['level'] == 3
                      and r['studs'] == 'painted' and not r['shadows'] and r['pixelRatio'] == 1
                      and (round(sb['width']), round(sb['height'])) == size0)
                n0 = len(sp.evaluate(SNAP)['pieces'])
                pick(sp, 'plates')
                sp.locator('.sqbl-part[data-part="plate_2x2"]').click()
                sp.mouse.click(sb['x'] + sb['width'] * 0.5, sb['y'] + sb['height'] * 0.62)
                sp.wait_for_timeout(300)
                check('Stepped-down lab still places a piece', len(sp.evaluate(SNAP)['pieces']) == n0 + 1)
                sp.screenshot(path=str(out / 'stepped-down.png'))
                sp.evaluate('SQPlatform.triggerBack()')
                slow.close()

                # Multiplayer plan slice 05: building together on a pretend home wifi.
                lab_together(browser, base, report, console, check, out)

                # Slice 12 fix: on a short touch tablet a finger scrolls the category list (it must not pick
                # the category it started on), and every category, Rails included, can be reached.
                touch = browser.new_context(viewport={'width': 800, 'height': 480}, has_touch=True, service_workers='block')
                touch.add_init_script("(() => { if (localStorage.getItem('sq:recoveryFixture')) return; for (const [k, v] of Object.entries(%s)) localStorage.setItem(k, v); localStorage.setItem('sq:recoveryFixture', '1'); })();"
                                      % json.dumps(RECOVERY['saved_fixture']('hub')))
                tp = touch.new_page()
                tp.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
                tp.on('console', console)
                tp.goto(base + '/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](tp)
                RECOVERY['wait_screen'](tp, 'hub')
                tp.evaluate("SummerQuest.openGame('bricklab')")
                enter_world(tp)
                lst = tp.locator('.sqbl-category-list')
                lb = lst.bounding_box()
                check('A short rail shows there is more to scroll', 'has-more' in lst.get_attribute('class')
                      and lb['y'] + lb['height'] <= tp.locator('.sqbl-colors').bounding_box()['y'])
                cdp = touch.new_cdp_session(tp)
                fx, fy = lb['x'] + lb['width'] / 2, lb['y'] + lb['height'] * 0.8
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': fx, 'y': fy}]})
                for i in range(1, 16):
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': fx, 'y': fy - i * 8}]})
                    tp.wait_for_timeout(16)
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                tp.wait_for_timeout(200)
                check('A finger scrolls the category list without picking a category',
                      tp.evaluate(SNAP)['tray']['view'] == 'categories' and lst.evaluate('e => e.scrollTop') > 0)
                for cat in ('rails', 'structure', 'nature', 'bricks'):
                    pick(tp, cat)
                    if tp.evaluate(SNAP)['tray']['category'] != cat:
                        break
                check('Every category is reachable on a short tablet', tp.evaluate(SNAP)['tray']['category'] == 'bricks')
                tp.screenshot(path=str(out / 'short-touch.png'))
                tp.set_viewport_size({'width': 1024, 'height': 600})
                tp.locator('.sqbl-rail-back').click()
                tp.wait_for_timeout(200)
                check('At 1024×600 all eight categories fit above the colours',
                      lst.evaluate('e => e.scrollHeight <= e.clientHeight') and 'has-more' not in lst.get_attribute('class'))
                tp.evaluate('SQPlatform.triggerBack()')
                touch.close()
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
