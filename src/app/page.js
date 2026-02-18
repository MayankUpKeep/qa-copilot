"use client";

import { useState, useEffect, useRef } from "react";
import InfoTooltip from "@/components/InfoTooltip";


export default function Home() {
  const [story, setStory] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const fileInputRef = useRef();

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

  let imageData = [];
  if (images.length > 0) {
    // Handle both File objects (from file input) and image objects with dataUrl (from extension)
    for (const img of images) {
      if (img.dataUrl) {
        // Already a data URL from extension
        imageData.push({
          name: img.name || "image",
          type: "image",
          data: img.dataUrl
        });
      } else if (img instanceof File) {
        // File object - convert to base64
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
    body: JSON.stringify({ story: finalStory, images: imageData }),
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
    setResult("");
    setImages([]);
    setImagePreviews([]);
    localStorage.removeItem("qa_story");
    localStorage.removeItem("qa_result");
    if (fileInputRef.current) fileInputRef.current.value = null;
  };


  // Load saved data on page load
  useEffect(() => {
    const savedStory = localStorage.getItem("qa_story");
    const savedResult = localStorage.getItem("qa_result");

    if (savedStory) setStory(savedStory);
    if (savedResult) setResult(savedResult);

    // check if extension sent Jira ticket
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
        <InfoTooltip description="Creates comprehensive test plans from Jira stories or requirements. Generates detailed test scenarios, edge cases, and coverage analysis." />
      </div>


      <textarea
        className="w-full min-h-[250px] p-4 border border-gray-300 rounded-lg mb-2 bg-white text-gray-900 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            const newFiles = [...images, ...pastedFiles].slice(0, 3);
            setImages(newFiles);
            const previews = await generateImagePreviews(newFiles);
            setImagePreviews(previews);
            e.preventDefault();
          }
        }}
      />

      <div className="mb-4">
        <label className="block font-medium mb-1">Attach up to 3 images (screenshots, etc):</label>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={async (e) => {
            const files = Array.from(e.target.files).slice(0, 3);
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
            <pre className="whitespace-pre-wrap text-gray-900 text-sm leading-7 font-mono">
              {result}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
