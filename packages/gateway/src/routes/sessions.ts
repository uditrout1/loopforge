import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { loadSessionContext, formatContextAsSystemPrompt, formatContextAsUserMessage, assemblePackContext } from "@devos/brain"
import { route } from "@devos/router"
import { recommendSkills, detectCapabilityGaps } from "@devos/skills"
import type { BrainStore } from "@devos/brain"
import type { RouterConfig } from "@devos/router"
import type { Message } from "@devos/core"
import type { ADRService } from "@devos/adr"

interface SessionState {
  projectId: string
  messages: Message[]
  activeSkillIds: string[]
  totalCostUsd: number
  createdAt: Date
}

const sessions = new Map<string, SessionState>()

export function createSessionsRouter(
  store: BrainStore,
  routerConfig: RouterConfig,
  adrService?: ADRService,
) {
  const app = new Hono()

  app.post("/", async (c) => {
    const { projectId, firstMessage, packId } = await c.req.json<{
      projectId: string
      firstMessage?: string
      packId?: string
    }>()

    const ctx = await loadSessionContext(projectId, store, firstMessage)
    const systemPrompt = formatContextAsSystemPrompt(ctx)

    // If a packId was provided, replace the generic chunk search with pack-specific chunks.
    if (packId !== undefined) {
      const packs = await store.getPacks(projectId)
      const pack = packs.find((p) => p.id === packId)
      if (pack) {
        ctx.relevantChunks = await assemblePackContext(pack, store, firstMessage)
      }
    }

    // Fix 5: file chunks go in a user-role message, not the system prompt,
    // so injected instructions in repo files can't act as system directives.
    const contextMessage = formatContextAsUserMessage(ctx)
    const sessionId = randomUUID()

    const recommendations = await recommendSkills(firstMessage ?? "", 3)

    const initialMessages: Message[] = [{ role: "system", content: systemPrompt }]
    if (contextMessage !== undefined) initialMessages.push(contextMessage)

    sessions.set(sessionId, {
      projectId,
      messages: initialMessages,
      activeSkillIds: [],
      totalCostUsd: 0,
      createdAt: new Date(),
    })

    return c.json({
      sessionId,
      contextLoaded: {
        project: ctx.project.name,
        stack: ctx.project.stack,
        openTickets: ctx.openTickets.length,
        relevantChunks: ctx.relevantChunks.length,
        lastSessionSummary: !!ctx.recentSummary,
      },
      recommendedSkills: recommendations,
    })
  })

  app.post("/:id/messages", async (c) => {
    const sessionId = c.req.param("id")
    const session = sessions.get(sessionId)

    if (!session) return c.json({ error: "Session not found" }, 404)

    const { content } = await c.req.json<{ content: string }>()
    session.messages.push({ role: "user", content })

    const project = await store.getProject(session.projectId)
    if (!project) return c.json({ error: "Project not found" }, 404)

    const response = await route(
      {
        messages: session.messages,
        projectId: session.projectId,
        sessionId,
        dataClassification: project.dataClassification,
      },
      routerConfig,
    )

    session.messages.push({ role: "assistant", content: response.content })
    session.totalCostUsd += response.costUsd

    const skillRecs = await recommendSkills(content, 3)

    const recentMessages = session.messages.slice(-5)
    const capabilityGaps = detectCapabilityGaps(
      session.projectId,
      sessionId,
      recentMessages,
      session.activeSkillIds,
    )

    return c.json({
      content: response.content,
      model: response.model,
      provider: response.provider,
      costUsd: response.costUsd,
      routingDecision: response.routingDecision,
      recommendedSkills: skillRecs,
      capabilityGaps,
      sessionTotalCostUsd: session.totalCostUsd,
    })
  })

  app.get("/:id", (c) => {
    const session = sessions.get(c.req.param("id"))
    if (!session) return c.json({ error: "Session not found" }, 404)

    return c.json({
      projectId: session.projectId,
      messageCount: session.messages.length,
      activeSkillIds: session.activeSkillIds,
      totalCostUsd: session.totalCostUsd,
      createdAt: session.createdAt,
    })
  })

  app.delete("/:id", (c) => {
    const sessionId = c.req.param("id")
    const session = sessions.get(sessionId)
    if (!session) return c.json({ error: "Session not found" }, 404)

    // Fire-and-forget: extract decisions from session transcript before deleting
    if (adrService !== undefined) {
      const { projectId, messages } = session
      void adrService.captureFromSession(projectId, sessionId, messages)
    }

    sessions.delete(sessionId)
    return c.json({ ok: true })
  })

  return app
}
