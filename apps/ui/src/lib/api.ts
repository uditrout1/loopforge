const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18790";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  infrastructure: string[];
}

export interface ProjectKnowledge {
  summary: string;
  conventions: Record<string, string>;
  entryPoints: string[];
  openTodos: string[];
  recentDecisions: string[];
  designConstraints: string[];
}

export interface Project {
  id: string;
  name: string;
  repoPath?: string;
  stack?: TechStack;
  knowledge?: ProjectKnowledge;
  indexedAt?: string;
  createdAt?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  triggerKeywords: string[];
  promptTemplate: string;
  requiredModelCapability: "small" | "medium" | "frontier";
}

export interface ContextLoaded {
  project: string;
  stack?: unknown;
  openTickets?: number;
  relevantChunks?: number;
  lastSessionSummary?: boolean;
}

export interface SessionStartResponse {
  sessionId: string;
  contextLoaded: ContextLoaded;
  recommendedSkills: Skill[];
}

export interface CapabilityGap {
  id: string;
  domain: string;
  severity: string;
  description: string;
  suggestedSkillId?: string;
  exampleRisk: string;
  dismissed: boolean;
}

export interface MessageResponse {
  content: string;
  model: string;
  provider: string;
  costUsd: number;
  routingDecision: string;
  recommendedSkills: Skill[];
  capabilityGaps: CapabilityGap[];
  sessionTotalCostUsd: number;
}

export interface SessionState {
  id: string;
  projectId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  totalCostUsd: number;
}

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${GATEWAY_URL}/projects`, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.statusText}`);
  return res.json() as Promise<Project[]>;
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${GATEWAY_URL}/projects/${id}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to fetch project: ${res.statusText}`);
  return res.json() as Promise<Project>;
}

export async function reindexProject(id: string): Promise<void> {
  await fetch(`${GATEWAY_URL}/projects/${id}/reindex`, {
    method: "POST",
    headers: headers(),
  });
}

export async function createProject(
  name: string,
  repoPath: string
): Promise<Project> {
  const res = await fetch(`${GATEWAY_URL}/projects`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, repoPath }),
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.statusText}`);
  return res.json() as Promise<Project>;
}

export interface ContextPack {
  id: string;
  name: string;
  description: string;
  filePatterns: string[];
  isBuiltIn: boolean;
}

export async function getPacks(projectId: string): Promise<ContextPack[]> {
  const res = await fetch(`${GATEWAY_URL}/projects/${projectId}/packs`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to fetch packs: ${res.statusText}`);
  return res.json() as Promise<ContextPack[]>;
}

export async function startSession(
  projectId: string,
  firstMessage?: string,
  packId?: string
): Promise<SessionStartResponse> {
  const res = await fetch(`${GATEWAY_URL}/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      projectId,
      ...(firstMessage !== undefined ? { firstMessage } : {}),
      ...(packId !== undefined ? { packId } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Failed to start session: ${res.statusText}`);
  return res.json() as Promise<SessionStartResponse>;
}

export async function sendMessage(
  sessionId: string,
  content: string
): Promise<MessageResponse> {
  const res = await fetch(`${GATEWAY_URL}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
  return res.json() as Promise<MessageResponse>;
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const res = await fetch(`${GATEWAY_URL}/sessions/${sessionId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
  return res.json() as Promise<SessionState>;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.statusText}`);
}

export interface VisualAnalysis {
  asset: {
    id: string;
    name: string;
    linkedFilePaths: string[];
    aiDescription?: string;
  };
  analysis: {
    description: string;
    uxIssues: string[];
    accessibilityIssues: string[];
    copyIssues: string[];
    suggestedImprovements: string[];
    componentNames: string[];
    requiredCodeChanges: string[];
  };
}

export async function analyzeScreenshot(
  projectId: string,
  name: string,
  base64: string,
  mediaType: string,
  question: string
): Promise<VisualAnalysis> {
  const res = await fetch(`${GATEWAY_URL}/vision/${projectId}/screenshot`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, base64, mediaType, question }),
  });
  if (!res.ok) throw new Error(`Failed to analyze screenshot: ${res.statusText}`);
  return res.json() as Promise<VisualAnalysis>;
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export interface GraphSummary {
  nodeCount: number;
  edgeCount: number;
  byType: Record<string, number>;
}

export interface GraphNodeData {
  id: string;
  projectId: string;
  entityType: string;
  title: string;
  metadata: Record<string, unknown>;
  sourceSystem: string;
  sourceId: string;
}

export interface GraphEdgeData {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: string;
  confidence: number;
}

export interface GraphSubgraphData {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
}

export async function getGraphSummary(projectId: string): Promise<GraphSummary> {
  const res = await fetch(`${GATEWAY_URL}/graph/${projectId}/summary`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to fetch graph summary: ${res.statusText}`);
  return res.json() as Promise<GraphSummary>;
}

export async function getGraphNodes(
  projectId: string,
  entityType?: string
): Promise<GraphNodeData[]> {
  const url = new URL(`${GATEWAY_URL}/graph/${projectId}/nodes`);
  if (entityType !== undefined) url.searchParams.set("type", entityType);
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch graph nodes: ${res.statusText}`);
  const data = await res.json() as { nodes: GraphNodeData[] };
  return data.nodes;
}

