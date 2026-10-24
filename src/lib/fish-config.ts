export const FISH_MODELS = ["drama-3", "s2.1-pro-free", "s2.1-pro", "s2-pro"] as const;
export type FishModel = (typeof FISH_MODELS)[number];

function fishApiKey(): string | undefined {
  return process.env.FISH_API_KEY?.trim() || process.env.FISH_AUDIO_KEY?.trim();
}

export function fishConfig():
  | { ready: true; apiKey: string; referenceId: string; model: FishModel }
  | { ready: false; message: string } {
  const apiKey = fishApiKey();
  const referenceId = process.env.FISH_REFERENCE_ID?.trim();
  const model = process.env.FISH_MODEL?.trim() || "s2.1-pro-free";
  if (!FISH_MODELS.some((item) => item === model)) {
    return { ready: false, message: "FISH_MODEL must be drama-3, s2.1-pro-free, s2.1-pro, or s2-pro. No model fallback is used." };
  }

  if (!apiKey || !referenceId) {
    return { ready: false, message: "Add FISH_API_KEY and FISH_REFERENCE_ID to .env.local, then restart the server to enable Fish Audio." };
  }
  const supported = FISH_MODELS.find((item) => item === model);
  if (!supported) throw new Error("Unsupported Fish model configuration.");
  return { ready: true, apiKey, referenceId, model: supported };
}

export function sceneFishConfig() {
  const apiKey = fishApiKey();
  const voiceA = process.env.FISH_VOICE_A?.trim();
  const voiceB = process.env.FISH_VOICE_B?.trim();
  if (!apiKey || !voiceA || !voiceB) {
    return { ready: false as const, message: "Set FISH_API_KEY, FISH_VOICE_A, and FISH_VOICE_B in your server environment, then restart. Use two authorized voice IDs." };
  }
  if (voiceA === voiceB) {
    return { ready: false as const, message: "Choose two different authorized voice IDs for the two characters." };
  }
  return { ready: true as const, apiKey, voices: { a: voiceA, b: voiceB }, model: "drama-3" as const };
}
