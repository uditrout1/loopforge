import { createHash } from "node:crypto"
import type { ContextChunk } from "@loopforge/core"

const CHUNK_SIZE_TOKENS = 512
const CHUNK_OVERLAP_TOKENS = 64
// Rough chars-per-token estimate (avoids bundling a full tokenizer for chunking)
const CHARS_PER_TOKEN = 4

export function chunkFile(
  projectId: string,
  filePath: string,
  content: string,
): Omit<ContextChunk, "embedding">[] {
  const fileHash = createHash("sha256").update(content).digest("hex")
  const chunkSizeChars = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN
  const overlapChars = CHUNK_OVERLAP_TOKENS * CHARS_PER_TOKEN

  const chunks: Omit<ContextChunk, "embedding">[] = []
  let offset = 0
  let chunkIndex = 0

  while (offset < content.length) {
    const end = Math.min(offset + chunkSizeChars, content.length)
    const chunkContent = content.slice(offset, end)
    const tokenCount = Math.ceil(chunkContent.length / CHARS_PER_TOKEN)

    chunks.push({
      id: `${projectId}:${filePath}:${chunkIndex}`,
      projectId,
      filePath,
      content: chunkContent,
      chunkIndex,
      tokenCount,
      fileHash,
      updatedAt: new Date(),
    })

    chunkIndex++
    offset += chunkSizeChars - overlapChars
  }

  return chunks
}
