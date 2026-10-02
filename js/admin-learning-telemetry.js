import {
  LEARNING_TELEMETRY_STORAGE_KEY,
  normalizeLearningTelemetryEvent,
  summarizeLearningTelemetry,
} from "../dist/mobile/packages/learning/src/telemetry/LearningTelemetry.js";
import { evaluateTutorPolicy } from "../dist/mobile/packages/learning/src/telemetry/TutorPolicyEvaluation.js";
import { evaluateTutorExperiments } from "../dist/mobile/packages/learning/src/telemetry/TutorExperimentEvaluation.js";

const $ = (id) => document.getElementById(id);
let current = { source: "none", events: [], summaries: [], policy: [], experiments: [] };

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
}

function pct(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) + "%" : "—";
}

function money(value) {
  const n = Number(value) || 0;
  if (n <= 0) return "$0";
  if (n < 0.01) return "$" + n.toFixed(5);
  return "$" + n.toFixed(3);
}

function ms(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n >= 1000 ? (n / 1000).toFixed(1) + "s" : Math.round(n) + "ms";
}

function kidLabel(id) {
  const kids = window.KIDS || {};
  return kids[id] && kids[id].name ? kids[id].name : id;
}

function localEvents() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEARNING_TELEMETRY_STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizeLearningTelemetryEvent).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadEvents() {
  const cfg = window.SQ_CONFIG || {};
  const endpoint = typeof cfg.SUMMER_LEARNING_TELEMETRY_ENDPOINT === "string" ? cfg.SUMMER_LEARNING_TELEMETRY_ENDPOINT.trim() : "";
  if (endpoint) {
    try {
      const response = await fetch(endpoint, { method: "GET", credentials: "same-origin", cache: "no-store" });
      if (response.ok) {
        const body = await response.json();
        const events = Array.isArray(body && body.events) ? body.events.map(normalizeLearningTelemetryEvent).filter(Boolean) : [];
        return { source: "family_pc", endpoint, events };
      }
    } catch { /* local fallback below */ }
  }
  return { source: "this_browser", endpoint: "", events: localEvents() };
}

function sourceLabel(source) {
  return source === "family_pc" ? "family PC · all mirrored devices" : source === "this_browser" ? "this browser only" : "unavailable";
}

function renderSummary(summaries, events) {
  const el = $("learningTelemetrySummary");
  if (!el) return;
  const attempts = summaries.reduce((n, row) => n + row.attempts, 0);
  const independentAttempts = summaries.reduce((n, row) => n + row.independentAttempts, 0);
  const independentCorrect = summaries.reduce((n, row) => n + row.independentCorrectAttempts, 0);
  const interventions = summaries.reduce((n, row) => n + row.interventionCount, 0);
  const aiHints = summaries.reduce((n, row) => n + row.remoteHintCount, 0);
  const localHints = summaries.reduce((n, row) => n + row.localHintCount, 0);
  const cost = summaries.reduce((n, row) => n + row.estimatedCostUsd, 0);
  const recoveries = summaries.reduce((n, row) => n + row.retryRecoveries, 0);
  const retryAttempts = summaries.reduce((n, row) => n + row.retryAttempts, 0);
  el.innerHTML = '<div class="metric-grid">' +
    '<div class="metric"><span class="lbl">Events</span><b>' + events.length + '</b></div>' +
    '<div class="metric"><span class="lbl">Attempts</span><b>' + attempts + '</b></div>' +
    '<div class="metric"><span class="lbl">Independent success</span><b>' + pct(independentAttempts ? independentCorrect / independentAttempts : null) + '</b></div>' +
    '<div class="metric"><span class="lbl">Tutor interventions</span><b>' + interventions + '</b></div>' +
    '<div class="metric"><span class="lbl">Hints</span><b>' + aiHints + ' AI · ' + localHints + ' local</b></div>' +
    '<div class="metric"><span class="lbl">Retry recovery</span><b>' + pct(retryAttempts ? recoveries / retryAttempts : null) + '</b></div>' +
    '<div class="metric"><span class="lbl">Hint estimated cost</span><b>' + money(cost) + '</b></div>' +
    '</div>';
}

