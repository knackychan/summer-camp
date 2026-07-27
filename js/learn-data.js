/* Learn guides — shared by index.html (kid app) and admin.html (Papa can name
   the star a learn guide earned instead of showing "Activity #1003").

   act_done.act_idx is an int column. Learn guides live in a reserved band above
   LEARN_BASE so a learn completion syncs and survives hydrate() like any other
   activity — before this they were keyed "L"+name, which made enqueueDiff emit
   NaN (stalling the whole sync queue) and let hydrate wipe the tick so the same
   star could be claimed again on every reload. */
const LEARN_GUIDES={
know:{icon:"🔎",title:"I want to KNOW something",tz:"我想「知道」一件事",
 lucien:[["Pick your question with your buddy","和夥伴一起選一個問題"],
  ["Ask a big sibling or grown-up to type it","請哥哥姊姊或大人幫你打字"],
  ["Look at the pictures together","一起看圖片"],
  ["Say out loud what you see","大聲說出你看到什麼"],
  ["Tell everyone at dinner!","晚餐時告訴大家！"]],
 lili:[["Write your question in your notebook","把你的問題寫在筆記本"],
  ["Turn it into search words — 'why sky blue', not a whole sentence","變成搜尋關鍵字——「天空 為什麼 藍色」，不用整句"],
  ["Search with a grown-up nearby (Kiddle is best)","有大人在旁邊時搜尋（用Kiddle最好）"],
  ["Look at 2 pages — do they say the same thing?","看2個網頁——它們說的一樣嗎？"],
  ["Write ONE fact in YOUR own words","用「自己的話」寫下一個事實"],
  ["Tell it at dinner tonight","今晚晚餐時分享"]],
 luis:[["Write the question, then brainstorm 3 search phrases","寫下問題，再想出3種搜尋寫法"],
  ["Find 3 DIFFERENT sources (not the same site)","找3個「不同」的來源（不能同一個網站）"],
  ["Cross-check: do they agree? If not, why?","交叉比對：它們一致嗎？不一致的話為什麼？"],
  ["Write 3 facts in YOUR words — no copy-paste","用自己的話寫3個事實——不能複製貼上"],
  ["Bonus: ask AI to quiz you on what you learned","加分：請AI考你剛學到的內容"]]},
doskill:{icon:"🛠️",title:"I want to LEARN to do something",tz:"我想「學會」做一件事",
 lucien:[["Say what you want to learn ('fold a paper plane')","說出你想學什麼（例如「摺紙飛機」）"],
  ["Watch ONE video with a buddy — all of it","和夥伴看「一支」影片——看完整支"],
  ["Get your materials ready","準備好材料"],
  ["Try it! It's OK if it goes wrong 😄","試試看！做壞了也沒關係 😄"],
  ["Try again more slowly, then show someone","再慢慢做一次，然後展示給別人看"]],
 lili:[["Name the skill exactly: 'how to fold a paper crane'","精確說出技能：「怎麼摺紙鶴」"],
  ["Search it + 'for kids' or 'easy'","搜尋時加上「for kids」或「easy」"],
  ["Watch or read ONE full guide BEFORE starting","開始前先「完整」看完一份教學"],
  ["Gather materials, then follow step by step","準備材料，然後一步一步跟著做"],
  ["First try fails? That IS learning — go again","第一次失敗？那就是學習——再來一次"],
  ["Teach it to Lucien when you can do it","學會後教Lucien"]],
 luis:[["Define the skill + your target ('draw a face that looks real')","定義技能＋你的目標（「畫出逼真的臉」）"],
  ["Find 2 tutorials, pick the clearer one","找2份教學，選比較清楚的那份"],
  ["Watch fully first, THEN do it along step by step","先看完，「再」跟著一步一步做"],
  ["Practice the hardest step 5 times on its own","把最難的那一步單獨練5次"],
  ["Compare your result with the tutorial — what's different?","比較你的成果和教學——差在哪裡？"],
  ["Log it: today's attempt, what to fix tomorrow","記錄：今天的嘗試、明天要改進什麼"]]},
askai:{icon:"🤖",title:"How to ask AI well",tz:"怎麼問AI才厲害",
 lucien:[["A grown-up sits with you — always","一定要有大人陪你"],
  ["Say what you want: 'a silly story about a digger'","說出你想要什麼：「一個挖土機的搞笑故事」"],
  ["If it's boring, ask again differently","不好玩的話，換個方式再問一次"],
  ["Remember: it's a robot, not a person 🤖","記住：它是機器人，不是真人 🤖"]],
 lili:[["Say exactly what you need + how: 'explain like I'm 7'","說清楚你要什麼＋怎麼說：「像對7歲小孩一樣解釋」"],
  ["Give details — the clearer the question, the better the answer","給細節——問題越清楚，答案越好"],
  ["Not helpful? Rephrase and try again","沒幫助？換個說法再試"],
  ["Ask it to QUIZ you — that's the best trick","請它「考」你——這是最棒的用法"],
  ["AI can be wrong! Check surprises with a grown-up","AI可能會錯！奇怪的答案要和大人確認"]],
 luis:[["Give context, task, and format: 'explain X, then quiz me with 5 questions'","給背景、任務和格式：「解釋X，然後出5題考我」"],
  ["Use it to LEARN, never to do your work for you","用它來「學習」，絕不是幫你做作業"],
  ["Always verify: ask for its reasoning, check one claim yourself","一定要驗證：請它說明理由，自己查證一個說法"],
  ["Catch its mistakes — spotting a wrong answer = you really understand","抓出它的錯——能發現錯誤＝你真的懂了"],
  ["End with: 'what should I learn next about this?'","結尾問它：「關於這個，我接下來該學什麼？」"]]},
};

const LEARN_BASE=1000;
const LEARN_KEYS=Object.keys(LEARN_GUIDES);
/* stable across releases: index within LEARN_KEYS, so only appending is safe */
function learnActIdx(key){
  const n=LEARN_KEYS.indexOf(key);
  return n<0?null:LEARN_BASE+n;
}
function learnGuideAt(actIdx){
  const key=LEARN_KEYS[actIdx-LEARN_BASE];
  return key?Object.assign({key:key},LEARN_GUIDES[key]):null;
}

if(typeof window!=="undefined"){
  window.LEARN_GUIDES=LEARN_GUIDES; window.LEARN_BASE=LEARN_BASE;
  window.LEARN_KEYS=LEARN_KEYS; window.learnActIdx=learnActIdx; window.learnGuideAt=learnGuideAt;
}
