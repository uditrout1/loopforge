import type { Goal, GoalDecomposition, GoalTicketRef } from "@loopforge/core"
import { route, type RouterConfig } from "@loopforge/router"

export async function decomposeGoal(
  goal: Goal,
  routerConfig: RouterConfig,
): Promise<GoalDecomposition> {
  const prompt = `You are a senior engineering lead. Decompose this engineering goal into concrete, actionable tickets.

Goal: ${goal.title}
Description: ${goal.description}

Return JSON with this exact shape:
{
  "tickets": [
    { "title": "string", "description": "string", "type": "feature|bug|chore|spike" }
  ],
  "reasoning": "string (1-2 sentences explaining your decomposition approach)"
}

Rules:
- 3 to 8 tickets
- Each ticket should be completable in 1-3 days
- Identify the critical path — order tickets by dependency
- Be specific, not vague ("Add ScreenTimeAPI entitlement to Info.plist" not "Handle permissions")
- type = feature for new capability, chore for setup/config, spike for research, bug for fixes`

  const response = await route(
    {
      messages: [{ role: "user" as const, content: prompt }],
      projectId: goal.projectId,
      sessionId: goal.id,
      dataClassification: "internal",
      preferredCapability: "medium",
    },
    routerConfig,
  )

  const text = response.content
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch || !jsonMatch[0]) {
    return {
      tickets: [{ title: goal.title, description: goal.description, type: "feature" as const }],
      reasoning: "Could not parse decomposition — created single ticket from goal.",
    }
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as GoalDecomposition
    return parsed
  } catch {
    return {
      tickets: [{ title: goal.title, description: goal.description, type: "feature" as const }],
      reasoning: "Could not parse decomposition — created single ticket from goal.",
    }
  }
}

export function computeProgress(tickets: GoalTicketRef[]): number {
  if (tickets.length === 0) return 0
  const done = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length
  return Math.round((done / tickets.length) * 100)
}

export function detectBlockers(tickets: GoalTicketRef[]): string[] {
  return tickets
    .filter((t) => t.isBlocker && t.status !== "resolved" && t.status !== "closed")
    .map((t) => `"${t.title}" is blocking goal progress`)
}
