import { Hono } from "hono"
import type { Context } from "hono"

export interface ModelSettings {
  small: string
  medium: string
  frontier: string
  ollamaModel: string
}

export interface RoutingSettings {
  preferOnPrem: boolean
  confidentialOnPremOnly: boolean
  costLimitPerSessionUsd: number | null
}

export interface WorkflowSetting {
  enabled: boolean
  trigger: "auto" | "manual"
}

export interface LoopForgeSettings {
  models: ModelSettings
  routing: RoutingSettings
  workflows: {
    prReview: WorkflowSetting
    bugInvestigation: WorkflowSetting
    releasePreparer: WorkflowSetting
    nightlySecurityScan: WorkflowSetting
  }
  ui: {
    showCostPerMessage: boolean
    showModelPerMessage: boolean
  }
}

export const AVAILABLE_MODELS = [
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", tier: "frontier", provider: "openrouter" },
  { id: "anthropic/claude-opus-4-8", name: "Claude Opus 4.8", tier: "frontier", provider: "openrouter" },
  { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", tier: "medium", provider: "openrouter" },
  { id: "openai/gpt-4o", name: "GPT-4o", tier: "frontier", provider: "openrouter" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", tier: "medium", provider: "openrouter" },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", tier: "medium", provider: "openrouter" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", tier: "frontier", provider: "openrouter" },
  { id: "qwen/qwen-2.5-7b-instruct", name: "Qwen 2.5 7B", tier: "small", provider: "openrouter" },
  { id: "meta-llama/llama-3.1-8b-instruct", name: "Llama 3.1 8B", tier: "small", provider: "openrouter" },
  { id: "mistralai/mistral-7b-instruct", name: "Mistral 7B", tier: "small", provider: "openrouter" },
  { id: "llama3", name: "Llama 3 (Ollama)", tier: "frontier", provider: "ollama" },
  { id: "mistral", name: "Mistral (Ollama)", tier: "medium", provider: "ollama" },
  { id: "qwen2.5-coder", name: "Qwen 2.5 Coder (Ollama)", tier: "medium", provider: "ollama" },
  { id: "deepseek-coder-v2", name: "DeepSeek Coder V2 (Ollama)", tier: "medium", provider: "ollama" },
]

const DEFAULT_SETTINGS: LoopForgeSettings = {
  models: {
    small: "qwen/qwen-2.5-7b-instruct",
    medium: "anthropic/claude-haiku-4-5-20251001",
    frontier: "anthropic/claude-sonnet-4-6",
    ollamaModel: "llama3",
  },
  routing: {
    preferOnPrem: false,
    confidentialOnPremOnly: true,
    costLimitPerSessionUsd: null,
  },
  workflows: {
    prReview: { enabled: true, trigger: "manual" },
    bugInvestigation: { enabled: true, trigger: "manual" },
    releasePreparer: { enabled: true, trigger: "manual" },
    nightlySecurityScan: { enabled: false, trigger: "auto" },
  },
  ui: {
    showCostPerMessage: true,
    showModelPerMessage: true,
  },
}

let currentSettings: LoopForgeSettings = { ...DEFAULT_SETTINGS }

export function getSettings(): LoopForgeSettings {
  return currentSettings
}

export function createSettingsRouter(): Hono {
  const app = new Hono()

  app.get("/", (c: Context) => c.json(currentSettings))

  app.put("/", async (c: Context) => {
    const body = await c.req.json<Partial<LoopForgeSettings>>()
    currentSettings = {
      models: { ...currentSettings.models, ...(body.models ?? {}) },
      routing: {
        ...currentSettings.routing,
        ...(body.routing ?? {}),
        confidentialOnPremOnly: true, // never user-overridable
      },
      workflows: {
        prReview: { ...currentSettings.workflows.prReview, ...(body.workflows?.prReview ?? {}) },
        bugInvestigation: { ...currentSettings.workflows.bugInvestigation, ...(body.workflows?.bugInvestigation ?? {}) },
        releasePreparer: { ...currentSettings.workflows.releasePreparer, ...(body.workflows?.releasePreparer ?? {}) },
        nightlySecurityScan: { ...currentSettings.workflows.nightlySecurityScan, ...(body.workflows?.nightlySecurityScan ?? {}) },
      },
      ui: { ...currentSettings.ui, ...(body.ui ?? {}) },
    }
    return c.json(currentSettings)
  })

  app.get("/models/available", (c: Context) => c.json(AVAILABLE_MODELS))

  app.delete("/reset", (c: Context) => {
    currentSettings = { ...DEFAULT_SETTINGS }
    return c.json(currentSettings)
  })

  return app
}
