import type { BackHandler, HapticKind, NotificationRequest, PlatformService } from "../PlatformService.js";
import { WebPlatformService } from "../web/WebPlatformService.js";

interface LegacyPlatform {
  haptic?: (kind: string) => unknown;
  speak?: (text: string, lang?: string) => unknown;
  scheduleNotification?: (request: NotificationRequest) => Promise<unknown> | unknown;
  requestAudioFocus?: () => Promise<unknown> | unknown;
  releaseAudioFocus?: () => Promise<unknown> | unknown;
  registerBackHandler?: (handler: BackHandler) => (() => void) | void;
}

interface LegacyGlobal {
  SQPlatform?: LegacyPlatform;
}

export class LegacyPlatformService implements PlatformService {
  readonly kind = "legacy" as const;
  private readonly fallback = new WebPlatformService();

  private get legacy(): LegacyPlatform | undefined {
    return (globalThis as unknown as LegacyGlobal).SQPlatform;
  }

  async haptic(kind: HapticKind): Promise<boolean> {
    if (this.legacy?.haptic) return Boolean(await this.legacy.haptic(kind));
    return this.fallback.haptic(kind);
  }

  async speak(text: string, lang?: string): Promise<boolean> {
    if (this.legacy?.speak) return Boolean(await this.legacy.speak(text, lang));
    return this.fallback.speak(text, lang);
  }

  async scheduleNotification(request: NotificationRequest): Promise<{ supported: boolean }> {
    if (!this.legacy?.scheduleNotification) return this.fallback.scheduleNotification(request);
    const result = await this.legacy.scheduleNotification(request);
    if (result && typeof result === "object" && "supported" in result) {
      return result as { supported: boolean };
    }
    return { supported: true };
  }

  async requestAudioFocus(): Promise<boolean> {
    if (!this.legacy?.requestAudioFocus) return this.fallback.requestAudioFocus();
    return Boolean(await this.legacy.requestAudioFocus());
  }

  async releaseAudioFocus(): Promise<void> {
    if (!this.legacy?.releaseAudioFocus) return this.fallback.releaseAudioFocus();
    await this.legacy.releaseAudioFocus();
  }

  registerBackHandler(handler: BackHandler): () => void {
    const unsubscribe = this.legacy?.registerBackHandler?.(handler);
    if (typeof unsubscribe === "function") return unsubscribe;
    return this.fallback.registerBackHandler(handler);
  }
}
