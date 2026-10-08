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
Catalog plan (2026-10-05): twenty categories in build order, every part arms in < 50 ms and gets its
real-part icon, a minifig rides a horse and wears a helmet, 21 colours slide sideways in three rows.
Kid camera (2026-10-05): one finger slides the map with the ground staying under it, ↺ ↻ turn 45°, + −
zoom with the tilt following, two fingers pinch and twist.
Multiplayer plan slice 08: part icons are the real part, in the picked colour, drawn on the lab's own canvas.
Multiplayer plan slice 02: every change goes through the op sequencer (placed pieces carry `by`).
Multiplayer plan slice 05: on a pretend home wifi (in-page loopback), a sibling joins the open world, builds,
undoes and leaves; then this tablet joins a sibling's world, builds in it and is sent home when it closes.
Multiplayer plan slice 06: another app version is turned away, an app pause takes the hosted world off the
wifi (and back on resume), and a guest whose host vanishes waits calmly, then rejoins when it is back.
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
    lab.device = wifi.device();
    lab.together = new BrickTogether(lab, lan.createLanSession(lab.device), kid);
    return lab;
  };
  window.__sqSib = { wifi, lan, share, rules, fake, lili: fake('lili') };
  return true; }"""


def pick(page, category):
    """Open a category from the left rail (slice 12): Back to the list first if a parts view is open."""
    back = page.locator('.sqbl-rail-back')
    if back.is_visible():
        back.click()
    page.locator(f'.sqbl-category[data-category="{category}"]').click()


# Catalog plan (docs/plans/2026-10-05-brick-catalog/ C4, A4): shape categories, then the world.
CATEGORIES = ('bricks', 'plates', 'tiles', 'slopes', 'round', 'structure', 'doors', 'wheels', 'vehicles', 'connectors',
              'rails', 'nature', 'scenery', 'figures', 'animals', 'accessories', 'home', 'castle', 'pirates', 'space')

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
    found = set(snap()['tray']['parts'])
    check('Search reads 2x4 as 2×4', {'brick_2x4', 'plate_2x4', 'tile_2x4', 'frame_2x4', 'log_2x4', 'table'} <= found
          and 'brick_2x2' not in found)
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
    check('A star saves the part, and the category shows no pinned sections', s['tray']['favorites'] == ['brick_1x3']
          and s['tray']['category'] == 'bricks' and page.locator('.sqbl-tray-sep').count() == 0)
    app = page.locator('.sqbl-app').bounding_box()
    check('A long parts list scrolls inside the rail instead of widening the app', page.locator('.sqbl-parts').evaluate('e => e.scrollHeight > e.clientHeight')
          and app['x'] + app['width'] <= page.viewport_size['width'] + 1
          and page.locator('.sqbl-save-btn').bounding_box()['x'] + page.locator('.sqbl-save-btn').bounding_box()['width'] <= app['x'] + app['width'])
    check('Favourites and recents are saved per kid', page.evaluate(
          "JSON.parse(localStorage.getItem('sq:brick-lab:prefs:v1:luis')).favorites") == ['brick_1x3'])
    # Assemblies plan slice 01 (A1): Favourites ⭐ = starred first, then recents (newest first, at most 12), each part once.
    pick(page, 'favorites')
    s = snap()
    want = s['tray']['favorites'] + [r for r in s['tray']['recents'] if r not in s['tray']['favorites']]
    check('Favourites lists the starred part first, then recents, each once', s['tray']['parts'] == want
          and want[0] == 'brick_1x3' and len(set(want)) == len(want) and len(s['tray']['recents']) >= 2
          and s['tray']['count'] == len(want) and s['tray']['category'] == 'favorites')
    check('…under a ★ header and a 🕘 header, with the rail and view unchanged', page.locator('.sqbl-tray-sep[data-section="favorites"]').count() == 1
          and page.locator('.sqbl-tray-sep[data-section="recents"]').count() == 1
          and page.locator('.sqbl-stage canvas').bounding_box() == canvas0)
    check('Recents keep the newest placed part first', s['tray']['recents'][0] == 'rail_curve_90' and len(s['tray']['recents']) <= 12)
    page.locator('.sqbl-fav[data-fav="brick_1x3"]').first.click()
    check('Star again removes it', snap()['tray']['favorites'] == [] and 'brick_1x3' not in snap()['tray']['parts'])
    page.screenshot(path=str(out / 'library.png'))


# More-parts plan (docs/plans/2026-10-05-brick-lab-more-parts/), by slice.
MORE_PARTS = ('plate_1x1', 'plate_1x3', 'plate_4x4', 'plate_round_2x2', 'slope_1x1', 'slope_1x2', 'peak_1x2', 'wheel_large',
              'slope_corner_2x2', 'slope_inv_2x2', 'frame_2x4', 'brace_1x2', 'window_1x2',
              'rock', 'mushroom', 'log_2x4', 'crate_2x2', 'barrel', 'fence_post', 'railing_1x2',
              # Parts-survey plan (docs/plans/2026-10-05-brick-lab-parts-survey/) slice 01: tiles.
              'tile_1x1', 'tile_1x2', 'tile_1x3', 'tile_1x4', 'tile_1x6', 'tile_1x8', 'tile_2x2', 'tile_2x3', 'tile_2x4',
              'tile_grille_1x2', 'tile_round_1x1', 'tile_round_2x2', 'tile_quarter_1x1',
              # Parts-survey slice 02: plates.
              'plate_1x6', 'plate_1x8', 'plate_2x3', 'plate_2x8', 'plate_4x6', 'plate_round_1x1', 'plate_rounded_1x2',
              'plate_corner_2x2', 'plate_wedge_2x2',
              # Parts-survey slice 03: bricks and slopes.
              'brick_1x6', 'pillar_1x1x3', 'brick_round_1x1', 'brick_round_2x2', 'cone_1x1',
              'slope_30_1x2', 'slope_inv_1x2', 'slope_curved_2x2', 'slope_curved_1x2',
              # Parts-survey slice 04: arch, door, big window, leaves.
              'arch_1x4', 'door_1x4x6', 'window_1x4x3', 'leaves')
# Counts as the catalog plan left them (round parts and doors moved to their own categories, A4).
MORE_COUNTS = {'bricks': 16, 'plates': 19, 'tiles': 13, 'slopes': 15, 'round': 12, 'wheels': 4, 'structure': 11, 'doors': 6,
               'nature': 17, 'scenery': 5}
FIXED_ICONS = ('rock', 'mushroom', 'log_2x4', 'leaves')
DOOR_KNOB = '#3d4246'
ICON_SRC = "(id) => { const img = document.querySelector('.sqbl-part[data-part=\"' + id + '\"] .sqbl-part-preview img'); return img ? img.src : null; }"
SEEN = {}
# Parts a brick is dropped on, with half their height: it must land on top (D3, amended: anything stacks).
STACK_ON = (('wheel_large', 0.8), ('plate_round_2x2', 0.2), ('frame_2x4', 0.6), ('brace_1x2', 0.6), ('window_1x2', 1.2),
            ('fence_post', 2.4), ('railing_1x2', 0.6), ('rock', 0.5), ('tile_2x4', 0.2), ('tile_round_2x2', 0.2),
            ('plate_rounded_1x2', 0.2), ('plate_corner_2x2', 0.2), ('plate_wedge_2x2', 0.2),
            ('cone_1x1', 0.6), ('slope_curved_2x2', 0.4), ('brick_round_2x2', 0.6),
            ('arch_1x4', 0.6), ('door_1x4x6', 3.6), ('window_1x4x3', 1.8), ('leaves', 0.4))
WINDOW_GLASS = '#9fd3ee'


def lab_more_parts(page, snap, check, out):
    """More-parts plan slices 01-03: the new parts arm fast with real-part icons, the categories hold
    what they should, a brick lands on top of a tree and of each STACK_ON part, recolouring a
    window changes its frame but never its pane, rock / mushroom / log icons keep their own colours
    while crate and barrel take the picked one (D4), and scenery stacks: a mushroom on a brick, a brick
    on the mushroom, a crate on a log, a barrel on the crate."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(150)

    def arm(part):
        for c in CATEGORIES:
            pick(page, c)
            if page.locator(f'.sqbl-part[data-part="{part}"]').count():
                break
        page.locator(f'.sqbl-part[data-part="{part}"]').first.scroll_into_view_if_needed()
        return page.evaluate(f"(() => {{ const t = performance.now(); document.querySelector('.sqbl-part[data-part=\"{part}\"]').click(); return performance.now() - t; }})()")

    def undo():
        page.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
        page.wait_for_timeout(150)

    def selected():
        s = snap()
        found = [p for p in s['pieces'] if p['id'] == s['selectedId']]
        assert found, 'no piece selected'
        return found[0]

    def drop_on(part, base):
        """Arm a part and tap the base piece: the new piece (it is selected)."""
        arm(part)
        tap(base['screen']['x'], base['screen']['y'])
        return selected()

    def stack_on(base):
        return drop_on('brick_1x1', base)

    def place(part):
        arm(part)
        tap(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.62)
        return selected()

    pieces0 = len(snap()['pieces'])
    box = page.locator('.sqbl-stage canvas').bounding_box()
    slow, plain = [], []
    for part in MORE_PARTS:
        ms = arm(part)
        page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.55)
        page.wait_for_timeout(900)
        if ms >= 50:
            slow.append((part, round(ms, 1)))
        if not any(k == part or k.startswith(part + ':') for k in snap()['tray']['icons']):
            plain.append(part)
    check(f'More-parts: each new part arms and builds in < 50 ms {slow}', not slow)
    check(f'More-parts: each new part has a real-part icon {plain}', not plain)
    counts = {}
    for c in MORE_COUNTS:
        pick(page, c)
        counts[c] = snap()['tray']['count']
        page.wait_for_timeout(900)
        page.screenshot(path=str(out / f'more-parts-{c}.png'), clip=page.locator('.sqbl-left-rail').bounding_box())
    check(f'More-parts: category counts {counts}', counts == MORE_COUNTS)
    # Parts-survey slice 05: the new parts are found by name (EN + 中文) and by size.
    page.locator('.sqbl-rail-find').click()
    found = {}
    for word, want in (('tile', 'tile_1x8'), ('光面板', 'tile_quarter_1x1'), ('1x8', 'plate_1x8'), ('門', 'door_1x4x6')):
        page.locator('.sqbl-search input').fill(word)
        page.wait_for_timeout(150)
        found[word] = want in snap()['tray']['parts']
    page.locator('.sqbl-rail-find').click()
    check(f'Search finds the new parts: tile, 光面板, 1x8, 門 {found}', all(found.values()))
    page.locator('.sqbl-color[data-color="blue"]').click()
    pick(page, 'scenery')
    page.wait_for_timeout(900)
    keys = snap()['tray']['icons']
    pick(page, 'nature')
    page.wait_for_timeout(900)
    keys = keys + snap()['tray']['icons']
    check(f'Rock, mushroom and log icons keep their own colours; crate and barrel take the picked one {sorted(keys)}',
          all(k in keys for k in FIXED_ICONS) and 'crate_2x2:blue' in keys and 'barrel:blue' in keys)
    SEEN['rock'] = page.evaluate(ICON_SRC, 'rock')
    page.locator('.sqbl-color[data-color="red"]').click()

    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    s = snap()
    tree = next(p for p in s['pieces'] if p['partId'] == 'tree_small' and (p['x'], p['z']) == (-6, 4))
    check('A brick dropped on a tree lands on top of it', abs(stack_on(tree)['y'] - (tree['y'] + 2 + 0.6)) < 0.01)
    undo()

    for part, half in STACK_ON:
        base = place(part)
        check(f'{part} places on the plate', base['partId'] == part)
        steps = 2
        if part in ('window_1x2', 'window_1x4x3', 'door_1x4x6'):
            page.locator('.sqbl-color[data-color="green"]').click()
            page.wait_for_timeout(200)
            colors = snap()['selectedColors']
            kept = DOOR_KNOB if part.startswith('door') else WINDOW_GLASS
            check(f'Recolouring {part} to green changes its frame, not its {"knob" if part.startswith("door") else "pane"} {colors}',
                  '#237841' in colors and kept in colors)
            steps = 3
        check(f'A brick dropped on {part} lands on top of it', abs(stack_on(base)['y'] - (base['y'] + half + 0.6)) < 0.01)
        page.screenshot(path=str(out / f'stack-{part}.png'))
        for _ in range(steps):
            undo()
    page.locator('.sqbl-color[data-color="red"]').click()

    # Parts-survey D4: an 8-long tile turned 90° still lands on the stud grid (8 wide: whole x, 1 deep: half z).
    long = place('tile_1x8')
    page.locator('.sqbl-app [data-action="rotate"]').click()
    page.wait_for_timeout(200)
    long = selected()
    check(f'A 1×8 tile turned 90° sits on the stud grid {long["x"], long["z"], long["rotation"]}',
          long['rotation'] in (90, 270) and long['x'] % 1 == 0 and long['z'] % 1 == 0.5)
    undo()
    undo()

    # A 2×8 plate placed past the village's west end, then turned, stays on the baseplate (D4; the
    # snap clamps every footprint to the plate, so the 8-long side never hangs over).
    arm('plate_2x8')
    s = snap()
    far = min((p for p in s['pieces'] if 'screen' in p), key=lambda p: p['x'])
    tap(far['screen']['x'] - 60, far['screen']['y'])
    edge = selected()
    page.locator('.sqbl-app [data-action="rotate"]').click()
    page.wait_for_timeout(200)
    turned = selected()
    inside = lambda p, w, d: abs(p['x']) + w / 2 <= 32 and abs(p['z']) + d / 2 <= 32
    check(f'A 2×8 plate placed and turned stays on the baseplate {edge["x"], edge["z"], turned["x"], turned["z"]}',
          edge['partId'] == 'plate_2x8' and inside(edge, 2, 8) and inside(turned, 8, 2))
    undo()
    undo()

    brick = place('brick_2x4')
    pillar = drop_on('pillar_1x1x3', brick)
    check('A pillar on a 2×4 brick stands three bricks tall on it', abs(pillar['y'] - (brick['y'] + 0.6 + 1.8)) < 0.01)
    undo()
    mushroom = drop_on('mushroom', brick)
    check('A mushroom dropped on a 2×4 brick sits on the brick', abs(mushroom['y'] - (brick['y'] + 0.6 + 0.6)) < 0.01)
    check('…and a brick dropped on the mushroom lands on top of it', abs(stack_on(mushroom)['y'] - (mushroom['y'] + 1.2)) < 0.01)
    for _ in range(3):
        undo()
    log = place('log_2x4')
    crate = drop_on('crate_2x2', log)
    check('A crate dropped on a log stacks on the log', abs(crate['y'] - (log['y'] + 1.2)) < 0.01)
    barrel = drop_on('barrel', crate)
    check('A barrel dropped on a crate stacks on the crate', abs(barrel['y'] - (crate['y'] + 1.2)) < 0.01)
    page.screenshot(path=str(out / 'stack-scenery.png'))
    for _ in range(3):
        undo()
    check('Undo leaves the world as it was', len(snap()['pieces']) == pieces0)


