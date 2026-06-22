import type { GraphNode, GraphEdge, GraphEntityType, ScannedDoc } from "@loopforge/core"
import type { GraphStore } from "./store.js"

const ENTITY_TYPE_MAP: Record<string, GraphEntityType> = {
  prd: "prd",
  brd: "architecture_doc",
  frd: "spec",
  adr: "adr",
  spec: "spec",
  readme: "architecture_doc",
  claude_md: "prd",
  unknown_doc: "spec",
}

export async function ingestScannedDocs(
  projectId: string,
  docs: ScannedDoc[],
  store: GraphStore,
): Promise<void> {
  const now = new Date()

  for (const doc of docs) {
    const entityType: GraphEntityType = ENTITY_TYPE_MAP[doc.type] ?? "spec"
    const nodeId = `${entityType}:${doc.relPath.replace(/\//g, "-")}`

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

    if (["prd", "brd", "frd", "claude_md"].includes(doc.type)) {
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

        const edge: GraphEdge = {
          id: `DEFINES:${nodeId}:${reqId}`,
          projectId,
          sourceNodeId: nodeId,
          targetNodeId: reqId,
          relationship: "DEFINES",
          confidence: 0.9,
          metadata: {},
          createdAt: now,
        }
        await store.upsertEdge(edge)
      }
    }
  }
}