function renderKnowledgeHelpDiagnostics(events) {
  const el = $("knowledgeHelpDiagnostics");
  if (!el) return;
  const rows = events.filter((event) => event.type === "tutor_help").slice(-40).reverse();
  if (!rows.length) { el.innerHTML = '<div class="empty">No Explore help requests yet.</div>'; return; }
  const available = (n, format) => typeof n === "number" && Number.isFinite(n) ? format(n) : "Unavailable";
  el.innerHTML = '<table class="tbl"><thead><tr><th>Learner / lesson</th><th>Task / outcome</th><th>Route / fallback</th><th>Selected profile</th><th>Latency</th><th>Input / output tokens</th><th>Estimated cost</th></tr></thead><tbody>'+rows.map((event) =>
    '<tr><td data-l="Lesson">'+esc(kidLabel(event.learnerId))+'<span class="tbl__note">'+esc(event.lessonId)+'</span></td>'+
    '<td data-l="Task">knowledge_help<span class="tbl__note">'+esc(event.outcome)+'</span></td>'+
    '<td data-l="Route">'+esc(event.provider || event.source)+'<span class="tbl__note">'+esc(event.fallbackReason || "none")+'</span></td>'+
    '<td data-l="Profile">'+esc(event.profileId || "Unavailable")+'<span class="tbl__note">'+esc(event.model || "Unavailable")+'</span></td>'+
    '<td data-l="Latency">'+available(event.latencyMs,ms)+'</td><td data-l="Tokens">'+available(event.inputTokens,String)+' / '+available(event.outputTokens,String)+'</td>'+
    '<td data-l="Cost">'+available(event.estimatedCostUsd,money)+'</td></tr>').join("")+'</tbody></table>';
}

function renderLearningTable(summaries) {
  const el = $("learningTelemetryTable");
  if (!el) return;
  if (!summaries.length) {
    el.innerHTML = '<div class="empty">No learning telemetry yet. Run Math or Word Wizard Study to collect evidence.</div>';
    return;
  }
  el.innerHTML = '<table class="tbl"><thead><tr>' +
    '<th>Learner</th><th>Domain / skill</th><th class="r">Attempts</th><th class="r">Independent</th><th>Trend</th><th class="r">Support</th><th class="r">AI / local hints</th><th class="r">Retry recovery</th><th>Top pattern</th><th class="r">Avg response</th><th class="r">AI cost</th>' +
    '</tr></thead><tbody>' + summaries.map((row) =>
      '<tr><td data-l="Learner"><b>' + esc(kidLabel(row.learnerId)) + '</b></td>' +
      '<td data-l="Domain"><b>' + esc(row.domain) + '</b><span class="tbl__note">' + esc(row.skill) + '</span></td>' +
      '<td data-l="Attempts" class="r num">' + row.attempts + '</td>' +
      '<td data-l="Independent" class="r num">' + pct(row.independentCorrectRate) + '</td>' +
      '<td data-l="Trend"><span class="tag">' + esc(row.independenceTrend) + '</span></td>' +
      '<td data-l="Support" class="r num">' + row.interventionCount + '</td>' +
      '<td data-l="Hints" class="r num">' + row.remoteHintCount + ' / ' + row.localHintCount + '</td>' +
      '<td data-l="Recovery" class="r num">' + pct(row.retryRecoveryRate) + '</td>' +
      '<td data-l="Pattern">' + esc(row.topMistake || '—') + '</td>' +
      '<td data-l="Response" class="r num">' + ms(row.averageResponseMs) + '</td>' +
      '<td data-l="Cost" class="r num">' + money(row.estimatedCostUsd) + '</td></tr>'
    ).join("") + '</tbody></table>';
}

function evidenceText(level) {
  if (level === "usable") return "usable sample";
  if (level === "emerging") return "emerging";
  if (level === "low") return "low sample";
  return "very low sample";
}

function delta(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const n = Math.round(value * 100);
  return (n > 0 ? "+" : "") + n + " pp";
}

function renderPolicy(rows) {
  const el = $("tutorPolicyEvidence");
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty">No tutor intervention evidence yet. Results appear after adaptive support has been used.</div>';
    return;
  }
  el.innerHTML = '<table class="tbl"><thead><tr>' +
    '<th>Learner</th><th>Skill</th><th>Intervention</th><th class="r">Uses</th><th class="r">Support success</th><th class="r">Retry recovery</th><th class="r">Next independent</th><th class="r">Later independence</th><th>Evidence</th>' +
    '</tr></thead><tbody>' + rows.map((row) =>
      '<tr><td data-l="Learner">' + esc(kidLabel(row.learnerId)) + '</td>' +
      '<td data-l="Skill"><b>' + esc(row.domain) + '</b><span class="tbl__note">' + esc(row.skill) + '</span></td>' +
      '<td data-l="Intervention"><code>' + esc(row.intervention) + '</code></td>' +
      '<td data-l="Uses" class="r num">' + row.uses + '</td>' +
      '<td data-l="Support success" class="r num">' + pct(row.supportSuccessRate) + '</td>' +
      '<td data-l="Retry recovery" class="r num">' + pct(row.retryRecoveryRate) + '</td>' +
      '<td data-l="Next independent" class="r num">' + pct(row.nextIndependentCorrectRate) + '</td>' +
      '<td data-l="Later independence" class="r num">' + pct(row.laterIndependentCorrectRate) + '<span class="tbl__note">' + delta(row.independenceDelta) + '</span></td>' +
      '<td data-l="Evidence"><span class="tag">' + esc(evidenceText(row.evidence)) + '</span></td></tr>'
    ).join("") + '</tbody></table>';
}


