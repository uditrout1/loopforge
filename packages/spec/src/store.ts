import type { Spec, SpecType } from "@devos/core"

export interface SpecStore {
  getSpec(id: string): Promise<Spec | null>
  listSpecs(projectId: string, type?: SpecType): Promise<Spec[]>
  saveSpec(spec: Spec): Promise<void>
  updateSpec(id: string, updates: Partial<Spec>): Promise<void>
}

export function createInMemorySpecStore(): SpecStore {
  const specs = new Map<string, Spec>()

  return {
    async getSpec(id: string): Promise<Spec | null> {
      return specs.get(id) ?? null
    },

    async listSpecs(projectId: string, type?: SpecType): Promise<Spec[]> {
      const result: Spec[] = []
      for (const spec of specs.values()) {
        if (spec.projectId !== projectId) continue
        if (type !== undefined && spec.type !== type) continue
        result.push(spec)
      }
      return result
    },

    async saveSpec(spec: Spec): Promise<void> {
      specs.set(spec.id, spec)
    },

    async updateSpec(id: string, updates: Partial<Spec>): Promise<void> {
      const existing = specs.get(id)
      if (!existing) throw new Error(`Spec not found: ${id}`)
      specs.set(id, { ...existing, ...updates })
    },
  }
}
