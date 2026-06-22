import type { TraceResult, GraphNode, GraphEdge } from "@loopforge/core"
import type { GraphStore } from "./store.js"

export async function trace(
  projectId: string,
  fromNodeId: string,
  toNodeId: string,
  store: GraphStore,
): Promise<TraceResult> {
  const MAX_DEPTH = 20

  // BFS from fromNodeId following outgoing edges
  const queue: Array<{ id: string; depth: number }> = [{ id: fromNodeId, depth: 0 }]
  const visited = new Set<string>([fromNodeId])
  // parentMap: nodeId -> { parentId, edge that led here }
  const parentMap = new Map<string, { parentId: string; edge: GraphEdge }>()

  let found = false

  while (queue.length > 0) {
    const item = queue.shift()
    if (item === undefined) break
    if (item.id === toNodeId) {
      found = true
      break
    }
    if (item.depth >= MAX_DEPTH) continue

    const outgoing = await store.getEdgesFrom(projectId, item.id)
    for (const edge of outgoing) {
      if (!visited.has(edge.targetNodeId)) {
        visited.add(edge.targetNodeId)
        parentMap.set(edge.targetNodeId, { parentId: item.id, edge })
        queue.push({ id: edge.targetNodeId, depth: item.depth + 1 })
      }
    }
  }

  if (!found) {
    return { path: [], edges: [], found: false }
  }

  // Reconstruct path from toNodeId back to fromNodeId
  const pathNodeIds: string[] = []
  const pathEdges: GraphEdge[] = []

  let current = toNodeId
  while (current !== fromNodeId) {
    pathNodeIds.unshift(current)
    const entry = parentMap.get(current)
    if (entry === undefined) break
    pathEdges.unshift(entry.edge)
    current = entry.parentId
  }
  pathNodeIds.unshift(fromNodeId)

  // Fetch node objects for the path
  const pathNodes: GraphNode[] = []
  for (const nodeId of pathNodeIds) {
    const node = await store.getNode(projectId, nodeId)
    if (node !== null) {
      pathNodes.push(node)
    }
  }

  return { path: pathNodes, edges: pathEdges, found: true }
}
