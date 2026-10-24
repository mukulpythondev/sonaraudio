"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneLine } from "@/lib/scene";
import {
  AUDIO_ACCEPT, AUDIO_IMPORT_AVAILABLE, AUDIO_TRANSPORT_MESSAGE, audioContentType, audioFileError,
  prepareAudioImport, validateAudioTurns, type AudioPreview,
} from "@/lib/audio-import";

export function AudioImport({ ready, message, onImport }: {
  ready: boolean; message: string | null; onImport: (lines: SceneLine[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [permission, setPermission] = useState(false);
  const [preview, setPreview] = useState<AudioPreview | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [mergesReviewed, setMergesReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);

  useEffect(() => () => {
    generation.current++;
    active.current?.abort();
  }, []);

  function cancel() {
    generation.current++;
    active.current?.abort();
    active.current = null;
    setBusy(false);
  }

  async function upload() {
    if (!AUDIO_IMPORT_AVAILABLE || !ready || !file || !permission || busy) return;
    const invalid = audioFileError(file);
    if (invalid) { setError(invalid); return; }
    cancel();
    const current = ++generation.current;
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), 60_000);
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": audioContentType(file.type)!, "X-Audio-Consent": "true" },
        body: file, signal: controller.signal, cache: "no-store",
      });
      if (current !== generation.current) return;
      if (!response.ok) {
        setError(response.status === 503 ? AUDIO_TRANSPORT_MESSAGE
          : response.status === 413 ? "Audio files must be at most 10 MiB."
            : response.status === 504 ? "Transcription exceeded 60 seconds."
              : "Audio import failed. Your current script is unchanged.");
        return;
      }
      const payload: unknown = await response.json();
      if (current !== generation.current) return;
      const data = typeof payload === "object" && payload !== null && "turns" in payload ? payload.turns : null;
      const parsed = validateAudioTurns(data);
      setPreview(parsed);
      setMapping({});
      setMergesReviewed(false);
    } catch {
      if (current === generation.current) {
        setError(controller.signal.aborted ? "Audio upload stopped or exceeded 60 seconds. Your current script is unchanged."
          : "Could not import this recording. Your current script is unchanged.");
      }
    } finally {
      clearTimeout(timer);
      if (current === generation.current) { active.current = null; setBusy(false); }
    }
  }

  function apply() {
    if (!preview) return;
    let lines: SceneLine[];
    try { lines = prepareAudioImport(preview.turns, mapping, mergesReviewed); }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review the transcript and speaker mapping.");
      return;
    }
    setError(null);
    onImport(lines);
  }

  const mapped = preview?.speakers.map((speaker) => mapping[speaker]).filter(Boolean) ?? [];
  const merging = new Set(mapped).size < mapped.length;

  return (
    <details className="script-import">
      <summary>Import a diarized audio transcript</summary>
      <p>MP3, WAV, OGG, WebM, or FLAC, up to 10 MiB. Nothing uploads until you press Upload.</p>
      <p>Audio upload is currently unavailable while the Nova-3 REST transport is verified. No provider requests are made.</p>
      {!ready && <p role="status">{message || "Configure Cloudflare Workers AI to enable audio import."}</p>}
      <label>Recording
        <input type="file" accept={AUDIO_ACCEPT} disabled={!ready || busy} onChange={(event) => {
          cancel();
          const next = event.target.files?.[0] ?? null;
          setFile(next);
          setPreview(null);
          setMapping({});
          setMergesReviewed(false);
          setPermission(false);
          setError(next ? audioFileError(next) : null);
        }} />
      </label>
      <label>
        <input type="checkbox" checked={permission} disabled={busy} onChange={(event) => setPermission(event.target.checked)} />
        I have permission to upload this recording and consent to sending its audio to Cloudflare Workers AI and Deepgram. Provider usage may incur costs.
      </label>
      <p>Speaker numbers are anonymous estimates, not identities. No emotion or voice identity is detected or cloned. Review the transcript before replacing your script; imported delivery starts warm.</p>
      <button type="button" disabled={!AUDIO_IMPORT_AVAILABLE || !ready || !file || !permission || busy || Boolean(file && audioFileError(file))} onClick={upload}>Upload and transcribe</button>
      {busy && <button type="button" onClick={() => { cancel(); setError("Upload cancelled. Your current script is unchanged."); }}>Cancel upload</button>}
      {busy && <p role="status">Uploading and transcribing… No automatic retries.</p>}
      {error && <p role="alert">{error}</p>}
      {preview && (
        <div>
          <h3>Review transcript and map every detected speaker</h3>
          {preview.speakers.map((speaker) => (
            <label key={speaker}>Detected speaker {speaker}
              <select value={mapping[speaker] || ""} onChange={(event) => {
                setMapping({ ...mapping, [speaker]: event.target.value });
                setMergesReviewed(false);
              }}>
                <option value="">Choose studio speaker</option>
                <option value="a">Speaker 1</option>
                <option value="b">Speaker 2</option>
              </select>
            </label>
          ))}
          {preview.turns.map((turn, index) => (
            <label key={index}>Turn {index + 1} · detected speaker {turn.speaker}
              <textarea value={turn.text} maxLength={20_000} onChange={(event) => {
                const turns = preview.turns.map((item, position) => position === index ? { ...item, text: event.target.value } : item);
                setPreview({ ...preview, turns });
              }} />
            </label>
          ))}
          {merging && <label>
            <input type="checkbox" checked={mergesReviewed} onChange={(event) => setMergesReviewed(event.target.checked)} />
            I reviewed and approve merging these detected speakers into the same studio speaker.
          </label>}
          <p>Apply replaces the current opening script only after validation (2–40 lines, up to 280 characters per line). Oversized transcripts are rejected, never truncated.</p>
          <button type="button" disabled={preview.speakers.some((speaker) => !mapping[speaker]) || (merging && !mergesReviewed)} onClick={apply}>Apply reviewed transcript</button>
        </div>
      )}
    </details>
  );
}
