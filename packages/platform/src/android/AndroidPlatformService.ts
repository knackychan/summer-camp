import type { BackHandler, HapticKind, NotificationRequest, PlatformService } from "../PlatformService.js";

export interface SummerQuestNativeBridge {
  native: true;
  haptic?(kind: HapticKind): Promise<boolean> | boolean;
  speak?(text: string, lang?: string): Promise<boolean> | boolean;
  scheduleNotification?(request: NotificationRequest): Promise<{ supported: boolean }> | { supported: boolean };
  requestAudioFocus?(): Promise<boolean> | boolean;
  releaseAudioFocus?(): Promise<void> | void;
  setBackHandler?(handler: BackHandler): void;
}

export class AndroidPlatformService implements PlatformService {
  readonly kind = "android" as const;
  private handlers: BackHandler[] = [];

  constructor(private readonly bridge: SummerQuestNativeBridge) {
    this.bridge.setBackHandler?.(() => this.triggerBack());
  }

  async haptic(kind: HapticKind): Promise<boolean> {
    return this.bridge.haptic ? Boolean(await this.bridge.haptic(kind)) : false;
  }

  async speak(text: string, lang?: string): Promise<boolean> {
    return this.bridge.speak ? Boolean(await this.bridge.speak(text, lang)) : false;
  }

  async scheduleNotification(request: NotificationRequest): Promise<{ supported: boolean }> {
    return this.bridge.scheduleNotification ? this.bridge.scheduleNotification(request) : { supported: false };
  }

  async requestAudioFocus(): Promise<boolean> {
    return this.bridge.requestAudioFocus ? Boolean(await this.bridge.requestAudioFocus()) : false;
  }

  async releaseAudioFocus(): Promise<void> {
    await this.bridge.releaseAudioFocus?.();
  }

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
