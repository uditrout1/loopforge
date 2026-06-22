import { randomUUID } from "node:crypto"
import type { Ticket, TicketType, TicketStatus } from "@loopforge/core"
import type { TicketStore } from "./store.js"
import { classifyTicket } from "./classifier.js"
import { scorePriority } from "./prioritizer.js"
import {
  parseGitHubIssueEvent,
  parseGitHubPrEvent,
  type GitHubIssuePayload,
  type GitHubPrPayload,
} from "./github.js"

// ─── Regex for issue references in PR bodies ──────────────────────────────────
// Matches: closes #42, fixes #17, resolves #5, etc.
const ISSUE_REF_RE = /(?:closes?|fixes?|resolves?)\s+#(\d+)/gi

// ─── Similarity helpers ───────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 2),
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  const intersection = new Set([...a].filter((w) => b.has(w)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}

// ─── BacklogService ───────────────────────────────────────────────────────────

export class BacklogService {
  readonly store: TicketStore

  constructor(store: TicketStore) {
    this.store = store
  }

  async updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
    await this.store.updateTicketStatus(id, status)
  }

  // Ingest a GitHub issue event
  async ingestGitHubIssue(
    payload: GitHubIssuePayload,
    projectId: string,
  ): Promise<Ticket | null> {
    const ticket = parseGitHubIssueEvent(payload, projectId)
    if (!ticket) return null
    await this.store.upsertTicket(ticket)
    return ticket
  }

  // Handle a GitHub PR merge — resolve tickets referenced in PR body
  async handlePrMerge(
    payload: GitHubPrPayload,
    projectId: string,
  ): Promise<string[]> {
    const pr = parseGitHubPrEvent(payload)
    if (!pr || !pr.mergedAt) return []

    // Extract referenced issue numbers from PR body
    const referencedIssueNumbers = new Set<number>()
    let match: RegExpExecArray | null
    const re = new RegExp(ISSUE_REF_RE.source, ISSUE_REF_RE.flags)
    while ((match = re.exec(pr.body)) !== null) {
      const num = parseInt(match[1] ?? "", 10)
      if (!isNaN(num)) referencedIssueNumbers.add(num)
    }

    if (referencedIssueNumbers.size === 0) return []

    const tickets = await this.store.listTickets(projectId)
    const resolvedIds: string[] = []

    for (const ticket of tickets) {
      if (ticket.status === "resolved" || ticket.status === "closed") continue
      if (!ticket.externalId) continue
      const externalNum = parseInt(ticket.externalId, 10)
      if (referencedIssueNumbers.has(externalNum)) {
        await this.store.updateTicketStatus(ticket.id, "resolved")
        resolvedIds.push(ticket.id)
      }
    }

    return resolvedIds
  }

  // Get prioritized backlog for a project (highest score first)
  async getPrioritizedBacklog(projectId: string): Promise<Ticket[]> {
    const tickets = await this.store.listTickets(projectId)

    // Re-score and update each ticket
    const scored: Ticket[] = []
    for (const ticket of tickets) {
      const { score, reason } = scorePriority(ticket)
      const updated: Ticket = { ...ticket, priorityScore: score, priorityReason: reason }
      await this.store.upsertTicket(updated)
      scored.push(updated)
    }

    return scored.sort((a, b) => b.priorityScore - a.priorityScore)
  }

  // Manually create a ticket
  async createTicket(
    projectId: string,
    title: string,
    description: string,
    type: TicketType,
  ): Promise<Ticket> {
    const now = new Date()
    const draft: Ticket = {
      id: randomUUID(),
      projectId,
      title,
      ...(description ? { description } : {}),
      type,
      status: "open",
      priorityScore: 0,
      priorityReason: "",
      sources: [{ type: "manual", ref: "manual-entry", capturedAt: now }],
      linkedFiles: [],
      linkedPrs: [],
      manualPriorityOverride: false,
      createdBy: "developer",
      createdAt: now,
      updatedAt: now,
    }

    const { score, reason } = scorePriority(draft)
    const ticket: Ticket = { ...draft, priorityScore: score, priorityReason: reason }
    await this.store.upsertTicket(ticket)
    return ticket
  }

  // Health check: stale tickets and duplicate candidates
  async healthCheck(projectId: string): Promise<{
    staleTickets: Ticket[]
    duplicateCandidates: Array<[Ticket, Ticket]>
  }> {
    const tickets = await this.store.listTickets(projectId)
    const now = new Date()
    const staleThresholdMs = 30 * 24 * 60 * 60 * 1000 // 30 days

    // Stale = open or in_progress, no update in >30 days
    const staleTickets = tickets.filter((t) => {
      const isActive = t.status === "open" || t.status === "in_progress"
      const isStale = now.getTime() - t.updatedAt.getTime() > staleThresholdMs
      return isActive && isStale
    })

    // Duplicate candidates: active tickets with Jaccard title similarity > 0.6
    const activeTickets = tickets.filter(
      (t) => t.status === "open" || t.status === "in_progress",
    )
    const duplicateCandidates: Array<[Ticket, Ticket]> = []
    const tokenCache = new Map<string, Set<string>>()

    for (let i = 0; i < activeTickets.length; i++) {
      const a = activeTickets[i]
      if (!a) continue
      if (!tokenCache.has(a.id)) tokenCache.set(a.id, tokenize(a.title))

      for (let j = i + 1; j < activeTickets.length; j++) {
        const b = activeTickets[j]
        if (!b) continue
        if (!tokenCache.has(b.id)) tokenCache.set(b.id, tokenize(b.title))

        const tokensA = tokenCache.get(a.id)!
        const tokensB = tokenCache.get(b.id)!
        const similarity = jaccardSimilarity(tokensA, tokensB)

        if (similarity > 0.6) {
          duplicateCandidates.push([a, b])
        }
      }
    }

    return { staleTickets, duplicateCandidates }
  }
}

// ─── Convenience re-export of classifier for callers that don't need the full service ───
export { classifyTicket }
