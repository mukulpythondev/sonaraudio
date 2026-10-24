import { cloudflareConfig } from "@/lib/cloudflare";
import { AUDIO_TRANSPORT_MESSAGE, MAX_AUDIO_BYTES, audioContentType } from "@/lib/audio-import";
import { BodyLimitError, boundedBytes, failure } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const expected = `${url.protocol}//${request.headers.get("host") || url.host}`;
  const origin = request.headers.get("origin");
  if ((origin && origin !== expected) || request.headers.get("sec-fetch-site") === "cross-site") {
    return failure("Cross-origin audio uploads are not allowed.", 403);
  }
  if (!audioContentType(request.headers.get("content-type"))) {
    return failure("Send raw MP3, WAV, OGG, WebM, or FLAC audio with its audio Content-Type.", 415);
  }
  if (request.headers.get("x-audio-consent") !== "true") {
    return failure("Confirm permission to send this recording to Cloudflare and Deepgram.", 400);
  }
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_AUDIO_BYTES)) {
    return failure("Audio files must be at most 10 MiB.", 413);
  }
  const config = cloudflareConfig();
  if (!config.ready) return failure(config.message, 503);
  const timeout = AbortSignal.timeout(60_000);
  const signal = AbortSignal.any([timeout, request.signal]);
  try {
    signal.throwIfAborted();
    const stream = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(), { signal }) ?? null;
    const audio = await boundedBytes(stream, MAX_AUDIO_BYTES);
    signal.throwIfAborted();
    if (!audio.length) return failure("Choose a nonempty audio file.", 400);
    // Public REST documents binary bodies but not Nova's diarization option transport.
    // workerd's userInputs query is verified only for its private binding endpoint:
    // https://github.com/cloudflare/workerd/blob/main/src/cloudflare/internal/ai-api.ts
    // Do not send paid requests using a guessed public REST equivalent.
    return failure(AUDIO_TRANSPORT_MESSAGE, 503);
  } catch (error) {
    if (request.signal.aborted) return failure("Audio upload was cancelled.", 499);
    if (timeout.aborted) return failure("Audio upload exceeded the 60-second limit.", 504);
    if (error instanceof BodyLimitError) return failure("Audio files must be at most 10 MiB.", 413);
    return failure("Could not read the audio upload. Your current script is unchanged.", 400);
  }
}
