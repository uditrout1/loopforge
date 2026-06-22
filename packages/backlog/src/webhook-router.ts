import { Hono } from "hono"
import type { TicketStatus, TicketType } from "@loopforge/core"
import type { BacklogService } from "./backlog-service.js"
import { verifyGitHubWebhookSignature, type GitHubIssuePayload, type GitHubPrPayload } from "./github.js"

// ─── Router factory ───────────────────────────────────────────────────────────

export function createBacklogRouter(service: BacklogService, webhookSecret?: string): Hono {
  const router = new Hono()

  // POST /webhook/github — ingest GitHub issue or PR events
  router.post("/webhook/github", async (c) => {
    const rawBody = await c.req.text()
    const eventType = c.req.header("X-GitHub-Event")

    // Verify signature when a secret is configured
    if (webhookSecret) {
      const signature = c.req.header("X-Hub-Signature-256") ?? ""
      if (!verifyGitHubWebhookSignature(rawBody, signature, webhookSecret)) {
        return c.json({ error: "Invalid webhook signature" }, 401)
      }
    }

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    const projectId = c.req.query("projectId")
    if (!projectId) {
      return c.json({ error: "Missing required query parameter: projectId" }, 400)
    }

    if (eventType === "issues") {
      const ticket = await service.ingestGitHubIssue(payload as GitHubIssuePayload, projectId)
      if (!ticket) {
        return c.json({ message: "Event ignored (action not actionable)" }, 200)
      }
      return c.json({ ticket }, 201)
    }

    if (eventType === "pull_request") {
      const prPayload = payload as GitHubPrPayload
      if (prPayload.action === "closed" && prPayload.pull_request.merged_at) {
        const resolvedIds = await service.handlePrMerge(prPayload, projectId)
        return c.json({ resolvedTicketIds: resolvedIds }, 200)
      }
      return c.json({ message: "PR event ignored (not a merge)" }, 200)
    }

    return c.json({ message: `Unhandled event type: ${eventType ?? "unknown"}` }, 200)
  })

  // GET /tickets/:projectId — return prioritized backlog
  router.get("/tickets/:projectId", async (c) => {
    const projectId = c.req.param("projectId")
    const statusParam = c.req.query("status") as TicketStatus | undefined
    const backlog = await service.getPrioritizedBacklog(projectId)

    const filtered = statusParam
      ? backlog.filter((t) => t.status === statusParam)
      : backlog

    return c.json({ tickets: filtered, count: filtered.length })
  })

  // POST /tickets/:projectId — create ticket manually
  router.post("/tickets/:projectId", async (c) => {
    const projectId = c.req.param("projectId")

    let body: { title?: unknown; description?: unknown; type?: unknown }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    if (typeof body.title !== "string" || !body.title) {
      return c.json({ error: "Missing required field: title" }, 400)
    }

    const validTypes: TicketType[] = ["feature", "bug", "debt", "security"]
    const type: TicketType =
      typeof body.type === "string" && validTypes.includes(body.type as TicketType)
        ? (body.type as TicketType)
        : "feature"

    const ticket = await service.createTicket(
      projectId,
      body.title,
      typeof body.description === "string" ? body.description : "",
      type,
    )

    return c.json({ ticket }, 201)
  })

  // GET /tickets/:projectId/health — backlog health check
  router.get("/tickets/:projectId/health", async (c) => {
    const projectId = c.req.param("projectId")
    const { staleTickets, duplicateCandidates } = await service.healthCheck(projectId)

    return c.json({
      staleTickets,
      duplicateCandidates: duplicateCandidates.map(([a, b]) => ({
        ticketA: a,
        ticketB: b,
      })),
      summary: {
        staleCount: staleTickets.length,
        duplicatePairCount: duplicateCandidates.length,
      },
    })
  })

  // PATCH /tickets/:id/status — update ticket status
  router.patch("/tickets/:id/status", async (c) => {
    const id = c.req.param("id")

    let body: { status?: unknown }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    const validStatuses: TicketStatus[] = ["open", "in_progress", "resolved", "closed"]
    if (typeof body.status !== "string" || !validStatuses.includes(body.status as TicketStatus)) {
      return c.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        400,
      )
    }

    try {
      await service.updateTicketStatus(id, body.status as TicketStatus)
      const ticket = await service.store.getTicket(id)
      return c.json({ ticket })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return c.json({ error: message }, 404)
    }
  })

  return router
}
