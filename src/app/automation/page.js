"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function AutomationPage() {
  const [story, setStory] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateTest = async () => {
    if (!story) return;

    setLoading(true);
    setResult("");

    const res = await fetch("/api/generate-automation", {
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
      <h2 className="text-2xl font-semibold mb-6">Playwright Test Generator</h2>

      <textarea
        className="w-full min-h-[240px] p-4 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
        placeholder="Paste Jira story or acceptance criteria..."
        value={story}
        onChange={(e) => setStory(e.target.value)}
      />

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
            <pre className="whitespace-pre text-gray-900 text-sm leading-7 font-mono">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
