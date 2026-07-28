/* Space Book data — card deck for the book reader.
   Reuses solar-data.js facts and images; adds extra cards for broader space topics.
   Format: each card = { id, emoji, nameEN, nameZH, photo, typeEN, typeZH, facts[{en,tz}] } */

var SPACE_CARDS = [
  {
    id: "sun", emoji: "☀️", nameEN: "Sun", nameZH: "太陽", photo: "../assets/solar/sun.jpg",
    typeEN: "STAR", typeZH: "恆星",
    facts: [
      { en: "The Sun is a star — a giant ball of hot gas.", tz: "太陽是一顆恆星，一團巨大的熱氣體。" },
      { en: "Eight planets travel around the Sun.", tz: "有八顆行星繞著太陽轉。" },
      { en: "The Sun is so big that one million Earths could fit inside!", tz: "太陽非常大，可以裝下一百萬個地球！" },
    ]
  },
  {
    id: "mercury", emoji: "☿️", nameEN: "Mercury", nameZH: "水星", photo: "../assets/solar/mercury.jpg",
    typeEN: "TERRESTRIAL PLANET", typeZH: "類地行星",
    facts: [
      { en: "Mercury is the closest planet to the Sun.", tz: "水星是離太陽最近的行星。" },
      { en: "One year on Mercury is only 88 days!", tz: "水星上的一年只有 88 天！" },
      { en: "Mercury has no moons.", tz: "水星沒有衛星。" },
    ]
  },
  {
    id: "venus", emoji: "♀️", nameEN: "Venus", nameZH: "金星", photo: "../assets/solar/venus.jpg",
    typeEN: "TERRESTRIAL PLANET", typeZH: "類地行星",
    facts: [
      { en: "Venus is the hottest planet.", tz: "金星是最熱的行星。" },
      { en: "Venus spins backwards compared to Earth.", tz: "金星的自轉方向和地球相反。" },
      { en: "Venus is the brightest planet in our night sky.", tz: "金星是夜空中最亮的行星。" },
    ]
  },
  {
    id: "earth", emoji: "🌍", nameEN: "Earth", nameZH: "地球", photo: "../assets/solar/earth.jpg",
    typeEN: "TERRESTRIAL PLANET", typeZH: "類地行星",
    facts: [
      { en: "Earth is our home — the only known planet with life.", tz: "地球是我們的家，是目前已知唯一有生命的行星。" },
      { en: "Most of Earth is covered by ocean.", tz: "地球表面大部分是海洋。" },
      { en: "Earth has one moon.", tz: "地球有一顆衛星。" },
    ]
  },
  {
    id: "mars", emoji: "♂️", nameEN: "Mars", nameZH: "火星", photo: "../assets/solar/mars.jpg",
    typeEN: "TERRESTRIAL PLANET", typeZH: "類地行星",
    facts: [
      { en: "Mars is called the red planet.", tz: "火星被稱為紅色星球。" },
      { en: "It has the tallest volcano in the solar system.", tz: "它有太陽系最高的火山。" },
      { en: "Mars has two tiny moons.", tz: "火星有兩顆小衛星。" },
    ]
  },
  {
    id: "jupiter", emoji: "♃", nameEN: "Jupiter", nameZH: "木星", photo: "../assets/solar/jupiter.jpg",
    typeEN: "GAS GIANT", typeZH: "氣態巨行星",
    facts: [
      { en: "Jupiter is the biggest planet.", tz: "木星是最大的行星。" },
      { en: "Its Great Red Spot is a storm bigger than Earth!", tz: "它的大紅斑是一場比地球還大的風暴！" },
      { en: "Jupiter has 101 known moons — more than any other planet!", tz: "木星有 101 顆已知的衛星——比任何其他行星都多！" },
    ]
  },
  {
    id: "saturn", emoji: "♄", nameEN: "Saturn", nameZH: "土星", photo: "../assets/solar/saturn.jpg",
    typeEN: "GAS GIANT", typeZH: "氣態巨行星",
    facts: [
      { en: "Saturn's rings are made of ice and rock.", tz: "土星環是由冰和岩石組成的。" },
      { en: "Saturn is so light it could float on water!", tz: "土星非常輕，輕到可以浮在水上！" },
      { en: "Saturn has 274 confirmed moons — the most in the solar system!", tz: "土星有 274 顆已確認的衛星——太陽系最多！" },
    ]
  },
  {
    id: "uranus", emoji: "⛢", nameEN: "Uranus", nameZH: "天王星", photo: "../assets/solar/uranus.jpg",
    typeEN: "ICE GIANT", typeZH: "冰巨行星",
    facts: [
      { en: "Uranus spins on its side like a rolling ball.", tz: "天王星像滾動的球一樣側躺著自轉。" },
      { en: "It is the coldest planet.", tz: "它是最冷的行星。" },
      { en: "It looks blue-green because of its gas.", tz: "因為氣體的關係，它看起來是藍綠色的。" },
    ]
  },
  {
    id: "neptune", emoji: "♆", nameEN: "Neptune", nameZH: "海王星", photo: "../assets/solar/neptune.jpg",
    typeEN: "ICE GIANT", typeZH: "冰巨行星",
    facts: [
      { en: "Neptune is the farthest planet from the Sun.", tz: "海王星是離太陽最遠的行星。" },
      { en: "It has the fastest winds in the solar system.", tz: "它有太陽系最快的風。" },
      { en: "One year on Neptune is 165 Earth years!", tz: "海王星上的一年等於地球的 165 年！" },
    ]
  },
  {
    id: "pluto", emoji: "♇", nameEN: "Pluto", nameZH: "冥王星", photo: "../assets/solar/pluto.jpg",
    typeEN: "DWARF PLANET", typeZH: "矮行星",
    facts: [
      { en: "Pluto was once the ninth planet.", tz: "冥王星曾經是第九大行星。" },
      { en: "It takes 248 Earth years to orbit the Sun!", tz: "它繞太陽一圈需要 248 個地球年！" },
      { en: "Pluto has a giant heart-shaped region on its surface.", tz: "冥王星表面有一個巨大的心形區域。" },
    ]
  },
  {
    id: "moon", emoji: "🌙", nameEN: "Moon", nameZH: "月球", photo: "../assets/solar/moon.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "The Moon orbits Earth about once every 27 days.", tz: "月球大約每 27 天繞地球一圈。" },
      { en: "Astronauts first walked on the Moon in 1969!", tz: "太空人在 1969 年第一次登上月球！" },
      { en: "The Moon is about one-quarter the size of Earth.", tz: "月球大約是地球的四分之一大小。" },
    ]
  },
  {
    id: "iss", emoji: "🛰️", nameEN: "ISS", nameZH: "國際太空站", photo: "../assets/solar/iss.jpg",
    typeEN: "SPACE STATION", typeZH: "太空站",
    facts: [
      { en: "The ISS orbits Earth every 92 minutes!", tz: "國際太空站每 92 分鐘繞地球一圈！" },
      { en: "Astronauts from many countries live and work on the ISS.", tz: "來自許多國家的太空人在國際太空站上生活和工作。" },
      { en: "The ISS is the largest human-made object in space.", tz: "國際太空站是太空中最大的人造物體。" },
    ]
  },
  {
    id: "milkyway", emoji: "🌌", nameEN: "Milky Way", nameZH: "銀河系", photo: "../assets/solar/milkyway.jpg",
    typeEN: "SPIRAL GALAXY", typeZH: "螺旋星系",
    facts: [
      { en: "The Milky Way is over 100,000 light-years across!", tz: "銀河系的直徑超過 10 萬光年！" },
      { en: "There is a supermassive black hole at the centre.", tz: "銀河系中心有一個超大質量黑洞。" },
      { en: "Our Sun takes 230 million years to orbit the galaxy!", tz: "我們的太陽繞銀河系一圈需要 2.3 億年！" },
    ]
  },
  {
    id: "io", emoji: "🌋", nameEN: "Io", nameZH: "木衛一", photo: "../assets/solar/io.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Io has over 400 active volcanoes!", tz: "木衛一有超過 400 座活火山！" },
      { en: "It is the most volcanic body in the solar system.", tz: "它是太陽系中火山活動最活躍的天體。" },
      { en: "Io orbits Jupiter in less than 2 days.", tz: "木衛一不到 2 天就繞木星一圈。" },
    ]
  },
  {
    id: "europa", emoji: "🧊", nameEN: "Europa", nameZH: "木衛二", photo: "../assets/solar/europa.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Europa has a hidden ocean under its icy crust.", tz: "木衛二的冰殼下面隱藏著一片海洋。" },
      { en: "It may have twice as much water as Earth!", tz: "它的水量可能是地球的兩倍！" },
      { en: "Europa is one of the best places to look for alien life.", tz: "木衛二是尋找外星生命最好的地方之一。" },
    ]
  },
  {
    id: "ganymede", emoji: "🪐", nameEN: "Ganymede", nameZH: "木衛三", photo: "../assets/solar/ganymede.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Ganymede is the biggest moon in the solar system.", tz: "木衛三是太陽系中最大的衛星。" },
      { en: "It is larger than the planet Mercury!", tz: "它比水星這顆行星還要大！" },
      { en: "It is the only moon with its own magnetic field.", tz: "它是唯一擁有自己磁場的衛星。" },
    ]
  },
  {
    id: "callisto", emoji: "🌑", nameEN: "Callisto", nameZH: "木衛四", photo: "../assets/solar/callisto.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Callisto has the oldest surface in the solar system.", tz: "木衛四擁有太陽系中最古老的表面。" },
      { en: "It is almost the same size as Mercury.", tz: "它的大小幾乎和水星一樣。" },
      { en: "Callisto may also hide an ocean under its surface!", tz: "木衛四表面下也可能隱藏著一片海洋！" },
    ]
  },
  {
    id: "titan", emoji: "🌫️", nameEN: "Titan", nameZH: "土衛六", photo: "../assets/solar/titan.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Titan is the only moon with a thick atmosphere.", tz: "土衛六是唯一擁有濃厚大氣層的衛星。" },
      { en: "It has rivers and lakes — but made of methane!", tz: "它有河流和湖泊——但是由甲烷構成的！" },
      { en: "A space probe landed on Titan in 2005.", tz: "2005 年有一個太空探測器降落在土衛六上。" },
    ]
  },
  {
    id: "triton", emoji: "❄️", nameEN: "Triton", nameZH: "海衛一", photo: "../assets/solar/triton.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Triton is one of the coldest places in the solar system.", tz: "海衛一是太陽系中最寒冷的地方之一。" },
      { en: "It orbits Neptune backwards!", tz: "它以相反的方向繞著海王星轉！" },
      { en: "Triton has icy volcanoes that erupt nitrogen gas.", tz: "海衛一有噴發氮氣的冰火山。" },
    ]
  },
  {
    id: "deimos", emoji: "🪨", nameEN: "Deimos", nameZH: "火衛二", photo: "../assets/solar/deimos.jpg",
    typeEN: "NATURAL SATELLITE", typeZH: "天然衛星",
    facts: [
      { en: "Deimos is one of the smallest moons in the solar system.", tz: "火衛二是太陽系中最小的衛星之一。" },
      { en: "It is slowly drifting away from Mars.", tz: "它正在慢慢地遠離火星。" },
      { en: "Deimos means 'dread' in ancient Greek.", tz: "火衛二在古希臘語中的意思是「恐怖」。" },
    ]
  },
  {
    id: "alphacentauri", emoji: "⭐", nameEN: "Alpha Centauri", nameZH: "半人馬座α", photo: "../assets/solar/alphacentauri.jpg",
    typeEN: "STAR SYSTEM", typeZH: "恆星系",
    facts: [
      { en: "It is the nearest star system to Earth.", tz: "它是離地球最近的恆星系。" },
      { en: "Light from Alpha Centauri takes 4.37 years to reach us.", tz: "半人馬座α的光需要 4.37 年才能到達我們。" },
      { en: "Proxima Centauri has a planet in its habitable zone!", tz: "比鄰星有一顆位於適居帶的行星！" },
    ]
  },
  {
    id: "sirius", emoji: "🌟", nameEN: "Sirius", nameZH: "天狼星", photo: "../assets/solar/sirius.jpg",
    typeEN: "STAR SYSTEM", typeZH: "恆星系",
    facts: [
      { en: "Sirius is the brightest star visible from Earth.", tz: "天狼星是從地球看到最亮的恆星。" },
      { en: "It is about twice as massive as our Sun.", tz: "它的質量大約是太陽的兩倍。" },
      { en: "Ancient Egyptians used Sirius to predict the Nile flood.", tz: "古埃及人用天狼星來預測尼羅河的洪水。" },
    ]
  },
  {
    id: "barnardstar", emoji: "✨", nameEN: "Barnard's Star", nameZH: "巴納德星", photo: "../assets/solar/barnardstar.jpg",
    typeEN: "RED DWARF", typeZH: "紅矮星",
    facts: [
      { en: "It is a red dwarf — the most common type of star.", tz: "它是一顆紅矮星——最常見的恆星類型。" },
      { en: "It moves very fast across our night sky.", tz: "它在夜空中移動得非常快。" },
      { en: "Barnard's Star is much older than our Sun.", tz: "巴納德星比我們的太陽古老得多。" },
    ]
  }
];
