import type { Message, MessageContent, TextPart, ModelCapability } from "@loopforge/core"

// Heuristic complexity scoring — avoids a model call for routing decisions.
// Score 1-2: extraction, classification, formatting → small model
// Score 3:   code generation, explanation → medium model
// Score 4-5: reasoning, architecture, debugging → frontier model

const FRONTIER_SIGNALS = [
  "architect", "design", "investigate", "debug", "why is", "root cause",
  "security", "refactor", "optimize", "analyze", "audit", "explain why",
  "multi-step", "complex", "strategy",
]

const SMALL_SIGNALS = [
  "rename", "format", "summarize", "list", "extract", "classify",
  "what is", "definition", "translate", "convert", "sort",
]

function contentToText(content: MessageContent): string {
  if (typeof content === "string") return content
  return content
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join(" ")
}

export function classifyComplexity(messages: Message[]): {
  score: number
  capability: ModelCapability
  reason: string
} {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user")

  if (!lastUserMessage) {
    return { score: 3, capability: "medium", reason: "No user message found" }
  }

  const text = contentToText(lastUserMessage.content).toLowerCase()
  const totalTokenEstimate = messages.reduce(
    (sum, m) => sum + Math.ceil(contentToText(m.content).length / 4),
    0,
  )

  // Long context usually means a complex task
  if (totalTokenEstimate > 2000) {
    return {
      score: 4,
      capability: "frontier",
      reason: "Large context window suggests complex task",
    }
  }

  const frontierHits = FRONTIER_SIGNALS.filter((s) => text.includes(s))
  if (frontierHits.length > 0) {
    return {
      score: 5,
      capability: "frontier",
      reason: `Detected signals: ${frontierHits.join(", ")}`,
    }
  }

  const smallHits = SMALL_SIGNALS.filter((s) => text.includes(s))
  if (smallHits.length > 0 && text.length < 200) {
    return {
      score: 1,
      capability: "small",
      reason: `Simple task signals: ${smallHits.join(", ")}`,
    }
  }

  return {
    score: 3,
    capability: "medium",
    reason: "Default medium complexity",
  }
}
