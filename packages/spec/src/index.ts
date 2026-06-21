export type { SpecStore } from "./store.js"
export { createInMemorySpecStore } from "./store.js"

export { generatePRD, generateArchitectureDoc, generateTechnicalSpec } from "./generator.js"

export { canApprove, submitForReview, approveSpec, rejectSpec } from "./approval.js"

export { extractTicketRefs, extractAdrRefs, buildTraceabilityReport } from "./traceability.js"

export { createSpecRouter } from "./spec-router.js"
