import type { ActivityRegistry } from "../../../../packages/activities/src/ActivityRegistry.js";
import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";
import type { NavigationService } from "../../../../packages/navigation/src/NavigationService.js";
import type { PlatformService } from "../../../../packages/platform/src/PlatformService.js";
import type { QuestGateway } from "../../../../packages/quests/src/QuestGateway.js";
import { buildWorldSnapshot } from "../../../../packages/world/src/WorldModel.js";

export interface PlanetScreenOptions {
  kidId: string;
  age: number;
  navigation: NavigationService;
  platform: PlatformService;
  profile: InteractionProfile;
  quests: QuestGateway;
  activities: ActivityRegistry;
}

const ZONE_CLASS: Record<string, string> = {
  daily: "hotspot-daily",
  brain: "hotspot-brain",
  garden: "hotspot-garden",
  play: "hotspot-play",
};

export function renderPlanetScreen(root: HTMLElement, options: PlanetScreenOptions): void {
  const snapshot = buildWorldSnapshot(options);
  root.innerHTML = `
    <section class="planet-screen" aria-labelledby="planet-title">
      <div class="planet-copy ${options.profile.textDensity === "none" ? "sr-only" : ""}">
        <p class="eyebrow">SUMMER WORLD · 夏日世界</p>
        <h1 id="planet-title">Where do you want to explore?<span>你想去哪裡探險？</span></h1>
      </div>
      <div class="planet-stage" role="group" aria-label="Summer Quest world 夏日任務世界">
        <div class="planet-orb" aria-hidden="true">
          <div class="planet-land planet-land-a"></div>
          <div class="planet-land planet-land-b"></div>
          <div class="planet-cloud cloud-a">☁️</div>
          <div class="planet-cloud cloud-b">☁️</div>
        </div>
        ${snapshot.zones.map((zone) => `
          <button class="world-hotspot ${ZONE_CLASS[zone.id] || ""} is-${zone.attention}" type="button" data-zone="${zone.id}" aria-label="${escapeHtml(zone.label[0])} / ${escapeHtml(zone.label[1])}">
            <span class="world-hotspot__icon" aria-hidden="true">${zone.icon}</span>
            ${zone.attention !== "quiet" ? `<span class="world-hotspot__signal" aria-hidden="true">${zone.requiredCount ? "!" : zone.questCount + zone.activityCount}</span>` : ""}
            <span class="world-hotspot__label ${options.profile.textDensity === "none" ? "visually-hidden-label" : ""}">${escapeHtml(zone.label[0])}<small>${escapeHtml(zone.label[1])}</small></span>
          </button>
        `).join("")}
        <div class="planet-summer" aria-hidden="true"><span>☀️</span></div>
      </div>
      <p class="planet-hint ${options.profile.textDensity === "none" ? "sr-only" : ""}">Tap a place to visit it. <span>點一個地方開始。</span></p>
    </section>`;

  root.querySelectorAll<HTMLButtonElement>("[data-zone]").forEach((button) => {
    button.addEventListener("click", async () => {
      const zoneId = button.dataset.zone;
      if (!zoneId) return;
      await options.platform.haptic("tap");
      const zone = snapshot.zones.find((item) => item.id === zoneId);
      if (zone && options.profile.voiceGuidance) await options.platform.speak(zone.label[0], "en-US");
      options.navigation.push({ name: "zone", zoneId });
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
