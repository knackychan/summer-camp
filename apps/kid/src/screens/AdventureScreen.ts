import type { ActivityRegistry } from "../../../../packages/activities/src/ActivityRegistry.js";
import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";
import type { NavigationService } from "../../../../packages/navigation/src/NavigationService.js";
import type { PlatformService } from "../../../../packages/platform/src/PlatformService.js";

export interface AdventureScreenOptions {
  kidId: string;
  registry: ActivityRegistry;
  platform: PlatformService;
  profile: InteractionProfile;
  navigation: NavigationService;
}

export function renderAdventureScreen(root: HTMLElement, options: AdventureScreenOptions): void {
  const activities = options.registry.listForAgeBand(options.profile.readingLevel);
  root.innerHTML = `
    <section class="mobile-screen adventure-screen" aria-labelledby="adventure-title">
      <div class="screen-head ${options.profile.textDensity === "none" ? "sr-only" : ""}">
        <p class="eyebrow">ADVENTURE · 冒險</p>
        <h1 id="adventure-title">Choose a place to play<span>選一個地方開始玩</span></h1>
      </div>
      <div class="adventure-grid">
        ${activities.map((activity) => `
          <button type="button" class="adventure-card" data-activity="${activity.id}" aria-label="${escapeHtml(activity.title[0])} / ${escapeHtml(activity.title[1])}">
            <span class="adventure-card__icon" aria-hidden="true">${activity.icon}</span>
            <span class="adventure-card__copy ${options.profile.textDensity === "none" ? "visually-hidden-label" : ""}">
              <strong>${escapeHtml(activity.title[0])}</strong><small>${escapeHtml(activity.title[1])}</small>
            </span>
          </button>
        `).join("")}
      </div>
    </section>`;

  root.querySelectorAll<HTMLButtonElement>("[data-activity]").forEach((button) => {
    button.addEventListener("click", async () => {
      const activityId = button.dataset.activity;
      if (!activityId) return;
      await options.platform.haptic("tap");
      const activity = activities.find((item) => item.id === activityId);
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
