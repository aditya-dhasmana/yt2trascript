const ACTION_LABELS = {
  clean: "Clean transcript",
  summary: "Summary",
  notes: "Notes",
};

export function getFriendlyAiFailureMessage(action, code = "AI_UNAVAILABLE") {
  const label = ACTION_LABELS[action] || "AI helper";

  if (code === "AI_UNDER_DEVELOPMENT") {
    return `${label} is under development right now. Raw transcript is safe and ready.`;
  }

  return `${label} is temporarily unavailable. Raw transcript is safe and ready.`;
}

export function createAiFailureState({ action, code, rawText }) {
  return {
    activeOutput: { kind: "raw", text: rawText },
    message: getFriendlyAiFailureMessage(action, code),
  };
}
