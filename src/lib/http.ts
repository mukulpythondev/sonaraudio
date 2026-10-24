export class BodyLimitError extends Error {}

export async function boundedBytes(stream: ReadableStream<Uint8Array> | null, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new BodyLimitError("Response exceeds the allowed size.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export function failure(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function requestGuard(request: Request): Response | null {
  const url = new URL(request.url);
  const expected = `${url.protocol}//${request.headers.get("host") || url.host}`;
  if (request.headers.get("origin") && request.headers.get("origin") !== expected) {
    return failure("Cross-origin requests are not allowed.", 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return failure("Send application/json.", 415);
  }
  return null;
}
