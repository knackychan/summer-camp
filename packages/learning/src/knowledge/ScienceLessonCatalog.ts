import type {
  KnowledgeLessonDefinition,
  KnowledgeLessonFact,
  KnowledgeLessonQuestion,
  KnowledgeLessonVisual,
  KnowledgeLessonVisualItem,
  KnowledgeQuestionOption,
} from "./KnowledgeLessonCatalog.js";

export type ScienceLessonTopic = "animals" | "plants" | "body" | "matter" | "weather" | "space";
export type ScienceVisualKind = "classify" | "sequence" | "system" | "states" | "cycle" | "orbit";
export type ScienceVisualItem = KnowledgeLessonVisualItem;
export type ScienceLessonFact = KnowledgeLessonFact;
export type ScienceQuestionOption = KnowledgeQuestionOption;
export type ScienceLessonQuestion = KnowledgeLessonQuestion;
export interface ScienceLessonVisual extends Omit<KnowledgeLessonVisual, "kind"> { kind: ScienceVisualKind; }
export interface ScienceLessonDefinition extends Omit<KnowledgeLessonDefinition, "domain" | "topic" | "visual"> {
  domain: "science";
  topic: ScienceLessonTopic;
  visual: ScienceLessonVisual;
}

type ScienceLessonSeed = Omit<ScienceLessonDefinition, "domain">;

