const root = document.getElementById("aiLabPanel");
if (root && !root.dataset.ready) {
  root.dataset.ready = "1";

  const cfg = window.SQ_CONFIG || {};
  const endpoint = String(cfg.SUMMER_AGENT_ENDPOINT || "").trim();
  const healthEndpoint = String(cfg.SUMMER_AGENT_HEALTH_ENDPOINT || (endpoint ? endpoint.replace(/\/+$/, "") + "/health" : "")).trim();
  const timeoutMs = Number(cfg.SUMMER_AGENT_TIMEOUT_MS || 6500);
  const HISTORY_KEY = "sq-ai-eval-history-v2";
  const MAX_HISTORY = 20;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let api = null;
  let profiles = [];
  let suiteScenarios = [];
  let currentRun = null;
  let serverHealth = null;

  function status(kind, text) {
    const el = $("aiLabStatus");
    if (!el) return;
    el.className = "ai-lab__status " + (kind ? "is-" + kind : "");
    el.textContent = text;
  }

  function renderProfiles() {
    const el = $("aiLabProfiles");
    if (!el) return;
    const allowed = serverHealth && Array.isArray(serverHealth.allowedProfiles) ? new Set(serverHealth.allowedProfiles.map((p) => p.id)) : null;
    const providerState = serverHealth && serverHealth.providers ? serverHealth.providers : null;
    let checkedCount = 0;
    el.innerHTML = profiles.map((p) => {
      const providerReady = !providerState || providerState[p.provider] !== false;
      const allowedByServer = !allowed || allowed.has(p.id);
      const enabled = providerReady && allowedByServer;
      const checked = enabled && checkedCount++ < 3 ? " checked" : "";
      const disabled = enabled ? "" : " disabled";
      const dev = p.productionAllowed ? "" : '<span class="tag">DEV</span>';
      let reason = "";
      if (!providerReady) reason = " · no server key";
      else if (!allowedByServer) reason = " · not allowed by server";
      return '<label class="ai-lab__profile'+(enabled?'':' is-disabled')+'"><input type="checkbox" value="'+esc(p.id)+'"'+checked+disabled+'><span><b>'+esc(p.label)+'</b><small>'+esc(p.provider)+' · '+esc(p.model)+' · '+esc(p.costClass)+esc(reason)+'</small></span>'+dev+'</label>';
    }).join("");
  }

  async function readServerHealth() {
    if (!healthEndpoint || typeof fetch !== "function") return null;
    try {
      const res = await fetch(healthEndpoint, { method:"GET", credentials:"same-origin", cache:"no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.ok ? data : null;
    } catch { return null; }
  }

  function healthStatusText(health) {
    if (!health) return null;
    const providers = health.providers || {};
    const names = [["OpenAI",providers.openai],["Anthropic",providers.anthropic],["OpenRouter",providers.openrouter]]
      .map(([name,ready]) => name+" "+(ready ? "✓" : "—"))
      .join(" · ");
    const mode = health.mode === "ai_lab" ? "AI Lab routing enabled" : "child-safe routing";
    return "Local agent server online · "+mode+" · "+names;
  }

  function fmtCost(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    if (n === 0) return "$0";
    if (n < 0.0001) return "$" + n.toFixed(6);
    return "$" + n.toFixed(4);
  }

  function fmtDate(value) {
    try { return new Date(value).toLocaleString(undefined, { month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit" }); }
    catch { return String(value || ""); }
  }

  function avg(values) {
    const nums = values.map(Number).filter(Number.isFinite);
    return nums.length ? nums.reduce((a,b) => a+b, 0) / nums.length : null;
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
    } catch { return []; }
  }

  function writeHistory(history) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); }
    catch (error) { status("warn", "Evaluation finished, but local history could not be saved: " + (error instanceof Error ? error.message : String(error))); }
  }

  function saveCurrentRun() {
    if (!currentRun || !currentRun.entries || !currentRun.entries.length) return;
    const history = loadHistory().filter((run) => run.id !== currentRun.id);
    history.unshift(currentRun);
    writeHistory(history);
    renderHistory();
  }

  function selectedProfiles() {
    return [...root.querySelectorAll('#aiLabProfiles input[type="checkbox"]:checked')].map((el) => el.value);
  }

  function readCommon() {
    return {
      age: Number($("aiLabAge").value),
      language: $("aiLabLanguage").value,
      readingLevel: $("aiLabReading").value,
      level: Number($("aiLabLevel").value),
    };
  }

  function readManualScenario() {
    const common = readCommon();
    if ($("aiLabDomain").value === "language") {
      return {
        id: "manual_vocab",
        label: "Vocabulary · manual",
        description: "Manual vocabulary hint case.",
        input: {
          domain: "language",
          ...common,
          target: $("aiLabTarget").value,
          mode: "recall",
          emoji: $("aiLabEmoji").value,
          sourceFrench: $("aiLabFrench").value,
          sourceChinese: $("aiLabChinese").value,
          promptMode: "picture",
          position: 0,
          revealed: 0,
        },
      };
    }
    return {
      id: "manual_math",
      label: "Math · manual",
      description: "Manual arithmetic hint case.",
      input: {
        ...common,
        operation: $("aiLabOperation").value,
        left: Number($("aiLabLeft").value),
        right: Number($("aiLabRight").value),
        childAnswer: Number($("aiLabAnswer").value),
      },
    };
  }

  function domainLabel(entry) {
    return entry.domain === "language" ? "Vocabulary" : "Math";
  }

  function renderSummary() {
    const el = $("aiLabSummary");
    if (!el) return;
    const entries = currentRun && currentRun.entries ? currentRun.entries : [];
    if (!entries.length) { el.innerHTML = ""; return; }
    const byProfile = new Map();
    for (const entry of entries) {
      const key = entry.profileId;
      if (!byProfile.has(key)) byProfile.set(key, { profileId:key, label:entry.profileLabel, entries:[] });
      byProfile.get(key).entries.push(entry);
    }
    const rows = [...byProfile.values()].map((group) => {
      const ok = group.entries.filter((e) => e.result && !e.error);
      const guard = ok.filter((e) => e.result.guardrails && e.result.guardrails.passed).length;
      const matched = ok.filter((e) => e.result.profileMatched).length;
      const latency = avg(ok.map((e) => e.result.latencyMs));
      const ruleScore = avg(ok.map((e) => e.result.guardrails ? e.result.guardrails.score : undefined));
      const cost = ok.reduce((sum,e) => sum + (Number(e.result.response && e.result.response.usage ? e.result.response.usage.estimatedCostUsd : undefined) || 0), 0);
      const useful = avg(group.entries.map((e) => e.review ? e.review.useful : undefined));
      const ageFit = avg(group.entries.map((e) => e.review ? e.review.ageFit : undefined));
      return '<tr><td><b>'+esc(group.label || group.profileId)+'</b><small>'+esc(group.profileId)+'</small></td>'+
        '<td>'+ok.length+'/'+group.entries.length+'</td><td>'+guard+'/'+ok.length+'</td><td>'+matched+'/'+ok.length+'</td>'+
        '<td>'+(ruleScore == null?'—':ruleScore.toFixed(0)+'/100')+'</td><td>'+(latency == null?'—':Math.round(latency)+' ms')+'</td><td>'+fmtCost(cost)+'</td>'+
        '<td>'+(useful == null?'—':useful.toFixed(1)+'/5')+'</td><td>'+(ageFit == null?'—':ageFit.toFixed(1)+'/5')+'</td></tr>';
    }).join("");
    el.innerHTML = '<div class="ai-lab__summary-head"><div><b>'+esc(currentRun.mode === "suite" ? "5-case suite" : "Single case")+'</b><span>'+esc(fmtDate(currentRun.createdAt))+'</span></div><span>'+entries.length+' request'+(entries.length===1?'':'s')+'</span></div>'+
      '<div class="tbl-wrap ai-lab__summary-table"><table class="tbl"><thead><tr><th>Profile</th><th>Returned</th><th>Guardrails</th><th>Profile match</th><th>Guard score</th><th>Avg latency</th><th>Total cost</th><th>Useful</th><th>Age fit</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      '<p class="field__hint">Guard score is a mechanical check only: domain strategy, no answer leak, and reading-level text budget. “Useful” and “Age fit” are your manual 1–5 review.</p>';
  }

  function reviewSelect(entryId, field, value) {
    let options = '<option value="">—</option>';
    for (let i=1;i<=5;i++) options += '<option value="'+i+'"'+(Number(value)===i?' selected':'')+'>'+i+'</option>';
    return '<label><span>'+esc(field === "useful" ? "Useful" : "Age fit")+'</span><select class="inp ai-lab__rating" data-entry="'+esc(entryId)+'" data-review="'+esc(field)+'">'+options+'</select></label>';
  }

  function renderEntry(entry) {
    if (entry.error) {
      return '<article class="ai-lab__result is-error"><header><div><b>'+esc(entry.profileLabel)+'</b><small>'+esc(entry.profileId)+'</small></div><span>Error</span></header><p>'+esc(entry.error)+'</p></article>';
    }
    const r = entry.result;
    const h = r.response;
    const u = h.usage || {};
    const g = r.guardrails || { passed:false, score:0, issues:["missing_guardrail_result"] };
    const mismatch = !r.profileMatched && r.actualProfileId;
    const guardClass = g.passed ? "is-pass" : "is-fail";
    const guardText = g.passed ? "Guardrails pass" : (g.issues || []).join(", ");
    return '<article class="ai-lab__result'+(mismatch?' is-warning':'')+'">'+
      '<header><div><b>'+esc(entry.profileLabel)+'</b><small>'+esc(r.requestedProfileId)+'</small></div><span>'+r.latencyMs+' ms</span></header>'+
      (mismatch?'<div class="ai-lab__warning">Server used <b>'+esc(r.actualProfileId)+'</b> instead. Enable client profile override + allow-list this profile for a real comparison.</div>':'')+
      '<div class="ai-lab__guard '+guardClass+'"><b>'+esc(g.score)+'/100</b><span>'+esc(guardText)+'</span></div>'+
      '<div class="ai-lab__hint"><span>'+esc(h.strategy)+'</span><p>'+esc(h.message)+'</p><p lang="zh-Hant">'+esc(h.messageZh)+'</p></div>'+
      '<dl class="ai-lab__metrics"><div><dt>Provider</dt><dd>'+esc(u.provider || h.provider || "—")+'</dd></div><div><dt>Model</dt><dd>'+esc(u.model || "—")+'</dd></div><div><dt>Tokens</dt><dd>'+esc((u.inputTokens == null ? "—" : u.inputTokens)+' / '+(u.outputTokens == null ? "—" : u.outputTokens))+'</dd></div><div><dt>Est. cost</dt><dd>'+fmtCost(u.estimatedCostUsd)+'</dd></div><div><dt>Schema</dt><dd>✓ valid</dd></div><div><dt>Profile</dt><dd>'+(r.profileMatched?'✓ matched':'⚠ substituted')+'</dd></div></dl>'+
      '<div class="ai-lab__review">'+reviewSelect(entry.id,"useful",entry.review ? entry.review.useful : undefined)+reviewSelect(entry.id,"ageFit",entry.review ? entry.review.ageFit : undefined)+'</div>'+
      '<details><summary>Validated JSON + checks</summary><pre>'+esc(JSON.stringify({ response:h, guardrails:g },null,2))+'</pre></details>'+
    '</article>';
  }

  function renderResults() {
    const el = $("aiLabResults");
    if (!el) return;
    const entries = currentRun && currentRun.entries ? currentRun.entries : [];
    if (!entries.length) {
      el.innerHTML = '<div class="ai-lab__empty">Run a single case or the built-in Math + Vocabulary suite. Results are saved locally so you can compare models over time.</div>';
      renderSummary();
      return;
    }
    const scenarioOrder = [];
    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.scenarioId)) { groups.set(entry.scenarioId, []); scenarioOrder.push(entry.scenarioId); }
      groups.get(entry.scenarioId).push(entry);
    }
    el.innerHTML = scenarioOrder.map((id) => {
      const group = groups.get(id);
      const first = group[0];
      return '<section class="ai-lab__scenario"><div class="ai-lab__scenario-head"><div><b>'+esc(first.scenarioLabel)+'</b><span>'+esc(domainLabel(first))+' · '+esc(first.scenarioDescription || "")+'</span></div><span class="tag">'+esc(group.length)+' model'+(group.length===1?'':'s')+'</span></div><div class="ai-lab__scenario-grid">'+group.map(renderEntry).join("")+'</div></section>';
    }).join("");
    renderSummary();
  }

  function runSummary(run) {
    const entries = run.entries || [];
    const ok = entries.filter((e) => e.result && !e.error);
    const guards = ok.filter((e) => e.result.guardrails && e.result.guardrails.passed).length;
    const cost = ok.reduce((sum,e) => sum + (Number(e.result.response && e.result.response.usage ? e.result.response.usage.estimatedCostUsd : undefined) || 0), 0);
    const profileCount = new Set(entries.map((e) => e.profileId)).size;
    const scenarioCount = new Set(entries.map((e) => e.scenarioId)).size;
    return { ok:ok.length, guards, cost, profileCount, scenarioCount };
  }

  function renderHistory() {
    const el = $("aiLabHistory");
    if (!el) return;
    const history = loadHistory();
    if (!history.length) {
      el.innerHTML = '<div class="ai-lab__history-empty">No saved evaluation runs yet.</div>';
      return;
    }
    const rows = history.map((run) => {
      const s = runSummary(run);
      return '<tr><td><b>'+esc(run.mode === "suite" ? "5-case suite" : "Single case")+'</b><small>'+esc(fmtDate(run.createdAt))+'</small></td><td>'+s.scenarioCount+'</td><td>'+s.profileCount+'</td><td>'+s.guards+'/'+s.ok+'</td><td>'+fmtCost(s.cost)+'</td><td><button class="btn btn--sm" type="button" data-load-run="'+esc(run.id)+'">Load</button></td></tr>';
    }).join("");
    el.innerHTML = '<table class="tbl"><thead><tr><th>Run</th><th>Cases</th><th>Profiles</th><th>Guardrails</th><th>Cost</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
  }

  function setDomain(domain) {
    const language = domain === "language";
    $("aiLabMathFields").hidden = language;
    $("aiLabLanguageFields").hidden = !language;
  }

  function setBusy(busy) {
    $("aiLabRun").disabled = busy || !api;
    $("aiLabSuite").disabled = busy || !api;
  }

  async function runCases(scenarios, mode) {
    if (!api) return;
    if (!endpoint) {
      status("warn", "No SUMMER_AGENT_ENDPOINT is configured in js/config.js. Child activities still use local fallbacks, but live model evaluation needs the protected endpoint.");
      return;
    }
    const selected = selectedProfiles();
    if (!selected.length) { status("warn", "Select at least one profile."); return; }

    currentRun = {
      id: "eval-" + Date.now() + "-" + Math.random().toString(36).slice(2,8),
      createdAt: new Date().toISOString(),
      mode,
      entries: [],
    };
    setBusy(true);
    renderResults();
    const total = selected.length * scenarios.length;
    let completed = 0;
    status("busy", "Running 0/"+total+" model evaluations sequentially…");

    for (const scenario of scenarios) {
      for (const profileId of selected) {
        const profile = profiles.find((p) => p.id === profileId);
        const entry = {
          id: scenario.id + "::" + profileId,
          scenarioId: scenario.id,
          scenarioLabel: scenario.label,
          scenarioDescription: scenario.description,
          domain: scenario.input.domain === "language" ? "language" : "math",
          profileId,
          profileLabel: (profile && profile.label) || profileId,
          input: scenario.input,
          review: {},
        };
        try {
          entry.result = await api.runAnyLessonHintEval(api.client, { ...scenario.input, profileId });
        } catch (error) {
          entry.error = error instanceof Error ? error.message : String(error);
        }
        currentRun.entries.push(entry);
        completed += 1;
        status("busy", "Running "+completed+"/"+total+" model evaluations sequentially…");
        renderResults();
      }
    }

    setBusy(false);
    const ok = currentRun.entries.filter((e) => e.result && !e.error).length;
    const guard = currentRun.entries.filter((e) => e.result && e.result.guardrails && e.result.guardrails.passed).length;
    saveCurrentRun();
    status(ok ? "ok" : "error", ok+"/"+total+" responses validated · "+guard+" passed local guardrails · run saved locally.");
  }

  async function runSelected() {
    let scenario;
    try { scenario = readManualScenario(); }
    catch (error) { status("warn", error instanceof Error ? error.message : String(error)); return; }
    await runCases([scenario], "single");
  }

  async function runSuite() {
    await runCases(suiteScenarios, "suite");
  }

  function exportHistory() {
    const history = loadHistory();
    if (!history.length) { status("warn", "There is no saved evaluation history to export."); return; }
    const payload = {
      format: "summer-quest-ai-eval-history",
      version: 2,
      exportedAt: new Date().toISOString(),
      runs: history,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summer-quest-ai-evals-" + new Date().toISOString().slice(0,10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    status("ok", "Saved evaluation history exported as JSON.");
  }

  async function init() {
    renderHistory();
    renderResults();
    setDomain($("aiLabDomain").value);
    try {
      const [catalog, clientMod, evalMod] = await Promise.all([
        import("../dist/mobile/packages/agent/src/routing/ModelCatalog.js"),
        import("../dist/mobile/packages/agent/src/client/AgentHttpClient.js"),
        import("../dist/mobile/packages/agent/src/eval/LessonHintEval.js"),
      ]);
      profiles = catalog.listModelProfiles({ includeDevelopment: true });
      suiteScenarios = [...evalMod.LESSON_HINT_EVAL_SCENARIOS];
      const client = endpoint ? new clientMod.AgentHttpClient({ endpoint, timeoutMs }) : null;
      api = { runAnyLessonHintEval: evalMod.runAnyLessonHintEval, client };
      serverHealth = await readServerHealth();
      renderProfiles();
      setBusy(false);
      const liveStatus = healthStatusText(serverHealth);
      if (liveStatus) {
        const anyProvider = Object.values(serverHealth.providers || {}).some(Boolean);
        status(anyProvider ? "ok" : "warn", liveStatus + (anyProvider ? "" : " · add a provider key in server/agent-proxy/.env"));
      } else if (endpoint) status("ok", "Protected agent endpoint configured. Run a single case or the 5-case Math + Vocabulary suite. Profile requests remain subject to the server allow-list.");
      else status("warn", "Remote endpoint not configured. Configure SUMMER_AGENT_ENDPOINT to run live comparisons.");
    } catch (error) {
      api = null;
      setBusy(true);
      status("error", "AI Lab could not load: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  $("aiLabDomain").addEventListener("change", (e) => setDomain(e.target.value));
  $("aiLabRun").addEventListener("click", runSelected);
  $("aiLabSuite").addEventListener("click", runSuite);
  $("aiLabExample").addEventListener("click", () => {
    $("aiLabDomain").value = "math"; setDomain("math");
    $("aiLabOperation").value = "addition"; $("aiLabLeft").value = "8"; $("aiLabRight").value = "7"; $("aiLabAnswer").value = "14";
    $("aiLabAge").value = "7"; $("aiLabReading").value = "early_reader"; $("aiLabLevel").value = "2";
  });
  $("aiLabVocabExample").addEventListener("click", () => {
    $("aiLabDomain").value = "language"; setDomain("language");
    $("aiLabTarget").value = "apple"; $("aiLabEmoji").value = "🍎"; $("aiLabFrench").value = "pomme"; $("aiLabChinese").value = "蘋果";
    $("aiLabAge").value = "7"; $("aiLabReading").value = "early_reader"; $("aiLabLevel").value = "2";
  });
  $("aiLabClear").addEventListener("click", () => { currentRun = null; renderResults(); status("", "Current view cleared. Saved history was kept."); });
  $("aiLabExport").addEventListener("click", exportHistory);
  $("aiLabClearHistory").addEventListener("click", () => {
    if (!confirm("Clear the locally saved AI evaluation history?")) return;
    localStorage.removeItem(HISTORY_KEY); renderHistory(); status("", "Saved evaluation history cleared.");
  });

  root.addEventListener("change", (event) => {
    const select = event.target.closest("select[data-review]");
    if (!select || !currentRun) return;
    const entry = currentRun.entries.find((item) => item.id === select.dataset.entry);
    if (!entry) return;
    const value = Number(select.value);
    entry.review = entry.review || {};
    if (Number.isFinite(value) && value >= 1 && value <= 5) entry.review[select.dataset.review] = value;
    else delete entry.review[select.dataset.review];
    renderSummary();
    saveCurrentRun();
  });

  $("aiLabHistory").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-load-run]");
    if (!button) return;
    const run = loadHistory().find((item) => item.id === button.dataset.loadRun);
    if (!run) return;
    currentRun = run;
    renderResults();
    status("ok", "Loaded saved evaluation run from " + fmtDate(run.createdAt) + ".");
  });

  init();
}
