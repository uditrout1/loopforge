import type { Project } from "@loopforge/core"
import type { SupabaseClient } from "./client.js"

export interface ProjectStore {
  createProject(project: Project): Promise<void>
  getProject(id: string): Promise<Project | null>
  listProjects(orgId?: string): Promise<Project[]>
  updateProject(id: string, updates: Partial<Project>): Promise<void>
}

interface ProjectRow {
  id: string
  org_id: string
  name: string
  repo_url: string | null
  repo_path: string | null
  repo_provider: string
  stack: unknown
  knowledge: unknown
  data_classification: string
  indexed_at: string | null
  created_at: string
}

function toRow(p: Project): Record<string, unknown> {
  return {
    id: p.id,
    org_id: p.orgId,
    name: p.name,
    repo_url: p.repoUrl ?? null,
    repo_path: p.repoPath ?? null,
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
    ...(row.repo_path != null ? { repoPath: row.repo_path } : {}),
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
  if (updates.orgId !== undefined)             row["org_id"] = updates.orgId
  if (updates.name !== undefined)              row["name"] = updates.name
  if (updates.repoUrl !== undefined)           row["repo_url"] = updates.repoUrl ?? null
  if (updates.repoPath !== undefined)          row["repo_path"] = updates.repoPath ?? null
  if (updates.repoProvider !== undefined)      row["repo_provider"] = updates.repoProvider
  if (updates.stack !== undefined)             row["stack"] = updates.stack
  if (updates.knowledge !== undefined)         row["knowledge"] = updates.knowledge
  if (updates.dataClassification !== undefined) row["data_classification"] = updates.dataClassification
  if (updates.indexedAt !== undefined)         row["indexed_at"] = updates.indexedAt?.toISOString() ?? null
  return row
}

export function createSupabaseProjectStore(client: SupabaseClient): ProjectStore {
  return {
    async createProject(project: Project): Promise<void> {
      const { error } = await client.from("lf_projects").insert(toRow(project))
      if (error != null) throw new Error(`createProject failed: ${error.message}`)
    },

    async getProject(id: string): Promise<Project | null> {
      const { data, error } = await client
        .from("lf_projects").select("*").eq("id", id).single<ProjectRow>()
      if (error != null) {
        if (error.code === "PGRST116") return null
        throw new Error(`getProject failed: ${error.message}`)
      }
      return data != null ? fromRow(data) : null
    },

    async listProjects(orgId?: string): Promise<Project[]> {
      let q = client.from("lf_projects").select("*").order("created_at", { ascending: false })
      if (orgId !== undefined) q = q.eq("org_id", orgId)
      const { data, error } = await q
      if (error != null) throw new Error(`listProjects failed: ${error.message}`)
      return (data as ProjectRow[] ?? []).map(fromRow)
    },

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
      const row = toUpdateRow(updates)
      if (Object.keys(row).length === 0) return
      const { error } = await client.from("lf_projects").update(row).eq("id", id)
      if (error != null) throw new Error(`updateProject failed: ${error.message}`)
    },
  }
}

/**
 * Creates a Map<string, Project> backed by Supabase — pre-loads all projects
 * at startup, writes through on every set(). Used as a drop-in replacement for
 * the in-memory projects map in the gateway.
 */
export async function createPersistentProjectsMap(
  client: SupabaseClient,
): Promise<Map<string, Project>> {
  const store = createSupabaseProjectStore(client)
  const existing = await store.listProjects()

  const map = new Map<string, Project>(existing.map((p) => [p.id, p]))

  return new Proxy(map, {
    get(target, prop) {
      if (prop === "set") {
        return (id: string, project: Project) => {
          const prev = target.get(id)
          target.set(id, project)
          if (prev === undefined) {
            store.createProject(project).catch((e: unknown) =>
              console.error("[db] createProject failed:", e),
            )
          } else {
            store.updateProject(id, project).catch((e: unknown) =>
              console.error("[db] updateProject failed:", e),
            )
          }
          return target
        }
      }
      const val = target[prop as keyof typeof target]
      return typeof val === "function" ? val.bind(target) : val
    },
  })
}
