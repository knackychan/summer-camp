"""The parents' phone screens in the real admin.html (docs/plans/2026-10-19-parent-app-layout/).

An in-memory fake Supabase stands in for the database (the same pattern as
check-admin-cleanup-ui.py). Nothing leaves 127.0.0.1. The clock is fixed to a
Monday afternoon in Taipei with school mode on.
Run: python scripts/check-parent-app-ui.py [--browser <Chrome 138>] [--out <dir>]
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

NOW = "2026-10-19T08:40:00Z"  # Monday 16:40 in Taipei
TODAY = "2026-10-19"
GATE = {"enabled": True, "threshold": {"luis": 50, "lili": 50, "lucien": 40},
        "schoolThreshold": {"luis": 40, "lili": 30, "lucien": 20}, "futureKey": "kept"}
CONFIG = 'window.SQ_CONFIG={SUPABASE_URL:"http://fake.supabase.local",SUPABASE_ANON_KEY:"fake-anon"};'
FAKE = r"""(() => {
  const now = Date.now(), ago = m => new Date(now - m * 60000).toISOString(), day = '%(today)s';
  const claim = (id, kid, kind, amount, m, label, extra) => Object.assign({id, kid_id: kid, day, kind, slot: 'default', work_id: kind, amount, status: 'pending', created_at: ago(m), evidence: label ? {label, completed: true} : {}}, extra || {});
  const db = window.__db = {
    kids: [{id:'lucien',pin:''},{id:'lili',pin:''},{id:'luis',pin:''}],
    points_claims: [
      claim('c1','lili','rice_wash',5,4,['Wash the rice','洗米']),
      claim('c2','luis','dishwasher_unload',10,12,['Empty the dishwasher','把洗碗機的碗盤拿出來']),
      claim('c3','luis','gym_exercise',20,25,['Gym exercise','健身運動']),
      claim('c4','lucien','floor_toys',5,40,['Pick up toys from the floor','把地上的玩具撿起來']),
      Object.assign(claim('c5','luis','vacuum_floor',10,90,['Vacuum the floor','用吸塵器吸地']), {status:'confirmed'}),
      Object.assign(claim('c6','lili','desk_tidy',5,120,['Tidy up your desk','整理書桌']), {status:'confirmed'})
    ],
    points_requests: [{id:'r1',kid_id:'luis',reward_id:'movie_pick',label:['Movie pick','選電影'],points:200,status:'requested',created_at:ago(8)}],
    point_totals: [
      {kid_id:'lucien',total_earned:120,spent:0,available:120,pending:5},
      {kid_id:'lili',total_earned:300,spent:50,available:250,pending:5},
      {kid_id:'luis',total_earned:800,spent:200,available:600,pending:30}],
    family_settings: [
      {key:'games_gate_v1',value:JSON.stringify(%(gate)s)},
      {key:'day_mode_v1',value:JSON.stringify({mode:'school'})},
      {key:'braingate_lucien',value:day}],
    brain_done: [
      {kid_id:'luis',day,game_id:'a'},{kid_id:'luis',day,game_id:'b'},{kid_id:'luis',day,game_id:'c'},
      {kid_id:'lili',day,game_id:'a'}],
    asks: [{id:'q1',kid_id:'lili',kind:'question',body:'Can we go to the park?',answer:null,created_at:ago(30)}],
    passes: [], photos: [], help_claims: []
  };
  window.__fake = {rpcs: []};
  const ok = data => Promise.resolve({data, error: null});
  function query(table) {
    let rows = null, single = false; const filters = [];
    const result = () => {
      let out = (db[table] || []).filter(r => filters.every(f => f(r)));
      return {data: single ? (out[0] || null) : out.map(r => Object.assign({}, r)), error: null};
    };
    const q = new Proxy({}, {get(_, k) {
      if (k === 'then') return (res, rej) => Promise.resolve(rows || result()).then(res, rej);
      if (k === 'eq') return (c, v) => (filters.push(r => r[c] === v), q);
      if (k === 'gte') return (c, v) => (filters.push(r => r[c] == null || String(r[c]) >= String(v)), q);
      if (k === 'lte') return (c, v) => (filters.push(r => r[c] == null || String(r[c]) <= String(v)), q);
      if (k === 'maybeSingle' || k === 'single') return () => (single = true, q);
      if (k === 'upsert' || k === 'insert') return v => {
        (Array.isArray(v) ? v : [v]).forEach(row => {
          const list = db[table] = db[table] || [], key = table === 'family_settings' ? 'key' : 'id';
          const i = list.findIndex(r => r[key] === row[key]); if (i >= 0) list[i] = Object.assign({}, list[i], row); else list.push(row);
        });
        rows = {data: null, error: null}; return q;
      };
      return () => q;
    }});
    return q;
  }
  const rpc = (name, a) => {
    window.__fake.rpcs.push([name, a]);
    if (name === 'points_review_claim') { const c = db.points_claims.find(x => x.id === a.p_id); c.status = a.p_approve ? 'confirmed' : 'denied'; c.note = a.p_note; }
    if (name === 'points_approve_redemption') db.points_requests.find(x => x.id === a.p_id).status = 'approved';
    if (name === 'points_deny_redemption') db.points_requests.find(x => x.id === a.p_id).status = 'denied';
    return ok(null);
  };
  const channel = {on() { return channel; }, subscribe(cb) { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return channel; }};
  window.supabase = {createClient: () => ({
    auth: {getSession: () => ok({session: {user: {email: 'papa@example.test'}}}), onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}), signOut: () => ok(null)},
    from: query, rpc, channel: () => channel, removeChannel() {},
    functions: {invoke: () => ok(null)},
    storage: {from: () => ({remove: () => ok([]), getPublicUrl: p => ({data: {publicUrl: 'data:,' + p}}), upload: () => ok(null)})}
  })};
})();""" % {"today": TODAY, "gate": json.dumps(GATE)}


def open_admin(browser, base, viewport, hash_=""):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, service_workers="block",
                                  has_touch=True, is_mobile=viewport[0] < 800, device_scale_factor=2 if viewport[0] < 800 else 1)

    def intercept(route):
        url = route.request.url
        if url.endswith("/js/config.js"):
            route.fulfill(body=CONFIG, content_type="application/javascript")
        elif "/js/vendor/supabase.js" in url or "cdn.jsdelivr.net/npm/@supabase/supabase-js" in url:
            route.fulfill(body=FAKE, content_type="application/javascript")
        elif "127.0.0.1" not in url:
            route.abort()
        else:
            route.continue_()
    context.route("**/*", intercept)
    page = context.new_page()
    page.clock.set_fixed_time(NOW)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/admin.html" + hash_, wait_until="domcontentloaded")
    page.wait_for_selector("#checkBody .pc-item, #checkBody .pc-empty, #overview .board", timeout=15000)
    return page, errors


def text(page, sel):
    return page.locator(sel).inner_text()


def shot(page, out, name):
    page.wait_for_timeout(150)
    page.screenshot(path=str(out / name))


def run(browser_path, out):
    out.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(recovery.Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=browser_path, headless=True) if browser_path else pw.chromium.launch(headless=True)
        print("Browser", browser.version)
        page, errors = open_admin(browser, base, (390, 844))

        # A phone opens on Awaiting: newest first, chores in EN + 中文, the bonus and reward tagged.
        assert page.evaluate("location.hash") == "#check", page.evaluate("location.hash")
        assert text(page, "#routeTitle") == "Awaiting"
        cards = page.locator("#checkBody .pc-item")
        assert cards.count() == 5, cards.count()
        assert "Wash the rice" in cards.nth(0).inner_text() and "洗米" in cards.nth(0).inner_text()
        assert "reward ask" in cards.nth(1).inner_text().lower() and "−200" in cards.nth(1).inner_text()
        assert "bonus" in text(page, "#pc-claim-c3").lower()
        assert "1 question or pass waits in the Inbox" in text(page, "#checkBody")
        assert "5" in text(page, '[data-phonetab="awaiting"] em')
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "no sideways scroll"
        for sel in ["#checkBody .pc-item__acts .btn", ".phone-tabs__b", "#checkBody .pc-kidchips .chip"]:
            box = page.locator(sel).first.bounding_box()
            assert box["height"] >= 40 and box["width"] >= 44, (sel, box)
        shot(page, out, "phone-awaiting.png")

        # Kid filter, then Confirm.
        page.locator('[data-checkkid="luis"]').click()
        assert page.locator("#checkBody .pc-item").count() == 3
        page.locator('[data-checkkid="all"]').click()
        page.locator('[data-pccheck="claim:c1:yes"]').click()
        page.wait_for_function("!document.getElementById('pc-claim-c1')")
        assert page.evaluate("window.__fake.rpcs.at(-1)") == ["points_review_claim", {"p_id": "c1", "p_approve": True, "p_note": "Parent confirmed"}]
        assert "Confirmed · +5 for Lili" in text(page, "#toastMsg")

        # Not yet opens a sheet; the note goes to the record only.
        page.locator('[data-pccheck="claim:c4:no"]').click()
        assert page.locator("#checkSheet").is_visible()
        page.locator("#pcSheetNote").fill("Some toys are still under the bed")
        shot(page, out, "phone-not-yet.png")
        page.locator('[data-checksheet="send"]').click()
        page.wait_for_function("!document.getElementById('pc-claim-c4')")
        assert page.evaluate("window.__fake.rpcs.at(-1)") == ["points_review_claim", {"p_id": "c4", "p_approve": False, "p_note": "Some toys are still under the bed"}]

        # Reward ask: Approve.
        page.locator('[data-pccheck="request:r1:yes"]').click()
        page.wait_for_function("!document.getElementById('pc-request-r1')")
        assert page.evaluate("window.__fake.rpcs.at(-1)") == ["points_approve_redemption", {"p_id": "r1"}]

        # Kids: school-day bars, Brain Gym first, papa-opened, pending counted.
        page.locator('[data-phonetab="kids"]').click()
        page.wait_for_function("document.querySelectorAll('#checkBody .pc-kid').length===3 && /3 of 3/.test(document.getElementById('checkBody').textContent)")
        kids = page.locator("#checkBody .pc-kid")
        lucien, lili, luis = kids.nth(0).inner_text(), kids.nth(1).inner_text(), kids.nth(2).inner_text()
        assert "School day" in text(page, "#checkBody .pc-head")
        assert "you opened Games today" in lucien and "Undo open today" in lucien, lucien
        assert "Brain Gym first · 1 of 3 done" in lili and "/ 30 points today" in lili, lili
        assert "Open · bar reached" not in luis and "/ 40 points today" in luis, luis
        # Luis: 10 confirmed (vacuum) + 10 pending (dishwasher); the bonus gym never counts.
        assert "20\n/ 40 points today" in luis and "20 more points to open Games" in luis, luis
        shot(page, out, "phone-kids.png")
        page.locator('[data-pcopen="luis:open"]').click()
        page.wait_for_function("/you opened Games today/.test(document.querySelectorAll('#checkBody .pc-kid')[2].textContent)")
        assert page.evaluate("window.__db.family_settings.find(r=>r.key==='braingate_luis').value") == TODAY

        # Settings: steppers make a draft; Save keeps unknown keys and flips the mode.
        page.locator('[data-phonetab="settings"]').click()
        assert page.locator(".pc-save").count() == 0
        page.locator('[data-pcstep="lili:schoolThreshold:5"]').click()
        page.locator('[data-pcstep="lucien:threshold:-5"]').click()
        page.locator('[data-pcmode="holiday"]').click()
        assert page.locator(".pc-save").is_visible()
        shot(page, out, "phone-settings.png")
        page.locator('[data-pcsave="save"]').click()
        page.wait_for_function("!document.querySelector('.pc-save')")
        gate = json.loads(page.evaluate("window.__db.family_settings.find(r=>r.key==='games_gate_v1').value"))
        assert gate["schoolThreshold"]["lili"] == 35 and gate["threshold"]["lucien"] == 35 and gate["futureKey"] == "kept", gate
        assert json.loads(page.evaluate("window.__db.family_settings.find(r=>r.key==='day_mode_v1').value")) == {"mode": "holiday"}

        # Schedule: one kid at a time, and a finger scrolls across blocks.
        page.locator('[data-phonetab="schedule"]').click()
        page.wait_for_selector("#overview .board--one")
        assert page.locator("#overview .board__h").count() == 2, "time + one kid"
        page.locator('[data-boardkid="lili"]').click()
        assert page.locator('#overview .cell[data-kid="lili"]').count() > 0
        assert page.locator('#overview .cell[data-kid="luis"]').count() == 0
        shot(page, out, "phone-schedule.png")
        # Bring the board's first rows to mid-screen, then swipe up on a block.
        page.evaluate("const s=document.getElementById('scroll');s.scrollTop+=document.querySelector('#overview .cell').getBoundingClientRect().top-300")
        cell = page.locator('#overview .cell[data-movable="true"]').first
        assert cell.evaluate("el=>getComputedStyle(el).touchAction") in ("pan-x pan-y", "pan-x pan-y pinch-zoom"), cell.evaluate("el=>getComputedStyle(el).touchAction")
        box = cell.bounding_box()
        before = page.evaluate("document.getElementById('scroll').scrollTop")
        cdp = page.context.new_cdp_session(page)
        x, y = box["x"] + box["width"] * 0.6, box["y"] + 20
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]})
        for i in range(1, 16):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y - 20 * i}]})
            page.wait_for_timeout(16)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(300)
        after = page.evaluate("document.getElementById('scroll').scrollTop")
        assert after > before + 100, (before, after)
        assert page.locator(".is-dragging").count() == 0
        assert not errors, errors
        page.context.close()

        # A notification deep link scrolls to the task.
        page, errors = open_admin(browser, base, (390, 844), "#check/claim/c2")
        page.wait_for_selector("#pc-claim-c2.is-focus")
        assert not errors, errors
        page.context.close()

        # Desktop keeps the nav rail, shows the three tabs on top and no bottom bar.
        page, errors = open_admin(browser, base, (1280, 800), "#check")
        assert not page.locator("#phoneTabs").is_visible()
        assert page.locator("#checkTabs").is_visible()
        shot(page, out, "desktop-awaiting.png")
        page.goto(base + "/admin.html#today")
        page.wait_for_selector("#overview .board")
        assert page.locator("#overview .board__h").count() == 4, "desktop board shows all three kids"
        assert not errors, errors
        browser.close()
    server.shutdown()
    print("Parent app UI check passed: Awaiting first on a phone (confirm, not yet with a note, reward approve, kid filter, deep link), "
          "Kids (school bar, Brain Gym first, bonus not counted, open today), Settings (draft, unknown keys kept, day mode), "
          f"Schedule one kid at a time with touch scrolling across blocks, desktop unchanged. Screenshots: {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", default=None)
    parser.add_argument("--out", default=str(ROOT / ".tmp/parent-app-ui"))
    args = parser.parse_args()
    run(args.browser, Path(args.out))
