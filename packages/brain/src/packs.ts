import type { ContextPack, ContextChunk } from "@loopforge/core"
import type { BrainStore } from "./loader.js"

/**
 * Returns true if filePath matches any of the provided glob patterns.
 *
 * Supported syntax (no external dependencies):
 *   "**"  — matches zero or more path segments
 *   "*"   — matches any characters within a single segment (no slashes)
 *   literal strings — matched exactly
 */
export function matchesPackPattern(filePath: string, patterns: string[]): boolean {
  // Normalise separators to forward slashes
  const normalised = filePath.replace(/\\/g, "/")

  for (const pattern of patterns) {
    if (globMatch(pattern.replace(/\\/g, "/"), normalised)) {
      return true
    }
  }
  return false
}

/**
 * Minimal glob matcher — supports ** and *.
 * Converts the pattern to a RegExp and tests the path.
 */
function globMatch(pattern: string, path: string): boolean {
  // Escape all regex special chars except * which we handle ourselves
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")

  // Replace ** with a placeholder, then * with [^/]*, then restore **
  const regexStr = escaped
    .replace(/\*\*/g, "\x00") // placeholder for **
    .replace(/\*/g, "[^/]*")  // * matches within one segment
    .replace(/\x00/g, ".*")   // ** matches anything including slashes

  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(path)
}

/**
 * Assemble context chunks for a pack by filtering project chunks whose
 * filePath matches any of the pack's filePatterns.
 *
 * @param pack    The ContextPack defining which files to include
 * @param store   The BrainStore to load chunks from
 * @param query   Optional semantic query for the initial chunk retrieval
 * @returns       Up to 20 matching ContextChunks
 */
export async function assemblePackContext(
  pack: ContextPack,
  store: BrainStore,
  query?: string,
): Promise<ContextChunk[]> {
  const projectId = pack.projectId || ""
  const allChunks = await store.searchChunks(projectId, query ?? "", 200)

  const matched = allChunks.filter((chunk) =>
    matchesPackPattern(chunk.filePath, pack.filePatterns),
  )

  return matched.slice(0, 20)
}
