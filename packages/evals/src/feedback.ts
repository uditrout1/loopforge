import { randomUUID } from "node:crypto"
import type { EvalFeedback, FeedbackVerdict } from "@loopforge/core"
import type { EvalStore } from "./store.js"

export async function submitFeedback(
  projectId: string,
  runId: string,
  verdict: FeedbackVerdict,
  rationale: string,
  submittedBy: string,
  store: EvalStore,
): Promise<EvalFeedback> {
  const feedback: EvalFeedback = {
    id: randomUUID(),
    runId,
    projectId,
    verdict,
    rationale,
    submittedBy,
    createdAt: new Date(),
  }
  await store.saveFeedback(feedback)
  return feedback
}
