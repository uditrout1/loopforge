import { Hono } from "hono"
import { decomposeEpic, tasksToTickets } from "@devos/workflows"
import type { BrainStore } from "@devos/brain"
import type { BacklogService } from "@devos/backlog"
import type { RouterConfig } from "@devos/router"

export function createDecomposeRouter(
  brainStore: BrainStore,
  backlogService: BacklogService,
  routerConfig: RouterConfig,
): Hono {
  const app = new Hono()

  // POST /decompose/:projectId
  // Body: { epicTitle: string, epicDescription: string, stackDescription?: string }
  // Returns: { tasks: Ticket[], dependencyNotes: string }
  app.post("/:projectId", async (c) => {
    const projectId = c.req.param("projectId")

    // 1. Get project from store
    const project = await brainStore.getProject(projectId)
    if (!project) {
      return c.json({ error: "Project not found" }, 404)
    }

    const body = await c.req.json<{
      epicTitle: string
      epicDescription: string
      stackDescription?: string
    }>()

    if (!body.epicTitle || !body.epicDescription) {
      return c.json({ error: "epicTitle and epicDescription are required" }, 400)
    }

    // 2. Get file list from brain store
    const chunks = await brainStore.searchChunks(projectId, "", 100)
    const existingFiles = [...new Set(chunks.map((ch) => ch.filePath))]

    // 3. Get open tickets for dedup
    const openTickets = await backlogService.getPrioritizedBacklog(projectId)
    const openTicketTitles = openTickets.map((t) => t.title)

    // Derive stack description from project or body override
    const stackDescription =
      body.stackDescription ??
      [
        ...project.stack.languages,
        ...project.stack.frameworks,
        ...project.stack.databases,
        ...project.stack.infrastructure,
      ]
        .filter(Boolean)
        .join(", ") ||
      "TypeScript"

    // 4. Call decomposeEpic
    const result = await decomposeEpic(
      {
        projectId,
        epicTitle: body.epicTitle,
        epicDescription: body.epicDescription,
        stackDescription,
        existingFiles,
        openTicketTitles,
      },
      routerConfig,
    )

    // 5. Convert to Ticket objects
    const tickets = tasksToTickets(result, projectId)

    // 6. Save each ticket
    for (const ticket of tickets) {
      await backlogService.store.upsertTicket(ticket)
    }

    // 7. Return tasks and dependency notes
    return c.json({ tasks: tickets, dependencyNotes: result.dependencyNotes }, 201)
  })

  return app
}
