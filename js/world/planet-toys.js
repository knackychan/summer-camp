/* Pixel Planet toys — Adibou-style tappables. Pure data: where each toy lives,
   how it reacts, what it sounds like. No stars, no ledger, no navigation. */

/* A note is [frequency Hz, duration s, oscillator type, delay ms, volume]. */
export const SOUNDS = {
  boing:  [[260,0.08,"triangle",0,0.16],[520,0.12,"triangle",70,0.14]],
  bounce: [[700,0.05,"triangle",0,0.14],[520,0.05,"triangle",120,0.12],[620,0.05,"triangle",240,0.1]],
  pop:    [[880,0.06,"square",0,0.1],[1320,0.08,"triangle",40,0.12]],
  cluck:  [[900,0.04,"square",0,0.08],[700,0.05,"square",80,0.08],[1100,0.06,"square",170,0.08]],
  whoosh: [[300,0.25,"sawtooth",0,0.05],[600,0.2,"sawtooth",120,0.04]],
  purr:   [[110,0.3,"sawtooth",0,0.06],[660,0.12,"sine",320,0.12]],
  robot:  [[440,0.06,"square",0,0.09],[660,0.06,"square",90,0.09],[330,0.08,"square",180,0.09]],
  rumble: [[90,0.3,"sawtooth",0,0.12],[150,0.12,"square",250,0.08]],
  yawn:   [[400,0.25,"sine",0,0.12],[260,0.3,"sine",220,0.1]],
  jingle: [[1320,0.07,"triangle",0,0.1],[1568,0.07,"triangle",80,0.1],[1760,0.1,"triangle",160,0.1]],
  whee:   [[500,0.08,"sine",0,0.12],[800,0.1,"sine",80,0.12],[1100,0.14,"sine",170,0.12]],
  hoot:   [[330,0.18,"sine",0,0.14],[294,0.25,"sine",260,0.14]],
  ribbit: [[180,0.06,"square",0,0.08],[220,0.08,"square",90,0.08]],
  noteC:  [[523,0.35,"sine",0,0.16]],
  noteE:  [[659,0.35,"sine",0,0.16]],
  noteG:  [[784,0.35,"sine",0,0.16]],
  rise:   [[392,0.08,"triangle",0,0.12],[523,0.08,"triangle",80,0.12],[659,0.12,"triangle",160,0.12]],
  moo:    [[150,0.4,"sawtooth",0,0.06],[130,0.35,"sawtooth",350,0.05]],
  buzz:   [[220,0.3,"sawtooth",0,0.04],[233,0.3,"sawtooth",150,0.04]],
  click:  [[1800,0.03,"square",0,0.06],[1600,0.03,"square",70,0.06],[1800,0.03,"square",140,0.06]],
  thunk:  [[200,0.08,"triangle",0,0.16],[140,0.1,"triangle",300,0.14]],
  spout:  [[180,0.2,"sawtooth",0,0.05],[900,0.12,"sine",150,0.1]],
  splash: [[1000,0.05,"sine",0,0.1],[600,0.1,"sawtooth",60,0.05]],
  toot:   [[392,0.2,"square",0,0.08],[392,0.25,"square",260,0.08]],
  wink:   [[1047,0.08,"sine",0,0.12],[1568,0.12,"sine",90,0.12]],
  rain:   [[2000,0.03,"sine",0,0.05],[2400,0.03,"sine",90,0.05],[1800,0.03,"sine",180,0.05],[2200,0.03,"sine",270,0.05]],
  zoom:   [[1500,0.2,"sine",0,0.08],[600,0.25,"sine",120,0.06]],
  yay:    [[523,0.12,"triangle",0,0.16],[659,0.12,"triangle",90,0.16],[784,0.12,"triangle",180,0.16],[1047,0.2,"triangle",270,0.16]],
  tick:   [[1200,0.04,"triangle",0,0.1]]
};

/* Mini-games launched from a game toy. Kid-facing text: always EN + 繁體中文. */
export const GAMES = {
  stars:   {title:["Star Catch","接星星"],   blurb:["Catch the falling stars!","接住掉下來的星星！"], icon:"🌟", unit:"🌟"},
  bubbles: {title:["Bubble Pop","戳泡泡"],   blurb:["Pop the whale's bubbles!","戳破鯨魚的泡泡！"],   icon:"🫧", unit:"🫧"},
  moles:   {title:["Mole Hop","打地鼠"],     blurb:["Tap the moles when they peek!","地鼠探頭就點牠！"], icon:"🐹", unit:"🐹"},
  echo:    {title:["Crystal Echo","水晶回音"], blurb:["Play the song back!","把歌彈回來！"],         icon:"💎", unit:"🎵"}
};

/* react: shake | hop | squash | spin | alt | glow | slide | grow | jump.
   fx: particle kind spawned on tap (see FX in world-explorer), count how many. */
