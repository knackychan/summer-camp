import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";
import type { ActivityRegistry } from "../../../../packages/activities/src/ActivityRegistry.js";
import type { NavigationService, AppRoute } from "../../../../packages/navigation/src/NavigationService.js";
import type { PlatformService } from "../../../../packages/platform/src/PlatformService.js";
import type { QuestGateway } from "../../../../packages/quests/src/QuestGateway.js";
import { renderActivityHostScreen } from "../screens/ActivityHostScreen.js";
import { renderAdventureScreen } from "../screens/AdventureScreen.js";
import { renderPlanetScreen } from "../screens/PlanetScreen.js";
import { renderQuestDetailScreen } from "../screens/QuestDetailScreen.js";
import { renderQuestScreen } from "../screens/QuestScreen.js";
import { renderZoneScreen } from "../screens/ZoneScreen.js";

export interface AppOptions {
  root: HTMLElement;
  kidId: string;
  age: number;
  interactionProfile: InteractionProfile;
  navigation: NavigationService;
  platform: PlatformService;
  quests: QuestGateway;
  activities: ActivityRegistry;
}

export class App {
  private unregisterBack: (() => void) | null = null;
  private renderToken = 0;

  constructor(private readonly options: AppOptions) {}

  mount(): void {
    const { root, interactionProfile, navigation, platform } = this.options;
    root.dataset.readingLevel = interactionProfile.readingLevel;
    root.innerHTML = `
      <div class="mobile-app-shell">
        <header class="mobile-topbar">
          <button class="mobile-back" type="button" aria-label="Back / 返回">←</button>
          <div class="mobile-brand"><span aria-hidden="true">☀️</span><strong>Summer Quest</strong></div>
          <div class="mobile-runtime-status">
            <span class="mobile-offline" role="status" aria-live="polite"><span aria-hidden="true">☁️×</span><b>Offline</b></span>
            <span class="mobile-platform" aria-hidden="true">${platform.kind.toUpperCase()}</span>
          </div>
        </header>
        <main id="mobile-screen" class="mobile-screen-host"></main>
        <nav class="mobile-bottom-nav" aria-label="Main navigation / 主要導覽">
          <button type="button" data-nav="planet"><span>🪐</span><b>World</b><small>世界</small></button>
          <button type="button" data-nav="quests"><span>🧭</span><b>Quests</b><small>任務</small></button>
          <button type="button" data-nav="adventure"><span>🎮</span><b>Adventure</b><small>冒險</small></button>
        </nav>
      </div>`;

    root.querySelector<HTMLButtonElement>(".mobile-back")?.addEventListener("click", () => navigation.back());
    root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const name = button.dataset.nav;
        if (name === "planet" || name === "adventure") navigation.reset({ name });
        else if (name === "quests") navigation.reset({ name: "quests" });
      });
    });

    navigation.subscribe((route) => { void this.render(route); });
    this.unregisterBack = platform.registerBackHandler(() => navigation.back());
  }

  destroy(): void {
    this.unregisterBack?.();
    this.unregisterBack = null;
    this.options.root.innerHTML = "";
  }

  private async render(route: AppRoute): Promise<void> {
    const token = ++this.renderToken;
    const { root, navigation, platform, interactionProfile, kidId, age, quests, activities } = this.options;
    const host = root.querySelector<HTMLElement>("#mobile-screen");
    if (!host) return;

    const primary = route.name === "zone" || route.name === "quest-detail" || route.name === "activity" ? "planet" : route.name;
    root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
      const selected = button.dataset.nav === primary;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    });
    const back = root.querySelector<HTMLButtonElement>(".mobile-back");
    if (back) back.hidden = !navigation.canGoBack;
    root.classList.toggle("is-activity-open", route.name === "activity");

    if (route.name === "planet") {
      renderPlanetScreen(host, { kidId, age, navigation, platform, profile: interactionProfile, quests, activities });
      return;
    }
    if (route.name === "zone") {
      renderZoneScreen(host, { zoneId: route.zoneId, kidId, age, navigation, platform, profile: interactionProfile, quests, activities });
      return;
    }
    if (route.name === "quests") {
      renderQuestScreen(host, { kidId, age, category: route.category, gateway: quests, platform, profile: interactionProfile, navigation });
      return;
    }
    if (route.name === "quest-detail") {
      renderQuestDetailScreen(host, { questId: route.questId, kidId, age, gateway: quests, platform, profile: interactionProfile });
      return;
    }
    if (route.name === "adventure") {
      renderAdventureScreen(host, { kidId, registry: activities, platform, profile: interactionProfile, navigation });
      return;
    }
    host.innerHTML = `<div class="activity-loading"><span>☀️</span><small>Loading · 載入中</small></div>`;
    await renderActivityHostScreen(host, { activityId: route.activityId, kidId, registry: activities, profile: interactionProfile });
    if (token !== this.renderToken) return;
  }
}
