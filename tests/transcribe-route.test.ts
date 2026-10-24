import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/transcribe/route";
import { cloudflareConfig } from "../src/lib/cloudflare";
import { AUDIO_TRANSPORT_MESSAGE, MAX_AUDIO_BYTES } from "../src/lib/audio-import";

vi.mock("../src/lib/cloudflare", () => ({ cloudflareConfig: vi.fn() }));
const fetchMock = vi.fn<typeof fetch>();
const configMock = vi.mocked(cloudflareConfig);
const crossOriginHeaders: Record<string, string>[] = [
  { Origin: "https://other.example" }, { Origin: "null" }, { "sec-fetch-site": "cross-site" },
];

function request(body: BodyInit = new Uint8Array([1, 2, 3]), headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/transcribe", {
    method: "POST",
    headers: { Origin: "http://localhost:3000", "Content-Type": "audio/mpeg", "X-Audio-Consent": "true", ...headers },
    body,
  });
}

beforeEach(() => {
  configMock.mockReturnValue({ ready: true, apiToken: "private-token", accountId: "a".repeat(32), model: "@cf/meta/llama-3.1-8b-instruct" });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("bounded transcription endpoint", () => {
  it("fails closed instead of guessing an undocumented paid Nova REST request", async () => {
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: AUDIO_TRANSPORT_MESSAGE });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports configuration absence without leaking credentials", async () => {
    configMock.mockReturnValue({ ready: false, message: "Configure Cloudflare." });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Configure Cloudflare." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(crossOriginHeaders)("rejects cross-origin uploads", async (headers) => {
    expect((await POST(request(undefined, headers))).status).toBe(403);
    expect(configMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts the browser-facing Host after Next normalizes its URL", async () => {
    const response = await POST(request(undefined, { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" }));
    expect(response.status).toBe(503);
    expect(configMock).toHaveBeenCalledOnce();
  });
  it.each(["application/json", "multipart/form-data", "application/octet-stream", "video/mp4"])("rejects %s before any provider call", async (type) => {
    expect((await POST(request(undefined, { "Content-Type": type }))).status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires explicit upload permission", async () => {
    expect((await POST(request(undefined, { "X-Audio-Consent": "" }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("bounds declared and actual body sizes, never trusting Content-Length alone", async () => {
    expect((await POST(request(undefined, { "Content-Length": String(MAX_AUDIO_BYTES + 1) }))).status).toBe(413);
    expect((await POST(request(new Uint8Array(MAX_AUDIO_BYTES + 1), { "Content-Length": "1" }))).status).toBe(413);
    expect((await POST(request(new Uint8Array(MAX_AUDIO_BYTES)))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects empty input and unreadable streams without raw errors", async () => {
    expect((await POST(request(new Uint8Array(0)))).status).toBe(400);
    const req = request();
    vi.spyOn(req, "body", "get").mockReturnValue(new ReadableStream({
      start(controller) { controller.error(new Error("private transcript and token")); },
    }));
    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private");
  });
  it("supports cancellation before reading the upload", async () => {
    const controller = new AbortController();
    controller.abort();
    expect((await POST(new Request(request(), { signal: controller.signal }))).status).toBe(499);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("aborts slow request bodies at 60 seconds without provider retries", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), milliseconds);
      return controller.signal;
    });
    const req = request();
    vi.spyOn(req, "body", "get").mockReturnValue(new ReadableStream());
    const pending = POST(req);
    await vi.advanceTimersByTimeAsync(60_001);
    expect((await pending).status).toBe(504);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
