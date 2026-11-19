export function safeHttpUrl(source: unknown): string {
  if (typeof source !== "string") return "";
  try {
    const url = new URL(source);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function imageSource(source: unknown): string {
  return typeof source === "string" && /^\/api\/v1\/uploads\/[a-f0-9]{64}\.webp$/.test(source) ? source : safeHttpUrl(source);
}
