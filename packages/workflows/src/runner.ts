import type { WorkflowRun } from "@loopforge/core"
import type { RouterConfig } from "@loopforge/router"
import { randomUUID } from "node:crypto"
import { executeWorkflow, checkpointResolvers } from "./executor.js"
import { getWorkflow } from "./registry.js"

// ─── In-Memory Run Store ──────────────────────────────────────────────────────

const runStore = new Map<string, WorkflowRun>()

// Tracks active generator instances so resumeRun can signal them
const activeGenerators = new Map<string, AsyncGenerator<WorkflowRun>>()

// ─── createRun ────────────────────────────────────────────────────────────────

export function createRun(
  workflowId: string,
  projectId: string,
  triggeredBy: string,
  payload: Record<string, unknown>,
): WorkflowRun {
  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId,
    projectId,
    triggeredBy,
    triggerPayload: payload,
    status: "running",
    sharedState: {},
    completedNodes: {},
    humanCheckpoints: [],
    totalCostUsd: 0,
    startedAt: new Date(),
  }
  runStore.set(run.id, run)
  return run
}

// ─── getRun ───────────────────────────────────────────────────────────────────

export function getRun(runId: string): WorkflowRun | undefined {
  return runStore.get(runId)
}

// ─── resumeRun ────────────────────────────────────────────────────────────────

export async function resumeRun(
  runId: string,
  nodeId: string,
  decision: string,
  input?: string,
): Promise<void> {
  const run = runStore.get(runId)
  if (run === undefined) {
    throw new Error(`Run '${runId}' not found`)
  }
  if (run.status !== "paused") {
    throw new Error(`Run '${runId}' is not paused (status: ${run.status})`)
  }

  const resolverKey = `${runId}:${nodeId}`
  const resolver = checkpointResolvers.get(resolverKey)
  if (resolver === undefined) {
    throw new Error(`No pending checkpoint for run '${runId}' at node '${nodeId}'`)
  }

  checkpointResolvers.delete(resolverKey)
  resolver({ decision, ...(input !== undefined ? { input } : {}) })

  // Allow the generator to advance
  const gen = activeGenerators.get(runId)
  if (gen !== undefined) {
    const next = await gen.next()
    if (!next.done) {
      const updatedRun = next.value
      runStore.set(runId, updatedRun)
    }
  }
}

// ─── startRun ─────────────────────────────────────────────────────────────────

export async function startRun(runId: string, routerConfig: RouterConfig): Promise<void> {
  const run = runStore.get(runId)
  if (run === undefined) {
    throw new Error(`Run '${runId}' not found`)
  }

  const workflow = getWorkflow(run.workflowId)
  if (workflow === undefined) {
    throw new Error(`Workflow '${run.workflowId}' not found in registry`)
  }

  const gen = executeWorkflow(run, workflow, routerConfig)
  activeGenerators.set(runId, gen)

  try {
    for await (const updatedRun of gen) {
      runStore.set(runId, updatedRun)

      // If run is paused at a human checkpoint, stop iterating and
      // wait for resumeRun to advance the generator externally.
      if (updatedRun.status === "paused") {
        break
      }
    }
  } finally {
    // Clean up generator reference if run completed or failed
    const finalRun = runStore.get(runId)
    if (finalRun !== undefined && finalRun.status !== "paused") {
      activeGenerators.delete(runId)
    }
  }
}
