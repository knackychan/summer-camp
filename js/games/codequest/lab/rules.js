/* Laboratory of Curiosity reaction rules (design.md D4, rules table). Checked in order,
   first match wins: the authored special, then systemic rules most specific first, then
   fallbacks — so every mix makes *something*. `test(sums, mix)` reads the summed
   properties (after process steps) and the ingredient counts; `over(sums)` says how far
   past its threshold the deciding value is, which sets the effect's intensity. `line` is
   the Journal's one-sentence rule, written as a discovery, never as a mistake.
   Phase 2 (lab-states design D4): `test` also gets `states` — how many crushed / heated /
   frozen ingredients the mix holds — and four rules need a changed ingredient. */

const rule = (id, family, label, line, test, over = () => 0) =>
  Object.freeze({ id, family, label: Object.freeze(label), line: Object.freeze(line), test, over });

export const LAB_RULES = Object.freeze([
  rule('pocketUniverse', 'reality', ['Pocket Universe', '口袋宇宙'],
    ['Moonflower, Echo Crystal and Void Dust fold into a tiny galaxy.', '月光花、回音水晶和虛空塵摺成一個小小銀河。'],
    (s, mix) => mix.moonflower > 0 && mix.echoCrystal > 0 && mix.voidDust > 0),
  rule('explosion', 'instability', ['Spectacular Explosion', '超級大爆炸'],
    ['Too much chaos and not enough calm goes BOOM.', '混亂太多、平靜太少，就會「砰」！'],
    s => s.instability >= 5, s => s.instability - 5),
  rule('thermalShock', 'elemental', ['Thermal Shock', '冷熱大爆裂'],
    ['Something frozen meets something hot — crack, pop!', '冰凍的東西碰到熱的東西——喀啦、啪！'],
    (s, mix, st) => !!st && st.frozen > 0 && st.heated > 0, s => Math.min(s.cold, s.fire) - 2),
  rule('temporalRupture', 'time', ['Time Rewind', '時間倒轉'],
    ['Lots of time magic makes things jump backwards.', '很多時間魔法會讓東西倒退回去。'],
    s => s.time >= 2, s => s.time - 2),
  rule('singularity', 'space', ['Pocket Singularity', '迷你黑洞'],
    ['Strong space magic plus energy pulls everything closer.', '強大的空間魔法加上能量，會把東西都吸過來。'],
    s => s.space >= 3 && s.fire + s.light >= 2, s => s.space - 3),
  rule('snowflakeCopies', 'replication', ['Snowflake Copies', '雪花複製'],
    ['Echo copies frozen things as snowflakes.', '回音會把冰凍的東西複製成雪花。'],
    (s, mix, st) => !!st && st.frozen > 0 && s.echo >= 2 && s.cold >= 2, s => s.echo - 2),
  rule('monstrosity', 'creature', ['Cute Monstrosity', '可愛小怪物'],
    ['Echo + lots of life + growth = a new little creature!', '回音＋很多生命＋生長＝一隻新的小生物！'],
    s => s.echo >= 2 && s.life >= 3 && s.growth >= 1, s => s.life - 3),
  rule('duplication', 'replication', ['Duplication Bloom', '複製大爆發'],
    ['Echo copies living things — more echo, more copies.', '回音會複製有生命的東西，回音越多，複製越多。'],
    s => s.echo >= 2 && s.life + s.growth >= 2, s => s.echo - 2),
  rule('overgrowth', 'biological', ['Impossible Overgrowth', '瘋狂生長'],
    ['Growth + life + water makes plants grow everywhere.', '生長＋生命＋水，植物就會到處長。'],
    s => s.growth >= 3 && s.life >= 2 && s.water >= 1, s => s.growth - 3),
  rule('flamingVines', 'biological', ['Flaming Vines', '火焰藤蔓'],
    ['Heated growth turns into burning vines.', '加熱過的生長力會變成燃燒的藤蔓。'],
    (s, mix, st) => !!st && st.heated > 0 && s.fire >= 2 && s.growth >= 2, s => s.growth - 2),
  rule('fireball', 'elemental', ['Fireball', '火球'],
    ['Lots of fire turns into a flying fireball.', '很多火會變成一顆飛出去的火球。'],
    s => s.fire >= 4, s => s.fire - 4),
  rule('iceBurst', 'elemental', ['Ice Burst', '冰霜爆發'],
    ['Lots of cold freezes the cauldron rim.', '很多寒冷會把鍋邊凍起來。'],
    s => s.cold >= 3, s => s.cold - 3),
  rule('glitterStorm', 'light', ['Glitter Storm', '閃粉風暴'],
    ['Crushed light turns into a storm of glitter.', '碾碎的光會變成一場閃粉風暴。'],
    (s, mix, st) => !!st && st.crushed > 0 && s.light >= 2, s => s.light - 2),
  rule('glow', 'light', ['Glowing Room', '發光房間'],
    ['Lots of light makes the whole lab shine.', '很多光會讓整間實驗室亮起來。'],
    s => s.light >= 3, s => s.light - 3),
  rule('steam', 'elemental', ['Steam Cloud', '蒸氣雲'],
    ['Fire and water together make steam.', '火和水碰在一起就會變成蒸氣。'],
    s => s.fire >= 1 && s.water >= 1, s => Math.min(s.fire, s.water) - 1),
  rule('bubbles', 'fallback', ['Bubbles', '泡泡'],
    ['Water likes to bubble up.', '水喜歡冒泡泡。'],
    s => s.water >= 1, s => s.water - 1),
  rule('smoke', 'fallback', ['Smoke Ring', '煙圈'],
    ['A little fire makes a puff of smoke.', '一點點火會冒出一團煙。'],
    s => s.fire >= 1, s => s.fire - 1),
  rule('fizzle', 'fallback', ['Fizzle', '嘶嘶聲'],
    ['Not much happened… yet. Try adding something new!', '還沒什麼事發生……試試加點新東西！'],
    () => true)
]);
