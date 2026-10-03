import type {
  KnowledgeLessonDefinition,
  KnowledgeLessonFact,
  KnowledgeLessonQuestion,
  KnowledgeLessonVisual,
  KnowledgeLessonVisualItem,
} from "./KnowledgeLessonCatalog.js";

export type HistoryLessonTopic = "past_present" | "sequence" | "sources" | "egypt" | "china" | "communication";
export type HistoryVisualKind = "past_present" | "sequence" | "sources" | "timeline" | "civilization" | "change";
export type HistoryVisualItem = KnowledgeLessonVisualItem;
export type HistoryLessonFact = KnowledgeLessonFact;
export type HistoryLessonQuestion = KnowledgeLessonQuestion;
export interface HistoryLessonVisual extends Omit<KnowledgeLessonVisual, "kind"> { kind: HistoryVisualKind; }
export interface HistoryLessonDefinition extends Omit<KnowledgeLessonDefinition, "domain" | "topic" | "visual"> {
  domain: "history";
  topic: HistoryLessonTopic;
  visual: HistoryLessonVisual;
}

type HistoryLessonSeed = Omit<HistoryLessonDefinition, "domain">;

const LESSONS: readonly HistoryLessonSeed[] = [
  {
    id: "history-past-present",
    topic: "past_present",
    skill: "history.time.past_present",
    minAge: 3,
    difficulty: 1,
    icon: "🕰️",
    title: "Past and present",
    titleZh: "過去和現在",
    subtitle: "What happened before, and what is happening now",
    subtitleZh: "以前發生的事，和現在正在發生的事",
    preReaderIntro: "The past is before now. The present is now.",
    preReaderIntroZh: "過去是在現在以前；現在就是此刻。",
    intro: "History studies the past. We compare things from before with things we see in the present to understand change over time.",
    introZh: "歷史是在研究過去。我們會比較以前的事物和現在的事物，了解時間中的變化。",
    visual: {
      kind: "past_present",
      items: [
        { id: "past", icon: "📜", label: "Past", labelZh: "過去", note: "The past means a time before now.", noteZh: "過去是指現在以前的時間。" },
        { id: "present", icon: "📱", label: "Present", labelZh: "現在", note: "The present means the time happening now.", noteZh: "現在是指此刻正在發生的時間。" },
        { id: "change", icon: "➡️", label: "Change", labelZh: "變化", note: "Comparing past and present can show what changed.", noteZh: "比較過去和現在，可以看出有哪些變化。" },
      ],
    },
    facts: [
      { id: "past-before-now", icon: "📜", text: "The past is any time before now.", textZh: "過去是現在以前的任何時間。" },
      { id: "present-now", icon: "⏱️", text: "The present is the time happening now.", textZh: "現在就是此刻正在發生的時間。" },
      { id: "compare-change", icon: "🔎", text: "Comparing past and present helps us notice change.", textZh: "比較過去和現在，可以幫助我們看見變化。" },
    ],
    questions: [
      {
        id: "past-present-q1",
        prompt: "Which word means a time before now?",
        promptZh: "哪一個詞表示現在以前的時間？",
        options: [
          { id: "past", icon: "📜", label: "Past", labelZh: "過去" },
          { id: "present", icon: "⏱️", label: "Present", labelZh: "現在" },
          { id: "future", icon: "🔮", label: "Future", labelZh: "未來" },
        ],
        correctOptionId: "past",
        explain: "The past is the time before now.",
        explainZh: "過去就是現在以前的時間。",
      },
      {
        id: "past-present-q2",
        prompt: "Why do historians compare the past and the present?",
        promptZh: "為什麼歷史研究會比較過去和現在？",
        options: [
          { id: "change", icon: "➡️", label: "To notice change", labelZh: "看出變化" },
          { id: "weather", icon: "🌦️", label: "To predict today's weather", labelZh: "預測今天的天氣" },
          { id: "directions", icon: "🧭", label: "To find north", labelZh: "找出北方" },
        ],
        correctOptionId: "change",
        explain: "Comparing different times helps us see what changed and what stayed similar.",
        explainZh: "比較不同時間，可以看出什麼改變了、什麼仍然相似。",
      },
    ],
  },
  {
    id: "history-before-after",
    topic: "sequence",
    skill: "history.time.before_after",
    minAge: 3,
    difficulty: 1,
    icon: "⏳",
    title: "Before and after",
    titleZh: "先和後",
    subtitle: "Put events in time order",
    subtitleZh: "把事件依時間排好",
    preReaderIntro: "Some things happen first. Other things happen later.",
    preReaderIntroZh: "有些事情先發生，其他事情後發生。",
    intro: "A sequence puts events in the order they happened. Words such as before, after, first and later help describe that order.",
    introZh: "順序就是把事件照發生的先後排列。『之前、之後、先、後來』可以幫助我們描述順序。",
    visual: {
      kind: "sequence",
      items: [
        { id: "seed", icon: "🌰", label: "Seed", labelZh: "種子", note: "The seed comes before the sprout in this simple sequence.", noteZh: "在這個簡單順序裡，種子先於幼苗。" },
        { id: "sprout", icon: "🌱", label: "Sprout", labelZh: "幼苗", note: "The sprout comes after the seed and before the grown plant.", noteZh: "幼苗在種子之後，也在長成的植物之前。" },
        { id: "plant", icon: "🌿", label: "Grown plant", labelZh: "長成的植物", note: "The grown plant comes later in this example.", noteZh: "在這個例子裡，長成的植物比較晚出現。" },
      ],
    },
    facts: [
      { id: "sequence-order", icon: "1️⃣", text: "A sequence puts events in the order they happened.", textZh: "順序會把事件照發生的先後排列。" },
      { id: "before-earlier", icon: "⬅️", text: "Before means earlier in the sequence.", textZh: "『之前』表示在順序中比較早。" },
      { id: "after-later", icon: "➡️", text: "After means later in the sequence.", textZh: "『之後』表示在順序中比較晚。" },
    ],
    questions: [
      {
        id: "before-after-q1",
        prompt: "In the picture sequence, what comes before the sprout?",
        promptZh: "在圖示順序中，幼苗之前是什麼？",
        options: [
          { id: "seed", icon: "🌰", label: "Seed", labelZh: "種子" },
          { id: "plant", icon: "🌿", label: "Grown plant", labelZh: "長成的植物" },
          { id: "moon", icon: "🌙", label: "Moon", labelZh: "月亮" },
        ],
        correctOptionId: "seed",
        explain: "The seed is earlier than the sprout in this sequence.",
        explainZh: "在這個順序裡，種子比幼苗更早。",
      },
      {
        id: "before-after-q2",
        prompt: "Which word means later in a sequence?",
        promptZh: "哪一個詞表示在順序中比較晚？",
        options: [
          { id: "after", icon: "➡️", label: "After", labelZh: "之後" },
          { id: "before", icon: "⬅️", label: "Before", labelZh: "之前" },
          { id: "north", icon: "⬆️", label: "North", labelZh: "北" },
        ],
        correctOptionId: "after",
        explain: "After means later in the sequence.",
        explainZh: "『之後』表示在順序中比較晚。",
      },
    ],
  },
  {
    id: "history-clues-sources",
    topic: "sources",
    skill: "history.sources.clues",
    minAge: 4,
    difficulty: 1,
    icon: "🔎",
    title: "History detectives",
    titleZh: "歷史偵探",
    subtitle: "Use clues from the past",
    subtitleZh: "用過去留下的線索",
    preReaderIntro: "Old objects and pictures can tell us about the past.",
    preReaderIntroZh: "以前留下的物品和圖片，可以告訴我們過去的事。",
    intro: "Historians learn from sources: things left from the past, such as objects, pictures, buildings and written records. A source is evidence, but it still needs careful interpretation.",
    introZh: "歷史研究會使用『史料』：也就是過去留下的物品、圖片、建築和文字紀錄。史料是證據，但仍需要仔細理解。",
    visual: {
      kind: "sources",
      items: [
        { id: "artifact", icon: "🏺", label: "Object", labelZh: "物品", note: "An old object can show how people made, used or decorated things.", noteZh: "舊物品可以讓我們知道人們怎麼製作、使用或裝飾東西。" },
        { id: "image", icon: "🖼️", label: "Picture", labelZh: "圖片", note: "A picture can preserve a view of people, clothing, places or events.", noteZh: "圖片可以留下人物、衣著、地點或事件的樣子。" },
        { id: "record", icon: "📜", label: "Written record", labelZh: "文字紀錄", note: "A written record can preserve names, ideas, rules or descriptions.", noteZh: "文字紀錄可以保存名字、想法、規則或描述。" },
      ],
    },
    facts: [
      { id: "sources-evidence", icon: "🔎", text: "Sources are clues or evidence about the past.", textZh: "史料是了解過去的線索或證據。" },
      { id: "objects-sources", icon: "🏺", text: "Objects, pictures, buildings and writing can all be historical sources.", textZh: "物品、圖片、建築和文字都可能是歷史史料。" },
      { id: "interpret-carefully", icon: "🧠", text: "A source needs careful interpretation; one clue may not tell the whole story.", textZh: "史料需要仔細理解；一個線索不一定能說明全部故事。" },
    ],
    questions: [
      {
        id: "sources-q1",
        prompt: "Which could be a historical source?",
        promptZh: "哪一個可能是歷史史料？",
        options: [
          { id: "old-pot", icon: "🏺", label: "An old pottery bowl", labelZh: "一個古老陶碗" },
          { id: "imaginary", icon: "🦄", label: "A made-up unicorn memory", labelZh: "想像出來的獨角獸回憶" },
          { id: "weather", icon: "☔", label: "Tomorrow's weather forecast", labelZh: "明天的天氣預報" },
        ],
        correctOptionId: "old-pot",
        explain: "An old object can be evidence about how people lived or made things.",
        explainZh: "古老物品可以成為人們如何生活或製作物品的證據。",
      },
      {
        id: "sources-q2",
        prompt: "Why should a historian use more than one clue when possible?",
        promptZh: "為什麼歷史研究在可以的情況下，最好使用不只一個線索？",
        options: [
          { id: "whole-story", icon: "🧩", label: "One clue may not show the whole story", labelZh: "一個線索可能看不到完整故事" },
          { id: "faster", icon: "⚡", label: "Because every clue is automatically correct", labelZh: "因為每個線索都一定完全正確" },
          { id: "north", icon: "🧭", label: "To find north", labelZh: "為了找北方" },
        ],
        correctOptionId: "whole-story",
        explain: "Different sources can add context or reveal different parts of the past.",
        explainZh: "不同史料可以補充背景，也可能顯示過去的不同面向。",
      },
    ],
  },
  {
    id: "history-ancient-egypt",
    topic: "egypt",
    skill: "history.ancient.egypt_clues",
    minAge: 5,
    difficulty: 2,
    icon: "𓂀",
    title: "Ancient Egypt clues",
    titleZh: "古埃及線索",
    subtitle: "Nile, hieroglyphs and pyramids",
    subtitleZh: "尼羅河、象形文字和金字塔",
    preReaderIntro: "Ancient Egypt grew beside the Nile River.",
    preReaderIntroZh: "古埃及文明在尼羅河沿岸發展。",
    intro: "Ancient Egyptian civilization developed along the Nile River. Egyptians used hieroglyphic writing, and some rulers were buried in large tomb complexes including pyramids.",
    introZh: "古埃及文明沿著尼羅河發展。埃及人使用象形文字，有些統治者被安葬在大型陵墓建築群中，其中包括金字塔。",
    visual: {
      kind: "civilization",
      items: [
        { id: "nile", icon: "🌊", label: "Nile River", labelZh: "尼羅河", note: "The Nile provided water and fertile land that supported farming and settlements.", noteZh: "尼羅河提供水源與肥沃土地，支持農業和聚落。" },
        { id: "hieroglyphs", icon: "𓂀", label: "Hieroglyphs", labelZh: "象形文字", note: "Hieroglyphic signs were part of an ancient Egyptian writing system.", noteZh: "象形符號是古埃及文字系統的一部分。" },
        { id: "pyramid", icon: "🔺", label: "Pyramid", labelZh: "金字塔", note: "Some pyramids were built as royal tombs in ancient Egypt.", noteZh: "古埃及有些金字塔是作為王室陵墓建造的。" },
      ],
    },
    facts: [
      { id: "egypt-nile", icon: "🌊", text: "Ancient Egyptian civilization developed along the Nile River.", textZh: "古埃及文明沿著尼羅河發展。" },
      { id: "egypt-writing", icon: "𓂀", text: "Hieroglyphs were part of an ancient Egyptian writing system.", textZh: "象形文字是古埃及文字系統的一部分。" },
      { id: "egypt-pyramids", icon: "🔺", text: "Some ancient Egyptian pyramids were built as royal tombs.", textZh: "古埃及有些金字塔是作為王室陵墓建造的。" },
    ],
    questions: [
      {
        id: "egypt-q1",
        prompt: "Which river was central to ancient Egyptian farming and settlements?",
        promptZh: "哪一條河流對古埃及的農業和聚落非常重要？",
        options: [
          { id: "nile", icon: "🌊", label: "Nile", labelZh: "尼羅河" },
          { id: "amazon", icon: "🌳", label: "Amazon", labelZh: "亞馬遜河" },
          { id: "thames", icon: "🌉", label: "Thames", labelZh: "泰晤士河" },
        ],
        correctOptionId: "nile",
        explain: "Ancient Egyptian civilization developed along the Nile River.",
        explainZh: "古埃及文明沿著尼羅河發展。",
      },
      {
        id: "egypt-q2",
        prompt: "What were hieroglyphs?",
        promptZh: "象形文字是什麼？",
        options: [
          { id: "writing", icon: "𓂀", label: "Part of a writing system", labelZh: "文字系統的一部分" },
          { id: "compass", icon: "🧭", label: "A compass direction", labelZh: "指南針方向" },
          { id: "planet", icon: "🪐", label: "A planet", labelZh: "一顆行星" },
        ],
        correctOptionId: "writing",
        explain: "Hieroglyphic signs were used in ancient Egyptian writing.",
        explainZh: "古埃及文字會使用象形符號。",
      },
    ],
  },
  {
    id: "history-ancient-china",
    topic: "china",
    skill: "history.ancient.china_clues",
    minAge: 5,
    difficulty: 2,
    icon: "🏮",
    title: "Ancient China clues",
    titleZh: "古代中國線索",
    subtitle: "Writing, silk and early paper",
    subtitleZh: "文字、絲綢與早期紙張",
    preReaderIntro: "People in ancient China made silk and developed important writing traditions.",
    preReaderIntroZh: "古代中國的人們製作絲綢，也發展了重要的文字傳統。",
    intro: "Ancient Chinese societies developed long-lasting writing traditions. Silk production became an important craft, and paper-making was developed in China and later spread widely.",
    introZh: "古代中國社會發展出延續很久的文字傳統。絲綢生產成為重要工藝，造紙技術也在中國發展，之後廣泛傳播。",
    visual: {
      kind: "civilization",
      items: [
        { id: "writing", icon: "書", label: "Writing", labelZh: "文字", note: "Chinese writing traditions developed over a very long period and changed over time.", noteZh: "中國文字傳統經歷很長時間發展，也隨時間變化。" },
        { id: "silk", icon: "🧵", label: "Silk", labelZh: "絲綢", note: "Silk production became an important craft and trade good.", noteZh: "絲綢生產成為重要工藝，也成為貿易商品。" },
        { id: "paper", icon: "📄", label: "Paper", labelZh: "紙", note: "Paper-making was developed in China and later spread to other regions.", noteZh: "造紙技術在中國發展，之後傳到其他地區。" },
      ],
    },
    facts: [
      { id: "china-writing", icon: "書", text: "Ancient Chinese societies developed long-lasting writing traditions.", textZh: "古代中國社會發展出延續很久的文字傳統。" },
      { id: "china-silk", icon: "🧵", text: "Silk production became an important craft and trade good in ancient China.", textZh: "絲綢生產在古代中國成為重要工藝與貿易商品。" },
      { id: "china-paper", icon: "📄", text: "Paper-making was developed in China and later spread widely.", textZh: "造紙技術在中國發展，之後廣泛傳播。" },
    ],
    questions: [
      {
        id: "china-q1",
        prompt: "Which material became an important craft and trade good in ancient China?",
        promptZh: "哪一種材料在古代中國成為重要工藝與貿易商品？",
        options: [
          { id: "silk", icon: "🧵", label: "Silk", labelZh: "絲綢" },
          { id: "plastic", icon: "🧴", label: "Plastic", labelZh: "塑膠" },
          { id: "aluminum", icon: "🥫", label: "Aluminum cans", labelZh: "鋁罐" },
        ],
        correctOptionId: "silk",
        explain: "Silk production was an important craft and silk was traded over long distances.",
        explainZh: "絲綢生產是重要工藝，絲綢也曾進行長距離貿易。",
      },
      {
        id: "china-q2",
        prompt: "Which writing material was developed in China and later spread widely?",
        promptZh: "哪一種書寫材料的製作技術在中國發展，之後廣泛傳播？",
        options: [
          { id: "paper", icon: "📄", label: "Paper", labelZh: "紙" },
          { id: "glass", icon: "🪟", label: "Glass", labelZh: "玻璃" },
          { id: "rubber", icon: "🛞", label: "Rubber", labelZh: "橡膠" },
        ],
        correctOptionId: "paper",
        explain: "Paper-making was developed in China and later spread to other regions.",
        explainZh: "造紙技術在中國發展，之後傳到其他地區。",
      },
    ],
  },
  {
    id: "history-communication-change",
    topic: "communication",
    skill: "history.change.communication",
    minAge: 6,
    difficulty: 2,
    icon: "✉️",
    title: "Messages through time",
    titleZh: "訊息如何穿越時間",
    subtitle: "Letters, telegraph, telephone and digital messages",
    subtitleZh: "書信、電報、電話與數位訊息",
    preReaderIntro: "People have invented new ways to send messages farther and faster.",
    preReaderIntroZh: "人們發明了新的方式，讓訊息可以傳得更遠、更快。",
    intro: "Communication technology changed over time. Letters could travel physically, telegraphs sent coded signals over wires, telephones carried voices, and digital networks can send information very quickly across long distances.",
    introZh: "通訊科技隨時間改變。書信需要實際運送，電報透過電線傳送編碼訊號，電話可以傳送聲音，而數位網路能快速把資訊傳到很遠的地方。",
    visual: {
      kind: "change",
      items: [
        { id: "letter", icon: "✉️", label: "Letter", labelZh: "書信", note: "A letter is a physical message that must be carried to its destination.", noteZh: "書信是實體訊息，需要被運送到目的地。" },
        { id: "telegraph", icon: "〰️", label: "Telegraph", labelZh: "電報", note: "Telegraph systems sent coded electrical signals over wires.", noteZh: "電報系統會透過電線傳送編碼的電訊號。" },
        { id: "telephone", icon: "☎️", label: "Telephone", labelZh: "電話", note: "Telephones let people transmit voices across distance.", noteZh: "電話讓人們可以把聲音傳到遠方。" },
        { id: "digital", icon: "💬", label: "Digital message", labelZh: "數位訊息", note: "Digital networks can move messages very quickly over long distances.", noteZh: "數位網路可以很快把訊息傳到遠方。" },
      ],
    },
    facts: [
      { id: "letters-carried", icon: "✉️", text: "A physical letter has to be carried from sender to receiver.", textZh: "實體書信需要從寄件人運送到收件人。" },
      { id: "telegraph-signals", icon: "〰️", text: "Telegraphs sent coded electrical signals over wires.", textZh: "電報透過電線傳送編碼的電訊號。" },
      { id: "digital-fast", icon: "💬", text: "Digital networks can send information quickly across long distances.", textZh: "數位網路可以快速把資訊傳到很遠的地方。" },
    ],
    questions: [
      {
        id: "communication-q1",
        prompt: "Which system sent coded electrical signals over wires?",
        promptZh: "哪一種系統會透過電線傳送編碼的電訊號？",
        options: [
          { id: "telegraph", icon: "〰️", label: "Telegraph", labelZh: "電報" },
          { id: "letter", icon: "✉️", label: "Letter", labelZh: "書信" },
          { id: "compass", icon: "🧭", label: "Compass", labelZh: "指南針" },
        ],
        correctOptionId: "telegraph",
        explain: "The telegraph used coded electrical signals sent over wires.",
        explainZh: "電報會把編碼的電訊號透過電線傳送。",
      },
      {
        id: "communication-q2",
        prompt: "What is one major change in communication over time?",
        promptZh: "通訊方式隨時間的一個重要變化是什麼？",
        options: [
          { id: "faster", icon: "⚡", label: "Messages can travel much faster", labelZh: "訊息可以傳得快很多" },
          { id: "mountains", icon: "⛰️", label: "Mountains became lower", labelZh: "山變矮了" },
          { id: "north", icon: "⬆️", label: "North changed direction", labelZh: "北方改變方向了" },
        ],
        correctOptionId: "faster",
        explain: "New communication technologies made long-distance messages much faster to send.",
        explainZh: "新的通訊科技讓長距離訊息可以快很多送達。",
      },
    ],
  },
] as const;

export function listHistoryLessons(age?: number): HistoryLessonDefinition[] {
  const lessons = LESSONS.map((lesson) => ({ ...lesson, domain: "history" as const }));
  if (age == null) return lessons;
  return lessons.filter((lesson) => lesson.minAge <= age);
}

export function getHistoryLesson(id: string): HistoryLessonDefinition | null {
  const lesson = LESSONS.find((entry) => entry.id === id);
  return lesson ? { ...lesson, domain: "history" } : null;
}
