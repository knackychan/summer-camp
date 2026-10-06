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

# The live lesson on Samurai Helmet step 1, a template hinge (docs/plans/2026-10-05-origami-audit/ slice 01;
# Little Fox moved to the paper model in slice 07): seek every
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
      const e = new E.OrigamiFoldEngine(host, { reducedMotion: true }); e.show(s, { autoplay: false, model: m });
      if (!e.hasMotion && s.operation !== 'finish') still.push(`${m.id} #${i + 1}`);
      e.destroy();
    } catch (err) { broken.push(`${m.id} #${i + 1}: ${err.message}`); }
  }
  host.remove();
  return { broken, still, count };
}"""

# Book notation per operation (slice 05), read off-screen from the engine.
NOTATION = """async () => {
  const D = await import('/js/vendor/origami-atelier/origami-data.js');
  const E = await import('/js/vendor/origami-atelier/origami-engine.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-400px;top:0;width:300px;height:210px';
  document.body.append(host);
  const read = (id, i) => {
    const e = new E.OrigamiFoldEngine(host, { reducedMotion: true });
    const model = D.getOrigamiModel(id);
    e.show(model.steps[i], { autoplay: false, model });
    const head = host.querySelector('.oa-arrow-head');
    const behind = host.querySelector('.oa-paper-flap-behind');
    const paperBehind = host.querySelector('.oa-paper-model > g');
    const sym = host.querySelector('.oa-fold-symbol');
    const out = { kind: e.parts.notation, dash: getComputedStyle(host.querySelector('.oa-crease')).strokeDasharray,
      head: head.classList.contains('oa-arrow-head-full') ? 'full' : head.classList.contains('oa-arrow-head-half') ? 'half' : 'plain',
      behind: (getComputedStyle(behind.parentNode).display !== 'none' && getComputedStyle(behind).display !== 'none' && behind.getAnimations().length > 0)
        || (getComputedStyle(paperBehind.parentNode).display !== 'none' && paperBehind.childNodes.length > 0 && paperBehind.getAnimations().length > 0),
      symbol: getComputedStyle(sym).display !== 'none' && (sym.getAttribute('d') || '').length > 10 };
    e.destroy();
    return out;
  };
  const res = { fox: read('little-fox', 0), cat: read('cat-face', 5), fish: read('swimming-fish', 4) };
  host.remove();
  return res;
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
    const flap = host.querySelector('.oa-paper-flap'), crease = host.querySelector('.oa-crease-mark');
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

# The paper-model path (slice 06) on a synthetic model, until slice 07 puts `fold` on real ones:
# valley, mountain, precrease, flip, rotate, keyframe, finish. Each step must start on the outline the
# step before held (+-1 px), the folded part must change face where it is edge-on, a mountain must
# land behind the paper, the keyframe must morph its outline, and the finish shows both faces still.
PAPER = """async () => {
  const E = await import('/js/vendor/origami-atelier/origami-engine.js');
  const P = await import('/js/vendor/origami-atelier/origami-paper.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:210px';
  document.body.append(host);
  const model = { id: 'paper-check', paper: { startFace: 'front' }, steps: [
    { id: 'v', operation: 'valley-fold', fold: { op: 'valley', line: [[0, 0], [1, 1]], move: [0, 1] } },
    { id: 'm', operation: 'mountain-fold', fold: { op: 'mountain', line: [[0.5, 0], [0.5, 1]], move: [0.2, 0.1] } },
    { id: 'p', operation: 'precrease', fold: { op: 'precrease', line: [[0, 0.25], [1, 0.25]], move: [0.8, 0.1] } },
    { id: 'f', operation: 'flip', fold: { op: 'flip' } },
    { id: 'r', operation: 'rotate', fold: { op: 'rotate', deg: 90 } },
    { id: 'k', operation: 'spread', fold: { op: 'keyframe', to: {} } },
    { id: 'end', operation: 'finish', fold: { op: 'finish' } },
  ] };
  /* The keyframe nudges the first facet's first corner toward its middle. */
  const pre = { ...model, steps: model.steps.slice(0, 5) };
  const last = P.replay(pre)[4].after.facets[0];
  const mid = last.poly.reduce((s, p) => [s[0] + p[0] / last.poly.length, s[1] + p[1] / last.poly.length], [0, 0]);
  model.steps[5].fold.to[last.id] = last.poly.map((p, i) => i ? p : [(p[0] + mid[0]) / 2, (p[1] + mid[1]) / 2]);
  const colour = (c) => { const d = document.createElement('div'); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; };
  const FRONT = '#ef8f9f', BACK = '#3a7bd5';
  const front = colour(FRONT), back = colour(BACK);
  const shown = (el) => { for (let n = el; n && n !== host; n = n.parentNode) { const cs = getComputedStyle(n); if (cs.display === 'none' || +cs.opacity < 0.5) return false; } return true; };
  /* The real corners of every visible facet on screen (a bounding box of a mirrored path is loose). */
  const outline = () => {
    const pts = [...host.querySelectorAll('.oa-paper-facet')].filter(shown).flatMap(el => {
      const d = getComputedStyle(el).d, m = el.getScreenCTM();
      const n = (d && d !== 'none' ? d : el.getAttribute('d')).match(/-?[\\d.]+(e-?\\d+)?/g).map(Number);
      const out = [];
      for (let i = 0; i + 1 < n.length; i += 2) out.push(new DOMPoint(n[i], n[i + 1]).matrixTransform(m));
      return out;
    });
    return pts.length ? [Math.min(...pts.map(q => q.x)), Math.min(...pts.map(q => q.y)), Math.max(...pts.map(q => q.x)), Math.max(...pts.map(q => q.y))].map(v => Math.round(v * 10) / 10) : null;
  };
  const out = [];
  let held = null;
  for (const [i, step] of model.steps.entries()) {
    const e = new E.OrigamiFoldEngine(host, { reducedMotion: true, front: FRONT, back: BACK });
    e.show(step, { autoplay: false, model });
    const seek = (f) => e.anims.forEach(x => { x.currentTime = f * e.cycleMs; });
    const groups = [...host.querySelectorAll('.oa-paper-model > g')];
    const r = { id: step.id, paper: getComputedStyle(host.querySelector('.oa-paper-model')).display !== 'none',
      template: getComputedStyle(host.querySelector('.oa-paper-base').parentNode).display === 'none',
      play: e.hasMotion, notation: e.parts.notation, facets: host.querySelectorAll('.oa-paper-facet').length };
    if (e.anims.length) seek(0);
    const start = outline();
    r.continues = i === 0 || (held && start && start.every((v, k) => Math.abs(v - held[k]) <= 1));
    r.start = start; r.prevHeld = held;
    if (e.anims.length) {
      const kf = e.anims[0].effect.getKeyframes();
      const a = kf[1].offset, c = kf[step.id === 'k' ? 3 : kf.length - 2].offset;
      const b = step.id === 'p' ? null : kf[kf.length - 3].offset;
      if (['v', 'm', 'f'].includes(step.id)) {
        seek(a + (b - a) * .25);
        r.early = [...groups[3].querySelectorAll('path')].filter(shown).length;
        seek(a + (b - a) * .75);
        const post = step.id === 'm' ? groups[0] : groups[4];
        r.late = [...post.querySelectorAll('path')].filter(shown).length;
        r.lateHidden = [...groups[3].querySelectorAll('path')].filter(shown).length;
        /* post lists the moving facets in reverse layer order, each showing its other face. */
        const fills = (g) => [...g.querySelectorAll('path')].map(el => getComputedStyle(el).fill);
        const pf = fills(groups[3]), qf = fills(post);
        r.swapped = qf.length === pf.length && qf.every((f, k) => f !== pf[pf.length - 1 - k]);
      }
      if (step.id === 'k') {
        const el = e.anims[0].effect.target;
        const d0 = getComputedStyle(el).d; seek(kf[2].offset); const d1 = getComputedStyle(el).d;
        r.morphs = d0 !== d1;
      }
      seek(c - 0.001);
    }
    held = outline();
    if (step.id === 'end') r.fills = [...new Set([...host.querySelectorAll('.oa-paper-facet')].map(el => getComputedStyle(el).fill))];
    r.held = held;
    out.push(r);
    e.destroy();
  }
  host.remove();
  return { steps: out, front, back };
}"""

# The six pilot models on the paper model (slice 07): every step starts on the outline the step
# before held (+-1 px), every step but the finish plays, and Cat Face 6 (the chin) folds behind:
# the paper that lands goes in the stack drawn before the paper that stays, and shows once it is
# past edge-on.
PILOT = """async () => {
  const D = await import('/js/vendor/origami-atelier/origami-data.js');
  const E = await import('/js/vendor/origami-atelier/origami-engine.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:210px';
  document.body.append(host);
  const shown = (el) => { for (let n = el; n && n !== host; n = n.parentNode) { const cs = getComputedStyle(n); if (cs.display === 'none' || +cs.opacity < 0.5) return false; } return true; };
  /* The real corners of every visible facet on screen (a bounding box of a mirrored path is loose). */
  const outline = () => {
    const pts = [...host.querySelectorAll('.oa-paper-facet')].filter(shown).flatMap(el => {
      const d = getComputedStyle(el).d, m = el.getScreenCTM();
      const n = (d && d !== 'none' ? d : el.getAttribute('d')).match(/-?[\\d.]+(e-?\\d+)?/g).map(Number);
      const out = [];
      for (let i = 0; i + 1 < n.length; i += 2) out.push(new DOMPoint(n[i], n[i + 1]).matrixTransform(m));
      return out;
    });
    return pts.length ? [Math.min(...pts.map(q => q.x)), Math.min(...pts.map(q => q.y)), Math.max(...pts.map(q => q.x)), Math.max(...pts.map(q => q.y))].map(v => Math.round(v * 10) / 10) : null;
  };
  const out = [];
  let behind = null;
  for (const id of ['little-fox', 'dog-face', 'cat-face', 'swimming-fish', 'rabbit-face', 'paper-cup']) {
    const model = D.getOrigamiModel(id);
    const bad = [];
    let held = null, paper = true;
    for (const [i, step] of model.steps.entries()) {
      const e = new E.OrigamiFoldEngine(host, { reducedMotion: true });
      e.show(step, { autoplay: false, model });
      paper = paper && getComputedStyle(host.querySelector('.oa-paper-model')).display !== 'none';
      const seek = (f) => e.anims.forEach(x => { x.currentTime = f * e.cycleMs; });
      if (e.anims.length) seek(0);
      const start = outline();
      if (i && !(held && start && start.every((v, k) => Math.abs(v - held[k]) <= 1))) bad.push({ step: i + 1, start, held });
      if (!e.hasMotion && step.operation !== 'finish') bad.push({ step: i + 1, still: true });
      if (e.anims.length) {
        const kf = e.anims[0].effect.getKeyframes();
        const a = kf[1].offset, c = kf[step.fold.op === 'keyframe' ? 3 : kf.length - 2].offset;
        if (id === 'cat-face' && i === 5) {
          const groups = [...host.querySelectorAll('.oa-paper-model > g')];
          seek(a + (kf[kf.length - 3].offset - a) * .75);
          behind = { landsBehind: groups[0].childNodes.length > 0 && groups[4].childNodes.length === 0,
                     shows: [...groups[0].querySelectorAll('path')].some(shown), above: [...groups[3].querySelectorAll('path')].some(shown) };
        }
        seek(c - 0.001);
      }
      held = outline();
      e.destroy();
    }
    out.push({ id, steps: model.steps.length, paper, bad });
  }
  host.remove();
  return { models: out, behind };
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
                page.locator('.oa-root [data-model="samurai-helmet"]').click()
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

                loops = page.evaluate(FLAP_T + ".effect.getTiming().iterations")
                check(f'Fold loops 4 times, ending on the hold ({loops:.2f})', 3 < loops < 4)
                t0 = page.evaluate(FLAP_T + ".currentTime")
                page.wait_for_timeout(400)
                check('Fold autoplays', page.evaluate(FLAP_T + ".currentTime") > t0 and page.evaluate(FLAP_T + ".playState") == 'running')
                cycle = page.evaluate(FLAP_T + ".effect.getTiming().duration")
                hold = page.evaluate("(() => { const k = " + FLAP_T + ".effect.getKeyframes(); return (k[k.length - 2].offset - k[k.length - 3].offset) * " + FLAP_T + ".effect.getTiming().duration; })()")
                check(f'Cycle holds the folded shape for 2 s after the fold ({hold:.0f} ms)', hold >= 1999)
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
                SEEK = "(t) => document.querySelector('.oa-stage').getAnimations({subtree: true}).forEach(a => { a.currentTime = t; })"
                page.evaluate(SEEK, cycle * 2.5)
                for lang in ('en', 'zh'):
                    page.locator(f'.oa-root [data-action="locale-{lang}"]').click()
                    page.wait_for_timeout(100)
                    check(f'Language switch ({lang}) keeps the loop count (loop 3)', abs(page.evaluate(FLAP_T + ".currentTime") - cycle * 2.5) < 1)
                page.locator('.oa-root [data-action="resume"]').click()
                page.evaluate("() => document.querySelector('.oa-stage').getAnimations({subtree: true}).forEach(a => { a.currentTime = a.effect.getComputedTiming().endTime; })")
                page.wait_for_selector('.oa-root [data-action="watch-again"]', timeout=3000)
                check('After 4 loops the fold rests on the result with Watch again / 再看一次',
                      '再看一次' in page.locator('.oa-root [data-action="watch-again"]').inner_text()
                      and page.evaluate(FLAP_T + ".playState") == 'finished'
                      and page.evaluate("+getComputedStyle(document.querySelector('.oa-paper-flap')).opacity") > 0.9)
                page.screenshot(path=str(out / 'resting.png'))
                page.locator('.oa-root [data-action="watch-again"]').click()
                check('Watch again plays the loops again', page.evaluate(FLAP_T + ".playState") == 'running'
                      and page.evaluate(FLAP_T + ".currentTime") < 300
                      and page.locator('.oa-root [data-action="pause"]').count() == 1)
                before = page.locator('.oa-step-badge').inner_text()
                page.locator('.oa-root [data-action="prev-step"]').click()
                check('Back goes to the previous step and autoplays',
                      page.locator('.oa-step-badge').inner_text() != before and page.locator('.oa-root [data-action="pause"]').count() == 1)
                hinge = page.evaluate(HINGE)
                check(f'Samurai Helmet step 1 is a hinge fold ({hinge["model"]})', hinge['model'] == 'samurai-helmet' and hinge['ok'])
                check('The flap shows its front colour before it is edge-on, the back colour after',
                      hinge['early'] == hinge['front'] and hinge['late'] != hinge['front'] and hinge['late'] == hinge['heldFill'])
                check(f'Mid-fold the flap stays where real paper can be {hinge["mid"]}', hinge['midInside'])
                check(f'The folded flap stays on the result ({hinge["heldOpacity"]})', hinge['heldOpacity'] > 0.9)
                page.locator('.oa-root [data-action="replay"]').click()
                steps = page.evaluate(EVERY_STEP)
                check(f'Every step of all 28 models draws without an error {steps["broken"][:3]}', steps['count'] == 273 and not steps['broken'])
                check(f'Every step but the finish has something to play {steps["still"][:5]}', not steps['still'])
                paper = page.evaluate(PAPER)
                ps = {r['id']: r for r in paper['steps']}
                check(f'Paper model: every step draws from facets, not templates {[(r["id"], r["facets"]) for r in paper["steps"]]}',
                      all(r['paper'] and r['template'] and r['facets'] > 0 for r in paper['steps']))
                check(f'Paper model: each step starts on the outline the last one held {[(r["id"], r["start"], r["prevHeld"]) for r in paper["steps"] if not r["continues"]]}',
                      all(r['continues'] for r in paper['steps']))
                check(f'Paper model: every step but the finish plays {[(r["id"], r["play"]) for r in paper["steps"]]}',
                      all(r['play'] != (r['id'] == 'end') for r in paper['steps']))
                check(f'Paper model: notation follows the op {[(r["id"], r["notation"]) for r in paper["steps"]]}',
                      [ps[k]['notation'] for k in 'vmpfr'] == ['valley', 'mountain', 'precrease', 'flip', 'rotate'])
                for k in 'vmf':
                    r = ps[k]
                    check(f'Paper model {k}: the moving part lies as it was before edge-on and lands face-swapped after {r}',
                          r['early'] > 0 and r['late'] > 0 and r['lateHidden'] == 0 and r['swapped'])
                check(f'Paper model: the keyframe step morphs its outline {ps["k"]}', ps['k']['morphs'])
                check(f'Paper model: the finish shows both faces {ps["end"]["fills"]}', paper['front'] in ps['end']['fills'] and paper['back'] in ps['end']['fills'])
                pilot = page.evaluate(PILOT)
                for r in pilot['models']:
                    check(f'Pilot {r["id"]} ({r["steps"]} steps): drawn from the paper model, each step starts where the last one ended, all but the finish play {r["bad"][:2]}',
                          r['paper'] and not r['bad'])
                check(f'Pilot Cat Face 6: the chin folds behind the paper {pilot["behind"]}',
                      pilot['behind']['landsBehind'] and pilot['behind']['shows'] and not pilot['behind']['above'])
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
                meta = page.locator('.oa-root .oa-model-meta').first.inner_text()
                check(f'中文 library cards say 約 … 分鐘, not "min" ({meta})', '約' in meta and '分鐘' in meta and 'min' not in meta)
                check('中文 language switch is labelled 語言', page.locator('.oa-root .oa-locale').get_attribute('aria-label') == '語言')
                page.locator('.oa-root [data-action="continue"]').click()
                check('中文 fold diagram is labelled 摺紙步驟圖', page.locator('.oa-root .oa-fold-svg').get_attribute('aria-label') == '摺紙步驟圖')
                check('Continue reopens the lesson', page.locator('.oa-root.oa-lesson-mode').count() == 1)
                notes = page.evaluate(NOTATION)
                check(f'Little Fox 1 is a valley: dashed line, full arrowhead {notes["fox"]}', notes['fox']['kind'] == 'valley'
                      and notes['fox']['dash'] == '8px, 6px' and notes['fox']['head'] == 'full')
                check(f'Cat Face 6 is a mountain: dash-dot line, half arrowhead, flap behind {notes["cat"]}', notes['cat']['kind'] == 'mountain'
                      and notes['cat']['dash'].replace(' ', '') == '9px,4px,2px,4px' and notes['cat']['head'] == 'half' and notes['cat']['behind'])
                check(f'Swimming Fish 5 shows the turn-over symbol {notes["fish"]}', notes['fish']['kind'] == 'flip' and notes['fish']['symbol'])
                page.locator('.oa-root [data-action="screen-back"]').click()
                page.locator('.oa-root [data-action="screen-back"]').click()
                page.locator('.oa-root [data-model="cat-face"]').click()
                page.locator('.oa-root [data-action="start-lesson"]').click()
                for _ in range(5):
                    page.locator('.oa-root [data-action="next-step"]').click()
                check('Cat Face 6 legend: 山摺 with its meaning', '山摺' in page.locator('.oa-root [data-legend="notation"]').inner_text()
                      and page.locator('.oa-root [data-legend="crease"]').is_hidden())
                for w, h in SIZES:
                    page.set_viewport_size({'width': w, 'height': h})
                    page.wait_for_timeout(200)
                    fit = page.evaluate(FIT)
                    check(f'{w}x{h}: the mountain legend fits, nothing scrolls', fit['hostScroll'] <= 1 and fit['hostScrollX'] <= 1 and fit['docScroll'] <= 1
                          and all(b['inside'] for b in fit['boxes'].values()))
                page.screenshot(path=str(out / 'mountain-legend.png'))
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
