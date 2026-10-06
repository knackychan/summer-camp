"""Origami Atelier browser check: opens on the library; library and prep fit the frame, plus the lesson screen (docs/plans/2026-10-04-origami-lesson/).

Real UI and real taps on a synthetic local profile. At 1280x600, 1024x768 and 1280x800 it opens a
lesson and checks: nothing scrolls, the fold loops on its own, Pause freezes it mid-fold, Resume
continues from that frame, Replay restarts the cycle, Back/Next stay reachable, every control is a
tablet-sized target, the step text is bilingual and reduced motion waits for Play. Screenshots land in --out.
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
SIZES = [(1280, 600), (1024, 768), (1280, 800)]

# Every box that must sit fully inside the frame, and the root that must not scroll.
FIT = """() => {
  const root = document.querySelector('.oa-root');
  const host = root.parentElement;
  const vw = innerWidth, vh = innerHeight;
  const sel = ['.oa-instruction', '.oa-step-badge', '.oa-stage svg', '.oa-progress',
               '[data-action="pause"],[data-action="resume"]', '[data-action="replay"]',
               '[data-action="prev-step"]', '[data-action="next-step"]'];
  const boxes = {};
  for (const s of sel) { const r = document.querySelector('.oa-root').querySelector(s).getBoundingClientRect();
    boxes[s] = {x: r.x, y: r.y, w: r.width, h: r.height, inside: r.top >= 0 && r.left >= 0 && r.bottom <= vh + 0.5 && r.right <= vw + 0.5}; }
  const stage = document.querySelector('.oa-stage').getBoundingClientRect();
  return { boxes,
    hostScroll: host.scrollHeight - host.clientHeight, hostScrollX: host.scrollWidth - host.clientWidth,
    docScroll: document.scrollingElement.scrollHeight - innerHeight,
    stageShare: stage.height / vh };
}"""
FLAP_T = "document.querySelector('.oa-paper-flap').getAnimations()[0]"

# The live lesson on Little Fox step 1 (docs/plans/2026-10-05-origami-audit/ slice 01): seek every
# animation to a point in the fold and read the flap. Fold window from the flap's own keyframes:
# [0, lead, samples..., fold end, hold end, 1].
HINGE = """async () => {
  const D = await import('/js/vendor/origami-atelier/origami-data.js');
  const ins = document.querySelector('.oa-instruction').textContent;
  const model = D.ORIGAMI_MODELS.find(m => m.steps.some(s => Object.values(s.instruction).includes(ins)));
  const flap = document.querySelector('.oa-paper-flap');
  const anim = flap.getAnimations()[0];
  const kf = anim.effect.getKeyframes();
  const total = anim.effect.getTiming().duration;
  const a = kf[1].offset, b = kf[kf.length - 3].offset, c = kf[kf.length - 2].offset;
  const ok = kf.length > 10 && String(kf[a > 0 ? 2 : 1].transform).includes('scale(1');
  const seek = (f) => { document.getAnimations().forEach(x => { x.pause(); x.currentTime = f * total; }); };
  const box = (el) => el.getBoundingClientRect();
  const read = () => getComputedStyle(flap).fill;
  seek(a + (b - a) * .25); const early = read();
  seek(a + (b - a) * .5);
  const m = box(flap), room = [box(document.querySelector('.oa-paper-base')), box(document.querySelector('.oa-paper-flap-home')), box(document.querySelector('.oa-paper-landing'))];
  const left = Math.min(...room.map(r => r.left)), right = Math.max(...room.map(r => r.right));
  const top = Math.min(...room.map(r => r.top)), bottom = Math.max(...room.map(r => r.bottom));
  const midInside = m.left >= left - 2 && m.right <= right + 2 && m.top >= top - 2 && m.bottom <= bottom + 2;
  seek(a + (b - a) * .75); const late = read();
  seek((b + c) / 2);
  return { model: model && model.id, ok, early, late, front: getComputedStyle(document.querySelector('.oa-paper-flap-home')).fill,
           heldFill: read(), heldOpacity: +getComputedStyle(flap).opacity, midInside,
           mid: [m.left, m.right, m.top, m.bottom].map(Math.round) };
}"""

# Every step of every model through the engine, off-screen: the steps that threw, and the
# non-finish steps with nothing to play (slice 02: only finish steps may be still).
EVERY_STEP = """async () => {
  const D = await import('/js/vendor/origami-atelier/origami-data.js');
  const E = await import('/js/vendor/origami-atelier/origami-engine.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-400px;top:0;width:300px;height:210px';
  document.body.append(host);
  const broken = [], still = [];
  let count = 0;
  for (const m of D.ORIGAMI_MODELS) for (const [i, s] of m.steps.entries()) {
    count++;
    try {
      const e = new E.OrigamiFoldEngine(host, { reducedMotion: true }); e.show(s, { autoplay: false });
      if (!e.hasMotion && s.operation !== 'finish') still.push(`${m.id} #${i + 1}`);
      e.destroy();
    } catch (err) { broken.push(`${m.id} #${i + 1}: ${err.message}`); }
  }
  host.remove();
  return { broken, still, count };
}"""

# Classic Crane steps 1-4 (fold and reopen): Play is there, the paper moves mid-fold, and on the
# hold after reopening the flap is back flat with the crease drawn at full strength.
REOPEN = """async () => {
  const D = await import('/js/vendor/origami-atelier/origami-data.js');
  const E = await import('/js/vendor/origami-atelier/origami-engine.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-400px;top:0;width:300px;height:210px';
  document.body.append(host);
  const matrix = (el) => { const m = getComputedStyle(el).transform; return m === 'none' ? [1,0,0,1,0,0] : m.slice(7, -1).split(',').map(Number); };
  const flat = (m) => Math.abs(m[0] - 1) < .01 && Math.abs(m[3] - 1) < .01 && Math.abs(m[1]) < .01 && Math.abs(m[2]) < .01 && Math.abs(m[4]) < .5 && Math.abs(m[5]) < .5;
  const out = [];
  for (const i of [0, 1, 2, 3]) {
    const e = new E.OrigamiFoldEngine(host, { reducedMotion: true });
    e.show(D.getOrigamiModel('classic-crane').steps[i], { autoplay: false });
    const flap = host.querySelector('.oa-paper-flap'), crease = host.querySelector('.oa-crease');
    const seek = (ms) => e.anims.forEach(x => { x.currentTime = ms; });
    const kf = flap.getAnimations()[0].effect.getKeyframes();
    const total = e.cycleMs, foldEnd = kf.findIndex(k => k.offset > 0 && k.fill !== kf[0].fill);
    seek(kf[foldEnd].offset * total);
    const mid = { moved: !flat(matrix(flap)), shown: getComputedStyle(flap).display !== 'none' && +getComputedStyle(flap).opacity > .9 };
    const hold = kf[kf.length - 2].offset * total + 1;
    const holdEnd = Math.max(...e.anims.map(x => { const f = x.effect.getKeyframes(); return f[f.length - 2].offset; })) * total;
    seek((hold + holdEnd) / 2);
    out.push({ step: i + 1, play: e.hasMotion, ...mid, reopened: flat(matrix(flap)), crease: +getComputedStyle(crease).opacity });
    e.destroy();
  }
  host.remove();
  return out;
}"""


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
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            report['browser'] = browser.version
            context = RECOVERY['context_for'](browser, seed=RECOVERY['saved_fixture']('hub'))
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
            def console(message):
                if message.type != 'error':
                    return
                url = message.location.get('url', '')
                if 'net::ERR_FAILED' in message.text and urlparse(url).hostname not in (None, 'localhost', '127.0.0.1'):
                    return
                report['consoleErrors'].append(message.text + ' @ ' + url)
            page.on('console', console)

            try:
                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                RECOVERY['wait_screen'](page, 'hub')
                check('Origami opens', page.evaluate("SummerQuest.openGame('origami')")['ok'])
                page.wait_for_selector('#stage .oa-root [data-model]')
                check('Opens straight on the model library (no home screen)', page.locator('.oa-root .oa-model-card').count() == 28
                      and page.locator('.oa-root [data-action="collection"]').count() == 1
                      and page.locator('.oa-root [data-action="screen-back"]').count() == 0)
                PAGE_SCROLL = "() => { const h = document.querySelector('.oa-root').parentElement; return h.scrollHeight - h.clientHeight; }"
                def frame_fits(name):
                    for w, h in SIZES:
                        page.set_viewport_size({'width': w, 'height': h})
                        page.wait_for_timeout(150)
                        check(f'{name} {w}x{h}: page does not scroll', page.evaluate(PAGE_SCROLL) <= 1)
                frame_fits('Library (grid scrolls inside)')
                page.locator('.oa-root [data-model]').first.click()
                frame_fits('Prep')
                page.locator('.oa-root [data-action="start-lesson"]').click()
                page.wait_for_selector('.oa-root.oa-lesson-mode .oa-stage svg')
                page.locator('.oa-root [data-action="next-step"]').click()
                page.wait_for_selector('.oa-root [data-action="pause"]')

                for w, h in SIZES:
                    page.set_viewport_size({'width': w, 'height': h})
                    page.wait_for_timeout(300)
                    fit = page.evaluate(FIT)
                    tag = f'{w}x{h}'
                    check(f'{tag}: lesson does not scroll', fit['hostScroll'] <= 1 and fit['hostScrollX'] <= 1 and fit['docScroll'] <= 1)
                    outside = [s for s, b in fit['boxes'].items() if not b['inside']]
                    check(f'{tag}: text, diagram and every control inside the frame {outside}', not outside)
                    check(f'{tag}: diagram gets most of the height ({fit["stageShare"]:.2f})', fit['stageShare'] >= 0.42)
                    small = [s for s, b in fit['boxes'].items() if 'action' in s and (b['h'] < 48 or b['w'] < 48)]
                    check(f'{tag}: every control is a >=48px target {small}', not small)
                    play = fit['boxes']['[data-action="pause"],[data-action="resume"]']
                    check(f'{tag}: Pause is the big primary control', play['h'] >= 60
                          and play['w'] >= fit['boxes']['[data-action="replay"]']['w'])
                    page.screenshot(path=str(out / f'lesson-{tag}.png'))

                check('Fold loops forever', page.evaluate(FLAP_T + ".effect.getTiming().iterations") == float('inf'))
                t0 = page.evaluate(FLAP_T + ".currentTime")
                page.wait_for_timeout(400)
                check('Fold autoplays', page.evaluate(FLAP_T + ".currentTime") > t0 and page.evaluate(FLAP_T + ".playState") == 'running')
                cycle = page.evaluate(FLAP_T + ".effect.getTiming().duration")
                check(f'Cycle holds the folded shape after the fold ({cycle} ms)', cycle >= 1850 + 500)
                page.locator('.oa-root [data-action="pause"]').click()
                page.wait_for_timeout(100)  # a WAAPI pause settles on the next frame
                frozen = page.evaluate(FLAP_T + ".currentTime")
                page.wait_for_timeout(400)
                check('Pause freezes the fold', page.evaluate(FLAP_T + ".playState") == 'paused'
                      and page.evaluate(FLAP_T + ".currentTime") == frozen)
                check('Pause turns into Resume', page.locator('.oa-root [data-action="resume"]').count() == 1
                      and page.locator('.oa-root [data-action="pause"]').count() == 0)
                page.screenshot(path=str(out / 'paused.png'))
                page.locator('.oa-root [data-action="resume"]').click()
                resumed = page.evaluate(FLAP_T + ".currentTime")
                check('Resume continues from the paused frame', abs(resumed - frozen) < 120
                      and page.evaluate(FLAP_T + ".playState") == 'running')
                page.wait_for_timeout(300)
                page.locator('.oa-root [data-action="replay"]').click()
                check('Replay restarts the cycle', page.evaluate(FLAP_T + ".currentTime") % cycle < 150)
                page.wait_for_timeout(700)
                page.locator('.oa-root [data-action="pause"]').click()
                page.wait_for_timeout(100)
                held = page.evaluate(FLAP_T + ".currentTime") % cycle
                page.locator('.oa-root [data-action="locale-zh"]').click()
                page.wait_for_timeout(100)
                check('Language switch keeps the paused frame', page.locator('.oa-root [data-action="resume"]').count() == 1
                      and page.evaluate(FLAP_T + ".playState") == 'paused'
                      and abs(page.evaluate(FLAP_T + ".currentTime") - held) < 1)
                check('Step text is bilingual', '步驟' in page.locator('.oa-step-badge').inner_text()
                      and '繼續' in page.locator('.oa-root [data-action="resume"]').inner_text())
                page.screenshot(path=str(out / 'lesson-zh.png'))
                before = page.locator('.oa-step-badge').inner_text()
                page.locator('.oa-root [data-action="prev-step"]').click()
                check('Back goes to the previous step and autoplays',
                      page.locator('.oa-step-badge').inner_text() != before and page.locator('.oa-root [data-action="pause"]').count() == 1)
                hinge = page.evaluate(HINGE)
                check(f'Little Fox step 1 is a hinge fold ({hinge["model"]})', hinge['model'] == 'little-fox' and hinge['ok'])
                check('The flap shows its front colour before it is edge-on, the back colour after',
                      hinge['early'] == hinge['front'] and hinge['late'] != hinge['front'] and hinge['late'] == hinge['heldFill'])
                check(f'Mid-fold the flap stays where real paper can be {hinge["mid"]}', hinge['midInside'])
                check(f'The folded flap stays on the result ({hinge["heldOpacity"]})', hinge['heldOpacity'] > 0.9)
                page.locator('.oa-root [data-action="replay"]').click()
                steps = page.evaluate(EVERY_STEP)
                check(f'Every step of all 28 models draws without an error {steps["broken"][:3]}', steps['count'] == 275 and not steps['broken'])
                check(f'Every step but the finish has something to play {steps["still"][:5]}', not steps['still'])
                for r in page.evaluate(REOPEN):
                    check(f'Crane step {r["step"]} folds and reopens, leaving its crease {r}',
                          r['play'] and r['moved'] and r['shown'] and r['reopened'] and r['crease'] >= 0.9)
                page.emulate_media(reduced_motion='reduce')
                page.locator('.oa-root [data-action="next-step"]').click()
                page.wait_for_timeout(100)
                check('Reduced motion rests on the start frame until Play is tapped',
                      page.evaluate(FLAP_T + ".playState") == 'paused'
                      and '播放' in page.locator('.oa-root [data-action="resume"]').inner_text())
                page.locator('.oa-root [data-action="resume"]').click()
                check('Play starts the loop on request', page.evaluate(FLAP_T + ".playState") == 'running')
                page.emulate_media(reduced_motion='no-preference')
                page.locator('.oa-root [data-action="screen-back"]').click()
                page.locator('.oa-root [data-action="screen-back"]').click()
                check('Back from a model returns to the library, which offers Continue',
                      page.locator('.oa-root .oa-model-card').count() == 28
                      and page.locator('.oa-root [data-action="continue"]').count() == 1)
                page.locator('.oa-root [data-action="continue"]').click()
                check('Continue reopens the lesson', page.locator('.oa-root.oa-lesson-mode').count() == 1)
                check('No page errors', not report['pageErrors'] and not report['consoleErrors'])
            except Exception:
                page.screenshot(path=str(out / 'failure.png'))
                raise
            finally:
                browser.close()
    except Exception:
        traceback.print_exc()
        report['error'] = traceback.format_exc()
    finally:
        server.shutdown()
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return 0 if 'error' not in report else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--target', choices=['source', 'web'], default='source')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/origami-ui')
    sys.exit(run(parser.parse_args()))
