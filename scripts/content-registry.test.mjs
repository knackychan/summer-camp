import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MANIFEST } from "../js/games/index.js";
import { listKnowledgeLessons } from "../dist/mobile/packages/learning/src/knowledge/KnowledgeLessonCatalog.js";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = read("index.html");
function registryContext(extra = {}) {
  const context = { console, Promise, ...extra };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(read("js/content-registry.js"), context);
  return context;
}

test("registry waits for readiness and reports actual async failure", async () => {
  const context = registryContext();
  let ready = false, opened = false;
  context.SQContentRegistry.bind({
    async ready() { await Promise.resolve(); ready = true; },
    list() { return ready ? [{ id: "game:solar" }] : []; },
    async open() { await Promise.resolve(); opened = true; throw new Error("missing module"); },
  });
  const result = await context.SQContentRegistry.open("game:solar");
  assert.equal(opened, true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "launch_failed");
  assert.match(result.error, /missing module/);
  assert.equal((await context.SQContentRegistry.open("game:unknown")).reason, "content_not_found");
  context.SQContentRegistry.bind({ list: () => [{ id: "game:solar" }], open() {} });
  assert.equal((await context.SQContentRegistry.open("game:solar")).reason, "launch_incomplete");
});

test("a launch pending catalog readiness cannot follow a child or navigation change", async () => {
  const context = registryContext();
  let current = "lucien:1", release, opened = false;
  const readiness = new Promise((resolve) => { release = resolve; });
  context.SQContentRegistry.bind({
    context: () => current,
    ready: () => readiness,
    list: () => [{ id: "book:space" }],
    open() { opened = true; return { ok: true }; },
  });
  const pending = context.SQContentRegistry.open("book:space");
  current = "lili:2";
  release();
  assert.equal((await pending).reason, "launch_cancelled");
  assert.equal(opened, false);
});

test("background lesson refreshes do not cancel a launch, but real navigation does", async () => {
  let release, painted = null;
  const node = { classList: { contains: () => false }, querySelectorAll: () => [] };
  const context = registryContext({
    hubKid: "lucien", hubTab: "learn", navigationRevision: 1,
    KNOWLEDGE_LABS: { science: { bodyId: "body", topicsId: "topics", statusId: "status", methods: { start: "start", catalog: "catalog", snapshot: "snapshot" } } },
    knowledgeLabState: { science: { renderToken: 0 } },
    knowledgeLessonInput: () => ({ kidId: "lucien" }),
    SQLearningRuntime: { start: () => new Promise((resolve) => { release = resolve; }), catalog: () => [], snapshot: () => null },
    document: { getElementById: () => node },
    appLockReason: () => null, catLockReason: () => null, knowledgeRunIsActive: () => false,
    renderKnowledgeSnapshot: (_domain, snapshot) => { painted = snapshot.lesson.id; },
    escHtml: (value) => value || "", sBad() {},
  });
  vm.runInContext(html.slice(html.indexOf("function renderKnowledgeLab("), html.indexOf("function answerKnowledgeLessonUi(")), context);
  let pending = context.startKnowledgeLessonUi("science", "science-animals-groups");
  context.renderKnowledgeLab("science");
  release({ lesson: { id: "science-animals-groups" } });
  assert.equal((await pending).ok, true);
  assert.equal(painted, "science-animals-groups");
  pending = context.startKnowledgeLessonUi("science", "science-next");
  context.navigationRevision++;
  release({ lesson: { id: "science-next" } });
  assert.equal((await pending).reason, "launch_cancelled");
  assert.equal(painted, "science-animals-groups");
});

test("root projection covers real catalogs, stable aliases and shared lock exceptions", async () => {
  let paused = false, gamesLocked = false;
  const context = registryContext({
    hubKid: "lucien", navigationRevision: 0, KIDS: { lucien: { age: 5 } }, SQManifest: MANIFEST,
    SQLearningRuntime: { knowledgeCatalog: async () => ["science", "geography", "history"].flatMap((domain) => listKnowledgeLessons(domain)) },
    document: { getElementById() { return { querySelector() { return { textContent: "Practice 練習", querySelector: () => ({ textContent: "練習" }) }; } }; } },
    appLockReason: () => paused ? "pause" : null,
    catLockReason: (_child, category) => gamesLocked && category === "games" ? "pause" : null,
    gameLockState: () => ({ locked: gamesLocked }),
    tabLocked: (category) => gamesLocked && category === "games",
    todayStr: () => "2026-10-02",
    SQQuestProgress: { active: () => [] },
    questActionLocked: () => false,
  });
  for (const file of ["js/act-data.js", "js/learn-data.js", "js/quest-data.js", "js/reward-data.js"]) vm.runInContext(read(file), context);
  vm.runInContext(html.match(/var BOOK_SHELF = \[[\s\S]*?\n\];/)[0], context);
  for (const book of context.BOOK_SHELF) context[book.data] = [{}];
  vm.runInContext(`
    const BANK=SQ_ACT_DATA;
    const LEVELS={};
    ${html.slice(html.indexOf("function gameMeta("), html.indexOf("function renderGameSwitcher("))}
    ${html.slice(html.indexOf("function gameLaunchAccess("), html.indexOf("let gameLaunchToken="))}
    function canOpenBook(book){return !!(book&&window[book.data]&&window[book.data].length);}
    function questCatalog(){return SQQuestData.all();}
    function rewardCatalog(){return SQRewardData.all();}
    function questById(id){return questCatalog().find(row=>row.id===id);}
    function questAvailable(){return questCatalog();}
    ${html.slice(html.indexOf("let knowledgeContent="), html.indexOf("function summerQuestBack("))}
  `, context);
  const registry = context.SQContentRegistry;
  await registry.ready();
  const counts = { game: 21, music: 3, book: 8, activity: 11, guide: 3, lesson: 18, learning: 2, quest: 12, reward: 4, section: 8 };
  for (const [kind, count] of Object.entries(counts)) assert.equal(registry.list({ kind }).length, count, kind);
  assert.equal(new Set(registry.list().map((row) => row.id)).size, 90);
  for (let index = 0; index < 11; index++) assert.equal(registry.get("activity:" + index).meta.activityIndex, index);
  for (const [key, index] of [["know", 1000], ["doskill", 1001], ["askai", 1002]]) assert.equal(registry.get("guide:" + key).meta.activityIndex, index);
  const olderLesson = registry.list({ kind: "lesson" }).find((row) => row.meta.minAge > 5);
  assert.ok(olderLesson);
  assert.equal(olderLesson.reason, "age_restricted");
  gamesLocked = true;
  for (const id of ["calc", "paint"]) assert.equal(registry.get("game:" + id).available, true, id);
  assert.equal(registry.get("game:solar").available, false);
  assert.equal((await registry.open("game:solar")).reason, "category_locked");
  assert.equal(context.contentEntryAccess(registry.get("game:vocab"), { learningDirector: {} }).ok, true);
  paused = true;
  assert.equal(registry.list({ availableOnly: true }).length, 0);
  assert.equal((await registry.open("game:calc")).reason, "app_locked");
  context.hubKid = null;
  assert.equal((await registry.open("guide:know")).reason, "no_kid_selected");
});
