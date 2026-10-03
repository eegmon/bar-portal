export function parseUserPositions(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
