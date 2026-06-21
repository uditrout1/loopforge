import type {
  Workflow,
  WorkflowRun,
  WorkflowNode,
  WorkflowEdge,
  NodeResult,
  HumanCheckpoint,
} from "@devos/core"
import { route } from "@devos/router"
import type { RouterConfig } from "@devos/router"

// ─── Topological Sort ────────────────────────────────────────────────────────

function topoSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map<string, WorkflowNode>(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]))
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    const targets = Array.isArray(edge.to) ? edge.to : [edge.to]
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
      const adj = adjacency.get(edge.from)
      if (adj !== undefined) adj.push(target)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: WorkflowNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node !== undefined) sorted.push(node)
    for (const neighbor of adjacency.get(id) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) queue.push(neighbor)
    }
  }

  return sorted
}

// ─── Condition Evaluation ────────────────────────────────────────────────────

function evaluateCondition(condition: string, sharedState: Record<string, unknown>): boolean {
  // Simple evaluation: "key == value" or "key != value"
  const eqMatch = condition.match(/^(\S+)\s*==\s*(.+)$/)
  if (eqMatch !== null) {
    const [, key, val] = eqMatch
    if (key === undefined || val === undefined) return false
    return String(sharedState[key]) === val.trim()
  }
  const neqMatch = condition.match(/^(\S+)\s*!=\s*(.+)$/)
  if (neqMatch !== null) {
    const [, key, val] = neqMatch
    if (key === undefined || val === undefined) return false
    return String(sharedState[key]) !== val.trim()
  }
  // Fallback: treat as truthy key
  return Boolean(sharedState[condition])
}

// ─── Sleep Helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Human Checkpoint Resume Map ─────────────────────────────────────────────

// Key: `${runId}:${nodeId}` → resolve fn
export const checkpointResolvers = new Map<
  string,
  (value: { decision: string; input?: string }) => void
>()

// ─── Node Executor ────────────────────────────────────────────────────────────

async function executeNode(
  node: WorkflowNode,
  run: WorkflowRun,
  routerConfig: RouterConfig,
): Promise<NodeResult> {
  const start = Date.now()

  if (node.type === "tool") {
    console.log(`[workflows] tool node '${node.id}' — tool execution not yet implemented`)
    run.sharedState[node.id] = { skipped: true }
    return {
      output: { skipped: true },
      durationMs: Date.now() - start,
      attempts: 1,
    }
  }

  if (node.type === "merge") {
    // Combine outputs of all incoming nodes referenced in sharedState
    const merged: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(run.sharedState)) {
      merged[key] = val
    }
    run.sharedState[node.id] = merged
    return {
      output: merged,
      durationMs: Date.now() - start,
      attempts: 1,
    }
  }

  if (node.type === "human_checkpoint") {
    const checkpoint: HumanCheckpoint = {
      nodeId: node.id,
      prompt: node.systemPrompt ?? `Human review required at node '${node.label}'`,
      options: ["approve", "reject"],
      requestedAt: new Date(),
    }
    run.humanCheckpoints.push(checkpoint)
    run.status = "paused"

    // Wait for resume signal
    const resolution = await new Promise<{ decision: string; input?: string }>((resolve) => {
      checkpointResolvers.set(`${run.id}:${node.id}`, resolve)
    })

    const cp = run.humanCheckpoints.find((c) => c.nodeId === node.id)
    if (cp !== undefined) {
      cp.resolvedAt = new Date()
      cp.decision = resolution.decision
      cp.input = resolution.input
    }

    run.status = "running"
    run.sharedState[node.id] = resolution
    return {
      output: resolution,
      durationMs: Date.now() - start,
      attempts: 1,
    }
  }

  if (node.type === "condition") {
    // Condition nodes don't execute AI — edge routing happens in the main loop
    run.sharedState[node.id] = { evaluated: true }
    return {
      output: { evaluated: true },
      durationMs: Date.now() - start,
      attempts: 1,
    }
  }

  // agent node — run with retry + timeout
  return await executeAgentNode(node, run, routerConfig, start)
}

async function executeAgentNode(
  node: WorkflowNode,
  run: WorkflowRun,
  routerConfig: RouterConfig,
  startTime: number,
): Promise<NodeResult> {
  const { maxAttempts, backoffMs, fallbackModel } = node.retryStrategy
  let lastError: unknown

  // Build context content from sharedState keys listed in contextSlice
  const contextParts: string[] = []
  for (const key of node.contextSlice) {
    if (run.sharedState[key] !== undefined) {
      contextParts.push(`[${key}]: ${JSON.stringify(run.sharedState[key])}`)
    }
  }

  const userContent =
    contextParts.length > 0
      ? `Context:\n${contextParts.join("\n")}\n\nTrigger payload:\n${JSON.stringify(run.triggerPayload)}`
      : `Trigger payload:\n${JSON.stringify(run.triggerPayload)}`

  const messages = [
    ...(node.systemPrompt !== undefined
      ? [{ role: "system" as const, content: node.systemPrompt }]
      : []),
    { role: "user" as const, content: userContent },
  ]

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const modelRequest = {
        messages,
        projectId: run.projectId,
        sessionId: run.id,
        dataClassification: "internal" as const,
        ...(node.model !== undefined ? { preferredCapability: "frontier" as const } : {}),
      }

      const timeoutPromise: Promise<never> = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Node '${node.id}' timed out after ${node.timeoutMs}ms`)), node.timeoutMs),
      )

      const response = await Promise.race([route(modelRequest, routerConfig), timeoutPromise])

      const costUsd = response.costUsd
      run.totalCostUsd += costUsd
      run.sharedState[node.id] = response.content

      return {
        output: response.content,
        durationMs: Date.now() - startTime,
        model: response.model,
        costUsd,
        attempts: attempt,
      }
    } catch (err) {
      lastError = err
      console.error(`[workflows] node '${node.id}' attempt ${attempt} failed:`, err)
      if (attempt < maxAttempts) {
        await sleep(backoffMs * attempt)
      }
    }
  }

  // All attempts exhausted — try fallback model if configured
  if (fallbackModel !== undefined) {
    try {
      const fallbackRequest = {
        messages,
        projectId: run.projectId,
        sessionId: run.id,
        dataClassification: "internal" as const,
        preferredCapability: "medium" as const,
      }

      const timeoutPromise: Promise<never> = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Fallback for node '${node.id}' timed out`)), node.timeoutMs),
      )

      const response = await Promise.race([route(fallbackRequest, routerConfig), timeoutPromise])
      const costUsd = response.costUsd
      run.totalCostUsd += costUsd
      run.sharedState[node.id] = response.content

      return {
        output: response.content,
        durationMs: Date.now() - Date.now(),
        model: fallbackModel,
        costUsd,
        attempts: maxAttempts + 1,
      }
    } catch (fallbackErr) {
      lastError = fallbackErr
    }
  }

  throw lastError
}

