import type { Message, MessageContent, TextPart, ModelCapability, ModelResponse, ProviderType } from "@devos/core"

const TIER_MODELS: Record<ModelCapability, string> = {
  small: "qwen2.5:7b",
  medium: "qwen2.5:32b",
  frontier: "qwen2.5:72b",
}

interface OllamaResponse {
  message: { content: string }
  model: string
  prompt_eval_count: number
  eval_count: number
}

function extractText(content: MessageContent): string {
  if (typeof content === "string") return content
  return content
    .filter((p): p is TextPart => p.type === "text")
    .map((p) => p.text)
    .join("\n")
}

export async function callOllama(
  messages: Message[],
  capability: ModelCapability,
  baseUrl: string,
  modelOverride?: string,
): Promise<ModelResponse> {
  const model = modelOverride ?? TIER_MODELS[capability]

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: extractText(m.content) })),
      stream: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ollama error ${res.status}: ${body}`)
  }

  const data = (await res.json()) as OllamaResponse
  const inputTokens = data.prompt_eval_count ?? 0
  const outputTokens = data.eval_count ?? 0

  return {
    content: data.message.content,
    model,
    provider: "ollama" as ProviderType,
    inputTokens,
    outputTokens,
    costUsd: 0, // on-prem = no per-token cost
    routingDecision: {
      model,
      provider: "ollama",
      complexityScore: 0,
      reason: "On-prem Ollama routing (data stayed local)",
      estimatedCostUsd: 0,
    },
  }
}

export async function isOllamaAvailable(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
