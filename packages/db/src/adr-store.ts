import type { ADR, ADRStatus } from "@loopforge/core"
import type { ADRStore } from "@loopforge/adr"
import type { SupabaseClient } from "./client.js"

interface ADRRow {
  id: string
  project_id: string
  number: number
  title: string
  context: string
  decision: string
  consequences: string
  status: string
  linked_ticket_ids: unknown
  linked_spec_ids: unknown
  superseded_by: string | null
  created_at: string
  updated_at: string
}

function fromRow(r: ADRRow): ADR {
  return {
    id: r.id,
    projectId: r.project_id,
    number: r.number,
    title: r.title,
    context: r.context,
    decision: r.decision,
    consequences: r.consequences,
    status: r.status as ADRStatus,
    linkedTicketIds: r.linked_ticket_ids as string[],
    linkedSpecIds: r.linked_spec_ids as string[],
    ...(r.superseded_by != null ? { supersededBy: r.superseded_by } : {}),
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }
}

export function createSupabaseADRStore(client: SupabaseClient): ADRStore {
  return {
    async getADR(id: string): Promise<ADR | null> {
      const { data, error } = await client
        .from("lf_adrs").select("*").eq("id", id).single<ADRRow>()
      if (error) {
        if (error.code === "PGRST116") return null
        throw new Error(`getADR failed: ${error.message}`)
      }
      return data ? fromRow(data) : null
    },

    async listADRs(projectId: string, status?: ADRStatus): Promise<ADR[]> {
      let q = client.from("lf_adrs").select("*")
        .eq("project_id", projectId).order("number", { ascending: true })
      if (status !== undefined) q = q.eq("status", status)
      const { data, error } = await q
      if (error) throw new Error(`listADRs failed: ${error.message}`)
      return (data as ADRRow[] ?? []).map(fromRow)
    },

    async getNextNumber(projectId: string): Promise<number> {
      const { data, error } = await client
        .from("lf_adrs").select("number").eq("project_id", projectId)
        .order("number", { ascending: false }).limit(1)
      if (error) throw new Error(`getNextNumber failed: ${error.message}`)
      const rows = data as Array<{ number: number }> ?? []
      return (rows[0]?.number ?? 0) + 1
    },

    async saveADR(adr: ADR): Promise<void> {
      const { error } = await client.from("lf_adrs").upsert({
        id: adr.id,
        project_id: adr.projectId,
        number: adr.number,
        title: adr.title,
        context: adr.context,
        decision: adr.decision,
        consequences: adr.consequences,
        status: adr.status,
        linked_ticket_ids: adr.linkedTicketIds,
        linked_spec_ids: adr.linkedSpecIds,
        superseded_by: adr.supersededBy ?? null,
        created_at: adr.createdAt.toISOString(),
        updated_at: adr.updatedAt.toISOString(),
      })
      if (error) throw new Error(`saveADR failed: ${error.message}`)
    },

    async updateADR(id: string, updates: Partial<ADR>): Promise<void> {
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.title !== undefined)          row["title"] = updates.title
      if (updates.context !== undefined)        row["context"] = updates.context
      if (updates.decision !== undefined)       row["decision"] = updates.decision
      if (updates.consequences !== undefined)   row["consequences"] = updates.consequences
      if (updates.status !== undefined)         row["status"] = updates.status
      if (updates.linkedTicketIds !== undefined) row["linked_ticket_ids"] = updates.linkedTicketIds
      if (updates.linkedSpecIds !== undefined)  row["linked_spec_ids"] = updates.linkedSpecIds
      if (updates.supersededBy !== undefined)   row["superseded_by"] = updates.supersededBy ?? null
      const { error } = await client.from("lf_adrs").update(row).eq("id", id)
      if (error) throw new Error(`updateADR failed: ${error.message}`)
    },
  }
}
