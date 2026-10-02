export type HapticKind = "tap" | "success" | "warning";
export type BackHandler = () => boolean;

export interface NotificationRequest {
  id: string;
  title: string;
  body: string;
  at?: string;
}

export interface PlatformService {
  readonly kind: "web" | "android" | "legacy";
  haptic(kind: HapticKind): Promise<boolean>;
  speak(text: string, lang?: string): Promise<boolean>;
  scheduleNotification(request: NotificationRequest): Promise<{ supported: boolean }>;
  requestAudioFocus(): Promise<boolean>;
  releaseAudioFocus(): Promise<void>;
  registerBackHandler(handler: BackHandler): () => void;
}
