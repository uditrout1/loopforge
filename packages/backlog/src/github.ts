import { createHmac, timingSafeEqual } from "node:crypto"
import type { Ticket, TicketSource } from "@devos/core"
import { classifyTicket } from "./classifier.js"
import { scorePriority } from "./prioritizer.js"

// ─── GitHub payload types ─────────────────────────────────────────────────────

export type GitHubIssueAction = "opened" | "closed" | "reopened" | "edited"
export type GitHubPrAction = "opened" | "closed" | "reopened" | "edited" | "merged"

export interface GitHubLabel {
  name: string
}

export interface GitHubIssue {
  number: number
  title: string
  body: string | null
  html_url: string
  labels: GitHubLabel[]
}

export interface GitHubPullRequest {
  number: number
  title: string
  body: string | null
  html_url: string
  merged_at: string | null
}

export interface GitHubRepository {
  full_name: string
}

export interface GitHubIssuePayload {
  action: GitHubIssueAction
  issue: GitHubIssue
  repository: GitHubRepository
}

export interface GitHubPrPayload {
  action: GitHubPrAction
  pull_request: GitHubPullRequest
  repository: GitHubRepository
}

// ─── Webhook signature verification ──────────────────────────────────────────

export function verifyGitHubWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    // Buffers of different lengths throw — treat as mismatch
    return false
  }
}

// ─── Issue event parser ───────────────────────────────────────────────────────

export function parseGitHubIssueEvent(
  payload: GitHubIssuePayload,
  projectId: string,
): Ticket | null {
  if (payload.action !== "opened" && payload.action !== "reopened") {
    return null
  }

  const { issue, repository } = payload
  const body = issue.body ?? ""
  const { type } = classifyTicket(issue.title, body)

  const now = new Date()

  const source: TicketSource = {
    type: "github",
    ref: `${repository.full_name}#${issue.number}`,
    capturedAt: now,
  }

  const draft: Ticket = {
    id: `gh-${repository.full_name.replace("/", "-")}-${issue.number}`,
    projectId,
    externalId: String(issue.number),
    externalUrl: issue.html_url,
    title: issue.title,
    ...(body ? { description: body } : {}),
    type,
    status: "open",
    priorityScore: 0,
    priorityReason: "",
    sources: [source],
    linkedFiles: [],
    linkedPrs: [],
    manualPriorityOverride: false,
    createdBy: "stakeholder",
    createdAt: now,
    updatedAt: now,
  }

  const { score, reason } = scorePriority(draft)
  return { ...draft, priorityScore: score, priorityReason: reason }
}

// ─── PR event parser ──────────────────────────────────────────────────────────

export function parseGitHubPrEvent(payload: GitHubPrPayload): {
  action: string
  prNumber: number
  body: string
  mergedAt?: Date
} | null {
  const { pull_request, action } = payload

  const mergedAt = pull_request.merged_at ? new Date(pull_request.merged_at) : undefined
  return {
    action,
    prNumber: pull_request.number,
    body: pull_request.body ?? "",
    ...(mergedAt !== undefined ? { mergedAt } : {}),
  }
}
