// Parent push on this device: support detection and the saved row
// (docs/plans/2026-10-19-parent-app/ D4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const P = createRequire(import.meta.url)("../js/admin-push.js");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const base = { vapidKey: "BKey", serviceWorker: true, pushManager: true, notification: true, permission: "default", touchPoints: 0, standalone: false };

test("support: iPhone in Safari must add to Home Screen first; installed it is ready", () => {
  assert.equal(P.support({ ...base, ua: IPHONE, pushManager: false }), "install");
  assert.equal(P.support({ ...base, ua: IPHONE, standalone: true }), "ready");
  assert.equal(P.support({ ...base, ua: IPAD_DESKTOP, touchPoints: 5 }), "install", "iPad asking for the desktop site");
});
test("support: Android Chrome ready; no key, no push API or denied are reported", () => {
  assert.equal(P.support({ ...base, ua: ANDROID }), "ready");
  assert.equal(P.support({ ...base, ua: ANDROID, vapidKey: "" }), "off");
  assert.equal(P.support({ ...base, ua: ANDROID, pushManager: false }), "unsupported");
  assert.equal(P.support({ ...base, ua: ANDROID, permission: "denied" }), "blocked");
});
test("keyBytes decodes a base64url VAPID key", () => {
  assert.deepEqual(Array.from(P.keyBytes("AQID_-8")), [1, 2, 3, 255, 239]);
});
test("row: subscription keys, a readable device label and cleaned preferences", () => {
  const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { p256dh: "pk", auth: "au" } };
  const r = P.row(sub, ANDROID, { kinds: ["task", "ask", "spam"], quiet_start: "25:00", quiet_end: "06:30" });
  assert.deepEqual(r, { endpoint: sub.endpoint, p256dh: "pk", auth: "au", device_label: "Android · Chrome",
    kinds: ["task", "ask"], quiet_start: "21:30", quiet_end: "06:30", enabled: true });
  assert.equal(P.deviceLabel(IPHONE), "iPhone · Safari");
});
