import { fishConfig } from "@/lib/fish-config";
import { directedText, parseSpeechInput } from "@/lib/speech";
import { BodyLimitError, boundedBytes } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TIMEOUT_MS = 45_000;
const MAX_REQUEST_BYTES = 4096;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

function failure(error: string, status: number): Response {
  return Response.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next may normalize the URL hostname; Host retains the browser-facing authority.
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  if (origin && origin !== expectedOrigin) {
    return failure("Cross-origin speech requests are not allowed.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure("Send the phrase as application/json.", 415);
  }

  let data: unknown;
  try {
    const bytes = await boundedBytes(request.body, MAX_REQUEST_BYTES);
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof BodyLimitError) return failure("Request is too large.", 413);
    if (error instanceof SyntaxError) return failure("The request contains invalid JSON.", 400);
    console.error("[SonarAudio] Failed to read speech request.");
    return failure("Could not read the speech request. Please retry.", 400);
  }
  const parsed = parseSpeechInput(data);
  if (!parsed.ok) return failure(parsed.error, 400);
  const config = fishConfig();
  if (!config.ready) return failure(config.message, 503);

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        model: config.model,
      },
      body: JSON.stringify({
        text: directedText(parsed.input),
        reference_id: config.referenceId,
        format: "mp3",
        mp3_bitrate: 128,
        latency: "normal",
        temperature: 0.7,
        top_p: 0.7,
        normalize: true,
      }),
      signal: AbortSignal.any([timeout, request.signal]),
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.error(`[SonarAudio] Fish Audio returned HTTP ${response.status}.`);
      if (response.status === 401 || response.status === 403) {
        return failure("Fish Audio rejected the key, voice, or model access. Check your server configuration.", 502);
      }
      if (response.status === 402) return failure("Fish Audio credits are unavailable. Check your account balance.", 502);
      if (response.status === 429) return failure("Fish Audio is rate-limiting requests. Wait a moment, then retry.", 429);
      return failure("Fish Audio could not generate this clip. Please retry shortly.", 502);
    }
    const contentType = response.headers.get("content-type")?.split(";")[0].trim();
    if (contentType !== "audio/mpeg" && contentType !== "audio/mp3" && contentType !== "application/octet-stream") {
      await response.body?.cancel();
      console.error("[SonarAudio] Fish Audio returned an unexpected content type.");
      return failure("Fish Audio returned an unexpected audio format.", 502);
    }
    const audio = await boundedBytes(response.body, MAX_AUDIO_BYTES);
    if (audio.length === 0) {
      console.error("[SonarAudio] Fish Audio returned empty audio.");
      return failure("Fish Audio returned an empty clip. Please retry.", 502);
    }
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-SonarAudio-Provider": "fish",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return failure("Generation was cancelled.", 499);
    if (timeout.aborted) {
      console.error("[SonarAudio] Fish Audio generation timed out.");
      return failure("Fish Audio took longer than 45 seconds. Please retry.", 504);
    }
    if (error instanceof BodyLimitError) {
      console.error("[SonarAudio] Fish Audio exceeded the audio size limit.");
      return failure("The generated clip was too large. Try a shorter phrase.", 502);
    }
    console.error("[SonarAudio] Fish Audio network request failed.");
    return failure("Could not reach Fish Audio. Check your connection and retry.", 502);
  }
}
