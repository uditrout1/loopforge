import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import { resolve, sep } from "node:path"
import { indexRepository } from "@devos/brain"
import type { Project } from "@devos/core"

// Fix 1: path traversal — only allow repos under configured roots.
// Set ALLOWED_REPO_ROOTS as colon-separated list; defaults to $HOME.
const ALLOWED_REPO_ROOTS: string[] = (() => {
  const env = process.env["ALLOWED_REPO_ROOTS"]
  if (env) return env.split(":").map((r) => resolve(r))
  const home = process.env["HOME"]
  if (home) return [resolve(home)]
  return []
})()

function validateRepoPath(raw: string): string {
  if (!raw || typeof raw !== "string") throw new Error("repoPath is required")
  if (raw.includes("..")) throw new Error("'..' is not permitted in repoPath")

  const resolved = resolve(raw)

  if (ALLOWED_REPO_ROOTS.length === 0) {
    throw new Error(
      "ALLOWED_REPO_ROOTS is not configured. Set it to a colon-separated list of allowed base directories.",
    )
  }

  const allowed = ALLOWED_REPO_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + sep),
  )

  if (!allowed) {
    throw new Error(
      `repoPath '${resolved}' is outside all allowed roots. Add it to ALLOWED_REPO_ROOTS.`,
    )
  }

  return resolved
}

const projects = new Map<string, Project>()

export function createProjectsRouter() {
  const app = new Hono()

  app.post("/", async (c) => {
    const body = await c.req.json<{ name: string; repoPath: string }>()

    let repoPath: string
    try {
      repoPath = validateRepoPath(body.repoPath)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400)
    }

    const projectId = randomUUID()

    // Fix 2: data classification is never accepted from the request body.
    // It must come from server-side org/repo policy. Default is "internal".
    const project: Project = {
      id: projectId,
      orgId: "default",
      name: String(body.name).slice(0, 256), // bound the name length
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
      dataClassification: "internal",
      createdAt: new Date(),
    }

    projects.set(projectId, project)

    indexRepository(projectId, repoPath)
      .then(({ stack, knowledge, fileCount }) => {
        const existing = projects.get(projectId)
        if (!existing) return
        existing.stack = stack
        existing.knowledge = {
          ...knowledge,
          summary: `${project.name} — ${fileCount} files indexed. Stack: ${[...stack.languages, ...stack.frameworks].join(", ")}.`,
        }
        existing.indexedAt = new Date()
        console.log(`[brain] Indexed ${fileCount} files for project ${projectId}`)
      })
      .catch((err: unknown) => {
        console.error(`[brain] Indexing failed for ${projectId}:`, err)
      })

    return c.json(project, 201)
  })

  app.get("/", (c) => c.json(Array.from(projects.values())))

  app.get("/:id", (c) => {
    const project = projects.get(c.req.param("id"))
    if (!project) return c.json({ error: "Project not found" }, 404)
    return c.json(project)
  })

  return { router: app, projectsStore: projects }
}
