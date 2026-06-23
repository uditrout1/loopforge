# LoopForge

**The brain for your project.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![CI](https://github.com/uditrout1/loopforge/actions/workflows/ci.yml/badge.svg)](https://github.com/uditrout1/loopforge/actions/workflows/ci.yml)

LoopForge is a **Product Engineering Intelligence** platform. It is not a coding assistant. It is the persistent brain your entire product engineering team thinks through — connecting business intent, architecture decisions, implementation, and quality outcomes into a single living graph.

---

## Platform Intelligence Stack

```
Business Intent (PRD)
        ↓ REQUIRES
Requirements ──────────────────── VALIDATED_BY ──→ Evaluations
        ↓ DEFINES                                        ↓ SCORES
Specifications ── GENERATES ──→ ADRs              Implementation
        ↓                             ↓ APPROVES
        └─────────── IMPLEMENTS ──→ Code / Files
                                        ↓ INCLUDED_IN
                                   Pull Requests ── TAGGED_IN ──→ Releases

All entities connected through the Product Engineering Knowledge Graph.
LoopForge becomes your system of record for knowledge, decisions, and judgment.
```

---

## What LoopForge Is NOT / What LoopForge IS

| NOT | IS |
|---|---|
| A coding copilot | A full product engineering intelligence layer |
| A chat wrapper around an LLM | A persistent project brain with indexed memory |
| A one-model solution | An intelligent model router (small → frontier, cloud → on-prem) |
| A task tracker | An AI-maintained backlog with GitHub integration |
| A script runner | A multi-agent workflow engine |
| A documentation generator | A spec-driven development system with approval gates |
| A design viewer | A visual context engine that links designs to code |
| A search index | A traversable knowledge graph with lineage and impact analysis |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                        LoopForge Gateway                          │
│                         (Hono · :18790)                           │
├──────────┬──────────┬──────────┬──────────┬──────────┬────────────┤
│ Projects │ Sessions │ Backlog  │Workflows │Specs/ADR │   Graph    │
│  +Packs  │ +Vision  │ +GitHub  │ +Decomp  │+Approval │  Explorer  │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┴─────┬──────┘
     │          │          │          │          │           │
     ▼          ▼          ▼          ▼          ▼           ▼
 @lf/brain  @lf/router @lf/backlog @lf/wf  @lf/spec    @lf/graph
                                           @lf/adr
                                           @lf/vision
                                               │
                                  All write to ↓
                          ┌──────────────────────────┐
                          │   Knowledge Graph        │
                          │   (graph_nodes +         │
                          │    graph_edges)          │
                          └───────────┬──────────────┘
                                      ↓
                               Supabase + pgvector
```

### Packages

| Package | Responsibility |
|---|---|
| `@loopforge/core` | Shared TypeScript types — no implementations, no runtime deps |
| `@loopforge/brain` | Repo indexer, chunker, context loader, built-in context packs |
| `@loopforge/router` | Model routing: OpenRouter (cloud) + Ollama (on-prem), complexity tiers, data classification |
| `@loopforge/skills` | 8 built-in skills, keyword recommender, capability gap advisor |
| `@loopforge/workflows` | Multi-agent workflow engine, 4 built-in workflows, epic decomposer |
| `@loopforge/backlog` | GitHub Issues integration, ticket classification, AI prioritization |
| `@loopforge/adr` | Architecture Decision Record extraction and storage |
| `@loopforge/spec` | PRD, architecture doc, and technical spec generation with approval workflows |
| `@loopforge/vision` | Visual Context Engine — screenshots, Figma, wireframes linked to code |
| `@loopforge/graph` | Product Engineering Knowledge Graph — lineage, impact analysis, traceability |
| `@loopforge/evals` | Eval Engine — converts requirements and standards into executable quality criteria; AI scoring, human feedback, regression detection |
| `@loopforge/goals` | Engineering Goals — Claude decomposes high-level goals into tickets, tracks progress, surfaces blockers |
| `@loopforge/events` | Typed in-process event bus — `LoopForgeEventMap` covering project, graph, ADR, eval, goal, release, and scan events |
| `@loopforge/db` | Supabase persistence adapter — write-through stores for projects, graph, ADRs, evals, goals; `createPersistentProjectsMap` Proxy |
| `@loopforge/gateway` | Hono HTTP gateway (port 18790), all routes, auth middleware, file browser API |
| `apps/ui` | Next.js 15 developer UI — Knowledge/Editor/Judgment/Execution/Visual/Governance nav, Monaco code editor, graph explorer, goals, evals |

**Package dependency order:**
```
core ← brain, router, skills, backlog, adr, spec, vision, graph, evals, goals, events ← workflows ← gateway
```

---

## Features by Lifecycle Stage

### Spec
- **Spec-Driven Development** — generate PRDs, architecture docs, and technical specs via `POST /specs/:projectId/generate`
- **Approval workflows** — specs must be approved before downstream tasks are created
- **ADR extraction** — architectural decisions captured automatically from sessions; exportable as markdown
- **Eval generation** — approved specs can generate evaluation criteria from requirements automatically

### Code
- **Project Brain** — index a repo once; every session starts fully loaded with stack detection, conventions, and TODO surfacing
- **Context Packs** — curated context slices per task type (auth, database, API, UI, etc.) loaded at session start via `packId`
- **Capability Gap Advisor** — surfaces expertise gaps proactively (security, a11y, performance, testing, architecture, docs)
- **8 built-in skills** — `debug`, `security-audit`, `code-review`, `test-generation`, `ui-fix`, `plan-feature`, `explain`, `changelog`
- **Monaco Code Editor** — in-browser editor with file tree, language detection for 20+ extensions, dirty-state indicator, Cmd+S save; backed by a secure file API with symlink traversal protection

### Design
- **Visual Context Engine** — upload a screenshot or paste a Figma URL; LoopForge analyzes UX issues, accessibility gaps, and copy problems, then links findings directly to source files
- **Design-to-code linking** — component names detected in visual analysis are matched against indexed code chunks
- **Multimodal sessions** — attach images directly to session messages; the frontier model reasons over code and visual context together

### Review
- **Multi-Agent Workflows** — PR review, bug investigation, release prep, nightly security scan
- **Intelligent Model Routing** — complexity-based tier selection: simple tasks → small model (Qwen 7B), code gen → medium, debugging/architecture → frontier
- **Data Classification Enforcement** — confidential/restricted projects automatically routed to on-prem Ollama; data never leaves your network
- **Eval Engine** — structured evaluation suites with AI scoring, human feedback capture, and regression detection
- **Engineering Goals** — set a high-level goal ("Ship Family Controls integration"), Claude decomposes it into sprint-ready tickets with dependency ordering; progress tracked as tickets resolve; blockers surfaced automatically

### Release
- **Epic Decomposer** — `POST /projects/:id/decompose` turns an epic description into sprint-ready tickets with file links pre-populated
- **AI-Maintained Backlog** — GitHub Issues integration, AI prioritization, health checks via `GET /backlog/tickets/:projectId`
- **GitHub Webhook** — live ticket sync on push/PR events via `POST /backlog/webhook/github`

### Learn
- **Product Engineering Knowledge Graph** — traversable graph connecting PRDs, requirements, specs, ADRs, code files, tickets, PRs, evaluations, eval runs, and releases. Answer: "What breaks if this requirement changes?", "Which ADR approved this service?", "Did this eval pass after the last release?"
- **Full Traceability Chain** — `requirement → spec → ADR → evaluation → eval_run`; `ticket → pull_request → release`; `doc → module (IMPACTS)`; all edges stored with confidence scores and metadata
- **Graph Node Detail** — click any node to see its preview content, source doc, and all edges with linked-node titles; click-to-navigate to any connected node
- **ADR Store** — all architectural decisions queryable and exportable per project
- **Cost Dashboard** — token usage and cost breakdown by session, project, and model in the UI

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/uditrout1/loopforge && cd loopforge && pnpm install

# 2. Configure
cp .env.example .env
# Set at minimum: OPENROUTER_API_KEY

# 3. Run
pnpm dev
# Gateway: http://localhost:18790
# UI:      http://localhost:3000
```

### Connect a project

```bash
# Connect an existing repo (indexes code + parses CLAUDE.md/PRD.md/BRD.md into graph)
curl -X POST http://localhost:18790/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "repoPath": "/path/to/repo"}'

# Start a session with a context pack
curl -X POST http://localhost:18790/sessions \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<id>", "packId": "auth"}'

# Set an engineering goal — Claude decomposes it into tickets automatically
curl -X POST http://localhost:18790/goals/<projectId> \
  -H "Content-Type: application/json" \
  -d '{"title": "Ship Family Controls integration", "description": "Add screen time restrictions using ScreenTimeAPI entitlement", "autoDecompose": true}'

# Run an eval against a spec or file
curl -X POST http://localhost:18790/evals/<projectId>/run \
  -H "Content-Type: application/json" \
  -d '{"criteriaId": "<id>", "targetType": "spec", "targetId": "<specId>", "content": "..."}'

# Analyze a screenshot
curl -X POST http://localhost:18790/vision/<projectId>/screenshot \
  -H "Content-Type: application/json" \
  -d '{"name": "checkout flow", "base64": "<base64>", "mediaType": "image/png", "question": "What UX issues do you see?"}'

# Query the knowledge graph
curl http://localhost:18790/graph/<projectId>/nodes/<nodeId>/downstream
```

---

## API Reference

All routes require `X-API-Key: <LOOPFORGE_API_KEY>` when `HOST != 127.0.0.1`.

### Core

| Method | Route | Description |
|---|---|---|
| `POST` | `/projects` | Connect a repo |
| `POST` | `/sessions` | Start a session (optional `packId`) |
| `POST` | `/sessions/:id/messages` | Send a message → AI response + skill recommendations + capability gaps |
| `POST` | `/projects/:id/decompose` | Decompose an epic into sprint-ready tickets |

### Specs & ADRs

| Method | Route | Description |
|---|---|---|
| `POST` | `/specs/:projectId/generate` | Generate PRD / architecture / technical spec |
| `POST` | `/specs/:projectId/:id/approve` | Approve a spec |
| `GET` | `/adrs/:projectId` | List ADRs for a project |
| `GET` | `/adrs/:projectId/export` | Export all ADRs as markdown |

### Knowledge Graph

| Method | Route | Description |
|---|---|---|
| `GET` | `/graph/:projectId/summary` | Node and edge counts by type |
| `GET` | `/graph/:projectId/nodes` | List nodes, filterable by `?type=` |
| `GET` | `/graph/:projectId/nodes/:nodeId` | Node with all edges |
| `GET` | `/graph/:projectId/nodes/:nodeId/upstream` | Lineage — what caused this to exist |
| `GET` | `/graph/:projectId/nodes/:nodeId/downstream` | Impact — what changes if this changes |
| `GET` | `/graph/:projectId/trace` | Shortest path between `?from=&to=` |
| `GET` | `/graph/:projectId/search` | Full-text search over node titles |
| `POST` | `/graph/:projectId/nodes` | Manually create a node |
| `POST` | `/graph/:projectId/edges` | Manually create an edge |

### Engineering Goals

| Method | Route | Description |
|---|---|---|
| `GET` | `/goals/:projectId` | List goals with progress |
| `POST` | `/goals/:projectId` | Create goal (Claude decomposes if `autoDecompose: true`) |
| `POST` | `/goals/:projectId/:goalId/decompose` | Re-decompose goal into tickets |
| `PATCH` | `/goals/:projectId/:goalId/tickets/:ticketId` | Update ticket status / mark as blocker |
| `DELETE` | `/goals/:projectId/:goalId` | Delete goal |

### Evals

| Method | Route | Description |
|---|---|---|
| `GET` | `/evals/:projectId/criteria` | List evaluation criteria |
| `POST` | `/evals/:projectId/criteria` | Create criteria (name, prompt, threshold) |
| `POST` | `/evals/:projectId/run` | Run an eval against content |
| `GET` | `/evals/:projectId/runs` | List runs (optional `?criteriaId=`) |
| `POST` | `/evals/:projectId/runs/:runId/feedback` | Submit human feedback (approved/rejected/partial) |
| `GET` | `/evals/:projectId/summary` | Pass rate, regression count, total runs |

### Settings & Model Control

| Method | Route | Description |
|---|---|---|
| `GET` | `/settings` | Read current settings (models, workflows, routing, UI prefs) |
| `PUT` | `/settings` | Update settings — deep merge, confidentialOnPremOnly always locked |
| `GET` | `/settings/models/available` | Curated list of OpenRouter + Ollama models by tier |
| `DELETE` | `/settings/reset` | Reset all settings to defaults |

### Releases

| Method | Route | Description |
|---|---|---|
| `GET` | `/releases/:projectId` | List releases, newest first |
| `POST` | `/releases/:projectId/generate` | Generate changelog with Claude from PR + ticket list |
| `PATCH` | `/releases/:projectId/:releaseId` | Edit release name or changelog |
| `POST` | `/releases/:projectId/:releaseId/publish` | Publish release (draft → published) |
| `DELETE` | `/releases/:projectId/:releaseId` | Delete release |

### Backlog & Workflows

| Method | Route | Description |
|---|---|---|
| `GET` | `/backlog/tickets/:projectId` | Prioritized ticket list |
| `POST` | `/backlog/webhook/github` | GitHub webhook receiver |
| `GET` | `/workflows` | List available workflows |
| `POST` | `/workflows/:id/runs` | Start a workflow run |

### Visual Context

| Method | Route | Description |
|---|---|---|
| `POST` | `/vision/:projectId/screenshot` | Analyze a screenshot → structured UX + a11y + code feedback |
| `POST` | `/vision/:projectId/figma` | Analyze a Figma URL |
| `POST` | `/vision/:projectId/assets/:id/ask` | Follow-up question on an existing visual asset |
| `GET` | `/vision/:projectId/assets` | List visual assets for a project |

### File Browser (Editor API)

| Method | Route | Description |
|---|---|---|
| `GET` | `/projects/:id/files` | Directory tree (depth 1–6, skips `node_modules`, `.git`, `dist`, etc.) |
| `GET` | `/projects/:id/files/content?path=<rel>` | Read file content (≤500 KB, symlinks rejected) |
| `PUT` | `/projects/:id/files/content` | Write file content `{ path, content }` (≤500 KB, symlinks rejected, `realpath`-validated) |

---

## Environment Variables

```bash
# Model routing
OPENROUTER_API_KEY=         # Cloud model access (required for cloud tiers)
OLLAMA_BASE_URL=            # On-prem model endpoint (default: http://localhost:11434)

# Gateway
PORT=18790
HOST=127.0.0.1              # Set to 0.0.0.0 for remote access (requires LOOPFORGE_API_KEY)
LOOPFORGE_API_KEY=          # Required when HOST != 127.0.0.1
ALLOWED_REPO_ROOTS=         # Colon-separated allowed repo paths
CORS_ORIGINS=               # Comma-separated allowed origins

# Persistence (Supabase — all lf_* tables, RLS disabled, gateway is sole writer)
SUPABASE_URL=               # https://<project>.supabase.co
SUPABASE_ANON_KEY=          # Publishable key (sb_publishable_…)

# GitHub integration
GITHUB_WEBHOOK_SECRET=      # For GitHub webhook verification
```

---

## Deployment

### Docker Compose

```yaml
services:
  gateway:
    build: .
    ports:
      - "18790:18790"
    environment:
      HOST: 0.0.0.0
      PORT: 18790
      LOOPFORGE_API_KEY: ${LOOPFORGE_API_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      OLLAMA_BASE_URL: http://ollama:11434
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET}

  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama

  ui:
    build: apps/ui
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_GATEWAY_URL: http://gateway:18790

volumes:
  ollama_data:
```

For confidential/restricted workloads, omit `OPENROUTER_API_KEY` — all requests fall back to Ollama automatically.

---

## Roadmap

### Shipped
- [x] Project brain (repo indexing + context loading)
- [x] Context packs (curated per task type)
- [x] Skill registry, keyword recommender, capability gap advisor
- [x] Multi-provider model routing (OpenRouter + Ollama), complexity tiers, data classification
- [x] Multi-agent workflow engine + 4 built-in workflows
- [x] Epic decomposer
- [x] GitHub Issues backlog integration + AI prioritization
- [x] ADR extraction and storage
- [x] Spec-driven development (PRD / architecture / technical spec + approval)
- [x] Supabase persistence + pgvector semantic search
- [x] Next.js 15 developer UI
- [x] Visual Context Engine (screenshots, Figma, design-to-code linking, UX/a11y analysis)
- [x] Product Engineering Knowledge Graph — lineage, impact analysis, BFS traversal, graph explorer UI
- [x] Eval Engine — evaluation criteria, AI scoring, human feedback loop, regression detection
- [x] Engineering Goals — Claude decomposes goals into tickets, progress tracking, blocker surfacing
- [x] Vibe Coder wizard — start from scratch with BRD/FRD/PRD templates + AI fill; or connect an existing repo

- [x] Doc scanner — auto-ingests `CLAUDE.md`, `PRD.md`, `BRD.md`, `README.md`, `adr/*.md` into knowledge graph on repo connect; extended to also match `product.md`, `requirements.md`
- [x] Settings page — model selection per tier (small/medium/frontier), workflow toggles, on-prem routing, cost limits
- [x] Model pin API — `GET/PUT /settings`, `GET /settings/models/available`, RouterConfig `modelOverrides`
- [x] Releases — AI changelog generation, draft → publish flow, PR + ticket tagging; published releases ingested into knowledge graph (`INCLUDED_IN` edges from tickets + PRs)
- [x] **Monaco Code Editor** — in-browser editor (Editor tab), file tree sidebar, language detection, Cmd+S save, dirty-state indicator
- [x] **File Browser API** — `GET/PUT /projects/:id/files/content` with `realpath`-based symlink traversal protection
- [x] **Full Traceability Chain** — eval criteria, eval runs, and releases all written to graph; `requirement→module IMPACTS` edges via keyword matching; graph node detail shows titles + clickable edges
- [x] **`@loopforge/events`** — typed in-process event bus (`LoopForgeEventMap`) for future reactive integrations
- [x] **Supabase write-through persistence** — `createPersistentProjectsMap` Proxy + Supabase stores for graph, ADRs, evals, goals; no data loss on gateway restart
- [x] **V2 navigation** — renamed tabs: Knowledge / Editor / Judgment / Execution / Visual / Governance

### In Progress
- [ ] **Deep repo analysis** — code-scan for repos without docs, generate draft BRD/FRD/PRD with human approval gate before graph ingestion
- [ ] **Project page overhaul** — rich dashboard showing stack, knowledge summary, TODOs, entry points
- [ ] **Docs backend** — `POST /projects/:id/initiate` saves BRD/FRD/PRD as specs; `POST /docs/ai-assist` fills templates from codebase context

### Coming
- [ ] Workflow marketplace — community-contributed workflow definitions
- [ ] Slack / email feedback ingestion into backlog
- [ ] PR review workflow with security scoring and staged rollout gate
- [ ] Workflow visual builder (drag-and-drop agent graph)
- [ ] MCP server mode — expose LoopForge as an MCP server to any compatible client
- [ ] Figma API integration — pull component trees directly without screenshots

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and how to add skills, workflows, context packs, and spec generators.

Found a bug? [Open an issue](https://github.com/uditrout1/loopforge/issues/new).
Have a feature idea? [Start a discussion](https://github.com/uditrout1/loopforge/discussions).

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

Built by the LoopForge contributors.
