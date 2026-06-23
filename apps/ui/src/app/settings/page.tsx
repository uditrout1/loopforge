"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getSettings,
  updateSettings,
  getAvailableModels,
  type LoopForgeSettings,
  type AvailableModel,
} from "@/lib/api";

const WORKFLOW_LABELS: Record<string, string> = {
  prReview: "PR Review",
  bugInvestigation: "Bug Investigation",
  releasePreparer: "Release Preparer",
  nightlySecurityScan: "Nightly Security Scan",
};

const WORKFLOW_DESCRIPTIONS: Record<string, string> = {
  prReview: "Automatically reviews pull requests for bugs, security issues, and style",
  bugInvestigation: "Investigates bug reports by tracing through code and logs",
  releasePreparer: "Prepares release notes and checks for blockers before shipping",
  nightlySecurityScan: "Runs security audit across the codebase every night",
};

const input = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "7px",
  padding: "8px 12px",
  color: "#e8e8e8",
  fontSize: "13px",
  outline: "none",
  width: "100%",
};

const card = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "24px",
  marginBottom: "16px",
};

export default function SettingsPage() {
  const [tab, setTab] = useState<"models" | "workflows" | "ui">("models");
  const [settings, setSettings] = useState<LoopForgeSettings | null>(null);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void Promise.all([getSettings(), getAvailableModels()]).then(([s, m]) => {
      setSettings(s);
      setModels(m);
    });
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function setModel(tier: "small" | "medium" | "frontier" | "ollamaModel", value: string) {
    if (!settings) return;
    setSettings({ ...settings, models: { ...settings.models, [tier]: value } });
  }

  function setRouting(key: keyof LoopForgeSettings["routing"], value: boolean | number | null) {
    if (!settings) return;
    setSettings({ ...settings, routing: { ...settings.routing, [key]: value } });
  }

  function setWorkflow(key: string, field: "enabled" | "trigger", value: boolean | string) {
    if (!settings) return;
    const wf = settings.workflows[key] ?? { enabled: false, trigger: "manual" };
    setSettings({
      ...settings,
      workflows: { ...settings.workflows, [key]: { ...wf, [field]: value } },
    });
  }

  function setUi(key: keyof LoopForgeSettings["ui"], value: boolean) {
    if (!settings) return;
    setSettings({ ...settings, ui: { ...settings.ui, [key]: value } });
  }

  const modelsByTier = (tier: string) => models.filter((m) => m.tier === tier);

  const tabs: Array<{ id: "models" | "workflows" | "ui"; label: string }> = [
    { id: "models", label: "Models" },
    { id: "workflows", label: "Workflows" },
    { id: "ui", label: "UI Preferences" },
  ];

  return (
    <div style={{ minHeight: "100vh", padding: "48px 32px", maxWidth: "760px", margin: "0 auto" }}>
      <nav style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "40px", fontSize: "13px", color: "#555" }}>
        <Link href="/" style={{ color: "#555", textDecoration: "none" }}>LoopForge</Link>
        <span>/</span>
        <span style={{ color: "#e8e8e8" }}>Settings</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#f0f0f0", marginBottom: "4px" }}>Settings</h1>
          <p style={{ fontSize: "12px", color: "#555" }}>Configure models, workflows, and UI preferences</p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving || !settings}
          style={{
            background: saved ? "#22c55e" : saving ? "#2a2a2a" : "#f0f0f0",
            color: saved || saving ? (saved ? "#fff" : "#555") : "#0a0a0a",
            border: "none",
            borderRadius: "7px",
            padding: "9px 20px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: saving || !settings ? "not-allowed" : "pointer",
          }}
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "#111", borderRadius: "8px", padding: "4px", width: "fit-content" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? "#1a1a1a" : "transparent",
              color: tab === t.id ? "#f0f0f0" : "#555",
              border: "none",
              borderRadius: "6px",
              padding: "7px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!settings && (
        <div style={{ color: "#555", fontSize: "13px" }}>Loading settings…</div>
      )}

      {settings && tab === "models" && (
        <div>
          {(["frontier", "medium", "small"] as const).map((tier) => (
            <div key={tier} style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", textTransform: "capitalize" }}>{tier}</p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
                    {tier === "frontier" ? "Complex reasoning, vision, architecture" : tier === "medium" ? "Code generation, analysis" : "Fast extraction, classification"}
                  </p>
                </div>
                <span style={{ fontSize: "11px", color: "#6366f1", background: "#1e1b4b", padding: "3px 8px", borderRadius: "4px" }}>
                  {tier}
                </span>
              </div>
              <select
                value={settings.models[tier]}
                onChange={(e) => setModel(tier, e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              >
                {modelsByTier(tier).filter((m) => m.provider === "openrouter").length > 0 && (
                  <optgroup label="OpenRouter (cloud)">
                    {modelsByTier(tier).filter((m) => m.provider === "openrouter").map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </optgroup>
                )}
                {modelsByTier(tier).filter((m) => m.provider === "ollama").length > 0 && (
                  <optgroup label="Ollama (on-prem)">
                    {modelsByTier(tier).filter((m) => m.provider === "ollama").map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          ))}

          <div style={card}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", marginBottom: "4px" }}>Ollama default model</p>
            <p style={{ fontSize: "11px", color: "#555", marginBottom: "14px" }}>Used for on-prem routing of confidential / restricted projects</p>
            <input
              type="text"
              value={settings.models.ollamaModel}
              onChange={(e) => setModel("ollamaModel", e.target.value)}
              placeholder="llama3"
              style={input}
            />
          </div>

          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0" }}>Prefer on-prem</p>
                <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>Route all requests to Ollama when available, regardless of data classification</p>
              </div>
              <Toggle
                value={settings.routing.preferOnPrem}
                onChange={(v) => setRouting("preferOnPrem", v)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#888" }}>Confidential → on-prem only</p>
                <p style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>Always enforced — confidential and restricted data never leaves your network</p>
              </div>
              <span style={{ fontSize: "11px", color: "#444", background: "#111", padding: "3px 8px", borderRadius: "4px" }}>locked</span>
            </div>
          </div>

          <div style={card}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0", marginBottom: "4px" }}>Session cost limit (USD)</p>
            <p style={{ fontSize: "11px", color: "#555", marginBottom: "14px" }}>Block AI calls once a session exceeds this spend. Leave blank for unlimited.</p>
            <input
              type="number"
              min="0"
              step="0.10"
              value={settings.routing.costLimitPerSessionUsd ?? ""}
              onChange={(e) => setRouting("costLimitPerSessionUsd", e.target.value === "" ? null : parseFloat(e.target.value))}
              placeholder="unlimited"
              style={{ ...input, width: "160px" }}
            />
          </div>
        </div>
      )}

      {settings && tab === "workflows" && (
        <div>
          {Object.keys(WORKFLOW_LABELS).map((key) => {
            const wf = settings.workflows[key] ?? { enabled: false, trigger: "manual" };
            return (
              <div key={key} style={card}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: wf.enabled ? "#f0f0f0" : "#555" }}>
                      {WORKFLOW_LABELS[key]}
                    </p>
                    <p style={{ fontSize: "11px", color: "#444", marginTop: "3px" }}>
                      {WORKFLOW_DESCRIPTIONS[key]}
                    </p>
                    {wf.enabled && (
                      <div style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "#888" }}>Trigger:</span>
                        {(["manual", "auto"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setWorkflow(key, "trigger", t)}
                            style={{
                              background: wf.trigger === t ? "#6366f1" : "#111",
                              color: wf.trigger === t ? "#fff" : "#555",
                              border: "1px solid " + (wf.trigger === t ? "#6366f1" : "#2a2a2a"),
                              borderRadius: "5px",
                              padding: "4px 12px",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Toggle
                    value={wf.enabled}
                    onChange={(v) => setWorkflow(key, "enabled", v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {settings && tab === "ui" && (
        <div>
          <div style={card}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0" }}>Show cost per message</p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>Display token cost below each AI response in sessions</p>
                </div>
                <Toggle value={settings.ui.showCostPerMessage} onChange={(v) => setUi("showCostPerMessage", v)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#f0f0f0" }}>Show model per message</p>
                  <p style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>Display which model was used below each AI response</p>
                </div>
                <Toggle value={settings.ui.showModelPerMessage} onChange={(v) => setUi("showModelPerMessage", v)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: "40px",
        height: "22px",
        borderRadius: "11px",
        background: value ? "#6366f1" : "#2a2a2a",
        border: "none",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: value ? "21px" : "3px",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}
