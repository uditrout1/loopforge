export function parseScore(text: string): number {
  try {
    const parsed = JSON.parse(text) as unknown
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "score" in parsed &&
      typeof (parsed as Record<string, unknown>)["score"] === "number"
    ) {
      const s = (parsed as Record<string, number>)["score"] as number
      return Math.min(1, Math.max(0, s))
    }
  } catch {
    // fall through to regex
  }

  const match = /score[:\s]+([0-9.]+)/i.exec(text)
  if (match) {
    const s = parseFloat(match[1] ?? "0")
    return Math.min(1, Math.max(0, isNaN(s) ? 0 : s))
  }

  return 0
}

export function isRegression(current: number, previous: number | undefined): boolean {
  if (previous === undefined) return false
  return current < previous - 0.05
}
