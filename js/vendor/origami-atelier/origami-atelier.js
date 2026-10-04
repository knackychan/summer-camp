
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

function blossomMarkup() {
  return Array.from({length:8}, (_,i)=>`<span class="oa-blossom" style="right:${20+(i%4)*42}px;bottom:${42+(i%3)*34}px"></span>`).join("");
}

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
  let screen = "home";
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

  function localeControls() {
    return `<div class="oa-locale" aria-label="Language">
      <button type="button" data-action="locale-en" aria-pressed="${locale==="en"}">EN</button>
      <button type="button" data-action="locale-zh" aria-pressed="${locale==="zhHant"}">中文</button>
    </div>`;
  }

  function topbar(title, subtitle = "", { back = true } = {}) {
    return `<div class="oa-topbar">
      ${back ? `<button type="button" class="oa-back" data-action="screen-back" aria-label="${t("Back","返回")}">←</button>` : ""}
      <div class="oa-title-wrap">
        <div class="oa-kicker">Origami Atelier · 折り紙工房</div>
        <div class="oa-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="oa-subtitle">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      ${localeControls()}
    </div>`;
  }

  function renderHome() {
    screen = "home";
    const resumed = progress.lastModelId ? getOrigamiModel(progress.lastModelId) : null;
    view.innerHTML = `
      ${topbar(t("Origami Atelier","摺紙工房"), t("Real paper. One fold at a time.","拿起真正的紙，一步一步摺。"), {back:false})}
      ${resumed ? `<div class="oa-resume oa-pixel-panel">
        <div><strong>${t("Continue","繼續")} ${escapeHtml(modelName(resumed))}</strong><br><small>${t("Step","步驟")} ${Math.min(progress.lastStepIndex+1,resumed.steps.length)} / ${resumed.steps.length}</small></div>
        <button type="button" class="oa-secondary" data-action="resume">${t("Continue →","繼續 →")}</button>
      </div>` : ""}
      <section class="oa-home oa-pixel-panel">
        <div class="oa-window">
          <div class="oa-sun"></div>
          <div class="oa-cloud c1"></div><div class="oa-cloud c2"></div>
          <div class="oa-mountain one"></div><div class="oa-mountain two"></div>
          <div class="oa-sakura-branch"></div>${blossomMarkup()}
          <div class="oa-home-copy">
            <h1>${t("Small folds.<br>Big imagination.","小小摺痕。<br>大大想像。")}</h1>
            <p>${t("Choose a model, put a square sheet beside the tablet, and follow one gentle movement at a time.","選一個作品，把正方形紙放在平板旁邊，一次跟著一個動作完成。")}</p>
          </div>
        </div>
        <div class="oa-room">
          <div>
            <div class="oa-table"><div class="oa-paper-stack" aria-hidden="true"></div><strong>${t("Your paper is the controller.","真正的紙就是你的操作方式。")}</strong></div>
            <div class="oa-home-actions">
              <button type="button" class="oa-primary" data-action="library">${t("Begin Your Journey →","開始摺紙 →")}</button>
              <button type="button" class="oa-secondary" data-action="collection">${t("My Collection","我的收藏")}</button>
              <button type="button" class="oa-secondary" data-action="exit">${t("Back to Summer Quest","回到 Summer Quest")}</button>
            </div>
          </div>
          <div class="oa-cat" aria-hidden="true">🐈</div>
        </div>
      </section>`;
  }

  function renderLibrary() {
    screen = "library";
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
    view.innerHTML = `
      ${topbar(t("Origami Library","摺紙圖書館"), t("Choose something you want to make.","選一個你想做的作品。"))}
      <div class="oa-library-layout">
        <aside class="oa-category-panel oa-pixel-panel">${categories}</aside>
        <section class="oa-library-main">
          <div class="oa-level-strip oa-pixel-panel" aria-label="${t("Difficulty","難度")}">${difficultyControls}</div>
          <div class="oa-library-count">${visible.length} ${t("models","個作品")}</div>
          <div class="oa-model-grid" aria-label="${t("Origami models","摺紙作品")}">${cards || `<div class="oa-empty-library">${t("No models in this combination yet.","這個分類和難度目前還沒有作品。")}</div>`}</div>
        </section>
      </div>`;
  }

  function renderPrep() {
    screen = "prep";
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

  function renderLesson({ replay = true } = {}) {
    screen = "lesson";
    const model = getOrigamiModel(selectedModelId);
    if (!model) return renderLibrary();
    stepIndex = Math.max(0, Math.min(stepIndex, model.steps.length-1));
    progress = store.patch({ lastModelId:model.id, lastStepIndex:stepIndex });
    const step = model.steps[stepIndex];
    const dots = model.steps.map((_,i)=>`<span class="oa-dot ${i<stepIndex?"done":""} ${i===stepIndex?"current":""}" aria-hidden="true"></span>`).join("");
    view.innerHTML = `
      ${topbar(modelName(model), `${t("Step","步驟")} ${stepIndex+1} / ${model.steps.length}`)}
      <div class="oa-lesson">
        <section class="oa-stage-panel oa-pixel-panel">
          <div class="oa-stage" data-fold-stage></div>
          <div class="oa-progress" aria-label="${t("Progress","進度")}">${dots}</div>
          <div class="oa-controls">
            <button type="button" class="oa-secondary" data-action="prev-step" ${stepIndex===0?"disabled":""}>← ${t("Back","上一步")}</button>
            <button type="button" class="oa-secondary" data-action="replay">↻ ${t("Replay","重播")}</button>
            <button type="button" class="oa-primary" data-action="next-step">${stepIndex===model.steps.length-1?t("Finished ✓","完成 ✓"):t("Next →","下一步 →")}</button>
          </div>
        </section>
        <aside class="oa-side-panel oa-pixel-panel">
          <div><span class="oa-step-badge">${t("STEP","步驟")} ${stepIndex+1}</span></div>
          <h2 class="oa-instruction">${escapeHtml(textFor(step.instruction, locale))}</h2>
          ${config.preReader ? "" : `<p class="oa-hint">${escapeHtml(textFor(step.hint, locale))}</p>`}
          <div class="oa-companion"><span aria-hidden="true">🐈</span><div>${t("Watch once. Then try it on your real paper.","先看一次，再用真正的紙跟著做。")}</div></div>
        </aside>
      </div>`;
    const paper = PAPER_COLORS.find(c=>c.id===progress.paperColorId) || PAPER_COLORS[0];
    engine?.destroy();
    engine = new OrigamiFoldEngine(view.querySelector("[data-fold-stage]"), { front:paper.front, back:paper.back });
    engine.show(step,{animate:replay});
    announce(`${modelName(model)}. ${t("Step","步驟")} ${stepIndex+1}. ${textFor(step.instruction,locale)}`);
  }

  function renderComplete({ mark = true } = {}) {
    screen = "complete";
    const model = getOrigamiModel(selectedModelId);
    if (mark) {
      progress = store.markComplete(model.id);
      config.onComplete({ modelId:model.id, profileId:config.profileId });
    }
    view.innerHTML = `
      ${topbar(t("You Did It!","完成了！"), modelName(model))}
      <section class="oa-pixel-panel" style="padding:20px;text-align:center">
        <div style="font-size:140px;line-height:1.1;margin:20px 0">${model.icon}</div>
        <h2 style="font-size:30px;margin:8px 0">${t("Your paper creation is ready.","你的摺紙作品完成了。")}</h2>
        <p style="color:var(--oa-muted)">${t("It has been added to your Origami Shelf.","已經放進你的摺紙收藏架。")}</p>
        <div class="oa-home-actions">
          <button type="button" class="oa-primary" data-action="collection">${t("See My Collection","看看我的收藏")}</button>
          <button type="button" class="oa-secondary" data-action="library">${t("Make Another","再做一個")}</button>
        </div>
      </section>`;
    announce(t("Origami complete.","摺紙完成。"));
  }

  function renderCollection() {
    screen = "collection";
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
        <p style="text-align:center;color:var(--oa-muted);margin-bottom:0">${t("Choose a finished model to make it again, or an empty space to try something new.","點選已完成作品可以再做一次；空的位置則可以開始新的作品。")}</p>
      </section>`;
  }

  function changeLocale(next) {
    locale = next;
    if (screen==="home") renderHome();
    else if (screen==="library") renderLibrary();
    else if (screen==="prep") renderPrep();
    else if (screen==="lesson") renderLesson({replay:false});
    else if (screen==="collection") renderCollection();
    else if (screen==="complete") renderComplete({mark:false});
  }

  function screenBack() {
    if (screen==="lesson") { renderPrep(); return true; }
    if (screen==="prep") { renderLibrary(); return true; }
    if (screen==="library" || screen==="collection" || screen==="complete") { renderHome(); return true; }
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
    if (action==="resume") {
      selectedModelId=progress.lastModelId;
      stepIndex=Math.max(0,progress.lastStepIndex||0);
      return renderLesson();
    }
    if (action==="start-lesson") { stepIndex=0; return renderLesson(); }
    if (action==="replay") {
      const model=getOrigamiModel(selectedModelId);
      if (model && engine) engine.show(model.steps[stepIndex],{animate:true});
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
  renderHome();

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
