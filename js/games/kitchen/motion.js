// Kitchen Quest v0.6.0 core, imported from the user-supplied source.
// TypeScript transpiled to ES2019 modules; gameplay rules preserved.
export function seeded(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
/** Stable, bounded cosmetic springs (src/core/motion.ts). They never affect recipe state. */
export class Spring {
    constructor(frequency = 19, damping = 0.55, limit = 1) {
        this.frequency = frequency; this.damping = damping; this.limit = limit;
        this.value = 0; this.velocity = 0;
    }
    kick(impulse) { this.velocity = clamp(this.velocity + impulse, -this.limit * 40, this.limit * 40); }
    update(dt) {
        let left = Math.min(0.05, Math.max(0, dt));
        while (left > 0) {
            const h = Math.min(left, 1 / 120);
            this.velocity += (-this.frequency * this.frequency * this.value - 2 * this.damping * this.frequency * this.velocity) * h;
            this.value = clamp(this.value + this.velocity * h, -this.limit, this.limit);
            left -= h;
        }
        if (Math.abs(this.value) + Math.abs(this.velocity) < 0.0001) this.reset();
        return this.value;
    }
    reset() { this.value = 0; this.velocity = 0; }
}
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeIn = (t) => Math.pow(clamp(t, 0, 1), 3);
