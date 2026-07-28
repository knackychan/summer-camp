/* Race Cars Book data — card deck for the book reader.
   Each card = { id, emoji, nameEN, nameZH, photo, typeEN, typeZH, group, facts[{en,tz}] }
   PHOTO PLACEHOLDERS: all images need to be scraped from Wikimedia Commons / public domain sources.
   See assets/books/race-cars/README.md for the scrape list. */

var RACE_CARS = [
  /* ── RACE TYPES ── */
  {
    id: "formula-car", emoji: "🏎️", nameEN: "Formula Car", nameZH: "方程式賽車", photo: "../assets/books/race-cars/formula-car.jpg",
    typeEN: "RACE CAR", typeZH: "賽車", group: "race-types",
    facts: [
      { en: "Formula cars are the fastest racing cars with open wheels.", tz: "方程式賽車是有外露車輪的最快賽車。" },
      { en: "They are built very low to the ground for speed and grip.", tz: "它們的車身建得很低，以獲得速度和抓地力。" },
      { en: "A Formula car can go from 0 to 100 km/h in less than 2.5 seconds.", tz: "方程式賽車在不到2.5秒內就能從0加速到時速100公里。" },
    ]
  },
  {
    id: "rally-car", emoji: "🚗", nameEN: "Rally Car", nameZH: "拉力賽車", photo: "../assets/books/race-cars/rally-car.jpg",
    typeEN: "RACE CAR", typeZH: "賽車", group: "race-types",
    facts: [
      { en: "Rally cars race on real roads — dirt, snow, gravel, and tarmac.", tz: "拉力賽車在真正的道路上比賽——泥土、雪地、碎石和柏油路。" },
      { en: "Each rally car has a co-driver who reads pace notes to navigate.", tz: "每輛拉力賽車都有一位領航員，他會讀速度筆記來導航。" },
      { en: "Rally cars have strong suspension to handle very rough roads.", tz: "拉力賽車有強壯的懸掛系統來應對非常崎嶇的道路。" },
    ]
  },
  {
    id: "kart", emoji: "🛒", nameEN: "Go-Kart", nameZH: "卡丁車", photo: "../assets/books/race-cars/kart.jpg",
    typeEN: "RACE CAR", typeZH: "賽車", group: "race-types",
    facts: [
      { en: "Go-karts are small open-wheel racing vehicles — kids can drive them too.", tz: "卡丁車是小型外露車輪賽車——小朋友也可以開。" },
      { en: "Many Formula drivers started by racing go-karts as children.", tz: "許多方程式賽車手小時候都是從開卡丁車開始的。" },
      { en: "A go-kart sits so low to the ground that it feels twice as fast.", tz: "卡丁車坐得離地面非常近，感覺速度是實際的兩倍。" },
    ]
  },
  /* ── PARTS ── */
  {
    id: "tyre", emoji: "🛞", nameEN: "Racing Tyre", nameZH: "賽車輪胎", photo: "../assets/books/race-cars/tyre.jpg",
    typeEN: "CAR PART", typeZH: "汽車零件", group: "parts",
    facts: [
      { en: "Racing tyres are made of soft rubber for extra grip.", tz: "賽車輪胎由軟橡膠製成，提供額外的抓地力。" },
      { en: "Slick tyres have no tread — smooth tyres grip dry roads best.", tz: "光頭胎沒有花紋——光滑的輪胎在乾燥路面上抓地力最好。" },
      { en: "A Formula pit crew can change all 4 tyres in under 2 seconds.", tz: "方程式賽車的換胎團隊可以在不到2秒內換完4條輪胎。" },
    ]
  },
  {
    id: "wing", emoji: "🪶", nameEN: "Rear Wing", nameZH: "尾翼", photo: "../assets/books/race-cars/wing.jpg",
    typeEN: "CAR PART", typeZH: "汽車零件", group: "parts",
    facts: [
      { en: "A rear wing pushes the car down onto the road for better grip.", tz: "尾翼將賽車壓在路面上以獲得更好的抓地力。" },
      { en: "This downforce is like having a giant invisible hand push the car down.", tz: "這種下壓力就像有一隻無形的大手將車子往下壓。" },
      { en: "Most race car wings work backwards from aeroplane wings — pushing down, not up.", tz: "大多數賽車尾翼和飛機機翼的工作方式相反——往下壓，而不是往上抬。" },
    ]
  },
  {
    id: "engine", emoji: "🔧", nameEN: "Racing Engine", nameZH: "賽車引擎", photo: "../assets/books/race-cars/engine.jpg",
    typeEN: "CAR PART", typeZH: "汽車零件", group: "parts",
    facts: [
      { en: "A Formula engine can spin at over 15,000 revolutions per minute.", tz: "方程式引擎每分鐘可以轉超過15000轉。" },
      { en: "Racing engines are much smaller than road car engines but much more powerful.", tz: "賽車引擎比普通車引擎小得多，但功率卻大得多。" },
      { en: "A racing engine generates so much heat that it glows red.", tz: "賽車引擎產生的熱量非常高，會發出紅光。" },
    ]
  },
  {
    id: "brakes", emoji: "🛑", nameEN: "Racing Brakes", nameZH: "賽車煞車", photo: "../assets/books/race-cars/brakes.jpg",
    typeEN: "CAR PART", typeZH: "汽車零件", group: "parts",
    facts: [
      { en: "Racing brakes can glow orange-hot from all the friction.", tz: "賽車煞車會因為摩擦而發出橙色的熱光。" },
      { en: "A Formula car can stop from 300 km/h to zero in about 4 seconds.", tz: "方程式賽車可以在約4秒內從時速300公里減速到零。" },
      { en: "Racing brakes are made of carbon-ceramic material for extreme heat resistance.", tz: "賽車煞車由碳陶瓷材料製成，具有極高的耐熱性。" },
    ]
  },
  /* ── TRACKS ── */
  {
    id: "pitstop", emoji: "⛽", nameEN: "Pit Stop", nameZH: "維修站", photo: "../assets/books/race-cars/pitstop.jpg",
    typeEN: "TRACK", typeZH: "賽道", group: "tracks",
    facts: [
      { en: "A Formula pit crew has about 20 people — each with one specific job.", tz: "方程式賽車的維修團隊大約有20人——每人有一個特定的工作。" },
      { en: "The fastest pit stop ever recorded was under 1.9 seconds.", tz: "有記錄以來最快的維修站停站時間不到1.9秒。" },
      { en: "Pit stops were invented because early cars needed to refuel during long races.", tz: "發明維修站是因為早期的賽車在長距離比賽中需要加油。" },
    ]
  },
  {
    id: "starting-grid", emoji: "🏁", nameEN: "Starting Grid", nameZH: "起跑線", photo: "../assets/books/race-cars/starting-grid.jpg",
    typeEN: "TRACK", typeZH: "賽道", group: "tracks",
    facts: [
      { en: "Cars line up on the grid in the order they qualified — the fastest car at the front.", tz: "賽車按照排位賽的順序在起跑線上排隊——最快的車排在最前面。" },
      { en: "The starting lights go red, then all turn green at once for the race to begin.", tz: "起跑燈變紅，然後全部同時變綠，比賽就開始了。" },
      { en: "The race is started with lights because engines are too loud for a whistle.", tz: "比賽用燈號開始，因為引擎聲太大，哨子聽不到。" },
    ]
  },
  /* ── SAFETY ── */
  {
    id: "helmet", emoji: "🪖", nameEN: "Racing Helmet", nameZH: "賽車頭盔", photo: "../assets/books/race-cars/helmet.jpg",
    typeEN: "SAFETY", typeZH: "安全裝備", group: "safety",
    facts: [
      { en: "Racing helmets are made of layers of strong materials to protect the driver.", tz: "賽車頭盔由層層堅固材料製成，以保護車手。" },
      { en: "Every driver has their own unique helmet design and colours.", tz: "每位車手都有自己獨特的頭盔設計和顏色。" },
      { en: "Helmets are tested against fire and impacts of up to 300 km/h.", tz: "頭盔經過測試，能抵擋火焰和時速高達300公里的衝擊。" },
    ]
  },
  {
    id: "roll-cage", emoji: "⚙️", nameEN: "Roll Cage", nameZH: "防滾架", photo: "../assets/books/race-cars/roll-cage.jpg",
    typeEN: "SAFETY", typeZH: "安全裝備", group: "safety",
    facts: [
      { en: "A roll cage is a cage of strong metal tubes inside the car.", tz: "防滾架是車內一個由堅固金屬管構成的籠子。" },
      { en: "It protects the driver if the car rolls over during a race.", tz: "如果賽車在比賽中翻滾，它可以保護車手。" },
      { en: "Every racing car must have a roll cage that meets strict safety rules.", tz: "每輛賽車都必須有符合嚴格安全規則的防滾架。" },
    ]
  },
  {
    id: "firesuit", emoji: "🧯", nameEN: "Fire Suit", nameZH: "防火賽車服", photo: "../assets/books/race-cars/firesuit.jpg",
    typeEN: "SAFETY", typeZH: "安全裝備", group: "safety",
    facts: [
      { en: "A fire suit is made of special material that resists fire for several seconds.", tz: "防火賽車服由特殊材料製成，可以抵抗火焰幾秒鐘。" },
      { en: "These suits give a driver time to escape if a car catches fire.", tz: "這種賽車服讓車手在車子著火時有時間逃脫。" },
      { en: "Drivers also wear fireproof gloves, shoes, and even underwear.", tz: "車手還會穿防火手套、鞋，甚至是內衣。" },
    ]
  },
  /* ── MORE ── */
  {
    id: "checkeredflag", emoji: "🏁", nameEN: "Checkered Flag", nameZH: "方格旗", photo: "../assets/books/race-cars/checkeredflag.jpg",
    typeEN: "TRACK", typeZH: "賽道", group: "tracks",
    facts: [
      { en: "The checkered black-and-white flag means a race has finished.", tz: "黑白方格旗表示比賽結束了。" },
      { en: "The first winner to receive a checkered flag was in 1906.", tz: "第一位收到方格旗的冠軍是在1906年。" },
      { en: "Waving two checkered flags means the race is officially over.", tz: "揮舞兩面方格旗表示比賽正式結束。" },
    ]
  },
];
