import type { Goal, GoalStatus, GoalTicketRef } from "@loopforge/core"
import type { GoalStore } from "@loopforge/goals"
import type { SupabaseClient } from "./client.js"

interface GoalRow {
  id: string
  project_id: string
  title: string
  description: string
  status: string
  progress: number
  progress_percent: number
  tickets: unknown
  blockers: unknown
  target_date: string | null
  decomposed_at: string | null
  decomposed_by: string
  created_at: string
  updated_at: string
}

function fromRow(r: GoalRow): Goal {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status as GoalStatus,
    progressPercent: r.progress_percent,
    tickets: r.tickets as GoalTicketRef[],
    blockers: r.blockers as string[],
    targetDate: r.target_date != null ? new Date(r.target_date) : undefined,
    decomposedAt: r.decomposed_at != null ? new Date(r.decomposed_at) : undefined,
    decomposedBy: (r.decomposed_by as Goal["decomposedBy"]) ?? "manual",
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

export function createSupabaseGoalStore(client: SupabaseClient): GoalStore {
  return {
    async saveGoal(goal: Goal): Promise<void> {
      const { error } = await client.from("lf_goals").upsert({
        id: goal.id,
        project_id: goal.projectId,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        progress: goal.progressPercent,
        progress_percent: goal.progressPercent,
        tickets: goal.tickets,
        blockers: goal.blockers,
        target_date: goal.targetDate?.toISOString() ?? null,
        decomposed_at: goal.decomposedAt?.toISOString() ?? null,
        decomposed_by: goal.decomposedBy,
        created_at: goal.createdAt.toISOString(),
        updated_at: goal.updatedAt.toISOString(),
      })
      if (error) throw new Error(`saveGoal failed: ${error.message}`)
    },

    async getGoal(projectId: string, goalId: string): Promise<Goal | null> {
      const { data, error } = await client.from("lf_goals").select("*")
        .eq("project_id", projectId).eq("id", goalId).single<GoalRow>()
      if (error) { if (error.code === "PGRST116") return null; throw new Error(error.message) }
      return data ? fromRow(data) : null
    },

    async listGoals(projectId: string): Promise<Goal[]> {
      const { data, error } = await client.from("lf_goals").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: false })
      if (error) throw new Error(`listGoals failed: ${error.message}`)
      return (data as GoalRow[] ?? []).map(fromRow)
    },

    async deleteGoal(projectId: string, goalId: string): Promise<boolean> {
      const { error, count } = await client.from("lf_goals").delete({ count: "exact" })
        .eq("project_id", projectId).eq("id", goalId)
      if (error) throw new Error(`deleteGoal failed: ${error.message}`)
      return (count ?? 0) > 0
    },
  }
}
