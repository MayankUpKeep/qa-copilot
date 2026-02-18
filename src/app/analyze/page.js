"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function AnalyzePage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyzeLogs = async () => {
    if (!input) return;

    setLoading(true);
    setResult("");

    const res = await fetch("/api/log-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
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
      <h2 className="text-2xl font-semibold mb-6">Failure / Log Analyzer</h2>

      <textarea
        className="w-full min-h-[240px] p-4 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-red-500"
        placeholder="Paste console errors, API response, stack trace, or network failure..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="flex gap-3">
        <button
          onClick={analyzeLogs}
          className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          {loading ? "Analyzing..." : "Analyze Failure"}
        </button>
        <button
          onClick={() => {
            setInput("");
            setResult("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>
        <InfoTooltip description="Analyzes console errors, API responses, stack traces, and network failures to identify root causes and failure patterns." />
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
            <pre className="whitespace-pre-wrap text-gray-900 text-sm leading-7 font-mono">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
