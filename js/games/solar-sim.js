/* Solar System simulation math (tech-spec.md §11).
   Pure: no DOM, no Three.js, no globals. All timing is derived from
   accumulated sim-days — never frame-integrated. */

export var SPEEDS = [
  { id: "pause", en: "Pause", tz: "\u66ab\u505c", daysPerSec: 0 },
  { id: "day", en: "1 day", tz: "1 \u5929", daysPerSec: 1 },
  { id: "10day", en: "10 days", tz: "10 \u5929", daysPerSec: 10 },
  { id: "month", en: "1 month", tz: "1 \u500b\u6708", daysPerSec: 30 },
  { id: "year", en: "1 year", tz: "1 \u5e74", daysPerSec: 365 },
];

export function daysPerSec(id) {
  for (var i = 0; i < SPEEDS.length; i++) {
    if (SPEEDS[i].id === id) return SPEEDS[i].daysPerSec;
  }
  return 10; // "10day" fallback
}

export function advance(total, dtMs, perSec) {
  return total + dtMs / 1000 * perSec;
}

/* Returns { count: floor(total/years), angle: (fractional part) * 2π }.
   Example: orbitCount(365, 365) → { count: 1, angle: 0 }
            orbitCount(365, 88)  → { count: 4, angle: ~0.15*2π } */
export function orbitCount(total, yearDays) {
  var orbits = total / yearDays;
  var count = Math.floor(orbits);
  var frac = orbits - count;
  return { count: count, angle: frac * Math.PI * 2 };
}
