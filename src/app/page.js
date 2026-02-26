"use client";

import { useState, useEffect, useRef } from "react";
import InfoTooltip from "@/components/InfoTooltip";
import JiraFetch from "@/components/JiraFetch";
import GitHubPRFetch from "@/components/GitHubPRFetch";
import FormattedOutput from "@/components/FormattedOutput";
import Spinner from "@/components/Spinner";
import { parseTestPlanSections } from "@/lib/parseSections";


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
  const fromExtension = useRef(false);
  const [urlTicketId, setUrlTicketId] = useState(null);
  const [jiraTicketKey, setJiraTicketKey] = useState("");
  const [jiraTicketSummary, setJiraTicketSummary] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createIssueType, setCreateIssueType] = useState("Quality Test Plan");
  const [createSummary, setCreateSummary] = useState("");
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [createError, setCreateError] = useState("");

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
    const tid = params.get("ticketId");
    if (tid) {
      fromExtension.current = true;
      setUrlTicketId(tid.trim().toUpperCase());
      return;
    }

    const jira = params.get("jira");
    if (jira) {
      const decoded = decodeURIComponent(jira);
      setStory(decoded);
      localStorage.setItem("qa_story", decoded);
      setTimeout(() => generatePlan(decoded), 300);
    }
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

  const openCreateModal = () => {
    setCreateSummary(`Test Plan: ${jiraTicketSummary || "Untitled"}`);
    setCreateIssueType("Quality Test Plan");
    setCreateResult(null);
    setCreateError("");
    setShowCreateModal(true);
  };

  const handleCreateTicket = async () => {
    if (!result || !createSummary.trim()) return;

    setCreating(true);
    setCreateError("");
    setCreateResult(null);

    try {
      const sections = parseTestPlanSections(result);
      console.log("[QA Copilot] Parsed sections:", Object.keys(sections));
      const tpSections = Object.keys(sections).filter(k => k.startsWith("TP "));
      console.log("[QA Copilot] TP sections found:", tpSections);
      if (tpSections.length === 0) {
        console.log("[QA Copilot] First 500 chars of result:", result.substring(0, 500));
      }

      const projectKey = jiraTicketKey ? jiraTicketKey.split("-")[0] : "";

      if (!projectKey) {
        setCreateError("Could not determine project key. Fetch a Jira ticket first.");
        setCreating(false);
        return;
      }

      const res = await fetch("/api/jira/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentTicketId: jiraTicketKey,
          projectKey,
          issueType: createIssueType,
          summary: createSummary.trim(),
          sections,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || "Failed to create ticket");
      } else {
        setCreateResult(data);
      }
    } catch {
      setCreateError("Network error — could not reach server");
    } finally {
      setCreating(false);
    }
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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Test Plan Generator</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Generate comprehensive test plans from Jira stories with regression analysis.</p>

      <JiraFetch
        initialTicketId={urlTicketId}
        onFetched={(text, ticket) => {
          setStory(text);
          localStorage.setItem("qa_story", text);
          if (ticket?.labels) setTicketLabels(ticket.labels);
          if (ticket?.key) setJiraTicketKey(ticket.key);
          if (ticket?.summary) setJiraTicketSummary(ticket.summary);
          if (fromExtension.current) {
            fromExtension.current = false;
            setTimeout(() => generatePlan(text), 500);
          }
        }}
        onPrFetched={(text) => { setPrContext(text); if (text) setIncludePr(true); }}
        onImagesFetched={(imgs) => {
          setImages(imgs);
          setImagePreviews(imgs.map((img) => ({ data: img.dataUrl, name: img.name, type: img.mimeType })));
        }}
        colorClass="blue"
      />

      <div className={`grid gap-4 mb-4 ${includePr ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ticket / Story</label>
          <textarea
            className="w-full min-h-[250px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PR / Code Changes</label>
            <GitHubPRFetch onFetched={(text) => setPrContext((prev) => prev ? prev + "\n\n" + text : text)} colorClass="orange" />
            <textarea
              className="w-full min-h-[210px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Auto-populated from Jira linked PRs, or fetch a PR manually above..."
              value={prContext}
              onChange={(e) => setPrContext(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mb-4 p-4 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-800/50">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Attach up to 6 images</label>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          className="text-sm text-gray-600 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-600 file:cursor-pointer file:transition-colors"
          onChange={async (e) => {
            const files = Array.from(e.target.files).slice(0, 6);
            setImages(files);
            const previews = await generateImagePreviews(files);
            setImagePreviews(previews);
          }}
        />
        <div className="flex gap-2 mt-3 flex-wrap">
          {imagePreviews && imagePreviews.length > 0 && imagePreviews.map((preview, idx) => (
            <div key={idx} className="relative group border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 bg-white dark:bg-gray-800 shadow-sm">
              <img src={preview.data} alt={preview.name} className="h-20 w-20 object-cover rounded" title={preview.name} />
              <button
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hover:bg-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setImages(images.filter((_, i) => i !== idx));
                  setImagePreviews(imagePreviews.filter((_, i) => i !== idx));
                }}
                title="Remove image"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">You can also paste images directly into the description box.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includePr}
            onChange={(e) => setIncludePr(e.target.checked)}
            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
          />
          <span className="text-gray-600 dark:text-gray-400">Include PR / code changes</span>
        </label>
        <span className="text-gray-200 dark:text-gray-700">|</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useAppMap}
            onChange={(e) => setUseAppMap(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-gray-600 dark:text-gray-400">Include regression areas</span>
        </label>
        {appMapStatus?.hasMap && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {appMapStatus.routes?.length || 0} routes, {(appMapStatus.coreEndpoints?.length || 0) + (appMapStatus.webEndpoints?.length || 0)} endpoints mapped
          </span>
        )}
        {appMapStatus && !appMapStatus.hasMap && appMapStatus.ok && (
          <span className="text-xs text-amber-600">Set WEB_APP_PATH and CORE_SERVICE_PATH in .env.local to enable.</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => generatePlan()}
          disabled={loading || !story}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
        >
          {loading ? <><Spinner className="w-4 h-4" /> Generating...</> : "Generate Test Plan"}
        </button>
        <button
          onClick={clearWorkspace}
          className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all font-medium text-sm"
        >
          Clear Workspace
        </button>
        <InfoTooltip description="Creates comprehensive test plans from Jira stories or requirements. With regression areas enabled, impact analysis is grounded in your web-app routes and core-service endpoints." />
      </div>

      {result && (
        <div className="mt-8 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Test Plan</span>
            <div className="flex items-center gap-2">
              <button
                onClick={openCreateModal}
                disabled={!jiraTicketKey}
                className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
                title={jiraTicketKey ? `Create ticket in ${jiraTicketKey.split("-")[0]}` : "Fetch a Jira ticket first"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create Jira Test Plan
              </button>
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy Test Plan"}
              </button>
            </div>
          </div>
          <div className="p-6">
            <FormattedOutput text={result} />
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !creating && setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Create Jira Test Plan</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              Parent: <span className="font-medium text-indigo-600 dark:text-indigo-400">{jiraTicketKey}</span>
            </p>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ticket Type</label>
            <div className="flex flex-col gap-2 mb-4">
              {[
                { value: "Quality Test Plan", label: "Quality Test Plan (linked to parent)" },
                { value: "Sub-task", label: "Sub-task (child of parent)" },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="issueType"
                    value={opt.value}
                    checked={createIssueType === opt.value}
                    onChange={() => setCreateIssueType(opt.value)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
            <input
              type="text"
              value={createSummary}
              onChange={(e) => setCreateSummary(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
              placeholder="Test Plan: ..."
            />

            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
                {createError}
              </div>
            )}

            {createResult && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm space-y-1">
                <div>Ticket created: <a href={createResult.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-green-800 dark:hover:text-green-200">{createResult.key}</a></div>
                {createResult.linkStatus && <div className="text-xs opacity-75">{createResult.linkStatus}</div>}
                <div className="text-xs opacity-75">{createResult.fieldsMatched} TP fields populated{createResult.fieldsUnmatched?.length > 0 ? ` · ${createResult.fieldsUnmatched.length} sections in description` : ""}</div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {createResult ? "Close" : "Cancel"}
              </button>
              {!createResult && (
                <button
                  onClick={handleCreateTicket}
                  disabled={creating || !createSummary.trim()}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {creating ? <><Spinner className="w-4 h-4" /> Creating...</> : "Create Test Plan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