// ─── Main Executor ────────────────────────────────────────────────────────────

export async function* executeWorkflow(
  run: WorkflowRun,
  workflow: Workflow,
  routerConfig: RouterConfig,
): AsyncGenerator<WorkflowRun> {
  run.status = "running"

  // Build edge lookup structures
  const outEdges = new Map<string, WorkflowEdge[]>()
  for (const node of workflow.nodes) {
    outEdges.set(node.id, [])
  }
  for (const edge of workflow.edges) {
    const list = outEdges.get(edge.from)
    if (list !== undefined) list.push(edge)
  }

  // Find trigger/start node
  const triggerNode = workflow.nodes.find((n) => n.type === "trigger")
  const startNodeId = triggerNode?.id

  // Topological sort
  const sorted = topoSort(workflow.nodes, workflow.edges)

  // Track which nodes are "active" (reachable based on condition routing)
  // Initially all nodes are considered reachable; condition nodes narrow this.
  const skippedNodes = new Set<string>()

  // Track which parallel branches have completed for merge nodes
  const incomingEdges = new Map<string, string[]>()
  for (const node of workflow.nodes) {
    incomingEdges.set(node.id, [])
  }
  for (const edge of workflow.edges) {
    const targets = Array.isArray(edge.to) ? edge.to : [edge.to]
    for (const target of targets) {
      const list = incomingEdges.get(target)
      if (list !== undefined) list.push(edge.from)
    }
  }

  for (const node of sorted) {
    // Skip trigger node (it's just a routing artifact)
    if (node.type === "trigger" || node.id === startNodeId) {
      continue
    }

    // Skip nodes that were routed away from by a condition
    if (skippedNodes.has(node.id)) {
      continue
    }

    run.currentNodeId = node.id

    try {
      const result = await executeNode(node, run, routerConfig)
      run.completedNodes[node.id] = result

      // If node was a human_checkpoint and run is paused, yield and continue
      // (resume happens via resumeWorkflow which calls the generator externally)
      if (node.type === "human_checkpoint") {
        yield { ...run }
        // After yielding, execution continues only when the promise resolved (inside executeNode)
      }

      // Handle condition routing: skip branches not taken
      if (node.type === "condition") {
        const edges = outEdges.get(node.id) ?? []
        let takenEdge: WorkflowEdge | undefined

        for (const edge of edges) {
          if (edge.condition === undefined || edge.condition === "") {
            // Default edge — use if no conditional matched yet
            if (takenEdge === undefined) takenEdge = edge
          } else if (evaluateCondition(edge.condition, run.sharedState)) {
            takenEdge = edge
            break
          }
        }

        // Mark all non-taken edges' targets as skipped
        for (const edge of edges) {
          if (edge !== takenEdge) {
            const targets = Array.isArray(edge.to) ? edge.to : [edge.to]
            for (const t of targets) skippedNodes.add(t)
          }
        }
      }

      // Handle fan-out: if outgoing edge.to is an array, run targets concurrently
      // Note: concurrent execution is handled naturally since topoSort will queue them;
      // but for true parallel fan-out we run them here before continuing.
      const fanOutEdges = (outEdges.get(node.id) ?? []).filter(
        (e) => Array.isArray(e.to) && (e.to as string[]).length > 1,
      )
      if (fanOutEdges.length > 0) {
        const parallelTargetIds = new Set<string>()
        for (const edge of fanOutEdges) {
          for (const t of Array.isArray(edge.to) ? edge.to : [edge.to]) {
            parallelTargetIds.add(t)
          }
        }

        const parallelNodes = sorted.filter((n) => parallelTargetIds.has(n.id))
        await Promise.all(
          parallelNodes.map(async (pNode) => {
            if (skippedNodes.has(pNode.id)) return
            run.currentNodeId = pNode.id
            const pResult = await executeNode(pNode, run, routerConfig)
            run.completedNodes[pNode.id] = pResult
          }),
        )

        yield { ...run }
        continue
      }

      yield { ...run }
    } catch (err) {
      console.error(`[workflows] node '${node.id}' failed terminally:`, err)
      run.status = "failed"
      run.completedAt = new Date()
      yield { ...run }
      return
    }
  }

  run.status = "completed"
  run.completedAt = new Date()
  run.currentNodeId = undefined
  yield { ...run }
}
