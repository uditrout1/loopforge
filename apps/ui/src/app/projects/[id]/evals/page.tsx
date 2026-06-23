"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getProject,
  getEvalCriteria,
  getEvalRuns,
  getEvalsSummary,
  createEvalCriteria,
  runEval,
  submitEvalFeedback,
  runRepoScan,
  type EvalCriteriaData,
  type EvalRunData,
  type EvalsSummary,
  type ScanType,
  type ScanFinding,
  type ScanResult,
} from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SCAN_PRESETS: { type: ScanType; label: string; desc: string }[] = [
  { type: "db_long_queries", label: "Long-running queries", desc: "SELECT *, missing LIMIT, full table scans, unoptimized aggregations" },
  { type: "n_plus_one",      label: "N+1 queries",         desc: "DB calls inside loops, missing eager loading / batch fetches" },
  { type: "missing_indexes", label: "Missing indexes",      desc: "WHERE clauses on unindexed fields, sort on non-indexed columns" },
  { type: "unhandled_errors",label: "Unhandled errors",     desc: "await without try/catch, .then() without .catch(), swallowed errors" },
  { type: "custom",          label: "Custom",               desc: "Describe what you want to scan for" },
];

const SEVERITY_COLOR: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#22c55e",
};

export default function EvalsPage({ params }: PageProps) {
  const [projectId, setProjectId]     = useState<string>("");
  const [repoPath,  setRepoPath]      = useState<string>("");
  const [tab,       setTab]           = useState<"criteria" | "scan">("criteria");

  // Criteria tab state
  const [criteria,   setCriteria]   = useState<EvalCriteriaData[]>([]);
  const [selected,   setSelected]   = useState<EvalCriteriaData | null>(null);
  const [runs,       setRuns]       = useState<EvalRunData[]>([]);
  const [summary,    setSummary]    = useState<EvalsSummary | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [runContent, setRunContent] = useState("");
  const [running,    setRunning]    = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [newForm, setNewForm] = useState({ name: "", description: "", type: "product_criteria", prompt: "", threshold: "0.7" });
  const [feedbackRunId,  setFeedbackRunId]  = useState<string | null>(null);
  const [feedbackForm,   setFeedbackForm]   = useState({ verdict: "approved", rationale: "", submittedBy: "developer" });

  // Scan tab state
  const [scanType,       setScanType]       = useState<ScanType>("db_long_queries");
  const [customDesc,     setCustomDesc]     = useState("");
  const [scanning,       setScanning]       = useState(false);
  const [scanResult,     setScanResult]     = useState<ScanResult | null>(null);
  const [scanError,      setScanError]      = useState<string | null>(null);
  const [expandedFile,   setExpandedFile]   = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    void Promise.all([
      getProject(projectId).then((p) => setRepoPath(p.repoPath ?? "")).catch(() => {}),
      reload(),
    ]);
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
      await runEval(projectId, { criteriaId: selected.id, targetType: "content", targetId: `manual-${Date.now()}`, content: runContent });
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
      await createEvalCriteria(projectId, { ...newForm, threshold: parseFloat(newForm.threshold) || 0.7 });
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

  async function handleScan() {
    if (!repoPath) { setScanError("No repo path — connect a repo first."); return; }
    setScanning(true);
    setScanResult(null);
    setScanError(null);
    try {
      const result = await runRepoScan(projectId, repoPath, scanType, scanType === "custom" ? customDesc : undefined);
      setScanResult(result);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  const scoreColor = (score: number) => score >= 0.8 ? "#22c55e" : score >= 0.5 ? "#f59e0b" : "#ef4444";

  // Group scan findings by file
  const findingsByFile = scanResult
    ? scanResult.findings.reduce<Record<string, ScanFinding[]>>((acc, f) => {
        (acc[f.file] ??= []).push(f);
        return acc;
      }, {})
    : {};

  return (
    <div style={{ minHeight: "100vh", padding: "48px 32px", maxWidth: "1200px", margin: "0 auto" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px", fontSize: "13px", color: "#555" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none" }}>LoopForge</Link>
        <span>/</span>
        <Link href={`/projects/${projectId}`} style={{ color: "#555", textDecoration: "none" }}>{projectId.slice(0, 8)}…</Link>
        <span>/</span>
        <span style={{ color: "#e8e8e8" }}>Evals</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
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
        {/* Tab toggle */}
        <div style={{ display: "flex", gap: "4px", background: "#111", padding: "4px", borderRadius: "8px", border: "1px solid #2a2a2a" }}>
          {(["criteria", "scan"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "6px 16px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 500,
                background: tab === t ? "#1e1e2e" : "transparent", color: tab === t ? "#6366f1" : "#555" }}>
              {t === "criteria" ? "Criteria" : "Scan repo"}
            </button>
          ))}
        </div>
      </div>

      {/* ── CRITERIA TAB ── */}
      {tab === "criteria" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <button onClick={() => setShowCreate(!showCreate)}
              style={{ background: "#f0f0f0", color: "#0a0a0a", padding: "8px 16px", borderRadius: "7px", fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer" }}>
              + New Criteria
            </button>
          </div>

          {showCreate && (
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "24px", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#f0f0f0", marginBottom: "16px" }}>New Eval Criteria</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <input placeholder="Name" value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px" }} />
                <select value={newForm.type} onChange={(e) => setNewForm((f) => ({ ...f, type: e.target.value }))}
                  style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px" }}>
                  <option value="product_criteria">Product Criteria</option>
                  <option value="engineering_standard">Engineering Standard</option>
                  <option value="design_standard">Design Standard</option>
                  <option value="architecture_compliance">Architecture Compliance</option>
                </select>
              </div>
              <input placeholder="Description" value={newForm.description}
                onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px", marginBottom: "12px", boxSizing: "border-box" }} />
              <textarea placeholder="Evaluation prompt — describe what to check and how to score (0-1)" value={newForm.prompt}
                onChange={(e) => setNewForm((f) => ({ ...f, prompt: e.target.value }))}
                rows={3}
                style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "8px 12px", color: "#e8e8e8", fontSize: "13px", resize: "vertical", marginBottom: "12px", boxSizing: "border-box" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <label style={{ fontSize: "12px", color: "#888" }}>Pass threshold:</label>
                <input type="number" min="0" max="1" step="0.05" value={newForm.threshold}
                  onChange={(e) => setNewForm((f) => ({ ...f, threshold: e.target.value }))}
                  style={{ width: "80px", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 10px", color: "#e8e8e8", fontSize: "13px" }} />
                <button onClick={() => void handleCreate()} disabled={creating}
                  style={{ marginLeft: "auto", background: "#6366f1", color: "#fff", padding: "8px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer", opacity: creating ? 0.6 : 1 }}>
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {criteria.length === 0 && <p style={{ fontSize: "13px", color: "#444", padding: "16px 0" }}>No eval criteria yet.</p>}
              {criteria.map((c) => (
                <button key={c.id} onClick={() => void selectCriteria(c)}
                  style={{ background: selected?.id === c.id ? "#1e1e2e" : "#1a1a1a", border: `1px solid ${selected?.id === c.id ? "#6366f1" : "#2a2a2a"}`, borderRadius: "8px", padding: "14px 16px", textAlign: "left", cursor: "pointer" }}>
                  <p style={{ fontSize: "13px", fontWeight: 500, color: "#f0f0f0", marginBottom: "4px" }}>{c.name}</p>
                  <p style={{ fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.type.replace(/_/g, " ")}</p>
                  <p style={{ fontSize: "11px", color: "#444", marginTop: "4px" }}>threshold {c.threshold}</p>
                </button>
              ))}
            </div>

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
                    <textarea placeholder="Paste the content to evaluate…" value={runContent}
                      onChange={(e) => setRunContent(e.target.value)} rows={5}
                      style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 12px", color: "#e8e8e8", fontSize: "13px", resize: "vertical", marginBottom: "12px", boxSizing: "border-box" }} />
                    <button onClick={() => void handleRunEval()} disabled={running || !runContent.trim()}
                      style={{ background: "#6366f1", color: "#fff", padding: "8px 18px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", cursor: "pointer", opacity: running || !runContent.trim() ? 0.5 : 1 }}>
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
                              <span style={{ marginLeft: "auto", fontSize: "11px", color: "#444" }}>{new Date(run.createdAt).toLocaleString()}</span>
                            </div>
                            {run.reasoning && <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.6, marginBottom: "10px" }}>{run.reasoning.slice(0, 300)}{run.reasoning.length > 300 ? "…" : ""}</p>}
                            {feedbackRunId === run.id ? (
                              <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <select value={feedbackForm.verdict} onChange={(e) => setFeedbackForm((f) => ({ ...f, verdict: e.target.value }))}
                                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 10px", color: "#e8e8e8", fontSize: "12px" }}>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="partial">Partial</option>
                                </select>
                                <input placeholder="Rationale…" value={feedbackForm.rationale}
                                  onChange={(e) => setFeedbackForm((f) => ({ ...f, rationale: e.target.value }))}
                                  style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "6px 10px", color: "#e8e8e8", fontSize: "12px" }} />
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button onClick={() => void handleFeedback(run.id)} style={{ background: "#22c55e", color: "#000", padding: "6px 12px", borderRadius: "5px", fontSize: "12px", border: "none", cursor: "pointer", fontWeight: 500 }}>Submit</button>
                                  <button onClick={() => setFeedbackRunId(null)} style={{ background: "#2a2a2a", color: "#888", padding: "6px 12px", borderRadius: "5px", fontSize: "12px", border: "none", cursor: "pointer" }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setFeedbackRunId(run.id)} style={{ fontSize: "11px", color: "#555", background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ Submit feedback</button>
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
        </>
      )}

      {/* ── SCAN TAB ── */}
      {tab === "scan" && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "24px" }}>
          {/* Config panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "20px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", marginBottom: "14px" }}>Scan type</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {SCAN_PRESETS.map((p) => (
                  <button key={p.type} onClick={() => setScanType(p.type)}
                    style={{ background: scanType === p.type ? "#1e1e2e" : "#111", border: `1px solid ${scanType === p.type ? "#6366f1" : "#2a2a2a"}`, borderRadius: "8px", padding: "12px 14px", textAlign: "left", cursor: "pointer" }}>
                    <p style={{ fontSize: "13px", fontWeight: 500, color: "#f0f0f0", marginBottom: "3px" }}>{p.label}</p>
                    <p style={{ fontSize: "11px", color: "#555", lineHeight: 1.4 }}>{p.desc}</p>
                  </button>
                ))}
              </div>
              {scanType === "custom" && (
                <textarea placeholder="Describe what to scan for… e.g. 'find all places where user input is passed to SQL queries without sanitization'" value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)} rows={4}
                  style={{ width: "100%", background: "#111", border: "1px solid #2a2a2a", borderRadius: "6px", padding: "10px 12px", color: "#e8e8e8", fontSize: "12px", resize: "vertical", marginTop: "12px", boxSizing: "border-box" }} />
              )}
            </div>

            <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "16px" }}>
              <p style={{ fontSize: "11px", color: "#555", marginBottom: "6px" }}>Repo path</p>
              <p style={{ fontSize: "12px", color: "#888", fontFamily: "monospace", wordBreak: "break-all" }}>{repoPath || "—"}</p>
            </div>

            <button onClick={() => void handleScan()} disabled={scanning || !repoPath || (scanType === "custom" && !customDesc.trim())}
              style={{ background: "#6366f1", color: "#fff", padding: "10px 18px", borderRadius: "7px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
                opacity: scanning || !repoPath || (scanType === "custom" && !customDesc.trim()) ? 0.5 : 1 }}>
              {scanning ? "Scanning…" : "Run scan"}
            </button>

            {scanError && <p style={{ fontSize: "12px", color: "#ef4444" }}>{scanError}</p>}
          </div>

          {/* Results panel */}
          <div>
            {!scanResult && !scanning && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "48px 32px", textAlign: "center" }}>
                <p style={{ color: "#333", fontSize: "14px", marginBottom: "8px" }}>Select a scan type and run</p>
                <p style={{ color: "#2a2a2a", fontSize: "12px" }}>Claude will analyse your repo and surface real issues with file + line references</p>
              </div>
            )}

            {scanning && (
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "48px 32px", textAlign: "center" }}>
                <p style={{ color: "#555", fontSize: "13px" }}>Scanning repo — this may take 30–60 s…</p>
              </div>
            )}

            {scanResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Summary bar */}
                <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", padding: "16px 20px", display: "flex", gap: "24px", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "11px", color: "#555", marginBottom: "2px" }}>FILES SCANNED</p>
                    <p style={{ fontSize: "18px", fontWeight: 700, color: "#f0f0f0" }}>{scanResult.filesScanned}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: "11px", color: "#555", marginBottom: "2px" }}>FINDINGS</p>
                    <p style={{ fontSize: "18px", fontWeight: 700, color: scanResult.findings.length > 0 ? "#f59e0b" : "#22c55e" }}>{scanResult.findings.length}</p>
                  </div>
                  {(["high", "medium", "low"] as const).map((sev) => {
                    const count = scanResult.findings.filter((f) => f.severity === sev).length;
                    if (count === 0) return null;
                    return (
                      <div key={sev}>
                        <p style={{ fontSize: "11px", color: "#555", marginBottom: "2px", textTransform: "uppercase" }}>{sev}</p>
                        <p style={{ fontSize: "18px", fontWeight: 700, color: SEVERITY_COLOR[sev] }}>{count}</p>
                      </div>
                    );
                  })}
                  {scanResult.findings.length === 0 && (
                    <p style={{ fontSize: "13px", color: "#22c55e", marginLeft: "auto" }}>No issues found</p>
                  )}
                </div>

                {/* Findings grouped by file */}
                {Object.entries(findingsByFile).map(([file, fileFindngs]) => (
                  <div key={file} style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", overflow: "hidden" }}>
                    <button
                      onClick={() => setExpandedFile(expandedFile === file ? null : file)}
                      style={{ width: "100%", padding: "14px 20px", background: "transparent", border: "none", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#e8e8e8", flex: 1 }}>{file}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {(["high", "medium", "low"] as const).map((sev) => {
                          const c = fileFindngs.filter((f) => f.severity === sev).length;
                          return c > 0 ? (
                            <span key={sev} style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "4px", background: SEVERITY_COLOR[sev] + "22", color: SEVERITY_COLOR[sev], fontWeight: 600 }}>
                              {c} {sev}
                            </span>
                          ) : null;
                        })}
                      </div>
                      <span style={{ fontSize: "11px", color: "#555" }}>{expandedFile === file ? "▲" : "▼"}</span>
                    </button>

                    {expandedFile === file && (
                      <div style={{ borderTop: "1px solid #2a2a2a" }}>
                        {fileFindngs.map((finding, i) => (
                          <div key={finding.id} style={{ padding: "16px 20px", borderBottom: i < fileFindngs.length - 1 ? "1px solid #1e1e1e" : "none" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                              <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: SEVERITY_COLOR[finding.severity] + "22", color: SEVERITY_COLOR[finding.severity], fontWeight: 600, flexShrink: 0 }}>
                                {finding.severity.toUpperCase()}
                              </span>
                              <span style={{ fontSize: "11px", color: "#444", fontFamily: "monospace", flexShrink: 0 }}>
                                L{finding.startLine}–{finding.endLine}
                              </span>
                              <p style={{ fontSize: "13px", color: "#e8e8e8", lineHeight: 1.5 }}>{finding.issue}</p>
                            </div>
                            <div style={{ background: "#0d0d0d", borderRadius: "6px", padding: "10px 14px", marginBottom: "10px", overflow: "hidden" }}>
                              <pre style={{ fontSize: "11px", color: "#777", fontFamily: "monospace", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", maxHeight: "140px", overflow: "hidden" }}>
                                {finding.snippet.slice(0, 500)}{finding.snippet.length > 500 ? "\n…" : ""}
                              </pre>
                            </div>
                            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                              <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: 600, flexShrink: 0 }}>Fix:</span>
                              <p style={{ fontSize: "12px", color: "#888", lineHeight: 1.5 }}>{finding.suggestion}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
