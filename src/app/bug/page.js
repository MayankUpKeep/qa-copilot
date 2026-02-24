"use client";

import { useState, useEffect } from "react";
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
    const jira = params.get("jira");

    if (!jira) return;

    const decoded = decodeURIComponent(jira);
    setBug(decoded);

    setTimeout(() => {
      generateBug(decoded);
    }, 600);
  }, []);

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Bug Report Generator</h2>
      <JiraFetch
        onFetched={(text) => setBug(text)}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="red"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bug Description</label>
          <textarea
            className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Describe the issue in 1-2 lines (what happened)..."
            value={bug}
            onChange={(e) => setBug(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
          <textarea
            className="w-full min-h-[210px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => setPrContext(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => generateBug()}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          {loading ? "Generating..." : "Generate Bug Report"}
        </button>

        <button
          onClick={() => {
            setBug("");
            setPrContext("");
            setResult("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>

        <InfoTooltip description="Creates detailed bug reports with reproduction steps, expected vs actual results, and severity assessment from brief descriptions." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              {copied ? "Copied!" : "Copy Bug Report"}
            </button>
          </div>

          <div className="p-6 bg-white rounded-lg border border-gray-300">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}
    </div>
  );
}
