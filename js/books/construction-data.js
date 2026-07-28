/* Construction Book data — card deck for the book reader.
   Each card = { id, emoji, nameEN, nameZH, photo, typeEN, typeZH, group, facts[{en,tz}] }
   PHOTO PLACEHOLDERS: all images need to be scraped from Wikimedia Commons / public domain sources.
   See assets/books/construction/README.md for the scrape list. */

var CONSTRUCTION_CARDS = [
  /* ── EARTH MOVING ── */
  {
    id: "excavator", emoji: "🦾", nameEN: "Excavator", nameZH: "挖土機", photo: "../assets/books/construction/excavator.jpg",
    typeEN: "EARTH MOVER", typeZH: "移土機", group: "earthmoving",
    facts: [
      { en: "An excavator uses a big bucket arm to dig holes and trenches.", tz: "挖土機用一個大鏟斗臂來挖掘坑洞和溝槽。" },
      { en: "The longest excavator arm can reach over 30 metres.", tz: "最長的挖土機臂可以延伸到30米以上。" },
      { en: "Excavators can rotate 360 degrees on their tracks.", tz: "挖土機可以在履帶上旋轉360度。" },
    ]
  },
  {
    id: "bulldozer", emoji: "🚜", nameEN: "Bulldozer", nameZH: "推土機", photo: "../assets/books/construction/bulldozer.jpg",
    typeEN: "EARTH MOVER", typeZH: "移土機", group: "earthmoving",
    facts: [
      { en: "A bulldozer pushes large amounts of soil, sand, and rock with its blade.", tz: "推土機用刀片推大量的土壤、沙子和岩石。" },
      { en: "Bulldozers run on wide tracks so they don't sink in soft ground.", tz: "推土機使用寬履帶，這樣就不會陷入軟地裡。" },
      { en: "The first bulldozer was made by adding a blade to a farm tractor.", tz: "第一台推土機是把一個刀片裝到農用拖拉機上製成的。" },
    ]
  },
  {
    id: "loader", emoji: "🪣", nameEN: "Wheel Loader", nameZH: "鏟裝機", photo: "../assets/books/construction/loader.jpg",
    typeEN: "EARTH MOVER", typeZH: "移土機", group: "earthmoving",
    facts: [
      { en: "A wheel loader scoops up material and loads it into a truck.", tz: "鏟裝機鏟起物料並將其裝進卡車。" },
      { en: "The bucket of a big loader can hold as much as 10 bathtubs of dirt.", tz: "大型鏟裝機的鏟斗可以裝下10個浴缸的泥土。" },
      { en: "Loaders have big wheels instead of tracks so they can move faster.", tz: "鏟裝機有大輪子而不是履帶，這樣可以移動得更快。" },
    ]
  },
  {
    id: "dumptruck", emoji: "🛻", nameEN: "Dump Truck", nameZH: "砂石車", photo: "../assets/books/construction/dumptruck.jpg",
    typeEN: "EARTH MOVER", typeZH: "移土機", group: "earthmoving",
    facts: [
      { en: "A dump truck carries loose material like sand, gravel, or demolition waste.", tz: "砂石車運載鬆散的材料，如沙子、碎石或拆遷廢料。" },
      { en: "The largest dump truck can carry over 400 tonnes — as much as 200 cars.", tz: "最大的砂石車可以運載超過400噸——相當於200輛車。" },
      { en: "The open bed tips up using hydraulic power to dump everything out.", tz: "開放式車斗利用液壓動力傾斜，把東西倒出來。" },
    ]
  },
  /* ── LIFTING ── */
  {
    id: "crane", emoji: "🏗️", nameEN: "Tower Crane", nameZH: "塔式起重機", photo: "../assets/books/construction/crane.jpg",
    typeEN: "LIFTING", typeZH: "起重", group: "lifting",
    facts: [
      { en: "Tower cranes lift heavy materials to the top of tall buildings.", tz: "塔式起重機將重物料吊到高樓的頂部。" },
      { en: "The tallest cranes can reach over 200 metres high.", tz: "最高的起重機可以達到200米以上。" },
      { en: "The crane operator sits in a cab at the very top of the crane.", tz: "起重機操作員坐在起重機最頂部的駕駛室裡。" },
    ]
  },
  {
    id: "forklift", emoji: "📦", nameEN: "Forklift", nameZH: "堆高機", photo: "../assets/books/construction/forklift.jpg",
    typeEN: "LIFTING", typeZH: "起重", group: "lifting",
    facts: [
      { en: "A forklift has two metal forks at the front to lift and move heavy pallets.", tz: "堆高機前面有兩根金屬叉子來舉起和移動重棧板。" },
      { en: "Forklifts can lift things weighing several tonnes — like a small elephant.", tz: "堆高機可以舉起重達幾噸的東西——就像一頭小象。" },
      { en: "Forklifts are used in warehouses, construction sites, and even on farms.", tz: "堆高機用於倉庫、建築工地，甚至農場。" },
    ]
  },
  /* ── BUILDING ── */
  {
    id: "cementmixer", emoji: "🚛", nameEN: "Cement Mixer", nameZH: "水泥車", photo: "../assets/books/construction/cementmixer.jpg",
    typeEN: "BUILDING", typeZH: "建築", group: "building",
    facts: [
      { en: "A cement mixer spins a big drum to keep concrete from hardening.", tz: "水泥車轉動一個大滾筒來防止混凝土硬化。" },
      { en: "If the mixing drum stops spinning, the concrete sets — and that's a big problem.", tz: "如果攪拌滾筒停止轉動，混凝土就會凝固——那會是個大問題。" },
      { en: "Concrete is the most used building material in the world after water.", tz: "混凝土是僅次於水的世界上使用最多的建築材料。" },
    ]
  },
  {
    id: "compactor", emoji: "📐", nameEN: "Road Roller", nameZH: "壓路機", photo: "../assets/books/construction/compactor.jpg",
    typeEN: "BUILDING", typeZH: "建築", group: "building",
    facts: [
      { en: "A road roller has a heavy cylinder that flattens and compacts the ground.", tz: "壓路機有一個沉重的滾筒來壓平和壓實地面。" },
      { en: "Some rollers vibrate to push the material even flatter.", tz: "有些壓路機會震動，把材料壓得更平。" },
      { en: "Road rollers make the ground so strong that cars and trucks can safely drive on it.", tz: "壓路機把地面壓得很堅固，讓汽車和卡車可以安全地行駛。" },
    ]
  },
  {
    id: "scaffolding", emoji: "🪜", nameEN: "Scaffolding", nameZH: "鷹架", photo: "../assets/books/construction/scaffolding.jpg",
    typeEN: "TOOLS", typeZH: "工具", group: "tools",
    facts: [
      { en: "Scaffolding is a temporary structure to help workers reach high places safely.", tz: "鷹架是一種臨時結構，幫助工人安全地到達高處。" },
      { en: "Some scaffolding can go higher than a 100-floor building.", tz: "有些鷹架可以建得比一百層樓還高。" },
      { en: "Modern scaffolding is made of metal tubes that lock together like a giant puzzle.", tz: "現代鷹架由金屬管製成，像一個巨大的拼圖一樣鎖在一起。" },
    ]
  },
  {
    id: "jackhammer", emoji: "🔨", nameEN: "Jackhammer", nameZH: "電鑽鎚", photo: "../assets/books/construction/jackhammer.jpg",
    typeEN: "TOOLS", typeZH: "工具", group: "tools",
    facts: [
      { en: "A jackhammer uses rapid pounding to break up concrete and rock.", tz: "電鑽鎚用快速撞擊來粉碎混凝土和岩石。" },
      { en: "A jackhammer can punch the ground 1,500 times per minute.", tz: "電鑽鎚每分鐘可以敲擊地面1500次。" },
      { en: "Workers wear special gloves because jackhammers vibrate very strongly.", tz: "工人會戴特殊手套，因為電鑽鎚震動非常強。" },
    ]
  },
  /* ── MORE ── */
  {
    id: "grader", emoji: "🛤️", nameEN: "Motor Grader", nameZH: "平路機", photo: "../assets/books/construction/grader.jpg",
    typeEN: "EARTH MOVER", typeZH: "移土機", group: "earthmoving",
    facts: [
      { en: "A motor grader has a long blade to make the ground perfectly flat.", tz: "平路機有一個長長的刀片，把地面整得完全平坦。" },
      { en: "Graders are used to build roads and prepare ground before paving.", tz: "平路機用於建造道路和在鋪設路面之前整地。" },
      { en: "The blade can be tilted at any angle — the operator adjusts it while driving.", tz: "刀片可以傾斜到任何角度——操作員在駕駛時進行調整。" },
    ]
  },
  {
    id: "backhoe", emoji: "🔨", nameEN: "Backhoe", nameZH: "反鏟挖土機", photo: "../assets/books/construction/backhoe.jpg",
    typeEN: "EARTH MOVER", typeZH: "移土機", group: "earthmoving",
    facts: [
      { en: "A backhoe has a digging bucket on the back and a loader bucket on the front.", tz: "反鏟挖土機後面有一個挖掘鏟斗，前面有一個裝載鏟斗。" },
      { en: "It is one of the most common machines on construction sites.", tz: "它是建築工地上最常見的機器之一。" },
      { en: "The name 'backhoe' came because it pulls dirt toward itself — like a hoe.", tz: "backhoe這個名字的由來是因為它像鋤頭一樣把土往自己方向拉。" },
    ]
  },
  {
    id: "concretepump", emoji: "🚧", nameEN: "Concrete Pump", nameZH: "混凝土泵車", photo: "../assets/books/construction/concretepump.jpg",
    typeEN: "BUILDING", typeZH: "建築", group: "building",
    facts: [
      { en: "A concrete pump pushes liquid concrete through a long pipe high into the air.", tz: "混凝土泵車通過長管將液態混凝土推到高空中。" },
      { en: "The boom arm of a concrete pump can reach over 60 metres.", tz: "混凝土泵車的臂架可以延伸到60米以上。" },
      { en: "Without concrete pumps, building skyscrapers would be nearly impossible.", tz: "沒有混凝土泵車，建造摩天大樓幾乎是不可能的。" },
    ]
  },
  {
    id: "drill", emoji: "⛏️", nameEN: "Drilling Rig", nameZH: "鑽機", photo: "../assets/books/construction/drill.jpg",
    typeEN: "LIFTING", typeZH: "起重", group: "lifting",
    facts: [
      { en: "Drilling rigs bore deep holes into the ground — sometimes over a kilometre deep.", tz: "鑽機在地面上鑽深孔——有時候深度超過一公里。" },
      { en: "They are used to drill for water, oil, or to test the ground before building.", tz: "它們用於鑽水、鑽油，或在建造之前測試地質。" },
      { en: "The tallest drilling rigs need cranes to assemble the long drill pipes.", tz: "最高的鑽機需要起重機來組裝長長的鑽管。" },
    ]
  },
];
