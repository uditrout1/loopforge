import { randomUUID } from "node:crypto"
import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"
import type { EvalCriteria, EvalRun } from "@loopforge/core"
import type { EvalStore } from "./store.js"
import { parseScore, isRegression } from "./scorer.js"

export async function runEval(
  projectId: string,
  criteria: EvalCriteria,
  targetContent: string,
  store: EvalStore,
  routerConfig: RouterConfig,
): Promise<EvalRun> {
  const runId = randomUUID()
  const now = new Date()

  const pending: EvalRun = {
    id: runId,
    projectId,
    criteriaId: criteria.id,
    targetType: "content",
    targetId: `eval-${runId}`,
    score: 0,
    status: "running",
    reasoning: "",
    passed: false,
    regressionDetected: false,
    previousScore: undefined,
    createdAt: now,
    completedAt: undefined,
  }
  await store.saveRun(pending)

  try {
    const prompt =
      criteria.prompt +
      '\n\nRespond ONLY with valid JSON in this exact format: {"score": <number 0-1>, "reasoning": "<string>"}\n\nContent to evaluate:\n' +
      targetContent

    const response = await route(
      {
        messages: [{ role: "user", content: prompt }],
        projectId,
        sessionId: runId,
        dataClassification: "internal",
        preferredCapability: "medium",
      },
      routerConfig,
    )

    const score = parseScore(response.content)
    const previous = await store.getLastRun(projectId, criteria.id, pending.targetId)

    let reasoning = ""
    try {
      const parsed = JSON.parse(response.content) as Record<string, unknown>
      reasoning = typeof parsed["reasoning"] === "string" ? parsed["reasoning"] : response.content
    } catch {
      reasoning = response.content
    }

    const completed: EvalRun = {
      ...pending,
      score,
      status: score >= criteria.threshold ? "passed" : "failed",
      reasoning,
      passed: score >= criteria.threshold,
      regressionDetected: isRegression(score, previous?.score),
      previousScore: previous?.score,
      completedAt: new Date(),
    }
    await store.saveRun(completed)
    return completed
  } catch (err) {
    const failed: EvalRun = {
      ...pending,
      status: "error",
      reasoning: err instanceof Error ? err.message : "Unknown error",
      completedAt: new Date(),
    }
    await store.saveRun(failed)
    return failed
  }
}
