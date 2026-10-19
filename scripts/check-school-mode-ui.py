"""School mode, after-school plan, home chores and bonus tasks in the real root runtime
(docs/plans/2026-10-19-school-mode-chores/).

Run with --browser <Chromium executable> (Chrome 138 for the Android 8 baseline).
Local-only mode, external services blocked, clock fixed to a Taipei day.
Screenshots go to --out for Papa's look.
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
spec = importlib.util.spec_from_file_location("recovery", ROOT / "scripts/check-architecture-recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

GATE = {"enabled": True, "threshold": {"luis": 50, "lili": 50, "lucien": 40}, "schoolThreshold": {"luis": 50, "lili": 40, "lucien": 30}}
SETTINGS = """([gate, mode]) => {
  SQHost.store.familySettings.games_gate_v1 = JSON.stringify(gate);
  SQHost.store.familySettings.day_mode_v1 = JSON.stringify({mode});
}"""
BRAIN_DONE = """kid => {
  const day = SQ_DAY.iso(), trio = SQBrainCore.dailyThree(kid, day, SQHost.store.familySettings || {});
  SQHost.progress[kid].brain = {d: day, done: Object.fromEntries(trio.map(x => [x, 1])), starred: false};
}"""
# Summer's own "a quest is ready" bubble floats over the list; hide it so the
# screenshots show the plan and the chores (it is not part of this feature).
QUIET = """() => {
  for (const el of document.querySelectorAll('body *')) {
    if (getComputedStyle(el).position === 'fixed' && (el.id === 'summerCompanion' || /READY WHEN YOU ARE|Open quest/.test(el.textContent)) && !el.querySelector('#dayList')) el.style.visibility = 'hidden';
  }
}"""
CLAIM = """([kid, kind, amount, status]) => {
  SQHost.store.pointClaims.push({kid_id: kid, day: SQ_DAY.iso(), kind, slot: kind === 'table_helper' ? 'dinner' : 'default', amount, status, id: 'x-' + kind});
}"""


def open_day(browser, base, kid, when, mode, size=(1024, 600)):
    context = recovery.context_for(browser, {"sq:kid": kid, "sq:view": "hub", "sq:hubTab": "day"})
    page = context.new_page()
    page.set_viewport_size({"width": size[0], "height": size[1]})
    page.clock.set_fixed_time(when)
    page.goto(base + "/index.html", wait_until="domcontentloaded")
    recovery.ready(page)
    recovery.wait_screen(page, "hub")
    page.evaluate(SETTINGS, [GATE, mode])
    page.evaluate("SummerQuest.navigate('day')")
    page.evaluate("renderMyDay(true)")
    page.wait_for_selector("#choresCard")
    page.wait_for_timeout(400)
    page.evaluate(QUIET)
    return context, page


def run(browser, base, out):
    monday = datetime(2026, 10, 19, 9, 10, tzinfo=timezone.utc)    # Mon 17:10 Taipei
    saturday = datetime(2026, 10, 24, 9, 10, tzinfo=timezone.utc)  # Sat 17:10 Taipei
    result = {}

    # 1. school mode on a weekday: the after-school plan, nothing to tick
    context, page = open_day(browser, base, "lili", monday, "school")
    assert page.evaluate("dayMode()") == "school"
    rows = page.locator("[data-schoolrow]").count()
    assert rows == 8, rows
    assert page.locator("#dayList [data-done]").count() == 0, "the school plan has no tick buttons"
    assert page.locator(".school-row.now").count() == 1
    text = page.locator("#dayList").inner_text()
    assert "Brain Gym first" in text or "先做頭腦體操" in text, "screen time says Brain Gym comes first"
    assert page.locator("[data-chore]").count() == 16, "14 chores + 2 bonus tasks"
    page.evaluate("document.querySelector('.school-hero').scrollIntoView({block: 'start'})")
    page.wait_for_timeout(200)
    page.screenshot(path=str(out / "school-plan.png"), full_page=False)
    page.locator("#choresCard").scroll_into_view_if_needed()
    page.screenshot(path=str(out / "school-chores.png"), full_page=False)

    # 2. a chore: "All done?", then waiting for Papa; points count toward the bar
    page.click('[data-chore="rice"]')
    page.wait_for_selector("#choreConfirm")
    page.screenshot(path=str(out / "chore-confirm.png"), full_page=False)
    page.click("#choreYes")
    page.wait_for_function("() => document.querySelector('[data-chore=\"rice\"]').classList.contains('chore--waiting')")
    assert page.evaluate("pointsGateState('lili').today") == 5

    # 3. a bonus task waits for Papa but never counts toward Games
    page.click('[data-chore="gym"]')
    page.click("#choreYes")
    page.wait_for_function("() => document.querySelector('[data-chore=\"gym\"]').classList.contains('chore--waiting')")
    assert page.evaluate("pointsGateState('lili').today") == 5, "bonus points stay out of the gate"

    # 4. Brain Gym + enough chores: screen time opens (school bar for Lili is 40)
    page.evaluate(BRAIN_DONE, "lili")
    for kind, amt in (("dishwasher_load", 10), ("dishwasher_unload", 10), ("garden_toys", 10), ("bowls_tidy", 5)):
        page.evaluate(CLAIM, ["lili", kind, amt, "pending"])
    page.evaluate("renderMyDay(true)")
    assert page.evaluate("pointsGateState('lili').open"), page.evaluate("pointsGateState('lili')")
    assert not page.evaluate("gameLockState('lili').locked")
    page.locator(".school-open").scroll_into_view_if_needed()
    page.screenshot(path=str(out / "school-screen-open.png"), full_page=False)
    result["school"] = {"rows": rows, "today": page.evaluate("pointsGateState('lili').today")}
    context.close()

    # 5. weekend with school mode on: the holiday day, chores card below it
    context, page = open_day(browser, base, "luis", saturday, "school")
    assert page.evaluate("dayMode()") == "holiday"
    assert page.locator("[data-schoolrow]").count() == 0
    assert page.locator("#dayList [data-done]").count() > 0, "holiday blocks keep their ticks"
    assert page.evaluate("pointsGateState('luis').threshold") == 50, "weekend uses the holiday bar"
    page.locator("#choresCard").scroll_into_view_if_needed()
    page.screenshot(path=str(out / "weekend-holiday-chores.png"), full_page=False)
    context.close()

    # 6. phone portrait: the chore grid fits with no sideways scroll
    context, page = open_day(browser, base, "lucien", monday, "school", size=(390, 800))
    page.locator("#choresCard").scroll_into_view_if_needed()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    page.screenshot(path=str(out / "school-chores-portrait.png"), full_page=False)
    context.close()
    return result


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
    print("school mode UI check passed")


if __name__ == "__main__":
    main()
