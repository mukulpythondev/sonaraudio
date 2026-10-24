export const MAX_CHARACTERS = 280;
export const TONES = [
  { id: "warm", name: "Warm", hint: "A little kindness", cue: "warm and friendly" },
  { id: "confident", name: "Confident", hint: "Clear, not forceful", cue: "confident and composed" },
  { id: "calm", name: "Calm", hint: "Room to breathe", cue: "calm and reassuring" },
  { id: "playful", name: "Playful", hint: "A smile in your voice", cue: "playful and lighthearted" },
] as const;

export type Tone = (typeof TONES)[number]["id"];
export type Strength = "subtle" | "expressive";
export type Variant = "neutral" | "expressive";
export type Language = "en" | "hi";
export type Mode = "live" | "preview";

export interface SpeechInput {
  text: string;
  tone: Tone;
  strength: Strength;
  variant: Variant;
}

export const PHRASES: Record<Language, readonly string[]> = {
  en: [
    "Please let me finish.",
    "I need a moment.",
    "I'm happy you're here.",
    "Thank you for understanding.",
    "I was only joking.",
    "I'd like to say something.",
  ],
  hi: [
    "कृपया मेरी बात पूरी होने दीजिए।",
    "मुझे थोड़ा वक्त चाहिए।",
    "अच्छा लगा कि तुम आ गए।",
    "मेरी बात समझने के लिए शुक्रिया।",
    "मैं तो बस मज़ाक कर रहा था।",
    "मैं कुछ कहना चाहता हूँ।",
  ],
};

export const DEFAULT_TEXT = "I'm happy you're here.";

export function isTone(value: unknown): value is Tone {
  return TONES.some((tone) => tone.id === value);
}

export function isStrength(value: unknown): value is Strength {
  return value === "subtle" || value === "expressive";
}

export function characterCount(text: string): number {
  return Array.from(text).length;
}

export function textError(text: string): string | null {
  if (!text.trim()) return "Add a few words before speaking.";
  if (characterCount(text) > MAX_CHARACTERS) {
    return `Keep your phrase within ${MAX_CHARACTERS} characters.`;
  }
  if (/[\[\]<>]/u.test(text)) {
    return "Please remove square brackets and angle brackets. Delivery cues are added separately.";
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    return "Please remove unsupported control characters.";
  }
  return null;
}

export function parseSpeechInput(value: unknown):
  | { ok: true; input: SpeechInput }
  | { ok: false; error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Expected a JSON object." };
  }
  if (!("text" in value) || typeof value.text !== "string") {
    return { ok: false, error: "A text phrase is required." };
  }
  const error = textError(value.text);
  if (error) return { ok: false, error };
  if (!("tone" in value) || !isTone(value.tone)) {
    return { ok: false, error: "Choose one of the available tones." };
  }
  if (!("strength" in value) || !isStrength(value.strength)) {
    return { ok: false, error: "Choose subtle or expressive delivery." };
  }
  if (!("variant" in value) || (value.variant !== "neutral" && value.variant !== "expressive")) {
    return { ok: false, error: "Choose neutral or expressive comparison." };
  }
  return {
    ok: true,
    input: {
      text: value.text.trim(),
      tone: value.tone,
      strength: value.strength,
      variant: value.variant,
    },
  };
}

export function directedText(input: SpeechInput): string {
  if (input.variant === "neutral") return input.text;
  const tone = TONES.find((item) => item.id === input.tone);
  if (!tone) throw new Error("Unsupported tone.");
  const instruction = input.strength === "subtle"
    ? `${tone.cue}, with subtle expression`
    : `${tone.cue}, with expressive emphasis`;
  return `[${instruction}] ${input.text}`;
}

export function speechKey(input: SpeechInput): string {
  return JSON.stringify(input);
}
