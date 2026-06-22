"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const GATEWAY = "http://localhost:18790";

const STEPS = [
  {
    key: "brd" as const,
    label: "BRD",
    title: "Business Requirements Document",
    subtitle: "The why. Market problem, target users, business model, success metrics.",
    template: `## Problem Statement
[What problem does this solve? Who has this problem?]

## Target Users
[Who are the primary users? What are their characteristics?]

## Business Model
[How does this create or capture value?]

## Success Metrics
[How do we measure success? Key KPIs.]

## Competitive Landscape
[Who else solves this? What's our differentiation?]

## Constraints & Risks
[Budget, timeline, regulatory, technical constraints.]`,
  },
  {
    key: "frd" as const,
    label: "FRD",
    title: "Functional Requirements Document",
    subtitle: "The what. Features, user flows, edge cases, non-goals.",
    template: `## Core Features
[List the essential features with brief descriptions]

## User Flows
[Key user journeys from start to finish]

## Edge Cases
[What happens when things go wrong?]

## Non-Goals
[What are we explicitly NOT building?]

## Integration Requirements
[External systems, APIs, or services needed]`,
  },
  {
    key: "prd" as const,
    label: "PRD",
    title: "Product Requirements Document",
    subtitle: "The complete spec. Requirements, acceptance criteria, tech constraints, rollout plan.",
    template: `## Overview
[One paragraph summary of the product]

## Requirements
[Numbered list: REQ-001 The system shall...]

## Acceptance Criteria
[For each requirement, what does "done" look like?]

## Technical Constraints
[Stack, performance, security, compliance requirements]

## Rollout Plan
[MVP scope, v1 scope, future phases]

## Open Questions
[Decisions not yet made]`,
  },
];

type DocKey = "brd" | "frd" | "prd";

function InitiateInner({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectName = searchParams.get("name") ?? "New Project";
  const description = searchParams.get("description") ?? "";
  const category = searchParams.get("category") ?? "";
  const audience = searchParams.get("audience") ?? "";

  const [step, setStep] = useState(0);
  const [docs, setDocs] = useState<Record<DocKey, string>>({
    brd: STEPS[0]!.template,
    frd: STEPS[1]!.template,
    prd: STEPS[2]!.template,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStep = STEPS[step]!;
  const currentKey = currentStep.key;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleAiFill() {
    setAiLoading(true);
    try {
      const res = await fetch(`${GATEWAY}/docs/ai-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          docType: currentKey,
          name: projectName,
          description,
          category,
          audience,
          currentContent: docs[currentKey],
        }),
      });
      if (!res.ok) throw new Error("backend");
      const data = (await res.json()) as { content: string };
      setDocs((prev) => ({ ...prev, [currentKey]: data.content }));
    } catch {
      setToast("AI assistance will be available once the backend is connected");
    } finally {
      setAiLoading(false);
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setDocs((prev) => ({ ...prev, [currentKey]: text }));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      await fetch(`${GATEWAY}/projects/${projectId}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docs),
      });
    } catch {
      // Endpoint may not exist yet — proceed anyway
    }
    router.push(`/projects/${projectId}?initialized=1`);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "40px 32px", maxWidth: "860px", margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "8px",
          padding: "12px 20px", color: "#e8e8e8", fontSize: "13px", zIndex: 100,
          maxWidth: "480px", textAlign: "center",
        }}>
          {toast}
        </div>
      )}

      {/* Nav */}
      <Link href="/" style={{ fontSize: "12px", color: "#555", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "36px" }}>
        ← LoopForge
      </Link>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.02em", marginBottom: "4px" }}>
          {projectName}
        </h1>
        <p style={{ fontSize: "13px", color: "#555" }}>Initiation Wizard</p>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "40px" }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: i < step ? "#6366f1" : i === step ? "#6366f1" : "#1a1a1a",
                border: i <= step ? "none" : "1px solid #2a2a2a",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 600,
                color: i <= step ? "#fff" : "#444",
              }}>
                {i < step ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: "13px", fontWeight: i === step ? 600 : 400, color: i === step ? "#e8e8e8" : i < step ? "#6366f1" : "#444" }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: "40px", height: "1px", background: i < step ? "#6366f1" : "#2a2a2a", margin: "0 12px" }} />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ height: "2px", background: "#1a1a1a", borderRadius: "1px", marginBottom: "36px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`, background: "#6366f1", transition: "width 0.3s ease" }} />
      </div>

      {/* Doc section */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "12px", padding: "28px", marginBottom: "24px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f0f0f0", marginBottom: "4px" }}>
            {currentStep.title}
          </h2>
          <p style={{ fontSize: "13px", color: "#555" }}>{currentStep.subtitle}</p>
        </div>

        {/* AI + Upload actions */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
          <button
            onClick={() => void handleAiFill()}
            disabled={aiLoading}
            style={{
              background: aiLoading ? "#2a2a2a" : "#1e1b4b",
              color: aiLoading ? "#555" : "#a5b4fc",
              border: "1px solid #2a2a2a",
              borderRadius: "7px",
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: aiLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {aiLoading ? "Generating…" : "✦ AI Fill"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: "#141414",
              color: "#888",
              border: "1px solid #2a2a2a",
              borderRadius: "7px",
              padding: "8px 16px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Upload .md or .txt
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </div>

        <textarea
          value={docs[currentKey]}
          onChange={(e) => setDocs((prev) => ({ ...prev, [currentKey]: e.target.value }))}
          style={{
            width: "100%",
            minHeight: "400px",
            background: "#141414",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "16px",
            color: "#e8e8e8",
            fontSize: "13px",
            fontFamily: "monospace",
            lineHeight: 1.6,
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            background: "none",
            color: step === 0 ? "#333" : "#888",
            border: "1px solid #2a2a2a",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "13px",
            cursor: step === 0 ? "not-allowed" : "pointer",
          }}
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            style={{
              background: "#f0f0f0",
              color: "#0a0a0a",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save & Continue →
          </button>
        ) : (
          <button
            onClick={() => void handleFinish()}
            disabled={finishing}
            style={{
              background: finishing ? "#2a2a2a" : "#6366f1",
              color: finishing ? "#555" : "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: finishing ? "not-allowed" : "pointer",
            }}
          >
            {finishing ? "Finishing…" : "Finish →"}
          </button>
        )}
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function InitiatePage({ params }: PageProps) {
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  if (!projectId) return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;

  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0a0a0a" }} />}>
      <InitiateInner projectId={projectId} />
    </Suspense>
  );
}
