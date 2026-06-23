import { Hono } from "hono"
import { readFile, writeFile, readdir, lstat, realpath } from "node:fs/promises"
import { resolve, relative, join, extname, sep, dirname, basename } from "node:path"
import type { Project } from "@loopforge/core"

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  ".turbo", "DerivedData", ".build", "coverage", ".turbo",
])

const EDITABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".rb", ".java", ".kt", ".swift",
  ".md", ".mdx", ".txt", ".json", ".yaml", ".yml", ".toml",
  ".html", ".css", ".scss", ".env.example", ".sh",
  ".sql", ".graphql", ".proto",
])

const MAX_FILE_SIZE = 500_000 // 500 KB

export interface FileTreeEntry {
  name: string
  path: string   // relative to repoPath
  type: "file" | "dir"
  children?: FileTreeEntry[]
  size?: number
}

async function buildTree(
  dir: string,
  repoPath: string,
  depth: number,
  maxDepth: number,
): Promise<FileTreeEntry[]> {
  if (depth > maxDepth) return []
  let names: string[]
  try { names = await readdir(dir) } catch { return [] }

  const entries: FileTreeEntry[] = []
  for (const name of names.sort()) {
    if (name.startsWith(".") && name !== ".env.example") continue
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    let st
    try { st = await lstat(full) } catch { continue }
    if (st.isSymbolicLink()) continue
    const rel = relative(repoPath, full)
    if (st.isDirectory()) {
      const children = await buildTree(full, repoPath, depth + 1, maxDepth)
      entries.push({ name, path: rel, type: "dir", children })
    } else {
      if (!EDITABLE_EXTENSIONS.has(extname(name).toLowerCase())) continue
      entries.push({ name, path: rel, type: "file", size: st.size })
    }
  }
  return entries
}

async function validateFilePath(repoPath: string, relPath: string): Promise<string> {
  if (!relPath || typeof relPath !== "string") throw new Error("path is required")
  if (relPath.includes("..")) throw new Error("'..' not permitted in path")

  const lexical = resolve(repoPath, relPath)

  // Resolve symlinks on the repo root for a stable containment baseline
  const realRepo = await realpath(repoPath)

  // Resolve symlinks on the parent — file may not exist yet (writes)
  const parentDir = dirname(lexical)
  let realParent: string
  try {
    realParent = await realpath(parentDir)
  } catch {
    throw new Error("parent directory does not exist")
  }

  const realFull = join(realParent, basename(lexical))

  if (!realFull.startsWith(realRepo + sep) && realFull !== realRepo) {
    throw new Error("path escapes repo root")
  }

  return realFull
}

export function createFilesRouter(projectsStore: Map<string, Project>): Hono {
  const app = new Hono()

  // GET /projects/:id/files — directory tree (depth 4)
  app.get("/:id/files", async (c) => {
    const project = projectsStore.get(c.req.param("id"))
    if (!project) return c.json({ error: "Project not found" }, 404)
    const repoPath = project.repoPath
    if (!repoPath) return c.json({ error: "Project has no repoPath" }, 400)
    const depth = Math.min(Number(c.req.query("depth") ?? 4), 6)
    const tree = await buildTree(repoPath, repoPath, 0, depth)
    return c.json({ tree, repoPath })
  })

  // GET /projects/:id/files/content?path=relative/path
  app.get("/:id/files/content", async (c) => {
    const project = projectsStore.get(c.req.param("id"))
    if (!project) return c.json({ error: "Project not found" }, 404)
    const repoPath = project.repoPath
    if (!repoPath) return c.json({ error: "Project has no repoPath" }, 400)
    const relPath = c.req.query("path") ?? ""
    let absPath: string
    try { absPath = await validateFilePath(repoPath, relPath) } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
    let st
    try { st = await lstat(absPath) } catch {
      return c.json({ error: "File not found" }, 404)
    }
    if (st.isSymbolicLink()) return c.json({ error: "Symlinks not permitted" }, 400)
    if (st.size > MAX_FILE_SIZE) return c.json({ error: "File too large (>500 KB)" }, 413)
    const content = await readFile(absPath, "utf-8")
    return c.json({ path: relPath, content, size: st.size })
  })

  // PUT /projects/:id/files/content — body: { path, content }
  app.put("/:id/files/content", async (c) => {
    const project = projectsStore.get(c.req.param("id"))
    if (!project) return c.json({ error: "Project not found" }, 404)
    const repoPath = project.repoPath
    if (!repoPath) return c.json({ error: "Project has no repoPath" }, 400)
    const body = await c.req.json<{ path: string; content: string }>()
    let absPath: string
    try { absPath = await validateFilePath(repoPath, body.path) } catch (e) {
      return c.json({ error: (e as Error).message }, 400)
    }
    if (typeof body.content !== "string") return c.json({ error: "content must be a string" }, 400)
    if (Buffer.byteLength(body.content, "utf-8") > MAX_FILE_SIZE) {
      return c.json({ error: "Content too large (>500 KB)" }, 413)
    }
    // Reject if the target is a symlink (could have been created concurrently)
    try {
      const st = await lstat(absPath)
      if (st.isSymbolicLink()) return c.json({ error: "Symlinks not permitted" }, 400)
    } catch { /* file doesn't exist yet — fine for writes */ }
    await writeFile(absPath, body.content, { encoding: "utf-8", flag: "w" })
    return c.json({ ok: true, path: body.path })
  })

  return app
}
