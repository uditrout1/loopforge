import { readFile, readdir, lstat } from "node:fs/promises"
import { join, extname, basename, relative } from "node:path"
import type { ScannedDoc, ScannedDocType } from "@loopforge/core"

const DOC_PATTERNS: Array<{ test: (name: string, rel: string) => boolean; type: ScannedDocType }> = [
  { test: (n) => /^claude\.md$/i.test(n), type: "claude_md" },
  { test: (n) => /^prd\.md$/i.test(n) || /^product\.md$/i.test(n) || /product.requirements/i.test(n) || /^requirements\.md$/i.test(n), type: "prd" },
  { test: (n) => /^brd\.md$/i.test(n) || /business.requirements/i.test(n), type: "brd" },
  { test: (n) => /^frd\.md$/i.test(n) || /functional.requirements/i.test(n), type: "frd" },
  { test: (n, rel) => /adr/i.test(rel) && extname(n) === ".md", type: "adr" },
  { test: (n) => /^readme\.md$/i.test(n), type: "readme" },
  { test: (n, rel) => /docs?\//i.test(rel) && extname(n) === ".md", type: "spec" },
]

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  ".turbo", "DerivedData", ".build",
])
const MAX_DOC_SIZE = 500_000

export async function scanDocs(repoPath: string): Promise<ScannedDoc[]> {
  const results: ScannedDoc[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6) return
    let names: string[]
    try {
      names = await readdir(dir, { encoding: "utf8" })
    } catch { return }

    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue
      const fullPath = join(dir, name)

      let st
      try { st = await lstat(fullPath) } catch { continue }
      if (st.isSymbolicLink()) continue

      const relPath = relative(repoPath, fullPath)

      if (st.isDirectory()) {
        await walk(fullPath, depth + 1)
        continue
      }

      if (extname(name).toLowerCase() !== ".md") continue

      const matched = DOC_PATTERNS.find(p => p.test(name, relPath))
      if (!matched) continue

      if (st.size > MAX_DOC_SIZE) continue
      try {
        const content = await readFile(fullPath, "utf-8")
        const firstHeading = content.match(/^#+ (.+)/m)
        const title = firstHeading?.[1]?.trim() ?? basename(name, ".md")
        results.push({ relPath, absPath: fullPath, type: matched.type, content, title })
      } catch { continue }
    }
  }

  await walk(repoPath, 0)
  return results
}
