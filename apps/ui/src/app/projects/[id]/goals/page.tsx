"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getGoals,
  createGoal,
  updateGoalTicket,
  redecomposeGoal,
  type GoalData,
  type GoalTicketRef,
} from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  active: "#3b82f6",
  completed: "#22c55e",
  paused: "#6b7280",
  cancelled: "#ef4444",
};

const typeColors: Record<string, string> = {
  feature: "#6366f1",
  chore: "#f59e0b",
  spike: "#0ea5e9",
  bug: "#ef4444",
};

function ProgressBar({ percent }: { percent: number }) {
  const color = percent === 100 ? "#22c55e" : percent > 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ height: 4, background: "#2a2a2a", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", width: `${percent}%`, background: color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
      background: color + "22", color, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {label}
    </span>
  );
}

export default function GoalsPage({ params }: PageProps) {
  const [projectId, setProjectId] = useState("");
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [selected, setSelected] = useState<GoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [decomposing, setDecomposing] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    targetDate: "",
    autoDecompose: true,
  });

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getGoals(projectId)
      .then((g) => { setGoals(g); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId]);

  async function handleCreate() {
    if (!form.title || !form.description) return;
    setShowModal(false);
    setDecomposing(form.autoDecompose);
    const goal = await createGoal(projectId, {
      title: form.title,
      description: form.description,
      ...(form.targetDate ? { targetDate: form.targetDate } : {}),
      autoDecompose: form.autoDecompose,
    });
    setDecomposing(false);
    setGoals((prev) => [...prev, goal]);
    setSelected(goal);
    setForm({ title: "", description: "", targetDate: "", autoDecompose: true });
  }

  async function handleTicketCheck(ticket: GoalTicketRef, checked: boolean) {
    if (!selected) return;
    const updated = await updateGoalTicket(projectId, selected.id, ticket.ticketId, {
      status: checked ? "resolved" : "open",
    });
    setGoals((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    setSelected(updated);
  }

  async function handleBlockerToggle(ticket: GoalTicketRef) {
    if (!selected) return;
    const updated = await updateGoalTicket(projectId, selected.id, ticket.ticketId, {
      status: ticket.status,
      isBlocker: !ticket.isBlocker,
    });
    setGoals((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    setSelected(updated);
  }

  async function handleRedecompose() {
    if (!selected) return;
    setDecomposing(true);
    const updated = await redecomposeGoal(projectId, selected.id);
    setDecomposing(false);
    setGoals((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    setSelected(updated);
  }

  const doneCount = selected?.tickets.filter(
    (t) => t.status === "resolved" || t.status === "closed"
  ).length ?? 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px", borderBottom: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/projects/${projectId}`} style={{ color: "#555", textDecoration: "none", fontSize: 13 }}>← Project</Link>
          <span style={{ color: "#2a2a2a" }}>/</span>
          <span style={{ color: "#e8e8e8", fontSize: 13, fontWeight: 600 }}>Engineering Goals</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: "#f0f0f0", color: "#0a0a0a", border: "none", borderRadius: 7,
            padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          + New Goal
        </button>
      </div>

      {decomposing && (
        <div style={{ background: "#0f1a0f", borderBottom: "1px solid #1e3a1e", padding: "10px 32px", fontSize: 12, color: "#4ade80" }}>
          Claude is decomposing your goal into tickets…
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left panel */}
        <div style={{ width: 300, borderRight: "1px solid #1e1e1e", overflowY: "auto", padding: 16 }}>
          {loading && <p style={{ color: "#555", fontSize: 13, padding: 8 }}>Loading…</p>}
          {!loading && goals.length === 0 && (
            <p style={{ color: "#444", fontSize: 13, padding: 8 }}>No goals yet. Create one to get started.</p>
          )}
          {goals.map((goal) => (
            <button
              key={goal.id}
              onClick={() => setSelected(goal)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: selected?.id === goal.id ? "#1e1e1e" : "transparent",
                border: selected?.id === goal.id ? "1px solid #2a2a2a" : "1px solid transparent",
                borderRadius: 8, padding: "12px 14px", marginBottom: 6, cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#e8e8e8" }}>{goal.title}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {goal.blockers.length > 0 && (
                    <span style={{ fontSize: 10, background: "#f97316" + "22", color: "#f97316", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                      {goal.blockers.length} blocker{goal.blockers.length > 1 ? "s" : ""}
                    </span>
                  )}
                  <Badge label={goal.status} color={statusColors[goal.status] ?? "#6b7280"} />
                </div>
              </div>
              <ProgressBar percent={goal.progressPercent} />
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                {goal.progressPercent}% complete
              </div>
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          {!selected && (
            <div style={{ color: "#444", fontSize: 14, marginTop: 40, textAlign: "center" }}>
              Select a goal to see details
            </div>
          )}

          {selected && (
            <div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f0f0f0", marginBottom: 6 }}>
                    {selected.title}
                  </h2>
                  <p style={{ fontSize: 13, color: "#888", maxWidth: 600 }}>{selected.description}</p>
                </div>
                <button
                  onClick={handleRedecompose}
                  disabled={decomposing}
                  style={{
                    background: "#1a1a1a", color: "#e8e8e8", border: "1px solid #2a2a2a",
                    borderRadius: 7, padding: "8px 14px", fontSize: 12, cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {decomposing ? "Decomposing…" : "Re-decompose"}
                </button>
              </div>

              {/* Progress summary */}
              <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "#aaa" }}>
                    {doneCount} / {selected.tickets.length} tickets complete
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: selected.progressPercent === 100 ? "#22c55e" : "#e8e8e8" }}>
                    {selected.progressPercent}%
                  </span>
                </div>
                <ProgressBar percent={selected.progressPercent} />
              </div>

              {/* Blockers */}
              {selected.blockers.length > 0 && (
                <div style={{ background: "#1a0a00", border: "1px solid #3a1e00", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#f97316", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Blockers
                  </p>
                  {selected.blockers.map((b, i) => (
                    <p key={i} style={{ fontSize: 13, color: "#fb923c", marginBottom: 4 }}>⚠ {b}</p>
                  ))}
                </div>
              )}

              {/* Tickets */}
              <div>
                <p style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                  Tickets
                </p>
                {selected.tickets.length === 0 && (
                  <p style={{ fontSize: 13, color: "#444" }}>No tickets yet. Click Re-decompose to generate them.</p>
                )}
                {selected.tickets.map((ticket) => {
                  const done = ticket.status === "resolved" || ticket.status === "closed";
                  const type = (ticket as GoalTicketRef & { type?: string }).type ?? "feature";
                  return (
                    <div
                      key={ticket.ticketId}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        background: "#111", border: "1px solid #1e1e1e", borderRadius: 8,
                        padding: "12px 14px", marginBottom: 8,
                        opacity: done ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={(e) => handleTicketCheck(ticket, e.target.checked)}
                        style={{ marginTop: 2, cursor: "pointer", accentColor: "#22c55e" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: done ? "#555" : "#e8e8e8", textDecoration: done ? "line-through" : "none" }}>
                            {ticket.title}
                          </span>
                          <Badge label={type} color={typeColors[type] ?? "#6b7280"} />
                          <Badge label={ticket.status} color={ticket.status === "open" ? "#6b7280" : ticket.status === "in_progress" ? "#3b82f6" : "#22c55e"} />
                        </div>
                      </div>
                      <button
                        onClick={() => handleBlockerToggle(ticket)}
                        title="Mark as blocker"
                        style={{
                          background: ticket.isBlocker ? "#f97316" + "22" : "transparent",
                          color: ticket.isBlocker ? "#f97316" : "#444",
                          border: `1px solid ${ticket.isBlocker ? "#f97316" + "44" : "#2a2a2a"}`,
                          borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer",
                        }}
                      >
                        {ticket.isBlocker ? "⚠ Blocker" : "Mark blocker"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Goal Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div style={{
            background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
            padding: 32, width: 480, maxWidth: "90vw",
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f0f0f0", marginBottom: 20 }}>New Engineering Goal</h3>

            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Ship Family Controls integration"
              style={{
                width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
                borderRadius: 7, padding: "10px 12px", color: "#f0f0f0", fontSize: 13,
                marginBottom: 16, boxSizing: "border-box",
              }}
            />

            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does success look like?"
              rows={4}
              style={{
                width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a",
                borderRadius: 7, padding: "10px 12px", color: "#f0f0f0", fontSize: 13,
                marginBottom: 16, resize: "vertical", boxSizing: "border-box",
              }}
            />

            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Target date (optional)</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
              style={{
                background: "#1a1a1a", border: "1px solid #2a2a2a",
                borderRadius: 7, padding: "10px 12px", color: "#f0f0f0", fontSize: 13,
                marginBottom: 16, colorScheme: "dark",
              }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 24 }}>
              <input
                type="checkbox"
                checked={form.autoDecompose}
                onChange={(e) => setForm((f) => ({ ...f, autoDecompose: e.target.checked }))}
                style={{ accentColor: "#6366f1" }}
              />
              <span style={{ fontSize: 13, color: "#aaa" }}>Let Claude decompose into tickets</span>
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "transparent", color: "#888", border: "1px solid #2a2a2a",
                  borderRadius: 7, padding: "9px 18px", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.title || !form.description}
                style={{
                  background: "#f0f0f0", color: "#0a0a0a", border: "none",
                  borderRadius: 7, padding: "9px 18px", fontSize: 13, fontWeight: 500,
                  cursor: form.title && form.description ? "pointer" : "not-allowed",
                  opacity: form.title && form.description ? 1 : 0.5,
                }}
              >
                {form.autoDecompose ? "Create & Decompose" : "Create Goal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
