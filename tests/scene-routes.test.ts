import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as scriptPost } from "../src/app/api/scene/route";
import { POST as speechPost } from "../src/app/api/scene-speech/route";
import { sceneFishConfig } from "../src/lib/fish-config";
import { geminiConfig } from "../src/lib/gemini";
import { cloudflareConfig } from "../src/lib/cloudflare";
import { ORIGINAL_SCENE } from "../src/lib/scene";

const fetchMock = vi.fn<typeof fetch>();
const line = { ...ORIGINAL_SCENE.intro[0], environment: "cafe" };
function request(data: unknown, route = "scene", headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000/api/${route}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", ...headers },
    body: JSON.stringify(data),
  });
}
beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
  vi.stubEnv("CLOUDFLARE_MODEL", "");
  vi.stubEnv("GEMINI_API_KEY", "mock-gemini-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
  vi.stubEnv("FISH_API_KEY", "mock-fish-key");
  vi.stubEnv("FISH_AUDIO_KEY", "");
  vi.stubEnv("FISH_VOICE_A", "voice-a");
  vi.stubEnv("FISH_VOICE_B", "voice-b");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Cloudflare script generation", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "mock-workers-token");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "a".repeat(32));
  });
  it.each([ORIGINAL_SCENE, JSON.stringify(ORIGINAL_SCENE)])("validates JSON object and string outputs", async (output) => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, result: { response: output } }));
    const response = await scriptPost(request({ topic: "Taking a detour" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scene: ORIGINAL_SCENE, model: "@cf/meta/llama-3.1-8b-instruct" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${"a".repeat(32)}/ai/run/@cf/meta/llama-3.1-8b-instruct`);
    expect(options?.headers).toMatchObject({ Authorization: "Bearer mock-workers-token" });
    expect(JSON.parse(String(options?.body)).response_format).toEqual({ type: "json_schema", json_schema: expect.any(Object) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects incomplete config without falling back to Gemini", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    expect((await scriptPost(request({ topic: "Hello" }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "../bad");
    expect(cloudflareConfig().ready).toBe(false);
  });
  it.each([403, 429, 500])("surfaces HTTP %i without raw details or retries", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("private", { status }));
    const response = await scriptPost(request({ topic: "Hello" }));
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain("private");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid output and failed envelopes", async () => {
    for (const output of [{ success: false, result: { response: ORIGINAL_SCENE } },
      { success: true, result: { response: {} } }, { success: true, result: { response: "not-json" } }]) {
      fetchMock.mockResolvedValueOnce(Response.json(output));
      expect((await scriptPost(request({ topic: "Hello" }))).status).toBe(502);
    }
  });
  it("bounds output and surfaces connection errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(64 * 1024 + 1)));
    expect((await scriptPost(request({ topic: "Hello" }))).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new TypeError("private network detail"));
    const response = await scriptPost(request({ topic: "Hello" }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("private network detail");
  });
  it("reports request cancellation separately", async () => {
    const abort = new AbortController(); abort.abort();
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    const response = await scriptPost(new Request("http://localhost:3000/api/scene", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "Hello" }), signal: abort.signal,
    }));
    expect(response.status).toBe(499);
  });
});

describe("scene speech", () => {
  it("supports the existing FISH_AUDIO_KEY name and prefers the canonical name", () => {
    vi.stubEnv("FISH_AUDIO_KEY", "mock-alias-key");
    let config = sceneFishConfig();
    expect(config.ready && config.apiKey).toBe("mock-fish-key");
    vi.stubEnv("FISH_API_KEY", "");
    config = sceneFishConfig();
    expect(config.ready && config.apiKey).toBe("mock-alias-key");
  });
  it("requires distinct configured voices", () => {
    vi.stubEnv("FISH_VOICE_B", "voice-a");
    expect(sceneFishConfig().ready).toBe(false);
    vi.stubEnv("FISH_VOICE_B", "");
    expect(sceneFishConfig().ready).toBe(false);
  });
  it.each(["a", "b"] as const)("uses Drama 3 and the correct server-side voice for %s", async (speaker) => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } }));
    const response = await speechPost(request({ ...line, speaker }, "scene-speech"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.arrayBuffer()).toHaveProperty("byteLength", 2);
    const options = fetchMock.mock.calls[0][1];
    expect(options?.headers).toMatchObject({ model: "drama-3", Authorization: "Bearer mock-fish-key" });
    const outbound = JSON.parse(String(options?.body));
    expect(outbound.reference_id).toBe(`voice-${speaker}`);
    expect(outbound.text).toContain("small cafe table");
    expect(outbound.text.endsWith(line.text)).toBe(true);
  });
  it("rejects bad origin, content type, markup, and oversized input before fetching", async () => {
    expect((await speechPost(request(line, "scene-speech", { Origin: "https://other.example" }))).status).toBe(403);
    expect((await speechPost(request(line, "scene-speech", { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await speechPost(request({ ...line, text: "[bad] hi" }))).status).toBe(400);
    expect((await speechPost(request({ ...line, text: "a".repeat(5000) }))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports unavailable configuration", async () => {
    vi.stubEnv("FISH_VOICE_A", "");
    expect((await speechPost(request(line))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 402, 403, 429, 500])("reports Fish %i without upstream details", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("private-error", { status }));
    const response = await speechPost(request(line));
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain("private-error");
  });
  it("rejects non-audio, empty, oversized output and network failures", async () => {
    for (const response of [Response.json({ wrong: true }), new Response(null, { headers: { "Content-Type": "audio/mpeg" } }),
      new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { "Content-Type": "audio/mpeg" } })]) {
      fetchMock.mockResolvedValueOnce(response);
      expect((await speechPost(request(line))).status).toBe(502);
    }
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    expect((await speechPost(request(line))).status).toBe(502);
  });
});

describe("Gemini script generation", () => {
  function success(scene: unknown = ORIGINAL_SCENE, finishReason = "STOP") {
    return Response.json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(scene) }] } }] });
  }
  it("uses structured output and returns a validated scene", async () => {
    fetchMock.mockResolvedValueOnce(success());
    const response = await scriptPost(request({ topic: "A short conversation about taking detours" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scene: ORIGINAL_SCENE, model: "gemini-2.5-flash" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "mock-gemini-key" });
    expect(JSON.parse(String(options?.body)).generationConfig.responseMimeType).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("validates topic, origin, content type and request size", async () => {
    for (const topic of ["", " ", "a".repeat(201), 42]) expect((await scriptPost(request({ topic }))).status).toBe(400);
    expect((await scriptPost(request({ topic: "a".repeat(5000) }))).status).toBe(413);
    expect((await scriptPost(request({ topic: "hi" }, "scene", { Origin: "https://evil.example" }))).status).toBe(403);
    expect((await scriptPost(request({ topic: "hi" }, "scene", { "Content-Type": "text/plain" }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not fake an original script when credentials are missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await scriptPost(request({ topic: "hello" }))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects model URLs and permits explicit model IDs", () => {
    vi.stubEnv("GEMINI_MODEL", "https://wrong.example");
    expect(geminiConfig().ready).toBe(false);
    vi.stubEnv("GEMINI_MODEL", "");
    const config = geminiConfig();
    expect(config.ready && config.model).toBe("gemini-2.5-flash-lite");
  });
  it("uses Flash Lite for scene requests when no model override is configured", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    fetchMock.mockResolvedValueOnce(success());
    const response = await scriptPost(request({ topic: "Taking a scenic detour" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scene: ORIGINAL_SCENE, model: "gemini-2.5-flash-lite" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed, truncated, and blocked generation", async () => {
    for (const response of [success({}, "STOP"), success(ORIGINAL_SCENE, "MAX_TOKENS"), Response.json({ promptFeedback: { blockReason: "SAFETY" } })]) {
      fetchMock.mockResolvedValueOnce(response);
      expect((await scriptPost(request({ topic: "hi" }))).status).toBe(502);
    }
  });
  it("bounds Gemini output", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(64 * 1024 + 1)));
    expect((await scriptPost(request({ topic: "hello" }))).status).toBe(502);
  });
  it.each([401, 403, 429, 500])("surfaces provider %i without exposing its body", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response("private-provider-details", { status }));
    const response = await scriptPost(request({ topic: "hello" }));
    expect(response.status).toBe(status === 429 ? 429 : 502);
    expect(await response.text()).not.toContain("private-provider-details");
  });
  it("reports network errors and cancellation", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network"));
    expect((await scriptPost(request({ topic: "hello" }))).status).toBe(502);
    const abort = new AbortController(); abort.abort();
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    expect((await scriptPost(new Request(request({ topic: "hello" }), { signal: abort.signal }))).status).toBe(499);
  });
  it("reports timeout for both providers", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((duration) => {
      const abort = new AbortController();
      setTimeout(() => abort.abort(), duration);
      return abort.signal;
    });
    fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")));
    }));
    const script = scriptPost(request({ topic: "hi" }));
    await vi.advanceTimersByTimeAsync(40_001);
    expect((await script).status).toBe(504);
    const speech = speechPost(request(line));
    await vi.advanceTimersByTimeAsync(45_001);
    expect((await speech).status).toBe(504);
  });
});
