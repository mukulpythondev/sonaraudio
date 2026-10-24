import { sceneFishConfig } from "@/lib/fish-config";
import { BodyLimitError, boundedBytes, failure, requestGuard } from "@/lib/http";
import { parseSceneSpeech, sceneDirection } from "@/lib/scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guarded = requestGuard(request);
  if (guarded) return guarded;
  let input;
  try {
    input = parseSceneSpeech(JSON.parse(new TextDecoder().decode(await boundedBytes(request.body, 4096))));
  } catch (error) {
    return failure(error instanceof BodyLimitError ? "Request is too large." : "Invalid scene line. Use a speaker, setting, tone, and text up to 280 characters without markup.", error instanceof BodyLimitError ? 413 : 400);
  }
  const config = sceneFishConfig();
  if (!config.ready) return failure(config.message, 503);
  const timeout = AbortSignal.timeout(45_000);
  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST", headers: {
        Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", model: "drama-3",
      },
      body: JSON.stringify({
        text: sceneDirection(input), reference_id: config.voices[input.speaker],
        format: "mp3", mp3_bitrate: 128, latency: "normal", temperature: 0.7, top_p: 0.7, normalize: true,
      }),
      signal: AbortSignal.any([timeout, request.signal]), cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.error(`[SonarAudio] Scene TTS HTTP ${response.status}.`);
      const messages: Record<number, string> = {
        401: "Fish rejected the API key.", 403: "Check Drama 3 access and voice permissions.",
        402: "Fish credits are unavailable.", 429: "Fish rate limit reached. Wait and retry.",
      };
      return failure(messages[response.status] || "Fish could not generate the scene line. Retry manually.", response.status === 429 ? 429 : 502);
    }
    const contentType = response.headers.get("content-type")?.split(";")[0].trim();
    if (!["audio/mpeg", "audio/mp3", "application/octet-stream"].includes(contentType || "")) {
      await response.body?.cancel();
      console.error("[SonarAudio] Unexpected scene audio type.");
      return failure("Fish returned an unexpected audio format.", 502);
    }
    const audio = await boundedBytes(response.body, 8 * 1024 * 1024);
    if (!audio.length) return failure("Fish returned an empty clip.", 502);
    return new Response(audio, { headers: {
      "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("[SonarAudio] Scene TTS did not complete.");
    if (request.signal.aborted) return failure("Generation cancelled.", 499);
    if (timeout.aborted) return failure("Fish timed out after 45 seconds. Retry this line.", 504);
    return failure(error instanceof BodyLimitError ? "Clip exceeds the 8 MiB limit." : "Could not reach Fish Audio. Retry this line.", 502);
  }
}
