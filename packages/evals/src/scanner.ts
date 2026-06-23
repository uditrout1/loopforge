import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative, extname } from "node:path"
import { randomUUID } from "node:crypto"
import { route } from "@loopforge/router"
import type { RouterConfig } from "@loopforge/router"

export type ScanType =
  | "db_long_queries"
  | "n_plus_one"
  | "missing_indexes"
  | "unhandled_errors"
  | "custom"

export interface ScanFinding {
  id: string
  file: string
  startLine: number
  endLine: number
  snippet: string
  issue: string
  severity: "high" | "medium" | "low"
  suggestion: string
  score: number
}

export interface ScanResult {
  scanId: string
  scanType: ScanType
  projectId: string
  findings: ScanFinding[]
  filesScanned: number
  createdAt: Date
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "DerivedData", ".build", "coverage", ".turbo", "out", ".cache",
])

const SCAN_EXTENSIONS: Record<ScanType, string[]> = {
  db_long_queries:   [".ts", ".js", ".py", ".go", ".rb", ".java", ".cs", ".php", ".rs"],
  n_plus_one:        [".ts", ".js", ".py", ".go", ".rb", ".java", ".cs", ".php", ".rs"],
  missing_indexes:   [".ts", ".js", ".py", ".go", ".rb", ".java", ".cs", ".php", ".rs"],
  unhandled_errors:  [".ts", ".js", ".py", ".go"],
  custom:            [".ts", ".js", ".py", ".go", ".rb", ".java", ".cs", ".php", ".rs", ".swift", ".kt"],
}

