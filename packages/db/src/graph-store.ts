import type {
  GraphNode, GraphEdge, GraphEntityType, GraphRelationship, GraphSubgraph,
} from "@loopforge/core"
import type { GraphStore } from "@loopforge/graph"
import type { SupabaseClient } from "./client.js"

interface NodeRow {
  id: string
  project_id: string
  entity_type: string
  title: string
  metadata: unknown
  source_system: string
  source_id: string
  created_at: string
  updated_at: string
}

interface EdgeRow {
  id: string
  project_id: string
  source_node_id: string
  target_node_id: string
  relationship: string
  confidence: number
  metadata: unknown
  created_at: string
}

function nodeFromRow(r: NodeRow): GraphNode {
  return {
    id: r.id,
    projectId: r.project_id,
    entityType: r.entity_type as GraphEntityType,
    title: r.title,
    metadata: r.metadata as Record<string, unknown>,
    sourceSystem: r.source_system,
    sourceId: r.source_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function edgeFromRow(r: EdgeRow): GraphEdge {
  return {
    id: r.id,
    projectId: r.project_id,
    sourceNodeId: r.source_node_id,
    targetNodeId: r.target_node_id,
    relationship: r.relationship as GraphRelationship,
    confidence: r.confidence,
    metadata: r.metadata as Record<string, unknown>,
    createdAt: new Date(r.created_at),
  }
}

export function createSupabaseGraphStore(client: SupabaseClient): GraphStore {
  return {
    async upsertNode(node: GraphNode): Promise<void> {
      const { error } = await client.from("lf_graph_nodes").upsert({
        id: node.id,
        project_id: node.projectId,
        entity_type: node.entityType,
        title: node.title,
        metadata: node.metadata,
        source_system: node.sourceSystem,
        source_id: node.sourceId,
        created_at: node.createdAt.toISOString(),
        updated_at: node.updatedAt.toISOString(),
      }, { onConflict: "project_id,id" })
      if (error) throw new Error(`upsertNode failed: ${error.message}`)
    },

    async getNode(projectId: string, nodeId: string): Promise<GraphNode | null> {
      const { data, error } = await client
        .from("lf_graph_nodes").select("*")
        .eq("project_id", projectId).eq("id", nodeId).single<NodeRow>()
      if (error) {
        if (error.code === "PGRST116") return null
        throw new Error(`getNode failed: ${error.message}`)
      }
      return data ? nodeFromRow(data) : null
    },

    async listNodes(projectId: string, entityType?: GraphEntityType): Promise<GraphNode[]> {
      let q = client.from("lf_graph_nodes").select("*").eq("project_id", projectId)
      if (entityType !== undefined) q = q.eq("entity_type", entityType)
      const { data, error } = await q
      if (error) throw new Error(`listNodes failed: ${error.message}`)
      return (data as NodeRow[] ?? []).map(nodeFromRow)
    },

    async deleteNode(projectId: string, nodeId: string): Promise<void> {
      const { error } = await client
        .from("lf_graph_nodes").delete()
        .eq("project_id", projectId).eq("id", nodeId)
      if (error) throw new Error(`deleteNode failed: ${error.message}`)
    },

    async upsertEdge(edge: GraphEdge): Promise<void> {
      const { error } = await client.from("lf_graph_edges").upsert({
        id: edge.id,
        project_id: edge.projectId,
        source_node_id: edge.sourceNodeId,
        target_node_id: edge.targetNodeId,
        relationship: edge.relationship,
        confidence: edge.confidence,
        metadata: edge.metadata,
        created_at: edge.createdAt.toISOString(),
      }, { onConflict: "project_id,id" })
      if (error) throw new Error(`upsertEdge failed: ${error.message}`)
    },

    async getEdgesFrom(projectId: string, nodeId: string, relationship?: GraphRelationship): Promise<GraphEdge[]> {
      let q = client.from("lf_graph_edges").select("*")
        .eq("project_id", projectId).eq("source_node_id", nodeId)
      if (relationship !== undefined) q = q.eq("relationship", relationship)
      const { data, error } = await q
      if (error) throw new Error(`getEdgesFrom failed: ${error.message}`)
      return (data as EdgeRow[] ?? []).map(edgeFromRow)
    },

    async getEdgesTo(projectId: string, nodeId: string, relationship?: GraphRelationship): Promise<GraphEdge[]> {
      let q = client.from("lf_graph_edges").select("*")
        .eq("project_id", projectId).eq("target_node_id", nodeId)
      if (relationship !== undefined) q = q.eq("relationship", relationship)
      const { data, error } = await q
      if (error) throw new Error(`getEdgesTo failed: ${error.message}`)
      return (data as EdgeRow[] ?? []).map(edgeFromRow)
    },

    async deleteEdge(projectId: string, edgeId: string): Promise<void> {
      const { error } = await client
        .from("lf_graph_edges").delete()
        .eq("project_id", projectId).eq("id", edgeId)
      if (error) throw new Error(`deleteEdge failed: ${error.message}`)
    },

    async getUpstream(projectId: string, nodeId: string, maxDepth = 15): Promise<GraphSubgraph> {
      const visitedNodes = new Set<string>()
      const visitedEdges = new Set<string>()
      const resultNodes: GraphNode[] = []
      const resultEdges: GraphEdge[] = []
      const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]
      visitedNodes.add(nodeId)

      while (queue.length > 0) {
        const item = queue.shift()
        if (item === undefined) break
        if (item.depth >= maxDepth) continue
        const incoming = await this.getEdgesTo(projectId, item.id)
        for (const edge of incoming) {
          if (!visitedEdges.has(edge.id)) { visitedEdges.add(edge.id); resultEdges.push(edge) }
          if (!visitedNodes.has(edge.sourceNodeId)) {
            visitedNodes.add(edge.sourceNodeId)
            const node = await this.getNode(projectId, edge.sourceNodeId)
            if (node) { resultNodes.push(node); queue.push({ id: edge.sourceNodeId, depth: item.depth + 1 }) }
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
      const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]
      visitedNodes.add(nodeId)

      while (queue.length > 0) {
        const item = queue.shift()
        if (item === undefined) break
        if (item.depth >= maxDepth) continue
        const outgoing = await this.getEdgesFrom(projectId, item.id)
        for (const edge of outgoing) {
          if (!visitedEdges.has(edge.id)) { visitedEdges.add(edge.id); resultEdges.push(edge) }
          if (!visitedNodes.has(edge.targetNodeId)) {
            visitedNodes.add(edge.targetNodeId)
            const node = await this.getNode(projectId, edge.targetNodeId)
            if (node) { resultNodes.push(node); queue.push({ id: edge.targetNodeId, depth: item.depth + 1 }) }
          }
        }
      }
      return { nodes: resultNodes, edges: resultEdges }
    },

    async getSummary(projectId: string) {
      const { data: nodeData, error: nodeErr } = await client
        .from("lf_graph_nodes").select("entity_type").eq("project_id", projectId)
      if (nodeErr) throw new Error(`getSummary nodes failed: ${nodeErr.message}`)

      const { count: edgeCount, error: edgeErr } = await client
        .from("lf_graph_edges").select("id", { count: "exact", head: true }).eq("project_id", projectId)
      if (edgeErr) throw new Error(`getSummary edges failed: ${edgeErr.message}`)

      const byType: Partial<Record<GraphEntityType, number>> = {}
      for (const row of (nodeData ?? []) as Array<{ entity_type: string }>) {
        const t = row.entity_type as GraphEntityType
        byType[t] = (byType[t] ?? 0) + 1
      }

      return { nodeCount: nodeData?.length ?? 0, edgeCount: edgeCount ?? 0, byType }
    },
  }
}
