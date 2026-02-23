"use client";

import { useState } from "react";

export default function JiraFetch({ onFetched, onPrFetched, colorClass = "blue" }) {
  const [ticketId, setTicketId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prCount, setPrCount] = useState(null);

  const colorMap = {
    blue: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    teal: "bg-teal-600 hover:bg-teal-700 focus:ring-teal-500",
    red: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    emerald: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500",
    indigo: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500",
    green: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    orange: "bg-orange-600 hover:bg-orange-700 focus:ring-orange-500",
    purple: "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500",
  };

  const btnColor = colorMap[colorClass] || colorMap.blue;

  const fetchTicket = async () => {
    if (!ticketId.trim()) return;

    setLoading(true);
    setError("");
    setPrCount(null);

    try {
      const res = await fetch("/api/jira/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticketId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch ticket");
        return;
      }

      onFetched(data.ticketText, data.ticket);

      if (onPrFetched && data.prText) {
        onPrFetched(data.prText, data.prDetails);
      }

      setPrCount(data.prDetails?.length || 0);
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchTicket();
    }
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <input
        type="text"
        className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
        placeholder="e.g. NEX-327"
        value={ticketId}
        onChange={(e) => setTicketId(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={fetchTicket}
        disabled={loading}
        className={`text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${btnColor} disabled:opacity-50`}
      >
        {loading ? "Fetching..." : "Fetch from Jira"}
      </button>
      {prCount !== null && prCount > 0 && (
        <span className="text-green-600 text-xs font-medium">{prCount} PR{prCount > 1 ? "s" : ""} auto-fetched</span>
      )}
      {prCount === 0 && prCount !== null && (
        <span className="text-gray-400 text-xs">No linked PRs</span>
      )}
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}
