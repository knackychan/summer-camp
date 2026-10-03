"""Browser smoke checks for the built Brain Gym. Requires Python Playwright."""
from pathlib import Path
import argparse
import json
import runpy
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = runpy.run_path(str(ROOT / 'scripts/check-world-explorer-ui.py'))['server']
NEW_SCENES = {
    'fractions': '.brain-fractions', 'balance': '.brain-balance',
    'circuit': '.brain-circuit', 'sorter': '.brain-sorter',
    'sentence': '.brain-sentence', 'soundmatch': '.brain-sound',
    'memorymatch': '.brain-memory', 'patternecho': '.brain-echo',
}


def open_probe(page, game, tier='tot'):
    page.evaluate('''async ([gameId,tier]) => {
      window.brainResult=null;window.brainSpoken=[];window.brainProgress=null;window.brainHud=null;
      SQBrainData.setInputScript('abc');
      window.brainProbe=await SQBrain.openRound({gameId,tier,kid:'lili',
        mount:document.getElementById('stage'),isMuted:()=>true,
        sayPair:pair=>brainSpoken.push(pair),onFinish:r=>window.brainResult=r,
        onProgress:state=>window.brainProgress=state?JSON.parse(JSON.stringify(state)):null,
        onHud:(_rows,meta)=>window.brainHud=meta});
    }''', [game, tier])
    page.wait_for_function("brainProbe.debugState() === 'active'")


def answer_exercise(page, game, item, wrong=False):
    """Only click real scene controls; the captured item tells us the solution."""
    answer = next(value for value in item['choices'] if value != item['answer']) if wrong else item['answer']
    if game == 'fractions':
        # Zero is a valid distractor, but sharing zero pieces is disabled.
        count = (2 if int(item['answer']) == 1 else 1) if wrong else int(answer)
        for index in range(count): page.locator('.brain-fractions__piece').nth(index).click()
        page.locator('[data-act="share"]').click()
    elif game == 'balance':
        page.locator(f'.brain-balance__block[data-value="{answer}"]').click()
        page.locator('[data-act="check"]').click()
    elif game == 'circuit':
        if item['prompt'].get('mode') == 'predict':
            page.locator('.brain-circuit__prediction').nth(item['choices'].index(answer)).click()
            return
        config = next(row for row in item['prompt']['configurations'] if row['value'] == answer)
        for index, closed in enumerate(config['switches']):
            button = page.locator('.brain-circuit__switch').nth(index)
            if (button.get_attribute('aria-pressed') == 'true') != closed: button.click()
        if config['material'] >= 0: page.locator('.brain-circuit__material').nth(config['material']).click()
        page.locator('.brain-circuit__check').click()
    elif game == 'sorter':
        index = next(i for i, row in enumerate(item['prompt']['categories']) if row['value'] == answer)
        page.locator('.brain-sorter__bin').nth(index).click()
    elif game == 'sentence':
        used = set()
        for word in answer.split(' '):
            index = next(i for i, token in enumerate(item['prompt']['tokens']) if token == word and i not in used)
            used.add(index)
            page.locator('.brain-sentence__word').nth(index).click()
        page.locator('[data-act="check"]').click()
    elif game == 'soundmatch':
        index = next(i for i, row in enumerate(item['prompt']['options']) if row['value'] == answer)
        page.locator('.brain-sound__choice').nth(index).click()
    elif game == 'memorymatch':
        if item['prompt'].get('mode') == 'all':
            if wrong:
                cards = item['prompt']['cards']
                other = next(i for i, symbol in enumerate(cards) if symbol != cards[0])
                page.locator('.brain-memory__card').first.click()
                page.locator('.brain-memory__card').nth(other).click()
                page.wait_for_function("[...document.querySelectorAll('.brain-memory__card')].every(button=>!button.disabled)")
            for pair in item['answer'].split(';'):
                for index in map(int, pair.split(',')): page.locator('.brain-memory__card').nth(index - 1).click()
        else:
            for index in map(int, answer.split(',')): page.locator('.brain-memory__card').nth(index - 1).click()
    elif game == 'patternecho':
        page.wait_for_function("!document.querySelector('.brain-echo__pad').disabled")
        for value in answer.split(','): page.locator(f'.brain-echo__pad[data-pad="{value}"]').click()
        if item['prompt'].get('confirm'): page.locator('[data-check]').click()

