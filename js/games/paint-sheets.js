/* Colouring sheets for the Paint game — hand-drawn SVG line art, viewBox 0 0 400 300.
   Every shape with class="z" is tappable and gets filled with the chosen colour.
   Shapes without it (whiskers, antennae, mouths) are decoration lines only.
   The wrapping <svg> and its stroke/fill defaults live in paint.js, not here. */

export var SHEETS = [
  { id: "blank", icon: "⬜", name: ["Blank page", "空白頁"], svg: "" },

  { id: "house", icon: "🏠", name: ["House", "房子"], svg:
      '<rect class="z" x="0" y="250" width="400" height="50"/>'
    + '<circle class="z" cx="52" cy="52" r="28"/>'
    + '<path class="z" d="M250 62a24 24 0 0 1 46-8 20 20 0 0 1 4 38h-46a18 18 0 0 1-4-30z"/>'
    + '<rect class="z" x="330" y="200" width="18" height="50"/>'
    + '<circle class="z" cx="339" cy="186" r="34"/>'
    + '<rect class="z" x="252" y="86" width="26" height="42"/>'
    + '<rect class="z" x="110" y="140" width="180" height="110"/>'
    + '<path class="z" d="M95 140 200 68 305 140Z"/>'
    + '<rect class="z" x="180" y="185" width="42" height="65" rx="4"/>'
    + '<rect class="z" x="128" y="165" width="40" height="38"/>'
    + '<rect class="z" x="235" y="165" width="40" height="38"/>' },

  { id: "fish", icon: "🐟", name: ["Fish", "小魚"], svg:
      '<path class="z" d="M295 150 365 100v100z"/>'
    + '<path class="z" d="M160 96 200 54 240 100z"/>'
    + '<path class="z" d="M170 206 205 246 236 204z"/>'
    + '<ellipse class="z" cx="190" cy="150" rx="105" ry="62"/>'
    + '<path d="M148 108c-14 26-14 58 0 84" fill="none"/>'
    + '<circle class="z" cx="120" cy="130" r="15"/>'
    + '<circle cx="120" cy="130" r="5" fill="#20143a" stroke="none"/>'
    + '<circle class="z" cx="68" cy="82" r="12"/>'
    + '<circle class="z" cx="44" cy="46" r="8"/>'
    + '<circle class="z" cx="92" cy="38" r="6"/>' },

  { id: "digger", icon: "🚜", name: ["Digger", "挖土機"], svg:
      '<path class="z" d="M255 165 330 92l24 18-72 74z"/>'
    + '<path class="z" d="M334 100 372 148l-24 16-34-48z"/>'
    + '<path class="z" d="M330 158h64v36a22 22 0 0 1-22 22h-42z"/>'
    + '<rect class="z" x="60" y="150" width="200" height="66" rx="10"/>'
    + '<rect class="z" x="80" y="94" width="92" height="58" rx="8"/>'
    + '<rect class="z" x="92" y="106" width="66" height="34" rx="4"/>'
    + '<rect class="z" x="40" y="214" width="240" height="46" rx="23"/>'
    + '<circle class="z" cx="80" cy="237" r="14"/>'
    + '<circle class="z" cx="160" cy="237" r="14"/>'
    + '<circle class="z" cx="240" cy="237" r="14"/>' },

  { id: "butterfly", icon: "🦋", name: ["Butterfly", "蝴蝶"], svg:
      '<path class="z" d="M188 106C120 40 40 70 62 130c14 40 90 40 126 16z"/>'
    + '<path class="z" d="M212 106C280 40 360 70 338 130c-14 40-90 40-126 16z"/>'
    + '<path class="z" d="M188 164C130 190 70 216 96 250c20 26 80-6 92-46z"/>'
    + '<path class="z" d="M212 164C270 190 330 216 304 250c-20 26-80-6-92-46z"/>'
    + '<ellipse class="z" cx="200" cy="152" rx="14" ry="72"/>'
    + '<circle class="z" cx="200" cy="70" r="16"/>'
    + '<path d="M192 58 172 30M208 58 228 30" fill="none"/>'
    + '<circle class="z" cx="120" cy="112" r="14"/>'
    + '<circle class="z" cx="280" cy="112" r="14"/>'
    + '<circle class="z" cx="130" cy="214" r="10"/>'
    + '<circle class="z" cx="270" cy="214" r="10"/>' },

  { id: "dino", icon: "🦕", name: ["Dinosaur", "恐龍"], svg:
      '<path class="z" d="M120 212C70 206 30 236 18 252c42 6 72-4 102-16z"/>'
    + '<path class="z" d="M150 148 168 108 188 148z"/>'
    + '<path class="z" d="M194 140 214 98 236 140z"/>'
    + '<path class="z" d="M240 146 258 112 274 150z"/>'
    + '<ellipse class="z" cx="190" cy="196" rx="90" ry="58"/>'
    + '<path class="z" d="M250 162c10-52 30-82 70-86 34-4 56 20 54 44-2 26-28 38-50 36-16-2-30 6-38 22z"/>'
    + '<circle cx="332" cy="112" r="6" fill="#20143a" stroke="none"/>'
    + '<rect class="z" x="148" y="234" width="36" height="50" rx="8"/>'
    + '<rect class="z" x="214" y="234" width="36" height="50" rx="8"/>' },

  { id: "rocket", icon: "🚀", name: ["Rocket", "火箭"], svg:
      '<circle class="z" cx="58" cy="60" r="9"/>'
    + '<circle class="z" cx="340" cy="82" r="11"/>'
    + '<circle class="z" cx="330" cy="30" r="6"/>'
    + '<circle class="z" cx="70" cy="200" r="7"/>'
    + '<path class="z" d="M200 252c-22 18-30 42-30 42 20-4 30-10 30-10s10 6 30 10c0 0-8-24-30-42z"/>'
    + '<path class="z" d="M154 168 108 236h46z"/>'
    + '<path class="z" d="M246 168 292 236h-46z"/>'
    + '<path class="z" d="M200 38c34 34 46 96 46 152v56h-92v-56c0-56 12-118 46-152z"/>'
    + '<rect class="z" x="154" y="206" width="92" height="30"/>'
    + '<circle class="z" cx="200" cy="128" r="26"/>' },

  { id: "rainbow", icon: "🌈", name: ["Rainbow", "彩虹"], svg:
      '<path class="z" d="M30 250a170 170 0 0 1 340 0h-24a146 146 0 0 0-292 0z"/>'
    + '<path class="z" d="M54 250a146 146 0 0 1 292 0h-24a122 122 0 0 0-244 0z"/>'
    + '<path class="z" d="M78 250a122 122 0 0 1 244 0h-24a98 98 0 0 0-196 0z"/>'
    + '<path class="z" d="M102 250a98 98 0 0 1 196 0h-24a74 74 0 0 0-148 0z"/>'
    + '<path class="z" d="M126 250a74 74 0 0 1 148 0h-24a50 50 0 0 0-100 0z"/>'
    + '<ellipse class="z" cx="52" cy="254" rx="48" ry="27"/>'
    + '<ellipse class="z" cx="348" cy="254" rx="48" ry="27"/>'
    + '<circle class="z" cx="200" cy="60" r="26"/>' },

  { id: "cat", icon: "🐱", name: ["Cat", "貓咪"], svg:
      '<ellipse class="z" cx="300" cy="222" rx="44" ry="15" transform="rotate(-25 300 222)"/>'
    + '<ellipse class="z" cx="200" cy="216" rx="80" ry="62"/>'
    + '<ellipse class="z" cx="168" cy="268" rx="24" ry="14"/>'
    + '<ellipse class="z" cx="232" cy="268" rx="24" ry="14"/>'
    + '<path class="z" d="M142 92 150 38 190 72z"/>'
    + '<path class="z" d="M258 92 250 38 210 72z"/>'
    + '<circle class="z" cx="200" cy="120" r="62"/>'
    + '<circle class="z" cx="178" cy="112" r="10"/>'
    + '<circle class="z" cx="222" cy="112" r="10"/>'
    + '<path class="z" d="M191 138h18l-9 11z"/>'
    + '<path d="M200 149v7m0 0c-7 11-21 9-25 1m25-1c7 11 21 9 25 1" fill="none"/>'
    + '<path d="M150 130 106 122M150 142 108 148M250 130 294 122M250 142 292 148" fill="none"/>' },

  { id: "castle", icon: "🏰", name: ["Castle", "城堡"], svg:
      '<rect class="z" x="0" y="258" width="400" height="42"/>'
    + '<path d="M90 70V36M310 70V36" fill="none"/>'
    + '<path class="z" d="M90 38h36l-13 13 13 13H90z"/>'
    + '<path class="z" d="M310 38h36l-13 13 13 13h-36z"/>'
    + '<path class="z" d="M52 130 90 68 128 130z"/>'
    + '<path class="z" d="M272 130 310 68 348 130z"/>'
    + '<rect class="z" x="60" y="130" width="60" height="128"/>'
    + '<rect class="z" x="280" y="130" width="60" height="128"/>'
    + '<rect class="z" x="120" y="166" width="160" height="92"/>'
    + '<rect class="z" x="120" y="144" width="160" height="22"/>'
    + '<rect class="z" x="78" y="164" width="24" height="34" rx="12"/>'
    + '<rect class="z" x="298" y="164" width="24" height="34" rx="12"/>'
    + '<path class="z" d="M175 258v-44a25 25 0 0 1 50 0v44z"/>' },

  { id: "flower", icon: "🌼", name: ["Flower", "花"], svg:
      '<rect class="z" x="194" y="130" width="12" height="102"/>'
    + '<path class="z" d="M194 218c-40-6-56-30-58-52 26 0 54 18 58 52z"/>'
    + '<path class="z" d="M206 234c40-6 56-30 58-52-26 0-54 18-58 52z"/>'
    + '<path class="z" d="M150 230h100l-14 62h-72z"/>'
    + '<ellipse class="z" cx="200" cy="58" rx="24" ry="34"/>'
    + '<ellipse class="z" cx="245" cy="84" rx="24" ry="34" transform="rotate(60 245 84)"/>'
    + '<ellipse class="z" cx="245" cy="136" rx="24" ry="34" transform="rotate(120 245 136)"/>'
    + '<ellipse class="z" cx="200" cy="162" rx="24" ry="34"/>'
    + '<ellipse class="z" cx="155" cy="136" rx="24" ry="34" transform="rotate(60 155 136)"/>'
    + '<ellipse class="z" cx="155" cy="84" rx="24" ry="34" transform="rotate(120 155 84)"/>'
    + '<circle class="z" cx="200" cy="110" r="30"/>' },

  { id: "treasure", icon: "🗺️", name: ["Treasure map", "藏寶圖"], svg:
      '<path class="z" d="M20 24h360v252H20z"/>'
    + '<path class="z" d="M60 200c30-16 26-56 60-56 32 0 30 34 62 34 30 0 36-30 66-30 22 0 32 14 46 22" fill="none"/>'
    + '<path class="z" d="M76 96a26 26 0 1 1 52 0c0 20-26 44-26 44s-26-24-26-44z"/>'
    + '<path class="z" d="M150 250 176 206h48l26 44z"/>'
    + '<path d="M286 96 322 132M322 96 286 132" fill="none" stroke-width="7"/>'
    + '<circle class="z" cx="304" cy="114" r="34" fill="none"/>'
    + '<path class="z" d="M200 60 210 84 234 84 214 98 222 122 200 108 178 122 186 98 166 84 190 84z"/>'
    + '<path d="M110 172h180" fill="none" stroke-dasharray="10 12"/>' }
];

export default SHEETS;
