# DevOS

**The AI developer operating system.**

DevOS is an open-source platform that gives software teams a shared brain: persistent project context, intelligent skill discovery, multi-provider model routing, an AI-maintained backlog, multi-agent workflows, and automated SDLC gates — all in one place.

Inspired by how [OpenClaw](https://github.com/openclaw/openclaw) built a gateway-first, plugin-first, local-first AI assistant, DevOS applies the same principles to the software development lifecycle.

---

## Why DevOS

Every team using AI tooling today solves the same problems independently:

- **Context loss** — every AI session starts from zero
- **Tool fragmentation** — 5+ separate tools with no shared intelligence
- **Uncontrolled cost** — frontier models for every task, no routing
- **No output verification** — AI results accepted without validation
- **Stale backlogs** — stakeholder feedback never makes it to tickets
- **Security gaps** — API keys everywhere, no audit trail

DevOS solves all of these as a single platform.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Developer UI                       │
│         (chat · canvas · backlog · dashboard)       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   Gateway                           │  ← control plane
│            (Hono · REST + WebSocket)                │
└──────┬───────────┬──────────────┬───────────────────┘
       │           │              │
  ┌────▼───┐  ┌────▼────┐  ┌─────▼──────┐
  │ Brain  │  │  Skills │  │  Workflows │
  │ Store  │  │Registry │  │  Runtime   │
  └────┬───┘  └─────────┘  └────────────┘
       │
  ┌────▼──────────────┐
  │   Model Router    │
  │  OpenRouter │     │
  │  Ollama     │     │
  └─────────────┘     │
```

### Packages

| Package | Description |
|---|---|
| `@devos/core` | Shared TypeScript types and interfaces — no implementations |
| `@devos/brain` | Repository indexer, context chunker, session context loader |
| `@devos/router` | Multi-provider model router with complexity-based routing |
| `@devos/skills` | Built-in skill registry and keyword-based recommender |
| `@devos/gateway` | Hono control plane — REST API, session management, routing |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- An [OpenRouter](https://openrouter.ai) API key (for cloud models)
- [Ollama](https://ollama.ai) running locally (optional, for on-prem models)

### Install

```bash
git clone https://github.com/your-org/devos
cd devos
pnpm install
```

### Configure

```bash
cp .env.example .env
# Add your OPENROUTER_API_KEY to .env
```

### Run

```bash
pnpm build
pnpm --filter @devos/gateway start
# Gateway running at http://localhost:18790
```

### Connect a project

```bash
# Connect your repo
curl -X POST http://localhost:18790/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "my-app", "repoPath": "/path/to/your/repo"}'

# Start a session (context loads automatically)
curl -X POST http://localhost:18790/sessions \
  -H "Content-Type: application/json" \
  -d '{"projectId": "<id from above>", "firstMessage": "where should I start?"}'
```

---

## Features

### Project Brain
Connect a repository and DevOS indexes it: stack detection, convention extraction, TODO surfacing. Every session starts fully loaded — no re-explaining your codebase.

### Skill Discovery
8 built-in skills (debug, security-audit, code-review, test-generation, ui-fix, plan-feature, explain, changelog) with keyword-based recommendation. Skills surface automatically based on what you're working on.

### Model Router
Routes tasks to the right model based on complexity:
- Simple tasks (rename, format, classify) → small model (Qwen 7B)
- Code generation, explanation → medium model
- Debugging, architecture, reasoning → frontier model

Confidential/restricted projects are automatically routed to on-prem Ollama — data never leaves your network.

### Multi-Agent Workflows *(coming soon)*
Visual workflow builder. Define agent graphs with parallel fan-out, conditional branching, human-in-the-loop checkpoints. Built-in workflows: PR review, bug investigation, release prep, nightly security scan.

### AI-Maintained Backlog *(coming soon)*
Stakeholder feedback ingested from GitHub Issues, Slack, email. Tickets created, prioritized, and updated automatically as code is committed and PRs merge.

---

## Roadmap

- [x] Project brain (repo indexing + context loading)
- [x] Skill registry and recommender
- [x] Multi-provider model routing (OpenRouter + Ollama)
- [x] Gateway control plane (Hono)
- [ ] Next.js developer UI
- [ ] Multi-agent workflow engine + visual builder
- [ ] Supabase persistence + pgvector semantic search
- [ ] GitHub Issues backlog integration
- [ ] PR review workflow (security + code review)
- [ ] Release pipeline (readiness scoring + staged rollout)
- [ ] Slack / email feedback ingestion
- [ ] Workflow marketplace

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

Found a bug? [Open an issue](../../issues/new?template=bug_report.md).  
Have a feature idea? [Start a discussion](../../discussions).

---

## Self-hosting

DevOS is designed to run on your own infrastructure. No data leaves your network unless you explicitly configure a cloud model provider.

For on-prem deployments with confidential or restricted data classification, all requests are automatically routed to your local Ollama instance.

Docker support coming in v0.2.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

Built by the DevOS contributors. Inspired by [OpenClaw](https://github.com/openclaw/openclaw).
