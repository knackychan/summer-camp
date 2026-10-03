#!/usr/bin/env python3
"""Actual rendered knowledge components and compiled bridges; fake provider/audio/navigation.
Requires Python Playwright and local Chromium. Not full-app, live provider or device certification.
"""
import argparse, json, pathlib, re, subprocess, threading, tempfile
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--browser',default='/usr/bin/chromium')
p.add_argument('--out',type=pathlib.Path,default=pathlib.Path(tempfile.gettempdir())/'sq-help-ui')
a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
html=(ROOT/'index.html').read_text()
style='\n'.join(re.findall(r'<style[^>]*>([\s\S]*?)</style>',html))
ui=html[html.index('let learningDirectorRenderToken='):html.index('function renderScienceLab()')]
node=subprocess.Popen(['node','scripts/knowledge-help-ui-rpc.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
lock=threading.Lock();waiting={};counter=0

def reader():
    for line in node.stdout:
        result=json.loads(line)
        with lock:
            entry=waiting.get(result['id'])
        if entry:
            entry['result']=result;entry['event'].set()
threading.Thread(target=reader,daemon=True).start()
def rpc(method,value=None):
    global counter
    entry={'event':threading.Event()}
    with lock:
        counter+=1;request_id=counter;waiting[request_id]=entry
        node.stdin.write(json.dumps({'id':request_id,'method':method,'input':value or {}})+'\n');node.stdin.flush()
    if not entry['event'].wait(15):raise RuntimeError('Fixture RPC timed out: '+method)
    with lock:waiting.pop(request_id,None)
    result=entry['result']
    if not result['ok']:raise RuntimeError(result['error'])
    return result.get('value')

preamble='''let hubKid="ui-child",hubTab="learn",kid="ui-child",level="calc",learningDirectorLaunch=null;
const KIDS={"ui-child":{age:8},"ui-sibling":{age:8}},settings={vocab:{levels:{"ui-child":"recall"}}};
function escHtml(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function preferredInputScript(){return "latin";} function sTap(){} function sBad(){} function bigFloat(){} function catLockReason(){return null;}
window.spoken=[];function say(text,language){spoken.push({text,language});} function startGame(){}
'''
setup='''window.SQLearningRuntime={};
["learningDirectorSession","startLearningDirectorStep","completeLearningDirectorStep","pauseLearningDirectorSession","finishLearningDirectorSession","alternativeLearningDirectorStep","resetLearningDirectorSession","openKnowledgeHelp","adaptKnowledgeHelp","nextKnowledgeHelp","cancelKnowledgeHelp"].forEach(name=>SQLearningRuntime[name]=input=>_rpc(name,input));
Object.keys(KNOWLEDGE_LABS).forEach(domain=>{
 const suffix={catalog:'Catalog',snapshot:'Lesson',start:'Start',answer:'Answer',advance:'Advance',adapt:'Adapt',reset:'Reset'};
 Object.keys(suffix).forEach(key=>SQLearningRuntime[KNOWLEDGE_LABS[domain].methods[key]]=input=>_rpc(domain+suffix[key],input));
});
function renderHarness(){renderLearningDirector();Object.keys(KNOWLEDGE_LABS).forEach(renderKnowledgeLab);}
'''
markup='<main id="hub" class="wrap"><div class="bigcard learning-director" id="learningDirectorCard"><h3>Smart Practice · 聰明練習</h3><span id="learningDirectorStatus"></span><div id="learningDirectorBody"></div></div>'
for domain in ['science','geography','history']:
    markup+=f'<section class="bigcard science-lab" id="{domain}LabCard"><h3>{domain.title()}</h3><span id="{domain}LabStatus"></span><div class="science-lab__topics" id="{domain}LessonTopics"></div><div id="{domain}LessonBody"></div></section>'
markup+='</main>'
checks=[];errors=[]
try:
 with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=a.browser,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':768,'height':1024})
    page.route('**/*',lambda route:route.abort())
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.expose_function('_rpc',rpc)
    page.set_content('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head><body>'+markup+'</body></html>')
    page.add_script_tag(content=preamble+ui+setup)
    def start(domain,mode='explore'):
        page.evaluate('invalidateLearningSessionView();hubKid="ui-child";hubTab="learn";')
        lessons=rpc(domain+'Catalog',{'kidId':'ui-child','age':8,'domain':domain})
        result=rpc(domain+'Start',{'kidId':'ui-child','age':8,'domain':domain,'lessonId':lessons[0]['id'],'mode':mode})
        page.evaluate('domain=>renderKnowledgeLab(domain)',domain)
        page.wait_for_function('(args)=>knowledgeLabState[args[0]].snapshot&&knowledgeLabState[args[0]].snapshot.session.id===args[1]',arg=[domain,result['session']['id']])
        return result
    rpc('configure',{'mode':'offline','clear':True})
    for domain in ['science','geography','history']:
        start(domain);page.wait_for_selector('#'+domain+'HelpOpen')
        page.locator('#'+domain+'HelpOpen').click();page.wait_for_selector('#'+domain+'HelpNext')
        panel=page.locator('#'+domain+'HelpPanel')
        assert panel.locator('.zhs').inner_text().strip()
        assert rpc('counters')['calls']==0
        page.locator('#'+domain+'HelpListen').click()
        assert page.evaluate('spoken.slice(-2).map(s=>s.language)')==['en-US','zh-TW']
        prior=page.evaluate('(d)=>knowledgeLabState[d].snapshot.help.cue.id',domain)
        page.locator('#'+domain+'HelpNext').click()
        page.wait_for_function('args=>knowledgeLabState[args[0]].snapshot.help.cue.id!==args[1]',arg=[domain,prior])
        assert rpc('counters')['calls']==0
        checks.append(domain+': local bilingual clue, Listen action and Another clue work without a provider.')
    rpc('configure',{'mode':'remote','clear':True});start('science')
    page.locator('#scienceHelpOpen').click()
    page.wait_for_function('()=>knowledgeLabState.science.snapshot.help&&knowledgeLabState.science.snapshot.help.source==="remote"')
    assert rpc('counters')['calls']==1
    assert len(rpc('events'))==1
    chosen=page.evaluate('knowledgeLabState.science.snapshot.help.cue.id')
    page.evaluate('renderKnowledgeLab("science")');page.wait_for_selector('#scienceHelpNext')
    assert rpc('counters')['calls']==1
    rpc('reload');page.evaluate('renderKnowledgeLab("science")');page.wait_for_selector('#scienceHelpNext')
    assert page.evaluate('knowledgeLabState.science.snapshot.help.cue.id')==chosen
    page.locator('#scienceHelpNext').click();page.wait_for_timeout(80);assert rpc('counters')['calls']==1
    checks.append('Explicit remote selection is applied once; rerender, bridge reload and local next do not repeat it.')
    for width,name in [(768,'tablet'),(390,'mobile')]:
        page.set_viewport_size({'width':width,'height':1024 if width==768 else 844})
        page.locator('#scienceHelpPanel').scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2')
        buttons=page.locator('#scienceHelpPanel button').evaluate_all('(nodes)=>nodes.map(n=>n.getBoundingClientRect().height)')
        assert all(height>=44 for height in buttons)
        page.screenshot(path=str(a.out/f'explore-help-{name}.png'))
    checks.append('768px tablet and 390px mobile: no horizontal overflow; new touch controls are at least 44px high.')
    rpc('configure',{'mode':'hold','clear':True});start('history')
    page.locator('#historyHelpOpen').click();page.wait_for_selector('#historyHelpNext')
    page.wait_for_timeout(80);assert rpc('counters')['calls']==1
    page.locator('#historyStartQuestions').click();page.wait_for_selector('[data-knowledge-answer]')
    q=page.evaluate('knowledgeLabState.history.snapshot.currentQuestion.correctOptionId')
    page.locator('[data-knowledge-answer="'+q+'"]').click();page.wait_for_selector('#historyNext')
    rpc('release');page.wait_for_timeout(100)
    assert page.locator('#historyHelpPanel').count()==0
    assert page.evaluate('knowledgeLabState.history.snapshot.session.answers.length')==1
    checks.append('A delayed response cannot restore help after the child begins and answers a question.')
    rpc('configure',{'mode':'hold','clear':True});start('geography')
    page.locator('#geographyHelpOpen').click();page.wait_for_selector('#geographyHelpNext')
    page.wait_for_timeout(80)
    page.evaluate('invalidateLearningSessionView();hubKid="ui-sibling";renderKnowledgeLab("geography")')
    rpc('release');page.wait_for_timeout(150)
    assert page.locator('#geographyHelpPanel').count()==0
    assert page.evaluate('hubKid')=='ui-sibling'
    checks.append('Switching children cancels pending help and does not display the previous child’s result.')
    rpc('configure',{'mode':'remote','clear':True})
    for domain in ['science','geography','history']:
        start(domain,'check');page.wait_for_selector('#'+domain+'LessonBody [data-knowledge-answer]')
        assert page.locator('#'+domain+'HelpOpen').count()==1
        assert rpc('counters')['calls']==(['science','geography','history'].index(domain))
        page.locator('#'+domain+'HelpOpen').click();page.wait_for_selector('#'+domain+'HelpNext')
        page.wait_for_timeout(80)
        assert page.evaluate('knowledgeLabState["'+domain+'"].snapshot.help.cue.kind')=='strategy'
        q=page.evaluate('knowledgeLabState["'+domain+'"].snapshot.currentQuestion.correctOptionId')
        page.locator('#'+domain+'LessonBody [data-knowledge-answer="'+q+'"]').click();page.wait_for_timeout(40)
        assert page.locator('#'+domain+'HelpPanel').count()==0
    assert rpc('counters')['calls']==3
    checks.append('Science, Geography and History Check screens provide explicit fixed-strategy hints; one selection request is made only after the child taps for help, and the panel disappears after answering.')
    assert not errors,errors;checks.append('No page-level JavaScript errors in the exercised component flows.')
    browser.close()
finally:
 node.terminate()
 try:node.wait(timeout=5)
 except subprocess.TimeoutExpired:node.kill()
report={'scope':'Actual rendered components + real compiled bridges; deterministic fixture provider and audio/navigation doubles. Not full-app, service worker, physical tablet or live model acceptance.','checks':checks,'count':len(checks)}
(a.out/'knowledge-help-ui-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
