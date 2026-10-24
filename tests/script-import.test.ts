import { describe, expect, it } from "vitest";
import { importTurns, parseLabeledScript } from "../src/lib/script-import";
import { ORIGINAL_SCENE, parseScene } from "../src/lib/scene";

describe("local text script import", () => {
  it("maps labeled turns and continuation lines without a provider", () => {
    expect(parseLabeledScript("\uFEFFSpeak 1: Hello\r\nthere.\r\n\r\nSpeaker 2: Hi!")).toEqual([
      { speaker: "a", tone: "warm", text: "Hello there." }, { speaker: "b", tone: "warm", text: "Hi!" },
    ]);
    expect(parseLabeledScript("Akshat: Hello\nPriyanshu: Hi")[1].speaker).toBe("b");
    expect(parseLabeledScript("Speaker A: Hello\nB: Hi")[0].speaker).toBe("a");
  });
  it("splits long Unicode turns losslessly at word boundaries", () => {
    const text = Array(100).fill("hello").join(" ");
    const lines = importTurns([{ speaker: "a", text }]);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => Array.from(line.text).length <= 280)).toBe(true);
    expect(lines.map((line) => line.text).join(" ")).toBe(text);
  });
  it.each(["", "unlabeled\nSpeaker 2: Hi", "Speaker 1: Hi\nSpeaker 3: No", "Speaker 1:\nSpeaker 2: Hi", "A: [shout] hi\nB: hi", `A: ${"x".repeat(281)}\nB: hi`, "x".repeat(65537)])("rejects malformed imports", (text) => {
    expect(() => parseLabeledScript(text)).toThrow();
  });
  it("accepts and persists 40 lines but rejects 41", () => {
    const turns = Array.from({ length: 40 }, () => ({ speaker: "a" as const, text: "Hello" }));
    const intro = importTurns(turns);
    expect(parseScene({ ...ORIGINAL_SCENE, intro }).intro).toHaveLength(40);
    expect(() => importTurns([...turns, turns[0]])).toThrow();
    expect(() => parseScene({ ...ORIGINAL_SCENE, branches: [
      { label: "Long ending", lines: intro }, ORIGINAL_SCENE.branches[1],
    ] })).toThrow();
  });
});
