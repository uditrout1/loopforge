# Product Requirements Document
## LoopForge — Product Engineering Intelligence
**Version:** 0.2
**Date:** 2026-06-22
**Status:** Living Document

---

## 1. Product Vision

> LoopForge is the brain for your project — a Product Engineering Intelligence platform that connects business intent, architecture decisions, implementation, and quality outcomes into a single, traversable knowledge graph.

Developers should never explain their project twice. Teams should never lose track of why a decision was made. Every requirement should be traceable from the PRD that created it to the release that fulfilled it.

---

## 2. Design Principles

1. **Context is permanent.** The system knows your project. You don't re-explain it.
2. **Relationships over files.** Intelligence comes from connecting entities — not just indexing them. A file without lineage is trivia; a requirement connected to its ADR, code, and evaluation is knowledge.
3. **Surface before asking.** Relevant capabilities, tickets, risks, and gaps appear before the developer looks for them.
4. **Automate the forgettable.** Security audits, backlog updates, changelog generation, ADR capture — things developers defer — happen automatically.
5. **Humans decide; agents execute.** The system handles execution. Humans are called in when a decision genuinely requires judgment.
6. **Quality is defined, not assumed.** Evaluation criteria are derived from requirements and standards, not invented at review time.
7. **Open where it helps, closed where it protects.** Workflows and skills are shareable; customer data is not.

---

## 3. User Personas

### Persona 1: The Solo Builder
**Name:** Udit
**Role:** Indie developer / founder building a consumer app
**Stack:** React, SwiftUI, Supabase, multiple AI APIs
**Pain:** Every AI session restarts with no memory of the project. Has to re-explain stack, conventions, open issues. Spends 20% of session time on context restoration. Security reviews happen ad-hoc. No way to trace which requirement led to which code.
**Goal:** Ship faster. Never re-explain the project. Know exactly what to work on next and why.

### Persona 2: The Team Lead
**Name:** Priya
**Role:** Engineering lead, 12-person team, B2B SaaS startup
**Stack:** Node.js, React, PostgreSQL, AWS
**Pain:** Backlog drifts. ADRs are forgotten. PR reviews are inconsistent. AI costs are invisible. No audit trail connecting business requirements to shipped code.
**Goal:** Team operates autonomously. Stakeholders have visibility. Architecture decisions are preserved and enforced. AI costs are tracked.

### Persona 3: The Enterprise Architect
**Name:** Ramesh
**Role:** VP Engineering, 300-person engineering org, financial services
**Stack:** Java microservices, React, Oracle, on-prem Kubernetes
**Pain:** Cannot send code to OpenAI due to data residency requirements. No governance over AI usage. No compliance trail. Cannot answer "which requirement led to this service?"
**Goal:** Governed AI development at scale. Full audit trail. On-prem deployment. Traceability from business requirement to production code.

### Persona 4: The Stakeholder
**Name:** Ananya
**Role:** Product Manager
**Pain:** Files feature requests in Slack and doesn't know if they were seen. Can't trace her requirements through to implementation. Doesn't understand GitHub; can't read Jira.
**Goal:** Know where her requirements went. Know what's shipping. See which of her requirements are validated and which are still open.

---

## 4. Core Capabilities

### Capability 1: Project Brain
Persistent, structured knowledge about a project that loads automatically at session start and updates incrementally.

**Contents:** tech stack, architecture, coding conventions, open tickets, recent decisions, design constraints, known issues, visual assets, architecture decisions.

**How it stays current:** initial repo scan → incremental file watching → session-end summary append → ADR extraction from decisions made in session.

---

### Capability 2: Product Engineering Knowledge Graph
A traversable graph connecting every entity in the product engineering lifecycle — from PRD to release — preserving relationships, not just data.

**Entity types:** PRD, Requirement, AcceptanceCriteria, Spec, ADR, Architecture, File, Module, API, Ticket, PullRequest, Release, Evaluation, EvalRun, VisualAsset.

**Relationship types:** REQUIRES, DEFINES, GENERATES, IMPLEMENTS, REFERENCES, VALIDATES, APPROVES, SUPERSEDES, DEPENDS_ON, IMPACTS, CONTAINS, INCLUDED_IN, VALIDATED_BY, SCORES.

