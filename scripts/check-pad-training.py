"""Exercise pad training in isolated desktop/tablet Chromium contexts.

Requires Python Playwright; --browser optionally selects a Chromium executable.
"""
import argparse
import functools
import http.server
import runpy
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RECOVERY = runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'))
TRAINER = '.sq-pad-trainer'
FEEDBACK = '.sq-train-feedback'
SCORE = '.sq-train-score'


def score(page):
    return page.locator(SCORE).evaluate('(el) => [Number(el.dataset.hits), Number(el.dataset.misses)]')


def tap(page, touch=False, sample='kick'):
    box = page.locator(TRAINER + f' [data-sample="{sample}"]').bounding_box()
    (page.touchscreen.tap if touch else page.mouse.click)(
        box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)


def hit_at_line(page, index, touch=False, sample='kick'):
    # Use rendered note positions and the actual input handler, with no test clock.
    position = page.evaluate("""index => new Promise((resolve, reject) => {
      const deadline = performance.now() + 9000;
      const note = document.querySelector(`.sq-train-note[data-type="kid"][data-judge-idx="${index}"]`);
      const line = document.querySelector('.sq-hit-line');
      function frame() {
        const n = note.getBoundingClientRect(), l = line.getBoundingClientRect();
        const distance = n.x + n.width / 2 - l.x - l.width / 2;
        if (distance <= 2 && distance > -24) {
          const target = document.querySelectorAll('.sq-train-target')[Number(note.dataset.lane)].getBoundingClientRect();
          resolve({distance, verticalDistance:n.y + n.height / 2 - target.y - target.height / 2});
        } else if (performance.now() > deadline) {
          reject(new Error('Note did not reach hit line: ' + JSON.stringify({index,distance,result:note.dataset.result})));
        } else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    })""", index)
    assert abs(position['verticalDistance']) <= 1, position
    tap(page, touch, sample)
    return {'distance': position['distance'],
        'result': page.locator(f'[data-judge-idx="{index}"]').get_attribute('data-result')}


