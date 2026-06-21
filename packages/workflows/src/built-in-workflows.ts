import type { Workflow, WorkflowNode, RetryStrategy } from "@devos/core"

// ─── Shared Defaults ─────────────────────────────────────────────────────────

const DEFAULT_RETRY: RetryStrategy = {
  maxAttempts: 3,
  backoffMs: 1000,
}

function agentNode(
  id: string,
  label: string,
  systemPrompt: string,
  contextSlice: string[] = [],
  model?: string,
): WorkflowNode {
  return {
    id,
    type: "agent",
    label,
    systemPrompt,
    contextSlice,
    tools: [],
    retryStrategy: DEFAULT_RETRY,
    timeoutMs: 120_000,
    ...(model !== undefined ? { model } : {}),
  }
}

function triggerNode(id: string, label: string): WorkflowNode {
  return {
    id,
    type: "trigger",
    label,
    contextSlice: [],
    tools: [],
    retryStrategy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 5_000,
  }
}

function mergeNode(id: string, label: string, contextSlice: string[] = []): WorkflowNode {
  return {
    id,
    type: "merge",
    label,
    contextSlice,
    tools: [],
    retryStrategy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 10_000,
  }
}

function conditionNode(id: string, label: string, contextSlice: string[] = []): WorkflowNode {
  return {
    id,
    type: "condition",
    label,
    contextSlice,
    tools: [],
    retryStrategy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 10_000,
  }
}

function humanCheckpointNode(id: string, label: string, prompt: string): WorkflowNode {
  return {
    id,
    type: "human_checkpoint",
    label,
    systemPrompt: prompt,
    contextSlice: [],
    tools: [],
    retryStrategy: { maxAttempts: 1, backoffMs: 0 },
    timeoutMs: 86_400_000, // 24h
  }
}

// ─── 1. PR Review ─────────────────────────────────────────────────────────────

export const prReviewWorkflow: Workflow = {
  id: "pr-review",
  name: "PR Review",
  description: "Automated security, code quality, and coverage review for pull requests.",
  isBuiltIn: true,
  isPublic: true,
  version: "1.0.0",
  createdAt: new Date("2024-01-01"),
  triggers: [{ type: "event", event: "pr_opened" }],
  nodes: [
    triggerNode("trigger", "PR Opened"),
    agentNode(
      "security-scan",
      "Security Scan",
      "You are a security engineer. Scan the provided code diff for: OWASP Top 10 patterns, hardcoded secrets, dependency vulnerabilities, injection patterns. Return JSON: { findings: [{severity, file, line, description, fix}] }",
    ),
    agentNode(
      "code-review",
      "Code Review",
      "You are a senior engineer reviewing a PR. Check for: correctness, conventions, dead code, missing error handling. Return JSON: { findings: [{severity, file, line, description, suggestion}] }",
    ),
    agentNode(
      "coverage-check",
      "Coverage Check",
      "Identify which changed files have no corresponding test coverage. Return JSON: { uncoveredFiles: string[] }",
    ),
    mergeNode("merge-findings", "Merge Findings", ["security-scan", "code-review", "coverage-check"]),
    conditionNode("risk-scorer", "Risk Scorer", ["merge-findings"]),
    agentNode(
      "block-pr",
      "Block PR",
      "Critical findings were detected. Summarize the blocking issues and explain why the PR cannot be merged.",
      ["merge-findings"],
    ),
    agentNode(
      "approve-pr",
      "Approve PR",
      "No critical findings. Summarize the review results and approve the PR with any non-blocking suggestions.",
      ["merge-findings"],
    ),
  ],
  edges: [
    { from: "trigger", to: ["security-scan", "code-review", "coverage-check"] },
    { from: "security-scan", to: "merge-findings" },
    { from: "code-review", to: "merge-findings" },
    { from: "coverage-check", to: "merge-findings" },
    { from: "merge-findings", to: "risk-scorer" },
    { from: "risk-scorer", to: "block-pr", condition: "risk-scorer.hasCritical == true" },
    { from: "risk-scorer", to: "approve-pr", condition: "risk-scorer.hasCritical == false" },
  ],
}

// ─── 2. Bug Investigation ─────────────────────────────────────────────────────

export const bugInvestigationWorkflow: Workflow = {
  id: "bug-investigation",
  name: "Bug Investigation",
  description: "Reproduce, analyze, propose, and verify a fix for a reported bug.",
  isBuiltIn: true,
  isPublic: true,
  version: "1.0.0",
  createdAt: new Date("2024-01-01"),
  triggers: [{ type: "manual" }],
  nodes: [
    triggerNode("trigger", "Manual Trigger"),
    agentNode(
      "reproducer",
      "Bug Reproducer",
      "Confirm you can reproduce the bug from the description. Identify the minimal reproduction case.",
    ),
    agentNode(
      "code-analysis",
      "Code Analysis",
      "Analyze the codebase to identify the root cause of the bug. Trace the execution path and pinpoint the faulty logic.",
      ["reproducer"],
    ),
    agentNode(
      "log-analysis",
      "Log Analysis",
      "Analyze any logs or stack traces provided. Identify error patterns, frequency, and affected components.",
      ["reproducer"],
    ),
    mergeNode("merge-analysis", "Merge Analysis", ["code-analysis", "log-analysis"]),
    agentNode(
      "fix-proposer",
      "Fix Proposer",
      "Propose the minimal fix based on the analysis. Include the specific file(s), line(s), and code change(s) required.",
      ["merge-analysis"],
    ),
    agentNode(
      "verifier",
      "Fix Verifier",
      "Verify the proposed fix addresses the root cause without regressions. Check edge cases and related code paths.",
      ["fix-proposer", "merge-analysis"],
    ),
  ],
  edges: [
    { from: "trigger", to: "reproducer" },
    { from: "reproducer", to: ["code-analysis", "log-analysis"] },
    { from: "code-analysis", to: "merge-analysis" },
    { from: "log-analysis", to: "merge-analysis" },
    { from: "merge-analysis", to: "fix-proposer" },
    { from: "fix-proposer", to: "verifier" },
  ],
}

