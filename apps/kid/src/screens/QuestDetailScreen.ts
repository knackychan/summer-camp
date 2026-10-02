import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";
import type { PlatformService } from "../../../../packages/platform/src/PlatformService.js";
import type { QuestGateway, QuestQuery } from "../../../../packages/quests/src/QuestGateway.js";

export interface QuestDetailScreenOptions {
  questId: string;
  kidId: string;
  age: number;
  gateway: QuestGateway;
  platform: PlatformService;
  profile: InteractionProfile;
}

export function renderQuestDetailScreen(root: HTMLElement, options: QuestDetailScreenOptions): void {
  const query: QuestQuery = { kidId: options.kidId, age: options.age, preference: "surprise", energy: "any" };
  const quest = options.gateway.getById(options.questId, query);
  if (!quest) {
    root.innerHTML = `<div class="empty-state">This quest is not available now.<span>這個任務現在不能開始。</span></div>`;
    return;
  }
  root.innerHTML = `
    <section class="mobile-screen quest-detail-screen" aria-labelledby="quest-detail-title">
      <article class="quest-focus-card">
        <div class="quest-focus-card__icon" aria-hidden="true">${quest.icon}</div>
        <div class="quest-focus-card__copy ${options.profile.textDensity === "none" ? "sr-only" : ""}">
          <p class="eyebrow">${quest.required ? "DAILY MISSION · 每日任務" : "QUEST · 任務"}</p>
          <h1 id="quest-detail-title">${escapeHtml(quest.title[0])}<span>${escapeHtml(quest.title[1])}</span></h1>
          <p>${escapeHtml(quest.blurb[0])}<span>${escapeHtml(quest.blurb[1])}</span></p>
          <div class="quest-focus-card__meta"><span>⏱ ${quest.duration} min</span><span>⭐ ${quest.rewardStars}</span></div>
        </div>
      </article>
      ${quest.steps.length ? `<ol class="quest-step-list">${quest.steps.map((step, index) => `<li><span class="quest-step-list__number">${index + 1}</span><div>${escapeHtml(step[0])}<small>${escapeHtml(step[1])}</small></div></li>`).join("")}</ol>` : ""}
      ${options.profile.voiceGuidance ? `<button type="button" class="voice-replay" data-read-quest aria-label="Hear this quest / 聽任務">🔊</button>` : ""}
    </section>`;

  root.querySelector<HTMLButtonElement>("[data-read-quest]")?.addEventListener("click", async () => {
    await options.platform.haptic("tap");
    await options.platform.speak(`${quest.title[0]}. ${quest.blurb[0]}`, "en-US");
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}
