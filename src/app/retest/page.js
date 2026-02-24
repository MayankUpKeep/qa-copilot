"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";

export default function RetestPage() {
  const [input, setInput] = useState("");
  const [prContext, setPrContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeImpact = async () => {
    if (!input) return;

    setLoading(true);
    setResult("");

    const combinedInput = prContext
      ? input + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : input;

    const res = await fetch("/api/retest-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: combinedInput }),
    });

    const data = await res.json();
    setResult(data.output);
    setLoading(false);
  };

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Retest / Regression Assistant</h2>
      <JiraFetch
        onFetched={(text) => setInput(text)}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="blue"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticket / Fix Details</label>
          <textarea
            className="w-full min-h-[220px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Paste PR description, fix notes, or developer comments..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="purple" />
          <textarea
            className="w-full min-h-[180px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => setPrContext(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={analyzeImpact}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          {loading ? "Analyzing..." : "Analyze Impact"}
        </button>
        <button
          onClick={() => {
            setInput("");
            setPrContext("");
            setResult("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>
        <InfoTooltip description="Analyzes PR descriptions and fix notes to determine what areas need retesting and verification after code changes." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              {copied ? "Copied!" : "Copy Analysis"}
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
