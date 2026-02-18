"use client";

import { useState, useEffect } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function BugPage() {
  const [bug, setBug] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ---------------- GENERATE BUG ---------------- */

  const generateBug = async (incomingText) => {
    const textToUse = incomingText || bug;
    if (!textToUse) return;

    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/generate-bug", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bug: textToUse }),
      });

      const data = await res.json();
      setResult(data.output);
      setLoading(false);

      // If opened from Jira extension → auto copy
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

  /* ---------------- AUTO-RUN WHEN OPENED FROM JIRA ---------------- */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jira = params.get("jira");

    if (!jira) return;

    const decoded = decodeURIComponent(jira);

    // fill textarea so user can see source
    setBug(decoded);

    // give React time to render updated state
    setTimeout(() => {
      generateBug(decoded);
    }, 600);
  }, []);

  /* ---------------- COPY BUTTON (MANUAL MODE) ---------------- */

  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ---------------- UI ---------------- */

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Bug Report Generator</h2>

      <textarea
        className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-red-500"
        placeholder="Describe the issue in 1-2 lines (what happened)..."
        value={bug}
        onChange={(e) => setBug(e.target.value)}
      />

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
            <pre className="whitespace-pre-wrap text-gray-900 text-sm leading-7 font-mono">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
