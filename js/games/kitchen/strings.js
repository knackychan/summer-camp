/* Summer Quest's bilingual presentation for Kitchen Quest v0.7.0. */
export const FOOD = {
  patty: ["Patty", "肉排"], "patty-raw": ["Raw patty", "生肉排"],
  cheese: ["Cheese", "起司"], tomato: ["Tomato", "番茄"], lettuce: ["Lettuce", "生菜"],
  pickles: ["Pickles", "酸黃瓜"], sauce: ["Sauce", "醬汁"], lasagna: ["Lasagna", "千層麵"], pasta: ["Pasta", "麵皮"]
};
export const RECIPES = {
  "cheese-burger": ["Cheeseburger", "起司漢堡"], "garden-burger": ["Garden burger", "蔬菜漢堡"],
  "double-tomato-burger": ["Double tomato burger", "雙份番茄漢堡"],
  "garden-salad": ["Garden salad", "田園沙拉"], "baked-lasagna": ["Baked lasagna", "焗烤千層麵"],
  "pickle-crunch-burger": ["Pickle crunch burger", "脆酸黃瓜漢堡"],
  "double-stack-burger": ["Double stack burger", "雙層肉排漢堡"],
  "chef-salad": ["Chef salad", "主廚沙拉"], "lasagna-feast": ["Lasagna feast", "千層麵盛宴"],
  "veggie-melt": ["Veggie melt", "蔬菜起司堡"], "saucy-burger": ["Saucy burger", "醬香漢堡"],
  "cheese-lover-burger": ["Cheese lover burger", "起司控漢堡"], "crunchy-pickle-salad": ["Crunchy pickle salad", "脆脆酸黃瓜沙拉"],
  "cheesy-lasagna": ["Cheesy lasagna", "起司千層麵"], "everything-burger": ["Everything burger", "豪華全餐漢堡"],
  "lasagna-duo": ["Lasagna duo", "雙份千層麵"], "triple-decker-burger": ["Triple decker burger", "三層肉排漢堡"]
};
export const REQUESTS = {
  "no-cheese": ["No cheese, please", "請不要加起司"],
  "extra-tomato": ["Extra tomato, please", "請多加番茄"],
  "extra-pickles": ["Extra pickles, please", "請多加酸黃瓜"]
};
export const GOALS = {
  served: ["Dishes", "完成餐點"], recipes: ["Recipes", "不同食譜"],
  salad: ["Salad", "沙拉"], lasagna: ["Lasagna", "千層麵"],
  "double-stack-burger": ["Double stack", "雙層肉排漢堡"]
};
export const HEAT = {
  empty: ["Start cooking", "開始煎肉排"], "side-one": ["Cooking side 1", "正在煎第一面"],
  flip: ["Flip now", "翻面囉"], "side-two": ["Cooking side 2", "正在煎第二面"],
  baking: ["Baking", "烘烤中"], ready: ["Collect", "取出"], burnt: ["Try again", "再試一次"]
};
/* What the patty reserved on a plate is doing right now. The ticket row, the customer card, the hint
   under the counter and the dashed tray on the plate all read from here, so they can never disagree
   with the pan. Keyed by the pan's phase. */
