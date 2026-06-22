import type { EvalCriteria, EvalRun, EvalFeedback } from "@loopforge/core"

export interface EvalStore {
  saveCriteria(criteria: EvalCriteria): Promise<void>
  getCriteria(projectId: string, criteriaId: string): Promise<EvalCriteria | null>
  listCriteria(projectId: string): Promise<EvalCriteria[]>
  deleteCriteria(projectId: string, criteriaId: string): Promise<void>
  saveRun(run: EvalRun): Promise<void>
  getRun(projectId: string, runId: string): Promise<EvalRun | null>
  listRuns(projectId: string, criteriaId?: string): Promise<EvalRun[]>
  getLastRun(projectId: string, criteriaId: string, targetId: string): Promise<EvalRun | null>
  saveFeedback(feedback: EvalFeedback): Promise<void>
  getFeedbackForRun(projectId: string, runId: string): Promise<EvalFeedback[]>
}

export function createInMemoryEvalStore(): EvalStore {
  const criteriaMap = new Map<string, EvalCriteria>()
  const runsMap = new Map<string, EvalRun>()
  const feedbackMap = new Map<string, EvalFeedback>()

  function criteriaKey(projectId: string, criteriaId: string): string {
    return `${projectId}:${criteriaId}`
  }

  function runKey(projectId: string, runId: string): string {
    return `${projectId}:${runId}`
  }

  return {
    async saveCriteria(criteria) {
      criteriaMap.set(criteriaKey(criteria.projectId, criteria.id), criteria)
    },

    async getCriteria(projectId, criteriaId) {
      return criteriaMap.get(criteriaKey(projectId, criteriaId)) ?? null
    },

    async listCriteria(projectId) {
      const results: EvalCriteria[] = []
      for (const [key, c] of criteriaMap) {
        if (key.startsWith(`${projectId}:`)) results.push(c)
      }
      return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },

    async deleteCriteria(projectId, criteriaId) {
      criteriaMap.delete(criteriaKey(projectId, criteriaId))
    },

    async saveRun(run) {
      runsMap.set(runKey(run.projectId, run.id), run)
    },

    async getRun(projectId, runId) {
      return runsMap.get(runKey(projectId, runId)) ?? null
    },

    async listRuns(projectId, criteriaId) {
      const results: EvalRun[] = []
      for (const [key, r] of runsMap) {
        if (!key.startsWith(`${projectId}:`)) continue
        if (criteriaId !== undefined && r.criteriaId !== criteriaId) continue
        results.push(r)
      }
      return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },

    async getLastRun(projectId, criteriaId, targetId) {
      let last: EvalRun | null = null
      for (const [key, r] of runsMap) {
        if (!key.startsWith(`${projectId}:`)) continue
        if (r.criteriaId !== criteriaId || r.targetId !== targetId) continue
        if (r.status !== "passed" && r.status !== "failed") continue
        if (!last || r.createdAt.getTime() > last.createdAt.getTime()) last = r
      }
      return last
    },

    async saveFeedback(feedback) {
      feedbackMap.set(feedback.id, feedback)
    },

    async getFeedbackForRun(projectId, runId) {
      const results: EvalFeedback[] = []
      for (const f of feedbackMap.values()) {
        if (f.projectId === projectId && f.runId === runId) results.push(f)
      }
      return results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    },
  }
}
