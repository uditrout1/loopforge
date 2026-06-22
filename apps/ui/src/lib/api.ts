const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:18790";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
  };
}

export interface Project {
  id: string;
  name: string;
  repoPath: string;
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
