"""Check the real child UI on short landscape tablets, with isolated local saves.

Requires Python Playwright. Pass --browser for an installed Chromium executable.
Use --baseline to record layout failures without stopping the inventory sweep.
"""
import argparse
import functools
import http.server
import json
import runpy
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RECOVERY = runpy.run_path(str(ROOT / 'scripts/check-architecture-recovery.py'))

LAYOUT = """selector => {
  const root = document.querySelector(selector);
  const rect = node => {const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
  const visible = node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
  const clipped=[];
  for(const node of root.querySelectorAll('button, input, select, .key, .cue, .word, .bigletter, .picword, .msg, .mcraft-copy, .mcraft-body, .mcraft-pull')) {
    if(!visible(node))continue;
    const r=node.getBoundingClientRect();
    let container=node.parentElement;
    while(container && container!==document.body) {
      const style=getComputedStyle(container), box=container.getBoundingClientRect();
      if(['auto','scroll'].includes(style.overflowY) && container.scrollHeight>container.clientHeight+1) break;
      if(style.overflowY==='hidden' && (r.top<box.top-2 || r.bottom>box.bottom+2)) {
        clipped.push({element:node.id||node.className,text:node.textContent.slice(0,60),container:container.id||container.className,rect:rect(node)});break;
      }
      container=container.parentElement;
    }
  }
  return {root:rect(root),pageWidth:document.documentElement.scrollWidth,viewport:{width:innerWidth,height:innerHeight},
    stage:visible(document.querySelector('#stage'))?rect(document.querySelector('#stage')):null,
    clipped,keyboard:[...root.querySelectorAll('.key')].filter(visible).map(rect)};
}"""


