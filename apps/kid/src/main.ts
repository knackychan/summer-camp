import { ActivityRegistry } from "../../../packages/activities/src/ActivityRegistry.js";
import { createLegacyBrainGymAdapter } from "../../../packages/activities/src/legacy/LegacyBrainGymAdapter.js";
import { createLegacyHubSectionAdapter } from "../../../packages/activities/src/legacy/LegacyHubSectionAdapter.js";
import { defaultInteractionProfileForAge, resolveInteractionProfile } from "../../../packages/core/src/interaction-profile.js";
import { NavigationService } from "../../../packages/navigation/src/NavigationService.js";
import { createPlatformService } from "../../../packages/platform/src/createPlatformService.js";
import { LegacyQuestGateway } from "../../../packages/quests/src/legacy/LegacyQuestGateway.js";
import { AppSessionStore } from "../../../packages/state/src/AppSessionStore.js";
import { LocalStorageDriver } from "../../../packages/storage/src/web/LocalStorageDriver.js";
import { App } from "./app/App.js";
import { installTabletRuntimeSignals } from "./runtime/TabletRuntimeController.js";

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Summer Quest mobile root #app is missing");

  const params = new URLSearchParams(window.location.search);
  const storage = new LocalStorageDriver();
  const sessionStore = new AppSessionStore(storage);
  const legacyKid = window.localStorage.getItem("sq:kid") || undefined;
  const requestedKid = params.get("kid") || legacyKid || undefined;
  const requestedAge = params.has("age") ? Math.max(3, Math.min(17, Number(params.get("age")) || 8)) : undefined;
  const fallbackAge = requestedAge ?? 8;
  const session = await sessionStore.load({
    kidId: requestedKid || "kid",
    age: fallbackAge,
    interactionProfile: defaultInteractionProfileForAge(fallbackAge),
  });
  if (requestedKid) session.kidId = requestedKid;
  if (requestedAge != null) session.age = requestedAge;
  const mode = params.get("mode");
  session.interactionProfile = resolveInteractionProfile(session.age, mode, session.interactionProfile);
  await sessionStore.save(session);

  // Keep the legacy application aware of the selected child while features are
  // progressively migrated into the mobile shell.
  window.localStorage.setItem("sq:kid", session.kidId);
  window.localStorage.setItem("sq:view", "hub");

  const platform = createPlatformService();
  const nativeLegacyUrl = platform.kind === "android" ? "./legacy.html" : "../../index.html";

  const activities = new ActivityRegistry();
  activities.register(createLegacyBrainGymAdapter({ launchUrl: `${nativeLegacyUrl}#games` }));
  activities.register(createLegacyHubSectionAdapter({
    id: "summer-games",
    title: ["Summer Games", "夏日遊戲"],
    icon: "🎮",
    hash: "games",
    capabilities: ["play"],
    launchUrlPrefix: nativeLegacyUrl,
  }));
  activities.register(createLegacyHubSectionAdapter({
    id: "activity-lab",
    title: ["Activity Lab", "活動實驗室"],
    icon: "🛠️",
    hash: "acts",
    capabilities: ["play", "creative"],
    launchUrlPrefix: nativeLegacyUrl,
  }));
  activities.register(createLegacyHubSectionAdapter({
    id: "books",
    title: ["Reading World", "閱讀世界"],
    icon: "📚",
    hash: "books",
    capabilities: ["learning", "books"],
    launchUrlPrefix: nativeLegacyUrl,
  }));
  activities.register(createLegacyHubSectionAdapter({
    id: "music-room",
    title: ["Music Room", "音樂室"],
    icon: "🎹",
    hash: "music",
    capabilities: ["play", "music", "creative"],
    launchUrlPrefix: nativeLegacyUrl,
  }));

  const app = new App({
    root,
    kidId: session.kidId,
    age: session.age,
    interactionProfile: session.interactionProfile,
    navigation: new NavigationService({ name: "planet" }),
    platform,
    quests: new LegacyQuestGateway(),
    activities,
  });
  app.mount();
  installTabletRuntimeSignals(root, { native: platform.kind === "android" });
  registerServiceWorker(root, platform.kind);
}

function registerServiceWorker(root: HTMLElement, platformKind: "web" | "android" | "legacy"): void {
  if (platformKind === "android") {
    root.dataset.offlineReady = "true";
    root.dataset.serviceWorker = "native";
    return;
  }
  if (!("serviceWorker" in navigator) || location.protocol === "file:" || !window.isSecureContext) {
    root.dataset.offlineReady = "false";
    return;
  }
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("../../sw.js")
      .then(async (registration) => {
        root.dataset.offlineReady = "true";
        await registration.update();
      })
      .catch(() => { root.dataset.offlineReady = "false"; });
  }, { once: true });
}

bootstrap().catch((error) => {
  console.error("Summer Quest mobile bootstrap failed", error);
  const root = document.querySelector<HTMLElement>("#app");
  if (root) root.innerHTML = '<p class="boot-error">Summer Quest could not start.<span>Summer Quest 無法啟動。</span></p>';
});
