import { Hono } from "hono"
import type { ADRService } from "./adr-service.js"
import type { ADR, ADRStatus } from "@loopforge/core"

export function createADRRouter(adrService: ADRService): Hono {
  const app = new Hono()

  const validStatuses: ADRStatus[] = ["proposed", "accepted", "deprecated", "superseded"]

  function parseStatus(value: string | undefined): ADRStatus | undefined | "invalid" {
    if (value === undefined) return undefined
    if (validStatuses.includes(value as ADRStatus)) return value as ADRStatus
    return "invalid"
  }

  // GET /adrs/:projectId/export — returns accepted ADRs as markdown
  // Must be registered BEFORE /:projectId/:id so "export" isn't treated as an id
  app.get("/:projectId/export", async (c) => {
    const projectId = c.req.param("projectId")
    const markdown = await adrService.getADRsAsMarkdown(projectId)
    return c.text(markdown, 200, { "Content-Type": "text/markdown; charset=utf-8" })
  })

  // GET /adrs/:projectId — list ADRs, optional ?status=
  app.get("/:projectId", async (c) => {
    const projectId = c.req.param("projectId")
    const statusResult = parseStatus(c.req.query("status"))
    if (statusResult === "invalid") {
      return c.json({ error: `Invalid status: ${c.req.query("status")}` }, 400)
    }
    const adrs = await adrService.listADRs(projectId, statusResult)
    return c.json({ adrs })
  })

  // GET /adrs/:projectId/:id — get single ADR
  app.get("/:projectId/:id", async (c) => {
    const id = c.req.param("id")
    const adr = await adrService.getADR(id)
    if (!adr) return c.json({ error: "ADR not found" }, 404)
    return c.json({ adr })
  })

  // POST /adrs/:projectId — create ADR manually
  app.post("/:projectId", async (c) => {
    const projectId = c.req.param("projectId")
    const body = await c.req.json<{
      title: string
      context: string
      decision: string
      consequences: string
    }>()
    const adr = await adrService.createADR(
      projectId,
      body.title,
      body.context,
      body.decision,
      body.consequences,
    )
    return c.json({ adr }, 201)
  })

  // PATCH /adrs/:projectId/:id — update status or content
  app.patch("/:projectId/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json<Partial<Pick<ADR, "title" | "context" | "decision" | "consequences" | "status">>>()
    await adrService.updateADR(id, { ...body, updatedAt: new Date() })
    const adr = await adrService.getADR(id)
    return c.json({ adr })
  })

  // POST /adrs/:projectId/:id/accept
  app.post("/:projectId/:id/accept", async (c) => {
    const id = c.req.param("id")
    await adrService.updateADR(id, { status: "accepted", updatedAt: new Date() })
    const adr = await adrService.getADR(id)
    return c.json({ adr })
  })

  // POST /adrs/:projectId/:id/deprecate
  app.post("/:projectId/:id/deprecate", async (c) => {
    const id = c.req.param("id")
    await adrService.updateADR(id, { status: "deprecated", updatedAt: new Date() })
    const adr = await adrService.getADR(id)
    return c.json({ adr })
  })

  // POST /adrs/:projectId/:id/supersede — body: { newAdrId }
  app.post("/:projectId/:id/supersede", async (c) => {
    const id = c.req.param("id")
    const { newAdrId } = await c.req.json<{ newAdrId: string }>()
    await adrService.supersedeADR(id, newAdrId)
    const adr = await adrService.getADR(id)
    return c.json({ adr })
  })

  return app
}
