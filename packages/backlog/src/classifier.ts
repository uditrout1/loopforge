import type { TicketType } from "@loopforge/core"

// ─── Keyword sets ─────────────────────────────────────────────────────────────

const SECURITY_KEYWORDS = [
  "vulnerability",
  "cve",
  "injection",
  "xss",
  "auth bypass",
  "secret",
  "exposed",
  "csrf",
  "sqli",
  "rce",
  "privilege escalation",
  "sensitive data",
]

const BUG_KEYWORDS = [
  "crash",
  "error",
  "broken",
  "fails",
  "exception",
  "not working",
  "regression",
  "wrong",
  "incorrect",
  "unexpected",
  "fix",
  "broke",
  "breaking",
]

const DEBT_KEYWORDS = [
  "refactor",
  "cleanup",
  "clean up",
  "technical debt",
  "slow",
  "performance",
  "outdated",
  "deprecated",
  "improve",
  "reorganize",
  "restructure",
  "modernize",
  "upgrade",
  "migrate",
]

// ─── Classifier ───────────────────────────────────────────────────────────────

export function classifyTicket(
  title: string,
  body: string,
): { type: TicketType; confidence: number } {
  const combined = `${title} ${body}`.toLowerCase()

  const securityMatches = countMatches(combined, SECURITY_KEYWORDS)
  const bugMatches = countMatches(combined, BUG_KEYWORDS)
  const debtMatches = countMatches(combined, DEBT_KEYWORDS)

  // Security takes top priority regardless of count
  if (securityMatches > 0) {
    return { type: "security", confidence: Math.min(0.6 + securityMatches * 0.1, 1.0) }
  }

  if (bugMatches > 0 && bugMatches >= debtMatches) {
    return { type: "bug", confidence: Math.min(0.5 + bugMatches * 0.1, 1.0) }
  }

  if (debtMatches > 0) {
    return { type: "debt", confidence: Math.min(0.5 + debtMatches * 0.1, 1.0) }
  }

  // Default to feature
  return { type: "feature", confidence: 0.4 }
}

function countMatches(text: string, keywords: string[]): number {
  let count = 0
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      count++
    }
  }
  return count
}