export const TOYS = [
  {id:"toy:apple-tree", sprite:"appleTree",   biome:"village", lat:17,  lon:-12,  react:"shake",  fx:"apple",   count:3, sound:"bounce"},
  {id:"toy:chicken",    sprite:"chicken",     biome:"village", lat:-6,  lon:-11,  react:"hop",    fx:"egg",     count:1, sound:"cluck"},
  {id:"toy:windmill",   sprite:"windmill",    biome:"village", lat:18,  lon:11,   react:"spin",   fx:null,      count:0, sound:"whoosh"},
  {id:"toy:cat",        sprite:"cat",         biome:"village", lat:-6,  lon:12,   react:"squash", fx:"heart",   count:3, sound:"purr"},
  {id:"toy:robot",      sprite:"robot",       biome:"arcade",  lat:37,  lon:41,   react:"hop",    fx:"note",    count:2, sound:"robot"},
  {id:"toy:gumball",    sprite:"gumball",     biome:"arcade",  lat:21,  lon:44,   react:"shake",  fx:"gumball", count:2, sound:"pop"},
  {id:"toy:lava-vent",  sprite:"lavaVent",    biome:"volcano", lat:-41, lon:53,   react:"squash", fx:"lava",    count:3, sound:"rumble"},
  {id:"toy:rock-buddy", sprite:"rockBuddy",   biome:"volcano", lat:-19, lon:31,   react:"alt",    fx:"smoke",   count:2, sound:"yawn"},
  {id:"toy:snowman",    sprite:"snowman",     biome:"snow",    lat:51,  lon:-42,  react:"hop",    fx:"snow",    count:4, sound:"jingle"},
  {id:"toy:penguin",    sprite:"penguin",     biome:"snow",    lat:33,  lon:-41,  react:"slide",  fx:"snow",    count:2, sound:"whee"},
  {id:"toy:owl",        sprite:"owl",         biome:"forest",  lat:-36, lon:-57,  react:"alt",    fx:"note",    count:1, sound:"hoot"},
  {id:"toy:bush",       sprite:"bush",        biome:"forest",  lat:-15, lon:-58,  react:"shake",  fx:"bunny",   count:1, sound:"boing"},
  {id:"toy:mushroom",   sprite:"mushroom",    biome:"grove",   lat:34,  lon:110,  react:"squash", fx:"sparkle", count:2, sound:"boing"},
  {id:"toy:crystal-c",  sprite:"crystalCyan", biome:"grove",   lat:13,  lon:113,  react:"glow",   fx:"sparkle", count:2, sound:"noteC"},
  {id:"toy:crystal-e",  sprite:"crystalPink", biome:"grove",   lat:11,  lon:122,  react:"glow",   fx:"sparkle", count:2, sound:"noteE"},
  {id:"toy:crystal-g",  sprite:"crystalLilac",biome:"grove",   lat:13,  lon:131,  react:"glow",   fx:"sparkle", count:2, sound:"noteG"},
  {id:"toy:frog",       sprite:"frog",        biome:"grove",   lat:33,  lon:134,  react:"jump",   fx:null,      count:0, sound:"ribbit"},
  {id:"toy:echo-stone", sprite:"echoStone",   biome:"grove",   lat:41,  lon:122,  react:"glow",   fx:"sparkle", count:3, sound:"rise",   game:"echo"},
  {id:"toy:sunflower",  sprite:"sunflower",   biome:"meadow",  lat:-16, lon:151,  react:"grow",   fx:"sparkle", count:2, sound:"rise"},
  {id:"toy:cow",        sprite:"cow",         biome:"meadow",  lat:-36, lon:150,  react:"shake",  fx:"heart",   count:2, sound:"moo"},
  {id:"toy:beehive",    sprite:"beehive",     biome:"meadow",  lat:-19, lon:175,  react:"shake",  fx:"bee",     count:3, sound:"buzz"},
  {id:"toy:molehill",   sprite:"molehill",    biome:"meadow",  lat:-38, lon:174,  react:"hop",    fx:"sparkle", count:2, sound:"pop",    game:"moles"},
  {id:"toy:crab",       sprite:"crab",        biome:"beach",   lat:-6,  lon:-113, react:"slide",  fx:null,      count:0, sound:"click"},
  {id:"toy:palm",       sprite:"palm",        biome:"beach",   lat:14,  lon:-132, react:"shake",  fx:"coconut", count:1, sound:"thunk"},
  {id:"toy:whale",      sprite:"whale",       biome:"ocean",   lat:-4,  lon:-160, react:"hop",    fx:"drop",    count:4, sound:"spout",  game:"bubbles"},
  {id:"toy:fish",       sprite:"fish",        biome:"ocean",   lat:-6,  lon:88,   react:"jump",   fx:"drop",    count:2, sound:"splash"},
  {id:"toy:boat",       sprite:"boat",        biome:"ocean",   lat:16,  lon:-27,  react:"hop",    fx:null,      count:0, sound:"toot"}
];

/* Sky toys are not on the surface; the explorer hit-tests them itself. */
export const SKY = {
  moon:  {sprite:"moon", react:"alt", sound:"wink", game:"stars"},
  cloud: {fx:"rain", count:6, sound:"rain"},
  stars: {fx:"shootingStar", count:1, sound:"zoom"}
};
