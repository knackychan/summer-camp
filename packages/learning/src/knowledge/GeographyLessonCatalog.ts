import type {
  KnowledgeLessonDefinition,
  KnowledgeLessonFact,
  KnowledgeLessonQuestion,
  KnowledgeLessonVisual,
  KnowledgeLessonVisualItem,
} from "./KnowledgeLessonCatalog.js";

export type GeographyLessonTopic = "directions" | "symbols" | "land_water" | "world" | "hemispheres" | "environments";
export type GeographyVisualKind = "compass" | "map" | "land_water" | "globe" | "environment";
export type GeographyVisualItem = KnowledgeLessonVisualItem;
export type GeographyLessonFact = KnowledgeLessonFact;
export type GeographyLessonQuestion = KnowledgeLessonQuestion;
export interface GeographyLessonVisual extends Omit<KnowledgeLessonVisual, "kind"> { kind: GeographyVisualKind; }
export interface GeographyLessonDefinition extends Omit<KnowledgeLessonDefinition, "domain" | "topic" | "visual"> {
  domain: "geography";
  topic: GeographyLessonTopic;
  visual: GeographyLessonVisual;
}

type GeographyLessonSeed = Omit<GeographyLessonDefinition, "domain">;

const LESSONS: readonly GeographyLessonSeed[] = [
  {
    id: "geography-cardinal-directions",
    topic: "directions",
    skill: "geography.map.cardinal_directions",
    minAge: 3,
    difficulty: 1,
    icon: "🧭",
    title: "Compass directions",
    titleZh: "指南針方向",
    subtitle: "North, east, south and west",
    subtitleZh: "北、東、南、西",
    preReaderIntro: "A compass helps us talk about direction.",
    preReaderIntroZh: "指南針可以幫我們說方向。",
    intro: "Maps often use four main compass directions: north, east, south and west. On many maps, north is shown at the top.",
    introZh: "地圖常用四個主要方向：北、東、南、西。很多地圖會把北方畫在上面。",
    visual: {
      kind: "compass",
      items: [
        { id: "north", icon: "⬆️", label: "North", labelZh: "北", note: "North is commonly shown at the top of a map.", noteZh: "地圖通常把北方畫在上面。" },
        { id: "east", icon: "➡️", label: "East", labelZh: "東", note: "If north is up, east is to the right.", noteZh: "如果北方在上面，東方就在右邊。" },
        { id: "south", icon: "⬇️", label: "South", labelZh: "南", note: "South is opposite north.", noteZh: "南方和北方相反。" },
        { id: "west", icon: "⬅️", label: "West", labelZh: "西", note: "West is opposite east.", noteZh: "西方和東方相反。" },
      ],
    },
    facts: [
      { id: "north-top", icon: "⬆️", text: "On many maps, north is shown at the top.", textZh: "很多地圖會把北方畫在上面。" },
      { id: "east-west", icon: "↔️", text: "East and west are opposite directions.", textZh: "東方和西方是相反方向。" },
      { id: "north-south", icon: "↕️", text: "North and south are opposite directions.", textZh: "北方和南方是相反方向。" },
    ],
    questions: [
      {
        id: "directions-q1",
        prompt: "If north is at the top, which direction is on the right?",
        promptZh: "如果北方在上面，右邊是哪個方向？",
        options: [
          { id: "east", icon: "➡️", label: "East", labelZh: "東" },
          { id: "west", icon: "⬅️", label: "West", labelZh: "西" },
          { id: "south", icon: "⬇️", label: "South", labelZh: "南" },
        ],
        correctOptionId: "east",
        explain: "With north at the top, east is to the right.",
        explainZh: "北方在上面時，東方就在右邊。",
      },
      {
        id: "directions-q2",
        prompt: "Which direction is opposite north?",
        promptZh: "哪個方向和北方相反？",
        options: [
          { id: "south", icon: "⬇️", label: "South", labelZh: "南" },
          { id: "east", icon: "➡️", label: "East", labelZh: "東" },
          { id: "west", icon: "⬅️", label: "West", labelZh: "西" },
        ],
        correctOptionId: "south",
        explain: "South is opposite north.",
        explainZh: "南方和北方相反。",
      },
    ],
  },
  {
    id: "geography-map-symbols",
    topic: "symbols",
    skill: "geography.map.symbols",
    minAge: 3,
    difficulty: 1,
    icon: "🗺️",
    title: "Read a map key",
    titleZh: "看懂地圖圖例",
    subtitle: "Symbols stand for real places",
    subtitleZh: "用符號代表真實地點",
    preReaderIntro: "A map uses little pictures to show places.",
    preReaderIntroZh: "地圖會用小圖案表示不同地方。",
    intro: "A map key, also called a legend, explains what symbols on a map mean. The same symbol should keep the same meaning within that map.",
    introZh: "地圖圖例會說明地圖上的符號代表什麼。同一張地圖裡，相同符號應該有相同意思。",
    visual: {
      kind: "map",
      items: [
        { id: "school", icon: "🏫", label: "School", labelZh: "學校", note: "A school symbol can mark where the school is on the map.", noteZh: "學校符號可以標出學校在地圖上的位置。" },
        { id: "park", icon: "🌳", label: "Park", labelZh: "公園", note: "A tree symbol can be used to mark a park or green space.", noteZh: "樹的符號可以用來表示公園或綠地。" },
        { id: "hospital", icon: "🏥", label: "Hospital", labelZh: "醫院", note: "A hospital symbol can mark a medical facility.", noteZh: "醫院符號可以標出醫療設施。" },
      ],
    },
    facts: [
      { id: "legend-explains", icon: "🔑", text: "A map key or legend explains map symbols.", textZh: "地圖圖例會解釋地圖符號。" },
      { id: "symbols-represent", icon: "📍", text: "Map symbols can represent real places or features.", textZh: "地圖符號可以代表真實地點或地形。" },
      { id: "same-symbol", icon: "🗺️", text: "Within one map, a symbol should keep a consistent meaning.", textZh: "在同一張地圖中，同一個符號應該保持相同意思。" },
    ],
    questions: [
      {
        id: "symbols-q1",
        prompt: "What tells you what map symbols mean?",
        promptZh: "什麼會告訴你地圖符號代表什麼？",
        options: [
          { id: "legend", icon: "🔑", label: "Map key / legend", labelZh: "地圖圖例" },
          { id: "clock", icon: "🕒", label: "Clock", labelZh: "時鐘" },
          { id: "weather", icon: "🌦️", label: "Weather", labelZh: "天氣" },
        ],
        correctOptionId: "legend",
        explain: "The map key or legend explains the symbols.",
        explainZh: "地圖圖例會解釋各種符號。",
      },
      {
        id: "symbols-q2",
        prompt: "If the key says 🌳 means park, what does 🌳 mark on that map?",
        promptZh: "如果圖例說 🌳 代表公園，那地圖上的 🌳 表示什麼？",
        options: [
          { id: "park", icon: "🌳", label: "Park", labelZh: "公園" },
          { id: "school", icon: "🏫", label: "School", labelZh: "學校" },
          { id: "hospital", icon: "🏥", label: "Hospital", labelZh: "醫院" },
        ],
        correctOptionId: "park",
        explain: "The legend defines what the symbol means on that map.",
        explainZh: "圖例會定義這個符號在地圖上代表什麼。",
      },
    ],
  },
  {
    id: "geography-land-water-features",
    topic: "land_water",
    skill: "geography.land_water.features",
    minAge: 3,
    difficulty: 1,
    icon: "🏝️",
    title: "Land and water",
    titleZh: "陸地與水域",
    subtitle: "Island, river and mountain",
    subtitleZh: "島嶼、河流和山",
    preReaderIntro: "Earth has land and water in many shapes.",
    preReaderIntroZh: "地球上的陸地和水有很多不同形狀。",
    intro: "Geographers describe features of Earth's surface. An island is land surrounded by water, a river is flowing water in a channel, and a mountain rises high above nearby land.",
    introZh: "地理學會描述地球表面的特徵。島嶼是被水包圍的陸地，河流是在河道中流動的水，山則高於周圍的地面。",
    visual: {
      kind: "land_water",
      items: [
        { id: "island", icon: "🏝️", label: "Island", labelZh: "島嶼", note: "An island is land surrounded by water.", noteZh: "島嶼是被水包圍的陸地。" },
        { id: "river", icon: "🏞️", label: "River", labelZh: "河流", note: "A river is flowing water moving through a channel toward another body of water.", noteZh: "河流是在河道中流動，並流向其他水域的水。" },
        { id: "mountain", icon: "⛰️", label: "Mountain", labelZh: "山", note: "A mountain rises high above the land around it.", noteZh: "山會高高隆起，超過周圍的地面。" },
      ],
    },
    facts: [
      { id: "island-water", icon: "🏝️", text: "An island is land surrounded by water.", textZh: "島嶼是被水包圍的陸地。" },
      { id: "river-flows", icon: "🏞️", text: "A river is flowing water in a channel.", textZh: "河流是在河道中流動的水。" },
      { id: "mountain-high", icon: "⛰️", text: "A mountain rises high above nearby land.", textZh: "山會高於周圍的地面。" },
    ],
    questions: [
      {
        id: "land-water-q1",
        prompt: "Which feature is land surrounded by water?",
        promptZh: "哪一種地形是被水包圍的陸地？",
        options: [
          { id: "island", icon: "🏝️", label: "Island", labelZh: "島嶼" },
          { id: "river", icon: "🏞️", label: "River", labelZh: "河流" },
          { id: "mountain", icon: "⛰️", label: "Mountain", labelZh: "山" },
        ],
        correctOptionId: "island",
        explain: "An island has water all around it.",
        explainZh: "島嶼四周都有水。",
      },
      {
        id: "land-water-q2",
        prompt: "Which feature is flowing water in a channel?",
        promptZh: "哪一種地理特徵是在河道中流動的水？",
        options: [
          { id: "river", icon: "🏞️", label: "River", labelZh: "河流" },
          { id: "island", icon: "🏝️", label: "Island", labelZh: "島嶼" },
          { id: "mountain", icon: "⛰️", label: "Mountain", labelZh: "山" },
        ],
        correctOptionId: "river",
        explain: "A river is flowing water moving through a channel.",
        explainZh: "河流是在河道中流動的水。",
      },
    ],
  },
  {
    id: "geography-continents-oceans",
    topic: "world",
    skill: "geography.world.continents_oceans",
    minAge: 5,
    difficulty: 1,
    icon: "🌍",
    title: "Continents and oceans",
    titleZh: "大洲與海洋",
    subtitle: "Large land areas and large bodies of water",
    subtitleZh: "大片陸地與大片水域",
    preReaderIntro: "A globe shows big land areas and big oceans.",
    preReaderIntroZh: "地球儀可以看到大片陸地和大海洋。",
    intro: "A continent is one of Earth’s major large land regions, while an ocean is a vast body of salt water. World maps show both land and water together.",
    introZh: "大洲是地球上主要的大型陸地區域；海洋則是廣大的鹹水水域。世界地圖會把陸地和水域一起畫出來。",
    visual: {
      kind: "globe",
      items: [
        { id: "continent", icon: "🟩", label: "Continent", labelZh: "大洲", note: "Continents are major large land regions on Earth.", noteZh: "大洲是地球上主要的大型陸地區域。" },
        { id: "ocean", icon: "🌊", label: "Ocean", labelZh: "海洋", note: "Oceans are vast bodies of salt water.", noteZh: "海洋是廣大的鹹水水域。" },
        { id: "world-map", icon: "🗺️", label: "World map", labelZh: "世界地圖", note: "A world map shows the arrangement of major land and water areas.", noteZh: "世界地圖會顯示主要陸地和水域的分布。" },
      ],
    },
    facts: [
      { id: "continent-land", icon: "🟩", text: "A continent is a major large land region on Earth.", textZh: "大洲是地球上主要的大型陸地區域。" },
      { id: "ocean-water", icon: "🌊", text: "An ocean is a vast body of salt water.", textZh: "海洋是廣大的鹹水水域。" },
      { id: "map-both", icon: "🗺️", text: "World maps show major land and water areas together.", textZh: "世界地圖會一起顯示主要陸地和水域。" },
    ],
    questions: [
      {
        id: "world-q1",
        prompt: "Which word means a major large land region?",
        promptZh: "哪個詞代表主要的大型陸地區域？",
        options: [
          { id: "continent", icon: "🟩", label: "Continent", labelZh: "大洲" },
          { id: "ocean", icon: "🌊", label: "Ocean", labelZh: "海洋" },
          { id: "river", icon: "🏞️", label: "River", labelZh: "河流" },
        ],
        correctOptionId: "continent",
        explain: "A continent is a major large land region on Earth.",
        explainZh: "大洲是地球上主要的大型陸地區域。",
      },
      {
        id: "world-q2",
        prompt: "Which word means a vast body of salt water?",
        promptZh: "哪個詞代表廣大的鹹水水域？",
        options: [
          { id: "ocean", icon: "🌊", label: "Ocean", labelZh: "海洋" },
          { id: "continent", icon: "🟩", label: "Continent", labelZh: "大洲" },
          { id: "mountain", icon: "⛰️", label: "Mountain", labelZh: "山" },
        ],
        correctOptionId: "ocean",
        explain: "An ocean is a vast body of salt water.",
        explainZh: "海洋是廣大的鹹水水域。",
      },
    ],
  },
  {
    id: "geography-equator-hemispheres",
    topic: "hemispheres",
    skill: "geography.world.equator_hemispheres",
    minAge: 6,
    difficulty: 2,
    icon: "🌐",
    title: "Equator and hemispheres",
    titleZh: "赤道與半球",
    subtitle: "An imaginary line around Earth",
    subtitleZh: "繞著地球的想像線",
    preReaderIntro: "Imagine a line around the middle of Earth.",
    preReaderIntroZh: "想像一條線繞著地球中間。",
    intro: "The equator is an imaginary line around Earth halfway between the North and South Poles. It divides Earth into the Northern and Southern Hemispheres.",
    introZh: "赤道是一條繞著地球的想像線，位在北極和南極的中間。它把地球分成北半球和南半球。",
    visual: {
      kind: "globe",
      items: [
        { id: "north", icon: "🔵", label: "Northern Hemisphere", labelZh: "北半球", note: "The Northern Hemisphere is the half of Earth north of the equator.", noteZh: "北半球是赤道以北的半個地球。" },
        { id: "equator", icon: "➖", label: "Equator", labelZh: "赤道", note: "The equator is an imaginary line midway between the poles.", noteZh: "赤道是位在兩極中間的一條想像線。" },
        { id: "south", icon: "🟢", label: "Southern Hemisphere", labelZh: "南半球", note: "The Southern Hemisphere is the half of Earth south of the equator.", noteZh: "南半球是赤道以南的半個地球。" },
      ],
    },
    facts: [
      { id: "equator-imaginary", icon: "➖", text: "The equator is an imaginary line around Earth.", textZh: "赤道是一條繞著地球的想像線。" },
      { id: "north-half", icon: "🔵", text: "The Northern Hemisphere is north of the equator.", textZh: "北半球位在赤道以北。" },
      { id: "south-half", icon: "🟢", text: "The Southern Hemisphere is south of the equator.", textZh: "南半球位在赤道以南。" },
    ],
    questions: [
      {
        id: "hemispheres-q1",
        prompt: "What is the imaginary line around the middle of Earth called?",
        promptZh: "繞著地球中間的想像線叫什麼？",
        options: [
          { id: "equator", icon: "➖", label: "Equator", labelZh: "赤道" },
          { id: "river", icon: "🏞️", label: "River", labelZh: "河流" },
          { id: "orbit", icon: "🪐", label: "Orbit", labelZh: "軌道" },
        ],
        correctOptionId: "equator",
        explain: "The equator is the imaginary line halfway between the poles.",
        explainZh: "赤道是位在兩極中間的想像線。",
      },
      {
        id: "hemispheres-q2",
        prompt: "Which hemisphere is north of the equator?",
        promptZh: "赤道以北是哪一個半球？",
        options: [
          { id: "north", icon: "🔵", label: "Northern Hemisphere", labelZh: "北半球" },
          { id: "south", icon: "🟢", label: "Southern Hemisphere", labelZh: "南半球" },
          { id: "ocean", icon: "🌊", label: "Ocean", labelZh: "海洋" },
        ],
        correctOptionId: "north",
        explain: "The Northern Hemisphere is north of the equator.",
        explainZh: "北半球位在赤道以北。",
      },
    ],
  },
  {
    id: "geography-environment-clues",
    topic: "environments",
    skill: "geography.environment.climate_clues",
    minAge: 5,
    difficulty: 2,
    icon: "🌦️",
    title: "Environment clues",
    titleZh: "環境線索",
    subtitle: "Desert, rainforest and polar regions",
    subtitleZh: "沙漠、雨林與極地",
    preReaderIntro: "Places can be hot, wet, dry or icy.",
    preReaderIntroZh: "不同地方可能炎熱、潮濕、乾燥或冰冷。",
    intro: "Climate patterns help shape environments. Deserts are very dry, tropical rainforests are warm and receive abundant rain, and polar regions are very cold for much of the year.",
    introZh: "氣候型態會影響環境。沙漠非常乾燥，熱帶雨林溫暖而且雨量多，極地地區一年中大部分時間都很寒冷。",
    visual: {
      kind: "environment",
      items: [
        { id: "desert", icon: "🏜️", label: "Desert", labelZh: "沙漠", note: "Deserts receive very little precipitation.", noteZh: "沙漠的降水量很少。" },
        { id: "rainforest", icon: "🌴", label: "Tropical rainforest", labelZh: "熱帶雨林", note: "Tropical rainforests are warm and receive abundant rainfall.", noteZh: "熱帶雨林溫暖，而且雨量豐富。" },
        { id: "polar", icon: "🧊", label: "Polar region", labelZh: "極地", note: "Polar regions are very cold for much of the year.", noteZh: "極地地區一年中大部分時間都很寒冷。" },
      ],
    },
    facts: [
      { id: "desert-dry", icon: "🏜️", text: "Deserts receive very little precipitation.", textZh: "沙漠的降水量很少。" },
      { id: "rainforest-wet", icon: "🌴", text: "Tropical rainforests are warm and receive abundant rain.", textZh: "熱帶雨林溫暖，而且雨量豐富。" },
      { id: "polar-cold", icon: "🧊", text: "Polar regions are very cold for much of the year.", textZh: "極地地區一年中大部分時間都很寒冷。" },
    ],
    questions: [
      {
        id: "environments-q1",
        prompt: "Which environment is known for very little precipitation?",
        promptZh: "哪一種環境的降水量通常很少？",
        options: [
          { id: "desert", icon: "🏜️", label: "Desert", labelZh: "沙漠" },
          { id: "rainforest", icon: "🌴", label: "Tropical rainforest", labelZh: "熱帶雨林" },
          { id: "river", icon: "🏞️", label: "River", labelZh: "河流" },
        ],
        correctOptionId: "desert",
        explain: "Deserts receive very little precipitation.",
        explainZh: "沙漠的降水量很少。",
      },
      {
        id: "environments-q2",
        prompt: "Which environment is very cold for much of the year?",
        promptZh: "哪一種環境一年中大部分時間都很寒冷？",
        options: [
          { id: "polar", icon: "🧊", label: "Polar region", labelZh: "極地" },
          { id: "rainforest", icon: "🌴", label: "Tropical rainforest", labelZh: "熱帶雨林" },
          { id: "desert", icon: "🏜️", label: "Desert", labelZh: "沙漠" },
        ],
        correctOptionId: "polar",
        explain: "Polar regions are very cold for much of the year.",
        explainZh: "極地地區一年中大部分時間都很寒冷。",
      },
    ],
  },
];

function cloneLesson(lesson: GeographyLessonSeed): GeographyLessonDefinition {
  return {
    domain: "geography",
    ...lesson,
    visual: { ...lesson.visual, items: lesson.visual.items.map((item) => ({ ...item })) },
    facts: lesson.facts.map((fact) => ({ ...fact })),
    questions: lesson.questions.map((question) => ({ ...question, options: question.options.map((option) => ({ ...option })) })),
  };
}

export function listGeographyLessons(age?: number): GeographyLessonDefinition[] {
  const learnerAge = Number.isFinite(Number(age)) ? Number(age) : 8;
  return LESSONS.filter((lesson) => learnerAge >= lesson.minAge).map(cloneLesson);
}

export function getGeographyLesson(id: string): GeographyLessonDefinition | null {
  const lesson = LESSONS.find((item) => item.id === id);
  return lesson ? cloneLesson(lesson) : null;
}

export function geographySkillIdForLesson(id: string): string | null {
  return getGeographyLesson(id)?.skill ?? null;
}
