export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details = {}, technicalDetails = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.technicalDetails = technicalDetails;
  }
}

export function toPublicAiError(error) {
  const internalCode = error?.code || "INTERNAL_ERROR";
  const isUnderDevelopment = ["AI_NOT_CONFIGURED", "AI_AUTH_INVALID"].includes(internalCode);
  const isMissingInput = internalCode === "MISSING_AI_INPUT";

  if (isUnderDevelopment) {
    return {
      code: "AI_UNDER_DEVELOPMENT",
      message: "This AI feature is currently under development.",
      retryable: false,
    };
  }

  if (isMissingInput) {
    return {
      code: internalCode,
      message: error.message,
      retryable: false,
    };
  }

  return {
    code: "AI_UNAVAILABLE",
    message: "AI feature is temporarily unavailable.",
    retryable: true,
  };
}

export function normalizeProviderError(error, providerName) {
  const technicalMessage = error?.technicalDetails?.technicalMessage
    || error?.message
    || "Transcript provider failed without an error message.";
  const lowerMessage = technicalMessage.toLowerCase();
  const errorName = error?.name || "Error";

  const failure = (code, message, retryable = false) => ({
    provider: providerName,
    code,
    message,
    retryable,
    technicalMessage,
    errorName,
  });

  if (errorName === "YoutubeTranscriptTooManyRequestError"
    || lowerMessage.includes("too many requests")
    || lowerMessage.includes("captcha")
    || lowerMessage.includes("status code 429")
    || lowerMessage.includes("unusual traffic")) {
    return failure(
      "PROVIDER_BLOCKED",
      "YouTube is temporarily limiting transcript requests from this server.",
      true,
    );
  }

  if (errorName === "YoutubeTranscriptVideoUnavailableError") {
    return failure("VIDEO_UNAVAILABLE", "This YouTube video is unavailable.");
  }

  if (errorName === "YoutubeTranscriptNotAvailableLanguageError") {
    return failure(
      "CAPTIONS_LANGUAGE_UNAVAILABLE",
      "Captions are not available in the requested language.",
    );
  }

  if (errorName === "YoutubeTranscriptDisabledError"
    || errorName === "YoutubeTranscriptNotAvailableError"
    || lowerMessage.includes("captions are disabled")
    || lowerMessage.includes("transcript is not available")
    || lowerMessage.includes("no captions")) {
    return failure("CAPTIONS_UNAVAILABLE", "No captions are available for this video.");
  }

  if (lowerMessage.includes("econnreset")
    || lowerMessage.includes("enotfound")
    || lowerMessage.includes("network")
    || lowerMessage.includes("fetch failed")
    || lowerMessage.includes("socket")
    || lowerMessage.includes("timeout")) {
    return failure(
      "PROVIDER_NETWORK_ERROR",
      "The transcript provider could not reach YouTube.",
      true,
    );
  }

  if (error instanceof AppError) {
    return failure(error.code, error.message, error.statusCode >= 500);
  }

  return failure(
    "PROVIDER_FAILED",
    "The transcript provider failed unexpectedly.",
    true,
  );
}

export function toPublicProviderFailure(failure) {
  return {
    provider: failure.provider,
    code: failure.code,
    message: failure.message,
    retryable: failure.retryable,
  };
}

export function createTranscriptError(providerFailures) {
  const publicFailures = providerFailures.map(toPublicProviderFailure);
  const transcriptProviderFailures = providerFailures.filter(
    (failure) => failure.provider !== "gemini-video-fallback",
  );
  const decisiveFailures = transcriptProviderFailures.length > 0
    ? transcriptProviderFailures
    : providerFailures;
  const details = { providerFailures: publicFailures };
  const technicalDetails = {
    providerFailures: providerFailures.map((failure) => ({
      provider: failure.provider,
      code: failure.code,
      errorName: failure.errorName,
      technicalMessage: failure.technicalMessage,
    })),
  };

  if (decisiveFailures.length === 0) {
    return new AppError(
      "No transcript providers are configured.",
      503,
      "NO_TRANSCRIPT_PROVIDERS",
      details,
      technicalDetails,
    );
  }

  if (decisiveFailures.every((failure) => [
    "CAPTIONS_UNAVAILABLE",
    "CAPTIONS_LANGUAGE_UNAVAILABLE",
    "VIDEO_UNAVAILABLE",
  ].includes(failure.code))) {
    const videoUnavailable = decisiveFailures.some((failure) => failure.code === "VIDEO_UNAVAILABLE");
    return new AppError(
      videoUnavailable ? "This YouTube video is unavailable." : "No captions are available for this video.",
      404,
      videoUnavailable ? "VIDEO_UNAVAILABLE" : "CAPTIONS_UNAVAILABLE",
      details,
      technicalDetails,
    );
  }

  if (decisiveFailures.some((failure) => failure.code === "PROVIDER_BLOCKED")) {
    return new AppError(
      "YouTube is temporarily limiting transcript requests. Please try again later.",
      503,
      "TRANSCRIPT_PROVIDER_BLOCKED",
      details,
      technicalDetails,
    );
  }

  if (decisiveFailures.some((failure) => failure.code === "PROVIDER_NETWORK_ERROR")) {
    return new AppError(
      "The transcript service could not reach YouTube. Please try again later.",
      503,
      "TRANSCRIPT_PROVIDER_NETWORK_ERROR",
      details,
      technicalDetails,
    );
  }

  return new AppError(
    "The transcript provider failed. Please try again later.",
    502,
    "TRANSCRIPT_PROVIDER_FAILED",
    details,
    technicalDetails,
  );
}
