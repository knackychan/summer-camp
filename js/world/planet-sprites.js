/* Pixel Planet sprites — hand-placed pixel art as text rows, one char per pixel.
   Pure data + pure pixel builder; buildAtlas() is the only DOM-touching function. */
import { C, DARK, RGBA, luminance } from "./planet-palette.js";

/* '.' and ' ' are transparent. 'H'/'h' are the kid's colour and its shadow. */
export const KEY = {
  o:C.outline, x:C.space2, D:C.greenDeep, n:C.oceanDark, b:C.ocean, B:C.oceanLit, i:C.ice,
  d:C.greenDark, g:C.green, G:C.greenLit, l:C.lime, r:C.rockDark, k:C.rock, K:C.rockLit, L:C.lava,
  y:C.yellow, s:C.sand, z:C.sandLit, w:C.wood, W:C.woodDark, p:C.pink, m:C.magenta, u:C.purpleDark,
  v:C.purple, q:C.lilac, "#":C.white, c:C.snowShade, e:C.steel, R:C.red, t:C.cyan, a:C.grey
};

/* art: rows. alt: explicit second frame. remap: second frame by swapping chars.
   from + tint: reuse another sprite's art with chars swapped. outline: add a 1px dark rim. */
export const SPRITES = {
  /* ---- places (section landmarks) ---- */
  questHut: {art:[
    "......oyo......",
    "......oyyo.....",
    "......oyyyo....",
    "......ow.......",
    ".....oRwRo.....",
    "....oRRRRRo....",
    "...oRRRRRRRo...",
    "..oRRRRRRRRRo..",
    ".oRRRRRRRRRRRo.",
    "ooooooooooooooo",
    ".ozzzzzzzzzzzo.",
    ".ozBBzzowwozzo.",
    ".ozBBzzowwozzo.",
    ".ozzzzzowyozzo.",
    ".ozzzzzowwozzo.",
    "ooooooooooooooo"], remap:{y:"z"}},
  arcade: {art:[
    "......opo.....",
    "......oto.....",
    "oooooooooooooo",
    "optpytptpytpto",
    "oooooooooooooo",
    ".ovvvvvvvvvvo.",
    ".ovqqvvvvqqvo.",
    ".ovqqvvvvqqvo.",
    ".ovvvvvvvvvvo.",
    ".ovttvvvvttvo.",
    ".ovttvvvvttvo.",
    ".ovvvvoovvvvo.",
    ".ovvvoyyovvvo.",
    ".ovvvoyyovvvo.",
    "oooooooooooooo"], remap:{t:"p", p:"y", y:"t"}},
  volcano: {art:[
    "......oLLo......",
    ".....oLyyLo.....",
    "....okLLLLko....",
    "...okkkLkkKko...",
    "...okkkkkkKKo...",
    "..okkrkkkkkKKo..",
    "..okkkkkkkkkKo..",
    ".okkkkkkrkkkkKo.",
    ".okrkkoooookkKo.",
    "okkkkkowwwokkKko",
    "okkrkkowywokkkko",
    "okkkkkowwwokkkko",
    "oooooooooooooooo"], remap:{L:"y", y:"L"}},
  observatory: {art:[
    ".......oyo.....",
    ".....ooooo.....",
    "...oo##ccoo....",
    "..o###cccceo...",
    ".o###cccccceo..",
    ".o##ccccooceo..",
    "ooooooooooooooo",
    ".oeeeeeeeeeeo..",
    ".oeiieeeeiieo..",
    ".oeiieeeeiieo..",
    ".oeeeowwoeeeo..",
    ".oeeeowyoeeeo..",
    "ooooooooooooooo"], remap:{y:"#"}},
  libraryTree: {art:[
    ".....oooooo.....",
    "...ooGGgGGgoo...",
    "..oGGgggGgggdo..",
    ".oGgggdggggGgdo.",
    ".ogggggggGggddo.",
    "ogGggdgggggggddo",
    "oggggggGgggdgddo",
    ".oddgggggggdddo.",
    "..oodddoodddoo..",
    "......owwo......",
    ".....owwwwo.....",
    ".....owooWo.....",
    ".....owoyWo.....",
    "....owwooWwo....",
    "...oooooooooo..."]},
  musicShroom: {art:[
    "....oooooo....",
    "..oop#pppppoo.",
    ".opp###ppp#ppo",
    "op#pppppp###po",
    "oppppp#ppppppo",
    "ommmmmmmmmmmmo",
    ".oooooooooooo.",
    "....oqqqqo....",
    "....oqtqqo....",
    "....oqqoqo....",
    "....oqqwqo....",
    "....oqqwqo....",
    "...oooooooo..."], remap:{t:"y"}},
  clockTower: {art:[
    "....oo....",
    "...oyyo...",
    "..oBBBBo..",
    ".oBBBBBBo.",
    "oooooooooo",
    ".ozzzzzzo.",
    ".oz####zo.",
    ".oz#o##zo.",
    ".oz#oo#zo.",
    ".oz####zo.",
    ".ozzzzzzo.",
    ".ozzBBzzo.",
    ".ozzBBzzo.",
    ".ozowwozo.",
    ".ozowwozo.",
    "oooooooooo"], alt:[
    "....oo....",
    "...oyyo...",
    "..oBBBBo..",
    ".oBBBBBBo.",
    "oooooooooo",
    ".ozzzzzzo.",
    ".oz####zo.",
    ".oz#o##zo.",
    ".oz#o##zo.",
    ".oz#o##zo.",
    ".ozzzzzzo.",
    ".ozzBBzzo.",
    ".ozzBBzzo.",
    ".ozowwozo.",
    ".ozowwozo.",
    "oooooooooo"]},
  chest: {art:[
    "....oo..oo..",
    "...oyyooyyo.",
    "..oooooooo..",
    ".owwwwwwwwo.",
    "owWwwwwwwWwo",
    "oyyyyyyyyyyo",
    "owwwwooowwwo",
    "owwwwoyowwwo",
    "owWwwooowWwo",
    "oyyyyyyyyyyo",
    "owwwwwwwwwwo",
    "oooooooooooo"], remap:{y:"z"}},

  /* ---- featured content ---- */
  truck: {art:[
    "........ooooo.",
    "........oBBRo.",
    ".ooooooooBBRRo",
    "oRRRRRRRRRRRRo",
    "oRyRRRRRRRRRyo",
    "oooooooooooooo",
    ".oooo....oooo.",
    "ooeeoo..ooeeoo",
    "ooeeoo..ooeeoo",
    ".oooo....oooo."], remap:{y:"z"}},
  easel: {art:[
    "oooooooooo",
    "o#pp###yyo",
    "o#pp#BB#yo",
    "o###BBB##o",
    "o#G####R#o",
    "oooooooooo",
    ".ow....wo.",
    ".ow....wo.",
    "ow......wo",
    "oo......oo"]},
  orrery: {art:[
    ".....ooo...o.",
    "....oyyyo.oBo",
    "...oyyLyyo.o.",
    "ttoyyyyyyyott",
    "...oyyyLyo...",
    "....oyyyo....",
    ".....ooo.....",
    "......o......",
    "....ooooo...."], remap:{L:"y", t:"q"}},
  spaceBook: {art:[
    ".oooo..oooo.",
    "o####oo####o",
    "o#ee#oo#yy#o",
    "o####oo#yy#o",
    "o#ee#oo####o",
    "o####oo#ee#o",
    "oooooooooooo",
    ".ouuuuuuuuo.",
    "..oooooooo.."], remap:{y:"t"}},

  /* ---- the kid ---- */
  hero: {art:[
    "..ooooo..",
    ".oHHHHHo.",
    "ohhhhhhho",
    ".ozzzzzo.",
    ".ozozozo.",
    ".ozzzzzo.",
    "..ooooo..",
    ".oHHHHHo.",
    "ozHHHHHzo",
    ".oHHHHHo.",
    ".ohhohho.",
    ".oo...oo."], alt:[
    "..ooooo..",
    ".oHHHHHo.",
    "ohhhhhhho",
    ".ozzzzzo.",
    ".ozozozo.",
    ".ozzozzo.",
    "..ooooo..",
    "zoHHHHHoz",
    ".oHHHHHo.",
    ".oHHHHHo.",
    ".ohhohho.",
    ".oo...oo."]},

  /* ---- toys ---- */
  appleTree: {art:[
    "...ooooo...",
    ".ooGGgGGoo.",
    "oGgRggggRgo",
    "ogggGggRggo",
    "oRgggggggdo",
    ".oddgggddo.",
    "..ooowooo..",
    "....owo....",
    "....owo....",
    "...ooooo..."]},
  chicken: {art:[
    "..oRRo...",
    ".o####o..",
    "yy#o##o..",
    ".o#####oo",
    ".o##c###o",
    "..o####o.",
    "...y.y...",
    "..yy.yy.."]},
  windmill: {art:[
    "#.......#",
    ".#.....#.",
    "..#...#..",
    "...oyo...",
    "..#ozo#..",
    ".#owzwo#.",
    "#.owwwo.#",
    "..owzwo..",
    "..owwwo..",
    ".owwWwwo.",
    ".ooooooo."], alt:[
    "....#....",
    "....#....",
    "....#....",
    "###oyo###",
    "...ozo...",
    "..owzwo..",
    "..owwwo..",
    "..owzwo..",
    "..owwwo..",
    ".owwWwwo.",
    ".ooooooo."]},
  cat: {art:[
    ".o.o......",
    "oKoKo.....",
    "oKKKKoooo.",
    "oKoKoKKKKo",
    ".oKKKKKKKo",
    "..oooooooo"], alt:[
    ".o.o......",
    "oKoKo.....",
    "oKKKKoooo.",
    "oyKyoKKKKo",
    ".oKpKKKKKo",
    "..oooooooo"]},
  robot: {art:[
    "...oRo..",
    ".oooooo.",
    ".oetteo.",
    ".oeeeeo.",
    ".oeyyeo.",
    ".oooooo.",
    "ooeeeeoo",
    "eoeRReoe",
    ".oeeeeo.",
    ".oo..oo."], remap:{t:"p", R:"y"}},
  gumball: {art:[
    "..oooo..",
    ".o#ptyo.",
    "o#yRBp#o",
    "o#BpyR#o",
    ".optRyo.",
    "..oooo..",
    ".oRRRRo.",
    ".oRyRRo.",
    ".oRRRRo.",
    "oooooooo"]},
  lavaVent: {art:[
    "..oLLo..",
    ".okLLko.",
    "okkkkkko",
    "okrkkkKo",
    "oooooooo"], remap:{L:"y"}},
  rockBuddy: {art:[
    "..oooo..",
    ".okKKko.",
    "okKkkkko",
    "okokkoko",
    "okkkkkko",
    "okkrrkko",
    ".oooooo."], alt:[
    "..oooo..",
    ".okKKko.",
    "okKkkkko",
    "okrkkrko",
    "okkkkkko",
    "okooooko",
    ".oooooo."]},
  snowman: {art:[
    "...ooo...",
    "..oWWWo..",
    ".ooooooo.",
    ".o#####o.",
    ".o#o#o#o.",
    ".o##L##o.",
    "..ooooo..",
    ".o##y##o.",
    "o#######o",
    "o###y###o",
    ".o#####o.",
    "..ooooo.."]},
  penguin: {art:[
    "..ooo..",
    ".ouuuo.",
    "ou#u#uo",
    "ouuyuuo",
    "ou###uo",
    "ou###uo",
    ".oyoyo."]},
  owl: {art:[
    ".o....o.",
    ".oWooWo.",
    "oWWWWWWo",
    "oyyWWyyo",
    "oyoWWoyo",
    "oWWLLWWo",
    "oWssssWo",
    ".oWssWo.",
    "..oyyo.."], alt:[
    ".o....o.",
    ".oWooWo.",
    "oWWWWWWo",
    "oWWWWWWo",
    "ooWWWWoo",
    "oWWLLWWo",
    "oWssssWo",
    ".oWssWo.",
    "..oyyo.."]},
  bush: {art:[
    "..oooooo..",
    ".oGGgGgdo.",
    "oGggGgggdo",
    "ogGgggGgdo",
    "odggggggdo",
    ".oooooooo."]},
  mushroom: {art:[
    "..oooooo..",
    ".oRR#RRRo.",
    "oR#RRRR#Ro",
    "oRRRR#RRRo",
    "oooooooooo",
    "...o##o...",
    "...o##o...",
    "..oooooo.."]},
  crystalCyan: {art:[
    "..oo..",
    ".o#to.",
    "o#ttBo",
    "o#ttBo",
    "otttBo",
    "ottBBo",
    ".oBBo.",
    "oooooo"]},
  crystalPink: {from:"crystalCyan", tint:{t:"p", B:"m"}},
  crystalLilac: {from:"crystalCyan", tint:{t:"q", B:"v"}},
  frog: {art:[
    ".oo..oo.",
    "o#oGGo#o",
    "oGGGGGGo",
    "oGooooGo",
    "oGGGGGGo",
    "ogGooGgo",
    "oo....oo"]},
  echoStone: {outline:true, art:[
    "....q....",
    "...q#q...",
    ".q.q#q.t.",
    "q#qq#qt#t",
    "q#qqqqt#t",
    "qqqvqqttt",
    "vvvvvvvvv"], remap:{q:"#", t:"i"}},
  sunflower: {outline:true, art:[
    "..yyy..",
    ".yWWWy.",
    "yWWWWWy",
    ".yWWWy.",
    "..yyy..",
    "...g...",
    ".GGg...",
    "...gGG.",
    "...g..."]},
  cow: {outline:true, art:[
    "c..c.......",
    "####.......",
    "#o#o###o###",
    "####o######",
    "pp#####oo##",
    "...########",
    "...#.#..#.#"]},
  beehive: {art:[
    "..ooo..",
    ".oyyyo.",
    "oWWWWWo",
    "oyyyyyo",
    "oWWoWWo",
    "oyyyyyo",
    ".ooooo."]},
  molehill: {art:[
    "...ooo...",
    "..oWWWo..",
    ".oWwWwWo.",
    "oWwWwWwWo",
    "ooooooooo"]},
  crab: {outline:true, art:[
    "RR.....RR",
    ".R.#.#.R.",
    ".RRRRRRR.",
    "RRRRRRRRR",
    "R.R.R.R.R"]},
  palm: {outline:true, art:[
    "..GG...GG..",
    ".GGGG.GGGG.",
    "GG..GGG..GG",
    "G..WGwGW..G",
    ".....w.....",
    "....w......",
    "....w......",
    "...ww......"]},
  whale: {outline:true, art:[
    "..........e.e",
    "...eeeee..ee.",
    ".eeeeeeeeee..",
    "eoeeeeeeeee..",
    "#####eeee....",
    ".#####......."]},
  fish: {outline:true, art:[
    "..LLL.L",
    ".LoLLLL",
    "..LLL.L"]},
  boat: {outline:true, art:[
    "....#.....",
    "....##....",
    "....###...",
    "....w.....",
    "RRRRRRRRRR",
    ".wWwWwWww.",
    "..wwwwww.."]},
  moon: {outline:true, art:[
    "...qqqqq...",
    ".qq#qqqqqq.",
    ".q#qqqqqqv.",
    "qqqoqqqoqvv",
    "qqqqqqqqqvv",
    "qqpqqqqqpvv",
    "qqqqoooqqvv",
    ".qqqqqqqvv.",
    ".qqqqqqvvv.",
    "...vvvvv..."], alt:[
    "...qqqqq...",
    ".qq#qqqqqq.",
    ".q#qqqqqqv.",
    "qqqoqqoooqv",
    "qqqqqqqqqvv",
    "qqpqqqqqpvv",
    "qqqqoooqqvv",
    ".qqqqqqqvv.",
    ".qqqqqqvvv.",
    "...vvvvv..."]},

  /* ---- particles + mini-game pieces ---- */
  pApple:   {art:[".G.","RRR","RRR"]},
  pEgg:     {art:[".#.","###",".#."]},
  pHeart:   {art:["p.p","ppp",".p."]},
  pNote:    {art:["..yy","..y.","yyy.","yy.."]},
  pGumball: {art:[".p.","ppp",".p."], remap:{p:"t"}},
  pLava:    {art:[".L.","LyL",".L."]},
  pSmoke:   {art:[".c.","c#c",".c."]},
  pSnow:    {art:[".#.","#.#",".#."]},
  pBunny:   {outline:true, art:["#.#","#.#","###","o#o","###"]},
  pSparkle: {art:[".z.","z#z",".z."]},
  pBee:     {art:["yoy"]},
  pCoconut: {art:["WW","WW"]},
  pDrop:    {art:["t","B"]},
  pRain:    {art:["B","B"]},
  pShooting:{art:["....#","..zz.","zz..."]},
  pZ:       {art:["###","..#",".#.","###"]},
  gStar:    {outline:true, art:["..y..",".yyy.","yyzyy",".yyy.","y...y"]},
  gBubble:  {art:[".iii.","i#..i","i...i","i...i",".iii."]},
  gBasket:  {outline:true, art:["w.....w","wWwWwWw",".wWwWw."]},
  gMole:    {art:[".ooooo.","oWWWWWo","oWoWoWo","oWWpWWo","oWWWWWo"]},
  gHole:    {art:[".ooooo.","oWWWWWo",".ooooo."]}
};

