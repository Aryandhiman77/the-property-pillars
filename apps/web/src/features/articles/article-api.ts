import "server-only";

export async function publicArticleRequest<T>(path: string) {
  const base = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000").replace(/\/+$/, "");
  const response = await fetch(base + "/api/v1/public/articles" + path, {cache: "no-store", signal: AbortSignal.timeout(12_000)});
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Articles are temporarily unavailable.");
  return (await response.json() as {data: T}).data;
}
