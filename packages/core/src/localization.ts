export type LocalizedText = readonly [en: string, zhTw: string];

export function text(en: string, zhTw: string): LocalizedText {
  return [en, zhTw] as const;
}

export function ariaLabel(value: LocalizedText): string {
  return `${value[0]} / ${value[1]}`;
}
