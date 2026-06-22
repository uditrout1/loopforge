import type { Goal } from "@loopforge/core"

export interface GoalStore {
  saveGoal(goal: Goal): Promise<void>
  getGoal(projectId: string, goalId: string): Promise<Goal | null>
  listGoals(projectId: string): Promise<Goal[]>
  deleteGoal(projectId: string, goalId: string): Promise<boolean>
}

export function createInMemoryGoalStore(): GoalStore {
  const goals = new Map<string, Goal>()
  const key = (projectId: string, goalId: string) => `${projectId}:${goalId}`
  return {
    async saveGoal(goal) {
      goals.set(key(goal.projectId, goal.id), goal)
    },
    async getGoal(projectId, goalId) {
      return goals.get(key(projectId, goalId)) ?? null
    },
    async listGoals(projectId) {
      return [...goals.values()].filter((g) => g.projectId === projectId)
    },
    async deleteGoal(projectId, goalId) {
      return goals.delete(key(projectId, goalId))
    },
  }
}