export const PATTY = {
  "side-one": ["On the grill", "煎肉排中"], "side-two": ["On the grill", "煎肉排中"],
  flip: ["Flip it!", "翻面囉！"], ready: ["Ready!", "煎好了！"], burnt: ["Try again", "再試一次"]
};
export const PATTY_HINT = {
  "side-one": ["Patty on the grill. It needs a flip soon.", "肉排在煎，等一下要翻面。"],
  "side-two": ["Patty on the grill. Almost done!", "肉排在煎，快好了！"],
  flip: ["Flip the patty!", "把肉排翻面！"],
  ready: ["Take the patty out of the pan!", "把肉排從鍋子取出來！"],
  burnt: ["That patty got too dark. Try a fresh one!", "這份肉排煎太久了，再煎一份新的吧！"]
};
export const REJECT = {
  full: ["The plate is full. Remove a layer first.", "盤子滿了，先移除一層食材。"],
  empty: ["Add something to the plate first.", "先在盤子裡放食材。"],
  busy: ["One moment, chef!", "小廚師，稍等一下！"],
  stale: ["The plate changed. Try again.", "盤子更新了，請再試一次。"],
  duplicate: ["Already done!", "已經完成囉！"],
  stock: ["Prepare more at the chopping board or oven.", "到砧板或烤箱準備更多食材。"],
  "grill-full": ["Both pans are busy. Flip and collect a patty first.", "兩個平底鍋都在用，先翻面並取出肉排。"],
  cooking: ["Finish grilling the patties before serving.", "先把肉排煎好再上菜。"]
};
const KITCHEN = {
  "That layer has already changed.": "這一層已經更新了。",
  "Finish this batch, or reset the board first.": "先切完這批，或重設砧板。",
  "Four cuts make six tomato slices.": "切四下，可以準備六份番茄。",
  "Three cuts make six lettuce portions.": "切三下，可以準備六份生菜。",
  "Fresh chopping board.": "砧板整理好了。",
  "Shelf full. Use some prepared stock first.": "食材架滿了，先用一些備好的食材。",
  "+6 tomato slices in stock!": "備好了六份番茄！",
  "+6 lettuce portions in stock!": "備好了六份生菜！",
  "Unknown grill.": "請選擇一個平底鍋。",
  "That grill action has already finished.": "這個煎鍋步驟已經完成了。",
  "Patty shelf full. Serve or use some stock first.": "肉排架滿了，先上菜或用掉一些肉排。",
  "Two patties sizzling. Flip when the timer rings.": "正在煎兩份肉排，時間到就翻面。",
  "Flipped! Finish the second side.": "翻面了！繼續煎第二面。",
  "Cooked patty returned to its customer’s dish!": "煎好的肉排回到客人的盤子上了！",
  "+1 grilled patty in stock!": "備好了一份熟肉排！",
  "+2 grilled patties in stock!": "備好了兩份熟肉排！",
  "Use some cooked stock before trying again.": "先用掉一些熟肉排，再試一次。",
  "Fresh raw patty. Same customer, same place. Try again!": "換一份生肉排，繼續幫同一位客人料理！",
  "Pan cleared. Try another batch.": "鍋子清好了，再煎一批吧。",
  "Still cooking. Prep something else while you wait.": "還在煎，可以先準備其他食材。",
  "Unknown layer.": "請選擇一種食材。",
  "The tray is full. Tap a layer to remove it, or put it in the oven.": "烤盤滿了，點一層移除，或放進烤箱。",
  "Layer added.": "食材加好了。",
  "That layer is no longer on the tray.": "這一層已經不在烤盤上。",
  "Layer removed. The other layers stay in place.": "移除了這一層，其他食材都還在。",
  "Last layer removed.": "已移除最後一層。",
  "Empty baking tray.": "烤盤清空了。",
  "That oven action has already finished.": "這個烤箱步驟已經完成了。",
  "Follow the six lasagna layers. Tap any wrong layers to remove them before baking.": "依序放好六層食材，烘烤前可點選錯的食材移除。",
  "Lasagna shelf full. Serve some portions first.": "千層麵架滿了，先上一些菜吧。",
  "Lasagna baking. You can prepare the next tray meanwhile.": "千層麵烘烤中，可以先準備下一盤。",
  "+4 baked lasagna portions in stock!": "備好了四份焗烤千層麵！",
  "Oven cleared. No other stock was lost.": "烤箱清好了，其他食材都還在。",
  "The lasagna is still baking.": "千層麵還在烤。",
  "Unknown kitchen action.": "請選擇料理步驟。",
  "That action is no longer active.": "步驟更新了，請再試一次。"
};
export function kitchenMessage(message) {
  const cuts = message.match(/^(\d+) \/ (\d+) cuts$/);
  return [message, cuts ? "已切 " + cuts[1] + " / " + cuts[2] + " 下" : KITCHEN[message] || "步驟更新了，請再試一次。"];
}
