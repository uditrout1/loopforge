import { Hono } from "hono"
import type { Context } from "hono"
import { randomUUID } from "node:crypto"
import type { Goal, GoalTicketRef } from "@loopforge/core"
import type { RouterConfig } from "@loopforge/router"
import type { GoalStore } from "./store.js"
import { decomposeGoal, computeProgress, detectBlockers } from "./decomposer.js"

function requireParam(c: Context, name: string): string | null {
  const val = c.req.param(name)
  return val ?? null
}

function refreshGoal(goal: Goal): Goal {
  const progressPercent = computeProgress(goal.tickets)
  const blockers = detectBlockers(goal.tickets)
  return { ...goal, progressPercent, blockers, updatedAt: new Date() }
}

export function createGoalsRouter(store: GoalStore, routerConfig: RouterConfig): Hono {
  const app = new Hono()

  // GET /:projectId — list goals
  app.get("/:projectId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const goals = await store.listGoals(projectId)
    return c.json(goals)
  })

  // POST /:projectId — create goal
  app.post("/:projectId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)

    const body = await c.req.json<{
      title: string
      description: string
      targetDate?: string
      autoDecompose?: boolean
    }>()

    const title = body.title
    const description = body.description
    if (!title || !description) {
      return c.json({ error: "title and description are required" }, 400)
    }

    const now = new Date()
    const targetDate = body.targetDate ? new Date(body.targetDate) : undefined

    const goal: Goal = {
      id: randomUUID(),
      projectId,
      title,
      description,
      status: "active",
      targetDate: targetDate,
      tickets: [],
      progressPercent: 0,
      blockers: [],
      decomposedAt: undefined,
      decomposedBy: "manual",
      createdAt: now,
      updatedAt: now,
    }

    const autoDecompose = body.autoDecompose !== false

    if (autoDecompose) {
      try {
        const decomposition = await decomposeGoal(goal, routerConfig)
        const tickets: GoalTicketRef[] = decomposition.tickets.map((t) => ({
          ticketId: randomUUID(),
          title: t.title,
          status: "open" as const,
          isBlocker: false,
        }))
        goal.tickets = tickets
        goal.decomposedAt = new Date()
        goal.decomposedBy = "claude"
        goal.progressPercent = computeProgress(tickets)
        goal.blockers = detectBlockers(tickets)
      } catch {
        // decomposition failed — save goal without tickets
      }
    }

    await store.saveGoal(goal)
    return c.json(goal, 201)
  })

  // GET /:projectId/:goalId — get single goal
  app.get("/:projectId/:goalId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const goalId = requireParam(c, "goalId")
    if (!projectId || !goalId) return c.json({ error: "projectId and goalId required" }, 400)
    const goal = await store.getGoal(projectId, goalId)
    if (!goal) return c.json({ error: "Goal not found" }, 404)
    return c.json(goal)
  })

  // PATCH /:projectId/:goalId — update status
  app.patch("/:projectId/:goalId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const goalId = requireParam(c, "goalId")
    if (!projectId || !goalId) return c.json({ error: "projectId and goalId required" }, 400)
    const goal = await store.getGoal(projectId, goalId)
    if (!goal) return c.json({ error: "Goal not found" }, 404)
    const body = await c.req.json<{ status?: string }>()
    const updated = refreshGoal({
      ...goal,
      ...(body.status !== undefined ? { status: body.status as Goal["status"] } : {}),
    })
    await store.saveGoal(updated)
    return c.json(updated)
  })

  // POST /:projectId/:goalId/tickets — add ticket ref
  app.post("/:projectId/:goalId/tickets", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const goalId = requireParam(c, "goalId")
    if (!projectId || !goalId) return c.json({ error: "projectId and goalId required" }, 400)
    const goal = await store.getGoal(projectId, goalId)
    if (!goal) return c.json({ error: "Goal not found" }, 404)
    const body = await c.req.json<{
      ticketId: string
      title: string
      status: GoalTicketRef["status"]
      isBlocker?: boolean
    }>()
    const ref: GoalTicketRef = {
      ticketId: body.ticketId,
      title: body.title,
      status: body.status ?? "open",
      isBlocker: body.isBlocker ?? false,
    }
    const updated = refreshGoal({ ...goal, tickets: [...goal.tickets, ref] })
    await store.saveGoal(updated)
    return c.json(updated)
  })

  // PATCH /:projectId/:goalId/tickets/:ticketId — update ticket status
  app.patch("/:projectId/:goalId/tickets/:ticketId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const goalId = requireParam(c, "goalId")
    const ticketId = requireParam(c, "ticketId")
    if (!projectId || !goalId || !ticketId) {
      return c.json({ error: "projectId, goalId, ticketId required" }, 400)
    }
    const goal = await store.getGoal(projectId, goalId)
    if (!goal) return c.json({ error: "Goal not found" }, 404)
    const body = await c.req.json<{ status?: string; isBlocker?: boolean }>()
    const tickets = goal.tickets.map((t) => {
      if (t.ticketId !== ticketId) return t
      return {
        ...t,
        ...(body.status !== undefined ? { status: body.status as GoalTicketRef["status"] } : {}),
        ...(body.isBlocker !== undefined ? { isBlocker: body.isBlocker } : {}),
      }
    })
    const updated = refreshGoal({ ...goal, tickets })
    await store.saveGoal(updated)
    return c.json(updated)
  })

  // DELETE /:projectId/:goalId — delete goal
  app.delete("/:projectId/:goalId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const goalId = requireParam(c, "goalId")
    if (!projectId || !goalId) return c.json({ error: "projectId and goalId required" }, 400)
    const deleted = await store.deleteGoal(projectId, goalId)
    if (!deleted) return c.json({ error: "Goal not found" }, 404)
    return c.json({ deleted: true })
  })

  // POST /:projectId/:goalId/decompose — re-decompose with Claude
  app.post("/:projectId/:goalId/decompose", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const goalId = requireParam(c, "goalId")
    if (!projectId || !goalId) return c.json({ error: "projectId and goalId required" }, 400)
    const goal = await store.getGoal(projectId, goalId)
    if (!goal) return c.json({ error: "Goal not found" }, 404)
    const decomposition = await decomposeGoal(goal, routerConfig)
    const tickets: GoalTicketRef[] = decomposition.tickets.map((t) => ({
      ticketId: randomUUID(),
      title: t.title,
      status: "open" as const,
      isBlocker: false,
    }))
    const updated = refreshGoal({
      ...goal,
      tickets,
      decomposedAt: new Date(),
      decomposedBy: "claude",
    })
    await store.saveGoal(updated)
    return c.json(updated)
  })

  return app
}
