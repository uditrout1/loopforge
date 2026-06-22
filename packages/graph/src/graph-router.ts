import { Hono } from "hono"
import type { Context } from "hono"
import { randomUUID } from "node:crypto"
import type { GraphEntityType, GraphRelationship, GraphNode, GraphEdge } from "@loopforge/core"
import type { GraphStore } from "./store.js"
import { searchNodes } from "./search.js"
import { trace } from "./traversal.js"

type CreateNodeBody = {
  entityType: GraphEntityType
  title: string
  metadata?: Record<string, unknown>
  sourceSystem: string
  sourceId: string
}

type CreateEdgeBody = {
  sourceNodeId: string
  targetNodeId: string
  relationship: GraphRelationship
  confidence?: number
  metadata?: Record<string, unknown>
}

function parseMaxDepth(val: string | undefined): number | undefined {
  if (val === undefined) return undefined
  const n = parseInt(val, 10)
  return isNaN(n) ? undefined : n
}

function requireParam(c: Context, name: string): string | null {
  const val = c.req.param(name)
  return val ?? null
}

export function createGraphRouter(store: GraphStore): Hono {
  const app = new Hono()

  // GET /graph/:projectId/summary
  app.get("/:projectId/summary", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const summary = await store.getSummary(projectId)
    return c.json(summary)
  })

  // GET /graph/:projectId/nodes
  app.get("/:projectId/nodes", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const typeParam = c.req.query("type") as GraphEntityType | undefined
    const nodes = await store.listNodes(projectId, typeParam)
    return c.json({ nodes })
  })

  // GET /graph/:projectId/nodes/:nodeId
  app.get("/:projectId/nodes/:nodeId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const nodeId = requireParam(c, "nodeId")
    if (!projectId || !nodeId) return c.json({ error: "projectId and nodeId required" }, 400)
    const node = await store.getNode(projectId, nodeId)
    if (!node) return c.json({ error: "Node not found" }, 404)
    const edgesOut = await store.getEdgesFrom(projectId, nodeId)
    const edgesIn = await store.getEdgesTo(projectId, nodeId)
    return c.json({ node, edgesOut, edgesIn })
  })

  // GET /graph/:projectId/nodes/:nodeId/upstream
  app.get("/:projectId/nodes/:nodeId/upstream", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const nodeId = requireParam(c, "nodeId")
    if (!projectId || !nodeId) return c.json({ error: "projectId and nodeId required" }, 400)
    const maxDepth = parseMaxDepth(c.req.query("maxDepth"))
    const subgraph = await store.getUpstream(projectId, nodeId, maxDepth)
    return c.json(subgraph)
  })

  // GET /graph/:projectId/nodes/:nodeId/downstream
  app.get("/:projectId/nodes/:nodeId/downstream", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const nodeId = requireParam(c, "nodeId")
    if (!projectId || !nodeId) return c.json({ error: "projectId and nodeId required" }, 400)
    const maxDepth = parseMaxDepth(c.req.query("maxDepth"))
    const subgraph = await store.getDownstream(projectId, nodeId, maxDepth)
    return c.json(subgraph)
  })

  // GET /graph/:projectId/trace?from=&to=
  app.get("/:projectId/trace", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const from = c.req.query("from")
    const to = c.req.query("to")
    if (!from || !to) return c.json({ error: "from and to query params are required" }, 400)
    const result = await trace(projectId, from, to, store)
    return c.json(result)
  })

  // GET /graph/:projectId/search?q=&type=
  app.get("/:projectId/search", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const q = c.req.query("q") ?? ""
    const typeParam = c.req.query("type") as GraphEntityType | undefined
    const allNodes = await store.listNodes(projectId)
    const results = searchNodes(allNodes, q, typeParam)
    return c.json({ nodes: results })
  })

  // POST /graph/:projectId/nodes
  app.post("/:projectId/nodes", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const body = await c.req.json() as CreateNodeBody
    const entityType = body.entityType
    const title = body.title
    const sourceSystem = body.sourceSystem
    const sourceId = body.sourceId
    if (!entityType || !title || !sourceSystem || !sourceId) {
      return c.json({ error: "entityType, title, sourceSystem, sourceId are required" }, 400)
    }
    const now = new Date()
    const node: GraphNode = {
      id: `${entityType}:${sourceId}`,
      projectId,
      entityType,
      title,
      metadata: body.metadata ?? {},
      sourceSystem,
      sourceId,
      createdAt: now,
      updatedAt: now,
    }
    await store.upsertNode(node)
    return c.json({ node }, 201)
  })

  // POST /graph/:projectId/edges
  app.post("/:projectId/edges", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    if (!projectId) return c.json({ error: "projectId required" }, 400)
    const body = await c.req.json() as CreateEdgeBody
    const sourceNodeId = body.sourceNodeId
    const targetNodeId = body.targetNodeId
    const relationship = body.relationship
    if (!sourceNodeId || !targetNodeId || !relationship) {
      return c.json({ error: "sourceNodeId, targetNodeId, relationship are required" }, 400)
    }
    const edge: GraphEdge = {
      id: `${relationship}:${sourceNodeId}:${targetNodeId}`,
      projectId,
      sourceNodeId,
      targetNodeId,
      relationship,
      confidence: body.confidence ?? 1.0,
      metadata: body.metadata ?? {},
      createdAt: new Date(),
    }
    await store.upsertEdge(edge)
    return c.json({ edge }, 201)
  })

  // DELETE /graph/:projectId/nodes/:nodeId
  app.delete("/:projectId/nodes/:nodeId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const nodeId = requireParam(c, "nodeId")
    if (!projectId || !nodeId) return c.json({ error: "projectId and nodeId required" }, 400)
    await store.deleteNode(projectId, nodeId)
    return c.json({ deleted: true })
  })

  // DELETE /graph/:projectId/edges/:edgeId
  app.delete("/:projectId/edges/:edgeId", async (c: Context) => {
    const projectId = requireParam(c, "projectId")
    const edgeId = requireParam(c, "edgeId")
    if (!projectId || !edgeId) return c.json({ error: "projectId and edgeId required" }, 400)
    await store.deleteEdge(projectId, edgeId)
    return c.json({ deleted: true })
  })

  // Suppress unused import warning
  void randomUUID

  return app
}
