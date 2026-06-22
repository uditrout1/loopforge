import { randomUUID } from "node:crypto"
import type { VisualAsset } from "@loopforge/core"
import type { RouterConfig } from "@loopforge/router"
import type { BrainStore } from "@loopforge/brain"
import { analyzeVisual } from "./analyzer.js"
import type { AnalysisResult } from "./analyzer.js"
import { linkToCode } from "./linker.js"
import { parseFigmaUrl } from "./figma.js"
import type { VisualAssetStore } from "./store.js"

export class VisionService {
  constructor(
    private store: VisualAssetStore,
    private brainStore: BrainStore,
    private routerConfig: RouterConfig,
  ) {}

  async analyzeScreenshot(
    projectId: string,
    name: string,
    base64Data: string,
    mediaType: string,
    question: string,
  ): Promise<{ asset: VisualAsset; analysis: AnalysisResult }> {
    const now = new Date()
    const asset: VisualAsset = {
      id: randomUUID(),
      projectId,
      type: "screenshot",
      name,
      linkedFilePaths: [],
      linkedTicketIds: [],
      createdAt: now,
      updatedAt: now,
    }
    await this.store.saveAsset(asset)

    const analysis = await analyzeVisual(
      asset,
      question,
      { data: base64Data, mediaType },
      this.routerConfig,
    )

    const linkedFilePaths = await linkToCode(
      projectId,
      analysis.componentNames,
      analysis.description,
      this.brainStore,
    )

    const updated: VisualAsset = {
      ...asset,
      linkedFilePaths,
      aiDescription: analysis.description,
      analysisCache: JSON.stringify(analysis),
      updatedAt: new Date(),
    }
    await this.store.saveAsset(updated)

    return { asset: updated, analysis }
  }

  async analyzeFigmaUrl(
    projectId: string,
    figmaUrl: string,
    question: string,
  ): Promise<{ asset: VisualAsset; analysis: AnalysisResult }> {
    const ref = parseFigmaUrl(figmaUrl)
    if (!ref) throw new Error(`Invalid Figma URL: ${figmaUrl}`)

    const now = new Date()
    const asset: VisualAsset = {
      id: randomUUID(),
      projectId,
      type: "figma_component",
      name: ref.fileId,
      url: figmaUrl,
      ...(ref.nodeId !== undefined ? { figmaNodeId: ref.nodeId } : {}),
      linkedFilePaths: [],
      linkedTicketIds: [],
      createdAt: now,
      updatedAt: now,
    }
    await this.store.saveAsset(asset)

    const analysis = await analyzeVisual(asset, question, undefined, this.routerConfig)

    const linkedFilePaths = await linkToCode(
      projectId,
      analysis.componentNames,
      analysis.description,
      this.brainStore,
    )

    const updated: VisualAsset = {
      ...asset,
      linkedFilePaths,
      aiDescription: analysis.description,
      analysisCache: JSON.stringify(analysis),
      updatedAt: new Date(),
    }
    await this.store.saveAsset(updated)

    return { asset: updated, analysis }
  }

  async askAboutAsset(assetId: string, question: string): Promise<AnalysisResult> {
    const asset = await this.store.getAsset(assetId)
    if (!asset) throw new Error(`Asset ${assetId} not found`)
    return analyzeVisual(asset, question, undefined, this.routerConfig)
  }

  async listAssets(projectId: string): Promise<VisualAsset[]> {
    return this.store.listAssets(projectId)
  }

  async getAsset(id: string): Promise<VisualAsset | null> {
    return this.store.getAsset(id)
  }
}
