import type { ModelRequest, ModelResponse } from "@loopforge/core"
import { classifyComplexity } from "./classifier.js"
import { callOpenRouter } from "./providers/openrouter.js"
import { callOllama, isOllamaAvailable } from "./providers/ollama.js"

export interface RouterConfig {
  openRouterApiKey?: string
  ollamaBaseUrl?: string
  forceOnPremForClassifications?: string[]
  // User-pinnable model overrides per tier (set via /settings)
  modelOverrides?: {
    small?: string
    medium?: string
    frontier?: string
  }
}

export async function route(
  request: ModelRequest,
  config: RouterConfig,
): Promise<ModelResponse> {
  const { score, capability, reason } = classifyComplexity(request.messages)
  const effectiveCapability = request.preferredCapability ?? capability

  const forceOnPrem =
    config.forceOnPremForClassifications?.includes(request.dataClassification) ??
    ["confidential", "restricted"].includes(request.dataClassification)

  // On-prem path: confidential/restricted data never leaves the network
  if (forceOnPrem) {
    const baseUrl = config.ollamaBaseUrl ?? "http://localhost:11434"
    const available = await isOllamaAvailable(baseUrl)

    if (!available) {
      throw new Error(
        `Project is classified as '${request.dataClassification}' — requires on-prem model via Ollama at ${baseUrl}, but Ollama is not reachable. Start Ollama or configure a reachable endpoint.`,
      )
    }

    const response = await callOllama(request.messages, effectiveCapability, baseUrl)
    return {
      ...response,
      routingDecision: {
        ...response.routingDecision,
        complexityScore: score,
        reason: `On-prem enforced (${request.dataClassification}). ${reason}`,
      },
    }
  }

  // Cloud path via OpenRouter
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is required for cloud model routing")
  }

  const modelOverride = config.modelOverrides?.[effectiveCapability]
  const response = await callOpenRouter(
    request.messages,
    effectiveCapability,
    config.openRouterApiKey,
    modelOverride,
  )

  return {
    ...response,
    routingDecision: {
      ...response.routingDecision,
      complexityScore: score,
      reason,
    },
  }
}