**Queries it enables:**
- "Why does this service exist?" → lineage to PRD
- "Which requirement led to this code?" → upstream trace
- "What breaks if Requirement 42 changes?" → downstream impact analysis
- "Which ADR approved this architecture?" → APPROVES edge traversal
- "Show all requirements validated by this release" → VALIDATED_BY + TAGGED_IN traversal

**Ingestion:** automatic, non-blocking side effects from spec, ADR, backlog, vision, and brain writes. Manual edges via API.

---

### Capability 3: Spec-Driven Development
A structured process where PRDs, architecture documents, and technical specs are generated, reviewed, and approved before downstream work begins.

**Flow:** PRD generation → architecture doc → technical spec → approval → ADR extraction → eval generation → epic decomposition → tickets with file links.

**Approval gates:** specs must be approved before the epic decomposer creates tickets. Approved specs generate evaluation criteria automatically.

---

### Capability 4: Eval Engine
A mechanism for converting organizational knowledge — requirements, standards, and human feedback — into machine-executable evaluation criteria.

**The shift:** Spec → Eval → Implementation → Validation → Approval, not Spec → Implementation → Hope.

**Eval types:** engineering standards (coding conventions, security requirements, performance thresholds), product criteria (acceptance criteria, business rules), design standards (accessibility, UX consistency, design system compliance), architecture compliance (ADR adherence, approved patterns).

**Human feedback loop:** engineers mark outputs as approved / rejected / partially approved with rationale. LoopForge stores this rationale as organizational judgment, available to future evaluations. No model training — structured storage only.

**Regression detection:** if the score for an evaluation drops vs. the previous run on the same target, a regression is flagged.

---

### Capability 5: Visual Context Engine
Extends the project brain from code intelligence into visual intelligence. Developers upload screenshots or paste Figma URLs; LoopForge analyzes designs with a multimodal frontier model and links findings to code.

**Analysis output:** UX issues, accessibility gaps, copy problems, suggested improvements, component names detected, required code changes.

**Design-to-code linking:** detected component names are matched against indexed code chunks, surfacing exactly which files to change.

**Multimodal sessions:** images can be attached directly to session messages.

---

### Capability 6: Skill Discovery
A searchable registry of AI capabilities that surfaces automatically based on what the developer is doing.

**Built-in skills:** debug, security-audit, code-review, test-generation, ui-fix, plan-feature, explain, changelog.

**Capability Gap Advisor:** proactively surfaces expertise gaps (security, accessibility, performance, testing, architecture, documentation) based on session content.

---

### Capability 7: Multi-Provider Model Router
Intelligent routing based on complexity, data classification, and cost.

**Tiers:** small (Qwen 7B — simple extraction), medium (code generation), frontier (reasoning, vision, architecture).

**Data classification enforcement:** confidential and restricted data never leaves the network — automatically routed to on-prem Ollama.

---

### Capability 8: Multi-Agent Workflow Engine
A runtime for composing, executing, and monitoring multi-agent workflows with human-in-the-loop checkpoints.

**Built-in workflows:** PR review, bug investigation, release preparation, nightly security scan.

**Eval integration:** workflow nodes can define evaluation suites; progression is blocked if the composite score falls below the configured threshold.

---

### Capability 9: AI-Maintained Backlog
A project backlog that stays current automatically — linked to code activity, connected to requirements in the graph, and prioritized by AI.

**Ticket lifecycle:** capture → classify → deduplicate → link to files → prioritize → update on PR activity → close on resolution.

**Graph integration:** tickets ingest into the knowledge graph as nodes with IMPLEMENTS edges to code files.

---

## 5. User Journeys

### Journey 1: Requirement to Release — Full Trace
1. PM creates a requirement: "Settlement processing under 2 seconds"
2. Spec-driven flow generates a PRD → architecture doc → technical spec
3. Spec approval triggers eval generation: `{ type: "performance", expected: "<2s" }`
4. Epic decomposer creates tickets linked to relevant files in the brain
5. Developer implements; PR merged
6. Eval Engine runs the performance evaluation against the implementation
7. EvalRun scores 0.92 — passes
8. Knowledge graph now shows: Requirement → Spec → ADR → Code → PR → Release, with Requirement VALIDATED_BY Evaluation SCORES EvalRun

**Query:** "Show all requirements validated by the Q3 release" → answered from the graph in one traversal.

---

