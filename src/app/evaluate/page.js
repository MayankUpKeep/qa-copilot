"use client";

import { useState, useEffect } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";

const LS_KEY = "qa_evaluate";

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch { return {}; }
}

function persist(patch) {
  const current = loadSaved();
  localStorage.setItem(LS_KEY, JSON.stringify({ ...current, ...patch }));
}

export default function EvaluatePage() {
  const [story, setStory] = useState("");
  const [prContext, setPrContext] = useState("");
  const [planA, setPlanA] = useState("");
  const [planB, setPlanB] = useState("");
  const [scope, setScope] = useState("");
  const [diff, setDiff] = useState("");
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState(null);
  const [ticketLabels, setTicketLabels] = useState([]);
  const [appMapStatus, setAppMapStatus] = useState(null);

  useEffect(() => {
    const saved = loadSaved();
    if (saved.story) setStory(saved.story);
    if (saved.prContext) setPrContext(saved.prContext);
    if (saved.planA) setPlanA(saved.planA);
    if (saved.planB) setPlanB(saved.planB);
    if (saved.scope) setScope(saved.scope);
    if (saved.diff) setDiff(saved.diff);

    fetch("/api/app-map")
      .then((r) => r.json())
      .then((data) => setAppMapStatus(data))
      .catch(() => setAppMapStatus({ ok: false, hasMap: false }));
  }, []);

  const generatePlanA = async () => {
    if (!story) return;
    setLoadingA(true);
    setPlanA("");
    setScope("");
    persist({ scope: "" });

    const res = await fetch("/api/evaluate/phase1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story, labels: ticketLabels }),
    });
    const data = await res.json();
    setPlanA(data.output);
    persist({ planA: data.output });
    setLoadingA(false);
  };

  const generatePlanB = async () => {
    if (!story) return;
    setLoadingB(true);
    setPlanB("");
    setScope("");
    persist({ scope: "" });

    const res = await fetch("/api/evaluate/phase2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story, prContext, labels: ticketLabels }),
    });
    const data = await res.json();
    setPlanB(data.output);
    persist({ planB: data.output });
    setLoadingB(false);
  };

  const defineScope = async () => {
    if (!planA || !planB) return;
    setScopeLoading(true);
    setScope("");

    try {
      const res = await fetch("/api/evaluate-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, planA, planB, labels: ticketLabels }),
      });
      const data = await res.json();
      setScope(data.output);
      persist({ scope: data.output });
    } catch {
      setScope("Error generating scope.");
    }
    setScopeLoading(false);
  };

  const showDiff = async () => {
    if (!planA || !planB) return;
    setDiffLoading(true);
    setDiff("");

    try {
      const res = await fetch("/api/evaluate/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, planA, planB }),
      });
      const data = await res.json();
      setDiff(data.output);
      persist({ diff: data.output });
    } catch {
      setDiff("Error generating diff.");
    }
    setDiffLoading(false);
  };

  const copyText = async (text, key) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const stripMarkdown = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\|[\s\-:|]+\|$/gm, "")
      .replace(/^\|(.+)\|$/gm, (_, row) =>
        row.split("|").map((c) => c.trim()).filter(Boolean).join("  |  ")
      )
      .replace(/\[ALIGNED\]/g, "[ALIGNED]")
      .replace(/\[PLAN A ONLY\]/g, "[PLAN A ONLY]")
      .replace(/\[PLAN B ONLY\]/g, "[PLAN B ONLY]")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const copyAsPlainText = async (text, key) => {
    if (!text) return;
    await navigator.clipboard.writeText(stripMarkdown(text));
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const clearAll = () => {
    setStory(""); setPrContext(""); setPlanA(""); setPlanB(""); setScope(""); setDiff("");
    localStorage.removeItem(LS_KEY);
  };

  const updateStory = (text) => { setStory(text); persist({ story: text }); };
  const updatePr = (text) => { setPrContext(text); persist({ prContext: text }); };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-2">Evaluate & Define Scope</h2>
      <p className="text-sm text-gray-500 mb-6">
        Plan A (user perspective) when the story is in <strong>Ready</strong>, Plan B (technical analysis) when the PR hits <strong>Code Review</strong>. Merge both to define the complete testing scope.
      </p>

      <JiraFetch
        onFetched={(text, ticket) => { updateStory(text); if (ticket?.labels) setTicketLabels(ticket.labels); }}
        onPrFetched={(text) => updatePr(text)}
        colorClass="blue"
      />

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Ticket / Story</label>
        <textarea
          className="w-full min-h-[150px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste the full Jira story or bug description here..."
          value={story}
          onChange={(e) => updateStory(e.target.value)}
        />
      </div>

      {/* ── PHASE 1: Plan A ── */}
      <div className="mb-8 p-5 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="bg-gray-600 text-white text-xs font-bold px-2.5 py-1 rounded">PHASE 1</span>
          <h3 className="text-sm font-semibold text-gray-700">Story in Ready — User Perspective</h3>
          <InfoTooltip description="Generate when the story moves to Ready. Thinks from the end-user's perspective: user journeys, UX flows, edge cases a real user would hit. No code or technical details." />
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={generatePlanA}
            disabled={loadingA || !story}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loadingA ? "Generating..." : "Generate Plan A"}
          </button>
          {planA && (
            <button
              onClick={() => copyText(planA, "planA")}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              {copiedSection === "planA" ? "Copied!" : "Copy Plan A"}
            </button>
          )}
        </div>

        <textarea
          className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
          placeholder="Plan A will appear here after generating, or paste a previously saved plan..."
          value={planA}
          onChange={(e) => { setPlanA(e.target.value); persist({ planA: e.target.value }); }}
        />
        {loadingA && <div className="text-gray-400 text-xs mt-1 animate-pulse">Generating user-perspective plan...</div>}
      </div>

      {/* ── PHASE 2: Plan B ── */}
      <div className="mb-8 p-5 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded">PHASE 2</span>
          <h3 className="text-sm font-semibold text-gray-700">Code Review / Ready for Testing — Technical Analysis</h3>
          <InfoTooltip description="Generate when the PR is in code review. Strictly technical: analyzes actual code changes, API behavior, error handling, boundary conditions, and regression from the PR diff." />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => updatePr(text)} colorClass="orange" />
          <textarea
            className="w-full min-h-[100px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => updatePr(e.target.value)}
          />
        </div>

        {appMapStatus?.hasMap && (
          <div className="text-xs text-gray-500 mb-2">
            App map: {appMapStatus.routes?.length || 0} routes, {(appMapStatus.coreEndpoints?.length || 0) + (appMapStatus.webEndpoints?.length || 0)} endpoints
          </div>
        )}
        {appMapStatus && !appMapStatus.hasMap && appMapStatus.ok && (
          <div className="text-xs text-amber-600 mb-2">App map not configured — regression areas won't be included.</div>
        )}

        <div className="flex gap-2 mb-3">
          <button
            onClick={generatePlanB}
            disabled={loadingB || !story}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loadingB ? "Generating..." : "Generate Plan B"}
          </button>
          {planB && (
            <button
              onClick={() => copyText(planB, "planB")}
              className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700"
            >
              {copiedSection === "planB" ? "Copied!" : "Copy Plan B"}
            </button>
          )}
        </div>

        <textarea
          className="w-full min-h-[200px] p-4 border border-blue-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          placeholder="Plan B will appear here after generating, or paste a previously saved plan..."
          value={planB}
          onChange={(e) => { setPlanB(e.target.value); persist({ planB: e.target.value }); }}
        />
        {loadingB && <div className="text-blue-400 text-xs mt-1 animate-pulse">Generating technical analysis from PR...</div>}
      </div>

      {/* ── DEFINE SCOPE ── */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <button
          onClick={defineScope}
          disabled={scopeLoading || !planA || !planB}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50"
        >
          {scopeLoading ? "Defining scope..." : "Define Complete Scope"}
        </button>
        <button
          onClick={showDiff}
          disabled={diffLoading || !planA || !planB}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
        >
          {diffLoading ? "Comparing..." : "Show Diff"}
        </button>
        <button
          onClick={clearAll}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear All
        </button>
        {!planA && !planB && (
          <span className="text-xs text-gray-400">Generate or paste both plans to enable scope definition.</span>
        )}
        {planA && !planB && (
          <span className="text-xs text-amber-600">Plan A ready. Generate Plan B when the PR is available.</span>
        )}
        {planA && planB && !scope && !scopeLoading && (
          <span className="text-xs text-emerald-600">Both plans ready — click to define scope.</span>
        )}
      </div>

      {(diff || diffLoading) && (
        <div className="mt-4 mb-6 p-5 bg-purple-50 rounded-xl border-2 border-purple-400">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="bg-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded">DIFF</span>
              <h3 className="text-sm font-semibold text-gray-700">Plan A vs Plan B — Alignment Diff</h3>
            </div>
            {diff && (
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(diff, "diff")}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                >
                  {copiedSection === "diff" ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={() => copyAsPlainText(diff, "diffPlain")}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
                >
                  {copiedSection === "diffPlain" ? "Copied!" : "Copy as Text"}
                </button>
              </div>
            )}
          </div>
          {diff && (
            <div className="flex flex-wrap gap-3 mb-3 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-green-100 text-green-800 border-green-300 font-medium">ALIGNED — Same coverage in both</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-amber-100 text-amber-800 border-amber-300 font-medium">PLAN A ONLY — Potential gap</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded border bg-blue-100 text-blue-800 border-blue-300 font-medium">PLAN B ONLY — Undocumented change</span>
            </div>
          )}
          <div className="p-4 bg-white rounded-lg border border-purple-300 min-h-[200px]">
            {diffLoading ? (
              <div className="text-purple-500 text-sm animate-pulse">Comparing Plan A and Plan B line by line...</div>
            ) : (
              <FormattedOutput text={diff} />
            )}
          </div>
        </div>
      )}

      {(scope || scopeLoading) && (
        <div className="mt-4 p-5 bg-emerald-50 rounded-xl border-2 border-emerald-400">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded">REFINED PLAN</span>
              <h3 className="text-sm font-semibold text-gray-700">Refined Test Plan</h3>
            </div>
            {scope && (
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(scope, "scope")}
                  className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                >
                  {copiedSection === "scope" ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={() => copyAsPlainText(scope, "scopePlain")}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
                >
                  {copiedSection === "scopePlain" ? "Copied!" : "Copy as Text"}
                </button>
              </div>
            )}
          </div>
          <div className="p-4 bg-white rounded-lg border border-emerald-300 min-h-[200px]">
            {scopeLoading ? (
              <div className="text-emerald-500 text-sm animate-pulse">Merging both plans into a refined test plan with thorough regression...</div>
            ) : (
              <FormattedOutput text={scope} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
