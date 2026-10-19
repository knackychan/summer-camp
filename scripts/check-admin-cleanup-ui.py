"""Admin → Settings → Clean up in the real admin.html (docs/plans/2026-10-09-admin-cleanup/).

An in-memory fake Supabase stands in for the database: it mirrors the
admin_delete_rows / admin_clear / admin_reset_points contract the PostgreSQL test
(scripts/points-database.test.mjs) proves on real SQL. Nothing leaves 127.0.0.1.
Run: python scripts/check-admin-cleanup-ui.py [--browser <Chromium>] [--out <dir>]
"""
import argparse
import functools
import http.server
import importlib.util
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recovery", ROOT / "scripts/check-architecture-recovery.py")
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)

CONFIG = 'window.SQ_CONFIG={SUPABASE_URL:"http://fake.supabase.local",SUPABASE_ANON_KEY:"fake-anon"};'
FAKE = r"""(() => {
  const now = Date.now(), ago = m => new Date(now - m * 60000).toISOString();
  const db = window.__db = {
    kids: [{id:'lucien',pin:''},{id:'lili',pin:''},{id:'luis',pin:''}],
    asks: [
      {id:'a1',kid_id:'luis',kind:'question',body:'Luis archived question',answer:'Yes after lunch',answered_at:ago(50),created_at:ago(60)},
      {id:'a2',kid_id:'lili',kind:'question',body:'Lili open question',audio_path:'lili/a2.webm',answer:null,created_at:ago(5)},
      {id:'a3',kid_id:'luis',kind:'reward:movie_pick:200',body:'Movie pick',answer:null,created_at:ago(30)},
      {id:'a4',kid_id:'luis',kind:'question',body:'Luis old archived',answer:null,created_at:ago(900)}
    ],
    family_settings: [{key:'archived_asks',value:'["a1","a4"]'}],
    points_requests: [{id:'a3',kid_id:'luis',reward_id:'movie_pick',label:['Movie pick','選電影'],points:200,status:'requested',created_at:ago(30)}],
    point_totals: [
      {kid_id:'lucien',total_earned:120,spent:0,available:120,pending:0},
      {kid_id:'lili',total_earned:300,spent:50,available:250,pending:10},
      {kid_id:'luis',total_earned:800,spent:200,available:600,pending:20}],
    kid_chats: [
      {id:3,kid_id:'lili',session_id:'s2',kid_text:'Why is the sky blue?',reply_en:'Sunlight scatters.',reply_zh:'陽光散射。',created_at:ago(10)},
      {id:2,kid_id:'luis',session_id:'s1',kid_text:'Tell me a joke',reply_en:'Why did the cow…',reply_zh:'為什麼牛…',created_at:ago(20)},
      {id:1,kid_id:'luis',session_id:'s1',kid_text:'Hello Summer',reply_en:'Hi Luis!',reply_zh:'嗨 Luis！',created_at:ago(21)}],
    photos: [
      {id:'p1',kid_id:'luis',day:'2026-10-09',block_idx:2,path:'luis/p1.jpg',created_at:ago(40)},
      {id:'p2',kid_id:'lili',day:'2026-10-09',block_idx:null,path:'lili/p2.jpg',created_at:ago(41)}],
    passes: [
      {id:'g1',kid_id:'luis',kind:'golden',status:'spent',reason:'Great week',created_at:ago(70)},
      {id:'e1',kid_id:'luis',kind:'excused',status:'granted',reason:'Sick',created_at:ago(80)},
      {id:'g2',kid_id:'lili',kind:'golden',status:'granted',reason:'',created_at:ago(90)}]
  };
  window.__fake = {chatsMissing: !!window.__chatsMissing, storageFails: false, removed: [], rpcs: []};
  const ok = data => Promise.resolve({data, error: null});
  function query(table) {
    let rows = null, single = false; const filters = [];
    const result = () => {
      if (table === 'kid_chats' && window.__fake.chatsMissing) return {data: null, error: {message: 'relation "public.kid_chats" does not exist'}};
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
  const archived = () => JSON.parse((db.family_settings.find(r => r.key === 'archived_asks') || {value: '[]'}).value);
  function apply(cat, ids) {
    ids = (ids || []).map(String);
    const keep = cat === 'asks' ? ids.filter(id => db.points_requests.some(r => r.id === id)) : [];
    const gone = db[cat].filter(r => ids.includes(String(r.id)) && !keep.includes(String(r.id)));
    db[cat] = db[cat].filter(r => !gone.includes(r));
    const paths = cat === 'asks' ? gone.flatMap(r => [r.audio_path, r.answer_audio_path]).filter(Boolean) : cat === 'photos' ? gone.map(r => r.path) : [];
    if (cat === 'asks') db.family_settings.find(r => r.key === 'archived_asks').value = JSON.stringify(archived().filter(id => !gone.some(g => g.id === id)));
    return {deleted: gone.length, skipped: keep.length, paths};
  }
  const rpc = (name, a) => {
    window.__fake.rpcs.push([name, a]);
    if (a.p_category === 'kid_chats' && window.__fake.chatsMissing) return Promise.resolve({data: null, error: {message: 'Summer chat transcripts are not installed'}});
    if (name === 'admin_delete_rows') return ok(apply(a.p_category, a.p_ids));
    if (name === 'admin_clear') {
      const ids = db[a.p_category].filter(r => (!a.p_kid || r.kid_id === a.p_kid) && (!a.p_archived_only || archived().includes(r.id))).map(r => String(r.id));
      return ok(apply(a.p_category, ids));
    }
    if (name === 'admin_reset_all') {
      const hit = db.point_totals.filter(t => !a.p_kid || t.kid_id === a.p_kid);
      hit.forEach(t => Object.assign(t, {total_earned: 0, spent: 0, available: 0, pending: 0}));
      if (!a.p_kid) db.points_requests = []; else db.points_requests = db.points_requests.filter(r => r.kid_id !== a.p_kid);
      return ok({kids: hit.length, deleted: 9, progress: !!a.p_progress});
    }
    return ok(null);
  };
  const channel = {on() { return channel; }, subscribe() { return channel; }};
  window.supabase = {createClient: () => ({
    auth: {getSession: () => ok({session: {user: {email: 'papa@example.test'}}}), onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}}), signOut: () => ok(null)},
    from: query, rpc, channel: () => channel, removeChannel() {},
    functions: {invoke: () => ok(null)},
    storage: {from: bucket => ({
      remove: paths => { window.__fake.removed.push([bucket, paths]); return window.__fake.storageFails ? Promise.resolve({data: null, error: {message: 'forbidden'}}) : ok(paths.map(name => ({name}))); },
      getPublicUrl: p => ({data: {publicUrl: 'data:,' + p}}), upload: () => ok(null)})}
  })};
})();"""


