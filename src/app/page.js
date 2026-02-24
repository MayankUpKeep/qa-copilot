"use client";

import { useState, useEffect, useRef } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";


export default function Home() {
  const [story, setStory] = useState("");
  const [prContext, setPrContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [ticketLabels, setTicketLabels] = useState([]);
  const [includePr, setIncludePr] = useState(false);
  const [useAppMap, setUseAppMap] = useState(true);
  const [appMapStatus, setAppMapStatus] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    fetch("/api/app-map")
      .then((r) => r.json())
      .then((data) => setAppMapStatus(data))
      .catch(() => setAppMapStatus({ ok: false, hasMap: false }));
  }, []);

  const generateImagePreviews = async (fileList) => {
    const previews = [];
    for (const file of fileList) {
      const reader = new FileReader();
      await new Promise((resolve) => {
        reader.onload = (e) => {
          previews.push({
            data: e.target.result,
            name: file.name,
            type: file.type
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    return previews;
  };

  const generatePlan = async (overrideStory = null) => {
    const finalStory = overrideStory || story;
    if (!finalStory) return;

    setLoading(true);
    setResult("");

    const combinedInput = (includePr && prContext)
      ? finalStory + "\n\n--- PR / Code Changes ---\n\n" + prContext
      : finalStory;

    let imageData = [];
    if (images.length > 0) {
      for (const img of images) {
        if (img.dataUrl) {
          imageData.push({
            name: img.name || "image",
            type: "image",
            data: img.dataUrl
          });
        } else if (img instanceof File) {
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onload = (e) => {
              imageData.push({
                name: img.name,
                type: img.type,
                data: e.target.result
              });
              resolve();
            };
            reader.readAsDataURL(img);
          });
        }
      }
    }

    const res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ story: combinedInput, images: imageData, useAppMap, labels: ticketLabels }),
    });

    const data = await res.json();
    setResult(data.output);
    setLoading(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jira = params.get("jira");

    if (!jira) return;

    const decoded = decodeURIComponent(jira);

    setStory(decoded);
    localStorage.setItem("qa_story", decoded);

    setTimeout(() => {
      generatePlan(decoded);
    }, 300);
  }, []);


  const copyToClipboard = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearWorkspace = () => {
    setStory("");
    setPrContext("");
    setResult("");
    setImages([]);
    setImagePreviews([]);
    localStorage.removeItem("qa_story");
    localStorage.removeItem("qa_result");
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  useEffect(() => {
    const savedStory = localStorage.getItem("qa_story");
    const savedResult = localStorage.getItem("qa_result");

    if (savedStory) setStory(savedStory);
    if (savedResult) setResult(savedResult);

    fetch("/api/jira-import")
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setStory(data.content);
          localStorage.setItem("qa_story", data.content);
        }
      });

  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Test Plan Generator</h2>
      <JiraFetch
        onFetched={(text, ticket) => { setStory(text); localStorage.setItem("qa_story", text); if (ticket?.labels) setTicketLabels(ticket.labels); }}
        onPrFetched={(text) => { setPrContext(text); if (text) setIncludePr(true); }}
        onImagesFetched={(imgs) => {
          setImages(imgs);
          setImagePreviews(imgs.map((img) => ({ data: img.dataUrl, name: img.name, type: img.mimeType })));
        }}
        colorClass="blue"
      />

      <div className={`grid gap-4 mb-4 ${includePr ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ticket / Story</label>
          <textarea
            className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste the full Jira story or bug description here..."
            value={story}
            onChange={(e) => {
              setStory(e.target.value);
              localStorage.setItem("qa_story", e.target.value);
            }}
            onPaste={async (e) => {
              if (!e.clipboardData) return;
              const items = e.clipboardData.items;
              const pastedFiles = [];
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.kind === "file" && item.type.startsWith("image/")) {
                  const file = item.getAsFile();
                  if (file) pastedFiles.push(file);
                }
              }
              if (pastedFiles.length > 0) {
                const newFiles = [...images, ...pastedFiles].slice(0, 6);
                setImages(newFiles);
                const previews = await generateImagePreviews(newFiles);
                setImagePreviews(previews);
                e.preventDefault();
              }
            }}
          />
        </div>
        {includePr && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PR / Code Changes</label>
            <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
            <textarea
              className="w-full min-h-[210px] p-4 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
              value={prContext}
              onChange={(e) => setPrContext(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block font-medium mb-1">Attach up to 6 images (screenshots, etc):</label>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={async (e) => {
            const files = Array.from(e.target.files).slice(0, 6);
            setImages(files);
            const previews = await generateImagePreviews(files);
            setImagePreviews(previews);
          }}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {imagePreviews && imagePreviews.length > 0 && imagePreviews.map((preview, idx) => (
            <div key={idx} className="relative border rounded p-2 bg-gray-50">
              <img src={preview.data} alt={preview.name} className="h-24 w-24 object-cover rounded" title={preview.name} />
              <button
                className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                onClick={() => {
                  setImages(images.filter((_, i) => i !== idx));
                  setImagePreviews(imagePreviews.filter((_, i) => i !== idx));
                }}
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1">You can also paste images directly into the description box.</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includePr}
            onChange={(e) => setIncludePr(e.target.checked)}
            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-sm text-gray-700">Include PR / code changes</span>
        </label>
        <span className="text-gray-300">|</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useAppMap}
            onChange={(e) => setUseAppMap(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Include regression areas (web-app + core-service)</span>
        </label>
        {appMapStatus?.hasMap && (
          <span className="text-xs text-gray-500">
            {appMapStatus.routes?.length || 0} routes, {(appMapStatus.coreEndpoints?.length || 0) + (appMapStatus.webEndpoints?.length || 0)} endpoints mapped
          </span>
        )}
        {appMapStatus && !appMapStatus.hasMap && appMapStatus.ok && (
          <span className="text-xs text-amber-600">Set WEB_APP_PATH and CORE_SERVICE_PATH in .env.local to enable.</span>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => generatePlan()}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {loading ? "Generating..." : "Generate Test Plan"}
        </button>
        <button
          onClick={clearWorkspace}
          className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Clear Workspace
        </button>
        <InfoTooltip description="Creates comprehensive test plans from Jira stories or requirements. With regression areas enabled, impact analysis is grounded in your web-app routes and core-service endpoints." />
      </div>

      {result && (
         <div className="mt-8">
          <div className="flex justify-end mb-2">
            <button
              onClick={copyToClipboard}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              {copied ? "Copied!" : "Copy Test Plan"}
            </button>
          </div>

          <div className="p-6 bg-white rounded-lg border border-gray-300">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}
    </div>
  );
}
