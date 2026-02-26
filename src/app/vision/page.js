"use client";

import { useState, useEffect } from "react";
import Spinner from "@/components/Spinner";
import InfoTooltip from "@/components/InfoTooltip";
import FormattedOutput from "@/components/FormattedOutput";
import useTicketFromUrl from "@/lib/useTicketFromUrl";

export default function VisionPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const [copied, setCopied] = useState(false);

  useTicketFromUrl({
    onTicket: (text) => setContext(text),
  });

  const handleUpload = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  useEffect(() => {
    const handlePaste = (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let item of items) {
        if (item.type.startsWith("image")) {
          const blob = item.getAsFile();
          setFile(blob);
          setPreview(URL.createObjectURL(blob));
          setResult("");
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  const analyzeImage = async () => {
    if (!file) return;

    setLoading(true);
    setResult("");

    const formData = new FormData();
    formData.append("image", file);
    formData.append("context", context);

    const res = await fetch("/api/vision-bug", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setResult(data.output);
    setLoading(false);
  };

  const copyToClipboard = async () => {
    if (!result) return;

    await navigator.clipboard.writeText(result);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Screenshot Bug Reporter</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Analyze screenshots to detect UI bugs and generate detailed bug reports.</p>

      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Optional context (e.g. Module: Locations, cannot select site, dropdown empty)"
        className="w-full min-h-[90px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
      />

      <div className="mb-4 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50">
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 file:cursor-pointer file:transition-colors"
        />
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Tip: You can also take a screenshot and press <b>Ctrl + V</b> anywhere on this page.</p>
      </div>

      {preview && (
        <div className="mb-4">
          <img
            src={preview}
            alt="preview"
            className="max-h-[350px] border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm"
          />
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={analyzeImage}
          disabled={loading || !file}
          className="inline-flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-lg hover:bg-rose-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {loading ? <><Spinner className="w-4 h-4" /> Analyzing...</> : "Analyze Screenshot"}
        </button>
        <button
          onClick={() => {
            setFile(null);
            setPreview(null);
            setResult("");
            setContext("");
          }}
          className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm"
        >
          Clear
        </button>
        <InfoTooltip description="Analyzes screenshots to detect UI bugs and generate detailed bug reports with visual issues. Supports paste (Ctrl+V) or file upload." />
      </div>

      {result && (
        <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">SCREENSHOT ANALYSIS</span>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy Bug Report"}
            </button>
          </div>
          <div className="p-6">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}
    </div>
  );
}
