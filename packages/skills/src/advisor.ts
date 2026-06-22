import type { CapabilityGap, GapSeverity, Message } from "@loopforge/core"
import { randomUUID } from "node:crypto"

interface DomainRule {
  domain: string
  severity: GapSeverity
  triggerKeywords: string[]
  excludeIfSkillActive: string[]
  suggestedSkillId: string
  description: string
  exampleRisk: string
}

const DOMAIN_RULES: DomainRule[] = [
  {
    domain: "security",
    severity: "critical",
    triggerKeywords: ["login", "auth", "password", "token", "jwt", "session", "cookie", "csrf", "oauth", "signup", "register"],
    excludeIfSkillActive: ["security-audit"],
    suggestedSkillId: "security-audit",
    description: "Authentication flows require a security review before shipping.",
    exampleRisk: "Missing CSRF protection or insecure token storage could expose users to account takeover.",
  },
  {
    domain: "accessibility",
    severity: "high",
    triggerKeywords: ["form", "button", "input", "modal", "dialog", "click", "keyboard", "screen", "user interface", "ui", "component", "page", "layout"],
    excludeIfSkillActive: [],
    suggestedSkillId: "ui-fix",
    description: "UI changes should be reviewed for accessibility (WCAG 2.1 AA).",
    exampleRisk: "Missing ARIA labels, poor keyboard navigation, or low contrast ratios can exclude users with disabilities.",
  },
  {
    domain: "performance",
    severity: "medium",
    triggerKeywords: ["query", "database", "select", "join", "index", "n+1", "loop", "fetch", "load", "slow", "latency", "pagination"],
    excludeIfSkillActive: [],
    suggestedSkillId: "code-review",
    description: "Database or data-fetching changes may introduce performance regressions.",
    exampleRisk: "Unindexed queries or N+1 patterns can cause severe latency under load.",
  },
  {
    domain: "testing",
    severity: "medium",
    triggerKeywords: ["ship", "deploy", "release", "merge", "pr", "pull request", "production", "feature", "implement", "add"],
    excludeIfSkillActive: ["test-generation"],
    suggestedSkillId: "test-generation",
    description: "New features or changes should have test coverage before merging.",
    exampleRisk: "Untested code paths are 3x more likely to cause production incidents.",
  },
  {
    domain: "architecture",
    severity: "high",
    triggerKeywords: ["refactor", "migrate", "redesign", "new service", "new package", "split", "decouple", "monolith", "microservice", "architecture", "design"],
    excludeIfSkillActive: ["plan-feature"],
    suggestedSkillId: "plan-feature",
    description: "Architectural changes benefit from a structured design review before implementation.",
    exampleRisk: "Unreviewed architectural decisions create technical debt that compounds over time.",
  },
  {
    domain: "documentation",
    severity: "low",
    triggerKeywords: ["changelog", "release", "version", "publish", "ship", "launch", "announce"],
    excludeIfSkillActive: ["changelog"],
    suggestedSkillId: "changelog",
    description: "Releases should be accompanied by changelog and documentation updates.",
    exampleRisk: "Undocumented changes make it harder for users and teammates to understand what changed.",
  },
]

const SEVERITY_ORDER: Record<GapSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// Analyze what the developer is working on and return capability gaps.
// This is heuristic-based (v1) — no model call needed.
// Returns up to 3 gaps, highest severity first.
export function detectCapabilityGaps(
  projectId: string,
  sessionId: string,
  recentMessages: Message[],
  activeSkillIds: string[],
): CapabilityGap[] {
  const combined = recentMessages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase()

  const gaps: CapabilityGap[] = []

  for (const rule of DOMAIN_RULES) {
    const triggered = rule.triggerKeywords.some((kw) => combined.includes(kw))
    if (!triggered) continue

    const excluded = rule.excludeIfSkillActive.some((id) => activeSkillIds.includes(id))
    if (excluded) continue

    gaps.push({
      id: randomUUID(),
      projectId,
      sessionId,
      domain: rule.domain,
      severity: rule.severity,
      description: rule.description,
      suggestedSkillId: rule.suggestedSkillId,
      exampleRisk: rule.exampleRisk,
      dismissed: false,
      detectedAt: new Date(),
    })
  }

  return gaps
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3)
}
