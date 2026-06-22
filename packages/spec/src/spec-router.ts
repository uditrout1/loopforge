import { Hono } from "hono"
import type { Context } from "hono"
import { randomUUID } from "node:crypto"
import type { RouterConfig } from "@devos/router"
import type { SpecType } from "@devos/core"
import type { SpecStore } from "./store.js"
import { generatePRD, generateArchitectureDoc, generateTechnicalSpec } from "./generator.js"
import { submitForReview, approveSpec, rejectSpec } from "./approval.js"
import { extractTicketRefs, extractAdrRefs } from "./traceability.js"

type GenerateBody = {
  type: SpecType
  title: string
  description: string
  projectContext?: string
  stackDescription?: string
  prdContent?: string
  architectureContent?: string
}

type ApproveBody = {
  approvedBy: string
}

type RejectBody = {
  rejectedBy: string
  reason: string
}

type PatchBody = {
  content?: string
  status?: string
  title?: string
}

function getParam(c: Context, name: string): string | null {
  const val = c.req.param(name)
  return val ?? null
}

export function createSpecRouter(store: SpecStore, routerConfig: RouterConfig): Hono {
  const app = new Hono()

  // GET /specs/:projectId — list specs
  app.get("/:projectId", async (c: Context) => {
    const projectId = getParam(c, "projectId")
    if (!projectId) return c.json({ error: "Missing projectId" }, 400)

    const typeParam = c.req.query("type")

    let type: SpecType | undefined
    if (typeParam === "prd" || typeParam === "architecture" || typeParam === "technical_spec") {
      type = typeParam
    } else if (typeParam !== undefined && typeParam !== "") {
      return c.json({ error: `Invalid type: ${typeParam}` }, 400)
    }

    const specs = await store.listSpecs(projectId, type)
    return c.json({ specs })
  })

  // GET /specs/:projectId/:id — get spec
  app.get("/:projectId/:id", async (c: Context) => {
    const id = getParam(c, "id")
    if (!id) return c.json({ error: "Missing id" }, 400)

    const spec = await store.getSpec(id)
    if (!spec) return c.json({ error: "Spec not found" }, 404)
    return c.json({ spec })
  })

  // POST /specs/:projectId/generate — generate a draft spec
  app.post("/:projectId/generate", async (c: Context) => {
    const projectId = getParam(c, "projectId")
    if (!projectId) return c.json({ error: "Missing projectId" }, 400)

    const body = await c.req.json() as GenerateBody

    let content: string

    if (body.type === "prd") {
      content = await generatePRD(
        projectId,
        body.title,
        body.description,
        body.projectContext ?? "",
        routerConfig,
      )
    } else if (body.type === "architecture") {
      if (!body.prdContent) {
        return c.json({ error: "prdContent is required for architecture specs" }, 400)
      }
      content = await generateArchitectureDoc(
        projectId,
        body.prdContent,
        body.stackDescription ?? "",
        routerConfig,
      )
    } else if (body.type === "technical_spec") {
      if (!body.prdContent) {
        return c.json({ error: "prdContent is required for technical specs" }, 400)
      }
      if (!body.architectureContent) {
        return c.json({ error: "architectureContent is required for technical specs" }, 400)
      }
      content = await generateTechnicalSpec(
        projectId,
        body.prdContent,
        body.architectureContent,
        routerConfig,
      )
    } else {
      return c.json({ error: `Unknown spec type: ${String(body.type)}` }, 400)
    }

    const ticketRefs = extractTicketRefs(content)
    const adrRefs = extractAdrRefs(content)

    const now = new Date()
    const spec = {
      id: randomUUID(),
      projectId,
      type: body.type,
      title: body.title,
      content,
      status: "draft" as const,
      version: 1,
      linkedTicketIds: ticketRefs,
      linkedAdrIds: adrRefs,
      createdBy: "ai",
      createdAt: now,
      updatedAt: now,
    }

    await store.saveSpec(spec)
    return c.json({ spec }, 201)
  })

  // PATCH /specs/:projectId/:id — manual update
  app.patch("/:projectId/:id", async (c: Context) => {
    const id = getParam(c, "id")
    if (!id) return c.json({ error: "Missing id" }, 400)

    const spec = await store.getSpec(id)
    if (!spec) return c.json({ error: "Spec not found" }, 404)

    const body = await c.req.json() as PatchBody
    const updates: Parameters<SpecStore["updateSpec"]>[1] = { updatedAt: new Date() }

    if (body.content !== undefined) {
      updates.content = body.content
      updates.linkedTicketIds = extractTicketRefs(body.content)
      updates.linkedAdrIds = extractAdrRefs(body.content)
    }
    if (body.title !== undefined) {
      updates.title = body.title
    }

    await store.updateSpec(id, updates)
    const updated = await store.getSpec(id)
    return c.json({ spec: updated })
  })

  // POST /specs/:projectId/:id/submit — submit for review
  app.post("/:projectId/:id/submit", async (c: Context) => {
    const id = getParam(c, "id")
    if (!id) return c.json({ error: "Missing id" }, 400)

    const spec = await store.getSpec(id)
    if (!spec) return c.json({ error: "Spec not found" }, 404)

    const updated = submitForReview(spec)
    await store.updateSpec(id, { status: updated.status, updatedAt: updated.updatedAt })
    return c.json({ spec: updated })
  })

  // POST /specs/:projectId/:id/approve — approve
  app.post("/:projectId/:id/approve", async (c: Context) => {
    const id = getParam(c, "id")
    if (!id) return c.json({ error: "Missing id" }, 400)

    const spec = await store.getSpec(id)
    if (!spec) return c.json({ error: "Spec not found" }, 404)

    const body = await c.req.json() as ApproveBody

    try {
      const updated = approveSpec(spec, body.approvedBy)
      const updateFields: Parameters<SpecStore["updateSpec"]>[1] = {
        status: updated.status,
        updatedAt: updated.updatedAt,
        ...(updated.approvedBy !== undefined ? { approvedBy: updated.approvedBy } : {}),
        ...(updated.approvedAt !== undefined ? { approvedAt: updated.approvedAt } : {}),
      }
      await store.updateSpec(id, updateFields)
      return c.json({ spec: updated })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400)
    }
  })

  // POST /specs/:projectId/:id/reject — reject
  app.post("/:projectId/:id/reject", async (c: Context) => {
    const id = getParam(c, "id")
    if (!id) return c.json({ error: "Missing id" }, 400)

    const spec = await store.getSpec(id)
    if (!spec) return c.json({ error: "Spec not found" }, 404)

    const body = await c.req.json() as RejectBody
    const updated = rejectSpec(spec, body.rejectedBy, body.reason)
    await store.updateSpec(id, {
      status: updated.status,
      content: updated.content,
      updatedAt: updated.updatedAt,
    })
    return c.json({ spec: updated })
  })

  return app
}
