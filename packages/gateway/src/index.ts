import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serve } from "@hono/node-server"
import { createSessionsRouter } from "./routes/sessions.js"
import { createProjectsRouter } from "./routes/projects.js"
import type { BrainStore } from "@devos/brain"
import type { Project, Ticket, ContextChunk } from "@devos/core"

const PORT = Number(process.env["PORT"] ?? 18790)

// Bootstrap an in-memory BrainStore wired to the projects map
// Replace with Supabase adapter in production
function createInMemoryBrainStore(
  projectsMap: Map<string, Project>,
): BrainStore {
  const summaries = new Map<string, string>()
  const chunks = new Map<string, ContextChunk[]>()

  return {
    async getProject(id) {
      return projectsMap.get(id) ?? null
    },
    async getLastSessionSummary(projectId) {
      return summaries.get(projectId)
    },
    async getOpenTickets(_projectId, _limit): Promise<Ticket[]> {
      return [] // Wire to Supabase tickets table in production
    },
    async searchChunks(projectId, _query, limit) {
      // Naïve keyword search — replace with pgvector cosine similarity in production
      return (chunks.get(projectId) ?? []).slice(0, limit)
    },
    async saveSessionSummary(projectId, summary) {
      summaries.set(projectId, summary)
    },
  }
}

function main() {
  const app = new Hono()

  app.use("*", cors())
  app.use("*", logger())

  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }))

  const { router: projectsRouter, projectsStore } = createProjectsRouter()
  const store = createInMemoryBrainStore(projectsStore)

  const apiKey = process.env["OPENROUTER_API_KEY"]
  const routerConfig = {
    ...(apiKey !== undefined ? { openRouterApiKey: apiKey } : {}),
    ollamaBaseUrl: process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434",
    forceOnPremForClassifications: ["confidential", "restricted"],
  }

  app.route("/projects", projectsRouter)
  app.route("/sessions", createSessionsRouter(store, routerConfig))

  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`DevOS Gateway running on http://localhost:${PORT}`)
    console.log(`  OpenRouter: ${routerConfig.openRouterApiKey ? "configured" : "not set — cloud routing disabled"}`)
    console.log(`  Ollama: ${routerConfig.ollamaBaseUrl}`)
  })
}

main()
