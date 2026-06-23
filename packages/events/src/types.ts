/**
 * Typed event map for the LoopForge in-process event bus.
 * Consumers subscribe by event name and receive a strongly-typed payload.
 */
export interface LoopForgeEventMap {
  // ── Project lifecycle ───────────────────────────────────────────────────────
  "project.created": {
    projectId: string
    name: string
    repoPath: string | undefined
  }
  "project.indexed": {
    projectId: string
    fileCount: number
    languages: string[]
    frameworks: string[]
  }
  "project.reindexed": {
    projectId: string
  }

  // ── Knowledge graph ─────────────────────────────────────────────────────────
  "graph.ingested": {
    projectId: string
    nodeCount: number
    edgeCount: number
    docCount: number
  }
  "graph.node.created": {
    projectId: string
    nodeId: string
    entityType: string
  }
  "graph.edge.created": {
    projectId: string
    edgeId: string
    relationship: string
    sourceNodeId: string
    targetNodeId: string
  }

  // ── Decisions (ADRs) ────────────────────────────────────────────────────────
  "adr.created": {
    projectId: string
    adrId: string
    number: number
    title: string
  }
  "adr.status_changed": {
    projectId: string
    adrId: string
    previousStatus: string
    newStatus: string
  }

  // ── Evals ──────────────────────────────────────────────────────────────────
  "eval.run.completed": {
    projectId: string
    criteriaId: string
    runId: string
    passed: boolean
    score: number
    regressionDetected: boolean
  }
  "eval.feedback.submitted": {
    projectId: string
    runId: string
    verdict: string
    submittedBy: string
  }

  // ── Goals & Execution ───────────────────────────────────────────────────────
  "goal.created": {
    projectId: string
    goalId: string
    title: string
  }
  "goal.completed": {
    projectId: string
    goalId: string
  }
  "goal.blocked": {
    projectId: string
    goalId: string
    blockers: string[]
  }

  // ── Releases ────────────────────────────────────────────────────────────────
  "release.published": {
    projectId: string
    releaseId: string
    version: string
  }

  // ── Sessions ────────────────────────────────────────────────────────────────
  "session.started": {
    projectId: string
    sessionId: string
  }
  "session.summarized": {
    projectId: string
    sessionId: string
    summary: string
  }

  // ── Scans ──────────────────────────────────────────────────────────────────
  "scan.completed": {
    projectId: string
    scanType: string
    findingCount: number
  }
}

export type EventName = keyof LoopForgeEventMap
export type EventPayload<E extends EventName> = LoopForgeEventMap[E]
