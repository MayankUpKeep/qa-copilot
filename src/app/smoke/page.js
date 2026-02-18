"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function SmokePage() {
  const [story, setStory] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateChecklist = async () => {
    if (!story) return;

    setLoading(true);
    setResult("");

    const res = await fetch("/api/smoke-checklist", {
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
      <h2 className="text-2xl font-semibold mb-6">Ticket Closure Smoke Checklist</h2>

      <textarea
        className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm"
        placeholder="Paste Jira story..."
        value={story}
        onChange={(e) => setStory(e.target.value)}
      />

      <div className="flex gap-3">
        <button
          onClick={generateChecklist}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          {loading ? "Generating..." : "Generate Smoke Checklist"}
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
        <InfoTooltip description="Generates a smoke test checklist for ticket closure verification. Lists all critical tests to run before marking ticket as done." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              {copied ? "Copied!" : "Copy Checklist"}
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
