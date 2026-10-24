import { isTone, textError, TONES, type Tone } from "./speech";

export const ENVIRONMENTS = [
  { id: "studio", name: "Podcast studio", subtitle: "Close-mic. Clear. Conversational.", cue: "in a podcast studio, close microphone, clear conversational delivery" },
  { id: "cafe", name: "Corner café", subtitle: "Relaxed. Intimate. A little animated.", cue: "talking to a friend across a small cafe table, relaxed intimate delivery, no background sounds" },
  { id: "campfire", name: "After dark", subtitle: "Unhurried. Reflective. Story-led.", cue: "telling a story beside a campfire, soft reflective delivery with unhurried pacing, no background sounds" },
] as const;
export type Environment = (typeof ENVIRONMENTS)[number]["id"];
export type Speaker = "a" | "b";
export interface SceneLine { speaker: Speaker; text: string; tone: Tone }
export interface SceneBranch { label: string; lines: SceneLine[] }
export interface Scene { title: string; intro: SceneLine[]; branches: SceneBranch[] }
export interface SceneSpeech { text: string; tone: Tone; speaker: Speaker; environment: Environment }
export const MAX_OPENING_LINES = 40;

export function isEnvironment(value: unknown): value is Environment {
  return ENVIRONMENTS.some((item) => item.id === value);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function cleanLabel(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !/[\u0000-\u001f<>[\]]/u.test(value);
}
function line(value: unknown): value is SceneLine {
  return record(value) && (value.speaker === "a" || value.speaker === "b") && isTone(value.tone)
    && typeof value.text === "string" && textError(value.text) === null;
}
function lines(value: unknown, maximum = 4): value is SceneLine[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= maximum && value.every(line);
}
function normalizedLine(item: SceneLine): SceneLine {
  return { speaker: item.speaker, text: item.text.trim(), tone: item.tone };
}
export function parseScene(value: unknown): Scene {
  if (!record(value) || !cleanLabel(value.title, 80) || !lines(value.intro, MAX_OPENING_LINES)
    || !Array.isArray(value.branches) || value.branches.length !== 2) {
    throw new Error(`A scene needs a title, 2–${MAX_OPENING_LINES} valid opening lines, and exactly two branches.`);
  }
  const branches: SceneBranch[] = [];
  for (const branch of value.branches) {
    if (!record(branch) || !cleanLabel(branch.label, 60) || !lines(branch.lines)) {
      throw new Error("Each branch needs a short label and 2–4 valid lines.");
    }
    branches.push({ label: branch.label.trim(), lines: branch.lines.map(normalizedLine) });
  }
  return { title: value.title.trim(), intro: value.intro.map(normalizedLine), branches };
}

export function parseSceneSpeech(value: unknown): SceneSpeech {
  if (!line(value) || !record(value) || !isEnvironment(value.environment)) {
    throw new Error("Choose a speaker, environment, tone, and a valid phrase of up to 280 characters.");
  }
  return { text: value.text.trim(), tone: value.tone, speaker: value.speaker, environment: value.environment };
}

export function sceneDirection(input: SceneSpeech): string {
  const setting = ENVIRONMENTS.find((item) => item.id === input.environment);
  const tone = TONES.find((item) => item.id === input.tone);
  if (!setting || !tone) throw new Error("Unsupported performance direction.");
  return `[${tone.cue}; ${setting.cue}] ${input.text}`;
}
export function clipKey(input: SceneSpeech): string { return JSON.stringify(input); }

export const ORIGINAL_SCENE: Scene = {
  title: "Would you take the scenic route?",
  intro: [
    { speaker: "a", tone: "warm", text: "Welcome to Small Detours. Today: would you let an algorithm plan your whole day?" },
    { speaker: "b", tone: "playful", text: "Only if it schedules time for me to ignore the schedule." },
    { speaker: "a", tone: "confident", text: "It could find the perfect route. But would it leave room for a wrong turn?" },
    { speaker: "b", tone: "warm", text: "Let's ask our listeners. Should we chase efficiency, or leave room for surprise?" },
  ],
  branches: [
    { label: "Make the case for efficiency", lines: [
      { speaker: "a", tone: "confident", text: "Give the routine decisions to the machine. Then spend your attention on something that matters." },
      { speaker: "b", tone: "playful", text: "Deal. It can choose the route. I still choose where we stop for chai." },
    ] },
    { label: "Take the unexpected turn", lines: [
      { speaker: "b", tone: "calm", text: "My favorite place wasn't recommended. I found it because I missed a turn." },
      { speaker: "a", tone: "warm", text: "Then maybe a good plan should leave a little space for getting lost." },
    ] },
  ],
};

const lineSchema = {
  type: "object", properties: {
    speaker: { type: "string", enum: ["a", "b"] },
    text: { type: "string", maxLength: 280 },
    tone: { type: "string", enum: TONES.map((item) => item.id) },
  }, required: ["speaker", "text", "tone"],
};
const linesSchema = { type: "array", minItems: 2, maxItems: 4, items: lineSchema };
export const SCENE_SCHEMA = {
  type: "object", properties: {
    title: { type: "string", maxLength: 80 },
    intro: linesSchema,
    branches: { type: "array", minItems: 2, maxItems: 2, items: {
      type: "object", properties: { label: { type: "string", maxLength: 60 }, lines: linesSchema },
      required: ["label", "lines"],
    } },
  }, required: ["title", "intro", "branches"],
};
