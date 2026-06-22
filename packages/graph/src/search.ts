import type { GraphNode, GraphEntityType } from "@loopforge/core"

export function searchNodes(
  nodes: GraphNode[],
  query: string,
  entityType?: GraphEntityType,
): GraphNode[] {
  const q = query.toLowerCase()

  const filtered = entityType !== undefined
    ? nodes.filter((n) => n.entityType === entityType)
    : nodes

  type ScoredNode = { node: GraphNode; score: number }
  const scored: ScoredNode[] = []

  for (const node of filtered) {
    const titleLower = node.title.toLowerCase()

    // Check metadata string values
    const metadataMatch = Object.values(node.metadata).some(
      (v) => typeof v === "string" && v.toLowerCase().includes(q),
    )

    if (titleLower === q) {
      scored.push({ node, score: 3 })
    } else if (titleLower.includes(q)) {
      scored.push({ node, score: 2 })
    } else if (metadataMatch) {
      scored.push({ node, score: 1 })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.node)
}
