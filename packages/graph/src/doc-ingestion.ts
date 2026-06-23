import { randomUUID } from "node:crypto"
import type { GraphNode, GraphEdge, GraphEntityType, ScannedDoc } from "@loopforge/core"
import type { GraphStore } from "./store.js"

const ENTITY_TYPE_MAP: Record<string, GraphEntityType> = {
  prd:        "prd",
  brd:        "architecture_doc",
  frd:        "spec",
  adr:        "adr",
  spec:       "spec",
  readme:     "architecture_doc",
  claude_md:  "prd",
  unknown_doc: "spec",
}

function makeNodeId(entityType: GraphEntityType, relPath: string): string {
  return `${entityType}:${relPath.replace(/\//g, "-")}`
}

function extractHeadings(content: string): string[] {
  return content
    .split("\n")
    .filter(l => /^#{2,3} .{3,}/.test(l))
    .map(l => l.replace(/^#+\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 10)
}

export async function ingestScannedDocs(
  projectId: string,
  docs: ScannedDoc[],
  store: GraphStore,
): Promise<void> {
  const now = new Date()

  // Track nodeId by docType so we can wire cross-doc edges afterward
  const nodeIdByType: Record<string, string> = {}
  const allDocNodeIds: string[] = []

  // ── Pass 1: create a node per doc ───────────────────────────────────────────
  for (const doc of docs) {
    const entityType: GraphEntityType = ENTITY_TYPE_MAP[doc.type] ?? "spec"
    const nodeId = makeNodeId(entityType, doc.relPath)

    const node: GraphNode = {
      id: nodeId,
      projectId,
      entityType,
      title: doc.title,
      metadata: {
        relPath: doc.relPath,
        docType: doc.type,
        contentLength: doc.content.length,
        preview: doc.content.slice(0, 300),
      },
      sourceSystem: "doc-scanner",
      sourceId: doc.relPath,
      createdAt: now,
      updatedAt: now,
    }
    await store.upsertNode(node)
    nodeIdByType[doc.type] = nodeId
    allDocNodeIds.push(nodeId)
  }

  // ── Pass 2: requirement children from PRD-class docs ────────────────────────
  for (const doc of docs) {
    if (!["prd", "brd", "frd", "claude_md"].includes(doc.type)) continue
    const entityType: GraphEntityType = ENTITY_TYPE_MAP[doc.type] ?? "spec"
    const parentNodeId = makeNodeId(entityType, doc.relPath)

    const reqLines = doc.content
      .split("\n")
      .filter(l => /^[-*]\s+.{10,}/.test(l) || /^#{2,3}\s+.{5,}/.test(l))
      .slice(0, 15)

    for (const line of reqLines) {
      const text = line.replace(/^[-*#\s]+/, "").trim()
      if (text.length < 10) continue

      const reqId = `requirement:${doc.relPath}-${Buffer.from(text).toString("base64").slice(0, 12)}`
      const reqNode: GraphNode = {
        id: reqId,
        projectId,
        entityType: "requirement",
        title: text.slice(0, 120),
        metadata: { sourceDoc: doc.relPath },
        sourceSystem: "doc-scanner",
        sourceId: reqId,
        createdAt: now,
        updatedAt: now,
      }
      await store.upsertNode(reqNode)

      await store.upsertEdge({
        id: `DEFINES:${parentNodeId}:${reqId}`,
        projectId,
        sourceNodeId: parentNodeId,
        targetNodeId: reqId,
        relationship: "DEFINES",
        confidence: 0.9,
        metadata: {},
        createdAt: now,
      })
    }
  }

  // ── Pass 3: module nodes from headings in architecture_doc / spec / readme ──
  for (const doc of docs) {
    if (!["readme", "brd", "spec"].includes(doc.type)) continue
    const parentEntityType: GraphEntityType = ENTITY_TYPE_MAP[doc.type] ?? "spec"
    const parentNodeId = makeNodeId(parentEntityType, doc.relPath)
    const headings = extractHeadings(doc.content)

    for (const heading of headings) {
      const moduleId = `module:${doc.relPath}-${Buffer.from(heading).toString("base64").slice(0, 10)}`
      const moduleNode: GraphNode = {
        id: moduleId,
        projectId,
        entityType: "module",
        title: heading,
        metadata: { sourceDoc: doc.relPath },
        sourceSystem: "doc-scanner",
        sourceId: moduleId,
        createdAt: now,
        updatedAt: now,
      }
      await store.upsertNode(moduleNode)

      await store.upsertEdge({
        id: `CONTAINS:${parentNodeId}:${moduleId}`,
        projectId,
        sourceNodeId: parentNodeId,
        targetNodeId: moduleId,
        relationship: "CONTAINS",
        confidence: 0.85,
        metadata: {},
        createdAt: now,
      })
    }
  }

  // ── Pass 4: cross-doc edges ─────────────────────────────────────────────────
  // Find the primary spec document (prd or claude_md)
  const primaryPrdId = nodeIdByType["prd"] ?? nodeIdByType["claude_md"]

  for (const doc of docs) {
    const entityType: GraphEntityType = ENTITY_TYPE_MAP[doc.type] ?? "spec"
    const nodeId = makeNodeId(entityType, doc.relPath)

    // architecture_doc / readme / brd IMPLEMENTS the prd
    if (primaryPrdId && nodeId !== primaryPrdId && ["readme", "brd"].includes(doc.type)) {
      await store.upsertEdge({
        id: `IMPLEMENTS:${nodeId}:${primaryPrdId}`,
        projectId,
        sourceNodeId: nodeId,
        targetNodeId: primaryPrdId,
        relationship: "IMPLEMENTS",
        confidence: 0.75,
        metadata: {},
        createdAt: now,
      })
    }

    // spec / frd / adr REFERENCES the prd
    if (primaryPrdId && nodeId !== primaryPrdId && ["spec", "frd", "adr"].includes(doc.type)) {
      await store.upsertEdge({
        id: `REFERENCES:${nodeId}:${primaryPrdId}`,
        projectId,
        sourceNodeId: nodeId,
        targetNodeId: primaryPrdId,
        relationship: "REFERENCES",
        confidence: 0.7,
        metadata: {},
        createdAt: now,
      })
    }

    // frd IMPLEMENTS brd if both exist
    const brdId = nodeIdByType["brd"]
    if (brdId && doc.type === "frd" && nodeId !== brdId) {
      await store.upsertEdge({
        id: `IMPLEMENTS:${nodeId}:${brdId}`,
        projectId,
        sourceNodeId: nodeId,
        targetNodeId: brdId,
        relationship: "IMPLEMENTS",
        confidence: 0.8,
        metadata: {},
        createdAt: now,
      })
    }
  }
}
