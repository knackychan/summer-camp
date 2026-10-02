import type { ActivityRegistry } from "../../../../packages/activities/src/ActivityRegistry.js";
import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";
import type { NavigationService } from "../../../../packages/navigation/src/NavigationService.js";
import type { PlatformService } from "../../../../packages/platform/src/PlatformService.js";
import type { QuestGateway } from "../../../../packages/quests/src/QuestGateway.js";
import { buildWorldSnapshot, getWorldZone } from "../../../../packages/world/src/WorldModel.js";

export interface ZoneScreenOptions {
  zoneId: string;
  kidId: string;
  age: number;
  navigation: NavigationService;
  platform: PlatformService;
  profile: InteractionProfile;
  quests: QuestGateway;
  activities: ActivityRegistry;
}

export function renderZoneScreen(root: HTMLElement, options: ZoneScreenOptions): void {
  const zone = getWorldZone(options.zoneId);
  if (!zone) {
    root.innerHTML = `<div class="empty-state">This place is not available.<span>這個地方現在不能進入。</span></div>`;
    return;
  }
  const snapshot = buildWorldSnapshot(options);
  const zoneState = snapshot.zones.find((item) => item.id === zone.id);
  const zoneQuests = snapshot.availableQuests.filter((quest) => {
    if (zone.excludeQuestIds?.includes(quest.id)) return false;
    if (zone.questIds?.includes(quest.id)) return true;
    return zone.questCategories.includes(quest.category);
  });
  const zoneActivities = options.activities.listForAgeBand(options.profile.readingLevel).filter((activity) =>
    zone.activityCapabilities.some((capability) => activity.capabilities.includes(capability)),
  );

  root.innerHTML = `
    <section class="mobile-screen zone-screen" aria-labelledby="zone-title">
      <div class="zone-hero">
        <span class="zone-hero__icon" aria-hidden="true">${zone.icon}</span>
        <div class="${options.profile.textDensity === "none" ? "sr-only" : ""}">
          <p class="eyebrow">SUMMER WORLD · 夏日世界</p>
          <h1 id="zone-title">${escapeHtml(zone.label[0])}<span>${escapeHtml(zone.label[1])}</span></h1>
          <p>${escapeHtml(zone.description[0])}<span>${escapeHtml(zone.description[1])}</span></p>
        </div>
      </div>
      ${zoneState?.requiredCount ? `<div class="zone-attention ${options.profile.textDensity === "none" ? "sr-only" : ""}">⭐ ${zoneState.requiredCount} daily mission${zoneState.requiredCount === 1 ? "" : "s"} ready · ${zoneState.requiredCount} 個每日任務</div>` : ""}
      <div class="zone-content-grid">
        ${zoneQuests.map((quest) => `
          <button type="button" class="world-activity-card${quest.required ? " is-required" : ""}" data-zone-quest="${quest.id}" aria-label="${escapeHtml(quest.title[0])} / ${escapeHtml(quest.title[1])}">
            <span class="world-activity-card__icon" aria-hidden="true">${quest.icon}</span>
            <span class="world-activity-card__copy ${options.profile.textDensity === "none" ? "visually-hidden-label" : ""}">
              <strong>${escapeHtml(quest.title[0])}<small>${escapeHtml(quest.title[1])}</small></strong>
              <span>${quest.duration} min · ⭐ ${quest.rewardStars}</span>
            </span>
          </button>
        `).join("")}
        ${zoneActivities.map((activity) => `
          <button type="button" class="world-activity-card is-activity" data-zone-activity="${activity.id}" aria-label="${escapeHtml(activity.title[0])} / ${escapeHtml(activity.title[1])}">
            <span class="world-activity-card__icon" aria-hidden="true">${activity.icon}</span>
            <span class="world-activity-card__copy ${options.profile.textDensity === "none" ? "visually-hidden-label" : ""}">
              <strong>${escapeHtml(activity.title[0])}<small>${escapeHtml(activity.title[1])}</small></strong>
              <span>Explore · 探索</span>
            </span>
          </button>
        `).join("")}
        ${zoneQuests.length + zoneActivities.length === 0 ? `<div class="empty-state">Nothing is waiting here right now.<span>這裡現在沒有新的活動。</span></div>` : ""}
      </div>
    </section>`;

  root.querySelectorAll<HTMLButtonElement>("[data-zone-quest]").forEach((button) => {
    button.addEventListener("click", async () => {
      const questId = button.dataset.zoneQuest;
      if (!questId) return;
      await options.platform.haptic("tap");
      const quest = zoneQuests.find((item) => item.id === questId);
      if (quest && options.profile.voiceGuidance) await options.platform.speak(quest.title[0], "en-US");
      options.navigation.push({ name: "quest-detail", questId });
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-zone-activity]").forEach((button) => {
    button.addEventListener("click", async () => {
      const activityId = button.dataset.zoneActivity;
      if (!activityId) return;
      await options.platform.haptic("tap");
      const activity = zoneActivities.find((item) => item.id === activityId);
      if (activity && options.profile.voiceGuidance) await options.platform.speak(activity.title[0], "en-US");
      options.navigation.push({ name: "activity", activityId });
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
