"""Real child UI regression; synthetic local data, external services blocked."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import runpy
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
RECOVERY = runpy.run_path(str(ROOT / "scripts/check-architecture-recovery.py"))


def run(browser_path):
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(RECOVERY["Handler"], directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=browser_path, headless=True)
            seed = RECOVERY["saved_fixture"]("hub")
            seed["sq:serverStars"] = json.dumps({"lili": 80})
            seed["sq:famSettings"] = json.dumps({"reward_spend_lili": json.dumps({"total": 20, "requests": ["old"]})})
            seed["sq:kid"] = "lili"
            context = RECOVERY["context_for"](browser, seed=seed)
            context.route("**/js/config.js", lambda route: route.fulfill(body="window.SQ_CONFIG={};", content_type="application/javascript"))
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="domcontentloaded")
            page.wait_for_function("window.SummerQuest && window.SQPoints && store")
            page.evaluate("SummerQuest.navigate('day')")
            assert page.evaluate("pointsOf('lili')") == dict(available=600, totalEarned=800, pending=0, spent=200)
            assert "600 available" in page.locator("#hubStars").inner_text()
            page.evaluate("tickBlockDone(3)")
            page.evaluate("openQuestCard('reading_nest')")
            page.locator("#questComplete").click()
            assert page.evaluate("store.pointClaims.filter(c=>c.kind==='reading').length") == 1
            assert page.evaluate("pointsOf('lili').available") == 600
            assert page.evaluate("pointsOf('lili').pending") == 20
            page.locator("#questClose").click()
            page.evaluate("SummerQuest.openActivity(0)")
            page.locator("#actDone").click()
            page.evaluate("SummerQuest.navigate('day'); tickBlockDone(11)")
            assert page.evaluate("store.pointClaims.filter(c=>c.kind==='movement').length") == 1
            before = page.evaluate("store.queue.filter(op=>op.type==='pointClaim').length")
            page.reload(wait_until="domcontentloaded")
            page.wait_for_function("window.SummerQuest && store")
            assert page.evaluate("store.queue.filter(op=>op.type==='pointClaim').length") == before
            assert page.evaluate("pointsOf('lili')") == dict(available=600, totalEarned=800, pending=40, spent=200)
            page.evaluate("SummerQuest.navigate('rewards')")
            page.wait_for_selector(".reward-wallet")
            assert "AVAILABLE POINTS" in page.locator(".reward-wallet").inner_text()
            assert page.evaluate("rewardCatalog().find(r=>r.id==='choose_dessert').cost") == 120
            page.evaluate("checkAchievements('lili')")
            assert page.evaluate("SQNotify.earned('lili').includes('star50')")
            assert not page.evaluate("SQNotify.earned('lili').includes('star100')")
            page.evaluate("requestReward(rewardCatalog()[0])")
            assert "sync is offline" in page.locator("#rwBody").inner_text()
            assert not errors, errors
            context.close()
            browser.close()
            print("PASS points child UI: conversion, shared identities, durable offline claims, confirmed wallet, achievements, shop")
    finally:
        server.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", default="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
    run(parser.parse_args().browser)
