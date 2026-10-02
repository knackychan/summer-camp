/* SQRewardData — editable reward-shop seed data.
   The child sees these as things Quest Coins can be exchanged for. */
(function(){
  const REWARDS=[
    {id:"choose_dessert",enabled:true,icon:"🍨",cost:12,title:["Choose dessert","選甜點"],blurb:["You choose the family dessert.","今天的家庭甜點由你選。"]},
    {id:"movie_pick",enabled:true,icon:"🎬",cost:20,title:["Movie Pick","選電影"],blurb:["Choose the next family movie.","下一部家庭電影由你選。"]},
    {id:"breakfast_pick",enabled:true,icon:"🥞",cost:25,title:["Breakfast Pick","選早餐"],blurb:["Choose a special breakfast idea.","選一個特別的早餐。"]},
    {id:"special_activity",enabled:true,icon:"🎟️",cost:50,title:["Special Activity","特別活動"],blurb:["Save up for a parent-approved special activity.","存起來換一個爸爸核准的特別活動。"]}
  ];
  function clone(v){return JSON.parse(JSON.stringify(v));}
  const api={all:function(){return clone(REWARDS);},byId:function(id){const r=REWARDS.find(function(x){return x.id===id;});return r?clone(r):null;}};
  if(typeof window!=="undefined")window.SQRewardData=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
