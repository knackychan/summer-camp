export interface LocalClock {
  day: string;
  minutes: number;
}

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function taipeiClock(now: Date = new Date()): LocalClock {
  const values: Record<string, string> = {};
  for (const part of PARTS.formatToParts(now)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }
  const hour = Number(values.hour || 0);
  const minute = Number(values.minute || 0);
  return {
    day: `${values.year}-${values.month}-${values.day}`,
    minutes: hour * 60 + minute,
  };
}
