import type { Spec } from "@loopforge/core"

// Check if a spec can be approved (must be in 'in_review' status)
export function canApprove(spec: Spec): boolean {
  return spec.status === "in_review"
}

// Submit spec for review
export function submitForReview(spec: Spec): Spec {
  return {
    ...spec,
    status: "in_review",
    updatedAt: new Date(),
  }
}

// Approve a spec
export function approveSpec(spec: Spec, approvedBy: string): Spec {
  if (!canApprove(spec)) {
    throw new Error(`Spec ${spec.id} cannot be approved: current status is '${spec.status}'`)
  }
  return {
    ...spec,
    status: "approved",
    approvedBy,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }
}

// Reject a spec with a reason (stored in content as a footer note)
export function rejectSpec(spec: Spec, rejectedBy: string, reason: string): Spec {
  const rejectionNote = `\n\n---\n\n**Rejected** by ${rejectedBy} on ${new Date().toISOString()}\n\n**Reason:** ${reason}`
  return {
    ...spec,
    status: "rejected",
    content: spec.content + rejectionNote,
    updatedAt: new Date(),
  }
}
