import type {ZodType} from "zod";
import {ApiError} from "../utils/api-error.js";

export function parseInput<T>(schema: ZodType<T, any, any>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    (fields[key] ??= []).push(issue.message);
  }
  throw new ApiError(422, "VALIDATION_ERROR", "Check the highlighted fields.", fields);
}