export async function getGraphNode(
  projectId: string,
  nodeId: string
): Promise<{ node: GraphNodeData; edgesOut: GraphEdgeData[]; edgesIn: GraphEdgeData[] }> {
  const res = await fetch(
    `${GATEWAY_URL}/graph/${projectId}/nodes/${encodeURIComponent(nodeId)}`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Failed to fetch graph node: ${res.statusText}`);
  return res.json() as Promise<{ node: GraphNodeData; edgesOut: GraphEdgeData[]; edgesIn: GraphEdgeData[] }>;
}

export async function getGraphUpstream(
  projectId: string,
  nodeId: string
): Promise<GraphSubgraphData> {
  const res = await fetch(
    `${GATEWAY_URL}/graph/${projectId}/nodes/${encodeURIComponent(nodeId)}/upstream`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Failed to fetch upstream: ${res.statusText}`);
  return res.json() as Promise<GraphSubgraphData>;
}

export async function getGraphDownstream(
  projectId: string,
  nodeId: string
): Promise<GraphSubgraphData> {
  const res = await fetch(
    `${GATEWAY_URL}/graph/${projectId}/nodes/${encodeURIComponent(nodeId)}/downstream`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Failed to fetch downstream: ${res.statusText}`);
  return res.json() as Promise<GraphSubgraphData>;
}

export async function searchGraph(
  projectId: string,
  query: string,
  entityType?: string
): Promise<GraphNodeData[]> {
  const url = new URL(`${GATEWAY_URL}/graph/${projectId}/search`);
  url.searchParams.set("q", query);
  if (entityType !== undefined) url.searchParams.set("type", entityType);
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) throw new Error(`Failed to search graph: ${res.statusText}`);
  const data = await res.json() as { nodes: GraphNodeData[] };
  return data.nodes;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface GoalTicketRef {
  ticketId: string;
  title: string;
  status: string;
  isBlocker: boolean;
}

export interface GoalData {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  targetDate?: string;
  tickets: GoalTicketRef[];
  progressPercent: number;
  blockers: string[];
  decomposedAt?: string;
  decomposedBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function getGoals(projectId: string): Promise<GoalData[]> {
  const r = await fetch(`${GATEWAY_URL}/goals/${projectId}`, { headers: headers() });
  if (!r.ok) return [];
  return r.json() as Promise<GoalData[]>;
}

export async function createGoal(
  projectId: string,
  body: { title: string; description: string; targetDate?: string; autoDecompose?: boolean }
): Promise<GoalData> {
  const r = await fetch(`${GATEWAY_URL}/goals/${projectId}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return r.json() as Promise<GoalData>;
}

export async function updateGoalTicket(
  projectId: string,
  goalId: string,
  ticketId: string,
  body: { status: string; isBlocker?: boolean }
): Promise<GoalData> {
  const r = await fetch(`${GATEWAY_URL}/goals/${projectId}/${goalId}/tickets/${ticketId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return r.json() as Promise<GoalData>;
}

export async function redecomposeGoal(projectId: string, goalId: string): Promise<GoalData> {
  const r = await fetch(`${GATEWAY_URL}/goals/${projectId}/${goalId}/decompose`, {
    method: "POST",
    headers: headers(),
  });
  return r.json() as Promise<GoalData>;
}

export async function analyzeFigmaUrl(
  projectId: string,
  url: string,
  question: string
): Promise<VisualAnalysis> {
  const res = await fetch(`${GATEWAY_URL}/vision/${projectId}/figma`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ url, question }),
  });
  if (!res.ok) throw new Error(`Failed to analyze Figma URL: ${res.statusText}`);
  return res.json() as Promise<VisualAnalysis>;
}

// ─── Evals ───────────────────────────────────────────────────────────────────

export interface EvalCriteriaData {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: string;
  prompt: string;
  threshold: number;
  sourceSpecId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvalRunData {
  id: string;
  projectId: string;
  criteriaId: string;
  targetType: string;
  targetId: string;
  score: number;
  status: string;
  reasoning: string;
  passed: boolean;
  regressionDetected: boolean;
  previousScore?: number;
  createdAt: string;
  completedAt?: string;
}

export interface EvalFeedbackData {
  id: string;
  runId: string;
  verdict: string;
  rationale: string;
  submittedBy: string;
  createdAt: string;
}

export interface EvalsSummary {
  totalCriteria: number;
  totalRuns: number;
  passRate: number | null;
  regressions: number;
}

export async function getEvalCriteria(projectId: string): Promise<EvalCriteriaData[]> {
  const r = await fetch(`${GATEWAY_URL}/evals/${projectId}/criteria`, { headers: headers() });
  if (!r.ok) return [];
  const data = await r.json() as { criteria: EvalCriteriaData[] };
  return data.criteria;
}

export async function createEvalCriteria(
  projectId: string,
  body: { name: string; description: string; type: string; prompt: string; threshold: number }
): Promise<EvalCriteriaData> {
  const r = await fetch(`${GATEWAY_URL}/evals/${projectId}/criteria`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json() as { criteria: EvalCriteriaData };
  return data.criteria;
}

export async function runEval(
  projectId: string,
  body: { criteriaId: string; targetType: string; targetId: string; content: string }
): Promise<EvalRunData> {
  const r = await fetch(`${GATEWAY_URL}/evals/${projectId}/run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json() as { run: EvalRunData };
  return data.run;
}

export async function getEvalRuns(projectId: string, criteriaId?: string): Promise<EvalRunData[]> {
  const url = criteriaId
    ? `${GATEWAY_URL}/evals/${projectId}/runs?criteriaId=${criteriaId}`
    : `${GATEWAY_URL}/evals/${projectId}/runs`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) return [];
  const data = await r.json() as { runs: EvalRunData[] };
  return data.runs;
}

export async function submitEvalFeedback(
  projectId: string,
  runId: string,
  body: { verdict: string; rationale: string; submittedBy: string }
): Promise<EvalFeedbackData> {
  const r = await fetch(`${GATEWAY_URL}/evals/${projectId}/runs/${runId}/feedback`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json() as { feedback: EvalFeedbackData };
  return data.feedback;
}

export async function getEvalsSummary(projectId: string): Promise<EvalsSummary | null> {
  const r = await fetch(`${GATEWAY_URL}/evals/${projectId}/summary`, { headers: headers() });
  if (!r.ok) return null;
  return r.json() as Promise<EvalsSummary>;
}

export type ScanType = "db_long_queries" | "n_plus_one" | "missing_indexes" | "unhandled_errors" | "custom";

export interface ScanFinding {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  snippet: string;
  issue: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
  score: number;
}

export interface ScanResult {
  scanId: string;
  scanType: ScanType;
  projectId: string;
  findings: ScanFinding[];
  filesScanned: number;
  createdAt: string;
}

export async function runRepoScan(
  projectId: string,
  scanType: ScanType,
  customDescription?: string,
): Promise<ScanResult> {
  const r = await fetch(`${GATEWAY_URL}/evals/${projectId}/scan`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ scanType, customDescription }),
  });
  if (!r.ok) throw new Error(`Scan failed: ${r.statusText}`);
  const data = await r.json() as { result: ScanResult };
  return data.result;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface LoopForgeSettings {
  models: { small: string; medium: string; frontier: string; ollamaModel: string };
  routing: { preferOnPrem: boolean; confidentialOnPremOnly: boolean; costLimitPerSessionUsd: number | null };
  workflows: Record<string, { enabled: boolean; trigger: string }>;
  ui: { showCostPerMessage: boolean; showModelPerMessage: boolean };
}