function activeExperimentIds() {
  const cfg = window.SQ_CONFIG || {};
  return Array.isArray(cfg.SUMMER_TUTOR_EXPERIMENTS) ? cfg.SUMMER_TUTOR_EXPERIMENTS.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()) : [];
}

function renderExperiments(rows) {
  const status = $("tutorExperimentStatus");
  const el = $("tutorExperimentEvidence");
  const active = activeExperimentIds();
  if (status) status.textContent = active.length ? ("active · " + active.join(", ")) : "off by default";
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div class="empty">' + (active.length ? 'Experiment is enabled but no eligible intervention evidence has been collected yet.' : 'No controlled tutor experiment is enabled. Set <code>SUMMER_TUTOR_EXPERIMENTS=math-near-miss-support-v1</code> on the family-PC server when you intentionally want to collect comparison evidence.') + '</div>';
    return;
  }
  el.innerHTML = '<table class="tbl"><thead><tr>' +
    '<th>Experiment</th><th>Variant</th><th>Support</th><th class="r">Learners</th><th class="r">Uses</th><th class="r">Support success</th><th class="r">Retry recovery</th><th class="r">Next independent</th><th class="r">Later independence</th><th>Evidence</th>' +
    '</tr></thead><tbody>' + rows.map((row) =>
      '<tr><td data-l="Experiment"><code>' + esc(row.experimentId) + '</code></td>' +
      '<td data-l="Variant"><b>' + esc(row.variantId) + '</b></td>' +
      '<td data-l="Support"><span class="tag">' + esc(row.intervention) + '</span></td>' +
      '<td data-l="Learners" class="r num">' + row.learners + '</td>' +
      '<td data-l="Uses" class="r num">' + row.uses + '</td>' +
      '<td data-l="Support success" class="r num">' + pct(row.supportSuccessRate) + '</td>' +
      '<td data-l="Retry recovery" class="r num">' + pct(row.retryRecoveryRate) + '</td>' +
      '<td data-l="Next independent" class="r num">' + pct(row.nextIndependentCorrectRate) + '</td>' +
      '<td data-l="Later independence" class="r num">' + pct(row.laterIndependentCorrectRate) + '<span class="tbl__note">' + delta(row.independenceDelta) + '</span></td>' +
      '<td data-l="Evidence"><span class="tag">' + esc(evidenceText(row.evidence)) + '</span></td></tr>'
    ).join("") + '</tbody></table>';
}

async function render() {
  const source = $("learningTelemetrySource");
  if (source) source.textContent = "loading";
  const loaded = await loadEvents();
  const summaries = summarizeLearningTelemetry(loaded.events);
  const policy = evaluateTutorPolicy(loaded.events);
  const experiments = evaluateTutorExperiments(loaded.events);
  current = { source: loaded.source, endpoint: loaded.endpoint, events: loaded.events, summaries, policy, experiments };
  if (source) source.textContent = sourceLabel(loaded.source);
  renderSummary(summaries, loaded.events);
  renderLearningTable(summaries);
  renderKnowledgeHelpDiagnostics(loaded.events);
  renderPolicy(policy);
  renderExperiments(experiments);
}

function downloadJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: current.source,
    events: current.events,
    summaries: current.summaries,
    tutorPolicyEvidence: current.policy,
    tutorExperimentEvidence: current.experiments,
    enabledTutorExperiments: activeExperimentIds(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "summer-quest-learning-telemetry-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function clearCurrent() {
  if (!confirm("Clear the learning telemetry currently shown? This does not reset learner progress.")) return;
  if (current.source === "family_pc" && current.endpoint) {
    try {
      const response = await fetch(current.endpoint, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("clear failed");
    } catch {
      alert("Could not clear the family-PC telemetry collector.");
      return;
    }
  } else {
    localStorage.removeItem(LEARNING_TELEMETRY_STORAGE_KEY);
  }
  await render();
}

var refreshBtn = $("learningTelemetryRefresh");
var exportBtn = $("learningTelemetryExport");
var clearBtn = $("learningTelemetryClear");
if (refreshBtn) refreshBtn.addEventListener("click", () => { void render(); });
if (exportBtn) exportBtn.addEventListener("click", downloadJson);
if (clearBtn) clearBtn.addEventListener("click", () => { void clearCurrent(); });

window.SQLearningTelemetryAdmin = { render, getCurrent: () => current };
if (location.hash === "#reports") void render();
