import { ConfigurationError } from "@/lib/env";
import { RateLimitError, SecurityError } from "@/lib/security";

export function describeRequestError(error: unknown) {
  if (error instanceof RateLimitError) {
    return {
      status: 429,
      body: {
        error: "Too many requests",
        code: "rate_limited",
        retryAfterSeconds: error.retryAfterSeconds,
      },
    };
  }

  if (error instanceof SecurityError) {
    return {
      status: 401,
      body: {
        error: "Unauthorized",
        code: "unauthorized",
      },
    };
  }

  if (error instanceof ConfigurationError) {
    return {
      status: 503,
      body: {
        error: error.message,
        code: "service_not_configured",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "Request failed",
      code: "internal_error",
    },
  };
}
