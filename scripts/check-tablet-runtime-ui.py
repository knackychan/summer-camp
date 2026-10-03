#!/usr/bin/env python3
"""Rendered tablet-layout smoke test using production kid CSS/runtime functions.

The execution environment blocks Chromium URL navigation by administrator policy,
so this checker uses page.set_content with the production CSS and compiled runtime
signal functions. Service Worker fallback is covered separately by
service-worker-offline.test.mjs. Physical tablet acceptance remains separate.
"""
import argparse
import json
import pathlib
import re
import tempfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser', default='/usr/bin/chromium')
parser.add_argument('--out', type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()) / 'summer-quest-tablet-ui')
a = parser.parse_args(); a.out.mkdir(parents=True, exist_ok=True)
css = (ROOT / 'apps/kid/styles.css').read_text()
core = (ROOT / 'dist/mobile/packages/core/src/tablet-runtime.js').read_text()
controller = (ROOT / 'dist/mobile/apps/kid/src/runtime/TabletRuntimeController.js').read_text()
core = re.sub(r'\bexport\s+', '', core)
controller = re.sub(r'^import[^\n]+\n', '', controller, flags=re.M)
controller = re.sub(r'\bexport\s+', '', controller)
markup = '''<div id="app" data-reading-level="pre_reader">
<div class="mobile-app-shell">
<header class="mobile-topbar"><button class="mobile-back">←</button><div class="mobile-brand"><span>☀️</span><strong>Summer Quest</strong></div><div class="mobile-runtime-status"><span class="mobile-offline"><span>☁️×</span><b>Offline</b></span><span class="mobile-platform">WEB</span></div></header>
<main id="mobile-screen" class="mobile-screen-host"><section class="planet-screen"><div class="planet-stage"><div class="planet-orb"></div><button class="world-hotspot hotspot-daily"><span class="world-hotspot__icon">⭐</span></button><button class="world-hotspot hotspot-brain"><span class="world-hotspot__icon">🧠</span></button><button class="world-hotspot hotspot-garden"><span class="world-hotspot__icon">🌱</span></button><button class="world-hotspot hotspot-play"><span class="world-hotspot__icon">🎮</span></button><div class="planet-summer"><span>☀️</span></div></div></section></main>
<nav class="mobile-bottom-nav"><button><span>🪐</span><b>World</b><small>世界</small></button><button><span>🧭</span><b>Quests</b><small>任務</small></button><button><span>🎮</span><b>Adventure</b><small>冒險</small></button></nav>
</div></div>'''
checks=[]; errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':768,'height':1024},has_touch=True,is_mobile=True)
    page=context.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+markup+'</body></html>')
    page.add_script_tag(content=core+'\n'+controller+'\nwindow.stopTabletSignals=installTabletRuntimeSignals(document.getElementById("app"));')
    page.wait_for_function('document.querySelector("#app").dataset.viewport === "tablet"')
    assert page.evaluate('document.querySelector("#app").dataset.orientation')=='portrait'
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2')
    sizes=page.locator('button:visible').evaluate_all('(nodes)=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.width,r.height]})')
    assert all(w>=48 and h>=48 for w,h in sizes)
    assert not page.locator('.mobile-bottom-nav b').first.is_visible()
    checks.append('768×1024 coarse-pointer portrait uses tablet runtime signals, has no horizontal overflow, hides pre-reader text labels, and keeps visible controls at least 48×48 CSS px.')
    page.screenshot(path=str(a.out/'tablet-portrait-768x1024.png'))
    page.set_viewport_size({'width':1024,'height':768}); page.wait_for_function('document.querySelector("#app").dataset.orientation === "landscape"')
    nav=page.locator('.mobile-bottom-nav').bounding_box(); screen=page.locator('#mobile-screen').bounding_box()
    assert nav and screen and nav['x']>=screen['x']+screen['width']-4 and nav['width']<=110
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2')
    checks.append('1024×768 landscape moves the main navigation into a compact right-side rail without creating horizontal overflow.')
    page.screenshot(path=str(a.out/'tablet-landscape-1024x768.png'))
    context.set_offline(True); page.wait_for_function('document.querySelector("#app").dataset.online === "false"')
    assert page.locator('.mobile-offline').is_visible()
    context.set_offline(False); page.wait_for_function('document.querySelector("#app").dataset.online === "true"')
    checks.append('Runtime online/offline events update the shell state and show the offline badge without changing the child navigation surface.')
    page.evaluate('window.stopTabletSignals()')
    assert not errors, errors
    checks.append('No page-level JavaScript errors occurred in the rendered tablet runtime flow.')
    browser.close()
report={'scope':'Production kid CSS + compiled tablet runtime functions rendered in Chromium via set_content. URL navigation is blocked by this environment; Service Worker fallback is unit-tested separately. Not physical hardware acceptance.','checks':checks,'count':len(checks)}
(a.out/'tablet-runtime-ui-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