/* Which sprite draws each landmark from planet-map SITES. */
export const LANDMARK_SPRITE = {
  "section:quests":"questHut", "section:games":"arcade", "section:acts":"volcano", "section:learn":"observatory",
  "section:books":"libraryTree", "section:music":"musicShroom", "section:day":"clockTower", "section:rewards":"chest",
  "game:monster-truck":"truck", "game:paint":"easel", "game:solar":"orrery", "book:space":"spaceBook"
};

function rowsOf(name, frame){
  var def = SPRITES[name];
  if (!def) throw new Error("Unknown sprite " + name);
  if (def.from) {
    var base = rowsOf(def.from, frame);
    return base.map(function(row){return row.replace(/./g, function(ch){return def.tint[ch] || ch;});});
  }
  if (frame === 1 && def.alt) return def.alt;
  if (frame === 1 && def.remap) return def.art.map(function(row){return row.replace(/./g, function(ch){return def.remap[ch] || ch;});});
  return def.art;
}

export function frameCount(name){
  var def = SPRITES[name];
  if (def.from) return frameCount(def.from);
  return def.alt || def.remap ? 2 : 1;
}

/* Palette indices for one frame, -1 = transparent, padded 1px all round.
   variant: "normal" | "dark" (near the limb) | "sleep" (place not available — calm grey, never red). */
