import type { Spec } from "@devos/core"

// Extract ticket references from spec content: looks for "TICKET-{id}" or "#ticket-{id}" patterns
export function extractTicketRefs(content: string): string[] {
  const refs = new Set<string>()

  // Match TICKET-{id} pattern (case-insensitive)
  const upperMatches = content.matchAll(/\bTICKET-(\w+)\b/gi)
  for (const match of upperMatches) {
    const id = match[1]
    if (id !== undefined) refs.add(id)
  }

  // Match #ticket-{id} pattern (case-insensitive)
  const hashMatches = content.matchAll(/#ticket-(\w+)\b/gi)
  for (const match of hashMatches) {
    const id = match[1]
    if (id !== undefined) refs.add(id)
  }

  return Array.from(refs)
}

// Extract ADR references: looks for "ADR-{number}" patterns
export function extractAdrRefs(content: string): string[] {
  const refs = new Set<string>()

  const matches = content.matchAll(/\bADR-(\d+)\b/gi)
  for (const match of matches) {
    const num = match[1]
    if (num !== undefined) refs.add(num)
  }

  return Array.from(refs)
}

// Generate a traceability summary for a spec
export function buildTraceabilityReport(
  spec: Spec,
  ticketTitles: Record<string, string>,
  adrTitles: Record<string, string>,
): string {
  const lines: string[] = [
    `# Traceability Report: ${spec.title}`,
    "",
    `**Spec ID:** ${spec.id}`,
    `**Type:** ${spec.type}`,
    `**Status:** ${spec.status}`,
    `**Version:** ${spec.version}`,
    "",
  ]

  // Linked tickets
  lines.push("## Linked Tickets")
  if (spec.linkedTicketIds.length === 0) {
    lines.push("_No linked tickets._")
  } else {
    for (const ticketId of spec.linkedTicketIds) {
      const title = ticketTitles[ticketId]
      if (title !== undefined) {
        lines.push(`- **TICKET-${ticketId}**: ${title}`)
      } else {
        lines.push(`- **TICKET-${ticketId}**: _(title unknown)_`)
      }
    }
  }

  lines.push("")

  // Linked ADRs
  lines.push("## Linked ADRs")
  if (spec.linkedAdrIds.length === 0) {
    lines.push("_No linked ADRs._")
  } else {
    for (const adrId of spec.linkedAdrIds) {
      const title = adrTitles[adrId]
      if (title !== undefined) {
        lines.push(`- **ADR-${adrId}**: ${title}`)
      } else {
        lines.push(`- **ADR-${adrId}**: _(title unknown)_`)
      }
    }
  }

  lines.push("")

  // Approval info
  if (spec.status === "approved" && spec.approvedBy !== undefined) {
    lines.push("## Approval")
    lines.push(`- **Approved by:** ${spec.approvedBy}`)
    if (spec.approvedAt !== undefined) {
      lines.push(`- **Approved at:** ${spec.approvedAt.toISOString()}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
