import type { ActivityRegistry } from "../../../../packages/activities/src/ActivityRegistry.js";
import type { InteractionProfile } from "../../../../packages/core/src/interaction-profile.js";

export interface ActivityHostScreenOptions {
  activityId: string;
  kidId: string;
  registry: ActivityRegistry;
  profile: InteractionProfile;
}

export async function renderActivityHostScreen(root: HTMLElement, options: ActivityHostScreenOptions): Promise<void> {
  const activity = options.registry.get(options.activityId);
  if (!activity) {
    root.innerHTML = `<div class="empty-state">This activity is not available.<span>這個活動現在不能開啟。</span></div>`;
    return;
  }
  root.innerHTML = `<section class="activity-host-screen"><div class="activity-loading">${activity.icon}<span>Opening ${escapeHtml(activity.title[0])}…</span><small>正在開啟 ${escapeHtml(activity.title[1])}…</small></div></section>`;
  const result = await options.registry.launch(options.activityId, options.kidId);
  if (!result.ok || !result.target) {
    root.innerHTML = `<div class="empty-state">This activity could not start.<span>這個活動無法啟動。</span></div>`;
    return;
  }
  if (result.target.kind === "external") {
    window.location.assign(result.target.url);
    return;
  }
  root.innerHTML = `
    <section class="activity-host-screen" aria-label="${escapeHtml(activity.title[0])} / ${escapeHtml(activity.title[1])}">
      <iframe class="activity-frame" src="${escapeAttribute(result.target.url)}" title="${escapeAttribute(activity.title[0])}" allow="autoplay; fullscreen" loading="eager"></iframe>
    </section>`;
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

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
