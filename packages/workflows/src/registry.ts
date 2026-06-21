import type { Workflow } from "@devos/core"
import { BUILT_IN_WORKFLOWS } from "./built-in-workflows.js"

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, Workflow>(
  BUILT_IN_WORKFLOWS.map((w) => [w.id, w]),
)

export function getWorkflow(id: string): Workflow | undefined {
  return registry.get(id)
}

export function listWorkflows(): Workflow[] {
  return Array.from(registry.values())
}

export function registerWorkflow(w: Workflow): void {
  registry.set(w.id, w)
}
