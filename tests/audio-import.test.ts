import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_BYTES, MAX_AUDIO_TURNS, audioContentType, audioFileError,
  parseNovaEnvelope, prepareAudioImport, validateAudioTurns,
} from "../src/lib/audio-import";

function envelope(words: unknown[]) {
  return { success: true, errors: [], result: { results: { channels: [{ alternatives: [{ words }] }] } } };
}

describe("audio input limits", () => {
  it.each(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/flac"])("accepts %s", (mime) => {
    expect(audioContentType(`${mime}; codecs=opus`)).toBe(mime);
  });
  it("rejects multipart, generic binary and unsupported content types", () => {
    for (const mime of [null, "application/octet-stream", "multipart/form-data", "video/mp4", "audio/mpeg-fake"]) {
      expect(audioContentType(mime)).toBeNull();
    }
  });
  it("validates file extension, MIME and exact byte limits", () => {
    expect(audioFileError({ name: "sample.MP3", type: "audio/mpeg", size: MAX_AUDIO_BYTES })).toBeNull();
    expect(audioFileError({ name: "sample.mp3", type: "audio/mpeg", size: MAX_AUDIO_BYTES + 1 })).toContain("10 MiB");
    expect(audioFileError({ name: "sample.mp3", type: "audio/mpeg", size: 0 })).toContain("nonempty");
    expect(audioFileError({ name: "sample.exe", type: "audio/mpeg", size: 1 })).toContain("supported");
    expect(audioFileError({ name: "sample.mp3", type: "", size: 1 })).toContain("supported");
  });
});

describe("Nova diarization parsing", () => {
  it("uses speaker zero, punctuated words and consecutive runs without reordering", () => {
    const parsed = parseNovaEnvelope(envelope([
      { speaker: 0, word: "hello", punctuated_word: "Hello," },
      { speaker: 0, word: "there", punctuated_word: "there." },
      { speaker: 3, word: "Yes!" },
      { speaker: 0, word: "Again." },
    ]));
    expect(parsed).toEqual({
      speakers: [0, 3],
      turns: [{ speaker: 0, text: "Hello, there." }, { speaker: 3, text: "Yes!" }, { speaker: 0, text: "Again." }],
    });
  });
  it.each([
    null, {}, { success: false, errors: [], result: {} },
    { success: true, errors: [{ message: "private detail" }], result: {} },
    { success: true, result: {} },
    { success: true, errors: [], result: { results: { channels: [] } } },
    envelope([]), envelope([{ word: "No speaker." }]), envelope([{ speaker: -1, word: "Bad." }]),
    envelope([{ speaker: "0", word: "Bad." }]), envelope([{ speaker: 0.5, word: "Bad." }]),
    envelope([{ speaker: 0, word: "" }]), envelope([{ speaker: 0, word: "fine", punctuated_word: 7 }]),
  ])("rejects malformed or non-diarized responses", (value) => {
    expect(() => parseNovaEnvelope(value)).toThrow();
  });
  it("rejects extra channels rather than silently discarding speech", () => {
    const value = envelope([{ speaker: 0, word: "Hello." }]);
    value.result.results.channels.push({ alternatives: [{ words: [{ speaker: 1, word: "Other channel." }] }] });
    expect(() => parseNovaEnvelope(value)).toThrow("one mixed");
  });
  it("enforces transcript, speaker and turn limits without truncation", () => {
    expect(validateAudioTurns([{ speaker: 0, text: "x".repeat(20_000) }]).turns[0].text).toHaveLength(20_000);
    expect(() => parseNovaEnvelope(envelope([{ speaker: 0, word: "x".repeat(20_001) }]))).toThrow("20,000");
    expect(() => parseNovaEnvelope(envelope(Array.from({ length: 21 }, (_, speaker) => ({ speaker, word: "Hi" }))))).toThrow("20 detected");
    expect(() => validateAudioTurns(Array.from({ length: MAX_AUDIO_TURNS + 1 }, () => ({ speaker: 0, text: "Hi" })))).toThrow("1000");
    expect(() => validateAudioTurns([{ speaker: Number.MAX_SAFE_INTEGER + 1, text: "Hi" }])).toThrow();
  });
});

describe("reviewed audio script application", () => {
  const turns = [{ speaker: 0, text: "Hello there." }, { speaker: 1, text: "Hi again." }];
  it("requires explicit mappings and creates warm lines", () => {
    expect(() => prepareAudioImport(turns, { 0: "a" }, false)).toThrow("Map every");
    expect(() => prepareAudioImport(turns, { 0: "a", 1: "other" }, true)).toThrow("Map every");
    expect(prepareAudioImport(turns, { 0: "b", 1: "a" }, false)).toEqual([
      { speaker: "b", text: "Hello there.", tone: "warm" },
      { speaker: "a", text: "Hi again.", tone: "warm" },
    ]);
  });
  it("requires reviewed merges, including merging two speakers into one", () => {
    expect(() => prepareAudioImport(turns, { 0: "a", 1: "a" }, false)).toThrow("confirm the merge");
    expect(prepareAudioImport(turns, { 0: "a", 1: "a" }, true)).toHaveLength(2);
    const three = [...turns, { speaker: 2, text: "One more." }];
    expect(() => prepareAudioImport(three, { 0: "a", 1: "b", 2: "b" }, false)).toThrow("confirm the merge");
  });
  it("chunks at 280 and rejects over 40 lines or fewer than two", () => {
    const chunked = prepareAudioImport([{ speaker: 0, text: "hello ".repeat(100) }], { 0: "a" }, false);
    expect(chunked.length).toBeGreaterThan(1);
    expect(chunked.every((line) => Array.from(line.text).length <= 280 && line.tone === "warm")).toBe(true);
    expect(() => prepareAudioImport([{ speaker: 0, text: "Only one." }], { 0: "a" }, false)).toThrow("2–40");
    expect(() => prepareAudioImport(Array.from({ length: 41 }, () => ({ speaker: 0, text: "Too many." })), { 0: "a" }, false)).toThrow("2–40");
    expect(() => prepareAudioImport([{ speaker: 0, text: "x".repeat(281) }], { 0: "a" }, false)).toThrow("280");
  });
  it("validates edited transcript before application", () => {
    expect(() => prepareAudioImport([{ speaker: 0, text: " " }], { 0: "a" }, false)).toThrow("nonempty");
    expect(() => prepareAudioImport([{ speaker: 0, text: "x".repeat(20_001) }], { 0: "a" }, false)).toThrow("20,000");
  });
});
