export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Provider returned empty text");
  try { return JSON.parse(trimmed); } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("Provider did not return JSON");
}
