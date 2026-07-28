/* Public Vehicles Book data — card deck for the book reader.
   Each card = { id, emoji, nameEN, nameZH, photo, typeEN, typeZH, group, facts[{en,tz}] }
   PHOTO PLACEHOLDERS: all images need to be scraped from Wikimedia Commons / public domain sources.
   See assets/books/public-vehicles/README.md for the scrape list. */

var PUBLIC_VEHICLES_CARDS = [
  /* ── EMERGENCY ── */
  {
    id: "ambulance", emoji: "🚑", nameEN: "Ambulance", nameZH: "救護車", photo: "../assets/books/public-vehicles/ambulance.jpg",
    typeEN: "EMERGENCY", typeZH: "緊急車輛", group: "emergency",
    facts: [
      { en: "An ambulance is a hospital on wheels — it carries life-saving equipment.", tz: "救護車是一個有輪子的醫院——它載有救命的設備。" },
      { en: "Ambulance workers are trained to help people on the way to the hospital.", tz: "救護人員受過訓練，在去醫院的路上幫助病患。" },
      { en: "The siren and flashing lights tell other drivers to make way.", tz: "警笛和閃燈告訴其他駕駛讓路。" },
    ]
  },
  {
    id: "firetruck", emoji: "🚒", nameEN: "Fire Truck", nameZH: "消防車", photo: "../assets/books/public-vehicles/firetruck.jpg",
    typeEN: "EMERGENCY", typeZH: "緊急車輛", group: "emergency",
    facts: [
      { en: "A fire truck carries a water tank, hoses, and a tall ladder.", tz: "消防車載有水槽、水管和長梯子。" },
      { en: "The tallest fire truck ladders can reach 40 metres — about 10 floors.", tz: "最高的消防車梯子可以伸到40米——大約10層樓高。" },
      { en: "Modern fire trucks also carry tools to rescue people trapped in cars.", tz: "現代消防車還配備了營救困在車內人員的工具。" },
    ]
  },
  {
    id: "policecar", emoji: "🚔", nameEN: "Police Car", nameZH: "警車", photo: "../assets/books/public-vehicles/policecar.jpg",
    typeEN: "EMERGENCY", typeZH: "緊急車輛", group: "emergency",
    facts: [
      { en: "Police cars have special lights and sirens to clear the road during emergencies.", tz: "警車有特殊的燈和警笛，在緊急情況下清除道路。" },
      { en: "A police officer in a car can talk to the station and other officers by radio.", tz: "警車裡的警察可以通過無線電和局裡及其他警察通話。" },
      { en: "Some police cars have cameras that can read number plates automatically.", tz: "有些警車配有能自動讀取車牌的攝影機。" },
    ]
  },
  /* ── TRANSIT ── */
  {
    id: "bus", emoji: "🚌", nameEN: "City Bus", nameZH: "公車", photo: "../assets/books/public-vehicles/bus.jpg",
    typeEN: "TRANSIT", typeZH: "公共運輸", group: "transit",
    facts: [
      { en: "A city bus can carry over 70 people at once — that's like 50 cars off the road.", tz: "一輛公車可以一次載超過70人——相當於路上少了50輛車。" },
      { en: "Many buses now run on electricity or clean fuels to reduce pollution.", tz: "許多公車現在使用電力或清潔燃料來減少污染。" },
      { en: "The first city bus service started in Paris in 1662.", tz: "最早的城市公車服務於1662年在巴黎開始。" },
    ]
  },
  {
    id: "train", emoji: "🚆", nameEN: "Train", nameZH: "火車", photo: "../assets/books/public-vehicles/train.jpg",
    typeEN: "TRANSIT", typeZH: "公共運輸", group: "transit",
    facts: [
      { en: "Trains run on metal tracks — steel wheels on steel rails create very little friction.", tz: "火車在金屬軌道上行駛——鋼輪在鋼軌上產生的摩擦力非常小。" },
      { en: "Some high-speed trains travel faster than 350 km/h.", tz: "有些高速列車的行駛速度超過每小時350公里。" },
      { en: "The world's longest train was over 7 kilometres long.", tz: "世界上最長的火車超過7公里長。" },
    ]
  },
  {
    id: "tram", emoji: "🚋", nameEN: "Tram", nameZH: "輕軌", photo: "../assets/books/public-vehicles/tram.jpg",
    typeEN: "TRANSIT", typeZH: "公共運輸", group: "transit",
    facts: [
      { en: "Trams run on rails in city streets, sharing the road with cars.", tz: "輕軌在城市街道的軌道上行駛，與汽車共用道路。" },
      { en: "Trams are powered by electricity from overhead wires.", tz: "輕軌使用架空電線提供的電力。" },
      { en: "Trams are very good for cities because they don't create air pollution.", tz: "輕軌對城市非常有益，因為它們不會造成空氣污染。" },
    ]
  },
  /* ── SERVICE ── */
  {
    id: "garbagetruck", emoji: "🚛", nameEN: "Garbage Truck", nameZH: "垃圾車", photo: "../assets/books/public-vehicles/garbagetruck.jpg",
    typeEN: "SERVICE", typeZH: "服務車輛", group: "service",
    facts: [
      { en: "A garbage truck can lift heavy bins and tip them into its hopper.", tz: "垃圾車可以舉起重垃圾桶，把它們倒進收集斗。" },
      { en: "Some garbage trucks can compact the trash so it takes up much less space.", tz: "有些垃圾車可以壓縮垃圾，讓它佔用的空間小得多。" },
      { en: "A garbage truck collects waste from hundreds of homes in a single day.", tz: "一輛垃圾車一天內可以收集數百個家庭的垃圾。" },
    ]
  },
  {
    id: "mailtruck", emoji: "📬", nameEN: "Mail Truck", nameZH: "郵務車", photo: "../assets/books/public-vehicles/mailtruck.jpg",
    typeEN: "SERVICE", typeZH: "服務車輛", group: "service",
    facts: [
      { en: "Mail trucks deliver letters and packages to homes and businesses.", tz: "郵務車將信件和包裹送達家庭和企業。" },
      { en: "Some mail trucks are electric and make no engine noise.", tz: "有些郵務車是電動的，沒有引擎聲音。" },
      { en: "The biggest mail sorting centre can process over a million letters per day.", tz: "最大的郵件處理中心每天可以處理超過一百萬封信件。" },
    ]
  },
  /* ── CITY ── */
  {
    id: "streetsweeper", emoji: "🧹", nameEN: "Street Sweeper", nameZH: "掃街車", photo: "../assets/books/public-vehicles/streetsweeper.jpg",
    typeEN: "CITY", typeZH: "城市車輛", group: "city",
    facts: [
      { en: "A street sweeper has big rotating brushes underneath to clean roads.", tz: "掃街車底部有大型旋轉刷子來清潔道路。" },
      { en: "It can clean up leaves, litter, and even small stones from the street.", tz: "它可以清理街道上的樹葉、垃圾，甚至小石頭。" },
      { en: "One street sweeper can clean more road in one hour than 20 people with brooms.", tz: "一輛掃街車一小時清掃的道路比20個人用掃把還多。" },
    ]
  },
  {
    id: "towtruck", emoji: "🪝", nameEN: "Tow Truck", nameZH: "拖吊車", photo: "../assets/books/public-vehicles/towtruck.jpg",
    typeEN: "CITY", typeZH: "城市車輛", group: "city",
    facts: [
      { en: "A tow truck can lift and carry broken-down cars to a garage.", tz: "拖吊車可以舉起並運送故障車輛到修車廠。" },
      { en: "Most tow trucks use a strong hook and chain or a flat bed.", tz: "大多數拖吊車使用強力的鉤子和鏈條或平台板。" },
      { en: "Tow trucks help keep roads safe by clearing broken vehicles quickly.", tz: "拖吊車幫助迅速清理故障車輛，保持道路安全。" },
    ]
  },
  {
    id: "schoolbus", emoji: "🚌", nameEN: "School Bus", nameZH: "校車", photo: "../assets/books/public-vehicles/schoolbus.jpg",
    typeEN: "CITY", typeZH: "城市車輛", group: "city",
    facts: [
      { en: "School buses are painted bright yellow so they are easy for everyone to see.", tz: "校車被塗成亮黃色，讓所有人都能清楚地看到。" },
      { en: "School buses have flashing lights and a STOP sign to protect children boarding.", tz: "校車有閃爍燈光和停車標誌，保護正在上下車的孩子們。" },
      { en: "A school bus can carry about 45 children to school every day.", tz: "一輛校車每天可以載大約45名兒童上學。" },
    ]
  },
  {
    id: "taxi", emoji: "🚕", nameEN: "Taxi", nameZH: "計程車", photo: "../assets/books/public-vehicles/taxi.jpg",
    typeEN: "TRANSIT", typeZH: "公共運輸", group: "transit",
    facts: [
      { en: "Taxis are cars that you can hire to take you directly to your destination.", tz: "計程車是可以租用、直接帶你到目的地的汽車。" },
      { en: "The first taxi with a meter was introduced in 1897.", tz: "第一輛有計費表的計程車是在1897年推出的。" },
      { en: "In many cities, taxis must pass a special test to show they know all the streets.", tz: "在許多城市，計程車司機必須通過特殊測試，證明他們認識所有街道。" },
    ]
  },
  {
    id: "helicopter", emoji: "🚁", nameEN: "Rescue Helicopter", nameZH: "救援直升機", photo: "../assets/books/public-vehicles/helicopter.jpg",
    typeEN: "EMERGENCY", typeZH: "緊急車輛", group: "emergency",
    facts: [
      { en: "A rescue helicopter can reach places no ambulance or fire truck can reach.", tz: "救援直升機可以到達救護車或消防車無法到達的地方。" },
      { en: "It can lift people from the top of a building, a mountain, or even the sea.", tz: "它可以從建築物頂部、山上，甚至海裡把人吊起來。" },
      { en: "Rescue helicopters often have a winch — a motorised rope to lift people up.", tz: "救援直升機通常配有絞盤——一個用來把人拉上來的電動繩索。" },
    ]
  },
];