const SCAN_PATTERNS: Record<ScanType, RegExp[]> = {
  db_long_queries: [
    /\bSELECT\b/i,
    /\bfindAll\s*\(/,
    /\bfind\s*\(\s*\{/,
    /\baggregate\s*\(/,
    /prisma\.\w+\.\w+\s*\(/,
    /knex\s*\.\w+/,
    /db\.\w+\s*\(/,
    /\.query\s*\(`/,
    /mongoose\.\w+\s*\(/,
  ],
  n_plus_one: [
    /for\s+\w+\s+of\b/,
    /\.forEach\s*\(/,
    /\.map\s*\(.*async/,
    /for\s*\(.*;\s*\w+\s*<\s*\w+/,
  ],
  missing_indexes: [
    /WHERE\s+\w+\s*=/i,
    /\.where\s*\(\s*["'`]\w+["'`]/,
    /findBy\w+\s*\(/,
    /\.filter\s*\(\s*["'`]\w+["'`]/,
  ],
  unhandled_errors: [
    /\bawait\b/,
    /async\s+function|async\s*\(/,
    /\.then\s*\(/,
  ],
  custom: [/.+/],
}

const SCAN_PROMPTS: Record<ScanType, string> = {
  db_long_queries: `You are a database performance expert. Analyze this code for slow or inefficient database queries.

Look for: SELECT * without column list, missing LIMIT on large result sets, missing WHERE clause (full table scans), complex unoptimized JOINs, missing pagination, heavy aggregations, ORM calls that fetch all rows.

Respond ONLY as JSON: {"issue":"<problem description or 'None'>","severity":"high|medium|low","suggestion":"<concrete fix>","score":<0.0-1.0 where 0=critical,1=no issue>}`,

  n_plus_one: `You are a database performance expert. Analyze this code for N+1 query patterns — database queries inside loops.

Look for: DB calls inside for/forEach/map, multiple sequential queries that could be batched, missing JOIN/include/eager-loading.

Respond ONLY as JSON: {"issue":"<problem or 'None'>","severity":"high|medium|low","suggestion":"<fix>","score":<0.0-1.0>}`,

  missing_indexes: `You are a database expert. Analyze this code for queries on likely unindexed fields.

Look for: WHERE on non-primary-key fields, ORDER BY on non-indexed columns, LIKE queries, full-text searches without indexes.

Respond ONLY as JSON: {"issue":"<problem or 'None'>","severity":"high|medium|low","suggestion":"<fix>","score":<0.0-1.0>}`,

  unhandled_errors: `You are a code quality expert. Analyze this async code for missing error handling.

Look for: await without try/catch, .then() without .catch(), empty catch blocks, swallowed errors.

Respond ONLY as JSON: {"issue":"<problem or 'None'>","severity":"high|medium|low","suggestion":"<fix>","score":<0.0-1.0>}`,

  custom: `Analyze this code snippet per the user description.

Respond ONLY as JSON: {"issue":"<problem or 'None'>","severity":"high|medium|low","suggestion":"<fix>","score":<0.0-1.0>}`,
}

async function walkFiles(dir: string, exts: string[]): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      if (SKIP_DIRS.has(entry.name)) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        const sub = await walkFiles(full, exts)
        results.push(...sub)
      } else if (entry.isFile() && exts.includes(extname(entry.name))) {
        results.push(full)
      }
    }))
  } catch {
    // skip unreadable dirs
  }
  return results
}

function extractContext(
  lines: string[],
  matchLine: number,
  before = 5,
  after = 20,
): { start: number; end: number; snippet: string } {
  const start = Math.max(0, matchLine - before)
  const end = Math.min(lines.length - 1, matchLine + after)
  return {
    start: start + 1,
    end: end + 1,
    snippet: lines.slice(start, end + 1).join("\n"),
  }
}

export async function scanRepo(
  projectId: string,
  repoPath: string,
  scanType: ScanType,
  routerConfig: RouterConfig,
  customDescription?: string,
): Promise<ScanResult> {
  const exts = SCAN_EXTENSIONS[scanType]
  const patterns = SCAN_PATTERNS[scanType]

  let systemPrompt = SCAN_PROMPTS[scanType]
  if (scanType === "custom" && customDescription) {
    systemPrompt =
      `${customDescription}\n\nRespond ONLY as JSON: {"issue":"<problem or 'None'>","severity":"high|medium|low","suggestion":"<concrete fix>","score":<0.0-1.0 where 0=critical issue, 1=no issue found>}`
  }

  const allFiles = await walkFiles(repoPath, exts)
  // cap at 60 files to stay within reasonable cost
  const files = allFiles.slice(0, 60)

  const findings: ScanFinding[] = []

  await Promise.all(files.map(async (filePath) => {
    try {
      const s = await stat(filePath)
      if (s.size > 200_000) return

      const content = await readFile(filePath, "utf-8")
      const lines = content.split("\n")

      // Find matching lines
      const matched = new Set<number>()
      for (const pattern of patterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line !== undefined && pattern.test(line)) matched.add(i)
        }
      }

      // Deduplicate nearby matches into groups (one analysis per cluster)
      const groups: number[] = []
      let lastGroup = -50
      for (const idx of [...matched].sort((a, b) => a - b)) {
        if (idx - lastGroup > 25) {
          groups.push(idx)
          lastGroup = idx
        }
      }

      // Limit to 5 groups per file
      await Promise.all(groups.slice(0, 5).map(async (lineIdx) => {
        const { start, end, snippet } = extractContext(lines, lineIdx)
        if (snippet.trim().length < 20) return

        try {
          const relPath = relative(repoPath, filePath)
          const userMsg = `File: ${relPath} (lines ${start}-${end})\n\`\`\`\n${snippet}\n\`\`\``

          const response = await route(
            {
              messages: [
                { role: "user", content: `${systemPrompt}\n\n${userMsg}` },
              ],
              projectId,
              sessionId: randomUUID(),
              dataClassification: "internal",
              preferredCapability: "small",
            },
            routerConfig,
          )

          // Extract JSON from response (model may wrap in markdown)
          const jsonMatch = response.content.match(/\{[\s\S]*\}/)
          if (!jsonMatch) return
          const result = JSON.parse(jsonMatch[0]) as {
            issue: string
            severity: "high" | "medium" | "low"
            suggestion: string
            score: number
          }

          // Only surface real issues
          if (result.score < 0.85 && result.issue && result.issue.toLowerCase() !== "none") {
            findings.push({
              id: randomUUID(),
              file: relPath,
              startLine: start,
              endLine: end,
              snippet,
              issue: result.issue,
              severity: result.severity ?? "medium",
              suggestion: result.suggestion ?? "",
              score: result.score,
            })
          }
        } catch {
          // skip parse failures
        }
      }))
    } catch {
      // skip unreadable files
    }
  }))

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  findings.sort((a, b) => (severityOrder[a.severity] ?? 1) - (severityOrder[b.severity] ?? 1))

  return {
    scanId: randomUUID(),
    scanType,
    projectId,
    findings,
    filesScanned: files.length,
    createdAt: new Date(),
  }
}
