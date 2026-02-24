"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";

export default function AutomationPage() {
  const [story, setStory] = useState("");
  const [prContext, setPrContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateTest = async () => {
    if (!story) return;

    setLoading(true);
    setResult("");

    const combinedInput = prContext
      ? story + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : story;

    const res = await fetch("/api/generate-automation", {
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
      <h2 className="text-2xl font-semibold mb-6">Playwright Test Generator</h2>
      <JiraFetch
        onFetched={(text) => setStory(text)}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="green"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticket / Story</label>
          <textarea
            className="w-full min-h-[240px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Paste Jira story or acceptance criteria..."
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
          <textarea
            className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => setPrContext(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={generateTest}
          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          {loading ? "Generating..." : "Generate Playwright Test"}
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
        <InfoTooltip description="Generates Playwright test code from Jira stories or acceptance criteria. Creates ready-to-use test scripts with assertions and page interactions." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {copied ? "Copied!" : "Copy Test File"}
            </button>
          </div>

          <div className="p-6 bg-white rounded-lg border border-gray-300 overflow-auto">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}
    </div>
  );
}
