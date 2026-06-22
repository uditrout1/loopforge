# Contributing to LoopForge

This document covers development setup, conventions, and how to extend LoopForge with new skills, workflows, context packs, and spec generators.

---

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Clone and install

```bash
git clone https://github.com/uditrout1/devos
cd devos
pnpm install
```

### Build

```bash
pnpm build                              # build all packages
pnpm dev                                # run gateway + UI in watch mode
pnpm --filter @devos/gateway dev        # gateway only
pnpm --filter apps/ui dev              # UI only
```

### Environment

```bash
cp .env.example .env
# Minimum: set OPENROUTER_API_KEY
# For on-prem: set OLLAMA_BASE_URL
# For persistence: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
```

---

## Monorepo Structure

```
packages/
  core/       — shared types only, no implementations, no runtime deps
  brain/      — repo indexer, chunker, context loader, built-in context packs
  router/     — model routing (OpenRouter + Ollama), complexity tiers, data classification
  skills/     — skill registry, built-in skills, keyword recommender, capability gap advisor
  workflows/  — multi-agent workflow engine, built-in workflows, epic decomposer
  backlog/    — GitHub Issues integration, ticket classification, AI prioritization
  adr/        — ADR extraction and storage
  spec/       — PRD/architecture/technical spec generation and approval workflows
  db/         — Supabase persistence adapter (pgvector for embeddings)
  gateway/    — Hono HTTP gateway (port 18790), all routes, auth middleware
apps/
  ui/         — Next.js 15 developer UI (chat, skill browser, pack selector, cost dashboard)
```

**Package dependency order:**
```
core ← brain, router, skills, backlog, adr, spec ← workflows ← gateway
```

---

## Conventions

### Code

- TypeScript strict mode throughout (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`)
- No `any` — use `unknown` and narrow
- Prefer `node:` protocol for built-in imports (`node:crypto`, `node:fs/promises`)
- No comments explaining what code does — only why if genuinely non-obvious
- No unused variables, no dead code

### Packages

- Each package has a single responsibility
- `@devos/core` exports types only — no runtime dependencies
- Provider implementations (OpenRouter, Ollama) are swappable behind the same interface
- New providers go in `packages/router/src/providers/`

### Git

- Branch names: `feat/description`, `fix/description`, `chore/description`
- Commit messages: imperative present tense (`add Gemini provider`, not `added` or `adds`)
- One logical change per commit
- PRs should be small and independently mergeable

---

## Adding a Skill

Skills live in `packages/skills/src/built-in.ts`. A skill requires:

```typescript
{
  id: "unique-kebab-id",
  name: "Human Readable Name",
  description: "One sentence — used for similarity search. Be specific.",
  triggerKeywords: ["keyword1", "keyword2"],   // phrases that activate it
  promptTemplate: `Your skill's system prompt here.`,
  requiredTools: [],
  requiredModelCapability: "small" | "medium" | "frontier",
  isPublic: true,
  version: "1.0.0",
  createdAt: new Date(),
}
```

After adding: rebuild and verify the skill appears in `GET /skills` and keyword matching works.

Skills that require frontier models should justify the requirement in a comment — the default preference is the lowest tier that produces acceptable output.

---

## Adding a Workflow

Workflows live in `packages/workflows/src/built-in/`. Each workflow is a directed agent graph.

1. Create `packages/workflows/src/built-in/<your-workflow>.ts`
2. Export a `WorkflowDefinition` (type in `@devos/core`):

```typescript
export const myWorkflow: WorkflowDefinition = {
  id: "my-workflow",
  name: "Human Readable Name",
  description: "What this workflow does and when to use it.",
  steps: [
    {
      id: "step-1",
      agentRole: "...",           // system prompt for this step's agent
      inputs: ["$initial"],       // step inputs ($ prefix = workflow input)
      outputs: ["step1_result"],
      modelTier: "medium",
    },
    // parallel steps: set runParallel: true on each
    // conditional branching: use condition field
    // human checkpoints: set requiresApproval: true
  ],
}
```

3. Register it in `packages/workflows/src/built-in/index.ts`

---

## Adding a Context Pack

Context packs live in `packages/brain/src/packs/`. A pack is a curated slice of context loaded at session start for a specific task type.

1. Create `packages/brain/src/packs/<pack-id>.ts`
2. Export a `ContextPack`:

```typescript
export const authPack: ContextPack = {
  id: "auth",
  name: "Authentication",
  description: "Auth patterns, session handling, token flows.",
  fileGlobs: ["**/auth/**", "**/middleware/auth*", "**/session*"],
  systemPromptAddition: `
    Focus on the project's authentication conventions.
    Note any deviations from standard patterns.
  `,
}
```

3. Register it in `packages/brain/src/packs/index.ts`

Packs are selected at session creation via `packId`. The brain loader uses the pack's `fileGlobs` to prioritize which chunks are loaded into context.

---

## Adding a Spec Generator

Spec generators live in `packages/spec/src/generators/`. LoopForge ships generators for PRDs, architecture docs, and technical specs.

1. Create `packages/spec/src/generators/<type>.ts`
2. Implement the `SpecGenerator` interface (type in `@devos/core`):

```typescript
export const mySpecGenerator: SpecGenerator = {
  type: "my-spec-type",
  name: "My Spec Type",
  promptTemplate: `
    Given the following project context:
    {{projectContext}}

    Generate a <your spec type> that covers:
    - ...
  `,
  outputSchema: z.object({ ... }),   // Zod schema for structured output
  requiresApproval: true,            // gate downstream tasks on approval
}
```

3. Register it in `packages/spec/src/generators/index.ts`

Approved specs are stored and referenced by the epic decomposer when creating tickets.

---

## Adding a Model Provider

Providers live in `packages/router/src/providers/`. Each provider must:

1. Accept `messages: Message[]`, a capability tier, and provider-specific config
2. Return a `ModelResponse` matching the type in `@devos/core`
3. Handle rate limits (429) with exponential backoff internally
4. Report accurate `inputTokens`, `outputTokens`, and `costUsd`

Wire the new provider into `packages/router/src/router.ts`.

---

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes — keep scope narrow
3. Ensure `pnpm build` passes with zero errors
4. Open a PR with a clear title and description of what changed and why
5. A maintainer will review within a few days

For larger changes (new packages, new workflow types, major refactors), open a Discussion first to align on approach before writing code.

---

## Reporting Bugs

Use the [bug report template](../../issues/new?template=bug_report.md). Include:
- What you did
- What you expected
- What actually happened
- LoopForge version and Node.js version

---

## Code of Conduct

Be direct, respectful, and constructive. We are here to build good software together.
