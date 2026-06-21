import type { Skill } from "@devos/core"
import { BUILT_IN_SKILLS } from "./built-in.js"

// In-memory registry — replace with Supabase + pgvector for production similarity search
const registry = new Map<string, Skill>(
  BUILT_IN_SKILLS.map((s) => [s.id, s]),
)

export function registerSkill(skill: Skill): void {
  registry.set(skill.id, skill)
}

export function getSkill(id: string): Skill | undefined {
  return registry.get(id)
}

export function listSkills(filter?: { isPublic?: boolean }): Skill[] {
  const all = Array.from(registry.values())
  if (filter?.isPublic !== undefined) {
    return all.filter((s) => s.isPublic === filter.isPublic)
  }
  return all
}

// Keyword-based recommendation until pgvector similarity is wired in
export async function recommendSkills(
  userMessage: string,
  limit: number,
): Promise<Skill[]> {
  if (!userMessage.trim()) return []

  const lower = userMessage.toLowerCase()
  const scored = Array.from(registry.values()).map((skill) => {
    const hits = skill.triggerKeywords.filter((kw) => lower.includes(kw)).length
    return { skill, hits }
  })

  return scored
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map(({ skill }) => skill)
}
