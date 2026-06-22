import type { VisualAsset } from "@devos/core"

export interface VisualAssetStore {
  getAsset(id: string): Promise<VisualAsset | null>
  listAssets(projectId: string): Promise<VisualAsset[]>
  saveAsset(asset: VisualAsset): Promise<void>
  deleteAsset(id: string): Promise<boolean>
}

export function createInMemoryVisualAssetStore(): VisualAssetStore {
  const assets = new Map<string, VisualAsset>()

  return {
    async getAsset(id) {
      return assets.get(id) ?? null
    },

    async listAssets(projectId) {
      return Array.from(assets.values()).filter((a) => a.projectId === projectId)
    },

    async saveAsset(asset) {
      assets.set(asset.id, asset)
    },

    async deleteAsset(id) {
      return assets.delete(id)
    },
  }
}
