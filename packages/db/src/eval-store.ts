import type { EvalCriteria, EvalRun, EvalFeedback, EvalType, EvalStatus, FeedbackVerdict } from "@loopforge/core"
import type { EvalStore } from "@loopforge/evals"
import type { SupabaseClient } from "./client.js"

// ── Row types ─────────────────────────────────────────────────────────────────

interface CriteriaRow {
  id: string
  project_id: string
  name: string
  description: string
  type: string
  prompt: string
  threshold: number
  source_spec_id: string | null
  source_adr_id: string | null
  created_at: string
  updated_at: string
}

interface RunRow {
  id: string
  project_id: string
  criteria_id: string
  target_type: string
  target_id: string
  score: number
  status: string
  reasoning: string
  passed: boolean
  regression_detected: boolean
  previous_score: number | null
  created_at: string
  completed_at: string | null
}

interface FeedbackRow {
  id: string
  project_id: string
  run_id: string
  verdict: string
  rationale: string
  submitted_by: string
  created_at: string
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function criteriaFromRow(r: CriteriaRow): EvalCriteria {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    description: r.description,
    type: r.type as EvalType,
    prompt: r.prompt,
    threshold: Number(r.threshold),
    sourceSpecId: r.source_spec_id ?? undefined,
    sourceAdrId: r.source_adr_id ?? undefined,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

function runFromRow(r: RunRow): EvalRun {
  return {
    id: r.id,
    projectId: r.project_id,
    criteriaId: r.criteria_id,
    targetType: r.target_type,
    targetId: r.target_id,
    score: Number(r.score),
    status: r.status as EvalStatus,
    reasoning: r.reasoning,
    passed: r.passed,
    regressionDetected: r.regression_detected,
    previousScore: r.previous_score != null ? Number(r.previous_score) : undefined,
    createdAt: new Date(r.created_at),
    completedAt: r.completed_at != null ? new Date(r.completed_at) : undefined,
  }
}

function feedbackFromRow(r: FeedbackRow): EvalFeedback {
  return {
    id: r.id,
    projectId: r.project_id,
    runId: r.run_id,
    verdict: r.verdict as FeedbackVerdict,
    rationale: r.rationale,
    submittedBy: r.submitted_by,
    createdAt: new Date(r.created_at),
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export function createSupabaseEvalStore(client: SupabaseClient): EvalStore {
  return {
    async saveCriteria(c: EvalCriteria): Promise<void> {
      const { error } = await client.from("lf_eval_criteria").upsert({
        id: c.id, project_id: c.projectId, name: c.name, description: c.description,
        type: c.type, prompt: c.prompt, threshold: c.threshold,
        source_spec_id: c.sourceSpecId ?? null, source_adr_id: c.sourceAdrId ?? null,
        created_at: c.createdAt.toISOString(), updated_at: c.updatedAt.toISOString(),
      })
      if (error) throw new Error(`saveCriteria failed: ${error.message}`)
    },

    async getCriteria(projectId: string, criteriaId: string): Promise<EvalCriteria | null> {
      const { data, error } = await client.from("lf_eval_criteria").select("*")
        .eq("project_id", projectId).eq("id", criteriaId).single<CriteriaRow>()
      if (error) { if (error.code === "PGRST116") return null; throw new Error(error.message) }
      return data ? criteriaFromRow(data) : null
    },

    async listCriteria(projectId: string): Promise<EvalCriteria[]> {
      const { data, error } = await client.from("lf_eval_criteria").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: true })
      if (error) throw new Error(`listCriteria failed: ${error.message}`)
      return (data as CriteriaRow[] ?? []).map(criteriaFromRow)
    },

    async deleteCriteria(projectId: string, criteriaId: string): Promise<void> {
      const { error } = await client.from("lf_eval_criteria").delete()
        .eq("project_id", projectId).eq("id", criteriaId)
      if (error) throw new Error(`deleteCriteria failed: ${error.message}`)
    },

    async saveRun(run: EvalRun): Promise<void> {
      const { error } = await client.from("lf_eval_runs").upsert({
        id: run.id, project_id: run.projectId, criteria_id: run.criteriaId,
        target_type: run.targetType, target_id: run.targetId, score: run.score,
        status: run.status, reasoning: run.reasoning, passed: run.passed,
        regression_detected: run.regressionDetected,
        previous_score: run.previousScore ?? null,
        created_at: run.createdAt.toISOString(),
        completed_at: run.completedAt?.toISOString() ?? null,
      })
      if (error) throw new Error(`saveRun failed: ${error.message}`)
    },

    async getRun(projectId: string, runId: string): Promise<EvalRun | null> {
      const { data, error } = await client.from("lf_eval_runs").select("*")
        .eq("project_id", projectId).eq("id", runId).single<RunRow>()
      if (error) { if (error.code === "PGRST116") return null; throw new Error(error.message) }
      return data ? runFromRow(data) : null
    },

    async listRuns(projectId: string, criteriaId?: string): Promise<EvalRun[]> {
      let q = client.from("lf_eval_runs").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: false })
      if (criteriaId !== undefined) q = q.eq("criteria_id", criteriaId)
      const { data, error } = await q
      if (error) throw new Error(`listRuns failed: ${error.message}`)
      return (data as RunRow[] ?? []).map(runFromRow)
    },

    async getLastRun(projectId: string, criteriaId: string, targetId: string): Promise<EvalRun | null> {
      const { data, error } = await client.from("lf_eval_runs").select("*")
        .eq("project_id", projectId).eq("criteria_id", criteriaId).eq("target_id", targetId)
        .in("status", ["passed", "failed"])
        .order("created_at", { ascending: false }).limit(1).single<RunRow>()
      if (error) { if (error.code === "PGRST116") return null; throw new Error(error.message) }
      return data ? runFromRow(data) : null
    },

    async saveFeedback(feedback: EvalFeedback): Promise<void> {
      const { error } = await client.from("lf_eval_feedback").upsert({
        id: feedback.id, project_id: feedback.projectId, run_id: feedback.runId,
        verdict: feedback.verdict, rationale: feedback.rationale,
        submitted_by: feedback.submittedBy, created_at: feedback.createdAt.toISOString(),
      })
      if (error) throw new Error(`saveFeedback failed: ${error.message}`)
    },

    async getFeedbackForRun(projectId: string, runId: string): Promise<EvalFeedback[]> {
      const { data, error } = await client.from("lf_eval_feedback").select("*")
        .eq("project_id", projectId).eq("run_id", runId)
        .order("created_at", { ascending: true })
      if (error) throw new Error(`getFeedbackForRun failed: ${error.message}`)
      return (data as FeedbackRow[] ?? []).map(feedbackFromRow)
    },
  }
}
