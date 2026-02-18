"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function FlowsPage() {
  const [story, setStory] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeFlows = async () => {
    if (!story) return;

    setLoading(true);
    setResult("");

    const res = await fetch("/api/flow-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ story }),
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

      <textarea
        className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm leading-relaxed"
        placeholder="Paste Jira story or acceptance criteria..."
        value={story}
        onChange={(e) => setStory(e.target.value)}
      />

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
