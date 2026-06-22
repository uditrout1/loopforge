import type { BrainStore } from "@devos/brain"

export async function linkToCode(
  projectId: string,
  componentNames: string[],
  analysisText: string,
  brainStore: BrainStore,
): Promise<string[]> {
  const pathSets = await Promise.all([
    // Search for each component name
    ...componentNames.map((name) =>
      brainStore.searchChunks(projectId, name, 3).then((chunks) => chunks.map((c) => c.filePath)),
    ),
    // Also search for the analysis summary
    brainStore
      .searchChunks(projectId, analysisText.slice(0, 100), 5)
      .then((chunks) => chunks.map((c) => c.filePath)),
  ])

  const seen = new Set<string>()
  const result: string[] = []

  for (const paths of pathSets) {
    for (const p of paths) {
      if (!seen.has(p)) {
        seen.add(p)
        result.push(p)
        if (result.length >= 10) return result
      }
    }
  }

  return result
}
