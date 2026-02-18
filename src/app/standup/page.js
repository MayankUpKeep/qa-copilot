"use client";

import { useState } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function StandupPage() {
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateStandup = async () => {
    if (!notes) return;

    setLoading(true);
    setResult("");

    const res = await fetch("/api/generate-standup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes }),
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
      <h2 className="text-2xl font-semibold mb-6">Standup Assistant</h2>

      <textarea
        className="w-full min-h-[220px] p-4 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Write rough notes about what you tested, bugs found, verifications, and plans..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex gap-3">
        <button
          onClick={generateStandup}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          {loading ? "Generating..." : "Generate Standup Update"}
        </button>
        <button
          onClick={() => {
            setNotes("");
            setResult("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>
        <InfoTooltip description="Generates professional standup updates from your daily testing notes. Formats your work into clear, concise standup comments." />
      </div>

      {result && (
        <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              {copied ? "Copied!" : "Copy Standup"}
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
