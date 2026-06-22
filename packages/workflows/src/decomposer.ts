import { randomUUID } from "node:crypto"
import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"
import type { Ticket, TicketType } from "@loopforge/core"

export interface DecompositionInput {
  projectId: string
  epicTitle: string
  epicDescription: string
  stackDescription: string        // e.g. "TypeScript, Next.js, Supabase, Hono"
  existingFiles: string[]         // file paths from codebase index (pass top 100)
  openTicketTitles: string[]      // existing ticket titles (to avoid duplicates)
}

export interface DecomposedTask {
  title: string
  description: string
  type: TicketType
  estimatedHours: number
  linkedFiles: string[]           // paths from existingFiles that are relevant
  blockedBy: number[]             // indices into the returned task array (0-based)
  acceptanceCriteria: string[]
}

export interface DecompositionResult {
  epicTitle: string
  tasks: DecomposedTask[]
  dependencyNotes: string         // prose summary of task ordering
}

// ─── AI response shape ────────────────────────────────────────────────────────

interface RawTask {
  title: unknown
  description: unknown
  type: unknown
  estimatedHours: unknown
  linkedFiles: unknown
  blockedBy: unknown
  acceptanceCriteria: unknown
}

interface RawDecompositionResponse {
  tasks: RawTask[]
  dependencyNotes: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set<string>(["feature", "bug", "debt", "security"])

function toTicketType(raw: unknown): TicketType {
  if (typeof raw === "string" && VALID_TYPES.has(raw)) return raw as TicketType
  return "feature"
}

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string")
}

function toNumberArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is number => typeof x === "number")
}

function parseRawTask(raw: RawTask): DecomposedTask {
  return {
    title: typeof raw.title === "string" ? raw.title : "Untitled task",
    description: typeof raw.description === "string" ? raw.description : "",
    type: toTicketType(raw.type),
    estimatedHours:
      typeof raw.estimatedHours === "number"
        ? Math.max(1, Math.min(8, raw.estimatedHours))
        : 2,
    linkedFiles: toStringArray(raw.linkedFiles),
    blockedBy: toNumberArray(raw.blockedBy),
    acceptanceCriteria: toStringArray(raw.acceptanceCriteria),
  }
}

// ─── decomposeEpic ────────────────────────────────────────────────────────────

export async function decomposeEpic(
  input: DecompositionInput,
  routerConfig: RouterConfig,
): Promise<DecompositionResult> {
  const fileList = input.existingFiles.slice(0, 50).join("\n")
  const ticketList =
    input.openTicketTitles.length > 0 ? input.openTicketTitles.join("\n") : "none"

  const systemPrompt = `You are a staff software engineer decomposing an engineering epic into concrete implementation tasks.

Project stack: ${input.stackDescription}

Existing files in codebase (sample):
${fileList}

Existing open tickets (avoid duplicates):
${ticketList}

Epic: ${input.epicTitle}
Description: ${input.epicDescription}

Return a JSON object with this exact structure:
{
  "tasks": [
    {
      "title": "Short task title",
      "description": "What needs to be done and why",
      "type": "feature|bug|debt|security",
      "estimatedHours": 2,
      "linkedFiles": ["path/to/relevant/file.ts"],
      "blockedBy": [0, 1],
      "acceptanceCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "dependencyNotes": "Tasks 1-3 can run in parallel. Task 4 requires task 2..."
}

Guidelines:
- Generate 5-12 tasks (no more, no less)
- linkedFiles must ONLY use paths from the provided codebase file list
- blockedBy uses indices into the tasks array (0-based)
- estimatedHours: 1-8 hours per task (decompose further if larger)
- type: "feature" for new functionality, "debt" for refactoring, "security" for auth/validation, "bug" for fixing
- Be specific: "Add JWT refresh token endpoint to packages/auth/src/routes.ts" not "Handle tokens"`

  try {
    const response = await route(
      {
        messages: [{ role: "user", content: systemPrompt }],
        projectId: input.projectId,
        sessionId: randomUUID(),
        dataClassification: "internal",
        preferredCapability: "frontier",
      },
      routerConfig,
    )

    // Strip markdown code fences if present
    const raw = response.content.trim()
    const jsonText = raw.startsWith("```")
      ? raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      : raw

    const parsed = JSON.parse(jsonText) as RawDecompositionResponse

    const tasks: DecomposedTask[] = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((t) => parseRawTask(t))
      : []

    return {
      epicTitle: input.epicTitle,
      tasks,
      dependencyNotes:
        typeof parsed.dependencyNotes === "string" ? parsed.dependencyNotes : "",
    }
  } catch {
    // Fallback: single task wrapping the epic
    const fallbackTask: DecomposedTask = {
      title: input.epicTitle,
      description: input.epicDescription,
      type: "feature",
      estimatedHours: 4,
      linkedFiles: [],
      blockedBy: [],
      acceptanceCriteria: ["Epic successfully implemented"],
    }
    return {
      epicTitle: input.epicTitle,
      tasks: [fallbackTask],
      dependencyNotes: "Could not parse AI response — created single fallback task.",
    }
  }
}

// ─── tasksToTickets ───────────────────────────────────────────────────────────

export function tasksToTickets(
  result: DecompositionResult,
  projectId: string,
): Ticket[] {
  const now = new Date()

  return result.tasks.map((task, idx) => {
    const blockedByLine =
      task.blockedBy.length > 0
        ? `\n\nBlocked by: [${task.blockedBy.join(", ")}]`
        : ""

    const criteriaSection =
      task.acceptanceCriteria.length > 0
        ? `\n\nAcceptance criteria:\n${task.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`
        : ""

    const description = `${task.description}${criteriaSection}${blockedByLine}`

    const ticket: Ticket = {
      id: randomUUID(),
      projectId,
      title: task.title,
      description,
      type: task.type,
      status: "open",
      priorityScore: 50,
      priorityReason: "Generated from epic decomposition",
      sources: [{ type: "ai", ref: "epic-decomposition", capturedAt: now }],
      linkedFiles: task.linkedFiles,
      linkedPrs: [],
      manualPriorityOverride: false,
      createdBy: "ai",
      createdAt: now,
      updatedAt: now,
    }

    // Suppress unused variable warning — idx is kept for potential future use
    void idx

    return ticket
  })
}