def open_admin(browser, base, out, chats_missing=False, viewport=(1280, 800)):
    context = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]}, service_workers="block", has_touch=True)

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
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    if chats_missing:
        page.add_init_script("window.__chatsMissing=true")
    page.goto(base + "/admin.html#settings", wait_until="domcontentloaded")
    page.wait_for_selector("#cleanupData table, #cleanupData .qs-callout")
    return page, errors


def text(page, sel):
    return page.locator(sel).inner_text()


def run(browser_path, out):
    out.mkdir(parents=True, exist_ok=True)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(recovery.Handler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=browser_path, headless=True) if browser_path else pw.chromium.launch(headless=True)
        page, errors = open_admin(browser, base, out)
        page.locator("#cleanupPanel").screenshot(path=str(out / "cleanup-messages.png"))

        # Points reset card: pick a kid, balance before, RESET gate, 0 after.
        assert "600 points available" in text(page, "#cleanupBalance"), text(page, "#cleanupBalance")
        page.locator('[data-cleanreset="lili"]').click()
        assert "250 points available" in text(page, "#cleanupBalance")
        assert page.locator("#cleanupResetBtn").is_disabled()
        page.locator("#cleanupResetConfirm").fill("RES")
        assert page.locator("#cleanupResetBtn").is_disabled()
        page.locator("#cleanupResetConfirm").fill("RESET")
        assert page.locator("#cleanupResetBtn").is_enabled()
        page.locator("#cleanupResetBtn").click()
        page.wait_for_function("document.querySelector('#cleanupBalance').textContent.startsWith('0 points available')")
        assert "Points and progress reset for 1 kid" in text(page, "#toastMsg")
        assert page.evaluate("window.__fake.rpcs.at(-1)") == ["admin_reset_all", {"p_kid": "lili", "p_progress": True}]
        assert page.evaluate("window.__db.point_totals.find(t=>t.kid_id==='luis').available") == 600, "Luis keeps his points"

        # Messages: tick two, a reward ask is kept, the voice file goes.
        assert page.locator("[data-cleanrow]").count() == 4
        assert "Archived" in text(page, "#cleanupData") and "Reward" in text(page, "#cleanupData")
        assert "Lili open question" in text(page, "#chatStream"), "the dock shows the message before"
        page.locator('[data-cleanrow="a2"]').check()
        page.locator('[data-cleanrow="a3"]').check()
        assert "Delete selected (2)" in text(page, "#cleanupDeleteSel")
        page.locator("#cleanupDeleteSel").click()
        card = text(page, ".cleanup-confirm")
        assert "Delete 2 messages." in card and "1 reward request will be kept" in card, card
        assert page.locator("#cleanupConfirmBtn").is_disabled()
        page.locator("#cleanupPanel").screenshot(path=str(out / "cleanup-confirm.png"))
        page.locator("#cleanupConfirmInput").fill("delete")
        page.locator("#cleanupConfirmBtn").click()
        page.wait_for_function("document.querySelectorAll('[data-cleanrow]').length===3")
        assert "1 message deleted, 1 reward request kept" in text(page, "#cleanupResult"), text(page, "#cleanupResult")
        assert page.evaluate("window.__fake.removed") == [["voices", ["lili/a2.webm"]]]
        assert "Lili open question" not in text(page, "#chatStream"), "deleted message left the dock"

        # Clear all archived (everyone): a1 and a4 go, the reward ask stays.
        page.locator("#cleanupClearArchived").click()
        assert "every archived message for every kid" in text(page, ".cleanup-confirm")
        page.locator("#cleanupConfirmInput").fill("DELETE")
        page.locator("#cleanupConfirmBtn").click()
        page.wait_for_function("document.querySelectorAll('[data-cleanrow]').length===1")
        assert page.evaluate("window.__db.asks.map(a=>a.id)") == ["a3"]
        assert page.evaluate("window.__db.family_settings[0].value") == "[]"

        # Summer chats: grouped by conversation, delete one exchange.
        page.locator('[data-cleantab="kid_chats"]').click()
        assert page.locator("[data-cleanrow]").count() == 3
        assert page.locator(".cleanup-group").count() == 2
        page.locator("#cleanupPanel").screenshot(path=str(out / "cleanup-chats.png"))
        page.locator('[data-cleanrow="2"]').check()
        page.locator("#cleanupDeleteSel").click()
        page.locator("#cleanupConfirmInput").fill("DELETE")
        page.locator("#cleanupConfirmBtn").click()
        page.wait_for_function("document.querySelectorAll('[data-cleanrow]').length===2")
        assert page.evaluate("window.__fake.rpcs.at(-1)") == ["admin_delete_rows", {"p_category": "kid_chats", "p_ids": ["2"]}]

        # Photos: select-all for Luis via the kid filter; a Storage failure leaves the rows deleted.
        page.locator('[data-cleantab="photos"]').click()
        page.locator('[data-cleankid="luis"]').click()
        assert page.locator("[data-cleanrow]").count() == 1
        page.evaluate("window.__fake.storageFails=true")
        page.locator("#cleanupAll").check()
        page.locator("#cleanupDeleteSel").click()
        assert "Storage" in text(page, ".cleanup-confirm")
        page.locator("#cleanupConfirmInput").fill("DELETE")
        page.locator("#cleanupConfirmBtn").click()
        page.wait_for_function("document.querySelector('#cleanupResult').textContent.includes('Files left in Storage')")
        assert page.evaluate("window.__db.photos.map(p=>p.id)") == ["p2"]

        # Passes: clear all for Luis; the spent-pass line is in the card.
        page.locator('[data-cleantab="passes"]').click()
        assert "Clear all passes for Luis" in text(page, "#cleanupClearAll")
        page.locator("#cleanupClearAll").click()
        assert "not recomputed" in text(page, ".cleanup-confirm")
        page.locator("#cleanupConfirmInput").fill("DELETE")
        page.locator("#cleanupConfirmBtn").click()
        page.wait_for_function("document.querySelector('#cleanupResult').textContent.includes('2 passes deleted')")
        assert page.evaluate("window.__db.passes.map(p=>p.id)") == ["g2"]
        assert page.evaluate("window.__fake.rpcs.at(-1)") == ["admin_clear", {"p_category": "passes", "p_kid": "luis", "p_archived_only": False}]

        # Tablet-sized targets.
        box = page.locator(".cleanup-check").first.bounding_box()
        assert box["width"] >= 44 and box["height"] >= 44, box
        assert not errors, errors
        page.context.close()

        # Narrow portrait and a project without kid_chats.
        page, errors = open_admin(browser, base, out, viewport=(800, 1280))
        page.locator('[data-cleantab="kid_chats"]').click()
        page.locator("#cleanupPanel").screenshot(path=str(out / "cleanup-portrait.png"))
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), "no sideways scroll in portrait"
        assert not errors, errors
        page.context.close()
        page, errors = open_admin(browser, base, out, chats_missing=True)
        page.locator('[data-cleantab="kid_chats"]').click()
        assert "Summer chat transcripts are not installed" in text(page, "#cleanupData")
        assert not errors, errors
        browser.close()
    server.shutdown()
    print("Admin clean-up UI check passed: points reset gate, messages (reward kept, voice file removed, dock updated), "
          "clear archived, Summer chats, photos with a Storage failure, passes, 44px targets, portrait, chats not installed. "
          f"Screenshots: {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--browser", default=None)
    parser.add_argument("--out", default=str(ROOT / ".tmp/admin-cleanup-ui"))
    args = parser.parse_args()
    run(args.browser, Path(args.out))