def run_case(browser, base, width, height, touch):
    context = browser.new_context(viewport={'width': width, 'height': height},
        has_touch=touch, service_workers='block', reduced_motion='reduce' if touch else 'no-preference')

    def local_only(route):
        if not route.request.url.startswith(base + '/'):
            route.abort()
        elif route.request.method != 'GET':
            route.fulfill(status=405, body='Browser regression never writes to services')
        else:
            route.continue_()

    context.route('**/*', local_only)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        RECOVERY['boot'](page, base)
        page.evaluate("""() => {
          sqTestMode.set(true);
          window.padCues = [];
          window.padCueTimes = [];
          const render = SQBrainCues.renderCue;
          SQBrainCues.renderCue = function(ctx, destination, name, opts) {
            padCues.push(name);
            padCueTimes.push({name, time:ctx.currentTime + (opts?.when || 0)});
            return render.call(this, ctx, destination, name, opts);
          };
        }""")
        if touch:
            page.evaluate('localStorage.setItem("sq.music.latency", JSON.stringify({offsetMs:150, confident:true}))')
        assert page.evaluate('SummerQuest.open("music:pads")')['ok']
        page.locator('[data-mode="practice"]').click()
        assert page.locator('[data-speed="0.8"]').get_attribute('aria-pressed') == 'true'
        page.locator('[data-chart="steady-kick"]').click()
        page.wait_for_selector(TRAINER)
        assert page.locator(FEEDBACK).get_attribute('data-result') == 'ready'
        assert page.locator(FEEDBACK).evaluate('(el) => Number(getComputedStyle(el).opacity)') > 0
        assert page.locator('.sq-hit-line').is_visible()
        assert page.locator(TRAINER + ' [data-sample]').count() == 4
        assert score(page) == [0, 0]
        instructions = page.locator(TRAINER).inner_text()
        assert 'Kick' in instructions and 'line' in instructions.lower(), instructions
        for selector in ('.sq-pad-track', '.sq-hit-line', TRAINER + ' [data-sample="kick"]',
                         '[data-action="start-pause"]', '[data-action="exercises"]'):
            box = page.locator(selector).bounding_box()
            assert box and box['width'] > 0 and box['height'] > 0, selector
            assert box['x'] >= 0 and box['y'] >= 0, (selector, box)
            assert box['x'] + box['width'] <= width + 1 and box['y'] + box['height'] <= height + 1, (selector, box)
        shots = ROOT / 'test-results'
        shots.mkdir(exist_ok=True)
        page.screenshot(path=str(shots / f'pad-training-ready-{width}x{height}.png'))
        # Ready-state taps let children hear a pad without scoring a mistake.
        tap(page, touch)
        assert score(page) == [0, 0]
        page.locator('[data-action="start-pause"]').click()
        page.wait_for_function("document.querySelector('.sq-train-feedback').dataset.result === 'count'")
        page.screenshot(path=str(shots / f'pad-training-running-{width}x{height}.png'))
        first = hit_at_line(page, 0, touch)
        assert first['result'] == 'perfect', first
        assert score(page) == [1, 0]
        assert page.locator(FEEDBACK).get_attribute('data-result') in ('perfect', 'good', 'ok')
        assert page.locator(FEEDBACK).evaluate('(el) => Number(getComputedStyle(el).opacity)') > 0
        assert page.locator(TRAINER + ' [data-sample="kick"]').get_attribute('data-feedback') == first['result']
        assert page.locator('.sq-train-target').first.inner_text() == '✓'
        assert 'token-pick' in page.evaluate('padCues'), 'On-time hit must play confirmation SFX'
        page.screenshot(path=str(shots / f'pad-training-hit-{width}x{height}.png'))

        page.wait_for_timeout(250)
        tap(page, touch)
        assert page.locator(FEEDBACK).get_attribute('data-result') == 'early'
        assert score(page) == [1, 0], 'Extra early tap must not count as a miss'
        assert not page.locator('[data-judge-idx="1"]').get_attribute('data-result'), 'Early tap consumed a future note'
        second = hit_at_line(page, 1, touch)
        assert second['result'] in ('perfect', 'good', 'ok'), second
        assert score(page) == [2, 0]

        page.locator('[data-action="start-pause"]').click()
        page.wait_for_timeout(100)
        positions = page.locator('.sq-train-note').evaluate_all('(notes) => notes.map(n => [n.style.transform, n.style.left])')
        paused_score = score(page)
        tap(page, touch)
        page.wait_for_timeout(700)
        assert score(page) == paused_score, 'Paused taps or elapsed time changed the score'
        assert page.locator('.sq-train-note').evaluate_all('(notes) => notes.map(n => [n.style.transform, n.style.left])') == positions, 'Paused track kept moving'
        page.locator('[data-action="start-pause"]').click()
        page.wait_for_function("Number(document.querySelector('.sq-train-score').dataset.misses) > 0", timeout=7000)
        assert page.locator('[data-judge-idx="2"]').get_attribute('data-result') == 'miss'
        assert page.locator(FEEDBACK).get_attribute('data-result') == 'miss'
        page.locator('[data-action="restart"]').click()
        assert score(page) == [0, 0]
        assert not page.locator('[data-judge-idx="0"]').get_attribute('data-result')
        page.locator('[data-action="exercises"]').click()
        assert page.locator('[data-chart="steady-kick"]').is_visible()
        page.locator('[data-mode="play"]').click()
        assert page.locator(TRAINER).is_hidden()
        assert page.evaluate('SQPlatform.triggerBack()')
        assert page.evaluate('SummerQuest.open("music:pads")')['ok']
        page.locator('[data-mode="practice"]').click()
        page.locator('[data-chart="steady-kick"]').click()
        assert score(page) == [0, 0]
        assert page.locator(FEEDBACK).get_attribute('data-result') == 'ready'
        page.wait_for_timeout(400)
        assert score(page) == [0, 0], 'Previous session leaked into the reopened trainer'
        page.locator('[data-action="exercises"]').click()
        page.locator('[data-chart="eighth-hats"]').click()
        page.evaluate("""async () => {
          const audio = (await import('./js/game-services/audio.js')).getSharedAudio();
          window.padSamples = []; padCueTimes.length = 0;
          const playSample = audio.playSample;
          audio.playSample = function(kit, name, opts) {
            padSamples.push({name, time:audio.clock().now + (opts?.when || 0)});
            return playSample.apply(this, arguments);
          };
        }""")
        page.locator('[data-action="start-pause"]').click()
        assert hit_at_line(page, 0, touch, 'hat-closed')['result'] == 'perfect'
        page.wait_for_timeout(100)
        assert not page.locator(TRAINER + ' [data-sample="hat-closed"]').evaluate('(el) => el.classList.contains("sq-pad-cue")'), 'Already-hit beat must stop inviting another tap'
        tap(page, touch, 'hat-closed')
        assert score(page) == [1, 0]
        assert not page.locator('[data-judge-idx="1"]').get_attribute('data-result')
        assert hit_at_line(page, 1, touch, 'hat-closed')['result'] in ('perfect', 'good', 'ok')
        page.wait_for_function('padSamples.some(event => event.name === "snare")', timeout=3000)
        samples = page.evaluate('padSamples')
        kick = next(event['time'] for event in samples if event['name'] == 'kick')
        snare = next(event['time'] for event in samples if event['name'] == 'snare')
        assert abs(snare - kick - 60 / 64) < .03, samples
        clicks = [event for event in page.evaluate('padCueTimes')
                  if event['name'] == 'ui-tap' and event['time'] < kick - .02]
        assert len(clicks) == 4, clicks
        assert not errors, errors
        print(f'PASS {width}x{height}: visible targets, on-time SFX, early retry, pause/resume, miss, restart, exit/reopen, count-in/backing order, dense-note cues', flush=True)
    finally:
        context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser')
    args = parser.parse_args()
    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
        functools.partial(RECOVERY['Handler'], directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True,
                **({'executable_path': args.browser} if args.browser else {}))
            for width, height, touch in ((1280, 800, False), (1024, 640, True)):
                run_case(browser, f'http://127.0.0.1:{server.server_port}', width, height, touch)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
