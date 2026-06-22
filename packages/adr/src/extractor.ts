import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"
import type { Message } from "@loopforge/core"

export interface ExtractedDecision {
  title: string
  context: string
  decision: string
  consequences: string
  confidence: "high" | "medium" | "low"
}

export async function extractDecisions(
  projectId: string,
  sessionId: string,
  messages: Message[],
  routerConfig: RouterConfig,
): Promise<ExtractedDecision[] | null> {
  // Use last 20 messages to avoid token limits
  const recent = messages.slice(-20)

  const transcript = recent
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n")

  const prompt = `Analyze this engineering conversation and extract any architectural decisions made.

Return a JSON array. Each item should have:
- title: short decision name (e.g. "Use JWT for session tokens")
- context: why this decision was needed
- decision: what was decided
- consequences: trade-offs or implications
- confidence: "high" if it's clearly a decision, "low" if uncertain

Only include real architectural/technical decisions — not opinions, questions, or implementation details.
Return an empty array if no decisions were made.

Conversation:
${transcript}`

  const extractionMessages: Message[] = [
    { role: "user", content: prompt },
  ]

  let responseContent: string
  try {
    const response = await route(
      {
        messages: extractionMessages,
        projectId,
        sessionId,
        dataClassification: "internal",
        preferredCapability: "medium",
      },
      routerConfig,
    )
    responseContent = response.content
  } catch {
    return null
  }

  // Extract JSON from the response — handle markdown code blocks
  const jsonMatch =
    responseContent.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    responseContent.match(/(\[[\s\S]*\])/)

  const raw = jsonMatch?.[1]?.trim() ?? responseContent.trim()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    const decisions: ExtractedDecision[] = []
    for (const item of parsed) {
      if (
        item !== null &&
        typeof item === "object" &&
        "title" in item &&
        "context" in item &&
        "decision" in item &&
        "consequences" in item &&
        "confidence" in item &&
        typeof (item as Record<string, unknown>)["title"] === "string" &&
        typeof (item as Record<string, unknown>)["context"] === "string" &&
        typeof (item as Record<string, unknown>)["decision"] === "string" &&
        typeof (item as Record<string, unknown>)["consequences"] === "string"
      ) {
        const record = item as Record<string, unknown>
        const confidence = record["confidence"]
        decisions.push({
          title: record["title"] as string,
          context: record["context"] as string,
          decision: record["decision"] as string,
          consequences: record["consequences"] as string,
          confidence:
            confidence === "high" || confidence === "medium" || confidence === "low"
              ? confidence
              : "low",
        })
      }
    }
    return decisions
  } catch {
    return null
  }
}
