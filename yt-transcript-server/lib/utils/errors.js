export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function normalizeProviderError(error, providerName) {
  const message = error?.message || "Transcript provider failed.";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("disabled")) {
    return {
      provider: providerName,
      code: "CAPTIONS_DISABLED",
      message: "Captions are disabled for this video.",
    };
  }

  if (lowerMessage.includes("unavailable")) {
    return {
      provider: providerName,
      code: "TRANSCRIPT_UNAVAILABLE",
      message: "Transcript is unavailable from this provider.",
    };
  }

  if (lowerMessage.includes("too many")) {
    return {
      provider: providerName,
      code: "RATE_LIMITED",
      message: "Transcript provider is rate limited.",
    };
  }

  return {
    provider: providerName,
    code: "PROVIDER_FAILED",
    message,
  };
}
