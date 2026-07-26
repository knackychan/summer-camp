/* SQDrills — practice drills: data, seeded rotation, kid-paced UI, metronome.
   No per-step timers; kids advance by tapping. */
(function(){
  const DRILL_PLAN={lucien:["rhythm"],lili:["ballet","piano"],luis:["piano"]};
  const DRILLS={
    ballet:[
      {name:["Barre basics 🩰","基礎把杆 🩰"],metronome:false,steps:[
        ["Stand tall, feet in first position","站直，腳擺第一位置"],
        ["8 slow plies — knees over toes","慢慢蹲8次——膝蓋對準腳尖"],
        ["8 tendus each side — point that foot!","每邊擦地8次——腳尖繃直！"],
        ["4 releves, hold 3 breaths on top","踮腳4次——上面停3個呼吸"],
        ["Finish with your favorite pose","用你最喜歡的姿勢結束"]]},
      {name:["Turns & balance 🌀","轉圈與平衡 🌀"],metronome:false,steps:[
        ["Warm up: 8 ankle circles each foot","熱身：每隻腳踝繞圈8次"],
        ["Passe balance — 3 breaths each leg","單腳passé平衡——每邊3個呼吸"],
        ["4 chaine turns across the room","橫越房間做4個chaine轉"],
        ["4 more back — spot the wall!","再轉4個回來——眼睛盯住牆上一點！"],
        ["Cool down: big slow port de bras","收操：大而慢的手臂動作"]]},
    ],
    piano:[
      {name:["Scales & steady hands 🎹","音階與穩定的手 🎹"],metronome:true,steps:[
        ["Sit tall, curved fingers, wrists relaxed","坐直，手指彎曲，手腕放鬆"],
        ["C scale, right hand — 5 times, slow and even","C大調音階右手——5次，慢而平均"],
        ["C scale, left hand — 5 times","C大調音階左手——5次"],
        ["Both hands together — 3 careful times","雙手一起——認真彈3次"],
        ["Play your current piece once, gently","把現在練的曲子輕輕彈一次"]]},
      {name:["My piece, my show 🎵","我的曲子我做主 🎵"],metronome:true,steps:[
        ["Warm up: 5 finger taps on each key, hand by hand","熱身：每隻手每個手指按鍵5下"],
        ["Play the tricky part of your piece 3 times, slowly","把曲子最難的地方慢慢彈3次"],
        ["Play the whole piece once","整首彈一次"],
        ["Once more — this time with feeling!","再一次——這次要有感情！"],
        ["Bow to your audience","向觀眾鞠躬"]]},
    ],
    rhythm:[
      {name:["Clap & march 🥁","拍手踏步 🥁"],metronome:true,steps:[
        ["March around the room like a drummer","像鼓手一樣繞房間踏步"],
        ["Clap this: slow-slow-fast-fast-slow","拍這個節奏：慢-慢-快-快-慢"],
        ["Stomp 8 times, tiptoe 8 times","跺腳8次，踮腳走8步"],
        ["Freeze dance: move, then freeze like a statue","木頭人：動一動，然後定住不動！"],
        ["Take a bow","鞠躬謝幕"]]},
      {name:["Animal dance 🦁","動物舞 🦁"],metronome:false,steps:[
        ["Stretch up tall like a giraffe","像長頸鹿一樣伸高高"],
        ["Stomp like an elephant, 8 steps","像大象一樣跺腳8步"],
        ["Tiptoe like a cat, quiet quiet","像貓咪一樣踮腳，安靜安靜"],
        ["Jump like a frog 5 times","像青蛙一樣跳5次"],
        ["Sleepy lion stretch to finish","最後像想睡的獅子伸懶腰"]]},
    ],
  };

  function dseed(str){let h=7;for(const c of str)h=(h*31+c.charCodeAt(0))>>>0;return h;}
  function isPracticeDay(dateStr){return dseed("practice"+dateStr)%2===0;}
  function sessionFor(kid,dateStr){
    const plan=DRILL_PLAN[kid];
    const discipline=plan[dseed(dateStr+kid+"disc")%plan.length];
    const list=DRILLS[discipline];
    return {discipline:discipline,drill:list[dseed(dateStr+kid+"drill")%list.length]};
  }

  let met=null;
  function metronome(){
    if(met)return met;
    let ctx=null,intId=null,bpm=80;
    function click(){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.frequency.value=1000; g.gain.value=0.12;
      o.connect(g); g.connect(ctx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.06);
      o.stop(ctx.currentTime+0.07);
    }
    met={
      running:function(){return !!intId;},
      setBpm:function(v){bpm=v;if(intId){this.stop();this.start();}},
      start:function(){
        ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();
        if(ctx.state==="suspended")ctx.resume();
        this.stop(); intId=setInterval(click,60000/bpm); click();
      },
      stop:function(){if(intId){clearInterval(intId);intId=null;}},
      bpm:function(){return bpm;}
    };
    return met;
  }

  function openSession(kid,dateStr,opts){
    const session=sessionFor(kid,dateStr), drill=session.drill;
    let step=0;
    const o=document.createElement("div");
    o.className="overlay"; o.id="drillOverlay";
    document.body.appendChild(o);
    function speak(){if(opts.say)opts.say(drill.steps[step]);}
    function close(){metronome().stop();o.remove();}
    function render(){
      const last=step===drill.steps.length-1;
      o.innerHTML=`<div class="card drillcard">
        <h3>${drill.name[0]}<span class="zht">${drill.name[1]}</span></h3>
        <div class="drilldots">${drill.steps.map(function(s,n){return n<step?"●":n===step?"◉":"○";}).join(" ")}</div>
        <div class="drillstep">${drill.steps[step][0]}<span class="zhs">${drill.steps[step][1]}</span></div>
        ${drill.metronome?`<div class="metrow">
          ${[60,80,100].map(function(v){return `<button class="btn small metbpm ${metronome().bpm()===v?"on":""}" data-bpm="${v}">${v}</button>`;}).join("")}
          <button class="btn small" id="metToggle">${metronome().running()?"⏸ Metronome 節拍器":"▶ Metronome 節拍器"}</button>
        </div>`:""}
        <div class="vrow">
          ${step>0?`<button class="btn small" id="drillBack">← Back 上一步</button>`:""}
          <button class="btn" id="drillNext">${last?"Done! 完成！⭐":"Next 下一步 →"}</button>
        </div>
        <button class="btn small" id="drillQuit">Later 待會再練</button>
      </div>`;
      if(drill.metronome){
        o.querySelectorAll(".metbpm").forEach(function(b){b.onclick=function(){metronome().setBpm(+b.dataset.bpm);render();};});
        o.querySelector("#metToggle").onclick=function(){metronome().running()?metronome().stop():metronome().start();render();};
      }
      const back=o.querySelector("#drillBack");
      if(back)back.onclick=function(){step--;render();speak();};
      o.querySelector("#drillNext").onclick=function(){
        if(last){close();if(opts.onFinish)opts.onFinish();return;}
        step++;render();speak();
      };
      o.querySelector("#drillQuit").onclick=close;
    }
    render(); speak();
  }

  const api={DRILL_PLAN:DRILL_PLAN,DRILLS:DRILLS,isPracticeDay:isPracticeDay,sessionFor:sessionFor};
  if(typeof document!=="undefined")api.openSession=openSession;
  if(typeof window!=="undefined")window.SQDrills=Object.assign(window.SQDrills||{},api);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();
