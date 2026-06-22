import { readdir, readFile, lstat } from "node:fs/promises"
import { join, extname, relative, resolve } from "node:path"
import type { TechStack, ProjectKnowledge } from "@loopforge/core"
import { chunkFile } from "./chunker.js"

const INDEXABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".kt", ".swift",
  ".css", ".scss", ".html",
  ".json", ".yaml", ".yml", ".toml",
  ".md", ".txt",
])

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  ".turbo", "__pycache__", ".venv", "venv",
  "DerivedData", ".build",
])

const MAX_FILE_SIZE_BYTES = 200_000
// Fix 4: guard against deeply nested repos and huge file counts
const MAX_DEPTH = 20
const MAX_FILES = 50_000

export interface IndexResult {
  chunks: ReturnType<typeof chunkFile>
  stack: TechStack
  knowledge: ProjectKnowledge
  fileCount: number
}

export async function indexRepository(
  projectId: string,
  repoPath: string,
): Promise<IndexResult> {
  const canonicalRoot = resolve(repoPath)
  const allChunks: ReturnType<typeof chunkFile> = []
  const seenExtensions = new Set<string>()
  const todos: string[] = []
  let fileCount = 0

  async function walk(dir: string, depth: number): Promise<void> {
    // Fix 4: cap traversal depth
    if (depth > MAX_DEPTH) return
    if (fileCount >= MAX_FILES) return

    const entries = await readdir(dir, { withFileTypes: true })

    await Promise.all(
      entries.map(async (entry) => {
        if (fileCount >= MAX_FILES) return
        if (SKIP_DIRS.has(entry.name)) return

        const fullPath = join(dir, entry.name)

        // Fix 4: use lstat (not stat/isDirectory on the dirent) to detect symlinks
        // before following them, preventing escape from the repo root via symlinks.
        const fileLstat = await lstat(fullPath)
        if (fileLstat.isSymbolicLink()) return

        // Verify the resolved path is still inside the repo root (belt-and-suspenders)
        const resolvedPath = resolve(fullPath)
        if (!resolvedPath.startsWith(canonicalRoot)) return

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1)
          return
        }

        const ext = extname(entry.name).toLowerCase()
        if (!INDEXABLE_EXTENSIONS.has(ext)) return
        if (fileLstat.size > MAX_FILE_SIZE_BYTES) return

        const content = await readFile(fullPath, "utf-8")
        const relPath = relative(repoPath, fullPath)

        seenExtensions.add(ext)
        fileCount++

        const todoMatches = content.match(/\/\/\s*TODO[^:\n]*:[^\n]*/gi) ?? []
        todos.push(...todoMatches.slice(0, 3).map((t) => `${relPath}: ${t.trim()}`))

        allChunks.push(...chunkFile(projectId, relPath, content))
      }),
    )
  }

  await walk(canonicalRoot, 0)

  const stack = await detectStack(canonicalRoot, seenExtensions)
  const knowledge = buildKnowledge(todos)

  return { chunks: allChunks, stack, knowledge, fileCount }
}

async function detectStack(
  repoPath: string,
  extensions: Set<string>,
): Promise<TechStack> {
  const languages: string[] = []
  const frameworks: string[] = []
  const databases: string[] = []
  const infrastructure: string[] = []

  if (extensions.has(".ts") || extensions.has(".tsx")) languages.push("TypeScript")
  if (extensions.has(".js") || extensions.has(".jsx")) languages.push("JavaScript")
  if (extensions.has(".py")) languages.push("Python")
  if (extensions.has(".go")) languages.push("Go")
  if (extensions.has(".rs")) languages.push("Rust")
  if (extensions.has(".swift")) languages.push("Swift")
  if (extensions.has(".kt")) languages.push("Kotlin")
  if (extensions.has(".java")) languages.push("Java")

  try {
    const pkg = JSON.parse(
      await readFile(join(repoPath, "package.json"), "utf-8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }

    if (deps["next"]) frameworks.push("Next.js")
    if (deps["react"]) frameworks.push("React")
    if (deps["vue"]) frameworks.push("Vue")
    if (deps["svelte"]) frameworks.push("Svelte")
    if (deps["hono"]) frameworks.push("Hono")
    if (deps["express"]) frameworks.push("Express")
    if (deps["fastify"]) frameworks.push("Fastify")
    if (deps["@supabase/supabase-js"]) databases.push("Supabase")
    if (deps["prisma"] || deps["@prisma/client"]) databases.push("Prisma")
    if (deps["drizzle-orm"]) databases.push("Drizzle")
    if (deps["mongoose"]) databases.push("MongoDB")
  } catch { /* no package.json */ }

  try {
    await lstat(join(repoPath, "Dockerfile"))
    infrastructure.push("Docker")
  } catch { /* no Dockerfile */ }

  try {
    await lstat(join(repoPath, "turbo.json"))
    infrastructure.push("Turborepo")
  } catch { /* no turbo */ }

  return { languages, frameworks, databases, infrastructure }
}

function buildKnowledge(todos: string[]): ProjectKnowledge {
  return {
    summary: "",
    conventions: {},
    entryPoints: [],
    openTodos: todos.slice(0, 20),
    recentDecisions: [],
    designConstraints: [],
  }
}
