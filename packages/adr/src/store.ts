import type { ADR, ADRStatus } from "@devos/core"

// ─── ADRStore interface ───────────────────────────────────────────────────────

export interface ADRStore {
  getADR(id: string): Promise<ADR | null>
  listADRs(projectId: string, status?: ADRStatus): Promise<ADR[]>
  getNextNumber(projectId: string): Promise<number>
  saveADR(adr: ADR): Promise<void>
  updateADR(id: string, updates: Partial<ADR>): Promise<void>
}

// ─── In-memory implementation ─────────────────────────────────────────────────

export function createInMemoryADRStore(): ADRStore {
  const adrs = new Map<string, ADR>()

  return {
    async getADR(id: string): Promise<ADR | null> {
      return adrs.get(id) ?? null
    },

    async listADRs(projectId: string, status?: ADRStatus): Promise<ADR[]> {
      const results: ADR[] = []
      for (const adr of adrs.values()) {
        if (adr.projectId !== projectId) continue
        if (status !== undefined && adr.status !== status) continue
        results.push(adr)
      }
      // Sort by number ascending
      results.sort((a, b) => a.number - b.number)
      return results
    },

    async getNextNumber(projectId: string): Promise<number> {
      let max = 0
      for (const adr of adrs.values()) {
        if (adr.projectId === projectId && adr.number > max) {
          max = adr.number
        }
      }
      return max + 1
    },

    async saveADR(adr: ADR): Promise<void> {
      adrs.set(adr.id, { ...adr })
    },

    async updateADR(id: string, updates: Partial<ADR>): Promise<void> {
      const adr = adrs.get(id)
      if (!adr) {
        throw new Error(`ADR not found: ${id}`)
      }
      adrs.set(id, { ...adr, ...updates, updatedAt: new Date() })
    },
  }
}
