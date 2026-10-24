import type { SceneLine, Speaker } from "./scene";
import { importTurns } from "./script-import";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_TRANSCRIPT_CHARACTERS = 20_000;
export const MAX_AUDIO_SPEAKERS = 20;
export const MAX_AUDIO_TURNS = 1000;
export const AUDIO_IMPORT_AVAILABLE = false;
export const AUDIO_TRANSPORT_MESSAGE = "Audio upload is unavailable: the Nova-3 public REST binary diarization contract has not been verified. Your current script is unchanged.";
export const AUDIO_ACCEPT = ".mp3,.wav,.ogg,.webm,.flac,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/flac";

const MIME_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg", "application/ogg", "audio/webm", "audio/flac", "audio/x-flac"]);
export interface AudioTurn { speaker: number; text: string }
export interface AudioPreview { turns: AudioTurn[]; speakers: number[] }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function audioContentType(value: string | null): string | null {
  const mime = value?.split(";")[0].trim().toLowerCase();
  return mime && MIME_TYPES.has(mime) ? mime : null;
}

export function audioFileError(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!file.size) return "Choose a nonempty audio file.";
  if (file.size > MAX_AUDIO_BYTES) return "Audio files must be at most 10 MiB.";
  if (!/\.(mp3|wav|ogg|webm|flac)$/iu.test(file.name) || !audioContentType(file.type)) {
    return "Choose an MP3, WAV, OGG, WebM, or FLAC file with a supported audio MIME type.";
  }
  return null;
}

export function validateAudioTurns(value: unknown): AudioPreview {
  if (!Array.isArray(value) || !value.length || value.length > MAX_AUDIO_TURNS) {
    throw new Error("The transcript needs 1–1000 speaker turns.");
  }
  const speakers = new Set<number>();
  let length = 0;
  const turns = value.map((item): AudioTurn => {
    if (!record(item) || !Number.isSafeInteger(item.speaker) || (item.speaker as number) < 0
      || typeof item.text !== "string" || !item.text.trim()) {
      throw new Error("Every transcript turn needs an anonymous speaker number and nonempty text.");
    }
    const text = item.text.trim();
    length += text.length + (length ? 1 : 0);
    if (length > MAX_TRANSCRIPT_CHARACTERS) throw new Error("The transcript exceeds 20,000 characters. Use a shorter recording.");
    speakers.add(item.speaker as number);
    if (speakers.size > MAX_AUDIO_SPEAKERS) throw new Error("The recording exceeds 20 detected speakers.");
    return { speaker: item.speaker as number, text };
  });
  return { turns, speakers: [...speakers] };
}

export function parseNovaEnvelope(value: unknown): AudioPreview {
  if (!record(value) || value.success !== true || !Array.isArray(value.errors) || value.errors.length
    || !record(value.result) || !record(value.result.results)) {
    throw new Error("Cloudflare returned an invalid transcription envelope.");
  }
  const channels = value.result.results.channels;
  if (!Array.isArray(channels) || channels.length !== 1 || !record(channels[0])) {
    throw new Error("Expected one mixed audio channel in the transcription.");
  }
  const alternatives = channels[0].alternatives;
  if (!Array.isArray(alternatives) || !record(alternatives[0])) throw new Error("No transcription alternative was returned.");
  const words = alternatives[0].words;
  if (!Array.isArray(words) || !words.length || words.length > MAX_TRANSCRIPT_CHARACTERS) {
    throw new Error("No bounded word-level transcript was returned.");
  }
  const turns: AudioTurn[] = [];
  let length = 0;
  for (const item of words) {
    if (!record(item) || !Number.isSafeInteger(item.speaker) || (item.speaker as number) < 0) {
      throw new Error("Word-level speaker diarization is missing or invalid.");
    }
    const word = item.punctuated_word ?? item.word;
    if (typeof word !== "string" || !word.trim()) throw new Error("The transcription contains an invalid word.");
    const text = word.trim();
    length += text.length + (length ? 1 : 0);
    if (length > MAX_TRANSCRIPT_CHARACTERS) throw new Error("The transcript exceeds 20,000 characters. Use a shorter recording.");
    const last = turns[turns.length - 1];
    if (last?.speaker === item.speaker) last.text += ` ${text}`;
    else turns.push({ speaker: item.speaker as number, text });
    if (turns.length > MAX_AUDIO_TURNS) throw new Error("The transcript exceeds 1000 speaker turns.");
  }
  return validateAudioTurns(turns);
}

export function prepareAudioImport(turns: AudioTurn[], mapping: Record<number, string>, mergesReviewed: boolean): SceneLine[] {
  const preview = validateAudioTurns(turns);
  for (const speaker of preview.speakers) {
    if (mapping[speaker] !== "a" && mapping[speaker] !== "b") throw new Error("Map every detected speaker to Speaker 1 or Speaker 2.");
  }
  const mapped = preview.speakers.map((speaker) => mapping[speaker]);
  if (new Set(mapped).size < mapped.length && !mergesReviewed) {
    throw new Error("Review and confirm the merge of multiple detected speakers into the same studio speaker.");
  }
  return importTurns(preview.turns.map((turn) => ({ speaker: mapping[turn.speaker] as Speaker, text: turn.text })));
}
