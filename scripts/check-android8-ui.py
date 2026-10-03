"""Exercise the Android 8 browser baseline and real WebGL1 fallback.

Run with Chrome 138 --browser <executable>. Desktop GPU emulation is not an
Android hardware test. All profiles are synthetic and external services blocked.
"""
import argparse
import functools
import http.server
import importlib.util
import json
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recovery", ROOT / "scripts/check-architecture-recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

PROBE = """mode => {
  window.sqGraphicsTestMode = mode;
  Object.defineProperty(navigator, 'userAgent', {value:'Mozilla/5.0 (Linux; Android 8.0.0; Test Tablet) AppleWebKit/537.36 Chrome/138.0.0.0 Mobile Safari/537.36'});
  Object.defineProperty(navigator, 'deviceMemory', {value:2});
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(kind, options) {
    if (/webgl/.test(kind) && (sqGraphicsTestMode === 'none' || (sqGraphicsTestMode === 'webgl1' && kind === 'webgl2'))) return null;
    const ctx = get.call(this, kind, options);
    if (ctx && /webgl/.test(kind) && !this.sqTestContext) {
      this.sqTestContext = ctx; this.sqTestKind = kind; this.sqTestDraws = 0;
      for (const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']) {
        if (!ctx[name]) continue;
        const draw = ctx[name];
        ctx[name] = (...args) => { this.sqTestDraws++; return draw.apply(ctx,args); };
      }
    }
    return ctx;
  };
}"""


def rendered(page, mode):
    page.wait_for_function("[...document.querySelectorAll('#stage canvas')].some(c=>c.sqTestDraws>10)")
    result = page.evaluate("""() => {
      const c = [...document.querySelectorAll('#stage canvas')].find(c=>c.sqTestDraws>10);
      const gl = c.sqTestContext;
      return {kind:c.sqTestKind,draws:c.sqTestDraws,width:c.width,cssWidth:c.getBoundingClientRect().width,
        antialias:gl.getContextAttributes().antialias,glError:gl.getError()};
    }""")
    assert result['kind'] == mode, result
    assert result['width'] <= result['cssWidth'] + 1, result
    assert not result['antialias'] and result['glError'] == 0, result
    return result


def run_case(browser, base, mode, out, offline=False):
    context = recovery.context_for(browser, offline=offline)
    context.add_init_script("(" + PROBE + ")(" + json.dumps(mode) + ");")
    errors = []
    page = context.new_page()
    page.set_default_timeout(20000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    requests = []
    page.on('request', lambda request: requests.append(request.url))
    result = {'mode':mode,'offline':offline,'games':[],'pageErrors':errors}
    try:
        recovery.boot(page, base)
        if offline:
            page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=60000)
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded')
            recovery.ready(page)
            recovery.wait_world(page)
        page.evaluate('sqTestMode.set(true)')
        for game in ('solar','monster-truck','bricklab'):
            page.evaluate('mode=>window.sqGraphicsTestMode=mode', mode)
            opened = page.evaluate('id=>SummerQuest.open("game:"+id)', game)
            if mode == 'none':
                assert opened == {'ok':False,'reason':'launch_failed'}, opened
                alert = page.locator('#stage [role="alert"]')
                assert alert.is_visible() and '3D' in alert.inner_text(), alert.inner_text()
                assert page.locator('#back').is_visible()
                page.evaluate("window.sqGraphicsTestMode='webgl1'")
                alert.locator('button').click()
                detail = rendered(page, 'webgl')
                detail['retryRecovered'] = True
            else:
                assert opened['ok'], opened
                detail = rendered(page, 'webgl' if mode == 'webgl1' else 'webgl2')
                # A genuine graphics-context loss must stop draws and recover.
                page.evaluate("""() => {
                  const c=[...document.querySelectorAll('#stage canvas')].find(c=>c.sqTestDraws>10);
                  window.sqLostCanvas=c;
                  window.sqLoseExtension=c.sqTestContext.getExtension('WEBGL_lose_context');
                  if(!sqLoseExtension)throw new Error('No context-loss test extension');
                  sqLoseExtension.loseContext();
                }""")
                page.wait_for_function('sqLostCanvas.sqTestContext.isContextLost()')
                page.wait_for_timeout(150)
                lost_draws = page.evaluate('sqLostCanvas.sqTestDraws')
                page.wait_for_timeout(100)
                assert page.evaluate('sqLostCanvas.sqTestDraws') == lost_draws
                page.evaluate('sqLoseExtension.restoreContext()')
                page.wait_for_function('!sqLostCanvas.sqTestContext.isContextLost() && sqLostCanvas.sqTestDraws > ' + str(lost_draws))
                detail['contextRestored'] = True
            page.screenshot(path=str(out / (('offline-' if offline else '') + mode + '-' + game + '.png')))
            result['games'].append(dict(id=game, **detail))
            recovery.back(page,'world')
            recovery.wait_world(page)
            assert not page.locator('#stage canvas').count()
        # Other activities remain playable even without 3D support.
        assert page.evaluate('SummerQuest.open("game:calc")')['ok']
        recovery.wait_screen(page, 'game')
        recovery.back(page, 'world')
        page.reload(wait_until='domcontentloaded')
        recovery.ready(page)
        recovery.wait_world(page)
        assert page.evaluate('localStorage.getItem("sq:kid")') == 'luis'
        legacy = any('/three-legacy/' in url for url in requests)
        assert legacy == (mode != 'webgl2'), requests
        result['legacyDownloaded'] = legacy
        assert not errors, errors
        result['ok'] = True
    except Exception as error:
        result.update(ok=False, error=str(error))
    finally:
        context.close()
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', required=True)
    parser.add_argument('--target', choices=['source','web'], default='source')
    parser.add_argument('--out', type=Path, default=ROOT / 'test-results/android8')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(('127.0.0.1',0), functools.partial(recovery.Handler, directory=str(recovery.TARGETS[args.target])))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.browser, headless=True,
                args=['--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
            report = {'browser':browser.version,'target':args.target,
                'scope':'Desktop Chromium engine, emulated Android 8 identity and 2GB memory, real WebGL rendering; no Android 8 hardware attached.',
                'cases':[run_case(browser, 'http://127.0.0.1:'+str(server.server_port), mode, args.out) for mode in ('webgl2','webgl1','none')]}
            report['cases'].append(run_case(browser, 'http://127.0.0.1:'+str(server.server_port), 'webgl1', args.out, offline=True))
            browser.close()
        report['ok'] = all(case['ok'] for case in report['cases'])
        (args.out / 'graphics.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        return 0 if report['ok'] else 1
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    raise SystemExit(main())
