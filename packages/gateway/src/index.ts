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
import { createGraphRouter, createInMemoryGraphStore } from "@loopforge/graph"
import type { GraphStore } from "@loopforge/graph"
import { createGoalsRouter, createInMemoryGoalStore } from "@loopforge/goals"
import { createEvalsRouter, createInMemoryEvalStore } from "@loopforge/evals"
import { createSettingsRouter, getSettings } from "./routes/settings.js"
import { createFilesRouter } from "./routes/files.js"
import { createReleasesRouter } from "./routes/releases.js"
import type { Context, Next } from "hono"
import { BUILT_IN_PACKS } from "@loopforge/brain"
import type { BrainStore } from "@loopforge/brain"
import type { Project, Ticket, ContextChunk, ContextPack } from "@loopforge/core"
import {
  createSupabaseClient,
  createPersistentProjectsMap,
  createSupabaseGraphStore,
  createSupabaseADRStore,
  createSupabaseEvalStore,
  createSupabaseGoalStore,
} from "@loopforge/db"

const PORT = Number(process.env["PORT"] ?? 18790)

const LOOPFORGE_API_KEY = process.env["LOOPFORGE_API_KEY"]
const HOST = process.env["HOST"] ?? "127.0.0.1"

async function requireApiKey(c: Context, next: Next): Promise<Response | void> {
  if (!LOOPFORGE_API_KEY) {
    const forwarded = c.req.header("x-forwarded-for")
    if (forwarded) {
      return c.json(
        { error: "Set LOOPFORGE_API_KEY before exposing LoopForge beyond localhost." },
        401,
      )
    }
    return next()
  }

  const bearer = c.req.header("authorization")
  const token = bearer?.startsWith("Bearer ")
    ? bearer.slice(7)
    : (c.req.header("x-api-key") ?? "")

  if (!token || token !== LOOPFORGE_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  return next()
}

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

async function main() {
  if (!LOOPFORGE_API_KEY && HOST !== "127.0.0.1" && HOST !== "localhost") {
    console.error(
      "[security] LOOPFORGE_API_KEY must be set when HOST is not 127.0.0.1. Refusing to start.",
    )
    process.exit(1)
  }

  // ── Persistence: Supabase when env vars present, in-memory fallback ──────────

  const supabaseUrl = process.env["SUPABASE_URL"]
  const supabaseKey = process.env["SUPABASE_ANON_KEY"]
  const usePersistence = supabaseUrl !== undefined && supabaseKey !== undefined

  let projectsStore: Map<string, Project>
  let graphStore: GraphStore

  if (usePersistence) {
    console.log("[db] Supabase persistence enabled")
    const db = createSupabaseClient(supabaseUrl, supabaseKey)
    projectsStore = await createPersistentProjectsMap(db)
    graphStore = createSupabaseGraphStore(db)
    console.log(`[db] Loaded ${projectsStore.size} project(s) from Supabase`)
  } else {
    console.log("[db] No SUPABASE_URL/SUPABASE_ANON_KEY — using in-memory stores")
    projectsStore = new Map<string, Project>()
    graphStore = createInMemoryGraphStore()
  }

  const app = new Hono()

  app.use("*", cors({ origin: ALLOWED_ORIGINS }))
  app.use("*", logger())

  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }))

  app.use("/projects/*", requireApiKey)
  app.use("/sessions/*", requireApiKey)

  const openRouterKey = process.env["OPENROUTER_API_KEY"]
  const settings = getSettings()
  const routerConfig = {
    ...(openRouterKey !== undefined ? { openRouterApiKey: openRouterKey } : {}),
    ollamaBaseUrl: process.env["OLLAMA_BASE_URL"] ?? settings.models.ollamaModel,
    forceOnPremForClassifications: ["confidential", "restricted"],
    modelOverrides: {
      small: settings.models.small,
      medium: settings.models.medium,
      frontier: settings.models.frontier,
    },
  }

  // ── Projects + Brain ──────────────────────────────────────────────────────────

  const store = createInMemoryBrainStore(projectsStore)
  const { router: projectsRouter } = createProjectsRouter(store, graphStore, projectsStore)

  // ── ADR ───────────────────────────────────────────────────────────────────────

  const adrStore = usePersistence
    ? createSupabaseADRStore(createSupabaseClient(supabaseUrl!, supabaseKey!))
    : createInMemoryADRStore()
  const adrService = new ADRService(adrStore, routerConfig, graphStore)

  app.route("/projects", projectsRouter)
  app.route("/sessions", createSessionsRouter(store, routerConfig, adrService))

  // ── Backlog ───────────────────────────────────────────────────────────────────

  app.use("/backlog/*", requireApiKey)
  const backlogService = new BacklogService(createInMemoryTicketStore(), graphStore)
  const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"]
  app.route("/backlog", createBacklogRouter(backlogService, webhookSecret))

  // ── Decompose ─────────────────────────────────────────────────────────────────

  app.use("/decompose/*", requireApiKey)
  app.route("/decompose", createDecomposeRouter(store, backlogService, routerConfig))

  // ── Specs ─────────────────────────────────────────────────────────────────────

  app.use("/specs/*", requireApiKey)
  app.route("/specs", createSpecRouter(createInMemorySpecStore(), routerConfig, graphStore))

  // ── ADRs ──────────────────────────────────────────────────────────────────────

  app.use("/adrs/*", requireApiKey)
  app.route("/adrs", createADRRouter(adrService))

  // ── Graph ─────────────────────────────────────────────────────────────────────

  app.use("/graph/*", requireApiKey)
  app.route("/graph", createGraphRouter(graphStore))

  // ── Vision ────────────────────────────────────────────────────────────────────

  app.use("/vision/*", requireApiKey)
  const visionService = new VisionService(createInMemoryVisualAssetStore(), store, routerConfig, graphStore)
  app.route("/vision", createVisionRouter(visionService))

  // ── Goals ─────────────────────────────────────────────────────────────────────

  app.use("/goals/*", requireApiKey)
  const goalStore = usePersistence
    ? createSupabaseGoalStore(createSupabaseClient(supabaseUrl!, supabaseKey!))
    : createInMemoryGoalStore()
  app.route("/goals", createGoalsRouter(goalStore, routerConfig))

  // ── Evals ─────────────────────────────────────────────────────────────────────

  app.use("/evals/*", requireApiKey)
  const evalStore = usePersistence
    ? createSupabaseEvalStore(createSupabaseClient(supabaseUrl!, supabaseKey!))
    : createInMemoryEvalStore()
  app.route("/evals", createEvalsRouter(evalStore, routerConfig, projectsStore, graphStore))

  // ── Files (editor) ────────────────────────────────────────────────────────────

  app.use("/projects/*/files*", requireApiKey)
  app.route("/projects", createFilesRouter(projectsStore))

  // ── Settings ──────────────────────────────────────────────────────────────────

  app.use("/settings/*", requireApiKey)
  app.route("/settings", createSettingsRouter())

  // ── Releases ──────────────────────────────────────────────────────────────────

  app.use("/releases/*", requireApiKey)
  app.route("/releases", createReleasesRouter(routerConfig, graphStore))

  // ── Workflows ─────────────────────────────────────────────────────────────────

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
    console.log(`  Auth: ${LOOPFORGE_API_KEY ? "API key required" : "localhost-only (set LOOPFORGE_API_KEY for remote access)"}`)
    console.log(`  OpenRouter: ${openRouterKey ? "configured" : "not set"}`)
    console.log(`  Ollama: ${routerConfig.ollamaBaseUrl}`)
    console.log(`  Persistence: ${usePersistence ? "Supabase" : "in-memory"}`)
  })
}

main().catch((err: unknown) => {
  console.error("[gateway] Fatal startup error:", err)
  process.exit(1)
})
