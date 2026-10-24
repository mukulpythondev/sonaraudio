import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/speech/route";
import { fishConfig } from "../src/lib/fish-config";

const body = { text: "Hello there.", tone: "warm", strength: "subtle", variant: "expressive" };
const fetchMock = vi.fn<typeof fetch>();

function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", ...headers },
    body: JSON.stringify(value),
  });
}

beforeEach(() => {
  vi.stubEnv("FISH_API_KEY", "test-server-secret");
  vi.stubEnv("FISH_AUDIO_KEY", "");
  vi.stubEnv("FISH_REFERENCE_ID", "authorized-test-voice");
  vi.stubEnv("FISH_MODEL", "s2.1-pro-free");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("server configuration", () => {
  it("refuses unknown model names instead of provider fallback", () => {
    vi.stubEnv("FISH_MODEL", "typo");
    expect(fishConfig().ready).toBe(false);
  });
  it("defaults to the documented development model", () => {
    vi.stubEnv("FISH_MODEL", "");
    const config = fishConfig();
    expect(config.ready && config.model).toBe("s2.1-pro-free");
  });
});

describe("speech endpoint", () => {
  it("sends server credentials and voice to Fish, returns audio without caching", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([73, 68, 51, 1]), { headers: { "Content-Type": "audio/mpeg" } }));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([73, 68, 51, 1]));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.fish.audio/v1/tts");
    expect(options?.headers).toEqual({
      Authorization: "Bearer test-server-secret", "Content-Type": "application/json", model: "s2.1-pro-free",
    });
    expect(JSON.parse(String(options?.body))).toMatchObject({
      reference_id: "authorized-test-voice", format: "mp3",
      text: "[warm and friendly, with subtle expression] Hello there.",
    });
  });
  it("keeps comparison generation settings equal except the delivery cue", async () => {
    fetchMock.mockImplementation(async () => new Response(new Uint8Array([1]), { headers: { "Content-Type": "audio/mpeg" } }));
    await POST(request());
    await POST(request({ ...body, variant: "neutral" }));
    const expressive = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const neutral = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(neutral.text).toBe(body.text);
    expect({ ...expressive, text: undefined }).toEqual({ ...neutral, text: undefined });
  });
  it("rejects cross-origin requests without spending credits", async () => {
    expect((await POST(request(body, { Origin: "https://other.example" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts the browser-facing host when Next normalizes the internal hostname", async () => {
    vi.stubEnv("FISH_API_KEY", "");
    const response = await POST(request(body, {
      Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000",
    }));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires JSON and validates inputs before spending credits", async () => {
    expect((await POST(request(body, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect((await POST(request({ ...body, text: "x".repeat(281) }))).status).toBe(400);
    expect((await POST(request({ ...body, text: "[angry] injection" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects malformed and oversized JSON", async () => {
    const malformed = new Request("http://localhost:3000/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(request({ ...body, text: "x".repeat(5000) }))).status).toBe(413);
  });
  it("reports missing credentials instead of simulating success", async () => {
    vi.stubEnv("FISH_API_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("test-server-secret");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    [401, 502, "rejected"], [403, 502, "rejected"], [402, 502, "credits"],
    [429, 429, "rate-limiting"], [503, 502, "could not generate"],
  ])("maps upstream %i to %i with useful feedback", async (upstream, expected, message) => {
    fetchMock.mockResolvedValueOnce(new Response("private provider details", { status: upstream }));
    const response = await POST(request());
    expect(response.status).toBe(expected);
    const payload = await response.text();
    expect(payload).toContain(message);
    expect(payload).not.toContain("private provider details");
  });
  it("rejects success-shaped JSON or empty audio", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    expect((await POST(request())).status).toBe(502);
    fetchMock.mockResolvedValueOnce(new Response(null, { headers: { "Content-Type": "audio/mpeg" } }));
    expect((await POST(request())).status).toBe(502);
  });
  it("bounds upstream audio size", async () => {
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { "Content-Type": "audio/mpeg" } }));
    expect((await POST(request())).status).toBe(502);
  });
  it("surfaces network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("Check your connection");
  });
  it("supports client cancellation", async () => {
    const controller = new AbortController();
    const req = new Request(request(), { signal: controller.signal });
    controller.abort();
    fetchMock.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));
    expect((await POST(req)).status).toBe(499);
  });
  it("times out with explicit retry guidance", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });
    fetchMock.mockImplementationOnce((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")));
    }));
    const pending = POST(request());
    await vi.advanceTimersByTimeAsync(45_001);
    expect((await pending).status).toBe(504);
    vi.useRealTimers();
  });
});
