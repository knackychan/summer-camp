/* Solar System data (design.md §3). Data only — no DOM, no Three.js.
   Structured fields (diameterKm, au, yearDays, moons, flags) are the single
   source of truth for fact cards AND computed quiz questions. */

export var SOLAR = {
  name: "Sun", tz: "\u592a\u967d", color: 0xfdb813, diameterKm: 1392700,
  type: { en: "STAR", tz: "\u6046\u661f" },
  desc: { en: "The Sun is the giant star at the centre of our solar system. Its gravity holds all eight planets, and its light gives Earth warmth and energy.",
          tz: "\u592a\u967d\u662f\u4f4d\u65bc\u592a\u967d\u7cfb\u4e2d\u5fc3\u7684\u5de8\u5927\u6046\u661f\u3002\u5b83\u7684\u5f15\u529b\u6293\u4f4f\u516b\u9846\u884c\u661f,\u5b83\u7684\u5149\u5e36\u7d66\u5730\u7403\u6eab\u6696\u8207\u80fd\u91cf\u3002" },
  photo: "assets/solar/sun.jpg",
  facts: [
    { en: "The Sun is a star \u2014 a giant ball of hot gas.", tz: "\u592a\u967d\u662f\u4e00\u9846\u6052\u661f,\u4e00\u500b\u5de8\u5927\u7684\u71b1\u6c23\u7403\u3002" },
    { en: "Eight planets travel around the Sun.", tz: "\u6709\u516b\u9846\u884c\u661f\u7e5e\u8457\u592a\u967d\u8f49\u3002" },
    { en: "The Sun is so big that one million Earths could fit inside!", tz: "\u592a\u967d\u975e\u5e38\u5927,\u53ef\u4ee5\u88dd\u4e0b\u4e00\u767e\u842c\u500b\u5730\u7403!" },
  ],
};

