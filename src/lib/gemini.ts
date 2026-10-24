export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  if (!/^[a-z0-9][a-z0-9.-]{0,79}$/u.test(model)) {
    return { ready: false as const, message: "GEMINI_MODEL must be a valid model ID, not a URL." };
  }
  if (!apiKey) return { ready: false as const, message: "Set GEMINI_API_KEY and restart to generate scripts. The original editable script works without it." };
  return { ready: true as const, apiKey, model };
}
