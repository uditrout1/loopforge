import { randomUUID } from "node:crypto"
import { extractDecisions } from "./extractor.js"
import type { ADRStore } from "./store.js"
import type { RouterConfig } from "@loopforge/router"
import type { ADR, ADRStatus, Message } from "@loopforge/core"
import type { GraphStore } from "@loopforge/graph"
import { ingestADR } from "@loopforge/graph"

export class ADRService {
  constructor(
    private store: ADRStore,
    private routerConfig: RouterConfig,
    private graphStore?: GraphStore,
  ) {}

  async captureFromSession(
    projectId: string,
    sessionId: string,
    messages: Message[],
  ): Promise<ADR[]> {
    const extracted = await extractDecisions(projectId, sessionId, messages, this.routerConfig)
    if (!extracted || extracted.length === 0) return []

    const highConfidence = extracted.filter((d) => d.confidence === "high")
    const created: ADR[] = []

    for (const decision of highConfidence) {
      const adr = await this.createADR(
        projectId,
        decision.title,
        decision.context,
        decision.decision,
        decision.consequences,
      )
      created.push(adr)
    }

    return created
  }

  async createADR(
    projectId: string,
    title: string,
    context: string,
    decision: string,
    consequences: string,
  ): Promise<ADR> {
    const number = await this.store.getNextNumber(projectId)
    const now = new Date()

    const adr: ADR = {
      id: randomUUID(),
      projectId,
      number,
      title,
      context,
      decision,
      consequences,
      status: "proposed",
      linkedTicketIds: [],
      linkedSpecIds: [],
      createdAt: now,
      updatedAt: now,
    }

    await this.store.saveADR(adr)
    if (this.graphStore !== undefined) {
      ingestADR(adr, this.graphStore).catch(() => {})
    }
    return adr
  }

  async getADR(id: string): Promise<ADR | null> {
    return this.store.getADR(id)
  }

  async listADRs(projectId: string, status?: ADRStatus): Promise<ADR[]> {
    return this.store.listADRs(projectId, status)
  }

  async updateADR(id: string, updates: Partial<ADR>): Promise<void> {
    return this.store.updateADR(id, updates)
  }

  async getADRsAsMarkdown(projectId: string): Promise<string> {
    const adrs = await this.store.listADRs(projectId, "accepted")
    if (adrs.length === 0) return ""

    const lines: string[] = ["## Architecture Decisions", ""]

    for (const adr of adrs) {
      const num = String(adr.number).padStart(3, "0")
      lines.push(`### ADR-${num}: ${adr.title}`)
      lines.push(`**Status:** ${adr.status}`)
      lines.push(`**Decision:** ${adr.decision}`)
      lines.push(`**Consequences:** ${adr.consequences}`)
      lines.push("")
    }

    return lines.join("\n")
  }

  async supersedeADR(oldAdrId: string, newAdrId: string): Promise<void> {
    await this.store.updateADR(oldAdrId, {
      status: "superseded",
      supersededBy: newAdrId,
    })
  }
}
