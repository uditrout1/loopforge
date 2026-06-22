import { randomUUID } from "node:crypto"
import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"
import type { EvalCriteria, EvalType, Spec } from "@loopforge/core"
import type { EvalStore } from "./store.js"

interface GeneratedCriteria {
  name: string
  description: string
  type: EvalType
  prompt: string
  threshold: number
}

export async function generateEvalsFromSpec(
  projectId: string,
  spec: Spec,
  store: EvalStore,
  routerConfig: RouterConfig,
): Promise<EvalCriteria[]> {
  const prompt = `You are an evaluation engineer. Given the following spec, extract 3-5 evaluation criteria that can be used to verify implementations meet the requirements.

Spec title: ${spec.title}
Spec type: ${spec.type}

Spec content:
${spec.content}

Respond ONLY with a JSON array in this exact format:
[
  {
    "name": "Short criteria name",
    "description": "What this criteria checks",
    "type": "engineering_standard" | "product_criteria" | "design_standard" | "architecture_compliance",
    "prompt": "Evaluate the following content against this criteria: <describe what to check and how to score>. Score 0-1 where 1 is fully compliant.",
    "threshold": 0.7
  }
]`

  const response = await route(
    {
      messages: [{ role: "user", content: prompt }],
      projectId,
      sessionId: randomUUID(),
      dataClassification: "internal",
      preferredCapability: "medium",
    },
    routerConfig,
  )

  let items: GeneratedCriteria[] = []
  try {
    const text = response.content.trim()
    const jsonStart = text.indexOf("[")
    const jsonEnd = text.lastIndexOf("]")
    if (jsonStart !== -1 && jsonEnd !== -1) {
      items = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as GeneratedCriteria[]
    }
  } catch {
    return []
  }

  const now = new Date()
  const results: EvalCriteria[] = []

  for (const item of items.slice(0, 5)) {
    if (!item.name || !item.prompt) continue
    const criteria: EvalCriteria = {
      id: randomUUID(),
      projectId,
      name: item.name,
      description: item.description ?? "",
      type: item.type ?? "product_criteria",
      prompt: item.prompt,
      threshold: typeof item.threshold === "number" ? Math.min(1, Math.max(0, item.threshold)) : 0.7,
      sourceSpecId: spec.id,
      sourceAdrId: undefined,
      createdAt: now,
      updatedAt: now,
    }
    await store.saveCriteria(criteria)
    results.push(criteria)
  }

  return results
}
