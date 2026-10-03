import { viewportSnapshot } from "../../../../packages/core/src/tablet-runtime.js";

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export interface TabletRuntimeOptions {
  native?: boolean;
}

export function installTabletRuntimeSignals(root: HTMLElement, options: TabletRuntimeOptions = {}): () => void {
  let frame = 0;
  const native = options.native === true;
  const mediaCoarse = window.matchMedia("(pointer: coarse)");
  const mediaStandalone = window.matchMedia("(display-mode: standalone)");
  const visualViewport = window.visualViewport;

  const apply = (): void => {
    frame = 0;
    const width = visualViewport?.width || window.innerWidth || document.documentElement.clientWidth;
    const height = visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
    const snapshot = viewportSnapshot(width, height, mediaCoarse.matches);
    const navigatorWithStandalone = navigator as NavigatorWithStandalone;

    root.dataset.viewport = snapshot.viewportClass;
    root.dataset.orientation = snapshot.orientation;
    root.dataset.pointer = snapshot.coarsePointer ? "coarse" : "fine";
    root.dataset.online = navigator.onLine === false ? "false" : "true";
    root.dataset.displayMode = native ? "native" : mediaStandalone.matches || navigatorWithStandalone.standalone === true ? "standalone" : "browser";
    root.dataset.secureContext = window.isSecureContext ? "true" : "false";
    root.dataset.serviceWorker = native ? "native" : "serviceWorker" in navigator && window.isSecureContext ? "available" : "unavailable";
    document.documentElement.style.setProperty("--sq-viewport-height", `${snapshot.height}px`);
    document.documentElement.style.setProperty("--sq-viewport-width", `${snapshot.width}px`);
  };

  const schedule = (): void => {
    if (frame) return;
    frame = window.requestAnimationFrame(apply);
  };

  apply();
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });
  window.addEventListener("online", schedule, { passive: true });
  window.addEventListener("offline", schedule, { passive: true });
  mediaCoarse.addEventListener?.("change", schedule);
  mediaStandalone.addEventListener?.("change", schedule);
  visualViewport?.addEventListener("resize", schedule, { passive: true });

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    window.removeEventListener("online", schedule);
    window.removeEventListener("offline", schedule);
    mediaCoarse.removeEventListener?.("change", schedule);
    mediaStandalone.removeEventListener?.("change", schedule);
    visualViewport?.removeEventListener("resize", schedule);
  };
}
