import type { EvalStore } from "./store.js"
import { isRegression } from "./scorer.js"

export async function detectRegression(
  projectId: string,
  criteriaId: string,
  targetId: string,
  newScore: number,
  store: EvalStore,
): Promise<boolean> {
  const last = await store.getLastRun(projectId, criteriaId, targetId)
  return isRegression(newScore, last?.score)
}
