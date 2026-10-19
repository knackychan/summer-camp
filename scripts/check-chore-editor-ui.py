"""Papa's chore editor in the real admin.html, then the edited list on a kid's tablet
(docs/plans/2026-10-19-school-mode-chores/ slice 04, D8).

Admin runs on the in-memory fake Supabase of check-admin-cleanup-ui.py; the kid app runs
local-only. The server side of family_chore is proven on real SQL by
scripts/points-database.test.mjs. Nothing leaves 127.0.0.1.
Run: python scripts/check-chore-editor-ui.py --browser <Chromium> [--out <dir>]
"""
import argparse
import functools
import http.server
import importlib.util
import json
import threading
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


admin = load("admin_cleanup", "check-admin-cleanup-ui.py")
recovery = load("recovery", "check-architecture-recovery.py")
QUIET = load("school_ui", "check-school-mode-ui.py").QUIET


def run(browser, base, out):
    page, errors = admin.open_admin(browser, base, out)
    page.goto(base + "/admin.html#quests", wait_until="domcontentloaded")
    page.wait_for_selector("[data-qstab=points]")
    page.click("[data-qstab=points]")
    page.wait_for_selector("#choresForm")
    rows = page.locator(".ce-row").count()
    assert rows == 17, rows

    # rename a built-in, keep garlic to Luis, switch the altar off, add Papa's own chore
    page.fill('[data-ce="en"][data-i="0"]', "Rinse the rice")
    for kid in ("lucien", "lili"):
        page.uncheck('[data-ce="kid"][data-i="9"][value="%s"]' % kid)
    page.uncheck('[data-ce="enabled"][data-i="14"]')
    page.click("#ceAdd")
    new = rows
    page.fill('[data-ce="icon"][data-i="%d"]' % new, "🪴")
    page.fill('[data-ce="en"][data-i="%d"]' % new, "Water the plants")
    page.click('button[type=submit]:has-text("Save chores")')  # no 中文 yet: refused
    page.wait_for_timeout(300)
    assert page.evaluate("!(__db.family_settings.find(r => r.key === 'chores_v1'))"), "a chore without 中文 is not saved"
    page.fill('[data-ce="zh"][data-i="%d"]' % new, "澆花")
    page.fill('[data-ce="points"][data-i="%d"]' % new, "15")
    page.click('[data-ce-move="%d:-1"]' % new)
    page.locator(".ce-row").nth(new - 1).scroll_into_view_if_needed()
    page.screenshot(path=str(out / "chore-editor.png"))
    page.click('button[type=submit]:has-text("Save chores")')
    page.wait_for_function("() => __db.family_settings.some(r => r.key === 'chores_v1')")
    saved = json.loads(page.evaluate("__db.family_settings.find(r => r.key === 'chores_v1').value"))
    items = {c["id"]: c for c in saved["items"]}
    assert items["rice"]["label"] == ["Rinse the rice", "洗米"]
    assert items["garlic"]["kids"] == ["luis"]
    assert items["altar"]["enabled"] is False
    plant = items["c_water_the_plants"]
    assert (plant["points"], plant["check"], plant["label"]) == (15, "parent", ["Water the plants", "澆花"]), plant
    assert [c["id"] for c in saved["items"]].index("c_water_the_plants") == new - 1, "moved up one"
    assert not errors, errors
    page.context.close()

    # the kid's tablet shows Papa's list and sends the new chore as family_chore
    context = recovery.context_for(browser, {"sq:kid": "lili", "sq:view": "hub", "sq:hubTab": "day"})
    kid = context.new_page()
    kid.set_viewport_size({"width": 1024, "height": 600})
    kid.clock.set_fixed_time(datetime(2026, 10, 19, 9, 10, tzinfo=timezone.utc))
    kid.goto(base + "/index.html", wait_until="domcontentloaded")
    recovery.ready(kid)
    recovery.wait_screen(kid, "hub")
    kid.evaluate("v => { SQHost.store.familySettings.chores_v1 = v; SQHost.store.familySettings.day_mode_v1 = JSON.stringify({mode:'school'}); }", json.dumps(saved))
    kid.evaluate("SummerQuest.navigate('day')")
    kid.evaluate("renderMyDay(true)")
    kid.wait_for_selector('[data-chore="c_water_the_plants"]')
    kid.wait_for_timeout(400)
    kid.evaluate(QUIET)
    card = kid.locator("#choresCard").inner_text()
    assert "Rinse the rice" in card and "澆花" in card and "+15 points" in card, card
    assert kid.locator('[data-chore="garlic"]').count() == 0, "garlic is Luis's job"
    assert kid.locator('[data-chore="altar"]').count() == 0, "switched off"
    kid.click('[data-chore="c_water_the_plants"]')
    kid.click("#choreYes")
    kid.wait_for_function("() => document.querySelector('[data-chore=\"c_water_the_plants\"]').classList.contains('chore--waiting')")
    q = kid.evaluate("SQHost.store.queue.filter(op => op.type === 'pointClaim').map(op => op.claim).find(c => c.kind === 'family_chore')")
    assert (q["slot"], q["amount"], q["evidence"]["label"]) == ("c_water_the_plants", 15, ["Water the plants", "澆花"]), q
    assert kid.evaluate("pointsGateState('lili').today") >= 15
    # the home-help guide offers Papa's chores alongside its eight
    ids = kid.evaluate("SQHomeHelp.rank(guideRanking('lili','evening',{time:'lots'})).map(x => x.item.id)")
    assert "chore:rice" in ids and "chore:c_water_the_plants" not in ids, ids
    kid.locator('[data-chore="c_water_the_plants"]').scroll_into_view_if_needed()
    kid.screenshot(path=str(out / "kid-edited-chores.png"))
    context.close()
    return {"admin_rows": rows, "guide": len(ids)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "test-results/school-mode")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    http.server.ThreadingHTTPServer.request_queue_size = 128
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(recovery.Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser, headless=True)
            print(json.dumps({"browser": browser.version, **run(browser, "http://127.0.0.1:%d" % server.server_port, args.out)}))
            browser.close()
    finally:
        server.shutdown()
    print("chore editor UI check passed")


if __name__ == "__main__":
    main()
