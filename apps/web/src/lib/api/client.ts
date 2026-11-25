import type {ListingIssue} from "@the-property-pillar/contracts";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly fieldErrors: Record<string, string> = {},
    public readonly code?: string,
    public readonly listingIssues: ListingIssue[] = [],
    public readonly reviewAttemptId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string> | {field: string; message: string}[];
    details?: Record<string, unknown> | {path: string; message: string}[];
  };
};

function normalizeFieldErrors(details: unknown): Record<string, string> {
  if (Array.isArray(details)) {
    const result = new Map<string, string>();
    for (const entry of details) {
      const name = entry?.field ?? entry?.path;
      if (typeof name !== "string" || typeof entry.message !== "string") continue;
      result.set(name, [result.get(name), entry.message].filter(Boolean).join(" "));
    }
    return Object.fromEntries(result);
  }
  if (!details || typeof details !== "object") return {};
  return Object.fromEntries(Object.entries(details).flatMap(([field, messages]) => {
    if (typeof messages === "string") return [[field, messages]];
    if (Array.isArray(messages) && messages.length && messages.every((message) => typeof message === "string")) {
      return [[field, messages.join(" ")]];
    }
    return [];
  }));
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!/^\/[a-zA-Z0-9_-]/.test(path)) {
    throw new TypeError("API paths must be relative to /api/v1");
  }
  const binary = options.body instanceof Blob ? options.body : undefined;
  const response = await fetch("/api/v1" + path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: options.body === undefined || options.body instanceof FormData
      ? options.headers
      : {"Content-Type": binary?.type || "application/json", ...options.headers},
    body: options.body instanceof FormData ? options.body : binary ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    signal: options.signal,
  });
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    const details = payload?.error?.details;
    const rawDetails = details && !Array.isArray(details) && details.fieldErrors && typeof details.fieldErrors === "object"
      ? details.fieldErrors
      : details;
    throw new ApiClientError(
      payload?.error?.message ?? (response.status >= 500
        ? "The service is temporarily unavailable. Please try again."
        : "The request could not be completed."),
      response.status,
      normalizeFieldErrors(payload?.error?.fieldErrors ?? rawDetails),
      payload?.error?.code,
      payload?.error?.code === "LISTING_CONTENT_REJECTED" && details && !Array.isArray(details) && Array.isArray(details.issues)
        ? details.issues : [],
      details && !Array.isArray(details) && typeof details.attemptId === "string" ? details.attemptId : undefined,
    );
  }
  return payload.data as T;
}
