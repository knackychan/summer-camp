export type AppRoute =
  | { name: "planet" }
  | { name: "zone"; zoneId: string }
  | { name: "quests"; category?: string }
  | { name: "quest-detail"; questId: string }
  | { name: "adventure" }
  | { name: "activity"; activityId: string };

export type NavigationListener = (route: AppRoute) => void;

function routeKey(route: AppRoute): string {
  if (route.name === "zone") return `zone:${route.zoneId}`;
  if (route.name === "quests") return `quests:${route.category || "all"}`;
  if (route.name === "quest-detail") return `quest:${route.questId}`;
  if (route.name === "activity") return `activity:${route.activityId}`;
  return route.name;
}

export class NavigationService {
  private stack: AppRoute[];
  private listeners = new Set<NavigationListener>();

  constructor(initial: AppRoute = { name: "planet" }) {
    this.stack = [initial];
  }

  get current(): AppRoute {
    return this.stack[this.stack.length - 1]!;
  }

  get canGoBack(): boolean {
    return this.stack.length > 1;
  }

  push(route: AppRoute): void {
    if (routeKey(this.current) === routeKey(route)) return;
    this.stack.push(route);
    this.emit();
  }

  replace(route: AppRoute): void {
    this.stack[this.stack.length - 1] = route;
    this.emit();
  }

  reset(route: AppRoute): void {
    this.stack = [route];
    this.emit();
  }

  back(): boolean {
    if (this.stack.length <= 1) return false;
    this.stack.pop();
    this.emit();
    return true;
  }

  subscribe(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.current);
  }
}
