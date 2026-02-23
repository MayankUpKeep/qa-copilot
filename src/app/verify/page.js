"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";

export default function VerifyPage() {
  const [story, setStory] = useState("");
  const [prContext, setPrContext] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateVerification = async () => {
    if (!story) return;

    setLoading(true);
    setResult("");

    const combinedStory = prContext
      ? story + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : story;

    const res = await fetch("/api/qa-verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ story: combinedStory, notes }),
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
      <h2 className="text-2xl font-semibold mb-6">QA Verification Comment</h2>
      <JiraFetch
        onFetched={(text) => setStory(text)}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="emerald"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticket / Story</label>
          <textarea
            className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Paste Jira story or summary..."
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
          <textarea
            className="w-full min-h-[160px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => setPrContext(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Testing Notes (optional)</label>
        <textarea
          className="w-full min-h-[120px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="What you specifically tested (roles, search, reload, API, edge cases...)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={generateVerification}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          {loading ? "Generating..." : "Generate QA Comment"}
        </button>
        <button
          onClick={() => {
            setStory("");
            setPrContext("");
            setNotes("");
            setResult("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>
        <InfoTooltip description="Creates QA verification comments documenting what you tested. Includes story details and specific test coverage areas." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              {copied ? "Copied!" : "Copy Comment"}
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
