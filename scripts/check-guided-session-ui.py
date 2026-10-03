#!/usr/bin/env python3
"""Rendered-component smoke test; not a full app/Service Worker/device E2E test.

Requires local Python Playwright and a Chromium executable. No URL navigation,
network service, provider keys or npm install is used. Actual UI functions and
CSS are read from index.html; actual compiled bridges run over JSON storage in
Node. Surrounding game navigation/audio are test doubles, not game tests.
"""
import argparse
import json
import pathlib
import re
import subprocess
import threading
import tempfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--browser', default='/usr/bin/chromium')
parser.add_argument('--out', type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()) / 'summer-quest-guided-ui')
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
html = (ROOT / 'index.html').read_text()
style = '\n'.join(re.findall(r'<style[^>]*>([\s\S]*?)</style>', html))
ui = html[html.index('let learningDirectorRenderToken='):html.index('function renderScienceLab()')]
node = subprocess.Popen(['node',  'scripts/guided-session-ui-rpc.mjs'], cwd=ROOT,
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
lock = threading.Lock()
def rpc(method, value=None):
    with lock:
        node.stdin.write(json.dumps({'method': method, 'input': value or {}})+'\n')
        node.stdin.flush()
        result = json.loads(node.stdout.readline())
        if not result['ok']:
            raise RuntimeError(result['error'])
        return result.get('value')

preamble = r'''
let hubKid="ui-child",hubTab="learn",kid="ui-child",level="calc",learningDirectorLaunch=null;
const KIDS={"ui-child":{age:7},"ui-sibling":{age:7}},settings={vocab:{levels:{"ui-child":"recall"}}};
function escHtml(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function preferredInputScript(){return "latin";}
function sTap(){} function sBad(){} function say(){} function bigFloat(){}
function catLockReason(){return null;}
function startGame(child,game,options){window.lastLaunch={child,game,options};invalidateLearningSessionView();document.getElementById('hub').classList.add('hidden');}
'''
setup = r'''
window.SQLearningRuntime={};
["learningDirectorSession","startLearningDirectorStep","completeLearningDirectorStep","pauseLearningDirectorSession","finishLearningDirectorSession","alternativeLearningDirectorStep","resetLearningDirectorSession","mathTeachLocalScene","mathTeachScene","languageTeachLocalScene","languageTeachScene"].forEach(name=>SQLearningRuntime[name]=input=>_rpc(name,input));
Object.keys(KNOWLEDGE_LABS).forEach(domain=>{
 const suffix={catalog:'Catalog',snapshot:'Lesson',start:'Start',answer:'Answer',advance:'Advance',adapt:'Adapt',reset:'Reset'};
 Object.keys(suffix).forEach(key=>SQLearningRuntime[KNOWLEDGE_LABS[domain].methods[key]]=input=>_rpc(domain+suffix[key],input));
});
const normalInput=learningDirectorInput;
let availableOverride=null;
learningDirectorInput=function(){const input=normalInput();if(input&&availableOverride)input.availableGameIds=availableOverride;return input;};
function renderHarness(){renderLearningDirector();Object.keys(KNOWLEDGE_LABS).forEach(renderKnowledgeLab);}
'''
markup = '<div class="wrap" id="hub"><div class="card learning-director" id="learningDirectorCard"><h3>Smart Practice · 聰明練習</h3><span id="learningDirectorStatus"></span><div id="learningDirectorBody"></div></div>'
for domain in ['science','geography','history']:
    markup += f'<section class="card science-lab" id="{domain}LabCard"><h3>{domain.title()}</h3><span id="{domain}LabStatus"></span><div class="science-lab__topics" id="{domain}LessonTopics"></div><div id="{domain}LessonBody"></div></section>'
markup += '</div>'
checks = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=args.browser, headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1100,'height':850})
        page.set_default_timeout(7000)
        page.route('**/*', lambda route: route.abort())
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.expose_function('_rpc', rpc)
        page.set_content('<html><head><meta charset="utf-8"><style>'+style+'</style></head><body>'+markup+'</body></html>', wait_until='domcontentloaded')
        page.add_script_tag(content=preamble+ui+setup)
        page.evaluate('renderHarness()')
        page.wait_for_selector('#learningDirectorStart')
        first=page.evaluate('learningDirectorView.currentStep.skill')
        page.locator('#learningDirectorAlternative').click()
        page.wait_for_function('(first)=>learningDirectorView.currentStep.skill!==first&&!learningDirectorBusy', arg=first)
        chosen=page.evaluate('learningDirectorView.currentStep.skill')
        page.evaluate('renderHarness()')
        page.wait_for_function('()=>document.getElementById("learningDirectorStatus").textContent.indexOf("Planning")<0')
        assert page.evaluate('learningDirectorView.currentStep.skill')==chosen
        checks.append('Another choice changes the eligible skill and persists on rerender.')
        page.locator('#learningDirectorPause').click()
        page.wait_for_function('()=>learningDirectorView.plan.coordination.status==="paused"&&!learningDirectorBusy')
        assert 'Resume' in page.locator('#learningDirectorStart').inner_text()
        checks.append('Pause renders bilingual Resume and saved-state controls.')
        page.locator('#learningDirectorFinish').click()
        page.wait_for_selector('#learningDirectorReset')
        assert page.evaluate('learningDirectorView.plan.completedAt==null')
        assert 'Finished for now' in page.locator('#learningDirectorBody').inner_text()
        checks.append('Finish is distinct from success and does not complete unfinished steps.')
        # Use a constrained fixture to visit the real History runtime through UI.
        rpc('testClear')
        page.evaluate('invalidateLearningSessionView();availableOverride=["history"];renderHarness()')
        page.wait_for_selector('#learningDirectorStart')
        page.locator('#learningDirectorStart').click()
        page.wait_for_selector('#historyStartQuestions')
        page.locator('#historyStartQuestions').click()
        page.wait_for_selector('[data-knowledge-answer]')
        answer=page.evaluate('knowledgeLabState.history.snapshot.currentQuestion.correctOptionId')
        page.locator('[data-knowledge-answer="'+answer+'"]').click()
        page.wait_for_function('()=>learningDirectorView.currentStep.progressAttempts===1')
        page.locator('#historyPauseSession').click()
        page.wait_for_function('()=>learningDirectorView.plan.coordination.status==="paused"')
        page.wait_for_selector('#historyResumeSession')
        assert page.locator('#historyLessonTopics button:disabled').count()==0
        checks.append('History answer saves 1/2 progress; pausing preserves it and unlocks free topics.')
        rpc('testReload')
        page.evaluate('invalidateLearningSessionView();renderHarness()')
        page.wait_for_function('()=>learningDirectorView&&learningDirectorView.plan.coordination.status==="paused"')
        page.locator('#learningDirectorStart').click()
        page.wait_for_selector('#historyNext')
        assert page.evaluate('learningDirectorView.currentStep.progressAttempts')==1
        page.locator('#historyNext').click()
        page.wait_for_function('()=>knowledgeLabState.history.snapshot.session.questionIndex===1')
        answer=page.evaluate('knowledgeLabState.history.snapshot.currentQuestion.correctOptionId')
        page.locator('[data-knowledge-answer="'+answer+'"]').click()
        page.wait_for_function('()=>learningDirectorView.plan.activeStepIndex===1')
        assert page.evaluate('learningDirectorView.currentStep.startedAt==null')
        page.locator('#historyNext').click()
        page.wait_for_selector('#historyBackToPractice')
        page.locator('#historyBackToPractice').click()
        page.wait_for_function('()=>!knowledgeLabState.history.snapshot||document.getElementById("historyLessonBody").innerText.indexOf("Pick")>=0')
        checks.append('History resumes after bridge reload, completes exactly two local answers, then suggests without auto-launch.')
        page.locator('#learningDirectorCard').scroll_into_view_if_needed()
        page.screenshot(path=str(args.out/'guided-session-desktop.png'))
        page.set_viewport_size({'width':768,'height':1024})
        page.screenshot(path=str(args.out/'guided-session-tablet.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2')
        checks.append('Rendered 768px tablet component has no horizontal document overflow.')
        # Preserve a pending response, switch child, then release the old response.
        page.evaluate('window.realStart=SQLearningRuntime.startLearningDirectorStep;SQLearningRuntime.startLearningDirectorStep=input=>new Promise(resolve=>window.releaseOldStart=()=>realStart(input).then(resolve)); void 0;')
        page.locator('#learningDirectorStart').click()
        page.evaluate('invalidateLearningSessionView();hubKid="ui-sibling";renderHarness()')
        page.wait_for_function('()=>learningDirectorView&&learningDirectorView.plan.learnerId==="ui-sibling"')
        page.evaluate('void releaseOldStart()')
        page.wait_for_timeout(200)
        assert page.evaluate('learningDirectorView.plan.learnerId')=='ui-sibling'
        assert page.evaluate('window.lastLaunch==null')
        checks.append('A start response released after child switching neither launches nor overwrites the new child view.')
        assert not errors, errors
        checks.append('No page-level JavaScript exceptions during these component interactions.')
        browser.close()
finally:
    node.terminate()
    try:
        node.wait(timeout=5)
    except subprocess.TimeoutExpired:
        node.kill()
report={'scope':'Actual rendered Smart Practice/knowledge components with real Node bridges; surrounding navigation/audio stubbed. Not full-app, service-worker, hardware or live-provider E2E.', 'checks':checks, 'count':len(checks)}
(args.out/'component-ui-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
