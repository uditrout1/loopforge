import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serve } from "@hono/node-server"
import { createSessionsRouter } from "./routes/sessions.js"
import { createProjectsRouter } from "./routes/projects.js"
import type { Context, Next } from "hono"
import type { BrainStore } from "@devos/brain"
import type { Project, Ticket, ContextChunk } from "@devos/core"

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
        { error: "Set DEVOS_API_KEY before exposing DevOS beyond localhost." },
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

  const { router: projectsRouter, projectsStore } = createProjectsRouter()
  const store = createInMemoryBrainStore(projectsStore)

  const openRouterKey = process.env["OPENROUTER_API_KEY"]
  const routerConfig = {
    ...(openRouterKey !== undefined ? { openRouterApiKey: openRouterKey } : {}),
    ollamaBaseUrl: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    forceOnPremForClassifications: ["confidential", "restricted"],
  }

  app.route("/projects", projectsRouter)
  app.route("/sessions", createSessionsRouter(store, routerConfig))

  serve({ fetch: app.fetch, port: PORT, hostname: HOST }, () => {
    console.log(`DevOS Gateway listening on ${HOST}:${PORT}`)
    console.log(`  Auth: ${DEVOS_API_KEY ? "API key required" : "localhost-only (set DEVOS_API_KEY for remote access)"}`)
    console.log(`  OpenRouter: ${openRouterKey ? "configured" : "not set"}`)
    console.log(`  Ollama: ${routerConfig.ollamaBaseUrl}`)
  })
}

main()
