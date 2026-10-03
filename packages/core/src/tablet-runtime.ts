export type ViewportClass = "phone" | "tablet" | "desktop";
export type ViewportOrientation = "portrait" | "landscape";

export interface ViewportSnapshot {
  width: number;
  height: number;
  orientation: ViewportOrientation;
  viewportClass: ViewportClass;
  coarsePointer: boolean;
}

export function viewportOrientation(width: number, height: number): ViewportOrientation {
  return width > height ? "landscape" : "portrait";
}

export function viewportClass(width: number, height: number, coarsePointer: boolean): ViewportClass {
  const shortest = Math.min(Math.max(0, width), Math.max(0, height));
  const longest = Math.max(Math.max(0, width), Math.max(0, height));
  if (shortest < 600) return "phone";
  if (coarsePointer && shortest >= 600 && longest >= 800) return "tablet";
  return "desktop";
}

export function viewportSnapshot(width: number, height: number, coarsePointer: boolean): ViewportSnapshot {
  return {
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
    orientation: viewportOrientation(width, height),
    viewportClass: viewportClass(width, height, coarsePointer),
    coarsePointer,
  };
}
