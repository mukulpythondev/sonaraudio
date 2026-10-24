import { describe, expect, it } from "vitest";
import {
  characterCount, directedText, MAX_CHARACTERS, parseSpeechInput, PHRASES,
  speechKey, textError, TONES, type SpeechInput,
} from "../src/lib/speech";

const base: SpeechInput = { text: "Please let me finish.", tone: "calm", strength: "subtle", variant: "expressive" };

describe("phrase validation", () => {
  it("accepts the exact character boundary and rejects one beyond", () => {
    expect(textError("a".repeat(MAX_CHARACTERS))).toBeNull();
    expect(textError("a".repeat(MAX_CHARACTERS + 1))).toContain("280");
  });
  it("counts Unicode code points, including emoji", () => {
    expect(characterCount("👋")).toBe(1);
    expect(textError("👋".repeat(280))).toBeNull();
    expect(textError("👋".repeat(281))).not.toBeNull();
  });
  it.each(["", "  ", "[angry] hello", "<|speaker:0|> hello", "hello\u0000"])("rejects invalid text %j", (text) => {
    expect(textError(text)).not.toBeNull();
  });
  it("accepts Hindi and natural punctuation", () => {
    for (const text of [...PHRASES.en, ...PHRASES.hi]) expect(textError(text)).toBeNull();
  });
  it("rejects malformed payloads and unsupported controls", () => {
    for (const value of [null, [], "text", {}, { ...base, text: 2 }, { ...base, tone: "angry" },
      { ...base, strength: "maximum" }, { ...base, variant: "fake" }]) {
      expect(parseSpeechInput(value).ok).toBe(false);
    }
  });
  it("trims the input without rewriting its words", () => {
    expect(parseSpeechInput({ ...base, text: "  My exact words!  " })).toEqual({
      ok: true, input: { ...base, text: "My exact words!" },
    });
  });
});

describe("delivery and comparison", () => {
  it("sends neutral text without an expression cue", () => {
    expect(directedText({ ...base, variant: "neutral" })).toBe(base.text);
  });
  it("preserves the exact phrase after a separate delivery cue for every tone and strength", () => {
    for (const tone of TONES) {
      for (const strength of ["subtle", "expressive"] as const) {
        const result = directedText({ ...base, tone: tone.id, strength });
        expect(result).toContain(tone.cue);
        expect(result).toMatch(new RegExp(`\\] ${base.text.replace(".", "\\.")}$`));
      }
    }
  });
  it("keeps distinct clip identities for every generation input", () => {
    const variants = [base, { ...base, variant: "neutral" as const }, { ...base, tone: "warm" as const },
      { ...base, strength: "expressive" as const }, { ...base, text: "Different." }];
    expect(new Set(variants.map(speechKey)).size).toBe(variants.length);
  });
});