def run(args):
    args.out.mkdir(parents=True, exist_ok=True)
    report = {'layouts': {}, 'checks': [], 'pageErrors': []}
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0),
        functools.partial(RECOVERY['Handler'], directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()

    def check(name, ok, detail=None):
        report['checks'].append({'name': name, 'ok': bool(ok), 'detail': detail})
        if not ok:
            print('FAIL ' + name, flush=True)

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(**({'executable_path': args.browser} if args.browser else {}), headless=True)
            report['browser'] = browser.version
            for width, height, touch in ((1280,600,True),(1280,800,True),(1024,640,True),(1280,600,False)):
                label = f'{width}x{height}-' + ('touch' if touch else 'mouse')
                context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=touch, service_workers='block')
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith('http://127.0.0.1:') else route.abort())
                page = context.new_page()
                page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}/index.html', wait_until='domcontentloaded')
                RECOVERY['ready'](page)
                page.locator('.hero').last.click()
                RECOVERY['wait_world'](page)
                # Complete the daily gate in this fresh, local-only test profile.
                page.evaluate("""() => {
                  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((a,p)=>(a[p.type]=p.value,a),{});
                  SQHost.progress.luis.brain={d:`${parts.year}-${parts.month}-${parts.day}`,done:Object.fromEntries(SQManifest.filter(x=>x.brain).map(x=>[x.id,{score:8,ms:20000}])),starred:true};
                }""")

                def inspect(name, selector, full_screen=True):
                    page.wait_for_timeout(120)
                    layout = page.evaluate(LAYOUT, selector)
                    report['layouts'][label + '/' + name] = layout
                    check(label+'/'+name+'/horizontal', layout['pageWidth'] <= width+2)
                    if full_screen:
                        check(label+'/'+name+'/screen', layout['root']['bottom'] <= height+2 and layout['root']['y'] >= -2, layout['root'])
                        check(label+'/'+name+'/unclipped', not layout['clipped'], layout['clipped'])
                    if layout['keyboard']:
                        check(label+'/'+name+'/keyboard', all(k['height']>=43.99 and k['width']>=43.99 and k['bottom']<=height for k in layout['keyboard']))
                    if width==1280 and height==600 and touch:
                        page.screenshot(path=str(args.out/(name+'.png')))

                inspect('world', '#world')
                games = page.evaluate('SQManifest.filter(x=>!x.music&&!x.brain).map(x=>x.id)')
                for game in games:
                    result = page.evaluate('id=>SummerQuest.openGame(id)', game)
                    check(label+'/'+game+'/launch', result.get('ok'), result)
                    if result.get('ok'): inspect(game, '#game')
                    if game == 'machines':
                        for kind in ('dig','heli'):
                            page.evaluate("""() => {const g=SQGames.get('machines'),s=g.debugState();for(const c of s.kind==='race'?s.word:String(s.num))g.key(c);}""")
                            page.wait_for_selector('.game-scene--machines-'+kind)
                            inspect('machines-'+kind, '#game')
                    if game == 'paint':
                        sizes = page.locator('.pa button:visible').evaluate_all('(nodes)=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}))')
                        check(label+'/paint/targets', bool(sizes) and all(n['w']>=43.99 and n['h']>=43.99 for n in sizes), sizes)
                    if game == 'vocab':
                        page.locator('#setbar [data-m=shop]').click()
                        for mode in ('copy','recall','translate','sentences'):
                            page.locator(f'#setbar [data-lv={mode}]').click()
                            inspect('vocab-shop-'+mode, '#game')
                            word = page.locator('#vword').bounding_box()
                            stage = page.locator('#stage').bounding_box()
                            check(label+'/vocab-shop-'+mode+'/answer-visible', word['y']>=stage['y'] and word['y']+word['height']<=stage['y']+stage['height'], word)
                    if game == 'solar':
                        check(label+'/solar/targets', page.locator('.speeds .chip:visible').evaluate_all('(nodes)=>nodes.length>0&&nodes.every(n=>n.getBoundingClientRect().height>=44)'))
                    if game == 'kitchen':
                        box = page.locator('.kq-notice').bounding_box()
                        check(label+'/kitchen/notice', box and box['y']+box['height']<=height, box)
                for instrument in ('piano','pads','moog'):
                    result = page.evaluate('id=>SummerQuest.openMusic(id)', instrument)
                    check(label+'/'+instrument+'/launch', result.get('ok'), result)
                    if result.get('ok'): inspect(instrument, '#music')
                    check(label+'/'+instrument+'/targets', page.locator('#music button:visible').evaluate_all("(nodes)=>nodes.filter(n=>!n.closest('.keybed')).every(n=>n.getBoundingClientRect().height>=43.99)"))
                for book in ('space','animals','minecraft'):
                    result = page.evaluate('id=>SummerQuest.openBook(id)', book)
                    check(label+'/'+book+'/launch', result.get('ok'), result)
                    if result.get('ok'):
                        inspect(book, '#book')
                        if book == 'minecraft':
                            page.locator('#bookLangToggle').click()
                            inspect(book+'-zh', '#book')
                            page.locator('#bookNext').click()
                            page.wait_for_timeout(250)
                            inspect(book+'-next', '#book')
                        page.locator('#bookViewToggle').click()
                        inspect(book+'-pages', '#book')
                for section in ('quests','games','books','music','learn','day','rewards','ask','captain'):
                    result = page.evaluate('id=>SummerQuest.navigate(id)', section)
                    if result.get('ok'): inspect('hub-'+section, '#hub', False)
                    if section == 'quests':
                        dialogue = page.locator('#questDialogue').bounding_box()
                        nav = page.locator('#hubTabs').bounding_box()
                        check(label+'/quests/choices-above-navigation', dialogue and nav and dialogue['y']+dialogue['height']<=nav['y'], dialogue)
                        result = page.evaluate("SummerQuest.openQuest('room_rescue')")
                        check(label+'/quest/launch', result.get('ok'), result)
                        if result.get('ok'):
                            inspect('quest-dialog', '#questOverlay')
                            card = page.locator('#questOverlay .card').bounding_box()
                            check(label+'/quest/dialog', card and card['y']>=0 and card['y']+card['height']<=height, card)
                            page.evaluate('SQPlatform.triggerBack()')
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    check('no page errors', not report['pageErrors'], report['pageErrors'])
    (args.out/'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    failed = [row for row in report['checks'] if not row['ok']]
    print(f"{len(report['checks'])-len(failed)}/{len(report['checks'])} checks passed; {len(report['layouts'])} layouts. Report: {args.out/'report.json'}")
    if not args.baseline:
        assert not failed, f'{len(failed)} tablet layout checks failed'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser')
    parser.add_argument('--out', type=Path, default=ROOT/'test-results/small-tablet')
    parser.add_argument('--baseline', action='store_true')
    run(parser.parse_args())
