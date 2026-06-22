"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getEvalCriteria,
  getEvalRuns,
  getEvalsSummary,
  createEvalCriteria,
  runEval,
  submitEvalFeedback,
  type EvalCriteriaData,
  type EvalRunData,
  type EvalsSummary,
} from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EvalsPage({ params }: PageProps) {
  const [projectId, setProjectId] = useState<string>("");
  const [criteria, setCriteria] = useState<EvalCriteriaData[]>([]);
  const [selected, setSelected] = useState<EvalCriteriaData | null>(null);
  const [runs, setRuns] = useState<EvalRunData[]>([]);
  const [summary, setSummary] = useState<EvalsSummary | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [runContent, setRunContent] = useState("");
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    description: "",
    type: "product_criteria",
    prompt: "",
    threshold: "0.7",
  });
  const [feedbackRunId, setFeedbackRunId] = useState<string | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ verdict: "approved", rationale: "", submittedBy: "developer" });

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    void reload();
  }, [projectId]);

  async function reload() {
    const [c, s] = await Promise.all([
      getEvalCriteria(projectId),
      getEvalsSummary(projectId),
    ]);
    setCriteria(c);
    setSummary(s);
  }

  async function selectCriteria(c: EvalCriteriaData) {
    setSelected(c);
    setRunContent("");
    const r = await getEvalRuns(projectId, c.id);
    setRuns(r);
  }

  async function handleRunEval() {
    if (!selected || !runContent.trim()) return;
    setRunning(true);
    try {
      await runEval(projectId, {
        criteriaId: selected.id,
        targetType: "content",
        targetId: `manual-${Date.now()}`,
        content: runContent,
      });
      const r = await getEvalRuns(projectId, selected.id);
      setRuns(r);
      await reload();
    } finally {
      setRunning(false);
      setRunContent("");
    }
  }

  async function handleCreate() {
    if (!newForm.name || !newForm.prompt) return;
    setCreating(true);
    try {
      await createEvalCriteria(projectId, {
        ...newForm,
        threshold: parseFloat(newForm.threshold) || 0.7,
      });
      await reload();
      setShowCreate(false);
      setNewForm({ name: "", description: "", type: "product_criteria", prompt: "", threshold: "0.7" });
    } finally {
      setCreating(false);
    }
  }

  async function handleFeedback(runId: string) {
    await submitEvalFeedback(projectId, runId, feedbackForm);
    setFeedbackRunId(null);
    if (selected) {
      const r = await getEvalRuns(projectId, selected.id);
      setRuns(r);
    }
  }

  const scoreColor = (score: number) => {
    if (score >= 0.8) return "#22c55e";
    if (score >= 0.5) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div style={{ minHeight: "100vh", padding: "48px 32px", maxWidth: "1200px", margin: "0 auto" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px", fontSize: "13px", color: "#555" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none" }}>LoopForge</Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} style={{ color: "#555", textDecoration: "none" }}>{projectId.slice(0, 8)}…</Link>
        <span>/</span>
        <span style={{ color: "#e8e8e8" }}>Evals</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#f0f0f0", marginBottom: "4px" }}>Eval Engine</h1>
          {summary && (
            <p style={{ fontSize: "12px", color: "#555" }}>
              {summary.totalCriteria} criteria · {summary.totalRuns} runs
              {summary.passRate !== null && ` · ${Math.round(summary.passRate * 100)}% pass rate`}
              {summary.regressions > 0 && <span style={{ color: "#ef4444" }}> · {summary.regressions} regression{summary.regressions > 1 ? "s" : ""}</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ background: "#f0f0f0", color: "#0a0a0a", padding: "8px 16px", borderRadius: "7px", fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer" }}
        >
          + New Criteria
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#f0f0f0", marginBottom: "16px" }}>New Eval Criteria</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <input
              placeholder="Name"
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px" }}
            />
            <select
              value={newForm.type}
              onChange={(e) => setNewForm((f) => ({ ...f, type: e.target.value }))}
              style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px" }}
            >
              <option value="product_criteria">Product Criteria</option>
              <option value="engineering_standard">Engineering Standard</option>
              <option value="design_standard">Design Standard</option>
              <option value="architecture_compliance">Architecture Compliance</option>
            </select>
          </div>
          <input
            placeholder="Description"
            value={newForm.description}
            onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
            style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px", marginBottom: "12px", boxSizing: "border-box" }}
          />
          <textarea
            placeholder="Evaluation prompt — describe what to check and how to score (0-1)"
            value={newForm.prompt}
            onChange={(e) => setNewForm((f) => ({ ...f, prompt: e.target.value }))}
            rows={3}
            style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px", resize: "vertical", marginBottom: "12px", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ fontSize: "12px", color: "#888" }}>Pass threshold:</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={newForm.threshold}
              onChange={(e) => setNewForm((f) => ({ ...f, threshold: e.target.value }))}
              style={{ width: "80px", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 10px", color: "#e8e8e8", fontSize: "13px" }}
            />
            <button
              onClick={() => void handleCreate()}
              disabled={creating}
              style={{ marginLeft: "auto", background: "#6366f1", color: "#fff", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer", opacity: creating ? 0.6 : 1 }}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px" }}>
        {/* Criteria list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {criteria.length === 0 && (
            <p style={{ fontSize: "13px", color: "#444", padding: "16px 0" }}>No eval criteria yet. Create one above.</p>
          )}
          {criteria.map((c) => (
            <button
              key={c.id}
              onClick={() => void selectCriteria(c)}
              style={{
                background: selected?.id === c.id ? "#1e1e2e" : "#1a1a1a",
                border: `1px solid ${selected?.id === c.id ? "#6366f1" : "#2a2a2a"}`,
                borderRadius: "8px",
                padding: "14px 16px",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#f0f0f0", marginBottom: "4px" }}>{c.name}</p>
              <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.type.replace(/_/g, " ")}</p>
              <p style={{ fontSize: "11px", color: "#444", marginTop: "4px" }}>threshold {c.threshold}</p>
            </button>
          ))}
        </div>

        {/* Detail panel */}
        <div>
          {!selected && (
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "32px", textAlign: "center" }}>
              <p style={{ color: "#444", fontSize: "13px" }}>Select a criteria to run evals and view results</p>
            </div>
          )}

          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px" }}>
                <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#f0f0f0", marginBottom: "6px" }}>{selected.name}</h2>
                <p style={{ fontSize: "12px", color: "#888", marginBottom: "12px" }}>{selected.description}</p>
                <p style={{ fontSize: "11px", color: "#555", fontFamily: "monospace", lineHeight: 1.6 }}>{selected.prompt}</p>
              </div>

              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", marginBottom: "12px" }}>Run Eval</h3>
                <textarea
                  placeholder="Paste the content to evaluate…"
                  value={runContent}
                  onChange={(e) => setRunContent(e.target.value)}
                  rows={5}
                  style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 12px", color: "#e8e8e8", fontSize: "13px", resize: "vertical", marginBottom: "12px", boxSizing: "border-box" }}
                />
                <button
                  onClick={() => void handleRunEval()}
                  disabled={running || !runContent.trim()}
                  style={{ background: "#6366f1", color: "#fff", padding: "8px 18px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer", opacity: running || !runContent.trim() ? 0.5 : 1 }}
                >
                  {running ? "Running…" : "Run Eval"}
                </button>
              </div>

              {runs.length > 0 && (
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", marginBottom: "12px" }}>Results</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {runs.map((run) => (
                      <div key={run.id} style={{ background: "#111", border: "1px solid #222", borderRadius: "8px", padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "18px", fontWeight: 700, color: scoreColor(run.score) }}>{Math.round(run.score * 100)}%</span>
                          <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "4px", background: run.passed ? "#0a2a0a" : "#2a0a0a", color: run.passed ? "#22c55e" : "#ef4444", fontWeight: 500 }}>
                            {run.passed ? "PASSED" : run.status === "error" ? "ERROR" : "FAILED"}
                          </span>
                          {run.regressionDetected && (
                            <span style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "4px", background: "#2a1a0a", color: "#f59e0b", fontWeight: 500 }}>⚠ REGRESSION</span>
                          )}
                          <span style={{ marginLeft: "auto", fontSize: "11px", color: "#444" }}>
                            {new Date(run.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {run.reasoning && (
                          <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, marginBottom: "10px" }}>{run.reasoning.slice(0, 300)}{run.reasoning.length > 300 ? "…" : ""}</p>
                        )}
                        {feedbackRunId === run.id ? (
                          <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                            <select
                              value={feedbackForm.verdict}
                              onChange={(e) => setFeedbackForm((f) => ({ ...f, verdict: e.target.value }))}
                              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 10px", color: "#e8e8e8", fontSize: "12px" }}
                            >
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                              <option value="partial">Partial</option>
                            </select>
                            <input
                              placeholder="Rationale…"
                              value={feedbackForm.rationale}
                              onChange={(e) => setFeedbackForm((f) => ({ ...f, rationale: e.target.value }))}
                              style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 10px", color: "#e8e8e8", fontSize: "12px" }}
                            />
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => void handleFeedback(run.id)} style={{ background: "#22c55e", color: "#000", padding: "6px 12px", borderRadius: "5px", fontSize: "12px", border: "none", cursor: "pointer", fontWeight: 500 }}>Submit</button>
                              <button onClick={() => setFeedbackRunId(null)} style={{ background: "#2a2a2a", color: "#888", padding: "6px 12px", borderRadius: "5px", fontSize: "12px", border: "none", cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setFeedbackRunId(run.id)} style={{ fontSize: "11px", color: "#555", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            + Submit feedback
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
