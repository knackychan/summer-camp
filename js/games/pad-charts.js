/* Pad exercise charts (slice 40). Plain data, no logic, node-testable, bilingual.
   6 exercises across 3 tiers, accumulating layers (D9): each backing is the
   previous exercise's pattern. */

var CHARTS = [
  {
    id: "steady-kick",
    tier: 1,
    bpm: 70,
    bars: 4,
    backing: null,
    name: { en: "Steady Kick", tz: "\u7A69\u5B9A\u5927\u9F13" },
    lanes: ["kick", "snare", "hat-closed", "clap"],
    notes: [
      { beat: 0, lane: 0 }, { beat: 2, lane: 0 },
      { beat: 4, lane: 0 }, { beat: 6, lane: 0 },
      { beat: 8, lane: 0 }, { beat: 10, lane: 0 },
      { beat: 12, lane: 0 }, { beat: 14, lane: 0 }
    ]
  },
  {
    id: "kick-snare",
    tier: 1,
    bpm: 70,
    bars: 4,
    backing: "steady-kick",
    name: { en: "Kick + Snare", tz: "\u5927\u9F13\u52A0\u5C0F\u9F13" },
    lanes: ["kick", "snare", "hat-closed", "clap"],
    notes: [
      { beat: 1, lane: 1 }, { beat: 3, lane: 1 },
      { beat: 5, lane: 1 }, { beat: 7, lane: 1 },
      { beat: 9, lane: 1 }, { beat: 11, lane: 1 },
      { beat: 13, lane: 1 }, { beat: 15, lane: 1 }
    ]
  },
  {
    id: "eighth-hats",
    tier: 2,
    bpm: 80,
    bars: 4,
    backing: "kick-snare",
    name: { en: "Eighth Hats", tz: "\u516B\u5206\u97F3\u7B26\u8E34\u9434" },
    lanes: ["kick", "snare", "hat-closed", "clap"],
    notes: [
      { beat: 0, lane: 2 }, { beat: 0.5, lane: 2 },
      { beat: 1, lane: 2 }, { beat: 1.5, lane: 2 },
      { beat: 2, lane: 2 }, { beat: 2.5, lane: 2 },
      { beat: 3, lane: 2 }, { beat: 3.5, lane: 2 },
      { beat: 4, lane: 2 }, { beat: 4.5, lane: 2 },
      { beat: 5, lane: 2 }, { beat: 5.5, lane: 2 },
      { beat: 6, lane: 2 }, { beat: 6.5, lane: 2 },
      { beat: 7, lane: 2 }, { beat: 7.5, lane: 2 },
      { beat: 8, lane: 2 }, { beat: 8.5, lane: 2 },
      { beat: 9, lane: 2 }, { beat: 9.5, lane: 2 },
      { beat: 10, lane: 2 }, { beat: 10.5, lane: 2 },
      { beat: 11, lane: 2 }, { beat: 11.5, lane: 2 },
      { beat: 12, lane: 2 }, { beat: 12.5, lane: 2 },
      { beat: 13, lane: 2 }, { beat: 13.5, lane: 2 },
      { beat: 14, lane: 2 }, { beat: 14.5, lane: 2 },
      { beat: 15, lane: 2 }, { beat: 15.5, lane: 2 }
    ]
  },
  {
    id: "offbeat-clap",
    tier: 2,
    bpm: 85,
    bars: 4,
    backing: "eighth-hats",
    name: { en: "Off-Beat Clap", tz: "\u53CD\u62CD\u62CD\u624B" },
    lanes: ["kick", "snare", "hat-closed", "clap"],
    notes: [
      { beat: 0.5, lane: 3 }, { beat: 2.5, lane: 3 },
      { beat: 4.5, lane: 3 }, { beat: 6.5, lane: 3 },
      { beat: 8.5, lane: 3 }, { beat: 10.5, lane: 3 },
      { beat: 12.5, lane: 3 }, { beat: 14.5, lane: 3 }
    ]
  },
  {
    id: "hat-run",
    tier: 3,
    bpm: 90,
    bars: 4,
    backing: "offbeat-clap",
    name: { en: "Hat Run", tz: "\u8E34\u9434\u5954\u8DD1" },
    lanes: ["kick", "snare", "hat-closed", "clap"],
    notes: [
      { beat: 2, lane: 2 }, { beat: 2.25, lane: 2 },
      { beat: 2.5, lane: 2 }, { beat: 2.75, lane: 2 },
      { beat: 6, lane: 2 }, { beat: 6.25, lane: 2 },
      { beat: 6.5, lane: 2 }, { beat: 6.75, lane: 2 },
      { beat: 10, lane: 2 }, { beat: 10.25, lane: 2 },
      { beat: 10.5, lane: 2 }, { beat: 10.75, lane: 2 },
      { beat: 14, lane: 2 }, { beat: 14.25, lane: 2 },
      { beat: 14.5, lane: 2 }, { beat: 14.75, lane: 2 }
    ]
  },
  {
    id: "two-hand",
    tier: 3,
    bpm: 95,
    bars: 4,
    backing: "hat-run",
    name: { en: "Two-Hand Groove", tz: "\u96D9\u624B\u7BC0\u594F" },
    lanes: ["kick", "snare", "hat-closed", "clap"],
    notes: [
      { beat: 0, lane: 1 }, { beat: 1, lane: 3 },
      { beat: 4, lane: 1 }, { beat: 5, lane: 3 },
      { beat: 8, lane: 1 }, { beat: 9, lane: 3 },
      { beat: 12, lane: 1 }, { beat: 13, lane: 3 }
    ]
  }
];

export { CHARTS };
export default CHARTS;
