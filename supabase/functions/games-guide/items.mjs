// Copy of the home-help list the guide may choose from (js/home-help-data.js).
// scripts/check.mjs fails if ids, labels or minutes drift from SQHomeHelp.ITEMS.
export const ITEMS = [
  { id: "homework", label: ["Homework practice", "作業練習"], minutes: 30 },
  { id: "room", label: ["Clean my room", "整理房間"], minutes: 10 },
  { id: "clothes", label: ["Tidy my clothes", "整理衣服"], minutes: 10 },
  { id: "table", label: ["Help clean the table", "幫忙清理餐桌"], minutes: 5 },
  { id: "shoes", label: ["Tidy the shoes", "整理鞋子"], minutes: 5 },
  { id: "garden", label: ["Tidy the garden", "整理花園"], minutes: 15 },
  { id: "living", label: ["Tidy the living room", "整理客廳"], minutes: 10 },
  { id: "office", label: ["Tidy the office", "整理辦公室"], minutes: 10 },
];
// Same slot boundaries as SQHomeHelp.SLOTS (Taipei time).
export const SLOTS = [["morning", 0], ["afternoon", 12 * 60], ["evening", 17 * 60]];
