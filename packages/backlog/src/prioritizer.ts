import type { Ticket } from "@devos/core"

// ─── Scoring constants ────────────────────────────────────────────────────────

const TYPE_WEIGHTS: Record<Ticket["type"], number> = {
  security: 40,
  bug: 30,
  feature: 20,
  debt: 10,
}

const STATUS_MULTIPLIERS: Record<Ticket["status"], number> = {
  open: 1.0,
  in_progress: 0.8,
  resolved: 0,
  closed: 0,
}

const SOURCE_POINTS_PER_SOURCE = 10
const MAX_SOURCE_POINTS = 30
const AGE_DECAY_DAYS = 30
const AGE_DECAY_PENALTY = 10
const MAX_SCORE = 100

// ─── Prioritizer ─────────────────────────────────────────────────────────────

export function scorePriority(ticket: Ticket): { score: number; reason: string } {
  // Manual override: return existing score unchanged
  if (ticket.manualPriorityOverride) {
    return {
      score: ticket.priorityScore,
      reason: `Manual priority override active — score locked at ${ticket.priorityScore}.`,
    }
  }

  const statusMultiplier = STATUS_MULTIPLIERS[ticket.status]

  // Resolved/closed tickets get zero score
  if (statusMultiplier === 0) {
    return {
      score: 0,
      reason: `Ticket is ${ticket.status} — no active priority.`,
    }
  }

  const factors: string[] = []

  // Type weight
  const typePoints = TYPE_WEIGHTS[ticket.type]
  factors.push(`type=${ticket.type} (+${typePoints})`)

  // Source count (capped at MAX_SOURCE_POINTS)
  const sourcePoints = Math.min(ticket.sources.length * SOURCE_POINTS_PER_SOURCE, MAX_SOURCE_POINTS)
  if (sourcePoints > 0) {
    factors.push(`${ticket.sources.length} source(s) (+${sourcePoints})`)
  }

  // Raw score before status and age
  let rawScore = typePoints + sourcePoints

  // Status multiplier
  if (statusMultiplier < 1) {
    factors.push(`status=${ticket.status} (×${statusMultiplier})`)
  }
  rawScore = Math.round(rawScore * statusMultiplier)

  // Age decay
  const now = new Date()
  const daysSinceUpdate =
    (now.getTime() - ticket.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpdate > AGE_DECAY_DAYS) {
    rawScore -= AGE_DECAY_PENALTY
    factors.push(`stale >${AGE_DECAY_DAYS}d without update (-${AGE_DECAY_PENALTY})`)
  }

  const score = Math.max(0, Math.min(rawScore, MAX_SCORE))
  const reason = `Score ${score}/100: ${factors.join(", ")}.`

  return { score, reason }
}
