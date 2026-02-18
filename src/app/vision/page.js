"use client";

import { useState, useEffect, useRef } from "react";
import InfoTooltip from "@/components/InfoTooltip";

export default function VisionPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const [copied, setCopied] = useState(false);



  const pasteRef = useRef(null);

  <textarea
  value={context}
  onChange={(e) => setContext(e.target.value)}
  placeholder="Optional context (e.g. Module: Locations, cannot select site, dropdown empty)"
  className="w-full min-h-[90px] p-3 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm"
/>


  // Handle normal upload
  const handleUpload = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  // Handle clipboard paste (CTRL+V screenshot)
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
      <h2 className="text-2xl font-semibold mb-6">Screenshot Bug Reporter</h2>

      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="Optional context (e.g. Module: Locations, cannot select site, dropdown empty)"
        className="w-full min-h-[90px] p-3 border border-gray-300 rounded-lg mb-4 bg-white text-gray-900 text-sm"
        />


      {/* Upload */}
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="mb-4"
      />

      <p className="text-sm text-gray-500 mb-4">
        Tip: You can also take a screenshot and press <b>Ctrl + V</b> anywhere on this page.
      </p>

      {/* Preview */}
      {preview && (
        <div className="mb-4">
          <img
            src={preview}
            alt="preview"
            className="max-h-[350px] border rounded-lg"
          />
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={analyzeImage}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          {loading ? "Analyzing..." : "Analyze Screenshot"}
        </button>
        <button
          onClick={() => {
            setFile(null);
            setPreview(null);
            setResult("");
            setContext("");
          }}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear
        </button>
        <InfoTooltip description="Analyzes screenshots to detect UI bugs and generate detailed bug reports with visual issues. Supports paste (Ctrl+V) or file upload." />
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
