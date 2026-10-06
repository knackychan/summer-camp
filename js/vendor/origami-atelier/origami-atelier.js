
import { ORIGAMI_MODELS, ORIGAMI_CATEGORIES, ORIGAMI_DIFFICULTY, PAPER_COLORS, getOrigamiModel, textFor } from "./origami-data.js";
import { OrigamiFoldEngine } from "./origami-engine.js";
import { createOrigamiProgressStore } from "./origami-storage.js";

const STYLE_ID = "sq-origami-atelier-style-v1";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = new URL("./origami-atelier.css", import.meta.url).href;
  document.head.appendChild(link);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function stars(n) { const level=Math.max(1,Math.min(5,Number(n)||1)); return "★".repeat(level) + "☆".repeat(5-level); }

export function mountOrigamiAtelier(root, options = {}) {
  if (!root) throw new Error("Origami Atelier requires a mount root.");
  ensureStyles();

  const config = {
    profileId: options.profileId || "kid",
    preReader: Boolean(options.preReader),
    locale: options.locale === "zhHant" ? "zhHant" : "en",
    storage: options.storage || null,
    onExit: typeof options.onExit === "function" ? options.onExit : () => {},
    onComplete: typeof options.onComplete === "function" ? options.onComplete : () => {}
  };

  const store = createOrigamiProgressStore({ profileId: config.profileId, storage: config.storage });
  let progress = store.load();
  let screen = "library";
  let selectedModelId = progress.lastModelId || ORIGAMI_MODELS[0].id;
  let selectedCategory = "all";
  let selectedDifficulty = "all";
  let stepIndex = Math.max(0, Number(progress.lastStepIndex || 0));
  let locale = config.locale;
  let engine = null;
  let destroyed = false;

  root.innerHTML = `<div class="oa-root"><main class="oa-shell" data-oa-view></main><div class="oa-screen-reader" aria-live="polite" data-oa-live></div></div>`;
  const view = root.querySelector("[data-oa-view]");
  const live = root.querySelector("[data-oa-live]");

  function t(en, zh) { return locale === "zhHant" ? zh : en; }
  function modelName(model) { return locale === "zhHant" ? model.nameZh : model.name; }
  function difficultyName(model) { return textFor(ORIGAMI_DIFFICULTY[model.difficulty] || ORIGAMI_DIFFICULTY[1], locale); }
  function announce(msg) { if (live) live.textContent = msg; }

  /* The lesson pins the whole Atelier to the frame (no scroll); every other screen scrolls.
     Leaving the lesson stops the fold loop. */
  function setScreen(next) {
    screen = next;
    root.querySelector(".oa-root").classList.toggle("oa-lesson-mode", next==="lesson");
    if (next!=="lesson" && engine) { engine.destroy(); engine = null; }
  }

  function localeControls() {
    return `<div class="oa-locale" aria-label="Language">
      <button type="button" data-action="locale-en" aria-pressed="${locale==="en"}">EN</button>
      <button type="button" data-action="locale-zh" aria-pressed="${locale==="zhHant"}">中文</button>
    </div>`;
  }

  function topbar(title, subtitle = "", { back = true, actions = "" } = {}) {
    return `<div class="oa-topbar">
      ${back ? `<button type="button" class="oa-back" data-action="screen-back" aria-label="${t("Back","返回")}">←</button>` : ""}
      <div class="oa-title-wrap">
        <div class="oa-kicker">Origami Atelier · 摺紙工房</div>
        <div class="oa-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="oa-subtitle">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      ${actions}
      ${localeControls()}
    </div>`;
  }

  function renderLibrary() {
    setScreen("library");
    const categories = ORIGAMI_CATEGORIES.map(cat => `
      <button type="button" class="oa-category-btn" data-category="${cat.id}" aria-pressed="${selectedCategory===cat.id}">
        ${cat.icon} ${escapeHtml(textFor(cat.label, locale))}
      </button>`).join("");
    const difficultyControls = [`<button type="button" class="oa-level-btn" data-difficulty="all" aria-pressed="${selectedDifficulty==="all"}">${t("All levels","全部難度")}</button>`, ...Object.entries(ORIGAMI_DIFFICULTY).map(([level,label]) => `<button type="button" class="oa-level-btn" data-difficulty="${level}" aria-pressed="${String(selectedDifficulty)===String(level)}">${"★".repeat(Number(level))} ${escapeHtml(textFor(label, locale))}</button>`)].join("");
    const visible = ORIGAMI_MODELS.filter(m => (selectedCategory==="all" || m.category===selectedCategory) && (selectedDifficulty==="all" || String(m.difficulty)===String(selectedDifficulty)));
    const cards = visible.map(model => {
      const complete = Boolean(progress.completedModels?.[model.id]);
      return `<button type="button" class="oa-model-card" data-model="${model.id}" aria-label="${escapeHtml(modelName(model))}">
        ${complete ? `<span class="oa-complete-stamp">✓ ${t("MADE","完成")}</span>` : ""}
        <div class="oa-model-icon" aria-hidden="true">${model.icon}</div>
        <div class="oa-model-name">${escapeHtml(modelName(model))}</div>
        <div class="oa-model-meta"><span class="oa-difficulty">${stars(model.difficulty)}</span><br><strong>${escapeHtml(difficultyName(model))}</strong> · ${model.steps.length} ${t("folds","步")} · ~${model.minutes} min</div>
      </button>`;
    }).join("");
    const resumed = progress.lastModelId ? getOrigamiModel(progress.lastModelId) : null;
    const shelf = `<button type="button" class="oa-secondary oa-shelf-btn" data-action="collection">🗂 ${t("My Collection","我的收藏")}</button>`;
    view.innerHTML = `
      ${topbar(t("Origami Atelier","摺紙工房"), t("Get a square sheet of paper, then choose something to fold.","準備一張正方形紙，再選一個作品來摺。"), {back:false, actions:shelf})}
      <div class="oa-library-layout">
        <aside class="oa-category-panel oa-pixel-panel">${categories}</aside>
        <section class="oa-library-main">
          ${resumed ? `<button type="button" class="oa-continue" data-action="continue">▶ ${t("Continue","繼續")} ${escapeHtml(modelName(resumed))}<small>${t("Step","步驟")} ${Math.min(progress.lastStepIndex+1,resumed.steps.length)} / ${resumed.steps.length}</small></button>` : ""}
          <div class="oa-level-strip oa-pixel-panel" aria-label="${t("Difficulty","難度")}">${difficultyControls}</div>
          <div class="oa-library-count">${visible.length} ${t("models","個作品")}</div>
          <div class="oa-model-grid" aria-label="${t("Origami models","摺紙作品")}">${cards || `<div class="oa-empty-library">${t("No models in this combination yet.","這個分類和難度目前還沒有作品。")}</div>`}</div>
        </section>
      </div>`;
  }

  function renderPrep() {
    setScreen("prep");
    const model = getOrigamiModel(selectedModelId) || ORIGAMI_MODELS[0];
    const colors = PAPER_COLORS.map(color => `<button type="button" class="oa-color" style="background:${color.front}" data-paper="${color.id}" aria-label="${color.label}" aria-pressed="${progress.paperColorId===color.id}"></button>`).join("");
    const skills = (model.skills || []).map(skill => `<span class="oa-skill-chip">${escapeHtml(textFor(skill, locale))}</span>`).join("");
    view.innerHTML = `
      ${topbar(modelName(model), t(`${model.steps.length} folds · one square sheet`,`${model.steps.length} 步 · 一張正方形紙`))}
      <div class="oa-prep">
        <section class="oa-prep-preview oa-pixel-panel">
          <div class="oa-finished-big" aria-label="${escapeHtml(modelName(model))}">${model.icon}</div>
          <div class="oa-square-note"><span class="oa-mini-square" aria-hidden="true"></span>${t("Get one square sheet of paper.","準備一張正方形紙。")}</div>
        </section>
        <section class="oa-prep-options oa-pixel-panel">
          <div class="oa-prep-level"><span class="oa-difficulty">${stars(model.difficulty)}</span> <strong>${escapeHtml(difficultyName(model))}</strong></div>
          ${skills ? `<div class="oa-skill-row">${skills}</div>` : ""}
          <h2>${t("Match your paper","選擇紙張顏色")}</h2>
          <p>${t("Pick the closest color. This only changes the guide on screen.","選一個最接近手上紙張的顏色，只會改變畫面中的教學紙。")}</p>
          <div class="oa-color-row">${colors}</div>
          <p><strong>${t("Ready?","準備好了嗎？")}</strong><br>${t("Put your paper beside the tablet. Watch first, then copy the fold.","把紙放在平板旁邊。先看動畫，再跟著摺。")}</p>
          <button type="button" class="oa-primary" data-action="start-lesson">${t("I'm Ready →","準備好了 →")}</button>
        </section>
      </div>`;
  }

  /* v0.3 lesson (docs/plans/2026-10-04-origami-lesson/): one panel that fits the frame,
     the fold loops on its own, Pause/Resume is the big control. keep = engine.snapshot()
     when re-rendering the same step (language switch), so the loop picks up where it was. */
  function renderLesson({ keep = null } = {}) {
    setScreen("lesson");
    const model = getOrigamiModel(selectedModelId);
    if (!model) return renderLibrary();
    stepIndex = Math.max(0, Math.min(stepIndex, model.steps.length-1));
    progress = store.patch({ lastModelId:model.id, lastStepIndex:stepIndex });
    const step = model.steps[stepIndex];
    const last = stepIndex===model.steps.length-1;
    const dots = model.steps.map((_,i)=>`<span class="oa-dot ${i<stepIndex?"done":""} ${i===stepIndex?"current":""}" aria-hidden="true"></span>`).join("");
    view.innerHTML = `
      ${topbar(modelName(model))}
      <div class="oa-lesson oa-pixel-panel">
        <header class="oa-lesson-head">
          <div class="oa-lesson-meta">
            <span class="oa-step-badge">${t(`Step ${stepIndex+1} of ${model.steps.length}`,`步驟 ${stepIndex+1} / ${model.steps.length}`)}</span>
            <span class="oa-legend" data-legend="crease"><i class="oa-legend-crease" aria-hidden="true"></i>${t("Fold line","摺線")}</span>
            <span class="oa-legend" data-legend="arrow"><i class="oa-legend-arrow" aria-hidden="true">➜</i>${t("Fold this way","往這邊摺")}</span>
          </div>
          <h2 class="oa-instruction">${escapeHtml(textFor(step.instruction, locale))}</h2>
          ${config.preReader ? "" : `<p class="oa-hint">${escapeHtml(textFor(step.hint, locale))}</p>`}
        </header>
        <div class="oa-stage-wrap">
          <div class="oa-stage" data-fold-stage></div>
          <div class="oa-companion"><span aria-hidden="true">🐈</span>${t("Pause anytime to compare with your paper.","隨時按暫停，和你的紙比一比。")}</div>
        </div>
        <div class="oa-controls">
          <button type="button" class="oa-play" data-action="pause"></button>
          <button type="button" class="oa-secondary" data-action="replay">↻ ${t("Replay","重播")}</button>
          <button type="button" class="oa-secondary" data-action="prev-step" ${stepIndex===0?"disabled":""}>◀ ${t("Back","上一步")}</button>
          <button type="button" class="oa-secondary oa-next ${last?"oa-finish":""}" data-action="next-step">${last?t("Finished ✓","完成 ✓"):t("Next ▶","下一步 ▶")}</button>
        </div>
        <div class="oa-progress" aria-label="${t("Progress","進度")}">${dots}</div>
      </div>`;
    const paper = PAPER_COLORS.find(c=>c.id===progress.paperColorId) || PAPER_COLORS[0];
    engine?.destroy();
    engine = new OrigamiFoldEngine(view.querySelector("[data-fold-stage]"), { front:paper.front, back:paper.back });
    if (keep) engine.played = keep.played;
    engine.show(step, keep ? { autoplay:!keep.paused, time:keep.time } : {});
    view.querySelector('[data-legend="crease"]').hidden = !engine.parts.crease;
    view.querySelector('[data-legend="arrow"]').hidden = !engine.parts.arrow;
    syncPlayButton();
    announce(`${modelName(model)}. ${t("Step","步驟")} ${stepIndex+1}. ${textFor(step.instruction,locale)}`);
  }

  /* One button, three actions: Pause while the fold loops, Resume (Play before the first run,
     e.g. reduced motion) while it is still, Watch again once the loops have run out and the fold
     rests on the result (docs/plans/2026-10-05-origami-audit/ slice 03). Disabled on the finish
     steps, which have nothing to move. */
  function syncPlayButton() {
    const btn = view.querySelector(".oa-play");
    if (!btn || !engine) return;
    if (engine.resting) {
      btn.dataset.action = "watch-again";
      btn.disabled = false;
      btn.textContent = `▶ ${t("Watch again","再看一次")}`;
      return;
    }
    const playing = engine.hasMotion && !engine.paused;
    btn.dataset.action = playing ? "pause" : "resume";
    btn.disabled = !engine.hasMotion;
    btn.textContent = playing ? `⏸ ${t("Pause","暫停")}` : engine.played ? `▶ ${t("Resume","繼續")}` : `▶ ${t("Play","播放")}`;
    if (playing) engine.onRest(syncPlayButton);
  }

  function renderComplete({ mark = true } = {}) {
    setScreen("complete");
    const model = getOrigamiModel(selectedModelId);
    if (mark) {
      progress = store.markComplete(model.id);
      config.onComplete({ modelId:model.id, profileId:config.profileId });
    }
    view.innerHTML = `
      ${topbar(t("You Did It!","完成了！"), modelName(model))}
      <section class="oa-complete oa-pixel-panel">
        <div class="oa-complete-icon">${model.icon}</div>
        <h2>${t("Your paper creation is ready.","你的摺紙作品完成了。")}</h2>
        <p>${t("It has been added to your Origami Shelf.","已經放進你的摺紙收藏架。")}</p>
        <div class="oa-home-actions">
          <button type="button" class="oa-primary" data-action="collection">${t("See My Collection","看看我的收藏")}</button>
          <button type="button" class="oa-secondary" data-action="library">${t("Make Another","再做一個")}</button>
        </div>
      </section>`;
    announce(t("Origami complete.","摺紙完成。"));
  }

  function renderCollection() {
    setScreen("collection");
    const slots = ORIGAMI_MODELS.map(model => {
      const item = progress.completedModels?.[model.id];
      return `<button type="button" class="oa-shelf-slot ${item?"completed":""}" data-model="${model.id}" aria-label="${escapeHtml(modelName(model))}">
        <span class="${item?"oa-shelf-icon":"oa-empty"}" aria-hidden="true">${item?model.icon:"?"}</span>
        <span class="oa-shelf-name">${item?escapeHtml(modelName(model)):t("Unmade","還沒完成")}</span>
      </button>`;
    }).join("");
    view.innerHTML = `
      ${topbar(t("My Origami Shelf","我的摺紙收藏"), t("Things you made with your own hands.","你親手完成的作品。"))}
      <section class="oa-collection-room oa-pixel-panel">
        <div class="oa-shelf">${slots}</div>
        <p class="oa-shelf-note">${t("Choose a finished model to make it again, or an empty space to try something new.","點選已完成作品可以再做一次；空的位置則可以開始新的作品。")}</p>
      </section>`;
  }

  function changeLocale(next) {
    locale = next;
    if (screen==="library") renderLibrary();
    else if (screen==="prep") renderPrep();
    else if (screen==="lesson") renderLesson({keep:engine?.snapshot()});
    else if (screen==="collection") renderCollection();
    else if (screen==="complete") renderComplete({mark:false});
  }

  function screenBack() {
    if (screen==="lesson") { renderPrep(); return true; }
    if (screen==="prep") { renderLibrary(); return true; }
    if (screen==="collection" || screen==="complete") { renderLibrary(); return true; }
    config.onExit();
    return false;
  }

  function onClick(event) {
    const target = event.target.closest("button");
    if (!target || !root.contains(target)) return;
    const action = target.dataset.action;
    if (target.dataset.category) { selectedCategory=target.dataset.category; renderLibrary(); return; }
    if (target.dataset.difficulty) { selectedDifficulty=target.dataset.difficulty; renderLibrary(); return; }
    if (target.dataset.model) { selectedModelId=target.dataset.model; stepIndex=0; renderPrep(); return; }
    if (target.dataset.paper) { progress=store.patch({paperColorId:target.dataset.paper}); renderPrep(); return; }

    if (action==="locale-en") return changeLocale("en");
    if (action==="locale-zh") return changeLocale("zhHant");
    if (action==="screen-back") return screenBack();
    if (action==="library") return renderLibrary();
    if (action==="collection") return renderCollection();
    if (action==="exit") return config.onExit();
    if (action==="continue") {
      selectedModelId=progress.lastModelId;
      stepIndex=Math.max(0,progress.lastStepIndex||0);
      return renderLesson();
    }
    if (action==="start-lesson") { stepIndex=0; return renderLesson(); }
    if (action==="pause" || action==="resume" || action==="replay" || action==="watch-again") {
      if (!engine) return;
      if (action==="pause") engine.pause();
      else if (action==="resume") engine.resume();
      else engine.replay();
      syncPlayButton();
      return;
    }
    if (action==="prev-step") {
      if (stepIndex>0) { stepIndex--; renderLesson(); }
      return;
    }
    if (action==="next-step") {
      const model=getOrigamiModel(selectedModelId);
      if (!model) return;
      if (stepIndex>=model.steps.length-1) return renderComplete();
      stepIndex++; renderLesson();
    }
  }

  root.addEventListener("click", onClick);
  renderLibrary();

  return {
    back: screenBack,
    getState: () => ({ screen, selectedModelId, stepIndex, locale, progress: store.load() }),
    setLocale: changeLocale,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      engine?.destroy();
      root.removeEventListener("click", onClick);
      root.innerHTML = "";
    }
  };
}