def run(browser_path, out):
    out = out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    results, errors = [], []
    with server(8157), sync_playwright() as p:
        browser = p.chromium.launch(executable_path=browser_path, headless=True)
        context = browser.new_context(viewport={'width': 1024, 'height': 768})
        # Keep test progress local, including when the developer has cloud config.
        context.route('**/js/config.js', lambda route: route.fulfill(body='window.SQ_CONFIG = {};', content_type='text/javascript'))
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:8157/index.html', wait_until='domcontentloaded')
        page.locator('.hero').first.click()
        page.wait_for_function('!!window.SummerQuest && !!window.SQBrain')
        page.evaluate("SummerQuest.openGame('calc', {origin:'world'})")
        page.wait_for_selector('.brain-round')
        page.evaluate('''() => {
          const build = SQBrainCore.buildRound;
          SQBrainCore.buildRound = function(...args) {
            window.brainRound = build.apply(this,args);
            return window.brainRound;
          };
          const open = SQBrain.openRound;
          SQBrain.openRound = async options => {
            window.brainProbe = await open({...options,isMuted:()=>true});
            return window.brainProbe;
          };
        }''')
        results.append(('real_root_launch', page.locator('#stage .brain-round').is_visible()))
        results.append(('city_retired', page.evaluate("!SQContentRegistry.get('game:city') && !SQManifest.some(g => g.id === 'city')")))
        games = page.evaluate('Object.keys(SQBrainData.GAMES)')
        results.append(('all_eight_new_games_registered', all(game in games for game in NEW_SCENES)))
        for width, height in [(1024, 768), (768, 1024), (800, 600), (360, 740)]:
            page.set_viewport_size({'width': width, 'height': height})
            for game in games:
                for tier in ['tot', 'mid', 'hard']:
                    page.evaluate('''async ([gameId, tier]) => {
                        SQBrainCore.tierFor=()=>tier;
                        await SummerQuest.openGame(gameId,{origin:'world'});
                    }''', [game, tier])
                    page.wait_for_function("brainProbe.debugState() === 'active'")
                    metrics = page.locator('.brain-scene').evaluate('''scene => ({
                      overflow: scene.scrollWidth > scene.clientWidth + 1,
                      controls: [...scene.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({
                        width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height})),
                      scrollable: getComputedStyle(scene).overflowY === 'auto'
                    })''')
                    valid = not metrics['overflow'] and all(b['width'] >= 43 and b['height'] >= 43 for b in metrics['controls']) and metrics['scrollable']
                    bounds = page.locator('.brain-round').bounding_box()
                    valid = valid and bounds['y'] < 180 and bounds['height'] > height / 2 and bounds['y'] + bounds['height'] <= height + 1
                    companion = page.locator('.summer-companion').bounding_box()
                    if companion: valid = valid and companion['y'] + companion['height'] <= bounds['y']
                    results.append((f'{width}x{height}_{game}_{tier}', valid))
                    if tier == 'mid' and (game in ['calc', 'change', 'crunch'] or (game in NEW_SCENES and width in [1024, 360])):
                        page.wait_for_timeout(200)
                        page.screenshot(path=str(out / f'{game}-{width}x{height}.png'))
            # Use the actual coin buttons, including offscreen controls.
            page.evaluate("async () => { window.brainProbe = await SQBrain.openRound({gameId:'change',tier:'mid',kid:'lili',mount:document.getElementById('stage'),isMuted:()=>true}); }")
            page.locator('.brain-change__token[data-v="5"]').click()
            page.locator('.brain-change__token[data-v="5"]').click()
            page.locator('[data-remove="5"]').click()
            results.append((f'{width}_coin_take_back', page.locator('.brain-change__tray-total').inner_text() == 'NT$5'))
            page.locator('[data-act="give"]').click()
            results.append((f'{width}_answer_feedback', bool(page.locator('.brain-round__feedback').inner_text())))
            print(f'Layout and touch controls checked at {width}x{height}', flush=True)
        page.set_viewport_size({'width': 1024, 'height': 768})
        # Space must retain native button activation inside the root keyboard app.
        open_probe(page, 'sentence')
        first_word = page.locator('.brain-sentence__word').first
        first_word.focus()
        first_word.press('Space')
        results.append(('keyboard_space_activates_word_once', first_word.get_attribute('aria-pressed') == 'true' and page.locator('.brain-sentence__slot.is-filled').count() == 1))
        page.locator('[data-act="clear"]').click()
        results.append(('sentence_clear_releases_words', page.locator('.brain-sentence__word:disabled').count() == 0))

        # Finish advanced rounds with a wrong first answer and an unscored retry.
        # Memory study/playback is awaited naturally; no scheduler or clock bypass.
        advanced_shots = set()
        for game in NEW_SCENES:
            open_probe(page, game, 'hard')
            round_data = page.evaluate('JSON.parse(JSON.stringify(brainRound))')
            wrong_count = 0
            for index, item in enumerate(round_data['items']):
                page.wait_for_function("brainProbe.debugState() === 'active'")
                results.append((f'{game}_{index}_topic_visible', item['lesson']['topic'][0] in page.locator('.brain-lesson__topic').inner_text()))
                shot = None
                if game == 'fractions' and item['prompt'].get('mode') == 'left': shot = 'fractions-left'
                if game == 'circuit' and item['prompt'].get('layout') == 'parallel': shot = 'circuit-parallel'
                if game == 'memorymatch' and item['prompt'].get('mode') == 'all': shot = 'memory-all'
                if game == 'patternecho' and item['prompt'].get('reverse'): shot = 'echo-reverse'
                if game == 'soundmatch' and item['prompt'].get('mode') in ['rhyme', 'spelling']: shot = 'sound-' + item['prompt']['mode']
                if shot and shot not in advanced_shots:
                    advanced_shots.add(shot)
                    for width, height in [(1024, 768), (360, 740)]:
                        page.set_viewport_size({'width': width, 'height': height})
                        page.screenshot(path=str(out / f'{shot}-{width}x{height}.png'))
                        results.append((f'{shot}_{width}_fits', page.locator('.brain-scene').evaluate('scene=>scene.scrollWidth<=scene.clientWidth+1')))
                    page.set_viewport_size({'width': 1024, 'height': 768})
                if index == 0:
                    page.locator('[data-lesson-clue]').click()
                    page.wait_for_function("brainProbe.debugState() === 'lesson-clue'")
                    results.append((f'{game}_strategy_clue', item['lesson']['hint'][0] in page.locator('.brain-learning-support__copy').inner_text() and page.locator('.brain-scene button:enabled').count() == 0))
                    paused_ms = page.evaluate('brainProbe.debugActiveMs()')
                    page.wait_for_timeout(150)
                    results.append((f'{game}_clue_pauses_clock', page.evaluate('brainProbe.debugActiveMs()') == paused_ms))
                    page.locator('[data-learning-action="resume"]').click()
                    page.wait_for_function("brainProbe.debugState() === 'active'")
                if game == 'soundmatch' and index == 0:
                    page.locator('.brain-sound__listen').click()
                    results.append(('soundmatch_replay', page.evaluate('brainSpoken.length >= 2')))
                    page.locator('.brain-sound__reveal').click()
                    results.append(('soundmatch_muted_visual_clue', page.locator('.brain-sound__clue').is_visible() and item['prompt']['clue'] in page.locator('.brain-sound__clue').inner_text()))
                if game == 'sentence' and index == 0:
                    results.append(('sentence_answer_not_spoken_before_build', page.evaluate('brainSpoken.length === 0')))
                if game == 'sentence' and index == 1:
                    page.locator('.brain-sentence__word').first.click()
                    page.locator('.brain-sentence__slot').first.click()
                    results.append(('sentence_take_carriage_back', page.locator('.brain-sentence__word:disabled').count() == 0))
                if game in ['fractions', 'balance'] and index == 1:
                    page.locator('.brain-fractions__piece' if game == 'fractions' else '.brain-balance__block').first.click()
                    page.locator('[data-act="undo"]').click()
                    results.append((f'{game}_undo', page.locator('[aria-pressed="true"]').count() == 0))
                if game == 'memorymatch' and index == 0:
                    results.append(('memorymatch_study_hides_cards', page.locator('.brain-memory__back').count() == len(item['prompt']['cards']) and page.locator('.brain-memory__target').is_visible()))
                if game == 'patternecho' and index == 1:
                    page.locator('[data-replay]').click()
                    results.append(('patternecho_playback_blocks_input', page.locator('.brain-echo__pad:disabled').count() == 4))
                    page.wait_for_function("!document.querySelector('.brain-echo__pad').disabled")
                    page.locator('.brain-echo__pad').first.click()
                    page.locator('[data-undo]').click()
                    results.append(('patternecho_undo', all(value == '·' for value in page.locator('.brain-echo__slot').all_text_contents())))
                    page.locator('.brain-echo__pad').first.click()
                    page.locator('[data-clear]').click()
                    results.append(('patternecho_clear', all(value == '·' for value in page.locator('.brain-echo__slot').all_text_contents())))
                wrong = index == 0 or (game == 'memorymatch' and index == 1)
                answer_exercise(page, game, item, wrong=wrong)
                if wrong:
                    wrong_count += 1
                    page.wait_for_function("brainProbe.debugState() === 'lesson-review'")
                    results.append((f'{game}_wrong_answer_teaches', page.locator('.brain-corrective').is_visible() and bool(page.locator('.brain-corrective').inner_text().strip())))
                    results.append((f'{game}_{index}_explains_why', item['lesson']['explanation'][0] in page.locator('.brain-learning-support__copy').inner_text()))
                    if game == 'sentence':
                        page.wait_for_timeout(1300)
                        results.append(('wrong_review_waits_for_child', page.evaluate("brainProbe.debugState() === 'lesson-review' && brainProbe.debugItemIndex() === 0")))
                        page.screenshot(path=str(out / 'sentence-explanation-1024x768.png'))
                    if index == 0:
                        original_answer = page.evaluate('brainProgress.answers[0].given')
                        page.locator('[data-learning-action="retry"]').click()
                        page.wait_for_function("brainProbe.debugState() === 'active'")
                        answer_exercise(page, game, item)
                        page.wait_for_function('brainProbe.debugItemIndex() > 0')
                        results.append((f'{game}_retry_preserves_first_score', page.evaluate('(given)=>brainProgress.answers[0].given===given && !brainProgress.answers[0].correct && brainHud.score===0', original_answer)))
                    else:
                        page.locator('[data-learning-action="next"]').click()
                page.wait_for_function('(index)=>brainProbe.debugItemIndex()>index || brainResult', arg=index)
            results.append((f'{game}_complete_after_mistake', page.evaluate('(count)=>brainResult.score === brainResult.total - count && brainResult.total === brainRound.items.length', wrong_count)))
            results.append((f'{game}_cleans_up', page.evaluate('brainProbe.debugScheduler().activeCount === 0')))
            print(f'{game}: full round, correction and cleanup checked', flush=True)
        results.append(('advanced_modes_captured', {'circuit-parallel', 'fractions-left', 'echo-reverse', 'memory-all', 'sound-rhyme'}.issubset(advanced_shots)))
        # Full new-game round proves it reaches the normal scored finish.
        await_round = '''async () => { window.brainResult=null;window.brainProbe=await SQBrain.openRound({
          gameId:'crunch',tier:'tot',kid:'lili',mount:document.getElementById('stage'),isMuted:()=>true,
          onFinish:r=>window.brainResult=r}); }'''
        page.evaluate(await_round)
        for index in range(8):
            page.wait_for_function("brainProbe.debugState() === 'active'")
            pair = page.evaluate('''() => {
              const target=Number(document.querySelector('.brain-bonds__target strong').textContent);
              const tiles=[...document.querySelectorAll('.brain-bonds__tile')].map(b=>Number(b.querySelector('strong').textContent));
              for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++)if(tiles[i]+tiles[j]===target)return [i,j];
            }''')
            page.locator('.brain-bonds__tile').nth(pair[0]).click()
            page.locator('.brain-bonds__tile').nth(pair[1]).click()
            page.wait_for_function('(index)=>brainProbe.debugItemIndex()>index || brainResult', arg=index)
        results.append(('number_bonds_complete', page.evaluate('brainResult.score === brainResult.total && brainResult.total === 8')))
        results.append(('round_cleans_up', page.evaluate('brainProbe.debugScheduler().activeCount === 0')))
        page.emulate_media(reduced_motion='reduce')
        page.evaluate(await_round)
        page.locator('.brain-bonds__tile').first.click()
        results.append(('reduced_motion', page.locator('.brain-bonds__tile').first.evaluate("b => b.getAnimations().every(a => a.effect.getKeyframes().every(k => !k.transform || k.transform === 'none'))")))
        page.evaluate("SummerQuest.openGame('crunch',{origin:'world'})")
        page.wait_for_selector('.brain-bonds')
        page.evaluate('SQPlatform.triggerBack()')
        results.append(('back_returns_to_world', page.locator('#world').is_visible()))
        page.wait_for_function("!!navigator.serviceWorker.controller", timeout=20000)
        results.append(('bonds_precached', page.evaluate("async () => !!(await caches.match(new URL('js/brain/scenes/bonds.js',location.href).href))")))
        for game in NEW_SCENES:
            cached = page.evaluate("async id => !!(await caches.match(new URL('js/brain/scenes/'+id+'.js',location.href).href))", game)
            results.append((f'{game}_precached', cached))
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('!!window.SummerQuest && !!window.SQBrain')
        if page.locator('.hero').first.is_visible(): page.locator('.hero').first.click()
        page.evaluate("SummerQuest.openGame('crunch',{origin:'world'})")
        page.wait_for_selector('.brain-bonds__tile')
        results.append(('bonds_offline_reload', page.locator('.brain-bonds__tile').count() >= 4))
        for game, selector in NEW_SCENES.items():
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('!!window.SummerQuest && !!window.SQBrain')
            if page.locator('.hero').first.is_visible(): page.locator('.hero').first.click()
            page.evaluate("async game => { SQBrainCore.tierFor=()=> 'tot'; await SummerQuest.openGame(game,{origin:'world'}); }", game)
            page.wait_for_selector(selector)
            page.wait_for_function('''() => [...document.querySelectorAll('.brain-scene button')].some(button=>!button.disabled)''')
            results.append((f'{game}_offline_reload', page.locator(selector).is_visible()))
        print('All eight new scenes opened after offline reloads', flush=True)
        context.close()
        browser.close()
    report = {'results': [{'id': label, 'ok': ok} for label, ok in results], 'errors': errors, 'ok': all(ok for _, ok in results) and not errors}
    (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    for label, ok in results:
        if not ok: print('FAIL', label)
    print(f"{sum(ok for _, ok in results)}/{len(results)} browser checks passed; {len(errors)} page errors")
    for error in errors: print(error)
    return report['ok']

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--browser', default='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')
    parser.add_argument('--out', type=Path, default=ROOT / '.tmp/brain-gym-ui')
    args = parser.parse_args()
    raise SystemExit(0 if run(args.browser, args.out) else 1)
