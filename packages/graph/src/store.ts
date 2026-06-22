import type { GraphNode, GraphEdge, GraphEntityType, GraphRelationship, GraphSubgraph } from "@loopforge/core"

export interface GraphStore {
  upsertNode(node: GraphNode): Promise<void>
  getNode(projectId: string, nodeId: string): Promise<GraphNode | null>
  listNodes(projectId: string, entityType?: GraphEntityType): Promise<GraphNode[]>
  deleteNode(projectId: string, nodeId: string): Promise<void>

  upsertEdge(edge: GraphEdge): Promise<void>
  getEdgesFrom(projectId: string, nodeId: string, relationship?: GraphRelationship): Promise<GraphEdge[]>
  getEdgesTo(projectId: string, nodeId: string, relationship?: GraphRelationship): Promise<GraphEdge[]>
  deleteEdge(projectId: string, edgeId: string): Promise<void>

  getUpstream(projectId: string, nodeId: string, maxDepth?: number): Promise<GraphSubgraph>
  getDownstream(projectId: string, nodeId: string, maxDepth?: number): Promise<GraphSubgraph>

  getSummary(projectId: string): Promise<{
    nodeCount: number
    edgeCount: number
    byType: Partial<Record<GraphEntityType, number>>
  }>
}

export function createInMemoryGraphStore(): GraphStore {
  const nodes = new Map<string, GraphNode>()
  const edges = new Map<string, GraphEdge>()

  function nodeKey(projectId: string, nodeId: string): string {
    return `${projectId}:${nodeId}`
  }

  function edgeKey(projectId: string, edgeId: string): string {
    return `${projectId}:${edgeId}`
  }

  return {
    async upsertNode(node: GraphNode): Promise<void> {
      const key = nodeKey(node.projectId, node.id)
      const existing = nodes.get(key)
      if (existing !== undefined) {
        nodes.set(key, {
          ...existing,
          title: node.title,
          metadata: node.metadata,
          updatedAt: node.updatedAt,
        })
      } else {
        nodes.set(key, node)
      }
    },

    async getNode(projectId: string, nodeId: string): Promise<GraphNode | null> {
      return nodes.get(nodeKey(projectId, nodeId)) ?? null
    },

    async listNodes(projectId: string, entityType?: GraphEntityType): Promise<GraphNode[]> {
      const results: GraphNode[] = []
      for (const [key, node] of nodes) {
        if (!key.startsWith(`${projectId}:`)) continue
        if (entityType !== undefined && node.entityType !== entityType) continue
        results.push(node)
      }
      return results
    },

    async deleteNode(projectId: string, nodeId: string): Promise<void> {
      nodes.delete(nodeKey(projectId, nodeId))
    },

    async upsertEdge(edge: GraphEdge): Promise<void> {
      const key = edgeKey(edge.projectId, edge.id)
      edges.set(key, edge)
    },

    async getEdgesFrom(projectId: string, nodeId: string, relationship?: GraphRelationship): Promise<GraphEdge[]> {
      const results: GraphEdge[] = []
      for (const [key, edge] of edges) {
        if (!key.startsWith(`${projectId}:`)) continue
        if (edge.sourceNodeId !== nodeId) continue
        if (relationship !== undefined && edge.relationship !== relationship) continue
        results.push(edge)
      }
      return results
    },

    async getEdgesTo(projectId: string, nodeId: string, relationship?: GraphRelationship): Promise<GraphEdge[]> {
      const results: GraphEdge[] = []
      for (const [key, edge] of edges) {
        if (!key.startsWith(`${projectId}:`)) continue
        if (edge.targetNodeId !== nodeId) continue
        if (relationship !== undefined && edge.relationship !== relationship) continue
        results.push(edge)
      }
      return results
    },

    async deleteEdge(projectId: string, edgeId: string): Promise<void> {
      edges.delete(edgeKey(projectId, edgeId))
    },

    async getUpstream(projectId: string, nodeId: string, maxDepth = 15): Promise<GraphSubgraph> {
      const visitedNodes = new Set<string>()
      const visitedEdges = new Set<string>()
      const resultNodes: GraphNode[] = []
      const resultEdges: GraphEdge[] = []

      // BFS traversing edges INTO the node (ancestors)
      const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]
      visitedNodes.add(nodeId)

      while (queue.length > 0) {
        const item = queue.shift()
        if (item === undefined) break
        if (item.depth >= maxDepth) continue

        const incoming = await this.getEdgesTo(projectId, item.id)
        for (const edge of incoming) {
          if (!visitedEdges.has(edge.id)) {
            visitedEdges.add(edge.id)
            resultEdges.push(edge)
          }
          if (!visitedNodes.has(edge.sourceNodeId)) {
            visitedNodes.add(edge.sourceNodeId)
            const node = await this.getNode(projectId, edge.sourceNodeId)
            if (node !== null) {
              resultNodes.push(node)
              queue.push({ id: edge.sourceNodeId, depth: item.depth + 1 })
            }
          }
        }
      }

      return { nodes: resultNodes, edges: resultEdges }
    },

    async getDownstream(projectId: string, nodeId: string, maxDepth = 15): Promise<GraphSubgraph> {
      const visitedNodes = new Set<string>()
      const visitedEdges = new Set<string>()
      const resultNodes: GraphNode[] = []
      const resultEdges: GraphEdge[] = []

      // BFS traversing edges OUT of the node (descendants)
      const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]
      visitedNodes.add(nodeId)

      while (queue.length > 0) {
        const item = queue.shift()
        if (item === undefined) break
        if (item.depth >= maxDepth) continue

        const outgoing = await this.getEdgesFrom(projectId, item.id)
        for (const edge of outgoing) {
          if (!visitedEdges.has(edge.id)) {
            visitedEdges.add(edge.id)
            resultEdges.push(edge)
          }
          if (!visitedNodes.has(edge.targetNodeId)) {
            visitedNodes.add(edge.targetNodeId)
            const node = await this.getNode(projectId, edge.targetNodeId)
            if (node !== null) {
              resultNodes.push(node)
              queue.push({ id: edge.targetNodeId, depth: item.depth + 1 })
            }
          }
        }
      }

      return { nodes: resultNodes, edges: resultEdges }
    },

    async getSummary(projectId: string): Promise<{
      nodeCount: number
      edgeCount: number
      byType: Partial<Record<GraphEntityType, number>>
    }> {
      let nodeCount = 0
      let edgeCount = 0
      const byType: Partial<Record<GraphEntityType, number>> = {}

      for (const [key, node] of nodes) {
        if (!key.startsWith(`${projectId}:`)) continue
        nodeCount++
        const prev = byType[node.entityType] ?? 0
        byType[node.entityType] = prev + 1
      }

      for (const [key] of edges) {
        if (!key.startsWith(`${projectId}:`)) continue
        edgeCount++
      }

      return { nodeCount, edgeCount, byType }
    },
  }
}
