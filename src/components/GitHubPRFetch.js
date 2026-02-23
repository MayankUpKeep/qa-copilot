"use client";

import { useState } from "react";

export default function GitHubPRFetch({ onFetched, colorClass = "orange" }) {
  const [prUrl, setPrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const colorMap = {
    orange: "bg-orange-600 hover:bg-orange-700",
    purple: "bg-purple-600 hover:bg-purple-700",
  };

  const btnColor = colorMap[colorClass] || colorMap.orange;

  const fetchPR = async () => {
    if (!prUrl.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/github/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl: prUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch PR");
        return;
      }

      onFetched(data.formattedText, data.pr);
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchPR();
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      <input
        type="text"
        className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 flex-1 min-w-[280px]"
        placeholder="https://github.com/owner/repo/pull/123"
        value={prUrl}
        onChange={(e) => setPrUrl(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={fetchPR}
        disabled={loading}
        className={`text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${btnColor} disabled:opacity-50`}
      >
        {loading ? "Fetching..." : "Fetch PR"}
      </button>
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}
