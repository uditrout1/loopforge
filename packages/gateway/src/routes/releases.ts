import { Hono } from "hono"
import type { Context } from "hono"
import { randomUUID } from "node:crypto"
import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"
import type { GraphStore } from "@loopforge/graph"
import { ingestRelease } from "@loopforge/graph"

export interface Release {
  id: string
  projectId: string
  version: string
  name: string
  status: "draft" | "published"
  changelog: string
  mergedPrIds: string[]
  resolvedTicketIds: string[]
  generatedAt: Date
  publishedAt: Date | undefined
  createdAt: Date
}

function requireParam(c: Context, name: string): string | null {
  const val = c.req.param(name)
  return val ?? null
}

export function createReleasesRouter(routerConfig: RouterConfig, graphStore?: GraphStore): Hono {
  const app = new Hono()
  const releases = new Map<string, Release>()

  app.get("/:projectId", (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const list = [...releases.values()]
      .filter(r => r.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return c.json(list)
  })

  app.get("/:projectId/:releaseId", (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const releaseId = requireParam(c, "releaseId")
    if (!projectId || !releaseId) return c.json({ error: "projectId and releaseId required" }, 400)
    const release = releases.get(`${projectId}:${releaseId}`)
    if (!release) return c.json({ error: "Release not found" }, 404)
    return c.json(release)
  })

  app.post("/:projectId/generate", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)

    const body = await c.req.json<{
      version: string
      name: string
      prNumbers?: string[]
      ticketIds?: string[]
      context?: string
    }>()

    const { version, name } = body
    const prNumbers = body.prNumbers ?? []
    const ticketIds = body.ticketIds ?? []
    const context = body.context ?? ""

    if (!version || !name) return c.json({ error: "version and name are required" }, 400)

    const prList = prNumbers.length > 0 ? prNumbers.join(", ") : "none specified"
    const ticketList = ticketIds.length > 0 ? ticketIds.join(", ") : "none specified"

    const prompt = `You are a technical writer. Generate a release changelog for ${name} (${version}).

Merged PRs: ${prList}
Resolved tickets: ${ticketList}
Additional context: ${context || "none"}

Format as markdown with these sections (only include a section if relevant):
## What's New
## Bug Fixes
## Performance
## Breaking Changes
## Dependencies

Rules:
- Each item is one line starting with a dash
- Be specific and concise — describe user-visible changes
- Skip empty sections entirely
- Use past tense ("Added X", "Fixed Y", "Improved Z")`

    let changelog = ""
    try {
      const response = await route(
        { messages: [{ role: "user", content: prompt }], projectId, sessionId: randomUUID(), dataClassification: "internal", preferredCapability: "medium" },
        routerConfig,
      )
      changelog = response.content
    } catch {
      changelog = `## ${name} (${version})\n\n- Release created on ${new Date().toISOString().slice(0, 10)}`
    }

    const now = new Date()
    const release: Release = {
      id: randomUUID(),
      projectId,
      version,
      name,
      status: "draft",
      changelog,
      mergedPrIds: prNumbers,
      resolvedTicketIds: ticketIds,
      generatedAt: now,
      publishedAt: undefined,
      createdAt: now,
    }

    releases.set(`${projectId}:${release.id}`, release)
    return c.json(release, 201)
  })

  app.patch("/:projectId/:releaseId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const releaseId = requireParam(c, "releaseId")
    if (!projectId || !releaseId) return c.json({ error: "projectId and releaseId required" }, 400)
    const key = `${projectId}:${releaseId}`
    const release = releases.get(key)
    if (!release) return c.json({ error: "Release not found" }, 404)
    const body = await c.req.json<{ changelog?: string; name?: string }>()
    if (body.changelog !== undefined) release.changelog = body.changelog
    if (body.name !== undefined) release.name = body.name
    releases.set(key, release)
    return c.json(release)
  })

  app.post("/:projectId/:releaseId/publish", (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const releaseId = requireParam(c, "releaseId")
    if (!projectId || !releaseId) return c.json({ error: "projectId and releaseId required" }, 400)
    const key = `${projectId}:${releaseId}`
    const release = releases.get(key)
    if (!release) return c.json({ error: "Release not found" }, 404)
    release.status = "published"
    release.publishedAt = new Date()
    releases.set(key, release)
    if (graphStore) {
      ingestRelease({
        id: release.id,
        projectId: release.projectId,
        version: release.version,
        name: release.name,
        status: release.status,
        changelog: release.changelog,
        mergedPrIds: release.mergedPrIds,
        resolvedTicketIds: release.resolvedTicketIds,
        publishedAt: release.publishedAt,
        createdAt: release.createdAt,
      }, graphStore).catch(() => {})
    }
    return c.json(release)
  })

  app.delete("/:projectId/:releaseId", (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const releaseId = requireParam(c, "releaseId")
    if (!projectId || !releaseId) return c.json({ error: "projectId and releaseId required" }, 400)
    const deleted = releases.delete(`${projectId}:${releaseId}`)
    if (!deleted) return c.json({ error: "Release not found" }, 404)
    return c.json({ deleted: true })
  })

  return app
}