export function spritePixels(name, frame, variant, heroIndex){
  var def = SPRITES[name], rows = rowsOf(name, frame || 0);
  var outline = def.outline || (def.from && SPRITES[def.from].outline);
  var w = 0;
  rows.forEach(function(row){w = Math.max(w, row.length);});
  var W = w + 2, H = rows.length + 2, px = new Int16Array(W*H).fill(-1);
  var hero = heroIndex == null ? C.cyan : heroIndex;
  rows.forEach(function(row, y){
    for (var x = 0; x < row.length; x++) {
      var ch = row[x];
      if (ch === "." || ch === " ") continue;
      var index = ch === "H" ? hero : ch === "h" ? DARK[hero] : KEY[ch];
      if (index === undefined) throw new Error("Sprite " + name + " uses unknown pixel '" + ch + "'");
      px[(y+1)*W + x + 1] = index;
    }
  });
  if (outline) {
    var copy = px.slice();
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      if (copy[y*W + x] !== -1) continue;
      var near = (x > 0 && copy[y*W + x - 1] !== -1) || (x < W-1 && copy[y*W + x + 1] !== -1) ||
                 (y > 0 && copy[(y-1)*W + x] !== -1) || (y < H-1 && copy[(y+1)*W + x] !== -1);
      if (near) px[y*W + x] = C.outline;
    }
  }
  if (variant === "dark" || variant === "sleep") {
    for (var i = 0; i < px.length; i++) {
      var c = px[i];
      if (c < 0 || c === C.outline) continue;
      if (variant === "dark") px[i] = DARK[c];
      else { var lum = luminance(c); px[i] = lum > 0.6 ? C.snowShade : lum > 0.35 ? C.grey : C.steel; }
    }
  }
  return {width:W, height:H, pixels:px};
}

/* Browser only: rasterise every sprite into canvases. atlas[name][variant][frame] -> canvas. */
export function buildAtlas(heroIndex){
  var atlas = {};
  Object.keys(SPRITES).forEach(function(name){
    atlas[name] = {};
    ["normal","dark","sleep"].forEach(function(variant){
      atlas[name][variant] = [];
      for (var f = 0; f < frameCount(name); f++) {
        var sprite = spritePixels(name, f, variant, heroIndex);
        var canvas = document.createElement("canvas");
        canvas.width = sprite.width; canvas.height = sprite.height;
        var ctx = canvas.getContext("2d"), img = ctx.createImageData(sprite.width, sprite.height);
        var out = new Uint32Array(img.data.buffer);
        for (var i = 0; i < sprite.pixels.length; i++) out[i] = sprite.pixels[i] < 0 ? 0 : RGBA[sprite.pixels[i]];
        ctx.putImageData(img, 0, 0);
        atlas[name][variant].push(canvas);
      }
    });
  });
  return atlas;
}
