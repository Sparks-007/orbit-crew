import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@/lib/contracts/api";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/**
 * Typed API error. Thrown by services/guards and converted to a consistent
 * JSON envelope by handleRoute().
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }

  static unauthorized(message = "Authentication required."): ApiError {
    return new ApiError("UNAUTHORIZED", message);
  }
  static forbidden(
    message = "You do not have permission to perform this action."
  ): ApiError {
    return new ApiError("FORBIDDEN", message);
  }
  static notFound(message = "Resource not found."): ApiError {
    return new ApiError("NOT_FOUND", message);
  }
  static conflict(message: string): ApiError {
    return new ApiError("CONFLICT", message);
  }
  static badRequest(message = "Malformed request."): ApiError {
    return new ApiError("BAD_REQUEST", message);
  }
  static rateLimited(
    message = "Too many requests. Please try again later."
  ): ApiError {
    return new ApiError("RATE_LIMITED", message);
  }
}

export function errorResponse(
  code: ApiErrorCode,
  message: string
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: STATUS_BY_CODE[code] }
  );
}
