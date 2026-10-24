import { MAX_OPENING_LINES, type SceneLine, type Speaker } from "./scene";
import { textError } from "./speech";

export const MAX_TEXT_FILE_BYTES = 64 * 1024;

export function importTurns(turns: { speaker: Speaker; text: string }[]): SceneLine[] {
  const result: SceneLine[] = [];
  for (const turn of turns) {
    const words = turn.text.trim().split(/\s+/u).filter(Boolean);
    if (!words.length) throw new Error("Every speaker turn must contain dialogue.");
    let chunk = "";
    for (const word of words) {
      if (Array.from(word).length > 280) throw new Error("A word exceeds the 280-character line limit.");
      if (chunk && Array.from(`${chunk} ${word}`).length > 280) {
        result.push({ speaker: turn.speaker, text: chunk, tone: "warm" });
        chunk = word;
      } else chunk = chunk ? `${chunk} ${word}` : word;
    }
    if (chunk) result.push({ speaker: turn.speaker, text: chunk, tone: "warm" });
  }
  if (result.length < 2 || result.length > MAX_OPENING_LINES) {
    throw new Error(`Import must produce 2–${MAX_OPENING_LINES} lines. Split larger scripts into separate scenes.`);
  }
  for (const item of result) {
    const invalid = textError(item.text);
    if (invalid) throw new Error(invalid);
  }
  return result;
}

export function parseLabeledScript(text: string): SceneLine[] {
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_FILE_BYTES) throw new Error("Text files must be at most 64 KiB.");
  const turns: { speaker: Speaker; text: string }[] = [];
  for (const raw of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const value = raw.trim();
    if (!value) continue;
    const match = /^(speaker\s*[12ab]|speak\s*[12]|akshat|priyanshu|[ab])\s*:\s*(.*)$/iu.exec(value);
    if (match) {
      const label = match[1].toLowerCase().replace(/\s/gu, "");
      turns.push({ speaker: ["speaker1", "speak1", "speakera", "akshat", "a"].includes(label) ? "a" : "b", text: match[2] });
    } else {
      if (/^[^:]{1,60}:/u.test(value) || !turns.length) {
        throw new Error("Use Speaker 1: and Speaker 2: labels (or Akshat/Priyanshu). Only two text speakers are supported.");
      }
      turns[turns.length - 1].text += ` ${value}`;
    }
  }
  return importTurns(turns);
}
