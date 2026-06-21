import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { indexRepository } from "@devos/brain"
import type { Project } from "@devos/core"

// In-memory project store — replace with Supabase in production
const projects = new Map<string, Project>()

export function createProjectsRouter() {
  const app = new Hono()

  // POST /projects — connect a new repository
  app.post("/", async (c) => {
    const { name, repoPath, dataClassification } = await c.req.json<{
      name: string
      repoPath: string
      dataClassification?: Project["dataClassification"]
    }>()

    const projectId = randomUUID()

    // Index the repo asynchronously — return project immediately
    const project: Project = {
      id: projectId,
      orgId: "default",
      name,
      repoProvider: "local",
      stack: { languages: [], frameworks: [], databases: [], infrastructure: [] },
      knowledge: {
        summary: "Indexing in progress…",
        conventions: {},
        entryPoints: [],
        openTodos: [],
        recentDecisions: [],
        designConstraints: [],
      },
      dataClassification: dataClassification ?? "internal",
      createdAt: new Date(),
    }

    projects.set(projectId, project)

    // Index in background
    indexRepository(projectId, repoPath)
      .then(({ stack, knowledge, fileCount }) => {
        const existing = projects.get(projectId)
        if (!existing) return
        existing.stack = stack
        existing.knowledge = {
          ...knowledge,
          summary: `${name} — ${fileCount} files indexed. Stack: ${[...stack.languages, ...stack.frameworks].join(", ")}.`,
        }
        existing.indexedAt = new Date()
        console.log(`[brain] Indexed ${fileCount} files for project ${projectId}`)
      })
      .catch((err: unknown) => {
        console.error(`[brain] Indexing failed for ${projectId}:`, err)
      })

    return c.json(project, 201)
  })

  // GET /projects — list all projects
  app.get("/", (c) => {
    return c.json(Array.from(projects.values()))
  })

  // GET /projects/:id — get a project
  app.get("/:id", (c) => {
    const project = projects.get(c.req.param("id"))
    if (!project) return c.json({ error: "Project not found" }, 404)
    return c.json(project)
  })

  return { router: app, projectsStore: projects }
}
