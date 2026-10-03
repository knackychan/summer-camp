/* SQQuestData — default quest/routine catalog.
   This is seed data only. Papa's saved catalog in family_settings can replace it
   without changing the Quest Engine or child UI. Kid-facing copy is bilingual. */
(function(){
  const ALL_KIDS=["lucien","lili","luis"];
  const Q=[
    {
      id:"morning_teeth", enabled:true, type:"routine", required:true,
      icon:"🪥", category:"care", priority:96,
      title:["Morning Teeth","早晨刷牙"],
      blurb:["Brush carefully and start the day fresh.","仔細刷牙，清清爽爽開始一天。"],
      duration:3, energy:"low", after:6*60, before:11*60, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:5,
      steps:[
        ["Brush the front, back and chewing surfaces.","外側、內側和咬合面都要刷到。"],
        ["Slow down around the back teeth.","後排牙齒慢慢刷乾淨。"],
        ["Rinse and put everything back.","漱口，然後把東西放回去。"]
      ]
    },
    {
      id:"plant_patrol", enabled:true, type:"routine", required:false,
      icon:"🌱", category:"care", priority:74,
      title:["Plant Patrol","植物巡邏"],
      blurb:["Check the plants and help the thirsty ones.","檢查植物，幫口渴的植物澆水。"],
      duration:5, energy:"low", after:8*60, before:19*60, oncePerDay:true,
      frequency:{type:"interval_days",every:2,anchor:"2026-09-23"}, allowedKids:ALL_KIDS, rewardPoints:10,
      steps:[
        ["Touch the soil gently. Is it dry or still damp?","輕輕摸摸土。是乾的還是還有點濕？"],
        ["Water only the plants that need it.","只幫需要水的植物澆水。"],
        ["Look for dry leaves and tidy the plant area.","找找乾掉的葉子，把植物旁邊整理好。"]
      ]
    },
    {
      id:"room_rescue", enabled:true, type:"quest", required:false, verification:"parent",
      icon:"🧸", category:"help", priority:70,
      title:["Room Rescue","房間救援"],
      blurb:["Put ten things back where they belong.","把十樣東西放回它們的家。"],
      duration:8, energy:"medium", after:8*60, before:20*60+30, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:10,
      steps:[
        ["Rescue five things from the floor.","先從地上救回五樣東西。"],
        ["Find five more things and put them home.","再找五樣東西，把它們放回原位。"],
        ["Do one final floor check.","最後檢查一次地板。"]
      ]
    },
    {
      id:"laundry_helper", enabled:true, type:"quest", required:false, verification:"parent",
      icon:"🧺", category:"help", priority:58,
      title:["Laundry Helper","洗衣小幫手"],
      blurb:["Sort, fold or put away a small batch of clothes.","分類、摺好或收好一小批衣服。"],
      duration:10, energy:"medium", after:9*60, before:19*60, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:15,
      steps:[
        ["Pick one small pile — not the whole mountain.","先選一小堆，不用一次處理全部。"],
        ["Sort or fold each piece.","把每一件分類或摺好。"],
        ["Put the pile where it belongs.","把這一小堆放回正確的位置。"]
      ]
    },
    {
      id:"table_helper", enabled:true, type:"quest", required:false,
      icon:"🍽️", category:"help", priority:61,
      title:["Table Helper","餐桌小幫手"],
      blurb:["Help set, clear or wipe the table.","幫忙擺桌、收桌或擦桌子。"],
      duration:5, energy:"low", after:7*60+30, before:20*60, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:5,
      steps:[
        ["Ask which table job is useful right now.","先問現在最需要幫忙哪一個餐桌工作。"],
        ["Do that one job carefully.","把那一件工作好好完成。"],
        ["Check if your spot is clean when you finish.","完成後看看自己的位置是不是乾淨了。"]
      ]
    },
    {
      id:"shower", enabled:true, type:"routine", required:true,
      icon:"🚿", category:"care", priority:92,
      title:["Shower Quest","洗澡任務"],
      blurb:["Get clean and put your clothes in the right place.","洗乾淨，衣服也放到正確的地方。"],
      duration:10, energy:"low", after:17*60, before:21*60, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:5,
      steps:[
        ["Get your towel and clean clothes ready first.","先準備好毛巾和乾淨衣服。"],
        ["Shower and wash properly.","洗澡，把身體洗乾淨。"],
        ["Dry off and put used clothes in the laundry place.","擦乾後，把換下來的衣服放到洗衣處。"]
      ]
    },
    {
      id:"evening_teeth", enabled:true, type:"routine", required:true,
      icon:"🦷", category:"care", priority:100,
      title:["Evening Teeth","晚間刷牙"],
      blurb:["Finish the day with clean teeth.","用乾乾淨淨的牙齒完成今天。"],
      duration:3, energy:"low", after:19*60+15, before:22*60, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:5,
      steps:[
        ["Brush every side of every tooth.","每顆牙齒的每一面都刷到。"],
        ["Slow down for the back teeth and gum line.","後排牙齒和牙齦邊慢慢刷。"],
        ["Rinse, tidy up, mission complete.","漱口、收好東西，任務完成。"]
      ]
    },
    {
      id:"reading_nest", enabled:true, type:"activity", required:false,
      icon:"📚", category:"learn", priority:54,
      title:["Reading Nest","閱讀小窩"],
      blurb:["Read or listen to your agreed story, then share a favourite part.","讀或聽約好的故事，再分享最喜歡的部分。"],
      duration:15, energy:"low", after:8*60+30, before:21*60, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:20,
      action:{type:"tab",tab:"books"}, steps:[]
    },
    {
      id:"move_break", enabled:true, type:"activity", required:false,
      icon:"🤸", category:"move", priority:59,
      title:["Move Mission","動一動任務"],
      blurb:["Choose a short movement challenge and get your body moving.","選一個短短的活動挑戰，讓身體動起來。"],
      duration:10, energy:"high", after:8*60+30, before:19*60+30, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:20,
      action:{type:"tab",tab:"acts"}, steps:[]
    },
    {
      id:"creative_build", enabled:true, type:"activity", required:false,
      icon:"🎨", category:"play", priority:50,
      title:["Make Something","做點東西"],
      blurb:["Draw, build, fold or invent something small.","畫、蓋、摺或發明一個小作品。"],
      duration:15, energy:"medium", after:9*60, before:19*60+30, oncePerDay:true,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:20,
      action:{type:"tab",tab:"acts"}, steps:[]
    },
    {
      id:"brain_sprint", enabled:true, type:"activity", required:false,
      icon:"🧠", category:"learn", priority:66,
      title:["Brain Sprint","頭腦衝刺"],
      blurb:["Do one of today's tiny Brain Gym challenges.","完成今天其中一個短短的頭腦體操。"],
      duration:5, energy:"medium", after:8*60, before:20*60+30, oncePerDay:false,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:0,
      action:{type:"brain"}, steps:[]
    },
    {
      id:"game_adventure", enabled:true, type:"activity", required:false,
      icon:"🎮", category:"play", priority:42,
      title:["Game Adventure","遊戲冒險"],
      blurb:["Pick one Summer Quest game and play a round.","選一個 Summer Quest 遊戲玩一回合。"],
      duration:15, energy:"medium", after:8*60, before:20*60+30, oncePerDay:false,
      frequency:{type:"daily"}, allowedKids:ALL_KIDS, rewardPoints:0,
      action:{type:"tab",tab:"games"}, steps:[]
    }
  ];

  Q.find(function(q){return q.id==="table_helper";}).awardSlot="lunch";
  [
    {id:"table_helper_breakfast",awardSlot:"breakfast",title:["Breakfast Table Helper","早餐餐桌小幫手"],after:7*60,before:11*60},
    {id:"table_helper_dinner",awardSlot:"dinner",title:["Dinner Table Helper","晚餐餐桌小幫手"],after:17*60,before:21*60}
  ].forEach(function(meal){Q.push(Object.assign({},Q.find(function(q){return q.id==="table_helper";}),meal));});
  Q.push({id:"dressing",enabled:true,type:"routine",required:true,icon:"👕",category:"care",priority:95,title:["Dress and make the bed","穿衣和鋪床"],blurb:["Get dressed and make your bed. Help is welcome.","穿好衣服、鋪好床。可以請人幫忙。"],duration:5,energy:"low",after:6*60,before:11*60,oncePerDay:true,frequency:{type:"daily"},allowedKids:ALL_KIDS,rewardPoints:5,steps:[]});
  function clone(v){return JSON.parse(JSON.stringify(v));}
  const api={
    all:function(){return clone(Q);},
    byId:function(id){const q=Q.find(function(x){return x.id===id;});return q?clone(q):null;},
    ALL_KIDS:ALL_KIDS.slice()
  };
  if(typeof window!=="undefined")window.SQQuestData=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
