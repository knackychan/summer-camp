/* Animals Book data — card deck for the book reader.
   Each card = { id, emoji, nameEN, nameZH, photo, typeEN, typeZH, group, facts[{en,tz}] }
   PHOTO PLACEHOLDERS: all images need to be scraped from Wikimedia Commons / public domain sources.
   See assets/books/animals/README.md for the scrape list. */

var ANIMALS_CARDS = [
  /* ── MAMMALS ── */
  {
    id: "elephant", emoji: "🐘", nameEN: "Elephant", nameZH: "大象", photo: "../assets/books/animals/elephant.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Elephants are the largest land animals on Earth.", tz: "大象是地球上最大的陸地動物。" },
      { en: "An elephant's trunk has over 40,000 muscles.", tz: "大象的鼻子有超過四萬條肌肉。" },
      { en: "Elephants can live for up to 70 years.", tz: "大象可以活到70歲。" },
    ]
  },
  {
    id: "tiger", emoji: "🐯", nameEN: "Tiger", nameZH: "老虎", photo: "../assets/books/animals/tiger.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Tigers are the biggest cats in the world.", tz: "老虎是世界上最大的貓科動物。" },
      { en: "Every tiger has a unique stripe pattern — like a fingerprint.", tz: "每隻老虎都有獨特的條紋圖案——就像指紋一樣。" },
      { en: "Tigers can jump over 5 metres in a single leap!", tz: "老虎一次可以跳出超過5米遠！" },
    ]
  },
  {
    id: "dolphin", emoji: "🐬", nameEN: "Dolphin", nameZH: "海豚", photo: "../assets/books/animals/dolphin.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Dolphins sleep with one half of their brain awake.", tz: "海豚睡覺時，一半的大腦是清醒的。" },
      { en: "They use sound to 'see' underwater — this is called echolocation.", tz: "牠們用聲音在水下「看」東西——這叫做回聲定位。" },
      { en: "Dolphins are very social and live in groups called pods.", tz: "海豚非常愛社交，群居在一起。" },
    ]
  },
  {
    id: "bat", emoji: "🦇", nameEN: "Bat", nameZH: "蝙蝠", photo: "../assets/books/animals/bat.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Bats are the only mammals that can truly fly.", tz: "蝙蝠是唯一真正會飛的哺乳動物。" },
      { en: "A single bat can eat up to 1,200 mosquitoes in one hour.", tz: "一隻蝙蝠一小時內可以吃掉多達1200隻蚊子。" },
      { en: "Most bats use echolocation to navigate in the dark.", tz: "大多數蝙蝠使用回聲定位在黑暗中導航。" },
    ]
  },
  {
    id: "giraffe", emoji: "🦒", nameEN: "Giraffe", nameZH: "長頸鹿", photo: "../assets/books/animals/giraffe.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "A giraffe's neck has the same number of bones as a human neck — 7.", tz: "長頸鹿脖子的骨頭數量和人類一樣——都是7塊。" },
      { en: "Giraffes are the tallest animals on Earth, up to 5.5 metres.", tz: "長頸鹿是地球上最高的動物，可達5.5米。" },
      { en: "Giraffes only need 5 to 30 minutes of sleep per day.", tz: "長頸鹿一天只需要睡5到30分鐘。" },
    ]
  },
  {
    id: "lion", emoji: "🦁", nameEN: "Lion", nameZH: "獅子", photo: "../assets/books/animals/lion.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Lions are the only cats that live in groups — called prides.", tz: "獅子是唯一群居的貓科動物——一群叫獅群。" },
      { en: "A lion's roar can be heard from 8 kilometres away.", tz: "獅子的吼聲可以在8公里外聽到。" },
      { en: "Female lions do most of the hunting for the pride.", tz: "母獅主要負責獅群的狩獵。" },
    ]
  },
  {
    id: "panda", emoji: "🐼", nameEN: "Giant Panda", nameZH: "大熊貓", photo: "../assets/books/animals/panda.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Giant pandas eat bamboo for up to 14 hours a day.", tz: "大熊貓每天吃竹子長達14個小時。" },
      { en: "Pandas have a special thumb-like bone to grip bamboo.", tz: "熊貓有一塊特殊的拇指狀骨頭來抓住竹子。" },
      { en: "Baby pandas weigh only about 100 grams at birth.", tz: "熊貓寶寶出生時只有大約100克重。" },
    ]
  },
  {
    id: "kangaroo", emoji: "🦘", nameEN: "Kangaroo", nameZH: "袋鼠", photo: "../assets/books/animals/kangaroo.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Kangaroos are the only large animals that hop as their main way of moving.", tz: "袋鼠是唯一用跳躍作為主要移動方式的大型動物。" },
      { en: "A baby kangaroo is called a joey — it stays in mum's pouch.", tz: "袋鼠寶寶叫做小袋鼠——牠待在媽媽的育兒袋裡。" },
      { en: "Kangaroos can jump up to 3 times their own body length.", tz: "袋鼠可以跳出自己身體長度的3倍。" },
    ]
  },
  {
    id: "whale", emoji: "🐋", nameEN: "Blue Whale", nameZH: "藍鯨", photo: "../assets/books/animals/whale.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "The blue whale is the largest animal ever — bigger than any dinosaur.", tz: "藍鯨是史上最大的動物——比任何恐龍都大。" },
      { en: "A blue whale's heart is the size of a small car.", tz: "藍鯨的心臟有一輛小車那麼大。" },
      { en: "Blue whales eat up to 4 tonnes of krill every day.", tz: "藍鯨每天吃多達4噸的磷蝦。" },
    ]
  },
  /* ── BIRDS ── */
  {
    id: "eagle", emoji: "🦅", nameEN: "Eagle", nameZH: "老鷹", photo: "../assets/books/animals/eagle.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Eagles can spot a rabbit from over 3 kilometres away.", tz: "老鷹可以在3公里外發現一隻兔子。" },
      { en: "The bald eagle can fly at speeds up to 160 km/h.", tz: "白頭鷹的飛行速度可達每小時160公里。" },
      { en: "Eagles build the biggest nests of any bird — up to 2.5 metres wide.", tz: "老鷹築的巢是鳥類中最大的——可達2.5米寬。" },
    ]
  },
  {
    id: "penguin", emoji: "🐧", nameEN: "Penguin", nameZH: "企鵝", photo: "../assets/books/animals/penguin.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Penguins cannot fly, but they are amazing swimmers.", tz: "企鵝不會飛，但牠們是出色的游泳者。" },
      { en: "Emperor penguins can dive deeper than 500 metres.", tz: "皇帝企鵝可以潛入超過500米深。" },
      { en: "Penguin parents take turns keeping their egg warm.", tz: "企鵝父母輪流給企鵝蛋保暖。" },
    ]
  },
  {
    id: "owl", emoji: "🦉", nameEN: "Owl", nameZH: "貓頭鷹", photo: "../assets/books/animals/owl.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Owls can turn their heads up to 270 degrees.", tz: "貓頭鷹可以將頭轉到270度。" },
      { en: "Owls fly almost silently because of special soft feathers.", tz: "貓頭鷹飛行幾乎無聲，因為牠們有特別柔軟的羽毛。" },
      { en: "Owls are nocturnal — they hunt at night.", tz: "貓頭鷹是夜行性動物——牠們在晚上捕獵。" },
    ]
  },
  {
    id: "flamingo", emoji: "🦩", nameEN: "Flamingo", nameZH: "紅鶴", photo: "../assets/books/animals/flamingo.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Flamingos are pink because of the food they eat — shrimp and algae.", tz: "紅鶴是粉紅色的，因為牠們吃蝦和藻類。" },
      { en: "They can stand on one leg for hours without getting tired.", tz: "牠們可以單腳站立數小時而不累。" },
      { en: "A group of flamingos is called a flamboyance.", tz: "一群紅鶴的英文叫做 flamboyance。" },
    ]
  },
  {
    id: "parrot", emoji: "🦜", nameEN: "Parrot", nameZH: "鸚鵡", photo: "../assets/books/animals/parrot.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Some parrots can learn over 1,000 words.", tz: "有些鸚鵡可以學會超過1000個詞彙。" },
      { en: "Parrots have strong curved beaks to crack nuts and seeds.", tz: "鸚鵡有強壯的彎曲喙來敲開堅果和種子。" },
      { en: "The smallest parrot is only about 8 cm tall.", tz: "最小的鸚鵡只有大約8厘米高。" },
    ]
  },
  /* ── REPTILES ── */
  {
    id: "turtle", emoji: "🐢", nameEN: "Sea Turtle", nameZH: "海龜", photo: "../assets/books/animals/turtle.jpg",
    typeEN: "REPTILE", typeZH: "爬行動物", group: "reptiles",
    facts: [
      { en: "Sea turtles can hold their breath for up to 5 hours underwater.", tz: "海龜可以在水下屏住呼吸長達5個小時。" },
      { en: "Some sea turtles travel over 10,000 km each year.", tz: "有些海龜每年旅行超過一萬公里。" },
      { en: "Sea turtles return to the same beach where they were born to lay eggs.", tz: "海龜會回到牠們出生的同一片海灘產卵。" },
    ]
  },
  {
    id: "crocodile", emoji: "🐊", nameEN: "Crocodile", nameZH: "鱷魚", photo: "../assets/books/animals/crocodile.jpg",
    typeEN: "REPTILE", typeZH: "爬行動物", group: "reptiles",
    facts: [
      { en: "Crocodiles have the strongest bite of any animal alive.", tz: "鱷魚的咬合力是現存動物中最強的。" },
      { en: "Crocodiles have been around for over 200 million years.", tz: "鱷魚已經存在超過兩億年了。" },
      { en: "A crocodile can hold its breath for over an hour.", tz: "鱷魚可以屏住呼吸超過一個小時。" },
    ]
  },
  {
    id: "chameleon", emoji: "🦎", nameEN: "Chameleon", nameZH: "變色龍", photo: "../assets/books/animals/chameleon.jpg",
    typeEN: "REPTILE", typeZH: "爬行動物", group: "reptiles",
    facts: [
      { en: "Chameleons change colour to communicate, not just to hide.", tz: "變色龍變色是為了溝通，不只是為了躲藏。" },
      { en: "A chameleon's tongue can be twice as long as its body.", tz: "變色龍的舌頭可以是身體長度的兩倍。" },
      { en: "Chameleons can move their eyes in two different directions at once.", tz: "變色龍的兩隻眼睛可以同時朝不同方向移動。" },
    ]
  },
  {
    id: "snake", emoji: "🐍", nameEN: "Snake", nameZH: "蛇", photo: "../assets/books/animals/snake.jpg",
    typeEN: "REPTILE", typeZH: "爬行動物", group: "reptiles",
    facts: [
      { en: "Snakes smell with their tongue, not their nose.", tz: "蛇用舌頭來聞氣味，而不是用鼻子。" },
      { en: "There are over 3,000 species of snakes in the world.", tz: "世界上有超過3000種蛇。" },
      { en: "Snakes can unhinge their jaw to swallow food bigger than their head.", tz: "蛇可以脫臼下巴，吞下比頭還大的食物。" },
    ]
  },
  /* ── INSECTS ── */
  {
    id: "butterfly", emoji: "🦋", nameEN: "Butterfly", nameZH: "蝴蝶", photo: "../assets/books/animals/butterfly.jpg",
    typeEN: "INSECT", typeZH: "昆蟲", group: "insects",
    facts: [
      { en: "Butterflies can see ultraviolet light — colours we cannot see.", tz: "蝴蝶可以看到紫外線——一種我們看不到的顏色。" },
      { en: "A butterfly's wings are actually transparent — the colour comes from tiny scales.", tz: "蝴蝶的翅膀其實是透明的——顏色來自微小的鱗片。" },
      { en: "Butterflies taste with their feet.", tz: "蝴蝶用腳來嚐味道。" },
    ]
  },
  {
    id: "bee", emoji: "🐝", nameEN: "Honey Bee", nameZH: "蜜蜂", photo: "../assets/books/animals/bee.jpg",
    typeEN: "INSECT", typeZH: "昆蟲", group: "insects",
    facts: [
      { en: "A bee visits up to 5,000 flowers in a single day.", tz: "一隻蜜蜂一天可以拜訪多達5000朵花。" },
      { en: "Bees do a special 'waggle dance' to tell others where to find flowers.", tz: "蜜蜂會跳一種特別的「搖擺舞」來告訴同伴去哪裡找花。" },
      { en: "A whole hive produces only about one spoonful of honey per bee's lifetime.", tz: "一整窩蜜蜂每隻一生只產大約一匙的蜂蜜。" },
    ]
  },
  {
    id: "ant", emoji: "🐜", nameEN: "Ant", nameZH: "螞蟻", photo: "../assets/books/animals/ant.jpg",
    typeEN: "INSECT", typeZH: "昆蟲", group: "insects",
    facts: [
      { en: "Ants can lift objects 50 times their own body weight.", tz: "螞蟻可以舉起自己體重50倍的物體。" },
      { en: "Ant colonies can have millions of members — all working together.", tz: "螞蟻群落可以有數百萬成員——大家一起合作。" },
      { en: "Ants use chemicals called pheromones to create scent trails.", tz: "螞蟻用一種叫做費洛蒙的化學物質來留下氣味軌跡。" },
    ]
  },
  {
    id: "ladybug", emoji: "🐞", nameEN: "Ladybug", nameZH: "瓢蟲", photo: "../assets/books/animals/ladybug.jpg",
    typeEN: "INSECT", typeZH: "昆蟲", group: "insects",
    facts: [
      { en: "Ladybugs are helpful to farmers — they eat pests that damage crops.", tz: "瓢蟲對農夫有幫助——牠們吃傷害農作物的害蟲。" },
      { en: "A ladybug can eat up to 5,000 insects in its lifetime.", tz: "一隻瓢蟲一生可以吃掉多達5000隻昆蟲。" },
      { en: "Ladybugs come in many colours — red, orange, yellow, even blue.", tz: "瓢蟲有很多顏色——紅色、橘色、黃色、甚至藍色。" },
    ]
  },
  {
    id: "dragonfly", emoji: "🪰", nameEN: "Dragonfly", nameZH: "蜻蜓", photo: "../assets/books/animals/dragonfly.jpg",
    typeEN: "INSECT", typeZH: "昆蟲", group: "insects",
    facts: [
      { en: "Dragonflies have been on Earth for over 300 million years.", tz: "蜻蜓在地球上已經存在超過三億年了。" },
      { en: "They can fly in all six directions: up, down, forward, backward, left, right.", tz: "牠們可以向六個方向飛行：上、下、前、後、左、右。" },
      { en: "A dragonfly's eyes have about 30,000 lenses.", tz: "蜻蜓的眼睛有大約三萬個透鏡。" },
    ]
  },
  /* ── OCEAN ── */
  {
    id: "octopus", emoji: "🐙", nameEN: "Octopus", nameZH: "章魚", photo: "../assets/books/animals/octopus.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Octopuses have three hearts and blue blood.", tz: "章魚有三顆心臟和藍色的血。" },
      { en: "They are masters of disguise — they can change colour and texture instantly.", tz: "牠們是偽裝大師——可以瞬間改變顏色和質地。" },
      { en: "Each octopus arm has its own 'mini brain' and can work independently.", tz: "每隻章魚觸手都有自己的「迷你大腦」，可以獨立工作。" },
    ]
  },
  {
    id: "shark", emoji: "🦈", nameEN: "Shark", nameZH: "鯊魚", photo: "../assets/books/animals/shark.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Sharks have been around longer than dinosaurs — over 400 million years.", tz: "鯊魚存在的時間比恐龍還久——超過四億年。" },
      { en: "Some sharks never stop swimming — even when they sleep.", tz: "有些鯊魚從不停止游泳——連睡覺時也在游。" },
      { en: "A shark can grow and replace thousands of teeth in its lifetime.", tz: "鯊魚一生中可以長出和替換數千顆牙齒。" },
    ]
  },
  {
    id: "seahorse", emoji: "🐠", nameEN: "Seahorse", nameZH: "海馬", photo: "../assets/books/animals/seahorse.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Seahorses are the only animal where the father carries the babies.", tz: "海馬是唯一由爸爸育兒的動物。" },
      { en: "Seahorses can change colour to match their surroundings.", tz: "海馬可以改變顏色來融入周圍環境。" },
      { en: "A seahorse's eyes can move independently — like a chameleon.", tz: "海馬的眼睛可以獨立移動——就像變色龍一樣。" },
    ]
  },
  {
    id: "jellyfish", emoji: "🪼", nameEN: "Jellyfish", nameZH: "水母", photo: "../assets/books/animals/jellyfish.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Jellyfish have no brain, heart, or bones.", tz: "水母沒有大腦、心臟或骨頭。" },
      { en: "Some jellyfish can glow in the dark — this is called bioluminescence.", tz: "有些水母可以在黑暗中發光——這叫做生物發光。" },
      { en: "Jellyfish have been drifting in oceans for over 500 million years.", tz: "水母在海洋中漂浮已超過五億年了。" },
    ]
  },
  {
    id: "clownfish", emoji: "🐟", nameEN: "Clownfish", nameZH: "小丑魚", photo: "../assets/books/animals/clownfish.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Clownfish live safely among sea anemones that sting other fish.", tz: "小丑魚安全地生活在會螫其他魚的海葵中。" },
      { en: "All clownfish are born male — the biggest one becomes female.", tz: "所有小丑魚出生時都是雄性——最大的一隻會變成雌性。" },
      { en: "They keep their anemone clean and bring it bits of food.", tz: "牠們會幫海葵保持清潔，並帶食物給牠。" },
    ]
  },
  {
    id: "coral", emoji: "🪸", nameEN: "Coral Reef", nameZH: "珊瑚礁", photo: "../assets/books/animals/coral.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Coral reefs are built by tiny animals called polyps.", tz: "珊瑚礁是由一種叫做珊瑚蟲的小動物建造的。" },
      { en: "Coral reefs are home to about 25% of all ocean life.", tz: "珊瑚礁是大約25%海洋生物的家。" },
      { en: "The Great Barrier Reef can be seen from space.", tz: "大堡礁可以從太空中看到。" },
    ]
  },
  /* ── MORE MAMMALS ── */
  {
    id: "polarbear", emoji: "🐻‍❄️", nameEN: "Polar Bear", nameZH: "北極熊", photo: "../assets/books/animals/polarbear.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Polar bears have black skin under their white fur to absorb sunlight.", tz: "北極熊白色毛皮下是黑色皮膚，用來吸收陽光。" },
      { en: "They are excellent swimmers and can swim for days without rest.", tz: "牠們是出色的游泳者，可以連續游泳好幾天不休息。" },
      { en: "Polar bears are the largest land predators on Earth.", tz: "北極熊是地球上最大的陸地掠食者。" },
    ]
  },
  {
    id: "wolf", emoji: "🐺", nameEN: "Wolf", nameZH: "狼", photo: "../assets/books/animals/wolf.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Wolves live in family groups called packs — usually 6 to 10 members.", tz: "狼住在叫做狼群的家庭群體中——通常6到10個成員。" },
      { en: "Wolves can hear another wolf howl from 10 km away.", tz: "狼可以聽到10公里外另一隻狼的嚎叫聲。" },
      { en: "Wolf pups are born blind and deaf — they need weeks of care.", tz: "狼寶寶出生時又盲又聾——需要好幾週的照顧。" },
    ]
  },
  {
    id: "cheetah", emoji: "🐆", nameEN: "Cheetah", nameZH: "獵豹", photo: "../assets/books/animals/cheetah.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Cheetahs are the fastest land animals — up to 110 km/h.", tz: "獵豹是跑得最快的陸地動物——時速可達110公里。" },
      { en: "A cheetah can go from 0 to 100 km/h in 3 seconds.", tz: "獵豹可以在3秒內從0加速到時速100公里。" },
      { en: "Cheetahs use their long tail like a rudder to steer at high speed.", tz: "獵豹用長尾巴當作方向舵，在高速時轉向。" },
    ]
  },
  {
    id: "orangutan", emoji: "🦧", nameEN: "Orangutan", nameZH: "猩猩", photo: "../assets/books/animals/orangutan.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Orangutans share about 97% of their DNA with humans.", tz: "猩猩和人類共享大約97%的DNA。" },
      { en: "They build a new nest every night high up in the trees.", tz: "牠們每天晚上在高高的樹上築新巢。" },
      { en: "Orangutan means 'person of the forest' in the Malay language.", tz: "猩猩這個詞在馬來語中的意思是「森林裡的人」。" },
    ]
  },
  {
    id: "zebra", emoji: "🦓", nameEN: "Zebra", nameZH: "斑馬", photo: "../assets/books/animals/zebra.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Every zebra's stripe pattern is unique — no two are the same.", tz: "每隻斑馬的條紋都是獨一無二的——沒有兩隻一樣。" },
      { en: "Zebra stripes may help keep biting flies away.", tz: "斑馬的條紋可能有助於趕走蒼蠅。" },
      { en: "Zebras can sleep standing up.", tz: "斑馬可以站著睡覺。" },
    ]
  },
  {
    id: "rhino", emoji: "🦏", nameEN: "Rhinoceros", nameZH: "犀牛", photo: "../assets/books/animals/rhino.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "A rhino's horn is made of keratin — the same stuff as our fingernails.", tz: "犀牛的角是由角蛋白構成的——和我們的指甲一樣。" },
      { en: "Some rhinos weigh over 2,000 kilograms.", tz: "有些犀牛重達超過2000公斤。" },
      { en: "Rhinos have poor eyesight but an excellent sense of smell.", tz: "犀牛的視力很差，但嗅覺非常靈敏。" },
    ]
  },
  {
    id: "redpanda", emoji: "🐾", nameEN: "Red Panda", nameZH: "小熊貓", photo: "../assets/books/animals/redpanda.jpg",
    typeEN: "MAMMAL", typeZH: "哺乳動物", group: "mammals",
    facts: [
      { en: "Despite its name, the red panda is not closely related to the giant panda.", tz: "雖然叫熊貓，但小熊貓和大熊貓的血緣關係並不近。" },
      { en: "Red pandas use their fluffy tail as a blanket in cold weather.", tz: "小熊貓在寒冷的天氣裡用毛茸茸的尾巴當毯子。" },
      { en: "They spend most of their time high up in trees.", tz: "牠們大部分時間都待在高高的樹上。" },
    ]
  },
  /* ── MORE BIRDS & REPTILES ── */
  {
    id: "hummingbird", emoji: "🐦", nameEN: "Hummingbird", nameZH: "蜂鳥", photo: "../assets/books/animals/hummingbird.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Hummingbirds are the only birds that can fly backwards.", tz: "蜂鳥是唯一可以向後飛的鳥。" },
      { en: "Their wings can beat up to 80 times per second.", tz: "牠們的翅膀每秒可以拍打多達80次。" },
      { en: "Hummingbirds have the fastest metabolism of any animal.", tz: "蜂鳥的新陳代謝是所有動物中最快的。" },
    ]
  },
  {
    id: "frog", emoji: "🐸", nameEN: "Frog", nameZH: "青蛙", photo: "../assets/books/animals/frog.jpg",
    typeEN: "AMPHIBIAN", typeZH: "兩棲動物", group: "reptiles",
    facts: [
      { en: "Frogs absorb water through their skin — they don't need to drink.", tz: "青蛙通過皮膚吸收水分——牠們不需要喝水。" },
      { en: "Some frogs can jump 20 times their own body length.", tz: "有些青蛙可以跳出自己身體長度的20倍。" },
      { en: "Frogs use their bulging eyes to help them swallow food.", tz: "青蛙用凸出的眼睛幫助吞嚥食物。" },
    ]
  },
  {
    id: "ostrich", emoji: "🐦", nameEN: "Ostrich", nameZH: "鴕鳥", photo: "../assets/books/animals/ostrich.jpg",
    typeEN: "BIRD", typeZH: "鳥類", group: "birds",
    facts: [
      { en: "Ostriches are the biggest birds in the world and cannot fly.", tz: "鴕鳥是世界上最大的鳥類，不會飛。" },
      { en: "An ostrich can run faster than a horse — up to 70 km/h.", tz: "鴕鳥跑得比馬還快——時速可達70公里。" },
      { en: "An ostrich egg is the biggest egg — equal to about 24 chicken eggs.", tz: "鴕鳥蛋是最大的蛋——大約等於24顆雞蛋。" },
    ]
  },
  {
    id: "mantis", emoji: "🦗", nameEN: "Praying Mantis", nameZH: "螳螂", photo: "../assets/books/animals/mantis.jpg",
    typeEN: "INSECT", typeZH: "昆蟲", group: "insects",
    facts: [
      { en: "The praying mantis is the only insect that can turn its head like an owl.", tz: "螳螂是唯一能像貓頭鷹一樣轉頭的昆蟲。" },
      { en: "Mantis have excellent 3D vision — they see depth like humans do.", tz: "螳螂有極佳的3D視覺——牠們像人類一樣能看到深度。" },
      { en: "There are over 2,400 species of praying mantis in the world.", tz: "全世界有超過2400種螳螂。" },
    ]
  },
  {
    id: "starfish", emoji: "⭐", nameEN: "Starfish", nameZH: "海星", photo: "../assets/books/animals/starfish.jpg",
    typeEN: "OCEAN", typeZH: "海洋生物", group: "ocean",
    facts: [
      { en: "Starfish can regrow a lost arm — and sometimes a whole new body from one arm.", tz: "海星可以再生失去的手臂——有時一條手臂就能長出全新的身體。" },
      { en: "Starfish have no brain and no blood — they use seawater instead.", tz: "海星沒有大腦和血液——牠們用海水代替。" },
      { en: "Starfish can push their stomach outside their body to digest food.", tz: "海星可以把胃部推出體外來消化食物。" },
    ]
  },
];
