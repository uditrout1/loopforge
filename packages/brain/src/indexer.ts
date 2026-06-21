import { readdir, readFile, stat } from "node:fs/promises"
import { join, extname, relative } from "node:path"
import type { TechStack, ProjectKnowledge } from "@devos/core"
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

const MAX_FILE_SIZE_BYTES = 200_000 // skip large generated files

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
  const allChunks: ReturnType<typeof chunkFile> = []
  const seenExtensions = new Set<string>()
  const todos: string[] = []
  let fileCount = 0

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    await Promise.all(
      entries.map(async (entry) => {
        if (SKIP_DIRS.has(entry.name)) return

        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          await walk(fullPath)
          return
        }

        const ext = extname(entry.name).toLowerCase()
        if (!INDEXABLE_EXTENSIONS.has(ext)) return

        const fileStat = await stat(fullPath)
        if (fileStat.size > MAX_FILE_SIZE_BYTES) return

        const content = await readFile(fullPath, "utf-8")
        const relPath = relative(repoPath, fullPath)

        seenExtensions.add(ext)
        fileCount++

        // Extract TODO comments
        const todoMatches = content.match(/\/\/\s*TODO[^:\n]*:[^\n]*/gi) ?? []
        todos.push(...todoMatches.slice(0, 3).map((t) => `${relPath}: ${t.trim()}`))

        allChunks.push(...chunkFile(projectId, relPath, content))
      }),
    )
  }

  await walk(repoPath)

  const stack = await detectStack(repoPath, seenExtensions)
  const knowledge = buildKnowledge(repoPath, todos)

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

  // Detect frameworks from package.json
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
  } catch {
    // No package.json — skip
  }

  // Detect infra from config files
  try {
    await stat(join(repoPath, "Dockerfile"))
    infrastructure.push("Docker")
  } catch { /* no Dockerfile */ }

  try {
    await stat(join(repoPath, "turbo.json"))
    infrastructure.push("Turborepo")
  } catch { /* no turbo */ }

  return { languages, frameworks, databases, infrastructure }
}

function buildKnowledge(repoPath: string, todos: string[]): ProjectKnowledge {
  return {
    summary: `Repository at ${repoPath}`,
    conventions: {},
    entryPoints: [],
    openTodos: todos.slice(0, 20),
    recentDecisions: [],
    designConstraints: [],
  }
}