def catalog_checks(page, snap, check, out):
    """Catalog plan (docs/plans/2026-10-05-brick-catalog/): 20 categories in build order; every part arms in
    < 50 ms and gets its real-part icon; an animal comes in its own colours; a sitting minifig rides a horse
    and a helmet drops over its head (C5); 21 colours slide sideways in three rows and paint a piece gold."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(150)

    def undo():
        page.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
        page.wait_for_timeout(150)

    def selected():
        s = snap()
        return next(p for p in s['pieces'] if p['id'] == s['selectedId'])

    def close_info():
        page.locator('.sqbl-tray-title').click()

    pieces0 = len(snap()['pieces'])
    box = page.locator('.sqbl-stage canvas').bounding_box()
    check('Favourites first, then twenty categories in build order', page.evaluate(
          "Array.from(document.querySelectorAll('.sqbl-category'), e => e.dataset.category)") == ['favorites'] + list(CATEGORIES))
    slow, bare, seen = [], [], set()
    for cat in CATEGORIES:
        pick(page, cat)
        ids = [p for p in snap()['tray']['parts'] if p not in seen]
        for part in ids:
            seen.add(part)
            page.locator(f'.sqbl-part[data-part="{part}"]').first.scroll_into_view_if_needed()
            ms = page.evaluate(f"(() => {{ const t = performance.now(); document.querySelector('.sqbl-part[data-part=\"{part}\"]').click(); return performance.now() - t; }})()")
            if ms >= 50:
                slow.append((part, round(ms, 1)))
        close_info()
        # Icons are drawn for parts on screen: walk the list down, letting each screenful finish.
        parts = page.locator('.sqbl-parts')
        parts.evaluate('e => { e.scrollTop = 0; }')
        keys = set()
        while True:
            page.wait_for_function(SNAP + '.tray.iconsPending === 0', timeout=60000)
            page.wait_for_timeout(120)
            keys |= set(snap()['tray']['icons'])
            if parts.evaluate('e => e.scrollTop + e.clientHeight >= e.scrollHeight - 2'):
                break
            parts.evaluate('e => { e.scrollTop += e.clientHeight; }')
            page.wait_for_timeout(120)
        missing = [p for p in snap()['tray']['parts'] if not any(k == p or k.startswith(p + ':') for k in keys)]
        if missing:
            bare.append((cat, missing))
        parts.evaluate('e => { e.scrollTop = 0; }')
        page.wait_for_timeout(300)
        page.screenshot(path=str(out / f'catalog-{cat}.png'), clip=page.locator('.sqbl-left-rail').bounding_box())
    check(f'Every part in every category gets its real-part icon {bare}', not bare)
    check(f'All {len(seen)} parts arm and build their geometry in < 50 ms {slow}', len(seen) == 243 and not slow)

    info = page.locator('.sqbl-info')
    pick(page, 'animals')
    page.locator('.sqbl-part[data-part="horse"]').click()
    check('An animal comes in its own colours (info card, EN + 中文)', info.is_visible() and '馬' in info.inner_text()
          and 'own colours' in info.inner_text())
    close_info()

    # Stacking (C5): a sitting minifig rides the horse, a helmet drops over its head.
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    page.locator('.sqbl-part[data-part="horse"]').click()
    close_info()
    tap(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.62)
    horse = selected()
    check('A horse places', horse['partId'] == 'horse')
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_sitting"]').click()
    close_info()
    tap(horse['screen']['x'], horse['screen']['y'])
    rider = selected()
    saddle = horse['y'] - 2.0 + 2.65
    check(f'A sitting minifig rides on the saddle {rider["y"]}', rider['partId'] == 'fig_sitting' and abs(rider['y'] - 1.4 - saddle) < 0.02)
    pick(page, 'accessories')
    page.locator('.sqbl-part[data-part="hat_knight"]').click()
    close_info()
    tap(rider['screen']['x'], rider['screen']['y'])
    helmet = selected()
    check(f'A helmet drops over the rider\'s head {helmet["y"]}', helmet['partId'] == 'hat_knight'
          and abs(helmet['y'] - 0.8 - (rider['y'] - 1.4 + 2.75 - 0.95)) < 0.02)
    page.wait_for_timeout(300)
    page.screenshot(path=str(out / 'catalog-rider.png'))
    for _ in range(3):
        undo()

    # Colours (C3): 21 in three rows that slide sideways; a selected piece takes gold.
    colors = page.locator('.sqbl-colors')
    rows = page.evaluate("new Set(Array.from(document.querySelectorAll('.sqbl-color'), e => Math.round(e.getBoundingClientRect().top))).size")
    check('21 colours in three rows that slide sideways', page.locator('.sqbl-color').count() == 21 and rows == 3
          and colors.evaluate('e => e.scrollWidth > e.clientWidth') and 'has-more-x' in colors.get_attribute('class'))
    pick(page, 'bricks')
    page.locator('.sqbl-part[data-part="brick_2x4"]').click()
    close_info()
    tap(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.62)
    page.locator('.sqbl-color[data-color="gold"]').click()
    page.wait_for_timeout(200)
    check('A selected piece can be painted gold, and the swatch slides into view',
          selected()['colorId'] == 'gold' and colors.evaluate('e => e.scrollLeft > 0'))
    page.locator('.sqbl-color[data-color="red"]').click()
    for _ in range(3):
        undo()
    check('Catalog checks leave the world as it was', len(snap()['pieces']) == pieces0)


# More-parts plan slice 04: one picture of every part, and the cost of the new parts.
WEBGL1_ONLY = """(() => { const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, options) { return kind === 'webgl2' ? null : get.call(this, kind, options); }; })()"""
SHEET_PAGE = """<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;font:13px/1.25 system-ui,'Microsoft JhengHei',sans-serif;background:#f6f8fb;color:#1d2b3a;width:1180px}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 16px;color:#5b6b7b}h2{font-size:15px;margin:18px 0 8px}
.grid{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.cell{background:#fff;border:1px solid #dde4ec;border-radius:12px;padding:8px 6px;text-align:center}
.cell img{width:96px;height:96px;object-fit:contain;display:block;margin:0 auto 4px}.cell small{display:block;color:#6b7a89}
.cell.none{background:#fde8e8}</style><h1>Brick Lab parts · 積木零件 (TITLE)</h1><p>NOTE</p>BODY"""


class SheetDone(Exception):
    """--sheet ran its own checks: skip the main suite."""


def pose_checks(page, snap, check, out):
    """Moving parts slice 01 (docs/plans/2026-10-05-brick-lab-moving-parts/): a posed minifig keeps its
    spot and turns its arm; Sit lands on a chair's seat and standing up returns to the 2×1 spot; Undo
    takes a pose back; a pose is saved with the world."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(150)

    def selected():
        s = snap()
        return next(p for p in s['pieces'] if p['id'] == s['selectedId'])

    def pose(pid, value):
        return page.evaluate("([id, pose]) => SQGames.get('bricklab').pose(id, pose)", [pid, value])

    def close_up(name):
        # Zoom in on the selected piece (the wheel keeps the point under the cursor), shoot, then back home.
        p = selected()['screen']
        page.mouse.move(p['x'], p['y'])
        for _ in range(3):
            page.mouse.wheel(0, -380)
            page.wait_for_timeout(60)
        page.wait_for_timeout(300)
        page.screenshot(path=str(out / name))
        page.locator('.sqbl-app [data-action="home-view"]').click()
        page.wait_for_timeout(900)

    box = page.locator('.sqbl-stage canvas').bounding_box()
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_boy"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.35, box['y'] + box['height'] * 0.62)
    boy = selected()
    check('A minifig places', boy['partId'] == 'fig_boy')
    page.wait_for_timeout(2300)  # placing selects it: let its 2 s tap reaction (alive on tap) settle first
    check('Wave turns the right arm up and keeps the spot', pose(boy['id'], {'p': 'wave'})
          and selected()['pose'] == {'p': 'wave'} and snap()['poseAngles'].get('armR') == -135
          and (selected()['x'], selected()['y'], selected()['z']) == (boy['x'], boy['y'], boy['z']))
    close_up('pose-wave.png')
    page.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
    page.wait_for_timeout(200)
    check('Undo takes the pose back', 'pose' not in next(p for p in snap()['pieces'] if p['id'] == boy['id']))

    pick(page, 'home')
    page.locator('.sqbl-part[data-part="chair"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.6, box['y'] + box['height'] * 0.62)
    chair = selected()
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_boy"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(chair['screen']['x'], chair['screen']['y'])
    sitter = selected()
    check('Sit lands the seat on the chair\'s top', pose(sitter['id'], {'p': 'sit'}) and abs(
          selected()['y'] - (chair['y'] - 1.1 + 1.0 + 1.6)) < 0.02 and snap()['poseAngles'].get('legL') == -90)
    close_up('pose-sit-chair.png')
    check('Standing up returns to the 2×1 spot', pose(sitter['id'], None)
          and abs(selected()['z'] - sitter['z']) < 1e-6 and abs(selected()['x'] - sitter['x']) < 1e-6)
    pose(sitter['id'], {'p': 'sit'})
    page.wait_for_timeout(400)  # the save runs 180 ms after a change
    saved = next((p for p in world_build(page, 'luis', 'pieces') if p['id'] == sitter['id']), None)
    check('A pose is saved with the world', saved is not None and saved.get('pose') == {'p': 'sit'})


def focus_checks(page, snap, check, out):
    """Moving parts slice 02 (docs/plans/2026-10-05-brick-lab-moving-parts/): focus mode, the character
    editor. Pose shows on a figure only; focus frames the figure big and folds the rail; tapping a leg on
    the model picks it, a chip picks the arm; a turn is one step and Undo takes it back; a pose card sets both arms; one finger
    turns around the figure; Done gives the exact view back; Back leaves focus, not the world."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(150)

    def selected():
        s = snap()
        return next(p for p in s['pieces'] if p['id'] == s['selectedId'])

    def pose_tool():
        return page.locator('.sqbl-app [data-action="pose"]')

    def press(selector):
        page.locator(selector).first.click()
        page.wait_for_timeout(200)

    def stage():
        return page.locator('.sqbl-stage canvas').bounding_box()

    box = stage()
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    pick(page, 'bricks')
    page.locator('.sqbl-part[data-part="brick_2x2"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.25, box['y'] + box['height'] * 0.6)
    check('A brick has no Pose tool', selected()['partId'] == 'brick_2x2' and not pose_tool().is_visible())
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_boy"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.42, box['y'] + box['height'] * 0.6)
    fig = selected()
    check('A minifigure shows the Pose tool', fig['partId'] == 'fig_boy' and pose_tool().is_visible())
    before = snap()['view']
    pose_tool().dispatch_event('pointerdown')
    page.wait_for_timeout(700)
    s = snap()
    box = stage()
    rect = s['focus'] and s['focus']['rect']
    dock_top = page.locator('.sqbl-focus-dock').bounding_box()['y']
    check(f'Focus frames the figure big, above the pose dock, and folds the rail {rect}', s['focus'] and s['focus']['id'] == fig['id']
          and rect['bottom'] - rect['top'] >= box['height'] * 0.35 and rect['bottom'] <= dock_top + 4
          and not page.locator('.sqbl-left-rail').is_visible() and not s['toolsShown'])
    page.screenshot(path=str(out / 'focus-figure.png'))
    leg = s['focus']['joints']['legL']['screen']
    tap(leg['x'], leg['y'])
    check('Tapping a leg on the model picks it', snap()['focus']['joint'] == 'legL')
    press('.sqbl-focus [data-focus-joint="armR"]')
    check('The right-arm chip picks the arm (thin limbs are easier from the chips)', snap()['focus']['joint'] == 'armR')
    page.screenshot(path=str(out / 'focus-arm-picked.png'))
    press('.sqbl-focus [data-focus-act="cw"]')
    check('Turn moves the arm one step (45 degrees)', snap()['poseAngles'].get('armR') == 45)
    page.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
    page.wait_for_timeout(250)
    check('Undo takes that one step back, still in focus', snap()['poseAngles'].get('armR') == 0 and snap()['focus'] is not None)
    press('.sqbl-focus [data-focus-pose="cheer"]')
    a = snap()['poseAngles']
    check('The Cheer card raises both arms', a.get('armL') == -180 and a.get('armR') == -180)
    press('.sqbl-focus [data-focus-joint="head"]')
    check('A joint chip picks the head', snap()['focus']['joint'] == 'head')
    yaw = snap()['view']['yaw']
    cx, cy = box['x'] + box['width'] * 0.2, box['y'] + box['height'] * 0.4
    page.mouse.move(cx, cy)
    page.mouse.down()
    for i in range(1, 11):
        page.mouse.move(cx + 22 * i, cy)
        page.wait_for_timeout(16)
    page.mouse.up()
    page.wait_for_timeout(300)
    s = snap()
    r = s['focus']['rect']
    check(f'One finger turns the camera around the figure, which stays in frame {r}', abs(s['view']['yaw'] - yaw) > 0.5
          and r['left'] >= box['x'] and r['right'] <= box['x'] + box['width'] and s['focus']['joint'] == 'head')
    # Every focus control is big enough and not covered, at 1280x800 and 1024x600.
    controls = """() => Array.from(document.querySelectorAll('.sqbl-focus button, .sqbl-cam-btn')).filter((b) => b.getClientRects().length).map((b) => {
      const r = b.getBoundingClientRect(); const x = Math.min(r.right - 2, Math.max(r.left + 2, r.left + r.width / 2)); const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      return { w: r.width, h: r.height, hit: !!top && (b === top || b.contains(top)), on: x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight, name: b.textContent.trim().slice(0, 12) }; })"""
    for size in ((1280, 800), (1024, 600)):
        page.set_viewport_size({'width': size[0], 'height': size[1]})
        page.wait_for_timeout(500)
        found = page.evaluate(controls)
        bad = [c for c in found if c['on'] and (min(c['w'], c['h']) < 48 or not c['hit'])]
        check(f'{size[0]}x{size[1]}: every focus control is at least 48 px and unobstructed {bad}', found and not bad)
        if size == (1024, 600):
            page.screenshot(path=str(out / 'focus-1024x600.png'))
    page.set_viewport_size({'width': 1280, 'height': 800})
    page.wait_for_timeout(500)
    press('.sqbl-focus [data-focus-act="done"]')
    page.wait_for_timeout(700)
    s = snap()
    after = s['view']
    check('Done gives the exact view back and unfolds the rail', s['focus'] is None and page.locator('.sqbl-left-rail').is_visible()
          and all(abs(after[k] - before[k]) < 1e-3 for k in ('x', 'z', 'yaw', 'distance')) and not after.get('lift'))
    pose_tool().dispatch_event('pointerdown')
    page.wait_for_timeout(500)
    page.evaluate('SQPlatform.triggerBack()')
    page.wait_for_timeout(600)
    s = snap()
    check('Back leaves focus, not the world', s['focus'] is None and s['world'] and not s['menu'])


def animal_checks(page, snap, check, out):
    """Moving parts slice 03 (docs/plans/2026-10-05-brick-lab-moving-parts/): animals pose by body type.
    A dog takes each of its pose cards in focus mode; a rider stays on the saddle of a posed horse; the
    crocodile opens its mouth; then every animal's pose cards, side by side, in animal-poses.png."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(150)

    def selected():
        s = snap()
        return next(p for p in s['pieces'] if p['id'] == s['selectedId'])

    def place(part, x, y):
        page.locator(f'.sqbl-part[data-part="{part}"]').first.click()
        page.locator('.sqbl-tray-title').click()
        tap(x, y)
        return selected()

    def pose(pid, value):
        return page.evaluate("([id, pose]) => SQGames.get('bricklab').pose(id, pose)", [pid, value])

    def focus_in():
        page.locator('.sqbl-app [data-action="pose"]').dispatch_event('pointerdown')
        page.wait_for_timeout(600)

    def focus_out():
        page.locator('.sqbl-focus [data-focus-act="done"]').click()
        page.wait_for_timeout(600)

    box = page.locator('.sqbl-stage canvas').bounding_box()
    spot = (box['x'] + box['width'] * 0.62, box['y'] + box['height'] * 0.7)
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    pick(page, 'animals')
    dog = place('dog', *spot)
    check('A dog places and shows the Pose tool', dog['partId'] == 'dog' and page.locator('.sqbl-app [data-action="pose"]').is_visible())
    focus_in()
    cards = page.evaluate("Array.from(document.querySelectorAll('.sqbl-focus [data-focus-pose]'), (b) => b.dataset.focusPose)")
    chips = page.evaluate("Array.from(document.querySelectorAll('.sqbl-focus [data-focus-joint]'), (b) => b.dataset.focusJoint)")
    check(f'The dog gets the four-legged poses and chips {cards} {chips}', cards == ['stand', 'lookL', 'lookR', 'headUp', 'sniff', 'wag']
          and chips == ['head', 'head.nod', 'tail', 'legsF', 'legsB'])
    want = {'lookL': ('head', 45), 'lookR': ('head', -45), 'headUp': ('head.nod', -22.5), 'sniff': ('head.nod', 22.5), 'wag': ('tail', 45)}
    took = []
    for card in cards[1:] + ['stand']:
        page.locator(f'.sqbl-focus [data-focus-pose="{card}"]').click()
        page.wait_for_timeout(150)
        angles = snap()['poseAngles']
        joint, angle = want.get(card, ('head', 0))
        took.append(angles.get(joint) == angle and (card != 'stand' or 'pose' not in selected()))
    check(f'Each card poses the dog {took}', all(took))
    page.locator('.sqbl-focus [data-focus-pose="headUp"]').click()
    page.wait_for_timeout(300)
    page.screenshot(path=str(out / 'animal-dog-focus.png'))
    focus_out()

    horse = place('horse', box['x'] + box['width'] * 0.38, box['y'] + box['height'] * 0.7)
    pick(page, 'figures')
    rider = place('fig_sitting', horse['screen']['x'], horse['screen']['y'])
    pose(horse['id'], {'p': 'headUp'})
    s = snap()
    h2 = next(p for p in s['pieces'] if p['id'] == horse['id'])
    r2 = next(p for p in s['pieces'] if p['id'] == rider['id'])
    check('A rider stays on the saddle of a horse with its head up', h2.get('pose') == {'p': 'headUp'}
          and abs(h2['y'] - horse['y']) < 1e-6 and abs(r2['y'] - rider['y']) < 1e-6)
    pick(page, 'animals')
    croc = place('crocodile', *spot)
    pose(croc['id'], {'p': 'mouthOpen'})
    check('The crocodile opens its mouth', snap()['poseAngles'].get('jaw') == -30)

    # The sheet: every animal's pose cards (the animal itself in each pose), one row each.
    ids = page.evaluate("import('/js/brick-lab/brick-catalog.js').then((c) => c.PARTS.filter((p) => p.category === 'animals').map((p) => p.id))")
    rows = []
    for part in ids:
        placed = place(part, *spot)
        focus_in()
        try:
            page.wait_for_function("Array.from(document.querySelectorAll('.sqbl-focus .sqbl-pose-pic')).every((e) => e.querySelector('img'))", timeout=8000)
        except Exception:
            pass
        rows.append({'part': part, 'cards': page.evaluate("""Array.from(document.querySelectorAll('.sqbl-focus [data-focus-pose]'), (b) => ({
          name: b.getAttribute('aria-label'), src: (b.querySelector('img') || {}).src || '' }))""")})
        focus_out()
        page.locator('.sqbl-app [data-action="delete"]').dispatch_event('pointerdown')
        page.wait_for_timeout(150)
    check(f'Every animal has pose pictures ({len(rows)} animals)', len(rows) == 20 and all(len(r['cards']) >= 2 and all(c['src'] for c in r['cards']) for r in rows))
    html = '<body style="margin:12px;font:13px sans-serif;background:#fff"><table>' + ''.join(
        '<tr><th style="text-align:left;padding:6px 10px">' + r['part'] + '</th>' + ''.join(
            f'<td style="text-align:center;padding:4px 8px"><img src="{c["src"]}" style="width:168px;height:108px;object-fit:contain"><br>{c["name"]}</td>'
            for c in r['cards']) + '</tr>' for r in rows) + '</table></body>'
    sheet = page.context.new_page()
    sheet.set_content(html)
    sheet.wait_for_timeout(300)
    sheet.screenshot(path=str(out / 'animal-poses.png'), full_page=True)
    sheet.close()


def alive_checks(page, snap, check, out):
    """Moving parts slice 04 (docs/plans/2026-10-05-brick-lab-moving-parts/04-alive-on-tap.md): a tap that
    selects a figure makes it react for 2 s, then it settles back into its pose and the frames stop; a brick
    doesn't react; a cheering figure ends in its cheer."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(120)

    def selected():
        s = snap()
        return next(p for p in s['pieces'] if p['id'] == s['selectedId'])

    box = page.locator('.sqbl-stage canvas').bounding_box()
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    pick(page, 'figures')
    page.locator('.sqbl-part[data-part="fig_boy"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.55, box['y'] + box['height'] * 0.45)
    fig = selected()
    seen = []
    for _ in range(6):
        page.wait_for_timeout(180)
        seen.append(json.dumps(snap()['poseAngles'], sort_keys=True))
    check(f"Placing (selecting) a figure makes it react", fig['id'] in snap()['alive'] or len(set(seen)) > 1)
    check('Its joints move during the reaction', len(set(seen)) > 2)
    page.wait_for_timeout(2200)
    s = snap()
    f0 = s['render']['frames']
    page.wait_for_timeout(500)
    s2 = snap()
    check(f"After 2 s it is back at its pose and the frames stop {s2['poseAngles']} alive={s2['alive']} frames {f0}->{s2['render']['frames']}", not s2['alive'] and s2['render']['frames'] == f0
          and all(abs(v) < 1e-6 for v in s2['poseAngles'].values()))
    page.evaluate("([id, pose]) => SQGames.get('bricklab').pose(id, pose)", [fig['id'], {'p': 'cheer'}])
    page.wait_for_timeout(200)
    check('Posing the selected figure starts no reaction', not snap()['alive'])
    pick(page, 'bricks')
    page.locator('.sqbl-part[data-part="brick_2x2"]').first.click()
    page.locator('.sqbl-tray-title').click()
    tap(box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.45)
    check('A brick does not react', selected()['partId'] == 'brick_2x2' and not snap()['alive'])
    tap(fig['screen']['x'], fig['screen']['y'] - 10)
    s = snap()
    check('Tapping the figure again selects it and it reacts', s['selectedId'] == fig['id'] and fig['id'] in s['alive'])
    page.wait_for_timeout(700)
    p = selected()['screen']
    page.mouse.move(p['x'], p['y'])
    for _ in range(3):
        page.mouse.wheel(0, -380)
        page.wait_for_timeout(40)
    page.screenshot(path=str(out / 'alive-mid.png'))
    page.wait_for_timeout(2400)
    a = snap()['poseAngles']
    check(f'A cheering figure ends back in its cheer {a}', not snap()['alive'] and a.get('armL') == -180 and a.get('armR') == -180)
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)


def swing_checks(page, snap, check, out):
    """Moving parts M8 (2026-10-08): a tap on a door, window or gate opens it in about 300 ms and the next tap
    shuts it; the state is the saved pose (Undo puts it back), the box and footprint never change, and the frames
    stop when it settles."""
    def tap(x, y):
        page.mouse.click(x, y)
        page.wait_for_timeout(120)

    def piece(pid):
        return next(p for p in snap()['pieces'] if p['id'] == pid)

    box = page.locator('.sqbl-stage canvas').bounding_box()
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    spots = {'door_1x4x6': (0.42, 0.5), 'door_round': (0.62, 0.62), 'window_1x2': (0.35, 0.68), 'portcullis': (0.66, 0.38),
             'treasure_chest': (0.5, 0.75)}
    cats = {'portcullis': 'castle', 'treasure_chest': 'pirates'}
    opened = {'door_1x4x6': 90, 'door_round': 90, 'window_1x2': 90, 'portcullis': 180, 'treasure_chest': -105}
    for part_id, (fx, fy) in spots.items():
        pick(page, cats.get(part_id, 'doors'))
        page.locator(f'.sqbl-part[data-part="{part_id}"]').first.click()
        page.locator('.sqbl-tray-title').click()
        tap(box['x'] + box['width'] * fx, box['y'] + box['height'] * fy)
        s = snap()
        pid = s['selectedId']
        p0 = piece(pid)
        check(f'{part_id}: placing it leaves it shut {s["poseAngles"]}', p0['partId'] == part_id and not p0.get('pose')
              and abs(s['poseAngles'].get('swing', 0)) < 1e-6)
        undo0 = s['undo']
        tap(p0['screen']['x'], p0['screen']['y'])
        mid = snap()
        page.wait_for_timeout(450)
        s = snap()
        p1 = piece(pid)
        check(f'{part_id}: a tap swings it open {s["poseAngles"]} (swinging {pid in mid["swinging"]})', pid in mid['swinging']
              and s['poseAngles'].get('swing') == opened[part_id] and p1.get('pose') == {'p': 'open'} and not s['swinging']
              and s['selectedId'] == pid and s['undo'] == undo0 + 1)
        check(f'{part_id}: opening moves nothing (same spot, same turn)', all(p1[k] == p0[k] for k in ('x', 'y', 'z', 'rotation')))
        if part_id == 'door_1x4x6':
            check('Its hint says a tap opens and shuts it (EN + 中文)', '打開' in page.locator('.sqbl-stage-hint').inner_text())
            page.screenshot(path=str(out / 'swing-door-open.png'))
            f0 = snap()['render']['frames']
            page.wait_for_timeout(500)
            check('Settled: no more frames', snap()['render']['frames'] == f0)
        tap(p1['screenTop']['x'], p1['screenTop']['y'])  # an open door's middle is the empty doorway
        page.wait_for_timeout(450)
        s = snap()
        check(f'{part_id}: the next tap shuts it {s["poseAngles"]}', abs(s['poseAngles'].get('swing', 0)) < 1e-6
              and not piece(pid).get('pose') and s['selectedId'] == pid)
        page.locator('.sqbl-app [data-action="undo"]').click()
        page.wait_for_timeout(450)
        check(f'{part_id}: Undo opens it again', piece(pid).get('pose') == {'p': 'open'})
    page.screenshot(path=str(out / 'swing-open.png'))
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)


def assembly_checks(page, snap, check, out):
    """Assemblies plan slice 03 (docs/plans/2026-10-06-brick-lab-assemblies/): the Assembly tile opens Bricks,
    Plates and Tiles only; the menu card's steppers count blocks and stop at 64; a drag from the card moves one
    ghost and letting go places every block as ordinary pieces; one Undo takes them all back; a bridge deck that
    would cut into a tower places nothing; the card never resizes the view or the rail; settings survive a reload."""
    page.evaluate('SQPlatform.triggerBack()')
    page.wait_for_function(f"{SNAP}.menu")
    page.locator('.sqbl-world-new').click()
    page.wait_for_function(f"{SNAP} && !{SNAP}.menu && {SNAP}.world")
    page.locator('.sqbl-app [data-action="home-view"]').click()
    page.wait_for_timeout(900)
    canvas0 = page.locator('.sqbl-stage canvas').bounding_box()
    rail0 = page.locator('.sqbl-left-rail').bounding_box()['width']
    box = canvas0
    spot = (box['x'] + box['width'] * 0.6, box['y'] + box['height'] * 0.45)

    def lead(cat):
        pick(page, cat)
        return page.locator('.sqbl-parts .sqbl-part').first.get_attribute('data-assembly') is not None
    check('The Assembly tile is first in Bricks, Plates and Tiles', all(lead(cat) for cat in ('bricks', 'plates', 'tiles')))
    pick(page, 'doors')
    absent = page.locator('[data-assembly]').count() == 0
    pick(page, 'favorites')
    absent = absent and page.locator('[data-assembly]').count() == 0
    page.locator('.sqbl-rail-find').click()
    page.locator('.sqbl-search input').fill('brick')
    absent = absent and page.locator('[data-assembly]').count() == 0 and len(snap()['tray']['parts']) > 0
    page.locator('.sqbl-rail-find').click()
    check('…and nowhere else: not in Doors, Favourites or a search', absent)

    pick(page, 'bricks')
    page.locator('.sqbl-part[data-part="brick_2x2"]').click()
    page.locator('.sqbl-tray-title').click()
    page.locator('.sqbl-parts [data-assembly]').click()
    s = snap()
    a = s['assembly']
    card = page.locator('.sqbl-asm')
    text = card.inner_text()
    check(f'Tapping it arms a wall of the last brick and opens the card {a}', a and a['open'] and a['pattern'] == 'wall'
          and a['partId'] == 'brick_2x2' and (a['along'], a['up'], a['count']) == (8, 3, 24) and s['placementArmed']
          and card.is_visible())
    check('The card speaks both languages', all(w in text for w in ('Wall', '牆', 'Floor', '地板', 'Tower', '塔', 'Bridge', '橋',
          'Long', '長', 'Tall', '高', '24 bricks', '24 塊')))
    check('Card targets are at least 56 px', all(b['width'] >= 55.5 and b['height'] >= 55.5 for b in
          (card.locator(sel).first.bounding_box() for sel in ('[data-asm-step]', '[data-asm-pattern]', '[data-asm-act="turn"]', '[data-asm-drag]'))))
    check('Opening the card resizes neither the view nor the rail', page.locator('.sqbl-stage canvas').bounding_box() == canvas0
          and page.locator('.sqbl-left-rail').bounding_box()['width'] == rail0)

    # Steppers count blocks; the one that would pass 64 does nothing (A3).
    card.locator('[data-asm-pattern="tower"]').click()
    a = snap()['assembly']
    check('Tower: 2 × 2 × 8 = 32 blocks, with Long, Wide and Tall', (a['pattern'], a['count']) == ('tower', 32)
          and card.locator('[data-asm-step]').count() == 6)
    for _ in range(9):
        card.locator('[data-asm-step="up"][data-delta="1"]').click()
    a = snap()['assembly']
    check(f'+ Tall stops at 64 blocks {a["up"]} {a["count"]}', a['up'] == 16 and a['count'] == 64 and '64' in card.inner_text())
    card.locator('[data-asm-step="along"][data-delta="1"]').click()
    check('…and + Long does nothing at the cap', snap()['assembly']['count'] == 64 and snap()['assembly']['along'] == 2)
    for _ in range(12):
        card.locator('[data-asm-step="up"][data-delta="-1"]').click()
    check('− Tall comes down to 4 layers', snap()['assembly']['up'] == 4 and snap()['assembly']['count'] == 16)

    # Drag from the card: the ghost follows; letting go places every block as ordinary pieces (A5, A6).
    n0 = len(snap()['pieces'])
    undo0 = snap()['undo']
    drag = card.locator('[data-asm-drag]').bounding_box()
    sx, sy = drag['x'] + drag['width'] / 2, drag['y'] + drag['height'] / 2
    page.mouse.move(sx, sy)
    page.mouse.down()
    anchors = []
    for i in range(1, 15):
        page.mouse.move(sx + (spot[0] - sx) * i / 14, sy + (spot[1] - sy) * i / 14)
        a = snap()['assembly']
        if a['ghost']:
            anchors.append((a['anchor']['x'], a['anchor']['z']))
    check(f'The ghost tower follows the finger, as one mesh ({len(set(anchors))} spots)', len(set(anchors)) >= 2
          and snap()['assembly']['ghost'] and snap()['assembly']['tris'] > 0)
    page.screenshot(path=str(out / 'assembly-ghost.png'))
    page.mouse.up()
    page.wait_for_timeout(150)
    s = snap()
    tower = s['pieces'][n0:]
    check(f'Letting go places all 16 blocks as ordinary pieces ({len(s["pieces"]) - n0})', len(s['pieces']) == n0 + 16
          and all(p['partId'] == 'brick_2x2' and p['colorId'] == tower[0]['colorId'] for p in tower)
          and len({p['y'] for p in tower}) == 4 and s['assembly'] and s['placementArmed'])
    check('One build is one Undo step', s['undo'] == undo0 + 1)

    # A bridge whose deck would cut into the tower shows no ghost and places nothing (A5: no red, no message).
    card.locator('[data-asm-pattern="bridge"]').click()
    a = snap()['assembly']
    check('Bridge: a deck on two pillars, 6 + 2 × 2 = 10 blocks', (a['pattern'], a['count']) == ('bridge', 10))
    t = next(p for p in snap()['pieces'] if p['id'] == tower[0]['id'])['screen']
    hint0 = page.locator('.sqbl-stage-hint').inner_text()
    page.mouse.move(t['x'], t['y'])
    page.wait_for_timeout(60)
    blocked_ghost = snap()['assembly']['ghost']
    page.mouse.click(t['x'], t['y'])
    page.wait_for_timeout(150)
    check('…over the tower: no ghost, nothing placed, no message', not blocked_ghost
          and len(snap()['pieces']) == n0 + 16 and page.locator('.sqbl-stage-hint').inner_text() == hint0)
    page.mouse.click(box['x'] + 30, box['y'] + 30)
    page.wait_for_timeout(150)
    check('…off the plate (the sea): nothing placed', len(snap()['pieces']) == n0 + 16)
    card.locator('[data-asm-pattern="wall"]').click()
    card.locator('[data-asm-act="turn"]').click()
    a = snap()['assembly']
    check(f'↻ turns the wall: along runs the other way {a["studs"]}', a['rotation'] == 90 and a['studs'] == {'w': 2, 'd': 16})
    far = (box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.3)
    page.mouse.click(*far)
    page.wait_for_timeout(150)
    check('Tapping the plate builds the wall too, and stays armed', len(snap()['pieces']) == n0 + 16 + 24 and snap()['placementArmed'])
    page.screenshot(path=str(out / 'assembly-built.png'))
    page.locator('.sqbl-app [data-action="undo"]').click()
    page.wait_for_timeout(150)
    check('One Undo removes the whole wall', len(snap()['pieces']) == n0 + 16)
    page.locator('.sqbl-app [data-action="undo"]').click()
    page.wait_for_timeout(150)
    check('…and the next the whole tower', len(snap()['pieces']) == n0)
    check('Recents get the brick once', snap()['tray']['recents'][0] == 'brick_2x2'
          and snap()['tray']['recents'].count('brick_2x2') == 1)

    # Close keeps it armed; picking an ordinary part puts it away (A4).
    card.locator('[data-asm-act="close"]').click()
    check('✕ closes the card and keeps the wall armed', not card.is_visible() and snap()['assembly'] and snap()['placementArmed'])
    page.locator('.sqbl-part[data-part="brick_1x2"]').click()
    page.locator('.sqbl-tray-title').click()
    check('Picking a part disarms the assembly', snap()['assembly'] is None and not card.is_visible())
    check('The view and the rail never changed size', page.locator('.sqbl-stage canvas').bounding_box() == canvas0
          and page.locator('.sqbl-left-rail').bounding_box()['width'] == rail0)

    # Settings per pattern survive a reload (prefs `assembly`).
    page.reload(wait_until='domcontentloaded')
    RECOVERY['ready'](page)
    page.evaluate("SummerQuest.openGame('bricklab')")
    enter_world(page)
    pick(page, 'bricks')
    page.locator('.sqbl-parts [data-assembly]').click()
    a = snap()['assembly']
    check(f'After a reload the card opens as it was left {a}', a['pattern'] == 'wall' and a['rotation'] == 90 and a['count'] == 24)
    card.locator('[data-asm-pattern="tower"]').click()
    check('…and the tower kept its 4 layers', snap()['assembly']['up'] == 4)

    # Remove a whole wall in one go: its blocks share a group; one block still comes off on its own.
    card.locator('[data-asm-pattern="wall"]').click()
    card.locator('[data-asm-act="close"]').click()
    box = page.locator('.sqbl-stage canvas').bounding_box()
    n0 = len(snap()['pieces'])
    page.mouse.click(box['x'] + box['width'] * 0.45, box['y'] + box['height'] * 0.3)
    page.wait_for_timeout(150)
    wall = snap()['pieces'][n0:]
    check(f"A wall's 24 blocks share one group ({len(wall)})", len(wall) == 24 and len({p.get('group') for p in wall}) == 1
          and wall[0].get('group', '').startswith('wall-'))
    pick(page, 'bricks')
    group_tool = page.locator('.sqbl-app [data-action="delete-group"]')
    tops = sorted(wall, key=lambda p: (-p['y'], p['x'], p['z']))
    top, other = tops[0], tops[3]
    page.mouse.click(top['screen']['x'], top['screen']['y'])
    page.wait_for_timeout(150)
    s = snap()
    check(f'Tapping a wall block selects it and shows Remove whole build {s["selectedId"]}',
          s['selectedId'] in {p['id'] for p in wall} and group_tool.is_visible()
          and 'Remove whole build' in group_tool.inner_text() and '整組拆掉' in group_tool.inner_text())
    undo0 = s['undo']
    page.locator('.sqbl-app [data-action="delete"]').click()
    page.wait_for_timeout(150)
    check('Remove still takes one block', len(snap()['pieces']) == n0 + 23)
    page.locator('.sqbl-app [data-action="undo"]').click()
    page.wait_for_timeout(150)
    page.mouse.click(other['screen']['x'], other['screen']['y'])
    page.wait_for_timeout(150)
    group_tool.click()
    page.wait_for_timeout(150)
    s = snap()
    check(f'Remove whole build takes all 24 in one step, with an Undo hint ({len(s["pieces"]) - n0})', len(s['pieces']) == n0
          and s['undo'] == undo0 + 1 and '↶' in page.locator('.sqbl-stage-hint').inner_text())
    page.screenshot(path=str(out / 'assembly-group-removed.png'))
    page.locator('.sqbl-app [data-action="undo"]').click()
    page.wait_for_timeout(150)
    back = snap()['pieces'][n0:]
    check('One Undo brings the whole wall back, still one group', len(back) == 24 and len({p.get('group') for p in back}) == 1)


def seed_worlds(page, worlds):
    """Write worlds straight to this kid's storage before Brick Lab opens (grid 2: no re-settling)."""
    page.evaluate("""async (worlds) => {
      const { BrickWorlds } = await import('/js/brick-lab/brick-worlds.js');
      const store = new BrickWorlds(localStorage.getItem('sq:kid'));
      worlds.forEach((w) => store.create(w.name, { grid: 2, pieces: w.pieces }));
      return true; }""", worlds)


def grid_world(parts):
    """300 pieces on a 20 × 15 grid over the plate, cycling through `parts`, each resting on the plate
    (a part longer than its 3 × 4 cell overlaps its neighbour; only the drawing cost matters here)."""
    heights = {'door_1x4x6': 7.2, 'window_1x4x3': 3.6, 'leaves': 0.8, 'pillar_1x1x3': 3.6, 'slope_30_1x2': 0.8, 'slope_curved_2x2': 0.8, 'slope_curved_1x2': 0.8,
               'rock': 1, 'mushroom': 1.2, 'log_2x4': 1.2, 'crate_2x2': 1.2, 'barrel': 1.2, 'fence_post': 4.8,
               'railing_1x2': 1.2, 'window_1x2': 2.4, 'wheel_large': 1.6, 'slope_1x1': 0.8}
    plates = ('plate_1x1', 'plate_1x3', 'plate_4x4', 'plate_round_2x2')
    out = []
    for i in range(300):
        part = parts[i % len(parts)]
        h = 0.4 if part in plates or part.startswith('tile_') else heights.get(part, 1.2)
        out.append({'id': f'g{i}', 'partId': part, 'colorId': 'red', 'x': -28.5 + (i % 20) * 3, 'y': h / 2,
                    'z': -28 + (i // 20) * 4, 'rotation': 0})
    return out


def parts_sheet(browser, base, args, report, check, out):
    """--sheet: every part's real-part icon (multiplayer slice 08) in red, then blue, in one picture per
    colour, grouped by category with EN + 中文 labels; every part must build and have an icon. On the
    standard tier it also checks that ~300 new parts keep an idle lab at 0 frames and don't step the
    view down any sooner than 300 plain 2×4 bricks."""
    ctx = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
    if args.graphics == 'webgl1':
        ctx.add_init_script(WEBGL1_ONLY)
    page = ctx.new_page()
    page.set_default_timeout(20000)
    page.set_viewport_size({'width': 1280, 'height': 800})
    page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
    snap = lambda: page.evaluate(SNAP)
    page.goto(base + '/index.html', wait_until='domcontentloaded')
    RECOVERY['ready'](page)
    RECOVERY['wait_screen'](page, 'hub')
    catalog = page.evaluate("""async () => { const c = await import('/js/brick-lab/brick-catalog.js');
      return { parts: c.PARTS.map((p) => ({ id: p.id, label: p.label, category: p.category })),
               categories: c.CATEGORIES.map((k) => ({ id: k.id, label: k.label })) }; }""")
    seed_worlds(page, [{'name': 'Plain bricks', 'pieces': grid_world(['brick_2x4'])},
                       {'name': 'New parts', 'pieces': grid_world(list(MORE_PARTS))}])
    page.evaluate("SummerQuest.openGame('bricklab')")
    enter_world(page, 0)
    tier = snap()['render']['quality']
    graphics = snap()['graphics']
    check(f'Sheet run on {graphics}, {tier} tier', graphics == ('webgl1' if args.graphics == 'webgl1' else 'webgl2')
          and tier == ('reduced' if args.graphics == 'webgl1' else 'standard'))

    for color in ('red', 'blue'):
        page.locator(f'.sqbl-color[data-color="{color}"]').click()
        icons, body = {}, ''
        for cat in catalog['categories']:
            pick(page, cat['id'])
            cells = ''
            for part in [p for p in catalog['parts'] if p['category'] == cat['id']]:
                slot = page.locator(f'.sqbl-parts .sqbl-part[data-part="{part["id"]}"]').last
                slot.scroll_into_view_if_needed()
                try:
                    page.wait_for_function("(id) => [...document.querySelectorAll('.sqbl-parts .sqbl-part')].some((e) => e.dataset.part === id && e.querySelector('.sqbl-part-preview img'))",
                                           arg=part['id'], timeout=8000)
                    src = slot.locator('.sqbl-part-preview img').get_attribute('src')
                except Exception:
                    src = None
                icons[part['id']] = src
                cells += (f'<div class="cell{"" if src else " none"}">' + (f'<img src="{src}">' if src else '<b>?</b>')
                          + f'{part["label"][0]}<small>{part["label"][1]}</small></div>')
            body += f'<h2>{cat["label"][0]} · {cat["label"][1]}</h2><div class="grid">{cells}</div>'
        missing = [k for k, v in icons.items() if not v]
        check(f'Every one of the {len(icons)} parts builds and has a real-part icon in {color} {missing}', not missing and len(icons) == len(catalog['parts']))
        note = (f'{len(icons)} parts · picked colour {color} · {graphics} / {tier} tier. '
                'Rock, mushroom, log, leaves, rails and the tree keep their own colours; window panes stay see-through blue and the door knob dark.')
        sheet = ctx.new_page()
        sheet.set_content(SHEET_PAGE.replace('TITLE', color).replace('NOTE', note).replace('BODY', body))
        sheet.wait_for_timeout(300)
        suffix = '' if color == 'red' else '-blue'
        prefix = 'webgl1-' if args.graphics == 'webgl1' else ''
        sheet.screenshot(path=str(out / f'{prefix}parts-sheet{suffix}.png'), full_page=True)
        sheet.close()

    def orbit_until_step(seconds=16):
        """Slide the view in Explore (a drag never moves a piece there; kid camera K1) and time the first step-down."""
        page.locator('[data-mode-button="explore"]').dispatch_event('pointerdown')
        sb = page.locator('.sqbl-stage canvas').bounding_box()
        page.mouse.move(sb['x'] + 300, sb['y'] + 420)
        page.mouse.down()
        start = page.evaluate('performance.now()')
        f0 = snap()['render']['frames']
        stepped, step = None, 0
        while page.evaluate('performance.now()') - start < seconds * 1000:
            page.mouse.move(sb['x'] + 300 + (step % 120) * 3, sb['y'] + 420)
            step += 1
            if stepped is None and snap()['render']['level'] > 0:
                stepped = round((page.evaluate('performance.now()') - start) / 1000, 2)
        page.mouse.up()
        r = snap()['render']
        fps = round((r['frames'] - f0) / ((page.evaluate('performance.now()') - start) / 1000), 1)
        return {'steppedAfter': stepped, 'level': r['level'], 'fps': fps, 'calls': r['calls'], 'triangles': r['triangles']}

    def visit(name):
        """A fresh Brick Lab visit (the step-down level resets) on the named world, then idle and orbit."""
        leave_lab(page)
        page.evaluate("SummerQuest.openGame('bricklab')")
        page.wait_for_function(f"window.SQGames && SQGames.get('bricklab') && {SNAP} && {SNAP}.menu")
        page.locator('.sqbl-world', has_text=name).locator('.sqbl-world-open').click()
        page.wait_for_function(f"{SNAP} && !{SNAP}.menu && {SNAP}.world")
        page.wait_for_timeout(2500)
        f0 = snap()['render']['frames']
        page.wait_for_timeout(1500)
        idle = snap()['render']['frames'] - f0
        cost = orbit_until_step() if tier == 'standard' else None
        page.screenshot(path=str(out / f"{'webgl1-' if args.graphics == 'webgl1' else ''}grid-300-{name.split()[0].lower()}.png"))
        return idle, cost

    plain_idle, plain = visit('Plain bricks')
    mixed_idle, mixed = visit('New parts')
    check(f'An idle lab draws no frames with 300 plain bricks ({plain_idle}) or 300 new parts ({mixed_idle})',
          plain_idle == 0 and mixed_idle == 0)
    if tier == 'standard':
        report['frameCost'] = {'plain': plain, 'mixed': mixed}
        # Frames per second while orbiting is what the step-down reacts to. The time of the first
        # step-down itself is only reported: under ~4 fps frames come more than 250 ms apart and the
        # step-down's counter keeps restarting, so a slower world can step down later, not sooner.
        check(f'300 new parts orbit at least 80% as fast as 300 plain bricks {report["frameCost"]}', mixed['fps'] >= plain['fps'] * 0.8)
    page.evaluate('SQPlatform.triggerBack()')
    ctx.close()


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

    # Assemblies plan A6: a wall is one batch op. Lili's tablet gets the whole wall; one Undo here takes it from both.
    pick(pg, 'bricks')
    pg.locator('.sqbl-parts [data-assembly]').click()
    count = snap()['assembly']['count']
    n1, l1 = len(snap()['pieces']), sib("return S.lili.pieces.size")
    pg.mouse.click(box['x'] + box['width'] * 0.62, box['y'] + box['height'] * 0.4)
    pg.wait_for_timeout(250)
    check(f'A wall of {count} reaches Lili whole, as ours', len(snap()['pieces']) == n1 + count
          and sib("return S.lili.pieces.size") == l1 + count
          and sib(f"return Array.from(S.lili.pieces.values()).filter((p) => p.by === 'luis').length") >= count)
    pg.locator('.sqbl-app [data-action="undo"]').dispatch_event('pointerdown')
    pg.wait_for_timeout(250)
    check('One Undo removes the whole wall here and on Lili\'s tablet', len(snap()['pieces']) == n1
          and sib("return S.lili.pieces.size") == l1 and pg.locator('.sqbl-app [data-action="undo"]').is_disabled())
    pick(pg, 'plates')  # a category puts the assembly away

    # Lili leaves: chips go, the world (with her brick) is saved here.
    sib("S.lili.together.leave(); await new Promise((r) => setTimeout(r, 80)); return true;")
    pg.wait_for_timeout(150)
    check('Lili leaves: a toast, the chips go', '離開了' in pg.locator('.sqbl-toast').inner_text()
          and not pg.locator('.sqbl-crew').is_visible())
    # Slice 06: a tablet on another app version is turned away kindly; this tablet says to update both.
    sib("""const old = S.lan.createLanSession(S.wifi.device()); const name = Array.from(S.wifi.services.keys())[0];
        const peer = await old.join({ host: name, port: 1 }); old.send(peer, { t: 'hello', proto: 99, kid: 'lucien' });
        await new Promise((r) => setTimeout(r, 80)); return true;""")
    pg.wait_for_timeout(100)
    check('Another app version is turned away; this tablet says to update both', '兩台平板都要更新' in pg.locator('.sqbl-toast').inner_text()
          and snap()['together']['peers'] == 0)
    # An app pause (home button, screen off) takes the world off the wifi; Lili goes home. Resume puts it back.
    sib("""const t = S.lili.together; t.startLooking(); await new Promise((r) => setTimeout(r, 50));
        await t.join(t.joinable()[0]); await new Promise((r) => setTimeout(r, 80)); return true;""")
    pg.wait_for_timeout(100)
    pg.evaluate("window.dispatchEvent(new CustomEvent('summerquest:native-pause'))")
    pg.wait_for_timeout(150)
    check('An app pause takes the world off the wifi and sends Lili home', snap()['together']['role'] is None
          and sib("return S.lili.together.role") is None and sib("return S.lili.events.some((e) => e[0] === 'ended')"))
    pg.evaluate("window.dispatchEvent(new CustomEvent('summerquest:native-resume'))")
    pg.wait_for_timeout(150)
    check('Back in the app, the world is on the wifi again', snap()['together']['role'] == 'host'
          and sib("""const t = S.lili.together; t.startLooking(); await new Promise((r) => setTimeout(r, 50));
              const n = t.joinable().length; t.stopLooking(); return n;""") == 1)
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

    # Slice 06: Lili's tablet drops off the wifi; this one waits calmly, then rejoins when she is back.
    sib("S.lili.device.drop(); await new Promise((r) => setTimeout(r, 60)); return true;")
    pg.wait_for_timeout(100)
    s = snap()
    check("Lili's world vanishes: the plate stays, a calm 'looking for' note, no red", s['together']['lost'] and s['together']['role'] == 'guest'
          and pg.locator('.sqbl-lost').is_visible() and '正在找' in pg.locator('.sqbl-lost').inner_text() and len(s['pieces']) == 2)
    pg.screenshot(path=str(out / 'together-lost.png'))
    sib("""S.lili.pieces.set('t2', { id: 't2', partId: 'brick_1x1', colorId: 'yellow', x: -3.5, y: 0.6, z: -3.5, rotation: 0, by: 'lili' });
        await S.lili.together.host('Treehouse'); await new Promise((r) => setTimeout(r, 120)); return true;""")
    pg.wait_for_function(f"{SNAP}.together.role === 'guest' && !{SNAP}.together.lost")
    s = snap()
    check('She is back: this tablet rejoins on its own, with a fresh copy of her world', not pg.locator('.sqbl-lost').is_visible()
          and sorted(p['id'] for p in s['pieces']) == sorted(sib("return Array.from(S.lili.pieces.keys())")))

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
                if args.sheet:
                    parts_sheet(browser, base, args, report, check, out)
                    raise SheetDone
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
                # Assemblies plan slice 01: Favourites ⭐ is the first category; empty on a fresh save, it says so (EN + 中文).
                check('Favourites ⭐ is the first tile in the category list', page.evaluate(
                      "document.querySelector('.sqbl-category').dataset.category") == 'favorites')
                pick(page, 'favorites')
                s = snap()
                check('A fresh save has an empty Favourites with the hint in EN + 中文', s['tray']['category'] == 'favorites'
                      and s['tray']['view'] == 'parts' and s['tray']['parts'] == [] and s['tray']['count'] == 0
                      and 'Parts you use' in page.locator('.sqbl-tray-empty').inner_text()
                      and '用過的積木' in page.locator('.sqbl-tray-empty').inner_text())
                for cat in ('favorites',) + CATEGORIES[1:] + CATEGORIES[:1]:
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
                    # A busy machine draws icons more slowly: wait for them (up to 6 s) rather than a fixed pause.
                    try:
                        page.wait_for_function(f"{SNAP}.tray.icons.length >= ({on_screen})() && !{SNAP}.tray.iconsPending", timeout=6000)
                    except Exception:
                        pass
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

                # Slice 07 / kid camera K1: one finger (the left button) slides the view along the ground in
                # Build too, and never leaves the island.
                act('home-view')
                # The Home camera tween can finish late on a slow GPU; a fixed wait read it mid-flight.
                page.wait_for_function(SNAP + '.view && ' + SNAP + '.view.x === 6 && ' + SNAP + '.view.z === 9 && ' + SNAP + '.view.distance === 100')
                page.wait_for_timeout(300)
                start = snap()['target']
                page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5)
                page.mouse.down()
                for step in range(1, 11):
                    page.mouse.move(box['x'] + box['width'] * 0.5 - step * 25, box['y'] + box['height'] * 0.5 - step * 10)
                page.mouse.up()
                page.wait_for_timeout(700)
                moved_to = snap()['target']
                check('Build view slides along the ground with one finger', abs(moved_to['x'] - start['x']) + abs(moved_to['z'] - start['z']) > 3
                      and abs(moved_to['y'] - start['y']) < 0.01 and len(snap()['pieces']) == STARTER + 1)
                page.mouse.move(box['x'] + 20, box['y'] + 20)
                page.mouse.down()
                for step in range(1, 30):
                    page.mouse.move(box['x'] + 20 + step * 40, box['y'] + 20 + step * 25)
                page.mouse.up()
                page.wait_for_timeout(900)
                far = snap()['target']
                check('Sliding stops over the island', abs(far['x']) <= 36.01 and abs(far['z']) <= 36.01)
                # Kid camera K3 / K4: ↺ ↻ turn 45°, + − zoom one step, the tilt follows the zoom; never resizes the view.
                act('home-view')
                page.wait_for_timeout(800)
                v0 = snap()['view']
                size0 = page.locator('.sqbl-stage canvas').bounding_box()
                cam_buttons = [page.locator(f'.sqbl-cam [data-cam="{b}"]').bounding_box() for b in ('left', 'right', 'in', 'out')]
                check('Turn and zoom buttons are tablet-sized', all(b and b['width'] >= 56 and b['height'] >= 56 for b in cam_buttons))
                page.locator('.sqbl-cam [data-cam="right"]').dispatch_event('pointerdown')
                page.wait_for_timeout(500)
                v1 = snap()['view']
                check(f'↻ turns the view 45° {v1["yaw"] - v0["yaw"]:.4f}', abs(v1['yaw'] - v0['yaw'] - 0.785398) < 1e-3)
                page.locator('.sqbl-cam [data-cam="left"]').dispatch_event('pointerdown')
                page.wait_for_timeout(500)
                check('↺ turns it back', abs(snap()['view']['yaw'] - v0['yaw']) < 1e-3)
                for _ in range(3):
                    page.locator('.sqbl-cam [data-cam="in"]').dispatch_event('pointerdown')
                    page.wait_for_timeout(350)
                v2 = snap()['view']
                check(f'+ zooms in and the view tilts lower {v2["distance"]:.1f} {v2["pitch"]:.3f}', v2['distance'] < v0['distance'] * 0.4
                      and v2['pitch'] < v0['pitch'] - 0.1)
                for _ in range(30):
                    page.locator('.sqbl-cam [data-cam="out"]').dispatch_event('pointerdown')
                page.wait_for_timeout(500)
                v3 = snap()['view']
                check(f'− zooms out no further than Build allows {v3["distance"]:.1f}', abs(v3['distance'] - 128) < 1e-6 and v3['pitch'] > v0['pitch'])
                check('The buttons never resize the 3D view', page.locator('.sqbl-stage canvas').bounding_box() == size0)
                page.screenshot(path=str(out / 'camera-far.png'))
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
                # A mouse is not captured until the drag starts: first slide a little inside the tile (it may sit in the right column).
                page.mouse.move(tx + 14, ty)
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
                lab_more_parts(page, snap, check, out)
                catalog_checks(page, snap, check, out)
                pose_checks(page, snap, check, out)
                focus_checks(page, snap, check, out)
                animal_checks(page, snap, check, out)
                alive_checks(page, snap, check, out)
                swing_checks(page, snap, check, out)
                assembly_checks(page, snap, check, out)
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
                pick(page, 'nature')
                page.wait_for_timeout(900)
                check('The rock is the same rock in a new session (fixed seed: same icon)',
                      SEEN.get('rock') and page.evaluate(ICON_SRC, 'rock') == SEEN['rock'])
                page.locator('.sqbl-rail-back').click()
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
                # Kid camera K1 / K2 on a real touch screen: one finger slides with the ground staying under it,
                # two fingers pinch to zoom and twist to turn.
                cdp = touch.new_cdp_session(tp)
                tp.wait_for_timeout(600)
                cb = tp.locator('.sqbl-stage canvas').bounding_box()

                def touches(points):
                    return [{'x': x, 'y': y, 'id': i} for i, (x, y) in enumerate(points)]

                def finger_path(paths, steps=10):
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': touches([p[0] for p in paths])})
                    for i in range(1, steps + 1):
                        pts = [(a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps) for a, b in paths]
                        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': touches(pts)})
                        tp.wait_for_timeout(16)
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                    tp.wait_for_timeout(120)

                ground_under = """async ([x, y]) => { const m = await import('/js/brick-lab/brick-camera.js');
                    const s = SQGames.get('bricklab').snapshot(); const c = s.canvas;
                    return m.groundAt(s.view, (x - c.x) / c.width * 2 - 1, -((y - c.y) / c.height * 2 - 1), 34, c.width / c.height); }"""
                a0 = (cb['x'] + cb['width'] * 0.55, cb['y'] + cb['height'] * 0.6)
                a1 = (cb['x'] + cb['width'] * 0.35, cb['y'] + cb['height'] * 0.45)
                n_touch = len(tp.evaluate(SNAP)['pieces'])
                grabbed = tp.evaluate(ground_under, list(a0))
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': touches([a0])})
                for i in range(1, 11):
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': touches([(a0[0] + (a1[0] - a0[0]) * i / 10, a0[1] + (a1[1] - a0[1]) * i / 10)])})
                    tp.wait_for_timeout(16)
                tp.wait_for_timeout(150)  # touch moves are delivered with the next frame
                held = tp.evaluate(ground_under, list(a1))
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                tp.wait_for_timeout(120)
                check(f'One finger slides the map; the grabbed ground stays under it {grabbed} {held}',
                      abs(grabbed['x'] - held['x']) < 0.05 and abs(grabbed['z'] - held['z']) < 0.05
                      and len(tp.evaluate(SNAP)['pieces']) == n_touch)
                tp.wait_for_timeout(600)
                d0 = tp.evaluate(SNAP)['view']
                mx, my = cb['x'] + cb['width'] * 0.55, cb['y'] + cb['height'] * 0.55
                finger_path([((mx - 40, my), (mx - 140, my)), ((mx + 40, my), (mx + 140, my))])
                d1 = tp.evaluate(SNAP)['view']
                check(f'Two fingers spreading zoom in without turning {d0["distance"]:.1f} → {d1["distance"]:.1f}',
                      d1['distance'] < d0['distance'] * 0.8 and abs(d1['yaw'] - d0['yaw']) < 1e-6)
                finger_path([((mx - 90, my), (mx, my - 90)), ((mx + 90, my), (mx, my + 90))], steps=12)
                d2 = tp.evaluate(SNAP)['view']
                check(f'Two fingers twisting turn the view {d2["yaw"] - d1["yaw"]:.3f}', abs(d2['yaw'] - d1['yaw']) > 0.5)
                check('Neither slide nor pinch placed or selected anything', len(tp.evaluate(SNAP)['pieces']) == n_touch)
                tp.screenshot(path=str(out / 'camera-touch.png'))

                lst = tp.locator('.sqbl-category-list')
                lb = lst.bounding_box()
                check('A short rail shows there is more to scroll', 'has-more' in lst.get_attribute('class')
                      and lb['y'] + lb['height'] <= tp.locator('.sqbl-colors').bounding_box()['y'])
                fx, fy = lb['x'] + lb['width'] / 2, lb['y'] + lb['height'] * 0.8
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': fx, 'y': fy}]})
                for i in range(1, 16):
                    cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': fx, 'y': fy - i * 8}]})
                    tp.wait_for_timeout(16)
                cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
                tp.wait_for_timeout(200)
                check('A finger scrolls the category list without picking a category',
                      tp.evaluate(SNAP)['tray']['view'] == 'categories' and lst.evaluate('e => e.scrollTop') > 0)
                for cat in ('tiles', 'rails', 'structure', 'nature', 'scenery', 'space', 'bricks'):
                    pick(tp, cat)
                    if tp.evaluate(SNAP)['tray']['category'] != cat:
                        break
                check('Every category is reachable on a short tablet', tp.evaluate(SNAP)['tray']['category'] == 'bricks')
                tp.screenshot(path=str(out / 'short-touch.png'))
                tp.set_viewport_size({'width': 1024, 'height': 600})
                tp.locator('.sqbl-rail-back').click()
                tp.wait_for_timeout(200)
                # Catalog C4: twenty categories scroll inside the rail on every tablet, above the colours.
                lb = lst.bounding_box()
                check('At 1024×600 the categories scroll above the colours',
                      'has-more' in lst.get_attribute('class') and lb['y'] + lb['height'] <= tp.locator('.sqbl-colors').bounding_box()['y'])
                pick(tp, 'space')
                check('…and the last one is reachable', tp.evaluate(SNAP)['tray']['category'] == 'space')
                tp.locator('.sqbl-rail-back').click()
                tp.wait_for_timeout(200)
                tp.screenshot(path=str(out / 'categories-1024x600.png'))
                tp.evaluate('SQPlatform.triggerBack()')
                touch.close()
            except SheetDone:
                pass
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
    (out / ('sheet-' + args.graphics + '-report.json' if args.sheet else 'report.json')).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
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
    parser.add_argument('--sheet', action='store_true', help='only draw the parts sheet and check part cost (more-parts slice 04)')
    parser.add_argument('--graphics', choices=['auto', 'webgl1'], default='auto', help='webgl1: hide WebGL2 (r162 fallback, reduced tier)')
    raise SystemExit(0 if run(parser.parse_args()) else 1)
