import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SQChat = require("../js/chat-core.js");

const TODAY = "2026-07-26";

const emptyRows = {
  asks: [], helpClaims: [], passes: [], photos: [], ticks: [], ledger: [], redos: []
};
const rowsWith = extra => Object.assign({}, emptyRows, extra);

test("buildStream on empty data returns an empty array", () => {
  assert.deepEqual(SQChat.buildStream(emptyRows, { today: TODAY }), []);
});

test("buildStream turns an unanswered ask into one kid row that needs Papa", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lucien", kind: "question", body: "how say 儀餐?",
             answer: null, answered_at: null, created_at: "2026-07-26T09:20:00Z" }]
  }), { today: TODAY });
  assert.equal(stream.length, 1);
  assert.equal(stream[0].type, "ask");
  assert.equal(stream[0].side, "kid");
  assert.equal(stream[0].kidId, "lucien");
  assert.equal(stream[0].body, "how say 儀餐?");
  assert.equal(stream[0].needs, true);
});

test("buildStream splits an answered ask into a kid row and a papa row", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lili", kind: "question", body: "can I paint?",
             answer: "yes after lunch 午餐後可以", answered_at: "2026-07-26T09:30:00Z",
             created_at: "2026-07-26T09:20:00Z" }]
  }), { today: TODAY });
  assert.equal(stream.length, 2);
  assert.equal(stream[0].type, "ask");
  assert.equal(stream[0].needs, false);
  assert.equal(stream[1].type, "reply");
  assert.equal(stream[1].side, "papa");
  assert.equal(stream[1].body, "yes after lunch 午餐後可以");
});
