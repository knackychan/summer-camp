import type { BackHandler, HapticKind, NotificationRequest, PlatformService } from "../PlatformService.js";

export class WebPlatformService implements PlatformService {
  readonly kind = "web" as const;
  private handlers: BackHandler[] = [];

  constructor() {
    window.addEventListener("popstate", () => this.triggerBack());
  }

  async haptic(kind: HapticKind): Promise<boolean> {
    if (!navigator.vibrate) return false;
    const pattern = kind === "success" ? [18, 30, 24] : kind === "warning" ? [28, 35, 28] : [12];
    return navigator.vibrate(pattern);
  }

  async speak(text: string, lang = "en-US"): Promise<boolean> {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  }

  async scheduleNotification(_request: NotificationRequest): Promise<{ supported: boolean }> {
    return { supported: false };
  }

  async requestAudioFocus(): Promise<boolean> {
    return false;
  }

  async releaseAudioFocus(): Promise<void> {}

  registerBackHandler(handler: BackHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((candidate) => candidate !== handler);
    };
  }

  private triggerBack(): boolean {
    for (let i = this.handlers.length - 1; i >= 0; i -= 1) {
      const handler = this.handlers[i];
      if (handler && handler()) return true;
    }
    return false;
  }
}
