import { randomUUID } from "node:crypto"
import type { Spec, ADR, Ticket, VisualAsset, GraphNode, GraphEdge, GraphRelationship } from "@loopforge/core"
import type { GraphStore } from "./store.js"

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeNode(
  projectId: string,
  id: string,
  entityType: GraphNode["entityType"],
  title: string,
  metadata: Record<string, unknown>,
  sourceSystem: string,
  sourceId: string,
): GraphNode {
  const now = new Date()
  return {
    id,
    projectId,
    entityType,
    title,
    metadata,
    sourceSystem,
    sourceId,
    createdAt: now,
    updatedAt: now,
  }
}

function makeEdge(
  projectId: string,
  sourceNodeId: string,
  targetNodeId: string,
  relationship: GraphRelationship,
  confidence: number,
  metadata: Record<string, unknown> = {},
): GraphEdge {
  return {
    id: `${relationship}:${sourceNodeId}:${targetNodeId}`,
    projectId,
    sourceNodeId,
    targetNodeId,
    relationship,
    confidence,
    metadata,
    createdAt: new Date(),
  }
}

// ─── Ingest functions ─────────────────────────────────────────────────────────

export async function ingestSpec(spec: Spec, store: GraphStore): Promise<void> {
  const nodeId = `spec:${spec.id}`

  // 1. Upsert spec node
  await store.upsertNode(makeNode(
    spec.projectId,
    nodeId,
    "spec",
    spec.title,
    { type: spec.type, status: spec.status, version: spec.version },
    "spec",
    spec.id,
  ))

  // 2. For each linkedAdrId, upsert REFERENCES edge
  for (const adrId of spec.linkedAdrIds) {
    await store.upsertEdge(makeEdge(spec.projectId, nodeId, `adr:${adrId}`, "REFERENCES", 0.95))
  }

  // 3. For each linkedTicketId, upsert IMPLEMENTS edge
  for (const ticketId of spec.linkedTicketIds) {
    await store.upsertEdge(makeEdge(spec.projectId, nodeId, `ticket:${ticketId}`, "IMPLEMENTS", 0.95))
  }

  // 4. Extract bullet-point lines from spec.content, create requirement nodes
  const lines = spec.content.split("\n")
  const bulletRe = /^(?:-\s|\*\s|\d+\.\s)/
  let reqIndex = 0

  for (const line of lines) {
    if (reqIndex >= 20) break
    if (!bulletRe.test(line)) continue

    const text = line.replace(/^(?:-\s|\*\s|\d+\.\s)/, "").trim()
    if (!text) continue

    const reqId = `requirement:${spec.id}:${reqIndex}`
    await store.upsertNode(makeNode(
      spec.projectId,
      reqId,
      "requirement",
      text,
      {},
      "spec",
      `${spec.id}:${reqIndex}`,
    ))
    await store.upsertEdge(makeEdge(spec.projectId, nodeId, reqId, "REQUIRES", 1.0))
    reqIndex++
  }
}

export async function ingestADR(adr: ADR, store: GraphStore): Promise<void> {
  const nodeId = `adr:${adr.id}`

  // 1. Upsert adr node
  await store.upsertNode(makeNode(
    adr.projectId,
    nodeId,
    "adr",
    adr.title,
    { number: adr.number, status: adr.status },
    "adr",
    adr.id,
  ))

  // 2. If supersededBy, upsert SUPERSEDES edge
  if (adr.supersededBy !== undefined) {
    await store.upsertEdge(makeEdge(adr.projectId, nodeId, `adr:${adr.supersededBy}`, "SUPERSEDES", 1.0))
  }

  // 3. For each linkedSpecId, upsert REFERENCES edge
  for (const specId of adr.linkedSpecIds) {
    await store.upsertEdge(makeEdge(adr.projectId, nodeId, `spec:${specId}`, "REFERENCES", 0.95))
  }

  // 4. For each linkedTicketId, upsert REFERENCES edge
  for (const ticketId of adr.linkedTicketIds) {
    await store.upsertEdge(makeEdge(adr.projectId, nodeId, `ticket:${ticketId}`, "REFERENCES", 0.95))
  }
}

