import type { SessionContext, Project, Ticket, ContextChunk } from "@devos/core"

export interface BrainStore {
  getProject(projectId: string): Promise<Project | null>
  getLastSessionSummary(projectId: string): Promise<string | undefined>
  getOpenTickets(projectId: string, limit: number): Promise<Ticket[]>
  searchChunks(projectId: string, query: string, limit: number): Promise<ContextChunk[]>
  saveSessionSummary(projectId: string, summary: string): Promise<void>
}

export async function loadSessionContext(
  projectId: string,
  store: BrainStore,
  firstMessage?: string,
): Promise<SessionContext> {
  const [project, recentSummary, openTickets] = await Promise.all([
    store.getProject(projectId),
    store.getLastSessionSummary(projectId),
    store.getOpenTickets(projectId, 5),
  ])

  if (!project) {
    throw new Error(`Project ${projectId} not found`)
  }

  // Fetch relevant chunks only if we have an initial message to search against
  const relevantChunks = firstMessage
    ? await store.searchChunks(projectId, firstMessage, 5)
    : []

  return {
    project,
    ...(recentSummary !== undefined ? { recentSummary } : {}),
    openTickets,
    relevantChunks,
    activeSkills: [],
  }
}

export function formatContextAsSystemPrompt(ctx: SessionContext): string {
  const { project, recentSummary, openTickets, relevantChunks } = ctx

  const parts: string[] = [
    `# Project: ${project.name}`,
    `**Stack:** ${[
      ...project.stack.languages,
      ...project.stack.frameworks,
      ...project.stack.databases,
    ].join(", ")}`,
  ]

  if (project.knowledge.summary) {
    parts.push(`**Summary:** ${project.knowledge.summary}`)
  }

  if (project.knowledge.conventions && Object.keys(project.knowledge.conventions).length > 0) {
    const convLines = Object.entries(project.knowledge.conventions)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n")
    parts.push(`**Conventions:**\n${convLines}`)
  }

  if (project.knowledge.designConstraints.length > 0) {
    parts.push(`**Design constraints:** ${project.knowledge.designConstraints.join(", ")}`)
  }

  if (recentSummary) {
    parts.push(`## Last Session\n${recentSummary}`)
  }

  if (openTickets.length > 0) {
    const ticketLines = openTickets
      .map((t) => `- [${t.type.toUpperCase()}] ${t.title} (priority: ${t.priorityScore.toFixed(0)})`)
      .join("\n")
    parts.push(`## Open Tickets (Top ${openTickets.length})\n${ticketLines}`)
  }

  if (relevantChunks.length > 0) {
    const chunkBlocks = relevantChunks
      .map((c) => `### ${c.filePath}\n\`\`\`\n${c.content}\n\`\`\``)
      .join("\n\n")
    parts.push(`## Relevant Code\n${chunkBlocks}`)
  }

  return parts.join("\n\n")
}
