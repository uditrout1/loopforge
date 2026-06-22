import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serve } from "@hono/node-server"
import { createSessionsRouter } from "./routes/sessions.js"
import { createProjectsRouter } from "./routes/projects.js"
import { createDecomposeRouter } from "./routes/decompose.js"
import { createBacklogRouter, BacklogService, createInMemoryTicketStore } from "@loopforge/backlog"
import { listWorkflows, createRun, getRun, resumeRun, startRun } from "@loopforge/workflows"
import { createSpecRouter, createInMemorySpecStore } from "@loopforge/spec"
import { createADRRouter, ADRService, createInMemoryADRStore } from "@loopforge/adr"
import { createVisionRouter, VisionService, createInMemoryVisualAssetStore } from "@loopforge/vision"
import type { Context, Next } from "hono"
import { BUILT_IN_PACKS } from "@loopforge/brain"
import type { BrainStore } from "@loopforge/brain"
import type { Project, Ticket, ContextChunk, ContextPack } from "@loopforge/core"

const PORT = Number(process.env["PORT"] ?? 18790)

// Fix 3a: API key auth.
// Set DEVOS_API_KEY in the environment. All /projects and /sessions routes
// require "Authorization: Bearer <key>" or "X-API-Key: <key>".
// If no key is set the server refuses to start unless HOST is 127.0.0.1.
const DEVOS_API_KEY = process.env["DEVOS_API_KEY"]
const HOST = process.env["HOST"] ?? "127.0.0.1"

async function requireApiKey(c: Context, next: Next): Promise<Response | void> {
  if (!DEVOS_API_KEY) {
    // No key configured — traffic is allowed only from localhost
    const forwarded = c.req.header("x-forwarded-for")
    if (forwarded) {
      return c.json(
        { error: "Set DEVOS_API_KEY before exposing LoopForge beyond localhost." },
        401,
      )
    }
    return next()
  }

  const bearer = c.req.header("authorization")
  const token = bearer?.startsWith("Bearer ")
    ? bearer.slice(7)
    : (c.req.header("x-api-key") ?? "")

  if (!token || token !== DEVOS_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return next()
}

// Fix 3b: CORS restricted to localhost origins by default.
// Override with CORS_ORIGINS="http://app.example.com,..." for production.
const ALLOWED_ORIGINS = process.env["CORS_ORIGINS"]?.split(",").map((o) => o.trim()) ?? [
  "http://localhost:3000",
  "http://localhost:18790",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:18790",
]

function createInMemoryBrainStore(projectsMap: Map<string, Project>): BrainStore {
  const summaries = new Map<string, string>()
  const chunks = new Map<string, ContextChunk[]>()
  const packsStore = new Map<string, ContextPack[]>()

  return {
    async getProject(id) { return projectsMap.get(id) ?? null },
    async getLastSessionSummary(projectId) { return summaries.get(projectId) },
    async getOpenTickets(_projectId, _limit): Promise<Ticket[]> { return [] },
    async searchChunks(projectId, _query, limit) {
      return (chunks.get(projectId) ?? []).slice(0, limit)
    },
    async saveSessionSummary(projectId, summary) {
      summaries.set(projectId, summary)
    },
    async getPacks(projectId) {
      // Custom packs are stored per-project; built-ins are always included
      const custom = packsStore.get(projectId) ?? []
      return [...BUILT_IN_PACKS, ...custom]
    },
    async savePack(pack) {
      const existing = packsStore.get(pack.projectId) ?? []
      packsStore.set(pack.projectId, [...existing, pack])
    },
    async deletePack(projectId, packId) {
      const existing = packsStore.get(projectId) ?? []
      const next = existing.filter((p) => p.id !== packId)
      if (next.length === existing.length) return false
      packsStore.set(projectId, next)
      return true
    },
  }
}

function main() {
  if (!DEVOS_API_KEY && HOST !== "127.0.0.1" && HOST !== "localhost") {
    console.error(
      "[security] DEVOS_API_KEY must be set when HOST is not 127.0.0.1. Refusing to start.",
    )
    process.exit(1)
  }

  const app = new Hono()

  app.use("*", cors({ origin: ALLOWED_ORIGINS }))
  app.use("*", logger())

  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }))

  app.use("/projects/*", requireApiKey)
  app.use("/sessions/*", requireApiKey)

  // First pass: get the projectsStore map reference (no store yet)
  const { projectsStore } = createProjectsRouter()
  // Create the brain store wrapping the projects map
  const store = createInMemoryBrainStore(projectsStore)
  // Second pass: create the router with the store wired in for pack routes
  const { router: projectsRouter } = createProjectsRouter(store)

  const openRouterKey = process.env["OPENROUTER_API_KEY"]
  const routerConfig = {
    ...(openRouterKey !== undefined ? { openRouterApiKey: openRouterKey } : {}),
    ollamaBaseUrl: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    forceOnPremForClassifications: ["confidential", "restricted"],
  }

  // ADR store and service (created early so sessions router can reference it)
  const adrStore = createInMemoryADRStore()
  const adrService = new ADRService(adrStore, routerConfig)

  app.route("/projects", projectsRouter)
  app.route("/sessions", createSessionsRouter(store, routerConfig, adrService))

  // Backlog routes
  app.use("/backlog/*", requireApiKey)
  const backlogService = new BacklogService(createInMemoryTicketStore())
  const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"]
  app.route("/backlog", createBacklogRouter(backlogService, webhookSecret))

  // Decompose routes
  app.use("/decompose/*", requireApiKey)
  app.route("/decompose", createDecomposeRouter(store, backlogService, routerConfig))

  // Spec routes
  app.use("/specs/*", requireApiKey)
  app.route("/specs", createSpecRouter(createInMemorySpecStore(), routerConfig))

  // ADR routes
  app.use("/adrs/*", requireApiKey)
  app.route("/adrs", createADRRouter(adrService))

  // Vision routes
  app.use("/vision/*", requireApiKey)
  const visionService = new VisionService(createInMemoryVisualAssetStore(), store, routerConfig)
  app.route("/vision", createVisionRouter(visionService))

  // Workflow routes
  app.use("/workflows/*", requireApiKey)
  app.get("/workflows", (c) => c.json({ workflows: listWorkflows() }))
  app.post("/workflows/:id/runs", async (c) => {
    const workflowId = c.req.param("id")
    const body = await c.req.json<{ projectId: string; triggeredBy?: string; payload?: Record<string, unknown> }>()
    const run = createRun(workflowId, body.projectId, body.triggeredBy ?? "api", body.payload ?? {})
    void startRun(run.id, routerConfig)
    return c.json({ run }, 201)
  })
  app.get("/workflows/runs/:runId", (c) => {
    const run = getRun(c.req.param("runId"))
    if (!run) return c.json({ error: "Run not found" }, 404)
    return c.json({ run })
  })
  app.post("/workflows/runs/:runId/resume", async (c) => {
    const body = await c.req.json<{ nodeId: string; decision: string; input?: string }>()
    await resumeRun(c.req.param("runId"), body.nodeId, body.decision, body.input)
    const run = getRun(c.req.param("runId"))
    return c.json({ run })
  })

  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
    console.log(`LoopForge Gateway listening on ${HOST}:${PORT}`)
    console.log(`  Auth: ${DEVOS_API_KEY ? "API key required" : "localhost-only (set DEVOS_API_KEY for remote access)"}`)
    console.log(`  OpenRouter: ${openRouterKey ? "configured" : "not set"}`)
    console.log(`  Ollama: ${routerConfig.ollamaBaseUrl}`)
  })
}

main()
