/* Giraffe Book data - card deck for the giraffe reader.
   Local photos live in assets/books/giraffe/. */

var GIRAFFE_CARDS = [
  {
    id: "giraffe", emoji: "🦒", nameEN: "Giraffe", nameZH: "長頸鹿", photo: "../assets/books/giraffe/giraffe.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "Giraffes are the tallest land animals on Earth.", tz: "長頸鹿是地球上最高的陸地動物。" },
      { en: "Their long necks help them reach leaves high in trees.", tz: "長長的脖子幫助牠們吃到高高樹上的葉子。" },
      { en: "Their spotted coats help each giraffe blend into the savanna.", tz: "身上的斑點幫助每隻長頸鹿融入草原環境。" },
    ]
  },
  {
    id: "neck", emoji: "🦒", nameEN: "Long Neck", nameZH: "長脖子", photo: "../assets/books/giraffe/neck.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "A giraffe's neck has seven bones, just like a human neck.", tz: "長頸鹿的脖子和人類一樣有七塊骨頭。" },
      { en: "The bones are just much longer and stretch the neck up high.", tz: "只是這些骨頭長得多，讓脖子伸得很高。" },
      { en: "The tall neck helps giraffes see far across the grasslands.", tz: "高高的脖子也幫助牠們看得更遠。" },
    ]
  },
  {
    id: "spots", emoji: "🦒", nameEN: "Spots", nameZH: "斑點", photo: "../assets/books/giraffe/spots.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "No two giraffes have the same spot pattern.", tz: "沒有兩隻長頸鹿的斑點圖案完全一樣。" },
      { en: "Scientists can use spots to tell giraffes apart.", tz: "科學家可以用斑點分辨不同的長頸鹿。" },
      { en: "The spots may help with camouflage and body cooling.", tz: "斑點可能有助於偽裝和散熱。" },
    ]
  },
  {
    id: "tongue", emoji: "🦒", nameEN: "Tongue", nameZH: "舌頭", photo: "../assets/books/giraffe/tongue.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "A giraffe's tongue can be about 45 centimetres long.", tz: "長頸鹿的舌頭大約可長達45公分。" },
      { en: "The tongue is dark, which may help protect it from the sun.", tz: "舌頭顏色偏深，可能幫助它抵擋太陽。" },
      { en: "A long tongue helps giraffes pull leaves from thorny branches.", tz: "長舌頭能幫助牠們從長刺的樹枝上拉下葉子。" },
    ]
  },
  {
    id: "food", emoji: "🦒", nameEN: "Food", nameZH: "食物", photo: "../assets/books/giraffe/food.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "Giraffes mostly eat leaves, especially acacia leaves.", tz: "長頸鹿主要吃葉子，尤其是金合歡樹葉。" },
      { en: "Their flexible lips help them choose around sharp thorns.", tz: "靈活的嘴唇幫助牠們避開尖刺。" },
      { en: "They are careful browsers, not grass grazers.", tz: "牠們是細心挑選葉子的樹食者，不是吃草的動物。" },
    ]
  },
  {
    id: "legs", emoji: "🦒", nameEN: "Legs", nameZH: "腿", photo: "../assets/books/giraffe/legs.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "A giraffe's legs are long and powerful.", tz: "長頸鹿的腿又長又有力。" },
      { en: "They can walk very fast and gallop when they need to.", tz: "牠們可以走得很快，需要時也能奔跑。" },
      { en: "A strong kick can help a giraffe stay safe.", tz: "有力的一踢可以幫助長頸鹿保護自己。" },
    ]
  },
  {
    id: "baby", emoji: "🦒", nameEN: "Baby Giraffe", nameZH: "長頸鹿寶寶", photo: "../assets/books/giraffe/baby.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "A baby giraffe is called a calf.", tz: "長頸鹿寶寶叫做幼崽。" },
      { en: "Calves can stand soon after birth.", tz: "幼崽出生後很快就能站起來。" },
      { en: "They drink milk from their mother while they grow.", tz: "牠們會喝媽媽的奶長大。" },
    ]
  },
  {
    id: "sleep", emoji: "🦒", nameEN: "Sleep", nameZH: "睡覺", photo: "../assets/books/giraffe/sleep.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "Giraffes sleep in very short naps.", tz: "長頸鹿睡覺時常常只小睡一會兒。" },
      { en: "They may rest only a little each day.", tz: "牠們每天休息的時間可能很少。" },
      { en: "A giraffe can stay alert while resting.", tz: "長頸鹿休息時也能保持警覺。" },
    ]
  },
  {
    id: "habitat", emoji: "🦒", nameEN: "Habitat", nameZH: "棲地", photo: "../assets/books/giraffe/habitat.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "Giraffes live in African savannas and open woodlands.", tz: "長頸鹿住在非洲的稀樹草原和開闊林地。" },
      { en: "They like places with trees to browse and open space to move.", tz: "牠們喜歡有樹可吃葉子、又有空間活動的地方。" },
      { en: "Giraffes travel where food and water are nearby.", tz: "牠們會隨著食物和水源移動。" },
    ]
  },
  {
    id: "family", emoji: "🦒", nameEN: "Family", nameZH: "家族", photo: "../assets/books/giraffe/family.jpg",
    typeEN: "GIRAFFE FACT", typeZH: "長頸鹿知識",
    facts: [
      { en: "A group of giraffes is sometimes called a tower.", tz: "一群長頸鹿有時候叫做 tower（高塔群）。" },
      { en: "Mothers help calves learn and stay safe.", tz: "母親會幫助幼崽學習和保持安全。" },
      { en: "Giraffes often live in loose groups instead of big herds.", tz: "長頸鹿常常以鬆散的群體生活，不一定成大群。" },
    ]
  },
];
