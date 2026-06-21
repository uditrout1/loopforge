"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProject } from "@/lib/api";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [repoPath, setRepoPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !repoPath.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const project = await createProject(name.trim(), repoPath.trim());
      router.push(`/projects/${project.id}`);
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
        maxWidth: "560px",
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
        DevOS will index the codebase and load context for your sessions.
      </p>

      {error && (
        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: "8px",
            padding: "14px 16px",
            color: "#f87171",
            fontSize: "13px",
            marginBottom: "24px",
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#888", fontWeight: 500 }}>
              Project name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-service"
              required
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#e8e8e8",
                fontSize: "14px",
                outline: "none",
                width: "100%",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#888", fontWeight: 500 }}>
              Repo path
            </span>
            <input
              type="text"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="/Users/you/Projects/my-service"
              required
              style={{
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#e8e8e8",
                fontSize: "14px",
                fontFamily: "monospace",
                outline: "none",
                width: "100%",
              }}
            />
            <span style={{ fontSize: "11px", color: "#444" }}>
              Absolute path to the local repository
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !name.trim() || !repoPath.trim()}
            style={{
              background: loading ? "#2a2a2a" : "#f0f0f0",
              color: loading ? "#555" : "#0a0a0a",
              border: "none",
              borderRadius: "8px",
              padding: "11px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "8px",
            }}
          >
            {loading ? "Connecting…" : "Connect repo"}
          </button>
        </div>
      </form>
    </div>
  );
}
