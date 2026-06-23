import type { SupabaseClient } from "./client.js"

export interface Release {
  id: string
  projectId: string
  version: string
  name: string
  status: "draft" | "published"
  changelog: string
  mergedPrIds: string[]
  resolvedTicketIds: string[]
  generatedAt: Date
  publishedAt: Date | undefined
  createdAt: Date
}

export interface ReleasesStore {
  save(release: Release): Promise<void>
  get(projectId: string, releaseId: string): Promise<Release | null>
  list(projectId: string): Promise<Release[]>
  update(projectId: string, releaseId: string, updates: Partial<Release>): Promise<void>
  delete(projectId: string, releaseId: string): Promise<void>
}

interface ReleaseRow {
  id: string
  project_id: string
  version: string
  name: string
  status: string
  changelog: string
  pr_numbers: unknown
  ticket_ids: unknown
  published_at: string | null
  created_at: string
  updated_at: string
}

function fromRow(r: ReleaseRow): Release {
  return {
    id: r.id,
    projectId: r.project_id,
    version: r.version,
    name: r.name,
    status: r.status as Release["status"],
    changelog: r.changelog,
    mergedPrIds: r.pr_numbers as string[],
    resolvedTicketIds: r.ticket_ids as string[],
    generatedAt: new Date(r.created_at),
    publishedAt: r.published_at ? new Date(r.published_at) : undefined,
    createdAt: new Date(r.created_at),
  }
}

export function createSupabaseReleasesStore(client: SupabaseClient): ReleasesStore {
  return {
    async save(release: Release): Promise<void> {
      const { error } = await client.from("lf_releases").upsert({
        id: release.id, project_id: release.projectId, version: release.version,
        name: release.name, status: release.status, changelog: release.changelog,
        pr_numbers: release.mergedPrIds, ticket_ids: release.resolvedTicketIds,
        published_at: release.publishedAt?.toISOString() ?? null,
        created_at: release.createdAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (error) throw new Error(`releases save failed: ${error.message}`)
    },

    async get(projectId: string, releaseId: string): Promise<Release | null> {
      const { data, error } = await client.from("lf_releases").select("*")
        .eq("project_id", projectId).eq("id", releaseId).single<ReleaseRow>()
      if (error) { if (error.code === "PGRST116") return null; throw new Error(error.message) }
      return data ? fromRow(data) : null
    },

    async list(projectId: string): Promise<Release[]> {
      const { data, error } = await client.from("lf_releases").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: false })
      if (error) throw new Error(`releases list failed: ${error.message}`)
      return (data as ReleaseRow[] ?? []).map(fromRow)
    },

    async update(projectId: string, releaseId: string, updates: Partial<Release>): Promise<void> {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.version !== undefined)    row["version"] = updates.version
      if (updates.name !== undefined)       row["name"] = updates.name
      if (updates.status !== undefined)     row["status"] = updates.status
      if (updates.changelog !== undefined)  row["changelog"] = updates.changelog
      if (updates.publishedAt !== undefined) row["published_at"] = updates.publishedAt?.toISOString() ?? null
      const { error } = await client.from("lf_releases").update(row)
        .eq("project_id", projectId).eq("id", releaseId)
      if (error) throw new Error(`releases update failed: ${error.message}`)
    },

    async delete(projectId: string, releaseId: string): Promise<void> {
      const { error } = await client.from("lf_releases").delete()
        .eq("project_id", projectId).eq("id", releaseId)
      if (error) throw new Error(`releases delete failed: ${error.message}`)
    },
  }
}

/** In-memory fallback (same interface, no Supabase needed) */
export function createInMemoryReleasesStore(): ReleasesStore {
  const map = new Map<string, Release>()
  const key = (pid: string, rid: string) => `${pid}:${rid}`
  return {
    async save(r) { map.set(key(r.projectId, r.id), r) },
    async get(projectId, releaseId) { return map.get(key(projectId, releaseId)) ?? null },
    async list(projectId) {
      return [...map.values()].filter(r => r.projectId === projectId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    async update(projectId, releaseId, updates) {
      const existing = map.get(key(projectId, releaseId))
      if (existing) map.set(key(projectId, releaseId), { ...existing, ...updates })
    },
    async delete(projectId, releaseId) { map.delete(key(projectId, releaseId)) },
  }
}
