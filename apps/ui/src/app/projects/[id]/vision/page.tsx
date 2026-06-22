"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { analyzeScreenshot, analyzeFigmaUrl } from "@/lib/api";
import type { VisualAnalysis } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function VisionPage({ params }: PageProps) {
  const [projectId, setProjectId] = useState<string | null>(null);

  // Resolve params once
  if (projectId === null) {
    params.then(({ id }) => setProjectId(id));
    return null;
  }

  return <VisionPageInner projectId={projectId} />;
}

function VisionPageInner({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<"screenshot" | "figma">("screenshot");
  const [result, setResult] = useState<VisualAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Screenshot tab state
  const [screenshotName, setScreenshotName] = useState("");
  const [screenshotQuestion, setScreenshotQuestion] = useState("What UX and accessibility issues does this design have?");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState("image/png");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Figma tab state
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaQuestion, setFigmaQuestion] = useState("What UX and accessibility issues does this design have?");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotName(file.name);
    setImageMediaType(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl);
      // Strip the data:image/...;base64, prefix
      const base64 = dataUrl.split(",")[1] ?? "";
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  }

  async function handleScreenshotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageBase64) { setError("Please select an image first"); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeScreenshot(
        projectId,
        screenshotName || "screenshot",
        imageBase64,
        imageMediaType,
        screenshotQuestion,
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleFigmaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!figmaUrl) { setError("Please enter a Figma URL"); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeFigmaUrl(projectId, figmaUrl, figmaQuestion);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", padding: "48px 32px", maxWidth: "900px", margin: "0 auto" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px", fontSize: "13px", color: "#555" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none" }}>LoopForge</Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} style={{ color: "#555", textDecoration: "none" }}>Project</Link>
        <span>/</span>
        <span style={{ color: "#e8e8e8" }}>Visual Analysis</span>
      </nav>

      <h1 style={{ fontSize: "22px", fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.02em", marginBottom: "8px" }}>
        Visual Analysis
      </h1>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "32px" }}>
        Upload a screenshot or paste a Figma URL to get UX, accessibility, and code feedback.
      </p>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "2px", background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "3px", marginBottom: "28px", width: "fit-content" }}>
        {(["screenshot", "figma"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setResult(null); setError(null); }}
            style={{
              padding: "7px 20px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
              background: tab === t ? "#f0f0f0" : "transparent",
              color: tab === t ? "#0a0a0a" : "#666",
              transition: "all 0.15s",
            }}
          >
            {t === "screenshot" ? "Screenshot" : "Figma URL"}
          </button>
        ))}
      </div>

      {/* Screenshot tab */}
      {tab === "screenshot" && (
        <form onSubmit={handleScreenshotSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed #2a2a2a",
                borderRadius: "10px",
                padding: "32px",
                textAlign: "center",
                cursor: "pointer",
                background: imagePreview ? "#0f0f0f" : "#111",
                transition: "border-color 0.15s",
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" style={{ maxHeight: "280px", maxWidth: "100%", borderRadius: "6px", objectFit: "contain" }} />
              ) : (
                <>
                  <p style={{ color: "#555", fontSize: "13px", marginBottom: "6px" }}>Click to upload image</p>
                  <p style={{ color: "#333", fontSize: "12px" }}>PNG, JPG, WEBP</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />

            <input
              type="text"
              placeholder="Name (optional)"
              value={screenshotName}
              onChange={(e) => setScreenshotName(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="What do you want to know about this design?"
              value={screenshotQuestion}
              onChange={(e) => setScreenshotQuestion(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <button type="submit" disabled={loading || !imageBase64} style={submitBtnStyle(loading || !imageBase64)}>
              {loading ? "Analyzing..." : "Analyze Screenshot"}
            </button>
          </div>
        </form>
      )}

      {/* Figma tab */}
      {tab === "figma" && (
        <form onSubmit={handleFigmaSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input
              type="url"
              placeholder="https://www.figma.com/design/..."
              value={figmaUrl}
              onChange={(e) => setFigmaUrl(e.target.value)}
              style={inputStyle}
            />
            <textarea
              placeholder="What do you want to know about this design?"
              value={figmaQuestion}
              onChange={(e) => setFigmaQuestion(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <button type="submit" disabled={loading || !figmaUrl} style={submitBtnStyle(loading || !figmaUrl)}>
              {loading ? "Analyzing..." : "Analyze Figma Design"}
            </button>
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: "24px", background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: "8px", padding: "16px", color: "#f87171", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && <AnalysisResults result={result} />}
    </div>
  );
}

function AnalysisResults({ result }: { result: VisualAnalysis }) {
  const { analysis, asset } = result;

  return (
    <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <Card>
        <SectionLabel>Description</SectionLabel>
        <p style={{ fontSize: "14px", color: "#d0d0d0", lineHeight: "1.6" }}>{analysis.description}</p>
      </Card>

      {analysis.uxIssues.length > 0 && (
        <Card>
          <SectionLabel>UX Issues</SectionLabel>
          <IssueList items={analysis.uxIssues} color="#f59e0b" />
        </Card>
      )}

      {analysis.accessibilityIssues.length > 0 && (
        <Card>
          <SectionLabel>Accessibility Issues</SectionLabel>
          <IssueList items={analysis.accessibilityIssues} color="#f87171" />
        </Card>
      )}

      {analysis.copyIssues.length > 0 && (
        <Card>
          <SectionLabel>Copy Issues</SectionLabel>
          <IssueList items={analysis.copyIssues} color="#c084fc" />
        </Card>
      )}

      {analysis.suggestedImprovements.length > 0 && (
        <Card>
          <SectionLabel>Suggested Improvements</SectionLabel>
          <IssueList items={analysis.suggestedImprovements} color="#34d399" />
        </Card>
      )}

      {asset.linkedFilePaths.length > 0 && (
        <Card>
          <SectionLabel>Code Files to Change</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {asset.linkedFilePaths.map((path) => (
              <div key={path} style={{ fontFamily: "monospace", fontSize: "12px", color: "#7dd3fc", background: "#0f1a26", padding: "6px 10px", borderRadius: "5px" }}>
                {path}
              </div>
            ))}
          </div>
        </Card>
      )}

      {analysis.requiredCodeChanges.length > 0 && (
        <Card>
          <SectionLabel>Required Code Changes</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {analysis.requiredCodeChanges.map((change, i) => (
              <label key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" style={{ marginTop: "2px", flexShrink: 0, accentColor: "#34d399" }} />
                <span style={{ fontSize: "13px", color: "#d0d0d0", lineHeight: "1.5" }}>{change}</span>
              </label>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px" }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "11px", color: "#555", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </p>
  );
}

function IssueList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <span style={{ color, flexShrink: 0, marginTop: "2px" }}>•</span>
          <span style={{ fontSize: "13px", color: "#c0c0c0", lineHeight: "1.5" }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#e8e8e8",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

function submitBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? "#1a1a1a" : "#f0f0f0",
    color: disabled ? "#444" : "#0a0a0a",
    border: "none",
    borderRadius: "7px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    alignSelf: "flex-start",
    transition: "all 0.15s",
  };
}