export var PLANETS = [
  { id: "mercury", name: "Mercury", tz: "\u6c34\u661f", color: 0x9c8e84,
    diameterKm: 4879, au: 0.39, yearDays: 88, dayHours: 1416, moons: 0,
    flags: {},
    type: { en: "TERRESTRIAL PLANET", tz: "\u985e\u5730\u884c\u661f" },
    desc: { en: "Mercury is a small rocky world that sprints around the Sun. With almost no air, its days are scorching and its nights are freezing.",
            tz: "\u6c34\u661f\u662f\u4e00\u9846\u5c0f\u5c0f\u7684\u5ca9\u77f3\u661f\u7403,\u7e5e\u8457\u592a\u967d\u98db\u5954\u3002\u56e0\u70ba\u5e7e\u4e4e\u6c92\u6709\u7a7a\u6c23,\u767d\u5929\u9177\u71b1\u3001\u591c\u665a\u56b4\u5bd2\u3002" },
    photo: "assets/solar/mercury.jpg",
    facts: [
      { en: "Mercury is the closest planet to the Sun.", tz: "\u6c34\u661f\u662f\u96e2\u592a\u967d\u6700\u8fd1\u7684\u884c\u661f\u3002" },
      { en: "One year on Mercury is only 88 days!", tz: "\u6c34\u661f\u4e0a\u7684\u4e00\u5e74\u53ea\u6709 88 \u5929!" },
      { en: "Mercury has no moons.", tz: "\u6c34\u661f\u6c92\u6709\u885b\u661f\u3002" },
    ] },
  { id: "venus", name: "Venus", tz: "\u91d1\u661f", color: 0xe8cda5,
    diameterKm: 12104, au: 0.72, yearDays: 225, dayHours: 5832, moons: 0,
    flags: { hottest: true },
    type: { en: "TERRESTRIAL PLANET", tz: "\u985e\u5730\u884c\u661f" },
    desc: { en: "Venus is wrapped in thick clouds that trap heat like a giant greenhouse. It is the hottest planet \u2014 hotter even than Mercury!",
            tz: "\u91d1\u661f\u88ab\u539a\u539a\u7684\u96f2\u5c64\u5305\u88f9,\u50cf\u4e00\u5ea7\u5de8\u5927\u7684\u6eab\u5ba4\u628a\u71b1\u56f0\u4f4f\u3002\u5b83\u662f\u6700\u71b1\u7684\u884c\u661f,\u6bd4\u6c34\u661f\u9084\u71b1!" },
    photo: "assets/solar/venus.jpg",
    facts: [
      { en: "Venus is the hottest planet.", tz: "\u91d1\u661f\u662f\u6700\u71b1\u7684\u884c\u661f\u3002" },
      { en: "Venus spins backwards compared to Earth.", tz: "\u91d1\u661f\u7684\u81ea\u8f49\u65b9\u5411\u548c\u5730\u7403\u76f8\u53cd\u3002" },
      { en: "Venus is the brightest planet in our night sky.", tz: "\u91d1\u661f\u662f\u591c\u7a7a\u4e2d\u6700\u4eae\u7684\u884c\u661f\u3002" },
    ] },
  { id: "earth", name: "Earth", tz: "\u5730\u7403", color: 0x4d7dd1,
    diameterKm: 12742, au: 1, yearDays: 365, dayHours: 24, moons: 1,
    flags: {},
    type: { en: "TERRESTRIAL PLANET", tz: "\u985e\u5730\u884c\u661f" },
    desc: { en: "Earth is the blue marble we call home \u2014 the only known world with oceans of liquid water, breathable air and life.",
            tz: "\u5730\u7403\u662f\u6211\u5011\u7a31\u70ba\u5bb6\u7684\u85cd\u8272\u5f48\u73e0,\u662f\u76ee\u524d\u5df2\u77e5\u552f\u4e00\u64c1\u6709\u6db2\u614b\u6d77\u6d0b\u3001\u7a7a\u6c23\u8207\u751f\u547d\u7684\u661f\u7403\u3002" },
    photo: "assets/solar/earth.jpg",
    facts: [
      { en: "Earth is our home \u2014 the only planet with life.", tz: "\u5730\u7403\u662f\u6211\u5011\u7684\u5bb6,\u662f\u552f\u4e00\u6709\u751f\u547d\u7684\u884c\u661f\u3002" },
      { en: "Most of Earth is covered by ocean.", tz: "\u5730\u7403\u8868\u9762\u5927\u90e8\u5206\u662f\u6d77\u6d0b\u3002" },
      { en: "Earth has one moon.", tz: "\u5730\u7403\u6709\u4e00\u9846\u885b\u661f\u3002" },
    ] },
  { id: "mars", name: "Mars", tz: "\u706b\u661f", color: 0xc1440e,
    diameterKm: 6779, au: 1.52, yearDays: 687, dayHours: 24.6, moons: 2,
    flags: { red: true },
    type: { en: "TERRESTRIAL PLANET", tz: "\u985e\u5730\u884c\u661f" },
    desc: { en: "Mars is a cold desert world coloured red by rusty dust. Scientists send robots there to search for signs of ancient life.",
            tz: "\u706b\u661f\u662f\u4e00\u7247\u5bd2\u51b7\u7684\u6c99\u6f20\u4e16\u754c,\u751f\u93bd\u7684\u5875\u571f\u8b93\u5b83\u770b\u8d77\u4f86\u7d05\u7d05\u7684\u3002\u79d1\u5b78\u5bb6\u9001\u6a5f\u5668\u4eba\u53bb\u90a3\u88e1\u5c0b\u627e\u53e4\u8001\u751f\u547d\u7684\u7dda\u7d22\u3002" },
    photo: "assets/solar/mars.jpg",
    facts: [
      { en: "Mars is called the red planet.", tz: "\u706b\u661f\u88ab\u7a31\u70ba\u7d05\u8272\u661f\u7403\u3002" },
      { en: "It has the tallest volcano in the solar system.", tz: "\u5b83\u6709\u592a\u967d\u7cfb\u6700\u9ad8\u7684\u706b\u5c71\u3002" },
      { en: "Mars has two tiny moons.", tz: "\u706b\u661f\u6709\u5169\u9846\u5c0f\u885b\u661f\u3002" },
    ] },
  { id: "jupiter", name: "Jupiter", tz: "\u6728\u661f", color: 0xc88b3a,
    diameterKm: 139820, au: 5.2, yearDays: 4333, dayHours: 10, moons: 95,
    flags: { biggest: true },
    type: { en: "GAS GIANT", tz: "\u6c23\u614b\u5de8\u884c\u661f" },
    desc: { en: "Jupiter is the giant of the solar system \u2014 more than 1,300 Earths could fit inside. Its Great Red Spot is a storm that has raged for centuries.",
            tz: "\u6728\u661f\u662f\u592a\u967d\u7cfb\u7684\u5de8\u4eba,\u53ef\u4ee5\u88dd\u4e0b\u8d85\u904e 1,300 \u500b\u5730\u7403\u3002\u5b83\u7684\u5927\u7d05\u6591\u662f\u4e00\u5834\u522e\u4e86\u597d\u5e7e\u767e\u5e74\u7684\u98a8\u66b4\u3002" },
    photo: "assets/solar/jupiter.jpg",
    facts: [
      { en: "Jupiter is the biggest planet.", tz: "\u6728\u661f\u662f\u6700\u5927\u7684\u884c\u661f\u3002" },
      { en: "Its Great Red Spot is a storm bigger than Earth!", tz: "\u5b83\u7684\u5927\u7d05\u6591\u662f\u4e00\u5834\u6bd4\u5730\u7403\u9084\u5927\u7684\u98a8\u66b4!" },
      { en: "Jupiter has at least 95 moons.", tz: "\u6728\u661f\u81f3\u5c11\u6709 95 \u9846\u885b\u661f\u3002" },
    ] },
  { id: "saturn", name: "Saturn", tz: "\u571f\u661f", color: 0xead6b8,
    diameterKm: 116460, au: 9.54, yearDays: 10759, dayHours: 10.7, moons: 274,
    flags: { mostMoons: true, rings: true },
    type: { en: "GAS GIANT", tz: "\u6c23\u614b\u5de8\u884c\u661f" },
    desc: { en: "Saturn is famous for its dazzling rings, made of billions of pieces of ice and rock. It spins so fast that a day there is under 11 hours.",
            tz: "\u571f\u661f\u4ee5\u8000\u773c\u7684\u74b0\u805e\u540d,\u7531\u6578\u5341\u5104\u584a\u51b0\u8207\u5ca9\u77f3\u7d44\u6210\u3002\u5b83\u8f49\u5f97\u5f88\u5feb,\u4e00\u5929\u4e0d\u5230 11 \u5c0f\u6642\u3002" },
    photo: "assets/solar/saturn.jpg",
    facts: [
      { en: "Saturn's rings are made of ice and rock.", tz: "\u571f\u661f\u74b0\u662f\u7531\u51b0\u548c\u5ca9\u77f3\u7d44\u6210\u7684\u3002" },
      { en: "Saturn is so light it could float on water!", tz: "\u571f\u661f\u975e\u5e38\u8f15,\u8f15\u5230\u53ef\u4ee5\u6d6e\u5728\u6c34\u4e0a!" },
      { en: "Saturn has the most moons \u2014 at least 274!", tz: "\u571f\u661f\u7684\u885b\u661f\u6700\u591a,\u81f3\u5c11\u6709 274 \u9846!" },
    ] },
  { id: "uranus", name: "Uranus", tz: "\u5929\u738b\u661f", color: 0x9fe3e0,
    diameterKm: 50724, au: 19.2, yearDays: 30687, dayHours: 17, moons: 29,
    flags: { coldest: true },
    type: { en: "ICE GIANT", tz: "\u51b0\u5de8\u884c\u661f" },
    desc: { en: "Uranus is an ice giant that rolls around the Sun on its side, probably knocked over long ago. It is the coldest planet of all.",
            tz: "\u5929\u738b\u661f\u662f\u4e00\u9846\u5074\u8eba\u8457\u7e5e\u592a\u967d\u6efe\u52d5\u7684\u51b0\u5de8\u884c\u661f,\u53ef\u80fd\u662f\u5f88\u4e45\u4ee5\u524d\u88ab\u649e\u5012\u7684\u3002\u5b83\u662f\u6700\u51b7\u7684\u884c\u661f\u3002" },
    photo: "assets/solar/uranus.jpg",
    facts: [
      { en: "Uranus spins on its side like a rolling ball.", tz: "\u5929\u738b\u661f\u50cf\u6efe\u52d5\u7684\u7403\u4e00\u6a23\u5074\u8eba\u8457\u81ea\u8f49\u3002" },
      { en: "It is the coldest planet.", tz: "\u5b83\u662f\u6700\u51b7\u7684\u884c\u661f\u3002" },
      { en: "It looks blue-green because of its gas.", tz: "\u56e0\u70ba\u6c23\u9ad4\u7684\u95dc\u4fc2,\u5b83\u770b\u8d77\u4f86\u662f\u85cd\u7da0\u8272\u7684\u3002" },
    ] },
  { id: "neptune", name: "Neptune", tz: "\u6d77\u738b\u661f", color: 0x3457d5,
    diameterKm: 49244, au: 30.1, yearDays: 60190, dayHours: 16, moons: 16,
    flags: {},
    type: { en: "ICE GIANT", tz: "\u51b0\u5de8\u884c\u661f" },
    desc: { en: "Neptune is a deep-blue, windy world at the edge of the solar system. One year there lasts 165 Earth years.",
            tz: "\u6d77\u738b\u661f\u662f\u592a\u967d\u7cfb\u908a\u7de3\u6df1\u85cd\u8272\u3001\u591a\u98a8\u7684\u4e16\u754c\u3002\u90a3\u88e1\u7684\u4e00\u5e74\u7b49\u65bc\u5730\u7403\u7684 165 \u5e74\u3002" },
    photo: "assets/solar/neptune.jpg",
    facts: [
      { en: "Neptune is the farthest planet from the Sun.", tz: "\u6d77\u738b\u661f\u662f\u96e2\u592a\u967d\u6700\u9060\u7684\u884c\u661f\u3002" },
      { en: "It has the fastest winds in the solar system.", tz: "\u5b83\u6709\u592a\u967d\u7cfb\u6700\u5feb\u7684\u98a8\u3002" },
      { en: "One year on Neptune is 165 Earth years!", tz: "\u6d77\u738b\u661f\u4e0a\u7684\u4e00\u5e74\u7b49\u65bc\u5730\u7403\u7684 165 \u5e74!" },
    ] },
];

/* Visual scale is compressed (design.md D4): these are scene units, not km. */
export var SCENE = {
  sunRadius: 2,
  sizes: { mercury: 0.3, venus: 0.45, earth: 0.5, mars: 0.4, jupiter: 1.2, saturn: 1.0, uranus: 0.8, neptune: 0.75 },
  orbits: { mercury: 4, venus: 5.5, earth: 7, mars: 8.5, jupiter: 11, saturn: 14, uranus: 17, neptune: 20 },
};

export default { SOLAR: SOLAR, PLANETS: PLANETS, SCENE: SCENE };
