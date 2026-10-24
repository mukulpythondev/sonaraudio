import { describe, expect, it } from "vitest";
import { clipKey, ENVIRONMENTS, ORIGINAL_SCENE, parseScene, parseSceneSpeech, sceneDirection } from "../src/lib/scene";

describe("scene contract", () => {
  it("accepts the original scene and strips unexpected properties", () => {
    expect(parseScene({ ...ORIGINAL_SCENE, unexpected: "ignored" })).toEqual(ORIGINAL_SCENE);
  });
  it("rejects malformed trees, too many lines, and stage markup", () => {
    for (const value of [
      null, {}, { ...ORIGINAL_SCENE, title: "" }, { ...ORIGINAL_SCENE, branches: [] },
      { ...ORIGINAL_SCENE, intro: Array(41).fill(ORIGINAL_SCENE.intro[0]) },
      { ...ORIGINAL_SCENE, intro: [{ speaker: "c", tone: "warm", text: "Hi" }, ORIGINAL_SCENE.intro[0]] },
      { ...ORIGINAL_SCENE, branches: [{ label: "one", lines: ORIGINAL_SCENE.intro }, { label: "[bad]", lines: ORIGINAL_SCENE.intro }] },
      { ...ORIGINAL_SCENE, intro: [{ speaker: "a", tone: "warm", text: "[shout] Hi" }, ORIGINAL_SCENE.intro[0]] },
    ]) expect(() => parseScene(value)).toThrow();
  });
  it("rejects invalid per-line generation controls", () => {
    const base = { ...ORIGINAL_SCENE.intro[0], environment: "studio" };
    for (const value of [null, { ...base, environment: "unknown" }, { ...base, speaker: "c" },
      { ...base, text: "a".repeat(281) }, { ...base, text: "<whisper>inject</whisper>" }]) {
      expect(() => parseSceneSpeech(value)).toThrow();
    }
  });
  it("preserves words and changes direction and cache identity for every environment", () => {
    const keys = ENVIRONMENTS.map((environment) => {
      const input = parseSceneSpeech({ ...ORIGINAL_SCENE.intro[0], environment: environment.id });
      const directed = sceneDirection(input);
      expect(directed).toContain(environment.cue);
      expect(directed.endsWith(`] ${ORIGINAL_SCENE.intro[0].text}`)).toBe(true);
      return clipKey(input);
    });
    expect(new Set(keys).size).toBe(3);
    const base = parseSceneSpeech({ ...ORIGINAL_SCENE.intro[0], environment: "studio" });
    expect(clipKey(base)).not.toBe(clipKey({ ...base, speaker: "b" }));
    expect(clipKey(base)).not.toBe(clipKey({ ...base, tone: "calm" }));
  });
});
