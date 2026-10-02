import type { PlatformService } from "./PlatformService.js";
import { AndroidPlatformService, type SummerQuestNativeBridge } from "./android/AndroidPlatformService.js";
import { LegacyPlatformService } from "./legacy/LegacyPlatformService.js";
import { WebPlatformService } from "./web/WebPlatformService.js";

interface PlatformGlobals {
  SummerQuestNative?: SummerQuestNativeBridge;
  SQPlatform?: unknown;
}

export function createPlatformService(): PlatformService {
  const globals = globalThis as unknown as PlatformGlobals;
  if (globals.SummerQuestNative?.native) return new AndroidPlatformService(globals.SummerQuestNative);
  if (globals.SQPlatform) return new LegacyPlatformService();
  return new WebPlatformService();
}
