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

test("buildStream turns a requested claim into an action card that needs Papa", () => {
  const stream = SQChat.buildStream(rowsWith({
    helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                   body: "helped Lili tidy up", status: "requested",
                   created_at: "2026-07-26T10:00:00Z" }]
  }), { today: TODAY });
  assert.equal(stream.length, 1);
  assert.equal(stream[0].type, "claim");
  assert.equal(stream[0].side, "kid");
  assert.equal(stream[0].kidId, "luis");
  assert.equal(stream[0].needs, true);
  assert.equal(stream[0].meta.helped, "lili");
});

test("buildStream marks a reviewed claim as no longer needing Papa", () => {
  const stream = SQChat.buildStream(rowsWith({
    helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                   body: "helped", status: "approved",
                   created_at: "2026-07-26T10:00:00Z" }]
  }), { today: TODAY });
  assert.equal(stream[0].needs, false);
  assert.equal(stream[0].meta.status, "approved");
});

test("buildStream includes requested passes but not outing passes", () => {
  const stream = SQChat.buildStream(rowsWith({
    passes: [
      { id: "p1", kid_id: "lili", kind: "golden", status: "requested", block_idx: 3,
        reason: "tired", created_at: "2026-07-26T11:00:00Z" },
      { id: "p2", kid_id: "lili", kind: "outing", status: "granted", block_idx: 4,
        reason: "removed", created_at: "2026-07-26T11:05:00Z" }
    ]
  }), { today: TODAY });
  assert.equal(stream.length, 1);
  assert.equal(stream[0].type, "pass");
  assert.equal(stream[0].needs, true);
});

test("buildStream adds photo and system rows", () => {
  const stream = SQChat.buildStream(rowsWith({
    photos: [{ id: "ph1", kid_id: "luis", day: TODAY, block_idx: 2, path: "x.jpg",
               created_at: "2026-07-26T12:00:00Z" }],
    ticks: [{ kid_id: "lili", day: TODAY, block_idx: 1,
              created_at: "2026-07-26T12:30:00Z" }],
    ledger: [{ id: "l1", kid_id: "lucien", delta: 1, reason: "brain gym",
               source: "app", created_at: "2026-07-26T12:45:00Z" }]
  }), { today: TODAY });
  assert.deepEqual(stream.map(r => r.type), ["photo", "system", "system"]);
  assert.equal(stream.every(r => r.needs === false), true);
});

test("buildStream sorts every source together, oldest first", () => {
  const stream = SQChat.buildStream(rowsWith({
    asks: [{ id: "a1", kid_id: "lili", kind: "question", body: "late",
             answer: null, answered_at: null, created_at: "2026-07-26T15:00:00Z" }],
    helpClaims: [{ id: "c1", captain_id: "luis", helped_kid_id: "lili", day: TODAY,
                   body: "early", status: "requested",
                   created_at: "2026-07-26T08:00:00Z" }]
  }), { today: TODAY });
  assert.deepEqual(stream.map(r => r.body), ["early", "late"]);
});

test("buildStream ignores ticks and photos from other days", () => {
  const stream = SQChat.buildStream(rowsWith({
    ticks: [{ kid_id: "lili", day: "2026-07-25", block_idx: 1,
              created_at: "2026-07-25T12:30:00Z" }],
    photos: [{ id: "ph1", kid_id: "luis", day: "2026-07-25", block_idx: 2,
               path: "x.jpg", created_at: "2026-07-25T12:00:00Z" }]
  }), { today: TODAY });
  assert.deepEqual(stream, []);
});