// ─── 3. Release Prep ──────────────────────────────────────────────────────────

export const releasePrepWorkflow: Workflow = {
  id: "release-prep",
  name: "Release Prep",
  description: "Generate changelog, check coverage and security, score release readiness, require human approval.",
  isBuiltIn: true,
  isPublic: true,
  version: "1.0.0",
  createdAt: new Date("2024-01-01"),
  triggers: [{ type: "manual" }],
  nodes: [
    triggerNode("trigger", "Manual Trigger"),
    agentNode(
      "changelog-gen",
      "Changelog Generator",
      "Generate a user-facing changelog for this release based on the commits and pull requests since the last release. Group by feature, fix, and breaking change.",
    ),
    agentNode(
      "coverage-check",
      "Coverage Check",
      "Identify which changed files have no corresponding test coverage. Return JSON: { uncoveredFiles: string[] }",
    ),
    agentNode(
      "security-scan",
      "Security Scan",
      "You are a security engineer. Scan the provided code diff for: OWASP Top 10 patterns, hardcoded secrets, dependency vulnerabilities, injection patterns. Return JSON: { findings: [{severity, file, line, description, fix}] }",
    ),
    mergeNode("merge-results", "Merge Results", ["changelog-gen", "coverage-check", "security-scan"]),
    agentNode(
      "readiness-scorer",
      "Readiness Scorer",
      "Score release readiness 0-100 based on: test coverage, security findings, open critical bugs. Return JSON: { score: number, breakdown: object, blockingIssues: string[] }",
      ["merge-results"],
    ),
    humanCheckpointNode(
      "human-approval",
      "Human Approval",
      "Review release readiness score and approve/reject",
    ),
  ],
  edges: [
    { from: "trigger", to: ["changelog-gen", "coverage-check", "security-scan"] },
    { from: "changelog-gen", to: "merge-results" },
    { from: "coverage-check", to: "merge-results" },
    { from: "security-scan", to: "merge-results" },
    { from: "merge-results", to: "readiness-scorer" },
    { from: "readiness-scorer", to: "human-approval" },
  ],
}

// ─── 4. Nightly Security Scan ─────────────────────────────────────────────────

export const nightlySecurityScanWorkflow: Workflow = {
  id: "nightly-security-scan",
  name: "Nightly Security Scan",
  description: "Parallel dependency, SAST, and secret scanning with a consolidated risk report.",
  isBuiltIn: true,
  isPublic: true,
  version: "1.0.0",
  createdAt: new Date("2024-01-01"),
  triggers: [{ type: "scheduled", cron: "0 2 * * *" }],
  nodes: [
    triggerNode("trigger", "Scheduled Trigger"),
    agentNode(
      "dep-scan",
      "Dependency Scan",
      "Scan all package manifests (package.json, requirements.txt, go.mod, Gemfile, etc.) for known vulnerable dependencies using the provided context. Return JSON: { vulnerabilities: [{pkg, version, cve, severity, fixVersion}] }",
    ),
    agentNode(
      "sast-scan",
      "SAST Scan",
      "Perform static application security testing on the codebase. Check for: injection flaws, insecure deserialization, broken access control, cryptographic failures, security misconfigurations. Return JSON: { findings: [{severity, file, line, cwe, description}] }",
    ),
    agentNode(
      "secret-scan",
      "Secret Scan",
      "Scan the entire codebase for exposed secrets: API keys, tokens, passwords, private keys, connection strings. Return JSON: { secrets: [{file, line, type, preview}] }",
    ),
    mergeNode("merge-scans", "Merge Scans", ["dep-scan", "sast-scan", "secret-scan"]),
    agentNode(
      "risk-report",
      "Risk Report",
      "Summarize all security findings into a prioritized report. Group by severity (critical/high/medium/low). Highlight items requiring immediate action. Return a structured markdown report.",
      ["merge-scans"],
    ),
  ],
  edges: [
    { from: "trigger", to: ["dep-scan", "sast-scan", "secret-scan"] },
    { from: "dep-scan", to: "merge-scans" },
    { from: "sast-scan", to: "merge-scans" },
    { from: "secret-scan", to: "merge-scans" },
    { from: "merge-scans", to: "risk-report" },
  ],
}

export const BUILT_IN_WORKFLOWS: Workflow[] = [
  prReviewWorkflow,
  bugInvestigationWorkflow,
  releasePrepWorkflow,
  nightlySecurityScanWorkflow,
]
