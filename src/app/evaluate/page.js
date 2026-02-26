"use client";

import { useState, useEffect } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";
import Spinner from "@/components/Spinner";
import useTicketFromUrl from "@/lib/useTicketFromUrl";

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

  useTicketFromUrl({
    onTicket: (text) => updateStory(text),
    onPr: (text) => updatePr(text),
    onLabels: (labels) => setTicketLabels(labels),
  });

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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Evaluate & Define Scope</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Plan A (user perspective) when the story is in <strong>Ready</strong>, Plan B (technical analysis) when the PR hits <strong>Code Review</strong>. Merge both to define the complete testing scope.
      </p>

      <JiraFetch
        onFetched={(text, ticket) => { updateStory(text); if (ticket?.labels) setTicketLabels(ticket.labels); }}
        onPrFetched={(text) => updatePr(text)}
        colorClass="blue"
      />

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ticket / Story</label>
        <textarea
          className="w-full min-h-[150px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste the full Jira story or bug description here..."
          value={story}
          onChange={(e) => updateStory(e.target.value)}
        />
      </div>

      {/* Phase 1: Plan A */}
      <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">PHASE 1</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Story in Ready — User Perspective</h3>
          <InfoTooltip description="Generate when the story moves to Ready. Thinks from the end-user's perspective: user journeys, UX flows, edge cases a real user would hit. No code or technical details." />
        </div>

        <div className="p-5">
          <div className="flex gap-2 mb-3">
            <button
              onClick={generatePlanA}
              disabled={loadingA || !story}
              className="inline-flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50 transition-all font-medium shadow-sm"
            >
              {loadingA ? <><Spinner className="w-3.5 h-3.5" /> Generating...</> : "Generate Plan A"}
            </button>
            {planA && (
              <button
                onClick={() => copyText(planA, "planA")}
                className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
              >
                {copiedSection === "planA" ? "Copied!" : "Copy Plan A"}
              </button>
            )}
          </div>

          <textarea
            className="w-full min-h-[200px] p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-gray-400 focus:bg-white font-mono transition-colors"
            placeholder="Plan A will appear here after generating, or paste a previously saved plan..."
            value={planA}
            onChange={(e) => { setPlanA(e.target.value); persist({ planA: e.target.value }); }}
          />
          {loadingA && (
            <div className="flex items-center gap-2 text-gray-400 text-xs mt-2">
              <Spinner className="w-3 h-3" /> Generating user-perspective plan...
            </div>
          )}
        </div>
      </div>

      {/* Phase 2: Plan B */}
      <div className="mb-6 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">PHASE 2</span>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Code Review — Technical Analysis</h3>
          <InfoTooltip description="Generate when the PR is in code review. Strictly technical: analyzes actual code changes, API behavior, error handling, boundary conditions, and regression from the PR diff." />
        </div>

        <div className="p-5">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PR / Code Changes</label>
            <GitHubPRFetch onFetched={(text) => updatePr(text)} colorClass="orange" />
            <textarea
              className="w-full min-h-[100px] p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
              value={prContext}
              onChange={(e) => updatePr(e.target.value)}
            />
          </div>

          {appMapStatus?.hasMap && (
            <div className="text-xs text-gray-400 mb-3">
              App map: {appMapStatus.routes?.length || 0} routes, {(appMapStatus.coreEndpoints?.length || 0) + (appMapStatus.webEndpoints?.length || 0)} endpoints
            </div>
          )}
          {appMapStatus && !appMapStatus.hasMap && appMapStatus.ok && (
            <div className="text-xs text-amber-600 mb-3">App map not configured — regression areas won&apos;t be included.</div>
          )}

          <div className="flex gap-2 mb-3">
            <button
              onClick={generatePlanB}
              disabled={loadingB || !story}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-all font-medium shadow-sm"
            >
              {loadingB ? <><Spinner className="w-3.5 h-3.5" /> Generating...</> : "Generate Plan B"}
            </button>
            {planB && (
              <button
                onClick={() => copyText(planB, "planB")}
                className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
              >
                {copiedSection === "planB" ? "Copied!" : "Copy Plan B"}
              </button>
            )}
          </div>

          <textarea
            className="w-full min-h-[200px] p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/30 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white font-mono transition-colors"
            placeholder="Plan B will appear here after generating, or paste a previously saved plan..."
            value={planB}
            onChange={(e) => { setPlanB(e.target.value); persist({ planB: e.target.value }); }}
          />
          {loadingB && (
            <div className="flex items-center gap-2 text-blue-400 text-xs mt-2">
              <Spinner className="w-3 h-3" /> Generating technical analysis from PR...
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <button
          onClick={defineScope}
          disabled={scopeLoading || !planA || !planB}
          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {scopeLoading ? <><Spinner className="w-4 h-4" /> Refining...</> : "Refined Test Plan"}
        </button>
        <button
          onClick={showDiff}
          disabled={diffLoading || !planA || !planB}
          className="inline-flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {diffLoading ? <><Spinner className="w-4 h-4" /> Comparing...</> : "Show Diff"}
        </button>
        <button
          onClick={clearAll}
          className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm"
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
          <span className="text-xs text-emerald-600">Both plans ready.</span>
        )}
      </div>

      {/* Diff Output */}
      {(diff || diffLoading) && (
        <div className="mb-6 rounded-xl border border-purple-200 dark:border-purple-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">DIFF</span>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plan A vs Plan B</h3>
            </div>
            {diff && (
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(diff, "diff")}
                  className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                >
                  {copiedSection === "diff" ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={() => copyAsPlainText(diff, "diffPlain")}
                  className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {copiedSection === "diffPlain" ? "Copied!" : "Copy as Text"}
                </button>
              </div>
            )}
          </div>
          {diff && (
            <div className="flex flex-wrap gap-2 px-5 py-2.5 bg-purple-50/50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 font-medium">ALIGNED</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-medium">PLAN A ONLY</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-medium">PLAN B ONLY</span>
            </div>
          )}
          <div className="p-5">
            {diffLoading ? (
              <div className="flex items-center gap-2 text-purple-500 text-sm">
                <Spinner className="w-4 h-4" /> Comparing Plan A and Plan B...
              </div>
            ) : (
              <FormattedOutput text={diff} />
            )}
          </div>
        </div>
      )}

      {/* Refined Plan Output */}
      {(scope || scopeLoading) && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">REFINED PLAN</span>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Refined Test Plan</h3>
            </div>
            {scope && (
              <div className="flex gap-2">
                <button
                  onClick={() => copyText(scope, "scope")}
                  className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                >
                  {copiedSection === "scope" ? "Copied!" : "Copy Markdown"}
                </button>
                <button
                  onClick={() => copyAsPlainText(scope, "scopePlain")}
                  className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {copiedSection === "scopePlain" ? "Copied!" : "Copy as Text"}
                </button>
              </div>
            )}
          </div>
          <div className="p-5">
            {scopeLoading ? (
              <div className="flex items-center gap-2 text-emerald-500 text-sm">
                <Spinner className="w-4 h-4" /> Merging both plans into a refined test plan...
              </div>
            ) : (
              <FormattedOutput text={scope} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
