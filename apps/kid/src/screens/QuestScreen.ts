import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";
import type { NavigationService } from "../../../../packages/navigation/src/NavigationService.js";
import type { PlatformService } from "../../../../packages/platform/src/PlatformService.js";
import type { QuestGateway, QuestQuery } from "../../../../packages/quests/src/QuestGateway.js";

export interface QuestScreenOptions {
  kidId: string;
  age: number;
  category?: string | undefined;
  gateway: QuestGateway;
  platform: PlatformService;
  profile: InteractionProfile;
  navigation: NavigationService;
}

export function renderQuestScreen(root: HTMLElement, options: QuestScreenOptions): void {
  const query: QuestQuery = { kidId: options.kidId, age: options.age, preference: "surprise", energy: "any" };
  const all = options.gateway.listAvailable(query);
  const quests = (options.category ? all.filter((quest) => quest.category === options.category) : all).slice(0, 12);
  root.innerHTML = `
    <section class="mobile-screen quest-screen" aria-labelledby="quest-title">
      <div class="screen-head ${options.profile.textDensity === "none" ? "sr-only" : ""}">
        <p class="eyebrow">QUESTS · 任務</p>
        <h1 id="quest-title">Things you can do now<span>現在可以做的事情</span></h1>
      </div>
      <div class="quest-grid">
        ${quests.map((quest) => `
          <button type="button" class="mobile-quest-card${quest.required ? " is-required" : ""}" data-quest="${quest.id}" aria-label="${escapeHtml(quest.title[0])} / ${escapeHtml(quest.title[1])}">
            <span class="mobile-quest-card__icon" aria-hidden="true">${quest.icon}</span>
            <span class="mobile-quest-card__copy ${options.profile.textDensity === "none" ? "visually-hidden-label" : ""}">
              <strong>${escapeHtml(quest.title[0])}<small>${escapeHtml(quest.title[1])}</small></strong>
              <span>${quest.duration} min · ⭐ ${quest.rewardStars}</span>
            </span>
          </button>
        `).join("") || `<div class="empty-state">No quest is ready right now.<span>現在沒有可開始的任務。</span></div>`}
      </div>
    </section>`;

  root.querySelectorAll<HTMLButtonElement>("[data-quest]").forEach((button) => {
    button.addEventListener("click", async () => {
      const questId = button.dataset.quest;
      if (!questId) return;
      await options.platform.haptic("tap");
      const quest = quests.find((item) => item.id === questId);
      if (quest && options.profile.voiceGuidance) await options.platform.speak(quest.title[0], "en-US");
      options.navigation.push({ name: "quest-detail", questId });
    });
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
