"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProject, getGraphSummary, reindexProject, type Project, type GraphSummary } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const NAV_LINKS = [
  { href: "/graph",    label: "Knowledge graph" },
  { href: "/vision",   label: "Visual analysis" },
  { href: "/evals",    label: "Evals"           },
  { href: "/goals",    label: "Goals"            },
  { href: "/releases", label: "Releases"         },
];

export default function ProjectPage({ params }: PageProps) {
  const [id, setId]               = useState<string>("");
  const [project, setProject]     = useState<Project | null>(null);
  const [graphSummary, setGraphSummary] = useState<GraphSummary | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexDone, setReindexDone] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((p) => setProject(p))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load project"));
    getGraphSummary(id)
      .then((s) => setGraphSummary(s))
      .catch(() => {}); // graph may not exist yet
  }, [id]);

  async function handleReindex() {
    setReindexing(true);
    setReindexDone(false);
    try {
      await reindexProject(id);
      setReindexDone(true);
      // Refresh graph summary after short delay
      setTimeout(() => {
        getGraphSummary(id).then((s) => setGraphSummary(s)).catch(() => {});
        setReindexDone(false);
      }, 4000);
    } finally {
      setReindexing(false);
    }
  }

  const stack = project?.stack;
  const knowledge = project?.knowledge;
  const allTech = [...(stack?.languages ?? []), ...(stack?.frameworks ?? []), ...(stack?.databases ?? [])];

  return (
    <div style={{ minHeight: "100vh", padding: "48px 32px", maxWidth: "960px", margin: "0 auto" }}>
      {/* Breadcrumb */}
      <nav style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px", fontSize: "13px", color: "#555" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none" }}>LoopForge</Link>
        <span>/</span>
        <span style={{ color: "#e8e8e8" }}>{project?.name ?? id}</span>
      </nav>

      {error && (
        <div style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: "8px", padding: "16px", color: "#f87171", fontSize: "13px", marginBottom: "24px" }}>
          {error}
        </div>
      )}

      {project && (
        <>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.02em", marginBottom: "6px" }}>
                {project.name}
              </h1>
              <p style={{ fontSize: "12px", color: "#444", fontFamily: "monospace" }}>{project.repoPath}</p>
              {project.indexedAt && (
                <p style={{ fontSize: "11px", color: "#333", marginTop: "4px" }}>
                  Last indexed {new Date(project.indexedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={() => void handleReindex()}
                disabled={reindexing}
                style={{ background: "#1a1a1a", color: reindexDone ? "#22c55e" : "#888", padding: "8px 16px", borderRadius: "7px", fontSize: "12px", fontWeight: 500, border: "1px solid #2a2a2a", cursor: "pointer", opacity: reindexing ? 0.6 : 1 }}
              >
                {reindexing ? "Reindexing…" : reindexDone ? "Done ✓" : "↺ Reindex"}
              </button>
              <Link
                href={`/projects/${id}/session`}
                style={{ background: "#f0f0f0", color: "#0a0a0a", padding: "8px 18px", borderRadius: "7px", fontSize: "13px", fontWeight: 500, textDecoration: "none" }}
              >
                New session →
              </Link>
            </div>
          </div>

          {/* Nav grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "32px" }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={`/projects/${id}${href}`}
                style={{ background: "#1a1a1a", color: "#e8e8e8", padding: "14px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, textDecoration: "none", border: "1px solid #2a2a2a", display: "block" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Knowledge summary */}
          {knowledge?.summary && knowledge.summary !== "Indexing in progress…" && (
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
              <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Project summary</p>
              <p style={{ fontSize: "13px", color: "#ccc", lineHeight: 1.7 }}>{knowledge.summary}</p>
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            {/* Tech stack */}
            {allTech.length > 0 && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "18px" }}>
                <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Stack</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {allTech.map((t) => (
                    <span key={t} style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "4px", background: "#111", color: "#888", border: "1px solid #2a2a2a" }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge graph */}
            {graphSummary && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "18px" }}>
                <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Knowledge graph</p>
                <p style={{ fontSize: "22px", fontWeight: 700, color: "#6366f1", marginBottom: "4px" }}>{graphSummary.nodeCount}</p>
                <p style={{ fontSize: "12px", color: "#555" }}>{graphSummary.edgeCount} edges</p>
                {Object.entries(graphSummary.byType).slice(0, 4).map(([type, count]) => (
                  <div key={type} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "4px" }}>
                    <span style={{ color: "#444" }}>{type}</span>
                    <span style={{ color: "#666" }}>{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Entry points */}
            {(knowledge?.entryPoints ?? []).length > 0 && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "18px" }}>
                <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Entry points</p>
                {(knowledge?.entryPoints ?? []).slice(0, 5).map((ep) => (
                  <p key={ep} style={{ fontSize: "11px", color: "#777", fontFamily: "monospace", marginBottom: "4px" }}>{ep}</p>
                ))}
              </div>
            )}

            {/* Open TODOs */}
            {(knowledge?.openTodos ?? []).length > 0 && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "18px" }}>
                <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Open TODOs</p>
                {(knowledge?.openTodos ?? []).slice(0, 5).map((todo, i) => (
                  <p key={i} style={{ fontSize: "11px", color: "#777", marginBottom: "4px", lineHeight: 1.4 }}>· {todo}</p>
                ))}
              </div>
            )}
          </div>

          {/* Recent decisions */}
          {(knowledge?.recentDecisions ?? []).length > 0 && (
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "18px" }}>
              <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Recent decisions</p>
              {(knowledge?.recentDecisions ?? []).slice(0, 3).map((d, i) => (
                <p key={i} style={{ fontSize: "12px", color: "#777", marginBottom: "6px", lineHeight: 1.5 }}>· {d}</p>
              ))}
            </div>
          )}

          {/* Skeleton if still indexing */}
          {!project.indexedAt && (
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px", textAlign: "center" }}>
              <p style={{ color: "#444", fontSize: "13px" }}>Indexing repo… refresh in a moment</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
