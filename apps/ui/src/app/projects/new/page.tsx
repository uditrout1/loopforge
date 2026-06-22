"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const GATEWAY = "http://localhost:18790";

const CATEGORIES = [
  "Consumer App",
  "SaaS",
  "Mobile App",
  "API / Backend",
  "Browser Extension",
  "Other",
];

type Mode = "choose" | "repo" | "vibe";

function NewProjectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "vibe" ? "vibe" : "choose";

  const [mode, setMode] = useState<Mode>(initialMode);

  // Repo form
  const [repoName, setRepoName] = useState("");
  const [repoPath, setRepoPath] = useState("");

  // Vibe form
  const [vibeName, setVibeName] = useState("");
  const [vibeDesc, setVibeDesc] = useState("");
  const [vibeCategory, setVibeCategory] = useState("");
  const [vibeAudience, setVibeAudience] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRepoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoName.trim() || !repoPath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${GATEWAY}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: repoName.trim(), repoPath: repoPath.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create project");
      }
      const project = (await res.json()) as { id: string };
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setLoading(false);
    }
  }

  async function handleVibeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vibeName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const slug = vibeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const scratchPath = `/Users/uditrout/Projects/loopforge-${slug}-${Date.now()}`;
      const res = await fetch(`${GATEWAY}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: vibeName.trim(), repoPath: scratchPath }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to create project");
      }
      const project = (await res.json()) as { id: string };
      const params = new URLSearchParams({
        name: vibeName.trim(),
        ...(vibeDesc.trim() ? { description: vibeDesc.trim() } : {}),
        ...(vibeCategory ? { category: vibeCategory } : {}),
        ...(vibeAudience.trim() ? { audience: vibeAudience.trim() } : {}),
      });
      router.push(`/projects/${project.id}/initiate?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "48px 32px",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: "12px",
          color: "#555",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "40px",
        }}
      >
        ← Back
      </Link>

      {mode === "choose" && (
        <>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#f0f0f0",
              marginBottom: "8px",
              letterSpacing: "-0.02em",
            }}
          >
            New project
          </h1>
          <p style={{ color: "#555", fontSize: "13px", marginBottom: "36px" }}>
            How do you want to start?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <button
              onClick={() => setMode("repo")}
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "12px",
                padding: "28px 24px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#3a3a3a"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; }}
            >
              <div style={{ fontSize: "28px", marginBottom: "14px" }}>📁</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#f0f0f0", marginBottom: "8px" }}>
                Connect existing repo
              </div>
              <div style={{ fontSize: "13px", color: "#555", lineHeight: 1.5 }}>
                Index your codebase and load context for AI sessions
              </div>
            </button>

            <button
              onClick={() => setMode("vibe")}
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "12px",
                padding: "28px 24px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "14px",
                  right: "14px",
                  background: "#1e1b4b",
                  color: "#a5b4fc",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                }}
              >
                Vibe Coder
              </div>
              <div style={{ fontSize: "28px", marginBottom: "14px" }}>✦</div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#f0f0f0", marginBottom: "8px" }}>
                Start from scratch
              </div>
              <div style={{ fontSize: "13px", color: "#555", lineHeight: 1.5 }}>
                No code yet? Start with your idea. LoopForge scaffolds your project with BRD, FRD, and PRD.
              </div>
            </button>
          </div>
        </>
      )}

      {mode === "repo" && (
        <>
          <button
            onClick={() => setMode("choose")}
            style={{ background: "none", border: "none", color: "#555", fontSize: "12px", cursor: "pointer", marginBottom: "24px", padding: 0 }}
          >
            ← Choose differently
          </button>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#f0f0f0",
              marginBottom: "8px",
              letterSpacing: "-0.02em",
            }}
          >
            Connect a repo
          </h1>
          <p style={{ color: "#555", fontSize: "13px", marginBottom: "36px" }}>
            LoopForge will index the codebase and load context for your sessions.
          </p>

          {error && (
            <div style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: "8px", padding: "14px 16px", color: "#f87171", fontSize: "13px", marginBottom: "24px" }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleRepoSubmit(e)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Project name
                </span>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-service"
                  required
                  style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "10px 14px", color: "#e8e8e8", fontSize: "14px", outline: "none", width: "100%" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Repo path
                </span>
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="/Users/you/Projects/my-service"
                  required
                  style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "10px 14px", color: "#e8e8e8", fontSize: "14px", fontFamily: "monospace", outline: "none", width: "100%" }}
                />
                <span style={{ fontSize: "11px", color: "#444" }}>Absolute path to the local repository</span>
              </label>
              <button
                type="submit"
                disabled={loading || !repoName.trim() || !repoPath.trim()}
                style={{ background: loading ? "#2a2a2a" : "#f0f0f0", color: loading ? "#555" : "#0a0a0a", border: "none", borderRadius: "8px", padding: "11px 20px", fontSize: "14px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", marginTop: "8px" }}
              >
                {loading ? "Connecting…" : "Connect repo"}
              </button>
            </div>
          </form>
        </>
      )}

      {mode === "vibe" && (
        <>
          <button
            onClick={() => setMode("choose")}
            style={{ background: "none", border: "none", color: "#555", fontSize: "12px", cursor: "pointer", marginBottom: "24px", padding: 0 }}
          >
            ← Choose differently
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.02em" }}>
              Start from scratch
            </h1>
            <span style={{ background: "#1e1b4b", color: "#a5b4fc", fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
              Vibe Coder
            </span>
          </div>
          <p style={{ color: "#555", fontSize: "13px", marginBottom: "36px" }}>
            Describe your idea. LoopForge will walk you through BRD, FRD, and PRD with AI assistance.
          </p>

          {error && (
            <div style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: "8px", padding: "14px 16px", color: "#f87171", fontSize: "13px", marginBottom: "24px" }}>
              {error}
            </div>
          )}

          <form onSubmit={(e) => void handleVibeSubmit(e)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Project name
                </span>
                <input
                  type="text"
                  value={vibeName}
                  onChange={(e) => setVibeName(e.target.value)}
                  placeholder="Ichi"
                  required
                  style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "10px 14px", color: "#e8e8e8", fontSize: "14px", outline: "none", width: "100%" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  What are you building?
                </span>
                <input
                  type="text"
                  value={vibeDesc}
                  onChange={(e) => setVibeDesc(e.target.value)}
                  placeholder="A focus app for students preparing for competitive exams"
                  style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "10px 14px", color: "#e8e8e8", fontSize: "14px", outline: "none", width: "100%" }}
                />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Category
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setVibeCategory(cat === vibeCategory ? "" : cat)}
                      style={{
                        background: vibeCategory === cat ? "#1e1b4b" : "#141414",
                        color: vibeCategory === cat ? "#a5b4fc" : "#888",
                        border: `1px solid ${vibeCategory === cat ? "#4338ca" : "#2a2a2a"}`,
                        borderRadius: "20px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: vibeCategory === cat ? 600 : 400,
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: "#888", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Target audience <span style={{ color: "#444", textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                </span>
                <input
                  type="text"
                  value={vibeAudience}
                  onChange={(e) => setVibeAudience(e.target.value)}
                  placeholder="Students aged 18-24 in India preparing for JEE/NEET"
                  style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: "8px", padding: "10px 14px", color: "#e8e8e8", fontSize: "14px", outline: "none", width: "100%" }}
                />
              </label>

              <button
                type="submit"
                disabled={loading || !vibeName.trim()}
                style={{ background: loading ? "#2a2a2a" : "#6366f1", color: loading ? "#555" : "#fff", border: "none", borderRadius: "8px", padding: "12px 20px", fontSize: "14px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: "8px" }}
              >
                {loading ? "Creating project…" : "Create project →"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }} />}>
      <NewProjectInner />
    </Suspense>
  );
}
