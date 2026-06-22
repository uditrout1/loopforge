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

export interface TextPart {
  type: "text"
  text: string
}

export interface ImagePart {
  type: "image"
  source:
    | { type: "base64"; mediaType: string; data: string }
    | { type: "url"; url: string }
}

export type MessageContent = string | Array<TextPart | ImagePart>

export interface Message {
  role: "user" | "assistant" | "system"
  content: MessageContent
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

// ─── Context Packs ───────────────────────────────────────────────────────────

export interface ContextPack {
  id: string
  projectId: string
  name: string
  description: string
  filePatterns: string[]         // glob patterns — e.g. ["**/auth/**", "**/middleware/**"]
  ticketLabels: string[]         // ticket types to pull in — e.g. ["security", "bug"]
  workflowIds: string[]          // related workflow ids to include
  isBuiltIn: boolean
  createdAt: Date
}

// ─── Specs (PRD / Architecture / Technical) ──────────────────────────────────

export type SpecType = "prd" | "architecture" | "technical_spec"
export type SpecStatus = "draft" | "in_review" | "approved" | "rejected"

export interface Spec {
  id: string
  projectId: string
  type: SpecType
  title: string
  content: string                // Markdown body
  status: SpecStatus
  version: number
  linkedTicketIds: string[]
  linkedAdrIds: string[]
  approvedBy?: string
  approvedAt?: Date
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// ─── ADRs ────────────────────────────────────────────────────────────────────

export type ADRStatus = "proposed" | "accepted" | "deprecated" | "superseded"

export interface ADR {
  id: string
  projectId: string
  number: number                 // sequential per project
  title: string
  context: string                // Why was this decision needed?
  decision: string               // What was decided?
  consequences: string           // What are the trade-offs?
  status: ADRStatus
  linkedTicketIds: string[]
  linkedSpecIds: string[]
  supersededBy?: string          // ADR id that supersedes this one
  createdAt: Date
  updatedAt: Date
}

// ─── Capability Gaps ─────────────────────────────────────────────────────────

export type GapSeverity = "low" | "medium" | "high" | "critical"

export interface CapabilityGap {
  id: string
  projectId: string
  sessionId?: string
  domain: string                 // e.g. "accessibility", "security", "performance"
  severity: GapSeverity
  description: string
  suggestedSkillId?: string
  exampleRisk: string
  dismissed: boolean
  detectedAt: Date
}

// ─── Visual Context ───────────────────────────────────────────────────────────

export type VisualAssetType = "screenshot" | "figma_component" | "wireframe" | "design_system"

export interface VisualAsset {
  id: string
  projectId: string
  type: VisualAssetType
  name: string
  url?: string                   // Figma link or external URL
  storagePath?: string           // local/cloud storage path for uploads
  figmaNodeId?: string           // Figma node reference
  linkedFilePaths: string[]      // codebase files that implement this visual
  linkedTicketIds: string[]
  aiDescription?: string         // AI-generated description of what the visual contains
  analysisCache?: string         // cached analysis output
  createdAt: Date
  updatedAt: Date
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export type GraphEntityType =
  | "prd" | "requirement" | "acceptance_criteria" | "user_story"
  | "architecture_doc" | "adr" | "technical_decision"
  | "visual_asset" | "design_component" | "wireframe"
  | "repository" | "module" | "file" | "api_endpoint" | "database_table"
  | "epic" | "ticket" | "pull_request" | "release"
  | "spec" | "evaluation" | "eval_run" | "test_suite" | "compliance_check"

export type GraphRelationship =
  | "REQUIRES" | "DEFINES" | "GENERATES" | "IMPLEMENTS" | "REFERENCES"
  | "VALIDATES" | "APPROVES" | "SUPERSEDES" | "DEPENDS_ON" | "IMPACTS"
  | "CONTAINS" | "INCLUDED_IN" | "LINKED_TO" | "VALIDATED_BY" | "SCORES"
  | "TAGGED_IN"

export interface GraphNode {
  id: string                          // "{entityType}:{sourceId}"
  projectId: string
  entityType: GraphEntityType
  title: string
  metadata: Record<string, unknown>
  sourceSystem: string
  sourceId: string
  createdAt: Date
  updatedAt: Date
}

export interface GraphEdge {
  id: string                          // "{relationship}:{sourceNodeId}:{targetNodeId}"
  projectId: string
  sourceNodeId: string
  targetNodeId: string
  relationship: GraphRelationship
  confidence: number                  // 0–1
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface GraphSubgraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface TraceResult {
  path: GraphNode[]
  edges: GraphEdge[]
  found: boolean
}

export interface ImpactResult {
  origin: GraphNode
  downstream: GraphSubgraph
  affectedTypes: Partial<Record<GraphEntityType, number>>
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

// ─── Eval Engine ─────────────────────────────────────────────────────────────

export type EvalType =
  | "engineering_standard"
  | "product_criteria"
  | "design_standard"
  | "architecture_compliance"

export type EvalStatus = "pending" | "running" | "passed" | "failed" | "error"

export type FeedbackVerdict = "approved" | "rejected" | "partial"

export interface EvalCriteria {
  id: string
  projectId: string
  name: string
  description: string
  type: EvalType
  prompt: string
  threshold: number
  sourceSpecId: string | undefined
  sourceAdrId: string | undefined
  createdAt: Date
  updatedAt: Date
}

export interface EvalRun {
  id: string
  projectId: string
  criteriaId: string
  targetType: string
  targetId: string
  score: number
  status: EvalStatus
  reasoning: string
  passed: boolean
  regressionDetected: boolean
  previousScore: number | undefined
  createdAt: Date
  completedAt: Date | undefined
}

export interface EvalFeedback {
  id: string
  runId: string
  projectId: string
  verdict: FeedbackVerdict
  rationale: string
  submittedBy: string
  createdAt: Date
}

// ─── Engineering Goals ────────────────────────────────────────────────────────

export type GoalStatus = "active" | "completed" | "cancelled" | "paused"

export interface GoalTicketRef {
  ticketId: string
  title: string
  status: "open" | "in_progress" | "resolved" | "closed"
  isBlocker: boolean
}

export interface Goal {
  id: string
  projectId: string
  title: string
  description: string
  status: GoalStatus
  targetDate: Date | undefined
  tickets: GoalTicketRef[]
  progressPercent: number
  blockers: string[]
  decomposedAt: Date | undefined
  decomposedBy: "claude" | "manual"
  createdAt: Date
  updatedAt: Date
}

export interface GoalDecomposition {
  tickets: Array<{
    title: string
    description: string
    type: "feature" | "bug" | "chore" | "spike"
  }>
  reasoning: string
}

// ─── Doc Scanner ─────────────────────────────────────────────────────────────

export type ScannedDocType = "prd" | "brd" | "frd" | "adr" | "spec" | "readme" | "claude_md" | "unknown_doc"

export interface ScannedDoc {
  relPath: string
  absPath: string
  type: ScannedDocType
  content: string
  title: string
}
