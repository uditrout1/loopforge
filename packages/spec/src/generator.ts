import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"

// Generate a PRD from a feature description
export async function generatePRD(
  projectId: string,
  featureTitle: string,
  featureDescription: string,
  projectContext: string,
  routerConfig: RouterConfig,
): Promise<string> {
  const prompt = `You are a senior product manager. Generate a concise PRD for the following feature.

Project: ${projectContext}
Feature: ${featureTitle}
Description: ${featureDescription}

Format the PRD in Markdown with these sections:
# ${featureTitle}
## Problem Statement
## Goals & Non-Goals
## User Stories
## Success Metrics
## Scope

Keep it concrete and actionable. No fluff.`

  const response = await route(
    {
      messages: [{ role: "user", content: prompt }],
      projectId,
      sessionId: `spec-generation-${projectId}`,
      dataClassification: "internal",
      preferredCapability: "frontier",
    },
    routerConfig,
  )

  return response.content
}

// Generate an architecture doc from a PRD
export async function generateArchitectureDoc(
  projectId: string,
  prdContent: string,
  stackDescription: string,
  routerConfig: RouterConfig,
): Promise<string> {
  // Extract title from PRD content (first # heading)
  const titleMatch = /^#\s+(.+)$/m.exec(prdContent)
  const title = titleMatch?.[1] ?? "Feature"

  const prompt = `You are a staff software architect. Generate an architecture document for the following feature.

Stack: ${stackDescription}

PRD:
${prdContent}

Format in Markdown with sections:
# Architecture: ${title}
## Component Overview
## Data Model Changes
## API Changes
## Security Considerations
## Migration Plan (if needed)
## Open Questions`

  const response = await route(
    {
      messages: [{ role: "user", content: prompt }],
      projectId,
      sessionId: `spec-generation-${projectId}`,
      dataClassification: "internal",
      preferredCapability: "frontier",
    },
    routerConfig,
  )

  return response.content
}

// Generate a technical spec from PRD + architecture
export async function generateTechnicalSpec(
  projectId: string,
  prdContent: string,
  architectureContent: string,
  routerConfig: RouterConfig,
): Promise<string> {
  const prompt = `You are a staff engineer. Generate a technical specification for implementation.

PRD:
${prdContent}

Architecture:
${architectureContent}

Format in Markdown with sections:
# Technical Spec
## Implementation Plan
## Files to Create/Modify
## Database Changes
## Testing Strategy
## Rollout Plan`

  const response = await route(
    {
      messages: [{ role: "user", content: prompt }],
      projectId,
      sessionId: `spec-generation-${projectId}`,
      dataClassification: "internal",
      preferredCapability: "frontier",
    },
    routerConfig,
  )

  return response.content
}
