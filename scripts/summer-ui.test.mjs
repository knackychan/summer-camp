// v0.2.3 — Summer presenter / nudge UX contract.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const ui=require("../js/summer-ui.js");

{
  const r=ui.normalize({emotion:"celebrate",animation:"double_hop",speech:"Done!",speechZh:"完成！",kind:"status"});
  assert.equal(r.emotion,"celebrate");
  assert.equal(r.animation,"double_hop");
  assert.equal(r.speechZh,"完成！");
}

// Unknown model-controlled presentation tokens never become CSS class names.
{
  const r=ui.normalize({emotion:"../../bad",animation:"evil-spin",speech:"Hi",speechZh:"嗨"});
  assert.equal(r.emotion,"happy");
  assert.equal(r.animation,"small_hop");
}

{
  const q={icon:"🦷",title:["Evening Teeth","晚間刷牙"]};
  const c=ui.attentionCopy({kind:"routine_due",questId:"evening_teeth"},q);
  assert.equal(c.icon,"🦷");
  assert.equal(c.title[0],"Evening Teeth");
  assert.match(c.body[0],/ready/i);
  assert.ok(c.body[1].length>0);
}

// Nudge only appears on the hub, never over games/activities or overlays.
{
  const a={kind:"routine_due",questId:"shower"};
  const key=ui.attentionKey(a);
  assert.equal(ui.shouldShowNudge({attention:a,hubVisible:true,surface:"hub",overlayOpen:false,dismissedKey:""}),true);
  assert.equal(ui.shouldShowNudge({attention:a,hubVisible:true,surface:"game",overlayOpen:false,dismissedKey:""}),false);
  assert.equal(ui.shouldShowNudge({attention:a,hubVisible:true,surface:"hub",overlayOpen:true,dismissedKey:""}),false);
  assert.equal(ui.shouldShowNudge({attention:a,hubVisible:true,surface:"hub",overlayOpen:false,dismissedKey:key}),false);
}

console.log("summer-ui.test.mjs: ok");
