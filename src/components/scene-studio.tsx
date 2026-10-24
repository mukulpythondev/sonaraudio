"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, AudioLines, Check, Coffee, Flame, Headphones, LoaderCircle, Play, Save, Square } from "lucide-react";
import { clipKey, ENVIRONMENTS, ORIGINAL_SCENE, parseScene, type Environment, type Scene, type SceneLine, type SceneSpeech } from "@/lib/scene";
import { TONES, isTone, textError } from "@/lib/speech";
import { CAST, SceneSet } from "./scene-set";
import { parseLabeledScript } from "@/lib/script-import";
import { TextImport } from "./text-import";
import { AudioImport } from "./audio-import";
import "./scene-studio.css";

const STORAGE_KEY = "sonaraudio:scene:v1";
const speakers = CAST;
type Take = { url: string; label: string };

export function SceneStudio({ fishReady, fishMessage, draftReady, draftMessage, draftModel, draftProvider, audioReady, audioMessage }: {
  fishReady: boolean; fishMessage: string | null; draftReady: boolean; draftMessage: string | null; draftModel: string; draftProvider: string;
  audioReady: boolean; audioMessage: string | null;
}) {
  const [scene, setScene] = useState<Scene>(ORIGINAL_SCENE);
  const [environment, setEnvironment] = useState<Environment>("studio");
  const [preview, setPreview] = useState(!fishReady);
  const [topic, setTopic] = useState("Should algorithms plan our whole day?");
  const [scriptSource, setScriptSource] = useState<"write" | "generate" | "upload" | "example">("write");
  const [pastedScript, setPastedScript] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [editorBranch, setEditorBranch] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<SceneLine["speaker"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState("An original script is ready. Choose a setting, then play the opening.");
  const [error, setError] = useState<string | null>(null);
  const [takeSnapshot, setTakeSnapshot] = useState<Record<string, Take>>({});
  const [hasSaved, setHasSaved] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const run = useRef(0);
  const takes = useRef(new Map<string, Take>());

  useEffect(() => {
    const cache = takes.current;
    const audio = player.current;
    return () => {
      run.current += 1;
      controller.current?.abort();
      audio?.pause();
      window.speechSynthesis?.cancel();
      for (const take of cache.values()) URL.revokeObjectURL(take.url);
      cache.clear();
    };
  }, []);

  function stop() {
    run.current += 1;
    controller.current?.abort();
    controller.current = null;
    player.current?.pause();
    window.speechSynthesis?.cancel();
    setActive(null); setActiveSpeaker(null); setBusy(false); setWriting(false);
  }
  function changeScene(next: Scene) {
    stop(); setScene(next); setAwaiting(false); setChosen(null); setError(null);
    setStatus("Script updated. Existing takes are reused only when every generation input matches.");
  }
  function editLine(index: number, patch: Partial<SceneLine>) {
    const next = structuredClone(scene);
    const list = editorBranch === null ? next.intro : next.branches[editorBranch].lines;
    list[index] = { ...list[index], ...patch };
    changeScene(next);
  }
  function importOpening(lines: SceneLine[]) {
    if (!window.confirm(`Replace the opening with ${lines.length} imported lines? Your two endings will be kept and may need rewriting.`)) return;
    changeScene({ ...scene, intro: lines });
    setEditorBranch(null);
    setStatus(`Imported ${lines.length} opening lines. Review speakers, delivery and both endings before playing; each uncached line uses a Fish request.`);
  }
  function inputFor(line: SceneLine): SceneSpeech { return { ...line, environment }; }

  async function sound(line: SceneLine, signal: AbortSignal, token: number) {
    const invalid = textError(line.text);
    if (invalid) throw new Error(invalid);
    if (preview) {
      if (!("speechSynthesis" in window)) throw new Error("Browser speech is unavailable. Configure Fish Audio to play the scene.");
      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(line.text);
        utterance.lang = "en-IN";
        const abort = () => { window.speechSynthesis.cancel(); reject(new DOMException("Stopped", "AbortError")); };
        const cleanup = () => signal.removeEventListener("abort", abort);
        signal.addEventListener("abort", abort, { once: true });
        utterance.onend = () => { cleanup(); resolve(); };
        utterance.onerror = (event) => { cleanup(); reject(new Error(`Browser speech failed (${event.error}).`)); };
        window.speechSynthesis.speak(utterance);
      });
      return;
    }
    const input = inputFor(line);
    const key = clipKey(input);
    let take = takes.current.get(key);
    if (!take) {
      setStatus(`Directing ${speakers[line.speaker]} in ${ENVIRONMENTS.find((item) => item.id === environment)?.name}...`);
      const response = await fetch("/api/scene-speech", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal,
      });
      if (!response.ok) {
        const result: unknown = await response.json();
        throw new Error(apiError(result, "Scene audio generation failed."));
      }
      if (!response.headers.get("content-type")?.startsWith("audio/")) throw new Error("The server returned no playable audio.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Fish returned an empty clip.");
      if (signal.aborted || token !== run.current) return;
      take = { url: URL.createObjectURL(blob), label: `${speakers[line.speaker]} / ${environment}` };
      if (takes.current.size >= 24) {
        const oldest = takes.current.entries().next().value;
        if (oldest) { URL.revokeObjectURL(oldest[1].url); takes.current.delete(oldest[0]); }
      }
      takes.current.set(key, take);
      setTakeSnapshot(Object.fromEntries(takes.current));
    }
    const audio = player.current;
    if (!audio) throw new Error("Audio playback is unavailable.");
    audio.src = take.url;
    setStatus(`Playing ${take.label}.`);
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener("abort", abort);
        audio.onended = null; audio.onerror = null;
      };
      const abort = () => { audio.pause(); cleanup(); reject(new DOMException("Stopped", "AbortError")); };
      signal.addEventListener("abort", abort, { once: true });
      audio.onended = () => { cleanup(); resolve(); };
      audio.onerror = () => { cleanup(); reject(new Error("Audio could not play. Retry the line or clear session takes.")); };
      void audio.play().catch(() => { cleanup(); reject(new Error("Playback was blocked. Click Play again to reuse the generated take.")); });
    });
  }

  async function playLines(lines: SceneLine[], prefix: string, waitForChoice = false) {
    if (!preview && lines.length > 4 && !window.confirm(`Play ${lines.length} lines? Each uncached line makes a paid Fish request. Cached lines are reused; there is no hard spend cap.`)) return;
    stop(); setError(null); setAwaiting(false);
    const token = run.current;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true);
    try {
      for (let index = 0; index < lines.length; index += 1) {
        if (abort.signal.aborted || token !== run.current) return;
        setActive(`${prefix}-${index}`);
        setActiveSpeaker(lines[index].speaker);
        await sound(lines[index], abort.signal, token);
      }
      if (token !== run.current) return;
      setAwaiting(waitForChoice);
      setStatus(waitForChoice ? "Your audience chooses what happens next." : "Take complete. Edit a line, switch settings, or replay.");
    } catch (cause) {
      if (token !== run.current || abort.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Playback failed.");
      setStatus("Playback stopped. Your script and earlier takes are kept.");
    } finally {
      if (token === run.current) { setBusy(false); setActive(null); setActiveSpeaker(null); controller.current = null; }
    }
  }

  async function generateScript() {
    if (!topic.trim() || Array.from(topic).length > 200) { setError("Enter a topic of 1–200 characters."); return; }
    if (!window.confirm(`Replace the current script with a ${draftProvider} draft? Unsaved edits will be replaced only if generation succeeds.`)) return;
    stop(); setError(null); setWriting(true); setStatus(`${draftProvider} is drafting an opening and two possible continuations...`);
    const token = run.current;
    const abort = new AbortController(); controller.current = abort;
    try {
      const response = await fetch("/api/scene", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }), signal: abort.signal,
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(result, "Script generation failed."));
      if (typeof result !== "object" || result === null || !("scene" in result)) throw new Error("No scene returned.");
      const draft = parseScene(result.scene);
      if (token !== run.current) return;
      setScene(draft); setEditorBranch(null); setChosen(null); setAwaiting(false);
      setStatus(`${draftProvider} draft ready. Review the script before generating voices.`);
    } catch (cause) {
      if (token !== run.current || abort.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Script drafting failed.");
      setStatus("Drafting failed. Your previous script is unchanged.");
    } finally {
      if (token === run.current) { setWriting(false); controller.current = null; }
    }
  }

  function saveScript() {
    try {
      const valid = parseScene(scene);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      setHasSaved(true); setError(null); setStatus("Script saved on this browser. Audio is session-only; download any takes you want to keep.");
    } catch (cause) { setError(cause instanceof Error ? `Could not save: ${cause.message}` : "Browser storage failed."); }
  }
  function loadScript() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { setError("No saved scene found on this browser."); return; }
      const saved = parseScene(JSON.parse(raw));
      if (!window.confirm("Load the saved script and replace current edits?")) return;
      changeScene(saved); setEditorBranch(null); setHasSaved(true);
    } catch { setError("Saved scene could not be read. Storage may be blocked or the data is invalid."); }
  }
  function clearTakes() {
    stop();
    for (const take of takes.current.values()) URL.revokeObjectURL(take.url);
    takes.current.clear(); setTakeSnapshot({});
    setStatus("Session takes cleared. Script unchanged.");
  }
  const visibleLines = editorBranch === null ? scene.intro : scene.branches[editorBranch].lines;
  const visiblePrefix = editorBranch === null ? "intro" : `branch${editorBranch}`;

  return (
    <div className={`app-shell scene-shell environment-${environment}`}>
      <a className="skip-link" href="#scene-editor">Skip to script</a>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="SonarAudio home"><span className="brand-mark"><AudioLines size={23} /></span><span>Sonar<span className="brand-light">Audio</span>.</span></Link>
        <nav className="header-actions" aria-label="Studio navigation"><a className="help-link" href="#scene-editor">Script editor</a><a className="help-link" href="#scene-preview">Audio preview</a><span className="connection-pill"><span className="status-dot" />{preview ? "Rehearsal mode" : "Fish voices configured"}</span></nav>
      </header>
      <main>
        <section className="scene-hero">
          <div><p className="eyebrow">THE TWO-VOICE AUDIO STUDIO</p><h1>Great conversations.<br /><span>Made by you.</span></h1>
            <p className="hero-description">Turn a script into expressive audio with two distinct hosts. Set the delivery. Choose the next turn.</p>
            <div className="creator-actions"><a className="primary-button" href="#scene-editor">Create your scene <ArrowRight size={17} /></a><a className="creator-secondary" href="#script-imports" onClick={() => setScriptSource("upload")}>Import a script</a></div></div>
          <div className="scene-edition"><span>PROJECT OVERVIEW</span><strong>{scene.intro.length} opening lines</strong><p><span>Cast voices <b>02</b></span><span>Alternative endings <b>02</b></span><span>Performance settings <b>03</b></span></p><small>Local workspace. Save your script to keep it; download audio takes separately.</small></div>
        </section>
        <div className="creator-workflow" aria-label="Creation workflow"><span><b>01</b> Write or import</span><span><b>02</b> Direct the delivery</span><span><b>03</b> Listen &amp; choose</span></div>
        <section id="script-imports" className="script-start source-workspace" aria-labelledby="script-start-heading">
          <p className="step-label">01 / START YOUR SCRIPT</p>
          <h2 id="script-start-heading">What would you like to create?</h2>
          <p>Bring your words, start with an idea, or try our example. Your current script stays unchanged until you apply a new one.</p>
          <div className="source-picker" role="group" aria-label="Script starting point">
            {(["write", "upload", "generate", "example"] as const).map((source) => <button key={source} aria-pressed={scriptSource === source} aria-controls="script-source-panel" onClick={() => setScriptSource(source)}><strong>{source === "write" ? "Write or paste" : source === "generate" ? "Generate with AI" : source === "upload" ? "Upload a script" : "Try an example"}</strong><small>{source === "write" ? "Your words, your way" : source === "generate" ? "Turn a prompt into dialogue" : source === "upload" ? "Import a labeled .txt file" : "Explore a ready-made scene"}</small></button>)}
          </div>
          <div id="script-source-panel" className="source-panel" key={scriptSource} aria-label={`${scriptSource} script source`}>
            {scriptSource === "write" && <div className="paste-source">
              <label className="phrase-label" htmlFor="paste-script">Write or paste your two-speaker dialogue</label>
              <textarea id="paste-script" value={pastedScript} onChange={(event) => setPastedScript(event.target.value)} placeholder={"Speaker 1: Fish Audio क्या है?\nSpeaker 2: इससे हम टेक्स्ट से आवाज़ बना सकते हैं।"} aria-describedby="paste-hint" />
              <p id="paste-hint">Label turns Speaker 1: and Speaker 2:. Hindi and English work. Up to 40 lines after splitting; your two endings are kept for you to edit. No AI request is made.</p>
              <button className="primary-button" disabled={!pastedScript.trim() || writing} onClick={() => {
                try { const lines = parseLabeledScript(pastedScript); setPasteError(null); importOpening(lines); }
                catch (cause) { setPasteError(cause instanceof Error ? cause.message : "Could not read your dialogue."); }
              }}>Use this script <ArrowRight size={16} /></button>
              {pasteError && <p role="alert">{pasteError}</p>}
            </div>}
            {scriptSource === "generate" && <div className="topic-form">
              <label htmlFor="topic">Describe the conversation you want</label>
              <div><input id="topic" value={topic} maxLength={200} placeholder="Two friends discussing AI over chai, in Hindi" onChange={(event) => setTopic(event.target.value)} disabled={writing} /><button className="primary-button" disabled={!draftReady || writing || !topic.trim()} onClick={() => void generateScript()}>{writing ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}Generate script</button></div>
              <small>{draftReady ? "Creates an opening and two endings. Review and edit before generating voices. This uses one AI drafting request." : draftMessage}</small>
              <details className="provider-details"><summary>AI provider details</summary><p>{draftProvider} / {draftModel}. Generates text, not audio.</p></details>
            </div>}
            {scriptSource === "upload" && <><TextImport expanded onImport={importOpening} /><details className="advanced-import"><summary>Audio import availability</summary><AudioImport ready={audioReady} message={audioMessage} onImport={importOpening} /></details></>}
            {scriptSource === "example" && <div className="example-source"><span className="example-label">SAMPLE CONVERSATION</span><h4>Would you take the scenic route?</h4><p>Akshat and Priyanshu talk about algorithms, chai, and unexpected turns. Four opening lines and two endings, ready to edit.</p><button className="primary-button" disabled={writing} onClick={() => {
              if (window.confirm("Load the example and replace your current script?")) {
                changeScene(structuredClone(ORIGINAL_SCENE)); setEditorBranch(null); setStatus("Example loaded. Edit the dialogue below or play the opening.");
              }
            }}>Load example <ArrowRight size={16} /></button><small>The editor starts with this sample. Loading it again replaces your current edits.</small></div>}
          </div>
        </section>
        <section className="production-stage" aria-label="Scene direction">
        <div className="direction-controls">
        <div className="set-section-heading"><div><p className="step-label">SCENE DIRECTION</p><h2>Find your setting.</h2></div><p>A different delivery, without rewriting your words.</p></div>
        <div className="scene-settings" role="group" aria-label="Performance environment">
          {ENVIRONMENTS.map((setting, index) => {
            const Icon = [Headphones, Coffee, Flame][index];
            return <button key={setting.id} aria-pressed={environment === setting.id} onClick={() => {
              stop(); setEnvironment(setting.id); setAwaiting(false); setError(null);
              setStatus("Setting changed. The script stays the same; new takes use different performance directions.");
            }}><Icon size={20} /><span><strong>{setting.name}</strong><small>{setting.subtitle}</small></span>{environment === setting.id && <Check size={17} />}</button>;
          })}
        </div>
        <p className="direction-note">Akshat and Priyanshu are your two cast voices. Choose each line&apos;s tone in the script editor below.</p>
        </div>
        <SceneSet environment={environment} activeSpeaker={activeSpeaker} rehearsal={preview} />
        </section>
        <div className="scene-disclosure"><p>{preview ? "Rehearsal mode: ordinary browser speech, not Fish voices or expressive delivery." : "Powered by Fish Audio. Settings direct the voices; they do not add background sounds."}</p>
          <details className="playback-options"><summary>Playback settings</summary>
            <p>Fish Audio generates the two expressive voices. Browser rehearsal checks the words without Fish requests; it cannot reproduce the cast or their delivery.</p>
            {fishReady ? <button className="text-button" onClick={() => { stop(); setPreview(!preview); setAwaiting(false); }}>Switch to {preview ? "Fish Audio" : "browser rehearsal"}</button> : <p>{fishMessage}</p>}
          </details>
        </div>

        <div className="scene-grid">
          <section id="scene-editor" className="scene-editor">
            <div className="section-heading"><div><p className="step-label">01 / SCRIPT</p><h2>Make it your conversation</h2></div><span className="scene-credit">{scene.intro.length} opening lines</span></div>
            <div className="editor-intro"><h3>Edit your script</h3><p>Choose a host and delivery for each line. Opening and endings are separate sections.</p></div>
            <label className="phrase-label" htmlFor="scene-title">Scene title</label>
            <input id="scene-title" className="scene-title" value={scene.title} maxLength={80} disabled={writing} onChange={(event) => changeScene({ ...scene, title: event.target.value })} />
            <div className="script-tabs" role="group" aria-label="Script section">
              <button aria-pressed={editorBranch === null} onClick={() => setEditorBranch(null)}>Opening</button>
              {scene.branches.map((_branch, index) => <button key={index} aria-pressed={editorBranch === index} onClick={() => setEditorBranch(index)}>Ending {index + 1}</button>)}
            </div>
            {editorBranch !== null && <div className="branch-label"><label htmlFor="branch-label">Audience choice label</label><input id="branch-label" value={scene.branches[editorBranch].label} maxLength={60} disabled={writing} onChange={(event) => {
              const next = structuredClone(scene); next.branches[editorBranch].label = event.target.value; changeScene(next);
            }} /></div>}
            <ol className="script-lines">
              {visibleLines.map((line, index) => {
                const key = clipKey(inputFor(line));
                const take = takeSnapshot[key];
                return <li key={`${visiblePrefix}-${index}`} className={active === `${visiblePrefix}-${index}` ? "line-active" : ""}>
                  <div className="line-meta"><span className={`speaker-avatar speaker-${line.speaker}`}>{line.speaker.toUpperCase()}</span>
                    <label className="scene-sr" htmlFor={`speaker-${index}`}>Speaker for line {index + 1}</label>
                    <select id={`speaker-${index}`} value={line.speaker} disabled={writing} onChange={(event) => editLine(index, { speaker: event.target.value === "a" ? "a" : "b" })}><option value="a">{speakers.a}</option><option value="b">{speakers.b}</option></select>
                    <label className="scene-sr" htmlFor={`tone-${index}`}>Delivery for line {index + 1}</label>
                    <select id={`tone-${index}`} value={line.tone} disabled={writing} onChange={(event) => {
                      if (isTone(event.target.value)) editLine(index, { tone: event.target.value });
                    }}>{TONES.map((tone) => <option key={tone.id} value={tone.id}>{tone.name}</option>)}</select>
                    <span className="line-number">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <label className="scene-sr" htmlFor={`line-${index}`}>Dialogue line {index + 1}</label>
                  <textarea id={`line-${index}`} value={line.text} rows={2} disabled={writing} onChange={(event) => editLine(index, { text: event.target.value })} aria-invalid={textError(line.text) !== null} />
                  <div className="line-actions"><span>{Array.from(line.text).length}/280 {take && " / take ready"}</span>
                    {take && !preview && <a href={take.url} download={`sonaraudio-${environment}-${visiblePrefix}-${index + 1}.mp3`} aria-label={`Download line ${index + 1}`}><ArrowDownToLine size={15} /></a>}
                    <button disabled={writing} onClick={() => void playLines([line], visiblePrefix + "-single")} aria-label={`Play line ${index + 1}`}><Play size={14} />{take && !preview ? "Replay" : preview ? "Rehearse" : "Generate & play"}</button>
                  </div>
                </li>;
              })}
            </ol>
            <div className="script-tools"><button onClick={saveScript} disabled={writing}><Save size={16} />{hasSaved ? "Save again" : "Save script"}</button><button onClick={loadScript} disabled={writing}>Load saved</button></div>
          </section>

          <aside id="scene-preview" className="scene-listening">
            <section className="listening-panel">
              <p className="card-kicker">02 / YOUR PREVIEW</p><h2>{scene.title || "Untitled conversation"}</h2>
              <p className="preview-setting">{ENVIRONMENTS.find((item) => item.id === environment)?.name} / {scene.intro.length} opening lines</p>
              <div className="cast-list"><div><span className="speaker-avatar speaker-a">A</span><span>{speakers.a}<small>Curious host</small></span></div><div><span className="speaker-avatar speaker-b">B</span><span>{speakers.b}<small>Playful counterpoint</small></span></div></div>
              <div className="scene-route"><span>Opening</span><i /><span>Audience choice</span><i /><span>Two possible endings</span></div>
              <button className="primary-button opening-button" disabled={writing || busy} onClick={() => { setChosen(null); void playLines(scene.intro, "intro", true); }}><Play size={17} />{busy ? "Performing..." : preview ? "Rehearse opening" : "Play opening"}</button>
              <button className="scene-stop" disabled={!busy && !writing} onClick={() => { stop(); setStatus("Stopped. Your script and generated takes are kept."); }}><Square size={13} />Stop playback / generation</button>
              <p className="scene-status" role="status">{status}</p>
              {error && <div className="error-notice" role="alert">{error}</div>}
              <div className={`audience-choices ${awaiting ? "choices-ready" : ""}`}><p>WHERE SHOULD THIS GO?</p>
                {scene.branches.map((branch, index) => <button key={index} disabled={writing || busy} aria-pressed={chosen === index} onClick={() => {
                  setChosen(index); setEditorBranch(index); void playLines(branch.lines, `branch${index}`);
                }}><span>{index + 1}</span><strong>{branch.label || `Ending ${index + 1}`}</strong><ArrowRight size={16} /></button>)}
                <small>{awaiting ? "Opening complete. Pick a direction to continue." : "Play the opening first, or audition either ending directly."}</small>
              </div>
            </section>
            <section className="session-panel"><p className="step-label">SESSION NOTES</p><h3>{preview ? "A rehearsal, not a Fish demo." : "Same script. New direction."}</h3>
              <p>{preview ? "Browser voices cannot demonstrate two Fish characters or the environment directions. Add two authorized voice IDs for the live performance." : "Switch settings and replay a line to hear a new performance. No fake ambience, no automatic script rewrites."}</p>
              <p>Clips stay in session memory ({Object.keys(takeSnapshot).length}/24). Download takes before closing. Saving a script stores text only.</p>
              <button className="text-button" onClick={clearTakes}>Clear session takes</button>
            </section>
          </aside>
        </div>
        <section className="bottom-strip"><div><AudioLines size={20} /><div><h3>Original script or AI draft. Always yours to direct.</h3><p>Gemini writes dialogue; Fish Drama 3 performs it. AI characters, not a live autonomous conversation.</p></div></div>
          <details><summary>Privacy &amp; saved data</summary><p>Drafting sends your topic to Google. Live playback sends each line and delivery direction to Fish. Browser rehearsal may use your OS speech service. Avoid sensitive content. Scripts save locally only when requested.</p><button className="text-button" onClick={() => {
            if (!window.confirm("Delete the saved scene script from this browser?")) return;
            try { localStorage.removeItem(STORAGE_KEY); setHasSaved(false); setStatus("Saved scene deleted."); } catch { setError("Could not delete saved data. Check browser storage permissions."); }
          }}>Delete saved script</button></details>
        </section>
      </main>
      <footer><span>SonarAudio / Scenes</span><span>Performance settings, not background sound effects.</span></footer>
      <audio ref={player} preload="none" />
    </div>
  );
}

function apiError(value: unknown, fallback: string): string {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : fallback;
}
