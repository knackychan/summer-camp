"""Daily points gate and home-help guide in the real root runtime (games-gate-ai-guide slices 01-04),
and the Summer chat panel (summer-chat-crash-test, summer-chat-panel).

Run with --browser <Chromium executable> (Chrome 138 for the Android 8 baseline).
Local-only mode, external services blocked, clock fixed to a Taipei day.
Screenshots of the card and the chooser go to --out for Papa's look.
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

GATE = {"enabled": True, "threshold": {"luis": 50, "lili": 50, "lucien": 40}}
BRAIN_DONE = """kid => {
  const day = SQ_DAY.iso(), trio = SQBrainCore.dailyThree(kid, day, SQHost.store.familySettings || {});
  SQHost.progress[kid].brain = {d: day, done: Object.fromEntries(trio.map(x => [x, 1])), starred: false};
  return trio;
}"""
CLAIM = """([kid, kind, slot, amount, status]) => {
  SQHost.store.pointClaims.push({kid_id: kid, day: SQ_DAY.iso(), kind, slot, amount, status, id: kind + slot});
}"""


def open_kid(browser, base, kid, when, extra=None):
    context = recovery.context_for(browser, dict({"sq:kid": kid, "sq:view": "hub", "sq:hubTab": "games"}, **(extra or {})))
    page = context.new_page()
    page.set_viewport_size({"width": 1024, "height": 600})
    page.clock.set_fixed_time(when)
    page.goto(base + "/index.html", wait_until="domcontentloaded")
    recovery.ready(page)
    recovery.wait_screen(page, "hub")
    return context, page


def opened(page, game="balloon"):
    result = page.evaluate("id => SummerQuest.openGame(id)", game)
    if result["ok"]:
        recovery.back(page, "hub")
    return result


def card_text(page):
    """The Games tab card the kid sees (tiles behind it are disabled)."""
    page.evaluate("SummerQuest.navigate('games')")
    page.evaluate("refreshLockUI()")
    page.wait_for_selector("#gamesLockCard")
    return page.locator("#gamesLockCard").inner_text()


def overlay_text(page):
    """The same card as an overlay (startGame / eviction path)."""
    page.evaluate("showLockOverlay(gameLockState())")
    page.wait_for_selector("#lockOverlay")
    return page.locator("#lockOverlay").inner_text()


# The Summer chat sizes itself from window.visualViewport; headless Chrome has no
# on-screen keyboard, so a stand-in viewport lets the check shrink it like one.
FAKE_VV = """() => {
  const v = new EventTarget();
  Object.assign(v, {width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1});
  Object.defineProperty(window, 'visualViewport', {value: v, configurable: true});
}"""
PANEL = """() => {
  const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return {x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom, right: b.right}; };
  const log = document.getElementById('summerChatLog');
  return {vw: innerWidth, vh: innerHeight, card: r('.summer-chat'), form: r('#summerChatForm'), input: r('#summerChatInput'),
    send: r('#summerChatSend'), close: r('#summerChatClose'), preset: r('[data-preset]'),
    presets_shown: getComputedStyle(document.getElementById('summerChatPresets')).display !== 'none',
    log: {h: log.clientHeight, pinned: log.scrollHeight - log.scrollTop - log.clientHeight < 2, overflows: log.scrollHeight > log.clientHeight},
    page_scroll: document.scrollingElement.scrollTop};
}"""


def panel(page):
    return page.evaluate(PANEL)


def keyboard(page, height, top=0):
    page.evaluate("""([h, t]) => { const v = window.visualViewport; v.height = h; v.offsetTop = t;
      v.dispatchEvent(new Event('resize')); v.dispatchEvent(new Event('scroll')); }""", [height, top])


def wait_held(page, held):
    for _ in range(100):
        if held:
            return
        page.wait_for_timeout(50)
    raise AssertionError("the chat never called kid-chat")


def answer(held, en="The sky is blue because sunlight bounces!", zh="天空是藍色的，因為陽光在彈跳！"):
    held.pop(0).fulfill(status=200, content_type="application/json", body=json.dumps({"en": en, "zh": zh, "flagged": False}))


def wait_replies(page, count):
    page.wait_for_function("n => document.querySelectorAll('#summerChatLog .summer-chat__msg--summer:not(.is-thinking)').length === n", arg=count)


def run(browser, base, out):
    noon = datetime(2026, 10, 8, 4, 10, tzinfo=timezone.utc)   # 12:10 Taipei
    night = datetime(2026, 10, 8, 13, 30, tzinfo=timezone.utc)  # 21:30 Taipei
    results = {}

    context, page = open_kid(browser, base, "lili", noon)
    page.evaluate(BRAIN_DONE, "lili")
    assert opened(page)["ok"], "gate off: games open as before"
    page.evaluate("s => { SQHost.store.familySettings.games_gate_v1 = JSON.stringify(s); }", GATE)
    blocked = opened(page)
    assert not blocked["ok"] and blocked["reason"] == "points", blocked
    text = card_text(page)
    assert "0 / 50" in text and "今天 0 / 50 點" in text and "🎁" in text, text
    assert "50" in text and "Help me choose" in text, text
    page.screenshot(path=str(out / "games-gate-card-lili.png"))
    assert "0 / 50" in overlay_text(page)
    page.screenshot(path=str(out / "games-gate-overlay-lili.png"))
    # slice 04: the guide asks two tap-only questions, then three cards
    page.locator("#lockOverlay [data-gg=help]").click()
    page.wait_for_selector("#homeHelpOverlay .hhchip")
    q1 = page.locator("#homeHelpOverlay").inner_text()
    assert "already done today" in q1 and "今天已經做了什麼" in q1, q1
    assert page.locator("#homeHelpOverlay [data-hhdone]").count() == 8
    assert page.locator("#homeHelpOverlay input, #homeHelpOverlay textarea").count() == 0, "tap-only"
    page.locator("[data-hhdone=room]").click()
    page.screenshot(path=str(out / "games-gate-guide-q1-lili.png"))
    page.locator("#hhNext").click()
    page.wait_for_selector("[data-hhtime=some]")
    assert "你現在有多少時間" in page.locator("#homeHelpOverlay").inner_text()
    page.screenshot(path=str(out / "games-gate-guide-q2-lili.png"))
    page.locator("[data-hhtime=some]").click()
    page.wait_for_selector("#homeHelpOverlay .hhcard")
    shown = lambda: page.evaluate("[...document.querySelectorAll('#homeHelpOverlay .hhcard')].map(b => b.innerText)")
    cards = shown()
    assert len(cards) == 3, cards
    assert "Help clean the table" in cards[0] and "+5" in cards[0], cards  # lunch block, fits 15 min
    assert not any("Clean my room" in c for c in cards), "what the kid says is done is never suggested"
    page.screenshot(path=str(out / "games-gate-chooser-lili.png"))
    sets = [cards]
    for _ in range(2):
        page.locator("#hhReroll").click()
        page.wait_for_function("prev => document.querySelector('#homeHelpOverlay .hhcard') && [...document.querySelectorAll('#homeHelpOverlay .hhcard')].map(b => b.innerText).join('|') !== prev", arg="|".join(sets[-1]))
        sets.append(shown())
        assert len(sets[-1]) >= 1 and sets[-1] != sets[-2], sets
    page.locator("#hhBack").click()
    page.evaluate("showHomeHelpChooser()")
    page.wait_for_selector("#homeHelpOverlay .hhcard")
    assert shown() == sets[-1], "reopening the slot shows the saved set, no new questions"
    saved = page.evaluate("Object.values(JSON.parse(localStorage.getItem('sq:guide:v1')).decisions).map(d => [d.slot, d.reroll, d.source, d.answers.time, d.picks.length])")
    assert sorted(saved) == [["afternoon", 0, "local", "some", 3], ["afternoon", 1, "local", "some", 3], ["afternoon", 2, "local", "some", 3]], saved
    # every eligible activity comes round; start the garden one and the table one
    for label, quest in (("Tidy the garden", "Garden Tidy"), ("Help clean the table", "Table Helper"), ("Tidy the living room", "Living Room Tidy"), ("Tidy the office", "Office Tidy")):
        page.evaluate("showHomeHelpChooser()")
        page.wait_for_selector("#homeHelpOverlay .hhcard")
        for _ in range(4):
            if page.locator(".hhcard:has-text('%s')" % label).count():
                break
            before = "|".join(shown())
            page.locator("#hhReroll").click()
            page.wait_for_function("prev => [...document.querySelectorAll('#homeHelpOverlay .hhcard')].map(b => b.innerText).join('|') !== prev", arg=before)
        page.locator(".hhcard:has-text('%s')" % label).click()
        page.wait_for_selector("#questOverlay")
        assert quest in page.locator("#questOverlay").inner_text(), quest
        recovery.close_overlays(page)
    started = page.evaluate("Object.values(JSON.parse(localStorage.getItem('sq:guide:v1')).decisions).map(d => d.started_id).filter(Boolean)")
    assert started, "a started pick is saved on its decision"
    page.evaluate("showHomeHelpChooser()")
    page.wait_for_selector("#homeHelpOverlay .vrow")
    assert not any("Tidy the office" in c for c in shown()), "a started pick is hidden on reopen"
    recovery.close_overlays(page)
    page.evaluate(CLAIM, ["lili", "room_rescue", "default", 10, "pending"])
    assert "10 / 50" in card_text(page)
    page.evaluate(CLAIM, ["lili", "homework", "default", 40, "confirmed"])
    assert opened(page)["ok"], "50 reached opens games"
    page.evaluate("SQHost.store.pointClaims.forEach(c => { if (c.kind === 'homework') c.status = 'denied'; })")
    assert opened(page)["ok"], "a later decline never re-closes the day (D2)"
    results["lili"] = {"cards": len(cards), "rerolls": len(sets) - 1, "started": started}
    context.close()

    context, page = open_kid(browser, base, "luis", noon)
    page.evaluate("s => { SQHost.store.familySettings.games_gate_v1 = JSON.stringify(s); }", GATE)
    first = opened(page)
    assert first["reason"] == "brain", first
    text = overlay_text(page)
    assert "Brain Gym gives 30 points too" in text and "頭腦體操也有 30 點" in text, text
    recovery.close_overlays(page)
    trio = page.evaluate(BRAIN_DONE, "luis")
    assert opened(page)["reason"] == "points"
    assert opened(page, trio[0])["ok"], "Brain Gym stays open under the points gate"
    page.evaluate("SummerQuest.navigate('practice')")
    assert page.evaluate("document.getElementById('tab-practice').classList.contains('brainlocked')")
    page.evaluate("refreshLockUI()")
    assert "Helping time first" in page.locator("#gamesLockCard").inner_text()
    page.evaluate("window.sqOpenGamesToday()")
    assert opened(page)["ok"], "Papa opens games today"
    context.close()

    # slice 03: local-only mode sets the gate from the tablet's Papa tools
    context, page = open_kid(browser, base, "lili", noon, {"sq:adminPin": json.dumps("2468")})
    page.evaluate(BRAIN_DONE, "lili")
    assert page.evaluate("sqGamesGateLocal.available()"), "local-only tablet owns the gate"
    page.evaluate("SQPapa.open()")
    for digit in "2468":
        page.locator(".pinkey[data-k='%s']" % digit).click()
    page.locator("#ptGate").click()
    page.locator("[data-ptgate=lili]").fill("30")
    page.locator("#ptGateOn").check()
    page.screenshot(path=str(out / "games-gate-papa-tools.png"))
    page.locator("#ptGateSave").click()
    page.wait_for_function("document.getElementById('ptMsg') && document.getElementById('ptMsg').textContent.includes('Saved')")
    assert page.evaluate("sqGamesGateLocal.get().threshold.lili") == 30
    recovery.close_overlays(page)
    page.evaluate("sqGamesGateLocal.set(Object.assign(sqGamesGateLocal.get(), {enabled: false, threshold: {luis: 50, lili: 50, lucien: 40}}))")
    assert opened(page)["ok"]
    page.evaluate("sqGamesGateLocal.set(Object.assign(sqGamesGateLocal.get(), {enabled: true}))")
    assert opened(page)["reason"] == "points"
    assert "0 / 50" in card_text(page)
    stored = page.evaluate("JSON.parse(JSON.parse(localStorage.getItem('sq:famSettings')).games_gate_v1)")
    assert stored["enabled"] is True and stored["threshold"]["lili"] == 50, stored
    page.evaluate("sqGamesGateLocal.set(Object.assign(sqGamesGateLocal.get(), {threshold: {luis: 50, lili: 0, lucien: 40}}))")
    assert opened(page)["ok"], "threshold 0 = no gate"
    context.close()

    context, page = open_kid(browser, base, "lucien", night)
    page.evaluate(BRAIN_DONE, "lucien")
    page.evaluate("s => { SQHost.store.familySettings.games_gate_v1 = JSON.stringify(s); }", GATE)
    assert "0 / 40" in card_text(page)
    assert page.locator("#gamesLockCard .ggicons").count() == 1
    page.screenshot(path=str(out / "games-gate-card-lucien.png"))
    page.locator("#gamesLockCard [data-gg=help]").click()
    page.wait_for_selector("#homeHelpOverlay")
    assert "Rest time" in page.locator("#homeHelpOverlay").inner_text()
    assert page.locator("#homeHelpOverlay .hhcard").count() == 0
    context.close()

    # Summer chat (2026-10-09-summer-chat-crash-test): from the companion sheet, any time.
    # Panel (2026-10-09-summer-chat-panel): docked right in landscape, a full sheet in
    # portrait, preset taps + typing, composer above a simulated on-screen keyboard.
    context, page = open_kid(browser, base, "luis", noon)
    page.evaluate("s => { SQHost.store.familySettings.games_gate_v1 = JSON.stringify(s); }", GATE)
    page.evaluate("openSummerCompanion()")
    page.wait_for_selector("[data-summer-action=chat]")
    assert "和 Summer 聊天" in page.locator("[data-summer-action=chat]").inner_text()
    page.locator("[data-summer-action=chat]").click()
    page.wait_for_selector("#summerChatOverlay")
    assert "needs wifi" in page.locator("#summerChatLog").inner_text(), "local-only mode: no chat, a kind line"
    assert page.locator("#summerChatInput").is_disabled()
    assert page.locator("#summerChatPresets [data-preset]").first.is_disabled(), "nothing is queued offline"
    page.locator("#summerChatOverlay").click(position={"x": 20, "y": 300})
    assert page.locator("#summerChatOverlay").count() == 1, "a tap beside the panel never ends the conversation"
    page.locator("#summerChatClose").click()
    assert page.locator("#summerChatOverlay").count() == 0
    sent, held = [], []
    def hold(route):
        sent.append(json.loads(route.request.post_data))
        held.append(route)
    page.route("**/functions/v1/kid-chat", hold)
    page.evaluate("window.SQ_CONFIG = {SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon'}")
    page.evaluate(FAKE_VV)
    page.evaluate("openSummerChat()")
    p = panel(page)
    assert abs(p["card"]["right"] - p["vw"]) < 1 and 0.38 <= p["card"]["w"] / p["vw"] <= 0.47, p["card"]
    assert p["card"]["h"] >= p["vh"] - 1 and p["card"]["x"] > 0, "full height, the app stays visible on the left"
    for name in ("close", "send", "preset"):
        assert p[name]["w"] >= 48 and p[name]["h"] >= 48, (name, p[name])
    presets = page.evaluate("SUMMER_CHAT_PRESETS")
    assert page.locator("#summerChatPresets [data-preset]").count() == len(presets) >= 4
    assert presets[0]["zh"] in page.locator("#summerChatPresets").inner_text()
    page.screenshot(path=str(out / "summer-chat-landscape.png"))
    page.locator("#summerChatPresets [data-preset='0']").click()
    wait_held(page, held)
    assert page.locator("#summerChatLog .is-thinking").count() == 1 and "想一下" in page.locator("#summerChatLog").inner_text()
    assert page.locator("#summerChatSend").is_disabled() and page.locator("[data-preset='1']").is_disabled(), "one question at a time"
    answer(held, "The moon is made of rock and dust!", "月亮是由岩石和灰塵組成的！")
    wait_replies(page, 2)
    assert sent[0]["messages"] == [{"role": "kid", "text": presets[0]["en"]}], sent[0]
    log = page.locator("#summerChatLog").inner_text()
    assert presets[0]["en"] in log and presets[0]["zh"] in log and "月亮是由岩石" in log, log
    assert page.locator("#summerChatLog .summer-chat__say").count() == 2, "🔊 on every Summer reply"
    page.locator("#summerChatInput").fill("Why is the sky blue?")
    page.locator("#summerChatSend").click()
    wait_held(page, held)
    answer(held)
    wait_replies(page, 3)
    page.locator("#summerChatInput").fill("Tell me more")
    page.locator("#summerChatInput").press("Enter")
    wait_held(page, held)
    answer(held)
    wait_replies(page, 4)
    assert [m["role"] for m in sent[2]["messages"]] == ["kid", "summer", "kid", "summer", "kid"], sent[2]
    assert sent[2]["messages"][2]["text"] == "Why is the sky blue?" and page.locator("#summerChatInput").input_value() == ""
    assert sent[2]["kid"] == "luis" and sent[0]["session"] == sent[2]["session"], sent
    # Keyboard up in landscape: the visible viewport shrinks to 300 px
    keyboard(page, 300)
    p = panel(page)
    assert p["form"]["bottom"] <= 300 and p["input"]["y"] >= p["card"]["y"], p["form"]
    assert not p["presets_shown"] and p["log"]["pinned"] and p["log"]["h"] > 60 and p["page_scroll"] == 0, p
    page.screenshot(path=str(out / "summer-chat-landscape-keyboard.png"))
    keyboard(page, 300, 120)   # the browser scrolled the visual viewport down
    p = panel(page)
    assert abs(p["card"]["y"] - 120) < 1 and p["form"]["bottom"] <= 420, p
    keyboard(page, p["vh"])
    assert panel(page)["presets_shown"], "presets come back when the keyboard closes"
    assert opened(page)["reason"] == "brain", "games stay gated while the chat is open to talk"
    page.screenshot(path=str(out / "summer-chat-luis.png"))
    page.evaluate("SQHost.store.familySettings.kid_chat_v1 = JSON.stringify({enabled: false})")
    recovery.close_overlays(page)
    page.evaluate("openSummerCompanion()")
    page.wait_for_selector("[data-summer-action]")
    assert page.locator("[data-summer-action=chat]").count() == 0, "Papa's switch hides the chat"
    context.close()

    # A landscape screen under 900 px wide gets the full-height sheet; type with the
    # keyboard up until the list overflows.
    context, page = open_kid(browser, base, "lili", noon)
    page.set_viewport_size({"width": 854, "height": 480})
    page.route("**/functions/v1/kid-chat", hold)
    page.evaluate("window.SQ_CONFIG = {SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon'}")
    page.evaluate(FAKE_VV)
    page.evaluate("openSummerChat()")
    p = panel(page)
    assert p["card"]["x"] == 0 and p["card"]["w"] == p["vw"] and p["card"]["h"] >= p["vh"] - 1 and p["presets_shown"], p
    page.screenshot(path=str(out / "summer-chat-small.png"))
    page.locator("#summerChatInput").focus()
    keyboard(page, 230)
    for i in range(4):
        page.locator("#summerChatInput").fill("Question %d" % i)
        page.locator("#summerChatInput").press("Enter")
        wait_held(page, held)
        answer(held, "A long answer. " * 12, "很長的回答。" * 12)
        wait_replies(page, 2 + i)
    p = panel(page)
    assert p["form"]["bottom"] <= 230 and not p["presets_shown"] and p["log"]["pinned"] and p["log"]["overflows"], p
    assert p["page_scroll"] == 0, "only the message list scrolls"
    page.screenshot(path=str(out / "summer-chat-small-keyboard.png"))
    # Portrait: app.css asks to turn the tablet sideways over everything, so a kid
    # never sees the chat there; the sheet still lays out full-screen behind it.
    page.set_viewport_size({"width": 800, "height": 1280})
    keyboard(page, 1280)
    p = panel(page)
    assert p["card"]["x"] == 0 and p["card"]["w"] == p["vw"] and p["card"]["h"] >= p["vh"] - 1 and p["presets_shown"], p
    keyboard(page, 760)
    p = panel(page)
    assert p["form"]["bottom"] <= 760 and p["presets_shown"] and p["log"]["pinned"] and p["page_scroll"] == 0, p
    assert page.locator("#rotateOverlay").is_visible()
    results["chat"] = {"messages": len(sent)}
    context.close()
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "test-results/games-gate")
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
    print("games gate UI check passed")


if __name__ == "__main__":
    main()
