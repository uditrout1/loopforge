import { readFile } from "node:fs/promises"
import { route } from "@devos/router"
import type { RouterConfig } from "@devos/router"
import type { VisualAsset, ImagePart, TextPart } from "@devos/core"

export interface AnalysisResult {
  description: string
  uxIssues: string[]
  accessibilityIssues: string[]
  copyIssues: string[]
  suggestedImprovements: string[]
  componentNames: string[]
  requiredCodeChanges: string[]
}

const SYSTEM_PROMPT = `You are a senior UX engineer, accessibility expert, and frontend developer reviewing a UI design.
Analyze the provided visual and answer the user's question with specific, actionable feedback.

Return a JSON object with:
- description: what is shown in this visual (1-2 sentences)
- uxIssues: array of specific UX problems (empty if none)
- accessibilityIssues: array of WCAG concerns (empty if none)
- copyIssues: array of text/copy problems (empty if none)
- suggestedImprovements: array of concrete improvement recommendations
- componentNames: array of UI component names visible (Button, Modal, Form, etc.)
- requiredCodeChanges: array of specific code changes needed

Be specific and actionable. Reference exact elements. No vague feedback.`

function parseAnalysisResult(raw: string): AnalysisResult {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    return {
      description: typeof parsed["description"] === "string" ? parsed["description"] : raw,
      uxIssues: Array.isArray(parsed["uxIssues"]) ? (parsed["uxIssues"] as string[]) : [],
      accessibilityIssues: Array.isArray(parsed["accessibilityIssues"]) ? (parsed["accessibilityIssues"] as string[]) : [],
      copyIssues: Array.isArray(parsed["copyIssues"]) ? (parsed["copyIssues"] as string[]) : [],
      suggestedImprovements: Array.isArray(parsed["suggestedImprovements"]) ? (parsed["suggestedImprovements"] as string[]) : [],
      componentNames: Array.isArray(parsed["componentNames"]) ? (parsed["componentNames"] as string[]) : [],
      requiredCodeChanges: Array.isArray(parsed["requiredCodeChanges"]) ? (parsed["requiredCodeChanges"] as string[]) : [],
    }
  } catch {
    return {
      description: raw,
      uxIssues: [],
      accessibilityIssues: [],
      copyIssues: [],
      suggestedImprovements: [],
      componentNames: [],
      requiredCodeChanges: [],
    }
  }
}

export async function analyzeVisual(
  asset: VisualAsset,
  question: string,
  base64Override: { data: string; mediaType: string } | undefined,
  routerConfig: RouterConfig,
): Promise<AnalysisResult> {
  let imagePart: ImagePart

  if (base64Override !== undefined) {
    imagePart = {
      type: "image",
      source: { type: "base64", mediaType: base64Override.mediaType, data: base64Override.data },
    }
  } else if (asset.url !== undefined) {
    imagePart = {
      type: "image",
      source: { type: "url", url: asset.url },
    }
  } else if (asset.storagePath !== undefined) {
    const fileBuffer = await readFile(asset.storagePath)
    const data = fileBuffer.toString("base64")
    imagePart = {
      type: "image",
      source: { type: "base64", mediaType: "image/png", data },
    }
  } else {
    throw new Error("VisualAsset has neither url nor storagePath — cannot analyze")
  }

  const textPart: TextPart = { type: "text", text: question }

  const response = await route(
    {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: [imagePart, textPart] },
      ],
      projectId: asset.projectId,
      sessionId: asset.id,
      dataClassification: "internal",
      preferredCapability: "frontier",
    },
    routerConfig,
  )

  return parseAnalysisResult(response.content)
}
