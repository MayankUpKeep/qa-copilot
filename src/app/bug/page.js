"use client";

import { useState, useEffect, useRef } from "react";
import Spinner from "@/components/Spinner";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";

export default function BugPage() {
  const [bug, setBug] = useState("");
  const [prContext, setPrContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fromExtension = useRef(false);
  const [urlTicketId, setUrlTicketId] = useState(null);

  const generateBug = async (incomingText) => {
    const textToUse = incomingText || bug;
    if (!textToUse) return;

    setLoading(true);
    setResult("");

    const combinedInput = prContext
      ? textToUse + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : textToUse;

    try {
      const res = await fetch("/api/generate-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bug: combinedInput }),
      });

      const data = await res.json();
      setResult(data.output);
      setLoading(false);

      if (incomingText) {
        await navigator.clipboard.writeText(data.output);
        alert("Improved bug copied to clipboard!");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("Failed to generate bug report.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get("ticketId");
    if (tid) {
      fromExtension.current = true;
      setUrlTicketId(tid.trim().toUpperCase());
      return;
    }

    const jira = params.get("jira");
    if (jira) {
      const decoded = decodeURIComponent(jira);
      setBug(decoded);
      setTimeout(() => generateBug(decoded), 600);
    }
  }, []);

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Bug Report Generator</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Generate detailed bug reports from brief descriptions</p>
      <JiraFetch
        initialTicketId={urlTicketId}
        onFetched={(text) => {
          setBug(text);
          if (fromExtension.current) {
            fromExtension.current = false;
            setTimeout(() => generateBug(text), 500);
          }
        }}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="red"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bug Description</label>
          <textarea
            className="w-full min-h-[250px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Describe the issue in 1-2 lines (what happened)..."
            value={bug}
            onChange={(e) => setBug(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
          <textarea
            className="w-full min-h-[210px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => setPrContext(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => generateBug()}
          disabled={loading || !bug}
          className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {loading ? <><Spinner className="w-4 h-4" /> Generating...</> : "Generate Bug Report"}
        </button>

        <button
          onClick={() => {
            setBug("");
            setPrContext("");
            setResult("");
          }}
          className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm"
        >
          Clear
        </button>

        <InfoTooltip description="Creates detailed bug reports with reproduction steps, expected vs actual results, and severity assessment from brief descriptions." />
      </div>

      {result && (
        <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">BUG REPORT</span>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy Bug Report"}
            </button>
          </div>
          <div className="p-6">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}
    </div>
  );
}
