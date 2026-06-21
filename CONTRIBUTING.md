# Contributing to DevOS

Thank you for your interest in contributing. This document covers how to set up a development environment, the conventions we follow, and the process for getting changes merged.

---

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9+

### Clone and install

```bash
git clone https://github.com/your-org/devos
cd devos
pnpm install
```

### Build

```bash
pnpm build          # build all packages
pnpm --filter @devos/gateway dev   # run gateway in watch mode
```

### Environment

```bash
cp .env.example .env
# Set OPENROUTER_API_KEY for cloud model routing
# Set OLLAMA_BASE_URL if running local models
```

---

## Monorepo Structure

```
packages/
  core/       — shared types only, no implementations
  brain/      — repo indexer, chunker, session context
  router/     — model routing (OpenRouter + Ollama)
  skills/     — skill registry and built-in skills
  gateway/    — Hono API server (the control plane)
apps/
  ui/         — Next.js developer interface (coming soon)
```

**Package dependency order:** `core` ← `brain`, `router`, `skills` ← `gateway`

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
- New built-in skills go in `packages/skills/src/built-in.ts`

### Git

- Branch names: `feat/description`, `fix/description`, `chore/description`
- Commit messages: imperative present tense (`add Gemini provider`, not `added` or `adds`)
- One logical change per commit
- PRs should be small and independently mergeable

---

## Adding a Skill

Skills live in `packages/skills/src/built-in.ts`. A skill needs:

```typescript
{
  id: "unique-kebab-id",
  name: "Human Readable Name",
  description: "One sentence — used for similarity search. Be specific.",
  triggerKeywords: ["keyword1", "keyword2"],   // what phrases activate it
  promptTemplate: `Your skill's system prompt here.`,
  requiredTools: [],
  requiredModelCapability: "small" | "medium" | "frontier",
  isPublic: true,
  version: "1.0.0",
  createdAt: new Date(),
}
```

After adding: rebuild and verify the skill appears in `GET /skills` (once that route exists) and that keyword matching works.

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
- DevOS version and Node.js version

---

## Code of Conduct

Be direct, respectful, and constructive. We are here to build good software together.
