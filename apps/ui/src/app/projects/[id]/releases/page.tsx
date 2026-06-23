"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getReleases,
  generateRelease,
  publishRelease,
  updateRelease,
  type ReleaseData,
} from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const input = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "7px",
  padding: "9px 12px",
  color: "#e8e8e8",
  fontSize: "13px",
  outline: "none",
  width: "100%",
};

const textarea = {
  ...input,
  fontFamily: "monospace",
  resize: "vertical" as const,
  minHeight: "120px",
};

export default function ReleasesPage({ params }: PageProps) {
  const [projectId, setProjectId] = useState("");
  const [releases, setReleases] = useState<ReleaseData[]>([]);
  const [selected, setSelected] = useState<ReleaseData | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editChangelog, setEditChangelog] = useState("");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({
    version: "",
    name: "",
    prNumbers: "",
    ticketIds: "",
    context: "",
  });

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    void load();
  }, [projectId]);

  async function load() {
    const list = await getReleases(projectId);
    setReleases(list);
    if (list.length > 0 && !selected) setSelected(list[0] ?? null);
  }

  async function handleGenerate() {
    if (!newForm.version || !newForm.name) return;
    setGenerating(true);
    try {
      const prNumbers = newForm.prNumbers.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const ticketIds = newForm.ticketIds.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const release = await generateRelease(projectId, {
        version: newForm.version,
        name: newForm.name,
        prNumbers,
        ticketIds,
        context: newForm.context,
      });
      setReleases((prev) => [release, ...prev]);
      setSelected(release);
      setShowNew(false);
      setNewForm({ version: "", name: "", prNumbers: "", ticketIds: "", context: "" });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!selected) return;
    setPublishing(true);
    try {
      const updated = await publishRelease(projectId, selected.id);
      setSelected(updated);
      setReleases((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveEdit() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updateRelease(projectId, selected.id, { changelog: editChangelog });
      setSelected(updated);
      setReleases((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function renderChangelog(text: string) {
    return text.split("\n").map((line, i) => {
      if (/^## /.test(line)) {
        return (
          <p key={i} style={{ fontSize: "13px", fontWeight: 700, color: "#f0f0f0", marginTop: "16px", marginBottom: "6px" }}>
            {line.replace(/^## /, "")}
          </p>
        );
      }
      if (/^- /.test(line)) {
        return (
          <p key={i} style={{ fontSize: "13px", color: "#ccc", paddingLeft: "12px", marginBottom: "3px" }}>
            · {line.replace(/^- /, "")}
          </p>
        );
      }
      return line ? <p key={i} style={{ fontSize: "13px", color: "#888", marginBottom: "3px" }}>{line}</p> : null;
    });
  }

  return (
    <div style={{ minHeight: "100vh", padding: "48px 32px", maxWidth: "1100px", margin: "0 auto" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px", fontSize: "13px", color: "#555" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none" }}>LoopForge</Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} style={{ color: "#555", textDecoration: "none" }}>{projectId.slice(0, 8)}…</Link>
        <span>/</span>
        <span style={{ color: "#e8e8e8" }}>Releases</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#f0f0f0" }}>Releases</h1>
        <button
          onClick={() => setShowNew(!showNew)}
          style={{ background: "#f0f0f0", color: "#0a0a0a", border: "none", borderRadius: "7px", padding: "9px 18px", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}
        >
          {showNew ? "Cancel" : "New release"}
        </button>
      </div>

      {/* New release form */}
      {showNew && (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "24px", marginBottom: "28px" }}>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "#f0f0f0", marginBottom: "20px" }}>Generate release</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Version</span>
              <input type="text" placeholder="v1.0.0" value={newForm.version} onChange={(e) => setNewForm({ ...newForm, version: e.target.value })} style={input} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Release name</span>
              <input type="text" placeholder="Family Controls Update" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} style={input} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Merged PRs (comma or newline separated)</span>
              <textarea placeholder="#42, #43, #44" value={newForm.prNumbers} onChange={(e) => setNewForm({ ...newForm, prNumbers: e.target.value })} style={{ ...textarea, minHeight: "80px" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resolved tickets</span>
              <textarea placeholder="TICKET-101, TICKET-102" value={newForm.ticketIds} onChange={(e) => setNewForm({ ...newForm, ticketIds: e.target.value })} style={{ ...textarea, minHeight: "80px" }} />
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
            <span style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Additional context (optional)</span>
            <textarea placeholder="Notable architectural changes, migration notes, etc." value={newForm.context} onChange={(e) => setNewForm({ ...newForm, context: e.target.value })} style={{ ...textarea, minHeight: "72px" }} />
          </label>
          <button
            onClick={() => void handleGenerate()}
            disabled={generating || !newForm.version || !newForm.name}
            style={{ background: generating ? "#2a2a2a" : "#6366f1", color: generating ? "#555" : "#fff", border: "none", borderRadius: "7px", padding: "10px 20px", fontSize: "13px", fontWeight: 500, cursor: generating ? "not-allowed" : "pointer" }}
          >
            {generating ? "Generating with Claude…" : "Generate changelog with AI →"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>
        {/* Release list */}
        <div>
          {releases.length === 0 && (
            <p style={{ fontSize: "13px", color: "#444" }}>No releases yet. Create your first.</p>
          )}
          {releases.map((r) => (
            <div
              key={r.id}
              onClick={() => { setSelected(r); setEditing(false); }}
              style={{
                background: selected?.id === r.id ? "#1f1f1f" : "#141414",
                border: "1px solid " + (selected?.id === r.id ? "#3a3a3a" : "#1f1f1f"),
                borderRadius: "8px",
                padding: "14px 16px",
                marginBottom: "8px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", fontFamily: "monospace" }}>{r.version}</span>
                <span style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 7px",
                  borderRadius: "4px",
                  background: r.status === "published" ? "#14532d" : "#1c1917",
                  color: r.status === "published" ? "#86efac" : "#a8a29e",
                  textTransform: "uppercase",
                }}>
                  {r.status}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#888" }}>{r.name}</p>
              <p style={{ fontSize: "11px", color: "#444", marginTop: "4px" }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* Release detail */}
        {selected && (
          <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "#f0f0f0", fontFamily: "monospace" }}>{selected.version}</span>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: selected.status === "published" ? "#14532d" : "#1c1917",
                    color: selected.status === "published" ? "#86efac" : "#a8a29e",
                    textTransform: "uppercase",
                  }}>
                    {selected.status}
                  </span>
                </div>
                <p style={{ fontSize: "14px", color: "#aaa" }}>{selected.name}</p>
                {selected.publishedAt && (
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "4px" }}>
                    Published {new Date(selected.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => { setEditing(!editing); setEditChangelog(selected.changelog); }}
                  style={{ background: "#1a1a1a", color: "#e8e8e8", border: "1px solid #2a2a2a", borderRadius: "7px", padding: "7px 14px", fontSize: "12px", cursor: "pointer" }}
                >
                  {editing ? "Cancel edit" : "Edit"}
                </button>
                {selected.status === "draft" && (
                  <button
                    onClick={() => void handlePublish()}
                    disabled={publishing}
                    style={{ background: publishing ? "#2a2a2a" : "#22c55e", color: publishing ? "#555" : "#fff", border: "none", borderRadius: "7px", padding: "7px 14px", fontSize: "12px", fontWeight: 500, cursor: publishing ? "not-allowed" : "pointer" }}
                  >
                    {publishing ? "Publishing…" : "Publish →"}
                  </button>
                )}
              </div>
            </div>

            {/* Tags */}
            {(selected.mergedPrIds.length > 0 || selected.resolvedTicketIds.length > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
                {selected.mergedPrIds.map((pr) => (
                  <span key={pr} style={{ fontSize: "11px", background: "#1e1b4b", color: "#a5b4fc", padding: "3px 8px", borderRadius: "4px" }}>PR {pr}</span>
                ))}
                {selected.resolvedTicketIds.map((t) => (
                  <span key={t} style={{ fontSize: "11px", background: "#1c2513", color: "#86efac", padding: "3px 8px", borderRadius: "4px" }}>{t}</span>
                ))}
              </div>
            )}

            {/* Changelog */}
            {editing ? (
              <div>
                <textarea
                  value={editChangelog}
                  onChange={(e) => setEditChangelog(e.target.value)}
                  style={{ ...textarea, minHeight: "320px", marginBottom: "12px" }}
                />
                <button
                  onClick={() => void handleSaveEdit()}
                  disabled={saving}
                  style={{ background: saving ? "#2a2a2a" : "#f0f0f0", color: saving ? "#555" : "#0a0a0a", border: "none", borderRadius: "7px", padding: "9px 18px", fontSize: "13px", fontWeight: 500, cursor: saving ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Saving…" : "Save changelog"}
                </button>
              </div>
            ) : (
              <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: "20px" }}>
                {renderChangelog(selected.changelog)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
