import { randomUUID } from "node:crypto"
import type { Project, ContextChunk, Ticket, TicketType, TicketStatus, ContextPack } from "@loopforge/core"
import type { BrainStore } from "@loopforge/brain"
import type { SupabaseClient } from "./client.js"

// ─── Row types returned from Supabase ────────────────────────────────────────

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

interface SessionRow {
  summary: string | null
}

interface TicketRow {
  id: string
  project_id: string
  external_id: string | null
  external_url: string | null
  title: string
  description: string | null
  type: string
  status: string
  priority_score: number
  priority_reason: string
  sources: unknown
  linked_files: string[]
  linked_prs: string[]
  manual_priority_override: boolean
  created_by: string
  created_at: string
  updated_at: string
}

interface ChunkRow {
  id: string
  project_id: string
  file_path: string
  content: string
  embedding: number[] | null
  chunk_index: number
  token_count: number
  file_hash: string
  updated_at: string
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapProject(row: ProjectRow): Project {
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

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    projectId: row.project_id,
    ...(row.external_id != null ? { externalId: row.external_id } : {}),
    ...(row.external_url != null ? { externalUrl: row.external_url } : {}),
    title: row.title,
    ...(row.description != null ? { description: row.description } : {}),
    type: row.type as TicketType,
    status: row.status as TicketStatus,
    priorityScore: row.priority_score,
    priorityReason: row.priority_reason,
    sources: row.sources as Ticket["sources"],
    linkedFiles: row.linked_files,
    linkedPrs: row.linked_prs,
    manualPriorityOverride: row.manual_priority_override,
    createdBy: row.created_by as Ticket["createdBy"],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mapChunk(row: ChunkRow): ContextChunk {
  return {
    id: row.id,
    projectId: row.project_id,
    filePath: row.file_path,
    content: row.content,
    ...(row.embedding != null ? { embedding: row.embedding } : {}),
    chunkIndex: row.chunk_index,
    tokenCount: row.token_count,
    fileHash: row.file_hash,
    updatedAt: new Date(row.updated_at),
  }
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function createSupabaseBrainStore(client: SupabaseClient): BrainStore {
  return {
    async getProject(projectId: string): Promise<Project | null> {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single<ProjectRow>()

      if (error != null) {
        if (error.code === "PGRST116") return null // row not found
        throw new Error(`getProject failed: ${error.message}`)
      }

      return data != null ? mapProject(data) : null
    },

    async getLastSessionSummary(projectId: string): Promise<string | undefined> {
      const { data, error } = await client
        .from("sessions")
        .select("summary")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single<SessionRow>()

      if (error != null) {
        if (error.code === "PGRST116") return undefined // no sessions yet
        throw new Error(`getLastSessionSummary failed: ${error.message}`)
      }

      return data?.summary ?? undefined
    },

    async getOpenTickets(projectId: string, limit: number): Promise<Ticket[]> {
      const { data, error } = await client
        .from("tickets")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "open")
        .order("priority_score", { ascending: false })
        .limit(limit)

      if (error != null) {
        throw new Error(`getOpenTickets failed: ${error.message}`)
      }

      return (data as TicketRow[] ?? []).map(mapTicket)
    },

    async searchChunks(
      projectId: string,
      query: string,
      limit: number,
    ): Promise<ContextChunk[]> {
      // V1: simple text search via ILIKE
      // Production TODO: use pgvector cosine similarity —
      //   .rpc('match_chunks', { query_embedding: $queryEmbedding, match_count: limit })
      //   which executes: ORDER BY embedding <=> $queryEmbedding LIMIT $limit
      const { data, error } = await client
        .from("context_chunks")
        .select("*")
        .eq("project_id", projectId)
        .ilike("content", `%${query}%`)
        .limit(limit)

      if (error != null) {
        throw new Error(`searchChunks failed: ${error.message}`)
      }

      return (data as ChunkRow[] ?? []).map(mapChunk)
    },

    async saveSessionSummary(projectId: string, summary: string): Promise<void> {
      const { error } = await client.from("sessions").insert({
        id: randomUUID(),
        project_id: projectId,
        summary,
        created_at: new Date().toISOString(),
      })

      if (error != null) {
        throw new Error(`saveSessionSummary failed: ${error.message}`)
      }
    },

    // Pack storage — kept in-memory per Supabase store instance until a packs table is added
    async getPacks(projectId: string): Promise<ContextPack[]> {
      return packStore.get(projectId) ?? []
    },

    async savePack(pack: ContextPack): Promise<void> {
      const existing = packStore.get(pack.projectId) ?? []
      const replaced = existing.filter((p) => p.id !== pack.id)
      packStore.set(pack.projectId, [...replaced, pack])
    },

    async deletePack(projectId: string, packId: string): Promise<boolean> {
      const existing = packStore.get(projectId) ?? []
      const next = existing.filter((p) => p.id !== packId)
      if (next.length === existing.length) return false
      packStore.set(projectId, next)
      return true
    },
  }
}

// Module-level pack cache (replaced by a packs table in a future migration)
const packStore = new Map<string, ContextPack[]>()
