import type { Skill } from "@devos/core"

export const BUILT_IN_SKILLS: Skill[] = [
  {
    id: "debug",
    name: "Debug",
    description: "Systematic debugging: reproduce, minimise, hypothesise, instrument, fix, verify",
    triggerKeywords: ["bug", "error", "crash", "broken", "failing", "not working", "exception", "undefined", "null"],
    promptTemplate: `You are in systematic debug mode. Follow this loop:
1. REPRODUCE — confirm you can reproduce the issue
2. MINIMISE — identify the smallest case that triggers it
3. HYPOTHESISE — form a specific hypothesis about the root cause
4. INSTRUMENT — add logging/assertions to verify the hypothesis
5. FIX — apply the minimal fix
6. VERIFY — confirm the fix and check for regressions

Do not skip steps. State which step you are on.`,
    requiredTools: [],
    requiredModelCapability: "frontier",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "security-audit",
    name: "Security Audit",
    description: "OWASP Top 10 security review covering injection, auth, secrets, dependencies",
    triggerKeywords: ["security", "audit", "vulnerability", "owasp", "secret", "auth", "sql injection", "xss", "before merge", "before pr"],
    promptTemplate: `You are a security engineer performing a focused audit. Check for:
- OWASP Top 10: injection, broken auth, XSS, insecure deserialization, XXE, broken access control
- Hardcoded secrets, API keys, tokens
- Dependency vulnerabilities (flag any outdated or known-CVE deps)
- Input validation at system boundaries
- Missing authentication or authorisation checks

For each finding: severity (critical/high/medium/low), file + line, description, recommended fix.
Return a structured report.`,
    requiredTools: [],
    requiredModelCapability: "frontier",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "Code quality review: conventions, patterns, dead code, error handling",
    triggerKeywords: ["review", "pr", "pull request", "code quality", "feedback", "check my code"],
    promptTemplate: `You are reviewing code as a thoughtful senior engineer. Focus on:
- Correctness: logic errors, edge cases, off-by-ones
- Conventions: naming, structure, patterns consistent with the rest of the codebase
- Simplicity: unnecessary complexity, premature abstraction, dead code
- Error handling: unhandled failures, silent errors, missing validation at boundaries

Be specific: file, line, issue, suggested fix. Do not suggest stylistic changes that don't affect correctness or clarity.`,
    requiredTools: [],
    requiredModelCapability: "medium",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "test-generation",
    name: "Generate Tests",
    description: "Generate unit and integration test cases for uncovered code",
    triggerKeywords: ["test", "coverage", "spec", "unit test", "write tests", "missing tests"],
    promptTemplate: `Generate test cases for the provided code. For each test:
- Describe what behaviour is being tested (not the implementation)
- Cover: happy path, edge cases, error cases, boundary conditions
- Use the project's existing test framework and conventions
- Prefer integration tests over mocked unit tests where the function touches real dependencies

Do not test implementation details. Test observable behaviour.`,
    requiredTools: [],
    requiredModelCapability: "medium",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "ui-fix",
    name: "Fix UI Issue",
    description: "Diagnose and fix visual bugs, layout issues, and responsive design problems",
    triggerKeywords: ["ui", "layout", "visual", "responsive", "css", "style", "looks wrong", "design bug", "spacing", "alignment"],
    promptTemplate: `You are fixing a UI/visual issue. Approach:
1. Identify the exact element and property causing the problem
2. Check if it's a CSS specificity, layout mode (flex/grid), or responsive breakpoint issue
3. Verify the fix doesn't introduce regressions in other viewports
4. Prefer targeted fixes over broad changes — don't refactor surrounding styles

If given a screenshot description, infer the layout from the described symptoms. State your reasoning.`,
    requiredTools: [],
    requiredModelCapability: "medium",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "plan-feature",
    name: "Plan Feature",
    description: "Break a feature request into ordered, independently buildable tasks",
    triggerKeywords: ["plan", "break down", "tasks", "implement", "how do i", "where do i start", "feature"],
    promptTemplate: `You are a technical lead planning a feature implementation. Produce:
1. A one-sentence description of the feature and its user value
2. An ordered list of implementation tasks — each independently buildable, with a clear done condition
3. For each task: estimated complexity (S/M/L), files likely affected, dependencies on other tasks
4. Any risks or unknowns to investigate first

Vertical slices only — each task should deliver working functionality, not just a layer.`,
    requiredTools: [],
    requiredModelCapability: "frontier",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "explain",
    name: "Explain Code",
    description: "Explain what code does, why it's structured this way, and how it connects to the rest",
    triggerKeywords: ["explain", "what does", "how does", "understand", "walk me through", "what is this"],
    promptTemplate: `Explain the provided code at the appropriate level of abstraction. Cover:
- What it does (the what)
- Why it's designed this way (the why — constraints, trade-offs, patterns)
- How it connects to the rest of the system (entry points, callers, dependencies)
- Any non-obvious behaviour or gotchas

Tailor the explanation to a developer who knows the language but is unfamiliar with this specific code.`,
    requiredTools: [],
    requiredModelCapability: "small",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
  {
    id: "changelog",
    name: "Generate Changelog",
    description: "Generate user-facing and technical changelogs from commits and closed tickets",
    triggerKeywords: ["changelog", "release notes", "what changed", "release", "ship"],
    promptTemplate: `Generate a release changelog from the provided commits and closed tickets.

Produce two sections:
**For users** (plain English, non-technical):
- What's new (features)
- What's fixed (bugs)
- Performance improvements (if notable)

**Technical** (for developers):
- All commits grouped by type (feat/fix/perf/chore/security)
- Breaking changes highlighted

Exclude: internal refactors, CI changes, dependency bumps (unless security-related). Write user-facing copy as if explaining to a non-technical stakeholder.`,
    requiredTools: [],
    requiredModelCapability: "medium",
    isPublic: true,
    version: "1.0.0",
    createdAt: new Date(),
  },
]
