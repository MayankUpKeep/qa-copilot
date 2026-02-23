"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";

export default function FlowsPage() {
  const [story, setStory] = useState("");
  const [prContext, setPrContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeFlows = async () => {
    if (!story) return;

    setLoading(true);
    setResult("");

    const combinedInput = prContext
      ? story + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : story;

    const res = await fetch("/api/flow-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ story: combinedInput }),
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
      <h2 className="text-2xl font-semibold mb-6">Flow Coverage Planner</h2>
      <JiraFetch
        onFetched={(text) => setStory(text)}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="teal"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticket / Story</label>
          <textarea
            className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Paste Jira story or acceptance criteria..."
            value={story}
            onChange={(e) => setStory(e.target.value)}
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
          onClick={analyzeFlows}
          className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          {loading ? "Analyzing..." : "Analyze Coverage"}
        </button>
        <button
          onClick={() => {
            setStory("");
            setPrContext("");
            setResult("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>
        <InfoTooltip description="Plans test coverage for different user flows and scenarios from a story. Maps out user journeys and identifies critical paths to test." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              {copied ? "Copied!" : "Copy Coverage"}
            </button>
          </div>

          <div className="p-6 bg-white rounded-lg border border-gray-300">
            <pre className="whitespace-pre-wrap text-gray-900 text-sm leading-7 font-mono">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
