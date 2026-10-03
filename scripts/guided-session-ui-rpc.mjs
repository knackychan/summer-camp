/* Local-only bridge for the optional rendered-component smoke test.
   Uses the real compiled learning code and JSON-serialized storage. */
import { createInterface } from 'node:readline';
import { LocalStorageDriver } from '../dist/mobile/packages/storage/src/web/LocalStorageDriver.js';
import { LearningDirectorBridge } from '../dist/mobile/packages/learning/src/legacy/LearningDirectorBridge.js';
import { KnowledgeLessonBridge } from '../dist/mobile/packages/learning/src/legacy/KnowledgeLessonBridge.js';
import { LearningTelemetryStore, LearningTelemetryRecorder } from '../dist/mobile/packages/learning/src/telemetry/LearningTelemetry.js';
import { MathTeachBridge } from '../dist/mobile/packages/learning/src/legacy/MathTeachBridge.js';
import { LanguageTeachBridge } from '../dist/mobile/packages/learning/src/legacy/LanguageTeachBridge.js';
const values=new Map();
const storage=new LocalStorageDriver({getItem:key=>values.get(key)??null,setItem:(key,v)=>values.set(key,v),removeItem:key=>values.delete(key)});
const telemetry=new LearningTelemetryStore(storage),recorder=new LearningTelemetryRecorder(telemetry);
let director=new LearningDirectorBridge(storage),knowledge=new KnowledgeLessonBridge(storage,undefined,recorder);
const math=new MathTeachBridge(storage),language=new LanguageTeachBridge(storage);
const names={learningDirectorSession:'snapshot',startLearningDirectorStep:'start',completeLearningDirectorStep:'completeCurrent',pauseLearningDirectorSession:'pause',finishLearningDirectorSession:'finish',alternativeLearningDirectorStep:'alternative',resetLearningDirectorSession:'reset'};
async function dispatch(method,input){
  if(method==='testReload'){director=new LearningDirectorBridge(storage);knowledge=new KnowledgeLessonBridge(storage,undefined,recorder);return true;}
  if(method==='testClear'){values.clear();return true;}
  if(names[method])return director[names[method]](input);
  if(method==='mathTeachLocalScene'||method==='mathTeachScene')return math.localScene(input);
  if(method==='languageTeachLocalScene'||method==='languageTeachScene')return language.localScene(input);
  const match=method.match(/^(science|geography|history)(Catalog|Lesson|Start|Answer|Advance|Adapt|Reset)$/);
  if(match){const maps={Catalog:'catalog',Lesson:'snapshot',Start:'start',Answer:'answer',Advance:'advance',Adapt:'adapt',Reset:'reset'};return knowledge[maps[match[2]]]({...input,domain:match[1]});}
  throw new Error(`Unknown UI smoke-test method: ${method}`);
}
for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  try{const r=JSON.parse(line);process.stdout.write(JSON.stringify({ok:true,value:await dispatch(r.method,r.input||{})})+'\n');}
  catch(e){process.stdout.write(JSON.stringify({ok:false,error:String(e.stack||e)})+'\n');}
}
