import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { loadSessionContext, formatContextAsSystemPrompt, formatContextAsUserMessage } from "@devos/brain"
import { route } from "@devos/router"
import { recommendSkills } from "@devos/skills"
import type { BrainStore } from "@devos/brain"
import type { RouterConfig } from "@devos/router"
import type { Message } from "@devos/core"

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
) {
  const app = new Hono()

  app.post("/", async (c) => {
    const { projectId, firstMessage } = await c.req.json<{
      projectId: string
      firstMessage?: string
    }>()

    const ctx = await loadSessionContext(projectId, store, firstMessage)
    const systemPrompt = formatContextAsSystemPrompt(ctx)
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

    return c.json({
      content: response.content,
      model: response.model,
      provider: response.provider,
      costUsd: response.costUsd,
      routingDecision: response.routingDecision,
      recommendedSkills: skillRecs,
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
    const deleted = sessions.delete(c.req.param("id"))
    if (!deleted) return c.json({ error: "Session not found" }, 404)
    return c.json({ ok: true })
  })

  return app
}