export async function ingestTicket(ticket: Ticket, store: GraphStore): Promise<void> {
  const nodeId = `ticket:${ticket.id}`

  // 1. Upsert ticket node
  await store.upsertNode(makeNode(
    ticket.projectId,
    nodeId,
    "ticket",
    ticket.title,
    { type: ticket.type, status: ticket.status, priorityScore: ticket.priorityScore },
    "backlog",
    ticket.id,
  ))

  // 2. For each linkedFile, upsert IMPLEMENTS edge + stub file node
  for (const filePath of ticket.linkedFiles) {
    const fileNodeId = `file:${filePath}`
    const existing = await store.getNode(ticket.projectId, fileNodeId)
    if (existing === null) {
      await store.upsertNode(makeNode(
        ticket.projectId,
        fileNodeId,
        "file",
        filePath,
        {},
        "manual",
        filePath,
      ))
    }
    await store.upsertEdge(makeEdge(ticket.projectId, nodeId, fileNodeId, "IMPLEMENTS", 0.9))
  }

  // 3. For each linkedPr, upsert INCLUDED_IN edge
  for (const pr of ticket.linkedPrs) {
    await store.upsertEdge(makeEdge(ticket.projectId, nodeId, `pull_request:${pr}`, "INCLUDED_IN", 0.9))
  }
}

export async function ingestVisualAsset(asset: VisualAsset, store: GraphStore): Promise<void> {
  const nodeId = `visual_asset:${asset.id}`

  // 1. Upsert visual_asset node
  await store.upsertNode(makeNode(
    asset.projectId,
    nodeId,
    "visual_asset",
    asset.name,
    { type: asset.type, ...(asset.url !== undefined ? { url: asset.url } : {}) },
    "vision",
    asset.id,
  ))

  // 2. For each linkedFilePath, upsert REFERENCES edge + stub file node
  for (const filePath of asset.linkedFilePaths) {
    const fileNodeId = `file:${filePath}`
    const existing = await store.getNode(asset.projectId, fileNodeId)
    if (existing === null) {
      await store.upsertNode(makeNode(
        asset.projectId,
        fileNodeId,
        "file",
        filePath,
        {},
        "manual",
        filePath,
      ))
    }
    await store.upsertEdge(makeEdge(asset.projectId, nodeId, fileNodeId, "REFERENCES", 0.9))
  }

  // 3. For each linkedTicketId, upsert REFERENCES edge
  for (const ticketId of asset.linkedTicketIds) {
    await store.upsertEdge(makeEdge(asset.projectId, nodeId, `ticket:${ticketId}`, "REFERENCES", 0.9))
  }
}

export async function ingestFileIndex(
  projectId: string,
  filePaths: string[],
  store: GraphStore,
): Promise<void> {
  const repoNodeId = `repository:${projectId}`

  // 1. Upsert repository node
  await store.upsertNode(makeNode(
    projectId,
    repoNodeId,
    "repository",
    `Repository (${projectId})`,
    {},
    "manual",
    projectId,
  ))

  // 2. Batch process file paths (chunks of 50 for large repos)
  const CHUNK_SIZE = 50
  for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
    const chunk = filePaths.slice(i, i + CHUNK_SIZE)
    for (const filePath of chunk) {
      const fileNodeId = `file:${filePath}`
      await store.upsertNode(makeNode(
        projectId,
        fileNodeId,
        "file",
        filePath,
        {},
        "manual",
        filePath,
      ))
      await store.upsertEdge(makeEdge(projectId, repoNodeId, fileNodeId, "CONTAINS", 1.0))
    }
    // Yield to event loop between chunks for large repos
    if (filePaths.length > 500 && i + CHUNK_SIZE < filePaths.length) {
      await new Promise<void>((resolve) => setImmediate(resolve))
    }
  }
}

// Re-export for external use
export { makeEdge }

// Suppress unused import warning — randomUUID is available for callers if needed
void randomUUID