### Journey 2: Impact Analysis Before Refactor
1. Engineer asks: "What breaks if we change the auth middleware?"
2. LoopForge queries `/graph/:projectId/nodes/file:src/middleware/auth.ts/downstream`
3. Graph returns: 4 specs reference it, 2 ADRs approve its current pattern, 12 tickets implement against it, 3 evaluation criteria validate it
4. Engineer sees the full blast radius before writing a line of code

---

### Journey 3: Design Review with Visual Context
1. Designer uploads a screenshot of the checkout flow
2. LoopForge analyzes: 3 accessibility issues, 2 UX problems, 1 copy issue
3. Findings linked to `src/components/Checkout.tsx` and `src/components/PaymentForm.tsx`
4. Visual asset ingested into knowledge graph: VisualAsset REFERENCES File
5. If an eval suite exists for UX compliance, an EvalRun is created with the accessibility score

---

### Journey 4: First Session on a New Project
1. Developer connects repo
2. LoopForge scans: stack, conventions, entry points, file index
3. File index ingested into knowledge graph: Repository CONTAINS File (for every indexed file)
4. Developer opens a session — context pre-loaded, capability gaps surfaced, relevant skills recommended
5. Developer starts working without explaining anything

---

## 6. Release Scope

| Feature | Shipped | In Progress | Planned |
|---|---|---|---|
| Project brain (repo scan + context loading) | ✓ | | |
| Context packs | ✓ | | |
| Skill discovery + capability gap advisor | ✓ | | |
| Multi-provider model routing | ✓ | | |
| Multi-agent workflow engine | ✓ | | |
| GitHub Issues backlog integration | ✓ | | |
| ADR extraction and storage | ✓ | | |
| Spec-driven development + approval | ✓ | | |
| Supabase persistence + pgvector | ✓ | | |
| Next.js developer UI | ✓ | | |
| Visual Context Engine | ✓ | | |
| Product Engineering Knowledge Graph | | ✓ | |
| Eval Engine | | ✓ | |
| Workflow marketplace | | | ✓ |
| Slack / email backlog ingestion | | | ✓ |
| PR review workflow with security scoring | | | ✓ |
| Workflow visual builder | | | ✓ |
| MCP server mode | | | ✓ |
| Figma API integration | | | ✓ |
| Enterprise SSO | | | ✓ |
| IDE extensions | | | ✓ |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Session context load < 10 seconds. Graph traversal (depth 15) < 500ms for in-memory store. |
| **Reliability** | Workflow execution survives server restart, resumes from last completed node. Graph ingestion failures are non-blocking — source-of-truth writes succeed regardless. |
| **Security** | API keys never exposed to client. All AI calls logged with identity, model, cost, timestamp. Data classification enforced at the router — confidential/restricted never reaches cloud providers. |
| **Scalability** | Context store scales to 1M+ chunks per org. Knowledge graph scales to 100K+ nodes per project via PostgreSQL. Supabase recursive CTEs handle traversal at production scale. |
| **Privacy** | Customer code and prompts never used for model training. On-prem deployment available with zero external data egress. Eval feedback (organizational judgment) stored on-premise and never shared. |
| **Compliance** | Audit log retention minimum 90 days. Eval feedback is append-only (immutable organizational record). SOC2 Type II target: 24 months. |
| **Availability** | 99.9% uptime SLA for cloud tier. On-prem SLA managed by customer. |
| **Interoperability** | OpenAI-compatible API surface. GitHub and GitLab webhook compatibility. Standard webhook support for SDLC triggers. |

---

## 8. Open Questions

1. **Pricing model:** Per-seat vs. usage-based vs. hybrid. Knowledge Graph and Evals are enterprise differentiators — likely gated on enterprise tier.
2. **Graph database migration path:** When does the PostgreSQL adjacency-list store need to migrate to a native graph DB? Likely when a single project exceeds 500K nodes or traversal latency exceeds 1s.
3. **Eval feedback UX:** How do engineers submit feedback efficiently in the flow of a PR review — inline comments that map to eval findings?
4. **First integration priority beyond GitHub:** Slack (stakeholder feedback), Linear (backlog sync), or Jira (enterprise backlog)?
5. **On-prem packaging:** Docker Compose (simple, current) vs. Helm chart (enterprise-grade). Both eventually — which first?
6. **Open-source strategy:** Knowledge Graph and Eval Engine are strong candidates for open-sourcing. Router and Brain are the revenue moat.
