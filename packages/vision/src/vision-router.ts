import { Hono } from "hono"
import type { VisionService } from "./vision-service.js"

export function createVisionRouter(service: VisionService): Hono {
  const app = new Hono()

  // POST /vision/:projectId/screenshot
  app.post("/:projectId/screenshot", async (c) => {
    const projectId = c.req.param("projectId")
    const body = await c.req.json<{
      name: string
      base64: string
      mediaType: string
      question: string
    }>()

    if (!body.base64 || body.base64.length === 0) {
      return c.json({ error: "base64 is required" }, 400)
    }
    if (!body.mediaType.startsWith("image/")) {
      return c.json({ error: "mediaType must start with image/" }, 400)
    }

    try {
      const result = await service.analyzeScreenshot(
        projectId,
        body.name ?? "screenshot",
        body.base64,
        body.mediaType,
        body.question ?? "Analyze this screenshot",
      )
      return c.json(result, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return c.json({ error: message }, 500)
    }
  })

  // POST /vision/:projectId/figma
  app.post("/:projectId/figma", async (c) => {
    const projectId = c.req.param("projectId")
    const body = await c.req.json<{ url: string; question: string }>()

    if (!body.url) {
      return c.json({ error: "url is required" }, 400)
    }

    try {
      const result = await service.analyzeFigmaUrl(
        projectId,
        body.url,
        body.question ?? "Analyze this Figma design",
      )
      return c.json(result, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      return c.json({ error: message }, 500)
    }
  })

  // POST /vision/:projectId/assets/:id/ask
  app.post("/:projectId/assets/:id/ask", async (c) => {
    const assetId = c.req.param("id")
    const body = await c.req.json<{ question: string }>()

    if (!body.question) {
      return c.json({ error: "question is required" }, 400)
    }

    try {
      const analysis = await service.askAboutAsset(assetId, body.question)
      return c.json({ analysis })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      if (message.includes("not found")) return c.json({ error: message }, 404)
      return c.json({ error: message }, 500)
    }
  })

  // GET /vision/:projectId/assets
  app.get("/:projectId/assets", async (c) => {
    const projectId = c.req.param("projectId")
    const assets = await service.listAssets(projectId)
    return c.json({ assets })
  })

  // GET /vision/:projectId/assets/:id
  app.get("/:projectId/assets/:id", async (c) => {
    const assetId = c.req.param("id")
    const asset = await service.getAsset(assetId)
    if (!asset) return c.json({ error: "Asset not found" }, 404)
    return c.json({ asset })
  })

  return app
}
