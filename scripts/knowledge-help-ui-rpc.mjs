/* Test-only concurrent JSON RPC. Real compiled bridges; deterministic fake provider.
   No network calls, real credentials, family data or production settings. */
import { createInterface } from 'node:readline';
import { LocalStorageDriver } from '../dist/mobile/packages/storage/src/web/LocalStorageDriver.js';
import { KnowledgeLessonBridge } from '../dist/mobile/packages/learning/src/legacy/KnowledgeLessonBridge.js';
import { LearningDirectorBridge } from '../dist/mobile/packages/learning/src/legacy/LearningDirectorBridge.js';
import { LearningTelemetryStore, LearningTelemetryRecorder } from '../dist/mobile/packages/learning/src/telemetry/LearningTelemetry.js';
const values=new Map();
const storage=new LocalStorageDriver({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)});
const events=new LearningTelemetryStore(storage),telemetry=new LearningTelemetryRecorder(events);
let mode='offline',calls=0,requests=[],waiting=[];
const client={async request(request){
 if(request.task!=='knowledge_help')throw Error('Other AI tasks disabled in UI fixture');
 calls++;requests.push(request);
 const response={kind:'knowledge_help',cueId:request.context.cues.at(-1).id,provider:'remote:openai',usage:{provider:'openai',model:'fixture-model',profileId:'fixture-profile',inputTokens:23,outputTokens:7}};
 if(mode==='hold')return new Promise(resolve=>waiting.push(()=>resolve(response)));
 if(mode==='invalid')return {kind:'knowledge_help',cueId:'fact:unknown'};
 return response;
}};
let knowledge;
function reload(){knowledge=new KnowledgeLessonBridge(storage,mode==='offline'?undefined:client,telemetry);}
reload();
const director=new LearningDirectorBridge(storage);
const help={openKnowledgeHelp:'openHelp',adaptKnowledgeHelp:'adaptHelp',nextKnowledgeHelp:'nextHelp',cancelKnowledgeHelp:'cancelHelp'};
const dirs={learningDirectorSession:'snapshot',startLearningDirectorStep:'start',completeLearningDirectorStep:'completeCurrent',pauseLearningDirectorSession:'pause',finishLearningDirectorSession:'finish',alternativeLearningDirectorStep:'alternative',resetLearningDirectorSession:'reset'};
async function dispatch(method,input){
 if(method==='configure'){mode=input.mode||'offline';if(input.clear){values.clear();calls=0;requests=[];}reload();return true;}
 if(method==='release'){for(const fn of waiting.splice(0))fn();return true;}
 if(method==='counters')return {calls,requests};
 if(method==='events')return events.list();
 if(method==='reload'){reload();return true;}
 if(help[method])return knowledge[help[method]](input);
 if(dirs[method])return director[dirs[method]](input);
 const match=method.match(/^(science|geography|history)(Catalog|Lesson|Start|Answer|Advance|Adapt|Reset)$/);
 if(match){const maps={Catalog:'catalog',Lesson:'snapshot',Start:'start',Answer:'answer',Advance:'advance',Adapt:'adapt',Reset:'reset'};return knowledge[maps[match[2]]]({...input,domain:match[1]});}
 throw Error('Unsupported fixture method '+method);
}
createInterface({input:process.stdin,crlfDelay:Infinity}).on('line',line=>{
 const r=JSON.parse(line);
 dispatch(r.method,r.input||{}).then(value=>process.stdout.write(JSON.stringify({id:r.id,ok:true,value})+'\n'))
 .catch(error=>process.stdout.write(JSON.stringify({id:r.id,ok:false,error:String(error.stack||error)})+'\n'));
});
