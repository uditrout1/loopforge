// ─── Project ────────────────────────────────────────────────────────────────

export type DataClassification = "public" | "internal" | "confidential" | "restricted"

export interface Project {
  id: string
  orgId: string
  name: string
  repoUrl?: string
  repoProvider: "github" | "gitlab" | "local"
  stack: TechStack
  knowledge: ProjectKnowledge
  dataClassification: DataClassification
  indexedAt?: Date
  createdAt: Date
}

export interface TechStack {
  languages: string[]
  frameworks: string[]
  databases: string[]
  infrastructure: string[]
  packageManager?: string
}

export interface ProjectKnowledge {
  summary: string
  conventions: Record<string, string>
  entryPoints: string[]
  openTodos: string[]
  recentDecisions: string[]
  designConstraints: string[]
}

// ─── Context ─────────────────────────────────────────────────────────────────

export interface ContextChunk {
  id: string
  projectId: string
  filePath: string
  content: string
  embedding?: number[]
  chunkIndex: number
  tokenCount: number
  fileHash: string
  updatedAt: Date
}

export interface SessionContext {
  project: Project
  recentSummary?: string
  openTickets: Ticket[]
  relevantChunks: ContextChunk[]
  activeSkills: string[]
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export type ModelCapability = "small" | "medium" | "frontier"

export interface Skill {
  id: string
  name: string
  description: string
  embedding?: number[]
  triggerKeywords: string[]
  promptTemplate: string
  requiredTools: string[]
  requiredModelCapability: ModelCapability
  authorId?: string
  isPublic: boolean
  version: string
  createdAt: Date
}

export interface SkillActivation {
  skillId: string
  sessionId: string
  activatedAt: Date
  triggeredBy: "manual" | "recommendation"
}

// ─── Model Routing ───────────────────────────────────────────────────────────

export type ProviderType = "openrouter" | "ollama" | "direct"

export interface ModelProvider {
  type: ProviderType
  baseUrl: string
  apiKey?: string
  models: string[]
}

export interface RoutingDecision {
  model: string
  provider: ProviderType
  complexityScore: number
  reason: string
  estimatedCostUsd?: number
}

export interface ModelRequest {
  messages: Message[]
  projectId: string
  sessionId: string
  dataClassification: DataClassification
  preferredCapability?: ModelCapability
  maxCostUsd?: number
}

export interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

export interface ModelResponse {
  content: string
  model: string
  provider: ProviderType
  inputTokens: number
  outputTokens: number
  costUsd: number
  routingDecision: RoutingDecision
}

// ─── Backlog ─────────────────────────────────────────────────────────────────

export type TicketType = "feature" | "bug" | "debt" | "security"
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed"

export interface TicketSource {
  type: "github" | "slack" | "email" | "manual" | "ai"
  ref: string
  capturedAt: Date
}

export interface Ticket {
  id: string
  projectId: string
  externalId?: string
  externalUrl?: string
  title: string
  description?: string
  type: TicketType
  status: TicketStatus
  priorityScore: number
  priorityReason: string
  sources: TicketSource[]
  linkedFiles: string[]
  linkedPrs: string[]
  manualPriorityOverride: boolean
  createdBy: "stakeholder" | "ai" | "developer"
  createdAt: Date
  updatedAt: Date
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export type NodeType =
  | "agent"
  | "tool"
  | "condition"
  | "merge"
  | "human_checkpoint"
  | "trigger"

export interface WorkflowNode {
  id: string
  type: NodeType
  label: string
  model?: string
  contextSlice: string[]
  tools: string[]
  systemPrompt?: string
  retryStrategy: RetryStrategy
  timeoutMs: number
  outputSchema?: Record<string, unknown>
}

export interface RetryStrategy {
  maxAttempts: number
  backoffMs: number
  fallbackModel?: string
}

export interface WorkflowEdge {
  from: string
  to: string | string[]
  condition?: string
}

export type WorkflowTrigger =
  | { type: "event"; event: "pr_opened" | "pr_merged" | "issue_created" | "push" }
  | { type: "scheduled"; cron: string }
  | { type: "manual" }
  | { type: "webhook"; path: string }

export interface Workflow {
  id: string
  orgId?: string
  projectId?: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  triggers: WorkflowTrigger[]
  isBuiltIn: boolean
  isPublic: boolean
  version: string
  authorId?: string
  createdAt: Date
}

export type WorkflowRunStatus =
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export interface WorkflowRun {
  id: string
  workflowId: string
  projectId: string
  triggeredBy: string
  triggerPayload: Record<string, unknown>
  status: WorkflowRunStatus
  currentNodeId?: string
  sharedState: Record<string, unknown>
  completedNodes: Record<string, NodeResult>
  humanCheckpoints: HumanCheckpoint[]
  totalCostUsd: number
  startedAt: Date
  completedAt?: Date
}

export interface NodeResult {
  output: unknown
  durationMs: number
  model?: string
  costUsd?: number
  attempts: number
}

export interface HumanCheckpoint {
  nodeId: string
  prompt: string
  options: string[]
  requestedAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  decision?: string
  input?: string
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  userId: string
  projectId: string
  sessionId?: string
  workflowRunId?: string
  model: string
  provider: ProviderType
  inputTokens: number
  outputTokens: number
  costUsd: number
  piiScrubbed: boolean
  timestamp: Date
}
