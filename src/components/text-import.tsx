"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TEXT_FILE_BYTES, parseLabeledScript } from "@/lib/script-import";
import type { SceneLine } from "@/lib/scene";

export function TextImport({ onImport, expanded = false }: { onImport: (lines: SceneLine[]) => void; expanded?: boolean }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reading = useRef(0);
  useEffect(() => () => { reading.current += 1; }, []);
  async function readFile(file: File | undefined) {
    const token = ++reading.current;
    if (!file) return;
    setError(null); setDraft("");
    try {
      if (!/\.txt$/iu.test(file.name)) throw new Error("Choose a UTF-8 .txt file.");
      if (file.size > MAX_TEXT_FILE_BYTES) throw new Error("Text files must be at most 64 KiB.");
      const bytes = await file.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (token !== reading.current) return;
      parseLabeledScript(text);
      setDraft(text);
    } catch (cause) {
      if (token === reading.current) setError(cause instanceof Error ? cause.message : "Could not read the text file.");
    }
  }
  const content = <>
    <p>UTF-8 .txt, up to 64 KiB. Use <code>Speaker 1: Hello</code> and <code>Speaker 2: Hi</code>. Speak 1/2, A/B and Akshat/Priyanshu also work. Processed locally, without AI calls.</p>
    <label htmlFor="text-script-file">Script text file</label>
    <input id="text-script-file" type="file" accept=".txt,text/plain" onChange={(event) => void readFile(event.target.files?.[0])} />
    {draft && <>
      <label htmlFor="text-script-preview">Review imported text</label>
      <textarea id="text-script-preview" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" className="secondary-button" onClick={() => {
        try { const lines = parseLabeledScript(draft); onImport(lines); setError(null); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid script."); }
      }}>Replace opening with text</button>
    </>}
    <p>Up to 40 playback lines, 280 characters each; long turns split at word boundaries. Imported lines start warm. Your two endings are kept—review and rewrite them for this script.</p>
    {error && <p role="alert">{error}</p>}
  </>;
  return expanded ? <section className="script-import" aria-label="Upload a two-speaker text script">{content}</section>
    : <details className="script-import"><summary>Import a two-speaker text script</summary>{content}</details>;
}
