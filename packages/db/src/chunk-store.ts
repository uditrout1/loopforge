import type { ContextChunk } from "@devos/core"
import type { SupabaseClient } from "./client.js"

export interface ChunkStore {
  upsertChunks(chunks: ContextChunk[]): Promise<void>
  getChunks(projectId: string, limit?: number): Promise<ContextChunk[]>
  deleteChunks(projectId: string): Promise<void>
}

// ─── Row type ─────────────────────────────────────────────────────────────────

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

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toRow(c: ContextChunk): ChunkRow {
  return {
    id: c.id,
    project_id: c.projectId,
    file_path: c.filePath,
    content: c.content,
    embedding: c.embedding ?? null,
    chunk_index: c.chunkIndex,
    token_count: c.tokenCount,
    file_hash: c.fileHash,
    updated_at: c.updatedAt.toISOString(),
  }
}

function fromRow(row: ChunkRow): ContextChunk {
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

export function createSupabaseChunkStore(client: SupabaseClient): ChunkStore {
  return {
    async upsertChunks(chunks: ContextChunk[]): Promise<void> {
      if (chunks.length === 0) return

      const rows = chunks.map(toRow)
      const { error } = await client
        .from("context_chunks")
        .upsert(rows, { onConflict: "id" })

      if (error != null) {
        throw new Error(`upsertChunks failed: ${error.message}`)
      }
    },

    async getChunks(projectId: string, limit = 100): Promise<ContextChunk[]> {
      const { data, error } = await client
        .from("context_chunks")
        .select("*")
        .eq("project_id", projectId)
        .order("chunk_index", { ascending: true })
        .limit(limit)

      if (error != null) {
        throw new Error(`getChunks failed: ${error.message}`)
      }

      return (data as ChunkRow[] ?? []).map(fromRow)
    },

    async deleteChunks(projectId: string): Promise<void> {
      const { error } = await client
        .from("context_chunks")
        .delete()
        .eq("project_id", projectId)

      if (error != null) {
        throw new Error(`deleteChunks failed: ${error.message}`)
      }
    },
  }
}
