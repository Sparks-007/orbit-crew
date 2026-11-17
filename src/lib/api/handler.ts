import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { ApiError, errorResponse } from "./errors";

/**
 * Wraps a route handler body with consistent error handling.
 * - ApiError       -> typed JSON envelope with correct status
 * - Zod error      -> 422 VALIDATION_ERROR envelope
 * - anything else  -> 500 INTERNAL_ERROR (details logged, never leaked)
 */
export async function handleRoute(
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.code, error.message);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "issues" in error &&
      Array.isArray((error as { issues: unknown[] }).issues)
    ) {
      const issues = (
        error as { issues: Array<{ path: PropertyKey[]; message: string }> }
      ).issues;
      const first = issues[0];
      const field = first
        ? first.path.map(String).join(".") || "input"
        : "input";
      const message = first
        ? `${field}: ${first.message}`
        : "Invalid input.";
      return errorResponse("VALIDATION_ERROR", message);
    }
    console.error(
      "[api] unhandled error:",
      error instanceof Error ? error.stack : String(error)
    );
    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

/**
 * Parses and validates a JSON request body against a Zod schema.
 * Throws ApiError(BAD_REQUEST | VALIDATION_ERROR) on failure.
 */
export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first
      ? first.path.map(String).join(".") || "input"
      : "input";
    throw new ApiError(
      "VALIDATION_ERROR",
      first ? `${field}: ${first.message}` : "Invalid input."
    );
  }
  return result.data;
}
