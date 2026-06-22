import type { Ticket, TicketStatus } from "@loopforge/core"

// ─── TicketStore interface ────────────────────────────────────────────────────

export interface TicketStore {
  getTicket(id: string): Promise<Ticket | null>
  listTickets(projectId: string, status?: TicketStatus): Promise<Ticket[]>
  upsertTicket(ticket: Ticket): Promise<void>
  updateTicketStatus(id: string, status: TicketStatus): Promise<void>
}

// ─── In-memory implementation ─────────────────────────────────────────────────

export function createInMemoryTicketStore(): TicketStore {
  const tickets = new Map<string, Ticket>()

  return {
    async getTicket(id: string): Promise<Ticket | null> {
      return tickets.get(id) ?? null
    },

    async listTickets(projectId: string, status?: TicketStatus): Promise<Ticket[]> {
      const results: Ticket[] = []
      for (const ticket of tickets.values()) {
        if (ticket.projectId !== projectId) continue
        if (status !== undefined && ticket.status !== status) continue
        results.push(ticket)
      }
      return results
    },

    async upsertTicket(ticket: Ticket): Promise<void> {
      tickets.set(ticket.id, { ...ticket })
    },

    async updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
      const ticket = tickets.get(id)
      if (!ticket) {
        throw new Error(`Ticket not found: ${id}`)
      }
      tickets.set(id, { ...ticket, status, updatedAt: new Date() })
    },
  }
}
