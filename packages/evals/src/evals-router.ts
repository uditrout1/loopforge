import { Hono } from "hono"
import type { Context } from "hono"
import { randomUUID } from "node:crypto"
import type { EvalType, FeedbackVerdict, Project } from "@loopforge/core"
import type { RouterConfig } from "@loopforge/router"
import type { EvalStore } from "./store.js"
import { runEval } from "./runner.js"
import { submitFeedback } from "./feedback.js"
import { scanRepo } from "./scanner.js"
import type { ScanType } from "./scanner.js"

function requireParam(c: Context, name: string): string | null {
  const val = c.req.param(name)
  return val ?? null
}

export function createEvalsRouter(
  store: EvalStore,
  routerConfig: RouterConfig,
  projectsMap?: Map<string, Project>,
): Hono {
  const app = new Hono()

  // GET /:projectId/criteria
  app.get("/:projectId/criteria", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const criteria = await store.listCriteria(projectId)
    return c.json({ criteria })
  })

  // POST /:projectId/criteria
  app.post("/:projectId/criteria", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const body = await c.req.json() as {
      name: string
      description: string
      type: EvalType
      prompt: string
      threshold: number
      sourceSpecId?: string
      sourceAdrId?: string
    }
    if (!body.name || !body.prompt || !body.type) {
      return c.json({ error: "name, prompt, type are required" }, 400)
    }
    const now = new Date()
    const criteria = {
      id: randomUUID(),
      projectId,
      name: String(body.name).slice(0, 256),
      description: String(body.description ?? "").slice(0, 1024),
      type: body.type,
      prompt: String(body.prompt),
      threshold: typeof body.threshold === "number" ? Math.min(1, Math.max(0, body.threshold)) : 0.7,
      sourceSpecId: typeof body.sourceSpecId === "string" ? body.sourceSpecId : undefined,
      sourceAdrId: typeof body.sourceAdrId === "string" ? body.sourceAdrId : undefined,
      createdAt: now,
      updatedAt: now,
    }
    await store.saveCriteria(criteria)
    return c.json({ criteria }, 201)
  })

  // DELETE /:projectId/criteria/:criteriaId
  app.delete("/:projectId/criteria/:criteriaId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const criteriaId = requireParam(c, "criteriaId")
    if (!projectId || !criteriaId) return c.json({ error: "projectId and criteriaId required" }, 400)
    await store.deleteCriteria(projectId, criteriaId)
    return c.json({ deleted: true })
  })

  // POST /:projectId/run
  app.post("/:projectId/run", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const body = await c.req.json() as {
      criteriaId: string
      targetType: string
      targetId: string
      content: string
    }
    if (!body.criteriaId || !body.content) {
      return c.json({ error: "criteriaId and content are required" }, 400)
    }
    const criteria = await store.getCriteria(projectId, body.criteriaId)
    if (!criteria) return c.json({ error: "Criteria not found" }, 404)

    const run = await runEval(projectId, criteria, body.content, store, routerConfig)
    return c.json({ run }, 201)
  })

  // GET /:projectId/runs
  app.get("/:projectId/runs", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const criteriaId = c.req.query("criteriaId")
    const runs = await store.listRuns(projectId, criteriaId)
    return c.json({ runs })
  })

  // GET /:projectId/runs/:runId
  app.get("/:projectId/runs/:runId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const runId = requireParam(c, "runId")
    if (!projectId || !runId) return c.json({ error: "projectId and runId required" }, 400)
    const run = await store.getRun(projectId, runId)
    if (!run) return c.json({ error: "Run not found" }, 404)
    const feedback = await store.getFeedbackForRun(projectId, runId)
    return c.json({ run, feedback })
  })

  // POST /:projectId/runs/:runId/feedback
  app.post("/:projectId/runs/:runId/feedback", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const runId = requireParam(c, "runId")
    if (!projectId || !runId) return c.json({ error: "projectId and runId required" }, 400)
    const run = await store.getRun(projectId, runId)
    if (!run) return c.json({ error: "Run not found" }, 404)
    const body = await c.req.json() as {
      verdict: FeedbackVerdict
      rationale: string
      submittedBy: string
    }
    if (!body.verdict || !body.rationale || !body.submittedBy) {
      return c.json({ error: "verdict, rationale, submittedBy are required" }, 400)
    }
    const feedback = await submitFeedback(
      projectId,
      runId,
      body.verdict,
      body.rationale,
      body.submittedBy,
      store,
    )
    return c.json({ feedback }, 201)
  })

  // POST /:projectId/scan — repo scan mode (no manual paste required)
  // Security: repoPath is derived from the server-side project record, not the request body,
  // so callers cannot path-traverse to arbitrary directories.
  app.post("/:projectId/scan", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)

    const project = projectsMap?.get(projectId)
    if (!project) return c.json({ error: "Project not found" }, 404)
    const repoPath = project.repoPath
    if (!repoPath) return c.json({ error: "Project has no repoPath" }, 400)

    const body = await c.req.json() as {
      scanType: ScanType
      customDescription?: string
    }
    if (!body.scanType) {
      return c.json({ error: "scanType is required" }, 400)
    }
    const result = await scanRepo(
      projectId,
      repoPath,
      body.scanType,
      routerConfig,
      body.customDescription,
    )
    return c.json({ result })
  })

  // GET /:projectId/summary
  app.get("/:projectId/summary", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const criteria = await store.listCriteria(projectId)
    const runs = await store.listRuns(projectId)
    const completedRuns = runs.filter((r) => r.status === "passed" || r.status === "failed")
    const passedRuns = completedRuns.filter((r) => r.passed)
    const regressions = runs.filter((r) => r.regressionDetected)
    return c.json({
      totalCriteria: criteria.length,
      totalRuns: runs.length,
      passRate: completedRuns.length > 0 ? passedRuns.length / completedRuns.length : null,
      regressions: regressions.length,
    })
  })

  return app
}