export interface AvailableModel {
  id: string;
  name: string;
  tier: string;
  provider: string;
}

export async function getSettings(): Promise<LoopForgeSettings> {
  const r = await fetch(`${GATEWAY_URL}/settings`);
  return r.json() as Promise<LoopForgeSettings>;
}

export async function updateSettings(body: Partial<LoopForgeSettings>): Promise<LoopForgeSettings> {
  const r = await fetch(`${GATEWAY_URL}/settings`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return r.json() as Promise<LoopForgeSettings>;
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  const r = await fetch(`${GATEWAY_URL}/settings/models/available`);
  if (!r.ok) return [];
  return r.json() as Promise<AvailableModel[]>;
}

// ─── Releases ─────────────────────────────────────────────────────────────────

export interface ReleaseData {
  id: string;
  projectId: string;
  version: string;
  name: string;
  status: "draft" | "published";
  changelog: string;
  mergedPrIds: string[];
  resolvedTicketIds: string[];
  generatedAt: string;
  publishedAt?: string;
  createdAt: string;
}

export async function getReleases(projectId: string): Promise<ReleaseData[]> {
  const r = await fetch(`${GATEWAY_URL}/releases/${projectId}`, { headers: headers() });
  if (!r.ok) return [];
  return r.json() as Promise<ReleaseData[]>;
}

export async function generateRelease(
  projectId: string,
  body: { version: string; name: string; prNumbers: string[]; ticketIds: string[]; context?: string }
): Promise<ReleaseData> {
  const r = await fetch(`${GATEWAY_URL}/releases/${projectId}/generate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return r.json() as Promise<ReleaseData>;
}

export async function publishRelease(projectId: string, releaseId: string): Promise<ReleaseData> {
  const r = await fetch(`${GATEWAY_URL}/releases/${projectId}/${releaseId}/publish`, {
    method: "POST",
    headers: headers(),
  });
  return r.json() as Promise<ReleaseData>;
}

export async function updateRelease(
  projectId: string,
  releaseId: string,
  body: { changelog?: string; name?: string }
): Promise<ReleaseData> {
  const r = await fetch(`${GATEWAY_URL}/releases/${projectId}/${releaseId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body),
  });
  return r.json() as Promise<ReleaseData>;
}