const LESSONS: readonly ScienceLessonSeed[] = [
  {
    id: "science-animals-groups",
    topic: "animals",
    skill: "science.animals.groups",
    minAge: 3,
    difficulty: 1,
    icon: "🐾",
    title: "Animal groups",
    titleZh: "動物的不同族群",
    subtitle: "Look for body clues",
    subtitleZh: "從身體特徵找線索",
    preReaderIntro: "Animals can look different. Look at their clues!",
    preReaderIntroZh: "動物長得不一樣。看看牠們的線索！",
    intro: "Scientists group animals by shared body features. Fur, feathers and gills are useful clues.",
    introZh: "科學家會用共同的身體特徵來分類動物。毛、羽毛和鰓都是很好用的線索。",
    visual: {
      kind: "classify",
      items: [
        { id: "mammal", icon: "🐶", label: "Mammal", labelZh: "哺乳類", note: "Most mammals have hair or fur and feed milk to their young.", noteZh: "大多數哺乳類有毛，幼兒會喝母乳。" },
        { id: "bird", icon: "🐦", label: "Bird", labelZh: "鳥類", note: "Birds have feathers and beaks.", noteZh: "鳥類有羽毛和鳥喙。" },
        { id: "fish", icon: "🐟", label: "Fish", labelZh: "魚類", note: "Fish live in water and use gills to take oxygen from water.", noteZh: "魚生活在水裡，用鰓從水中取得氧氣。" },
      ],
    },
    facts: [
      { id: "fur", icon: "🐕", text: "Hair or fur is a clue that an animal may be a mammal.", textZh: "毛髮是判斷動物可能屬於哺乳類的一個線索。" },
      { id: "feathers", icon: "🪶", text: "Feathers are a feature found on birds.", textZh: "羽毛是鳥類的特徵。" },
      { id: "gills", icon: "🐠", text: "Fish use gills to take oxygen from water.", textZh: "魚用鰓從水中取得氧氣。" },
    ],
    questions: [
      {
        id: "animals-q1",
        prompt: "Which clue belongs to birds?",
        promptZh: "哪一個線索屬於鳥類？",
        options: [
          { id: "feathers", icon: "🪶", label: "Feathers", labelZh: "羽毛" },
          { id: "gills", icon: "🐟", label: "Gills", labelZh: "鰓" },
          { id: "fur", icon: "🐕", label: "Fur", labelZh: "毛" },
        ],
        correctOptionId: "feathers",
        explain: "Birds have feathers.",
        explainZh: "鳥類有羽毛。",
      },
      {
        id: "animals-q2",
        prompt: "Which animal uses gills?",
        promptZh: "哪一種動物會用鰓？",
        options: [
          { id: "dog", icon: "🐶", label: "Dog", labelZh: "狗" },
          { id: "fish", icon: "🐟", label: "Fish", labelZh: "魚" },
          { id: "bird", icon: "🐦", label: "Bird", labelZh: "鳥" },
        ],
        correctOptionId: "fish",
        explain: "Fish use gills to take oxygen from water.",
        explainZh: "魚用鰓從水中取得氧氣。",
      },
    ],
  },
  {
    id: "science-plants-parts",
    topic: "plants",
    skill: "science.plants.parts",
    minAge: 3,
    difficulty: 1,
    icon: "🌱",
    title: "How a plant works",
    titleZh: "植物怎麼工作",
    subtitle: "Roots, stems and leaves",
    subtitleZh: "根、莖和葉子",
    preReaderIntro: "A plant has different parts. Each part has a job.",
    preReaderIntroZh: "植物有不同的部位，每個部位都有工作。",
    intro: "Roots, stems and leaves work together. Roots take in water, stems support the plant, and leaves capture light.",
    introZh: "根、莖和葉子會一起工作。根吸收水分，莖支撐植物，葉子接收光線。",
    visual: {
      kind: "sequence",
      items: [
        { id: "roots", icon: "🪴", label: "Roots", labelZh: "根", note: "Roots take in water and minerals from the soil.", noteZh: "根從土壤中吸收水和礦物質。" },
        { id: "stem", icon: "🌿", label: "Stem", labelZh: "莖", note: "The stem supports the plant and moves water upward.", noteZh: "莖支撐植物，也把水往上運送。" },
        { id: "leaves", icon: "🍃", label: "Leaves", labelZh: "葉子", note: "Leaves capture light and help the plant make food.", noteZh: "葉子接收光線，幫助植物製造養分。" },
      ],
    },
    facts: [
      { id: "roots-water", icon: "💧", text: "Roots take in water from the soil.", textZh: "根會從土壤吸收水分。" },
      { id: "stem-support", icon: "🌿", text: "The stem supports the plant and carries water upward.", textZh: "莖支撐植物，並把水往上運送。" },
      { id: "leaves-light", icon: "☀️", text: "Leaves use light as part of making food for the plant.", textZh: "葉子利用光線來幫植物製造養分。" },
    ],
    questions: [
      {
        id: "plants-q1",
        prompt: "Which part takes in water from the soil?",
        promptZh: "哪一個部位會從土壤吸收水分？",
        options: [
          { id: "roots", icon: "🪴", label: "Roots", labelZh: "根" },
          { id: "flower", icon: "🌸", label: "Flower", labelZh: "花" },
          { id: "leaves", icon: "🍃", label: "Leaves", labelZh: "葉子" },
        ],
        correctOptionId: "roots",
        explain: "Roots take in water from the soil.",
        explainZh: "根會從土壤吸收水分。",
      },
      {
        id: "plants-q2",
        prompt: "Which part captures light?",
        promptZh: "哪一個部位會接收光線？",
        options: [
          { id: "leaves", icon: "🍃", label: "Leaves", labelZh: "葉子" },
          { id: "roots", icon: "🪴", label: "Roots", labelZh: "根" },
          { id: "soil", icon: "🟫", label: "Soil", labelZh: "土壤" },
        ],
        correctOptionId: "leaves",
        explain: "Leaves capture light and help the plant make food.",
        explainZh: "葉子接收光線，幫助植物製造養分。",
      },
    ],
  },
  {
    id: "science-body-jobs",
    topic: "body",
    skill: "science.body.organ_jobs",
    minAge: 4,
    difficulty: 1,
    icon: "🫀",
    title: "Body team",
    titleZh: "身體小隊",
    subtitle: "Heart, lungs and brain",
    subtitleZh: "心臟、肺和大腦",
    preReaderIntro: "Your body has parts with different jobs.",
    preReaderIntroZh: "你的身體有不同部位，各自有工作。",
    intro: "The heart, lungs and brain have different jobs, and they work together to keep your body functioning.",
    introZh: "心臟、肺和大腦有不同的工作，也會一起合作讓身體運作。",
    visual: {
      kind: "system",
      items: [
        { id: "heart", icon: "❤️", label: "Heart", labelZh: "心臟", note: "The heart pumps blood around the body.", noteZh: "心臟把血液送到身體各處。" },
        { id: "lungs", icon: "🫁", label: "Lungs", labelZh: "肺", note: "The lungs bring oxygen into the body and remove carbon dioxide.", noteZh: "肺把氧氣帶進身體，也排出二氧化碳。" },
        { id: "brain", icon: "🧠", label: "Brain", labelZh: "大腦", note: "The brain receives information and helps control the body.", noteZh: "大腦接收資訊，也幫助控制身體。" },
      ],
    },
    facts: [
      { id: "heart-pumps", icon: "❤️", text: "The heart pumps blood around the body.", textZh: "心臟把血液送到身體各處。" },
      { id: "lungs-gas", icon: "🫁", text: "The lungs bring oxygen in and help remove carbon dioxide.", textZh: "肺把氧氣帶進身體，也幫助排出二氧化碳。" },
      { id: "brain-control", icon: "🧠", text: "The brain receives information and helps control movement and other body functions.", textZh: "大腦接收資訊，並幫助控制動作和其他身體功能。" },
    ],
    questions: [
      {
        id: "body-q1",
        prompt: "Which organ pumps blood?",
        promptZh: "哪個器官會幫忙把血液送出去？",
        options: [
          { id: "heart", icon: "❤️", label: "Heart", labelZh: "心臟" },
          { id: "lungs", icon: "🫁", label: "Lungs", labelZh: "肺" },
          { id: "brain", icon: "🧠", label: "Brain", labelZh: "大腦" },
        ],
        correctOptionId: "heart",
        explain: "The heart pumps blood around the body.",
        explainZh: "心臟把血液送到身體各處。",
      },
      {
        id: "body-q2",
        prompt: "Which organs bring oxygen into the body?",
        promptZh: "哪個器官會把氧氣帶進身體？",
        options: [
          { id: "brain", icon: "🧠", label: "Brain", labelZh: "大腦" },
          { id: "lungs", icon: "🫁", label: "Lungs", labelZh: "肺" },
          { id: "heart", icon: "❤️", label: "Heart", labelZh: "心臟" },
        ],
        correctOptionId: "lungs",
        explain: "The lungs bring oxygen into the body when you breathe in.",
        explainZh: "吸氣時，肺會把氧氣帶進身體。",
      },
    ],
  },
  {
    id: "science-matter-states",
    topic: "matter",
    skill: "science.matter.states",
    minAge: 4,
    difficulty: 1,
    icon: "🧊",
    title: "Solid, liquid, gas",
    titleZh: "固體、液體、氣體",
    subtitle: "Three common states of matter",
    subtitleZh: "常見的三種物質狀態",
    preReaderIntro: "Things can be solid, liquid or gas.",
    preReaderIntroZh: "東西可以是固體、液體或氣體。",
    intro: "Matter can behave in different ways. Solids keep their own shape, liquids flow, and gases spread out to fill available space.",
    introZh: "物質可以有不同的樣子。固體保持自己的形狀，液體會流動，氣體會散開填滿空間。",
    visual: {
      kind: "states",
      items: [
        { id: "solid", icon: "🧊", label: "Solid", labelZh: "固體", note: "A solid keeps its own shape unless something changes it.", noteZh: "固體通常會保持自己的形狀。" },
        { id: "liquid", icon: "💧", label: "Liquid", labelZh: "液體", note: "A liquid flows and takes the shape of its container.", noteZh: "液體會流動，也會變成容器的形狀。" },
        { id: "gas", icon: "💨", label: "Gas", labelZh: "氣體", note: "A gas spreads out to fill available space.", noteZh: "氣體會散開，填滿可用的空間。" },
      ],
    },
    facts: [
      { id: "solid-shape", icon: "🧊", text: "A solid keeps its own shape.", textZh: "固體會保持自己的形狀。" },
      { id: "liquid-container", icon: "💧", text: "A liquid flows and takes the shape of its container.", textZh: "液體會流動，也會變成容器的形狀。" },
      { id: "gas-space", icon: "💨", text: "A gas spreads out to fill available space.", textZh: "氣體會散開，填滿可用的空間。" },
    ],
    questions: [
      {
        id: "matter-q1",
        prompt: "Which state takes the shape of its container but keeps the same amount?",
        promptZh: "哪種狀態會變成容器的形狀？",
        options: [
          { id: "solid", icon: "🧊", label: "Solid", labelZh: "固體" },
          { id: "liquid", icon: "💧", label: "Liquid", labelZh: "液體" },
          { id: "gas", icon: "💨", label: "Gas", labelZh: "氣體" },
        ],
        correctOptionId: "liquid",
        explain: "Liquids flow and take the shape of their container.",
        explainZh: "液體會流動，也會變成容器的形狀。",
      },
      {
        id: "matter-q2",
        prompt: "Which state spreads out to fill available space?",
        promptZh: "哪種狀態會散開填滿空間？",
        options: [
          { id: "gas", icon: "💨", label: "Gas", labelZh: "氣體" },
          { id: "solid", icon: "🧊", label: "Solid", labelZh: "固體" },
          { id: "liquid", icon: "💧", label: "Liquid", labelZh: "液體" },
        ],
        correctOptionId: "gas",
        explain: "Gases spread out to fill available space.",
        explainZh: "氣體會散開，填滿可用的空間。",
      },
    ],
  },
  {
    id: "science-weather-water-cycle",
    topic: "weather",
    skill: "science.weather.water_cycle",
    minAge: 4,
    difficulty: 2,
    icon: "🌦️",
    title: "Water cycle",
    titleZh: "水循環",
    subtitle: "Water moves around Earth",
    subtitleZh: "水在地球上不停移動",
    preReaderIntro: "Sun, clouds and rain move water around.",
    preReaderIntroZh: "太陽、雲和雨會讓水不停移動。",
    intro: "Sunlight warms water, some water evaporates into the air, clouds form as water cools, and rain can return water to the ground.",
    introZh: "陽光讓水變暖，一部分水蒸發到空氣中；水冷卻後形成雲，雨又把水帶回地面。",
    visual: {
      kind: "cycle",
      items: [
        { id: "warm", icon: "☀️", label: "Warm", labelZh: "加熱", note: "Sunlight warms water at Earth's surface.", noteZh: "陽光讓地表的水變暖。" },
        { id: "evaporate", icon: "💧⬆️", label: "Evaporate", labelZh: "蒸發", note: "Some liquid water changes into water vapour and rises into the air.", noteZh: "一部分液態水變成水蒸氣，進入空氣中。" },
        { id: "cloud", icon: "☁️", label: "Cloud", labelZh: "雲", note: "Cooling water vapour can condense into tiny droplets that make clouds.", noteZh: "水蒸氣冷卻後可以凝結成小水滴，形成雲。" },
        { id: "rain", icon: "🌧️", label: "Rain", labelZh: "降雨", note: "Water can fall from clouds and return to the ground.", noteZh: "水可以從雲裡落下，再回到地面。" },
      ],
    },
    facts: [
      { id: "evaporation", icon: "☀️", text: "Sunlight can warm liquid water and help some of it evaporate.", textZh: "陽光可以讓液態水變暖，讓一部分水蒸發。" },
      { id: "condensation", icon: "☁️", text: "Cooling water vapour can condense into tiny liquid droplets.", textZh: "水蒸氣冷卻後可以凝結成小水滴。" },
      { id: "precipitation", icon: "🌧️", text: "Rain is one way water returns from clouds to Earth's surface.", textZh: "雨是水從雲回到地表的一種方式。" },
    ],
    questions: [
      {
        id: "weather-q1",
        prompt: "What can happen when liquid water is warmed by the Sun?",
        promptZh: "液態水被太陽加熱時，可能發生什麼？",
        options: [
          { id: "evaporate", icon: "💧⬆️", label: "It can evaporate", labelZh: "可能蒸發" },
          { id: "freeze", icon: "🧊", label: "It always freezes", labelZh: "一定結冰" },
          { id: "rock", icon: "🪨", label: "It becomes rock", labelZh: "變成石頭" },
        ],
        correctOptionId: "evaporate",
        explain: "Warming can help liquid water evaporate into water vapour.",
        explainZh: "加熱可以讓液態水蒸發成水蒸氣。",
      },
      {
        id: "weather-q2",
        prompt: "What can form when water vapour cools and condenses?",
        promptZh: "水蒸氣冷卻並凝結時，可以形成什麼？",
        options: [
          { id: "cloud", icon: "☁️", label: "Cloud droplets", labelZh: "雲中的小水滴" },
          { id: "fire", icon: "🔥", label: "Fire", labelZh: "火" },
          { id: "sand", icon: "🏖️", label: "Sand", labelZh: "沙" },
        ],
        correctOptionId: "cloud",
        explain: "Tiny droplets formed by condensation can make clouds.",
        explainZh: "凝結形成的小水滴可以組成雲。",
      },
    ],
  },
  {
    id: "science-space-motion",
    topic: "space",
    skill: "science.space.earth_moon_sun",
    minAge: 4,
    difficulty: 2,
    icon: "🌍",
    title: "Earth, Moon and Sun",
    titleZh: "地球、月球和太陽",
    subtitle: "Rotation and orbits",
    subtitleZh: "自轉與公轉",
    preReaderIntro: "Earth spins. Earth goes around the Sun. The Moon goes around Earth.",
    preReaderIntroZh: "地球會轉，也繞著太陽走；月球繞著地球走。",
    intro: "Earth rotates on its axis and also travels around the Sun. The Moon travels around Earth.",
    introZh: "地球會繞著自己的軸自轉，也會繞著太陽公轉；月球則繞著地球公轉。",
    visual: {
      kind: "orbit",
      items: [
        { id: "sun", icon: "☀️", label: "Sun", labelZh: "太陽", note: "Earth travels around the Sun.", noteZh: "地球繞著太陽公轉。" },
        { id: "earth", icon: "🌍", label: "Earth", labelZh: "地球", note: "Earth rotates on its axis; this rotation produces day and night.", noteZh: "地球繞著自己的軸自轉，這個自轉造成白天與黑夜。" },
        { id: "moon", icon: "🌙", label: "Moon", labelZh: "月球", note: "The Moon travels around Earth.", noteZh: "月球繞著地球公轉。" },
      ],
    },
    facts: [
      { id: "earth-rotates", icon: "🌍", text: "Earth rotates on its axis, producing day and night.", textZh: "地球繞著自己的軸自轉，形成白天和黑夜。" },
      { id: "earth-orbits", icon: "☀️", text: "Earth travels around the Sun.", textZh: "地球繞著太陽公轉。" },
      { id: "moon-orbits", icon: "🌙", text: "The Moon travels around Earth.", textZh: "月球繞著地球公轉。" },
    ],
    questions: [
      {
        id: "space-q1",
        prompt: "What produces day and night on Earth?",
        promptZh: "地球上的白天和黑夜主要是什麼造成的？",
        options: [
          { id: "rotation", icon: "🌍↻", label: "Earth rotating", labelZh: "地球自轉" },
          { id: "moon", icon: "🌙", label: "The Moon disappearing", labelZh: "月球消失" },
          { id: "clouds", icon: "☁️", label: "Clouds moving", labelZh: "雲移動" },
        ],
        correctOptionId: "rotation",
        explain: "Earth's rotation turns different places toward and away from the Sun.",
        explainZh: "地球自轉時，不同地方會輪流朝向或背向太陽。",
      },
      {
        id: "space-q2",
        prompt: "What does the Moon travel around?",
        promptZh: "月球繞著什麼公轉？",
        options: [
          { id: "earth", icon: "🌍", label: "Earth", labelZh: "地球" },
          { id: "mars", icon: "🔴", label: "Mars", labelZh: "火星" },
          { id: "cloud", icon: "☁️", label: "A cloud", labelZh: "雲" },
        ],
        correctOptionId: "earth",
        explain: "The Moon travels around Earth.",
        explainZh: "月球繞著地球公轉。",
      },
    ],
  },
];

function cloneLesson(lesson: ScienceLessonSeed): ScienceLessonDefinition {
  return {
    domain: "science",
    ...lesson,
    visual: { ...lesson.visual, items: lesson.visual.items.map((item) => ({ ...item })) },
    facts: lesson.facts.map((fact) => ({ ...fact })),
    questions: lesson.questions.map((question) => ({ ...question, options: question.options.map((option) => ({ ...option })) })),
  };
}

export function listScienceLessons(age?: number): ScienceLessonDefinition[] {
  const learnerAge = Number.isFinite(Number(age)) ? Number(age) : 8;
  return LESSONS.filter((lesson) => learnerAge >= lesson.minAge).map(cloneLesson);
}

export function getScienceLesson(id: string): ScienceLessonDefinition | null {
  const lesson = LESSONS.find((item) => item.id === id);
  return lesson ? cloneLesson(lesson) : null;
}

export function scienceSkillIdForLesson(id: string): string | null {
  return getScienceLesson(id)?.skill ?? null;
}
