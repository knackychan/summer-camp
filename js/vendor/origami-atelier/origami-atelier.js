
import { ORIGAMI_MODELS, ORIGAMI_CATEGORIES, ORIGAMI_DIFFICULTY, PAPER_COLORS, getOrigamiModel, textFor } from "./origami-data.js";
import { OrigamiFoldEngine } from "./origami-engine.js";
import { createOrigamiProgressStore } from "./origami-storage.js";
import { drawTechniqueDemo, techniqueFor } from "./origami-techniques.js";

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
  /* Technique card (slice 11): which one is open, and whether the fold plays when it closes. */
  let techniqueOpen = null, techniqueResume = false, techniqueAnims = [];

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
    if (next!=="lesson") closeTechnique();
  }

  function localeControls() {
    return `<div class="oa-locale" aria-label="${t("Language","語言")}">
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
        <div class="oa-model-meta"><span class="oa-difficulty">${stars(model.difficulty)}</span><br><strong>${escapeHtml(difficultyName(model))}</strong> · ${model.steps.length} ${t("folds","步")} · ${t(`~${model.minutes} min`,`約 ${model.minutes} 分鐘`)}</div>
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
    const colors = PAPER_COLORS.map(color => `<button type="button" class="oa-color" style="background:${color.front}" data-paper="${color.id}" aria-label="${t(color.label, color.labelZh || color.label)}" aria-pressed="${progress.paperColorId===color.id}"></button>`).join("");
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
            <span class="oa-legend oa-legend-notation" data-legend="notation"><i class="oa-legend-sym" aria-hidden="true"></i><span class="oa-legend-text"></span></span>
            <button type="button" class="oa-legend oa-legend-technique" data-action="technique" hidden><span aria-hidden="true">❓</span><span class="oa-legend-text"></span></button>
          </div>
          <h2 class="oa-instruction">${escapeHtml(textFor(step.instruction, locale))}</h2>
          ${config.preReader ? "" : `<p class="oa-hint">${escapeHtml(textFor(step.hint, locale))}</p>`}
        </header>
        <div class="oa-stage-wrap">
          <div class="oa-stage" data-fold-stage></div>
          <button type="button" class="oa-slow" data-action="slow" aria-pressed="${Boolean(progress.slow)}">🐢 ${t("Slow","慢慢看")}</button>
          <div class="oa-technique" data-technique hidden></div>
          <div class="oa-companion"><span aria-hidden="true">🐈</span><p class="oa-companion-text"></p></div>
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
    engine = new OrigamiFoldEngine(view.querySelector("[data-fold-stage]"), { front:paper.front, back:paper.back, label:t("Origami folding diagram","摺紙步驟圖"), slow:Boolean(progress.slow) });
    if (keep) engine.played = keep.played;
    engine.show(step, keep ? { autoplay:!keep.paused, time:keep.time, model } : { model });
    /* Book notation (docs/plans/2026-10-05-origami-audit/ slice 05): a step with a valley,
       mountain, precrease, flip or rotate shows that one symbol and what it means; other steps
       keep the plain fold-line / arrow chips. */
    const kind = engine.parts.notation;
    view.querySelector('[data-legend="crease"]').hidden = !engine.parts.crease || Boolean(kind);
    view.querySelector('[data-legend="arrow"]').hidden = !engine.parts.arrow || Boolean(kind);
    const notation = view.querySelector('[data-legend="notation"]');
    notation.hidden = !kind;
    if (kind) {
      notation.dataset.kind = kind;
      notation.querySelector(".oa-legend-sym").innerHTML = NOTATION[kind].sym;
      notation.querySelector(".oa-legend-text").textContent = t(...NOTATION[kind].text);
    }
    /* Technique cards (docs/plans/2026-10-05-origami-audit/ slice 11): the first visit to a step
       with a new fold opens its card and the fold waits; the chip opens it again any time. */
    const tech = techniqueFor(step);
    const chip = view.querySelector('[data-action="technique"]');
    chip.hidden = !tech;
    if (tech) chip.querySelector(".oa-legend-text").textContent = `${textFor(tech.name, locale)} — ${textFor(tech.meaning, locale)}`;
    if (tech && (techniqueOpen===tech.id || (!keep && !progress.techniquesSeen?.[tech.id]))) openTechnique(tech, paper);
    else closeTechnique();
    bindScrub(view.querySelector("[data-fold-stage]"));
    syncPlayButton();
    announce(`${modelName(model)}. ${t("Step","步驟")} ${stepIndex+1}. ${textFor(step.instruction,locale)}`);
  }

  /* One button, three actions: Pause while the fold loops, Resume (Play before the first run,
     e.g. reduced motion) while it is still, Watch again once the loops have run out and the fold
     rests on the result (docs/plans/2026-10-05-origami-audit/ slice 03). Disabled on the finish
     steps, which have nothing to move. */
  const NOTATION = {
    valley:{ text:["Valley fold — fold toward you, the paper makes a V","谷摺：往自己這邊摺，紙會變成 V 字"],
      sym:'<svg viewBox="0 0 44 14"><line x1="2" y1="7" x2="30" y2="7" stroke="#a84e63" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M31 1.5 L42 7 L31 12.5 Z" fill="#3276b1"/></svg>' },
    mountain:{ text:["Mountain fold — fold away from you, the paper makes a ^","山摺：往後面摺，紙會像一座山"],
      sym:'<svg viewBox="0 0 44 14"><line x1="2" y1="7" x2="30" y2="7" stroke="#a84e63" stroke-width="2.5" stroke-dasharray="6 3 1.5 3"/><path d="M31 1 L42 7 L31 7 Z" fill="#fff9ec" stroke="#3276b1" stroke-width="2"/></svg>' },
    precrease:{ text:["Fold, press, then open again","摺好、壓一壓，再打開"],
      sym:'<svg viewBox="0 0 44 14"><line x1="2" y1="7" x2="18" y2="7" stroke="#a84e63" stroke-width="2.5" stroke-dasharray="4 3"/><line x1="24" y1="7" x2="42" y2="7" stroke="#a84e63" stroke-width="1.6"/></svg>' },
    flip:{ text:["Turn the paper over","把紙翻到背面"],
      sym:'<svg viewBox="0 0 44 22"><path d="M8 19 C4 7 22 0 30 7 C36 13 28 21 20 17 C15 14 17 8 23 7" fill="none" stroke="#3276b1" stroke-width="2.6" stroke-linecap="round"/><path d="M18 4 L26 6 L20 12 Z" fill="#3276b1"/></svg>' },
    rotate:{ text:["Turn the paper around","把紙轉個方向"],
      sym:'<svg viewBox="0 0 44 22"><path d="M32 13 A9 9 0 1 1 23 3" fill="none" stroke="#3276b1" stroke-width="2.6" stroke-linecap="round"/><path d="M20 0 L28 3 L21 8 Z" fill="#3276b1"/></svg>' },
  };

  function openTechnique(tech, paper) {
    if (techniqueOpen!==tech.id) techniqueResume = engine.hasMotion && !engine.paused && !engine.reducedMotion;
    techniqueOpen = tech.id;
    engine.pause();
    techniqueAnims.forEach(a => a.cancel());
    const box = view.querySelector("[data-technique]");
    const name = textFor(tech.name, locale);
    box.hidden = false;
    box.innerHTML = `<div class="oa-technique-card" role="dialog" aria-label="${escapeHtml(name)}">
      <div class="oa-technique-kicker">✨ ${t("New fold!","新的摺法！")}</div>
      <h3>${escapeHtml(name)}</h3>
      <svg class="oa-technique-demo" viewBox="0 0 120 90" aria-hidden="true"></svg>
      <p>${escapeHtml(textFor(tech.meaning, locale))}</p>
      <button type="button" class="oa-primary oa-technique-ok" data-action="technique-ok">${t("Got it ▶","我懂了 ▶")}</button>
    </div>`;
    techniqueAnims = drawTechniqueDemo(box.querySelector("svg"), tech, { front:paper.front, back:paper.back, reducedMotion:engine.reducedMotion });
  }

  function closeTechnique() {
    techniqueAnims.forEach(a => a.cancel());
    techniqueAnims = [];
    techniqueOpen = null;
    const box = view.querySelector("[data-technique]");
    if (box) { box.hidden = true; box.innerHTML = ""; }
  }

  /* Drag to scrub (docs/plans/2026-10-05-origami-audit/ slice 10): a sideways drag on the picture
     pauses the fold and moves it; the whole width is one loop, from wherever it was. */
  function bindScrub(stage) {
    let drag = null;
    stage.addEventListener("pointerdown", (e) => {
      if (!engine?.hasMotion) return;
      drag = { id:e.pointerId, x:e.clientX, from:engine.time, width:Math.max(1, stage.clientWidth), moving:false };
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id || !engine) return;
      const dx = e.clientX - drag.x;
      if (!drag.moving) {
        if (Math.abs(dx) < 8) return;
        drag.moving = true;
        stage.setPointerCapture?.(e.pointerId);
      }
      engine.seek(drag.from + dx / drag.width * engine.cycleMs);
      syncPlayButton();
    });
    const end = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
  }

  function syncPlayButton() {
    const btn = view.querySelector(".oa-play");
    if (!btn || !engine) return;
    const still = engine.hasMotion && (engine.paused || engine.resting);
    const companion = view.querySelector(".oa-companion-text");
    if (companion) companion.textContent = still ? t("Slide your finger on the picture to move the fold.","在圖上左右滑動手指，就能前後移動摺紙。")
      : t("Pause anytime to compare with your paper.","隨時按暫停，和你的紙比一比。");
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
    if (action==="technique") {
      const tech = engine && techniqueFor(getOrigamiModel(selectedModelId)?.steps[stepIndex]);
      if (tech) openTechnique(tech, PAPER_COLORS.find(c=>c.id===progress.paperColorId) || PAPER_COLORS[0]);
      syncPlayButton();
      return;
    }
    if (action==="technique-ok") {
      const tech = techniqueFor(getOrigamiModel(selectedModelId)?.steps[stepIndex]);
      if (tech) progress = store.patch({ techniquesSeen:{ ...(progress.techniquesSeen || {}), [tech.id]:true } });
      const play = techniqueResume;
      closeTechnique();
      if (play) engine?.resume();
      syncPlayButton();
      return;
    }
    if (action==="pause" || action==="resume" || action==="replay" || action==="watch-again") {
      if (!engine) return;
      closeTechnique();
      if (action==="pause") engine.pause();
      else if (action==="resume") engine.resume();
      else engine.replay();
      syncPlayButton();
      return;
    }
    /* 🐢 Slow (docs/plans/2026-10-05-origami-audit/ slice 09): ×1.6 time, remembered per kid. */
    if (action==="slow") {
      progress = store.patch({ slow:!progress.slow });
      engine?.setSlow(progress.slow);
      target.setAttribute("aria-pressed", String(progress.slow));
      return;
    }
    if (action==="prev-step") {
      if (stepIndex>0) { stepIndex--; closeTechnique(); renderLesson(); }
      return;
    }
    if (action==="next-step") {
      const model=getOrigamiModel(selectedModelId);
      if (!model) return;
      if (stepIndex>=model.steps.length-1) return renderComplete();
      stepIndex++; closeTechnique(); renderLesson();
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
