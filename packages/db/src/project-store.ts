import type { Project } from "@devos/core"
import type { SupabaseClient } from "./client.js"

export interface ProjectStore {
  createProject(project: Project): Promise<void>
  getProject(id: string): Promise<Project | null>
  listProjects(orgId: string): Promise<Project[]>
  updateProject(id: string, updates: Partial<Project>): Promise<void>
}

// ─── Row type ─────────────────────────────────────────────────────────────────

interface ProjectRow {
  id: string
  org_id: string
  name: string
  repo_url: string | null
  repo_provider: string
  stack: unknown
  knowledge: unknown
  data_classification: string
  indexed_at: string | null
  created_at: string
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toRow(p: Project): Record<string, unknown> {
  return {
    id: p.id,
    org_id: p.orgId,
    name: p.name,
    repo_url: p.repoUrl ?? null,
    repo_provider: p.repoProvider,
    stack: p.stack,
    knowledge: p.knowledge,
    data_classification: p.dataClassification,
    indexed_at: p.indexedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
  }
}

function fromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    ...(row.repo_url != null ? { repoUrl: row.repo_url } : {}),
    repoProvider: row.repo_provider as Project["repoProvider"],
    stack: row.stack as Project["stack"],
    knowledge: row.knowledge as Project["knowledge"],
    dataClassification: row.data_classification as Project["dataClassification"],
    ...(row.indexed_at != null ? { indexedAt: new Date(row.indexed_at) } : {}),
    createdAt: new Date(row.created_at),
  }
}

function toUpdateRow(updates: Partial<Project>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (updates.orgId !== undefined) row["org_id"] = updates.orgId
  if (updates.name !== undefined) row["name"] = updates.name
  if (updates.repoUrl !== undefined) row["repo_url"] = updates.repoUrl
  if (updates.repoProvider !== undefined) row["repo_provider"] = updates.repoProvider
  if (updates.stack !== undefined) row["stack"] = updates.stack
  if (updates.knowledge !== undefined) row["knowledge"] = updates.knowledge
  if (updates.dataClassification !== undefined) row["data_classification"] = updates.dataClassification
  if (updates.indexedAt !== undefined) row["indexed_at"] = updates.indexedAt?.toISOString() ?? null
  return row
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function createSupabaseProjectStore(client: SupabaseClient): ProjectStore {
  return {
    async createProject(project: Project): Promise<void> {
      const { error } = await client.from("projects").insert(toRow(project))
      if (error != null) {
        throw new Error(`createProject failed: ${error.message}`)
      }
    },

    async getProject(id: string): Promise<Project | null> {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("id", id)
        .single<ProjectRow>()

      if (error != null) {
        if (error.code === "PGRST116") return null
        throw new Error(`getProject failed: ${error.message}`)
      }

      return data != null ? fromRow(data) : null
    },

    async listProjects(orgId: string): Promise<Project[]> {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })

      if (error != null) {
        throw new Error(`listProjects failed: ${error.message}`)
      }

      return (data as ProjectRow[] ?? []).map(fromRow)
    },

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
      const row = toUpdateRow(updates)
      if (Object.keys(row).length === 0) return

      const { error } = await client.from("projects").update(row).eq("id", id)
      if (error != null) {
        throw new Error(`updateProject failed: ${error.message}`)
      }
    },
  }
}
