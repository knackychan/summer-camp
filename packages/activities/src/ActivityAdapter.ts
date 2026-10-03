import type { LocalizedText } from "../../core/src/localization.js";

export interface ActivityLaunchContext {
  kidId: string;
  returnTo?: string;
}

export interface EmbeddedActivityTarget {
  kind: "embedded";
  url: string;
}

export interface ExternalActivityTarget {
  kind: "external";
  url: string;
}

export type ActivityLaunchTarget = EmbeddedActivityTarget | ExternalActivityTarget;

export interface ActivityLaunchResult {
  ok: boolean;
  reason?: string;
  target?: ActivityLaunchTarget;
}

export interface ActivityAdapter {
  id: string;
  title: LocalizedText;
  icon: string;
  ageBands: string[];
  capabilities: string[];
  launch(context: ActivityLaunchContext): Promise<ActivityLaunchResult>;
}
