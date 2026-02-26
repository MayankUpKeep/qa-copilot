"use client";

import { useState } from "react";
import Spinner from "@/components/Spinner";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";
import useTicketFromUrl from "@/lib/useTicketFromUrl";

export default function AutomationPage() {
  const [story, setStory] = useState("");
  const [prContext, setPrContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useTicketFromUrl({
    onTicket: (text) => setStory(text),
    onPr: (text) => setPrContext(text),
  });

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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Playwright Test Generator</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Generate Playwright test code from Jira stories or acceptance criteria.</p>

      <JiraFetch
        onFetched={(text) => setStory(text)}
        onPrFetched={(text) => setPrContext(text)}
        colorClass="green"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ticket / Story</label>
          <textarea
            className="w-full min-h-[240px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Paste Jira story or acceptance criteria..."
            value={story}
            onChange={(e) => setStory(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PR / Code Changes</label>
          <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
          <textarea
            className="w-full min-h-[200px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
            placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
            value={prContext}
            onChange={(e) => setPrContext(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={generateTest}
          disabled={loading || !story}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {loading ? <><Spinner className="w-4 h-4" /> Generating...</> : "Generate Playwright Test"}
        </button>
        <button
          onClick={() => {
            setStory("");
            setPrContext("");
            setResult("");
          }}
          className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm"
        >
          Clear
        </button>
        <InfoTooltip description="Generates Playwright test code from Jira stories or acceptance criteria. Creates ready-to-use test scripts with assertions and page interactions." />
      </div>

      {result && (
        <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">PLAYWRIGHT TEST</span>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy Test File"}
            </button>
          </div>
          <div className="p-6 overflow-auto">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}
    </div>
  );
}
