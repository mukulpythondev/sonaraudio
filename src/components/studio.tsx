"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine, ArrowRight, AudioLines, Check, ChevronRight, CircleHelp,
  Heart, LoaderCircle, Mic2, Play, Plus, ShieldCheck, Sparkles, Square,
  Sun, Trash2, Volume2, Wind,
} from "lucide-react";
import { FAVORITES_KEY, MAX_FAVORITES, parseFavorites, sameFavorite, type Favorite } from "@/lib/favorites";
import {
  characterCount, DEFAULT_TEXT, MAX_CHARACTERS, PHRASES, speechKey, textError,
  TONES, type Language, type Mode, type SpeechInput, type Strength, type Tone, type Variant,
} from "@/lib/speech";

const toneIcons = { warm: Sun, confident: Mic2, calm: Wind, playful: Sparkles };
type Clip = { url: string; label: string };

export function Studio({ liveAvailable, model, configurationMessage }: {
  liveAvailable: boolean;
  model: string | null;
  configurationMessage: string | null;
}) {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [tone, setTone] = useState<Tone>("warm");
  const [strength, setStrength] = useState<Strength>("subtle");
  const [language, setLanguage] = useState<Language>("en");
  const [mode, setMode] = useState<Mode>(liveAvailable ? "live" : "preview");
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready when you are.");
  const [busy, setBusy] = useState<Variant | null>(null);
  const [playing, setPlaying] = useState<Variant | null>(null);
  const [clips, setClips] = useState<Record<string, Clip>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const urlsRef = useRef(new Map<string, Clip>());
  const previewRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      try {
        setFavorites(parseFavorites(localStorage.getItem(FAVORITES_KEY)));
      } catch {
        setStorageError("Favorites could not be read. Browser storage may be blocked or saved data may be damaged. Reset saved favorites to recover.");
      }
      setFavoritesLoaded(true);
    });
    const urls = urlsRef.current;
    const audio = audioRef.current;
    return () => {
      mounted = false;
      generationRef.current += 1;
      requestRef.current?.abort();
      audio?.pause();
      window.speechSynthesis?.cancel();
      for (const clip of urls.values()) URL.revokeObjectURL(clip.url);
      urls.clear();
    };
  }, []);

  const toneName = TONES.find((item) => item.id === tone)?.name ?? "Warm";
  const inputFor = (variant: Variant): SpeechInput => ({ text: text.trim(), tone, strength, variant });
  const currentExpressive = clips[speechKey(inputFor("expressive"))];
  const saved = favorites.some((item) => sameFavorite(item, { text, tone, strength }));

  function stop() {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    window.speechSynthesis?.cancel();
    previewRef.current = null;
    setPlaying(null);
    setBusy(null);
  }

  function updateText(value: string) {
    stop();
    setText(value);
    setError(null);
    setStatus("Phrase updated. Nothing plays until you choose Speak.");
  }

  async function playClip(clip: Clip, variant: Variant, generation: number) {
    const audio = audioRef.current;
    if (!audio) throw new Error("Audio playback is unavailable in this browser.");
    audio.src = clip.url;
    setPlaying(variant);
    try {
      await audio.play();
      if (generation === generationRef.current) setStatus(`Playing ${clip.label}.`);
    } catch {
      if (generation === generationRef.current) {
        setPlaying(null);
        throw new Error("Playback was blocked or this audio format is unsupported. Tap the same playback button to retry.");
      }
    }
  }

  function preview(variant: Variant) {
    if (!("speechSynthesis" in window)) {
      throw new Error("Browser speech preview is unavailable. Configure Fish Audio or try a browser with speech synthesis.");
    }
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = language === "hi" ? "hi-IN" : "en-IN";
    // Preview intentionally does not imitate Fish's tone controls.
    utterance.rate = 1;
    previewRef.current = utterance;
    const generation = generationRef.current;
    utterance.onend = () => {
      if (generation !== generationRef.current) return;
      setPlaying(null);
      setStatus("Browser preview complete. Fish expression has not been tested.");
    };
    utterance.onerror = (event) => {
      if (generation !== generationRef.current) return;
      setPlaying(null);
      setError(`Browser preview failed (${event.error}). Try another browser or configure Fish Audio.`);
    };
    setPlaying(variant);
    setStatus("Browser speech preview. No Fish Audio, no emotion rendering.");
    window.speechSynthesis.speak(utterance);
  }

  async function speak(variant: Variant) {
    stop();
    setError(null);
    const invalid = textError(text);
    if (invalid) { setError(invalid); return; }
    const generation = generationRef.current;
    if (mode === "preview") {
      try { preview(variant); } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Browser preview failed.");
      }
      return;
    }
    const input = inputFor(variant);
    const key = speechKey(input);
    const cached = urlsRef.current.get(key);
    if (cached) {
      try { await playClip(cached, variant, generation); } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not play the clip.");
      }
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(variant);
    setStatus(`Generating ${variant === "neutral" ? "neutral" : toneName.toLowerCase()} audio with Fish...`);
    try {
      const response = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) {
        const result: unknown = await response.json();
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error : "Speech generation failed. Please retry.";
        throw new Error(message);
      }
      if (!response.headers.get("content-type")?.startsWith("audio/")) {
        throw new Error("The server did not return playable audio.");
      }
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("The audio clip was empty. Please retry.");
      if (generation !== generationRef.current) return;
      const clip: Clip = {
        url: URL.createObjectURL(blob),
        label: variant === "neutral" ? "neutral delivery" : `${toneName.toLowerCase()}, ${strength} delivery`,
      };
      // Bound in-memory audio retention; nothing is persisted to browser storage.
      if (urlsRef.current.size >= 12) {
        const oldest = urlsRef.current.entries().next().value;
        if (oldest) {
          URL.revokeObjectURL(oldest[1].url);
          urlsRef.current.delete(oldest[0]);
        }
      }
      urlsRef.current.set(key, clip);
      setClips(Object.fromEntries(urlsRef.current));
      setBusy(null);
      await playClip(clip, variant, generation);
    } catch (cause) {
      if (generation !== generationRef.current || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not generate audio. Please retry.");
      setStatus("Generation did not complete. Your phrase is still here.");
    } finally {
      if (generation === generationRef.current) {
        setBusy(null);
        requestRef.current = null;
      }
    }
  }

  function persistFavorites(next: Favorite[]) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      setFavorites(next);
      setStorageError(null);
      return true;
    } catch {
      setStorageError("Favorites could not be saved. Check your browser's storage permissions. No change was saved.");
      return false;
    }
  }

  function saveFavorite() {
    const invalid = textError(text);
    if (invalid) { setError(invalid); return; }
    if (saved) { setStatus("This phrase and delivery are already saved."); return; }
    if (favorites.length >= MAX_FAVORITES) {
      setError(`You can save up to ${MAX_FAVORITES} favorites. Remove one to add another.`);
      return;
    }
    const next = [...favorites, { id: crypto.randomUUID(), text: text.trim(), tone, strength }];
    if (persistFavorites(next)) setStatus("Saved to My Say on this browser.");
  }

  function clearSessionAudio() {
    stop();
    for (const clip of urlsRef.current.values()) URL.revokeObjectURL(clip.url);
    urlsRef.current.clear();
    setClips({});
    setStatus("Session audio cleared. Favorites are unchanged.");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#composer">Skip to phrase composer</a>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="SonarAudio home">
          <span className="brand-mark"><AudioLines size={23} strokeWidth={2.1} /></span>
          <span>Sonar<span className="brand-light">Audio</span><span className="brand-dot">.</span></span>
        </Link>
        <nav className="header-actions" aria-label="Studio settings">
          <span className={`connection-pill ${mode === "live" ? "is-live" : ""}`}>
            <span className="status-dot" />{mode === "live" ? "Fish Audio configured" : "Browser preview"}
          </span>
          <a className="help-link" href="#about"><CircleHelp size={17} /><span>About the studio</span></a>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">SONARAUDIO / EXPRESSION STUDIO</p>
            <h1 id="hero-title">Your words.<br /><span>Not just any voice.</span></h1>
            <p className="hero-description">Write what you mean. Choose how it lands.</p>
          </div>
          <div className="session-note">
            <span className="session-index">01 — PERSONAL DELIVERY</span>
            <p>You set the tone.<br />We keep the words.</p>
            <span className="session-caption">No rewriting. No emotion detection.</span>
          </div>
        </section>

        <div className={`mode-banner ${mode === "preview" ? "preview-banner" : ""}`}>
          <div><span className="banner-label">{mode === "preview" ? "PREVIEW MODE" : "LIVE STUDIO"}</span>
            <p>{mode === "preview"
              ? "Browser speech only. Emotion controls do not affect preview audio."
              : `Powered by Fish Audio ${model}. Your phrase is sent only when you generate a clip.`}</p>
          </div>
          {liveAvailable && <button className="text-button" onClick={() => {
            stop(); setMode(mode === "live" ? "preview" : "live"); setError(null); setStatus("Playback mode changed.");
          }}>{mode === "live" ? "Use preview" : "Use Fish Audio"}<ArrowRight size={15} /></button>}
          {!liveAvailable && <details className="setup-details"><summary>Enable Fish Audio</summary><p>{configurationMessage}</p></details>}
        </div>

        <div className="workspace">
          <section className="composer-card" id="composer" aria-labelledby="composer-title">
            <div className="section-heading">
              <div><p className="step-label">01 / COMPOSE</p><h2 id="composer-title">Start with your words.</h2></div>
              <div className="language-switch" role="group" aria-label="Quick phrase language">
                <button aria-pressed={language === "en"} onClick={() => { stop(); setLanguage("en"); }}>EN</button>
                <button lang="hi" aria-pressed={language === "hi"} onClick={() => { stop(); setLanguage("hi"); }}>हिंदी</button>
              </div>
            </div>
            <label className="phrase-label" htmlFor="phrase">Your phrase</label>
            <div className="textarea-wrap">
              <textarea id="phrase" value={text} onChange={(event) => updateText(event.target.value)}
                placeholder="Type exactly what you want to say." rows={3}
                aria-describedby="phrase-help character-count" aria-invalid={characterCount(text) > MAX_CHARACTERS}
                spellCheck />
              <span id="character-count" className={characterCount(text) > MAX_CHARACTERS ? "character-count over-limit" : "character-count"}>{characterCount(text)} / {MAX_CHARACTERS}</span>
            </div>
            <p className="field-hint" id="phrase-help">Your exact words, with delivery cues added separately. No AI rewriting.</p>
            <div className="quick-phrases" aria-label="Quick phrases">
              {PHRASES[language].map((phrase) => <button key={phrase} lang={language} onClick={() => updateText(phrase)}>{phrase}<Plus size={13} /></button>)}
            </div>
            <div className="section-divider" />
            <div className="section-heading tone-heading">
              <div><p className="step-label">02 / YOUR EXPRESSION</p><h2>How should it feel?</h2></div>
              <span className="small-note">Same words. Your intention.</span>
            </div>
            <div className="tone-grid" role="group" aria-label="Delivery tone">
              {TONES.map((item) => {
                const Icon = toneIcons[item.id];
                return <button key={item.id} className={`tone-card ${tone === item.id ? "selected" : ""}`}
                  aria-pressed={tone === item.id} onClick={() => { stop(); setTone(item.id); setError(null); }}>
                  <span className={`tone-icon tone-${item.id}`}><Icon size={21} /></span>
                  {tone === item.id && <Check size={13} className="tone-check" />}
                  <strong>{item.name}</strong><span>{item.hint}</span>
                </button>;
              })}
            </div>
            <div className="strength-row">
              <div><label htmlFor="strength">Expression strength</label><span className="experimental">Experimental</span>
                <p>Delivery instructions, not a calibrated emotion dial.</p></div>
              <select id="strength" value={strength} onChange={(event) => {
                stop(); setStrength(event.target.value === "expressive" ? "expressive" : "subtle");
              }}>
                <option value="subtle">Subtle</option><option value="expressive">Expressive</option>
              </select>
            </div>
            <div className="speak-row">
              <button className="primary-button speak-button" disabled={busy !== null} onClick={() => void speak("expressive")}>
                {busy === "expressive" ? <LoaderCircle className="spin" size={19} /> : <Volume2 size={19} />}
                {busy === "expressive" ? "Creating your voice..." : mode === "preview" ? "Preview my words" : "Speak my words"}
                <span className="button-tone">{toneName}<ArrowRight size={15} /></span>
              </button>
              <button className="save-button" onClick={saveFavorite} disabled={!favoritesLoaded || saved || storageError !== null}
                aria-label={saved ? "Phrase already saved" : "Save phrase and delivery to My Say"} title={saved ? "Already saved" : "Save to My Say"}>
                {saved ? <Check size={20} /> : <Heart size={20} />}
              </button>
            </div>
            <div className="status-row">
              <span className={`status-dot ${playing ? "playing-dot" : ""}`} />
              <p role="status" aria-live="polite">{status}</p>
              <button onClick={() => { stop(); setStatus("Playback stopped."); }} disabled={!busy && !playing} className="stop-button"><Square size={11} fill="currentColor" /> Stop</button>
            </div>
            {error && <div className="error-notice" role="alert">{error}</div>}
          </section>

          <aside className="side-column">
            <section className="comparison-card" aria-labelledby="comparison-title">
              <div className="card-kicker"><AudioLines size={17} /><span>HEAR THE DIFFERENCE</span></div>
              <h2 id="comparison-title">Same words.<br />Different feeling.</h2>
              <p className="muted">Listen to the words alone, then with your chosen expression.</p>
              <div className="comparison-quote"><span>&ldquo;</span><p>{text.trim() || "Your words go here."}</p></div>
              <button className="comparison-button" disabled={busy !== null} onClick={() => void speak("neutral")}>
                <span className="play-icon">{busy === "neutral" ? <LoaderCircle size={17} className="spin" /> : <Play size={15} fill="currentColor" />}</span>
                <span><strong>{mode === "preview" ? "Browser preview A" : "Without expression"}</strong><small>{mode === "preview" ? "Not Fish Audio" : "No delivery cue added"}</small></span>
                <span className="take-index" aria-hidden="true">A</span>
              </button>
              <button className="comparison-button expressive-comparison" disabled={busy !== null} onClick={() => void speak("expressive")}>
                <span className="play-icon">{busy === "expressive" ? <LoaderCircle size={17} className="spin" /> : <Play size={15} fill="currentColor" />}</span>
                <span><strong>{mode === "preview" ? "Browser preview B" : `With ${toneName.toLowerCase()}`}</strong><small>{mode === "preview" ? "Same preview; no emotion rendering" : `${strength} expression`}</small></span>
                <span className="take-index" aria-hidden="true">B</span>
              </button>
              {mode === "live" && currentExpressive && <a className="download-link" href={currentExpressive.url} download={`sonaraudio-${tone}-${strength}.mp3`}><ArrowDownToLine size={14} />Download generated clip</a>}
              <p className="comparison-footnote">{mode === "preview" ? "Both buttons use ordinary browser speech. Connect Fish to compare delivery." : "Same voice and settings. Delivery is generative; results may vary."}</p>
            </section>

            <section className="favorites-card" aria-labelledby="favorites-title">
              <div className="favorites-heading"><h2 id="favorites-title"><Heart size={17} /> My Say</h2><span>{favorites.length}/{MAX_FAVORITES}</span></div>
              <p className="muted">Your saved phrases and delivery settings.</p>
              {storageError && <div className="error-notice" role="alert"><p>{storageError}</p>
                <button className="text-button" onClick={() => {
                  if (window.confirm("Delete all saved SonarAudio favorites from this browser?")) persistFavorites([]);
                }}>Reset saved favorites</button></div>}
              {favorites.length === 0 ? <div className="empty-favorites"><p>No saved phrases yet.</p><small>Use the heart beside Speak to save your words and delivery on this browser.</small></div>
                : <ul className="favorite-list">{favorites.map((item) => <li key={item.id}>
                  <button className="favorite-load" onClick={() => {
                    stop(); setText(item.text); setTone(item.tone); setStrength(item.strength); setError(null);
                    setStatus("Favorite loaded. Choose Speak when ready.");
                  }}><strong>{item.text}</strong><span>{TONES.find((entry) => entry.id === item.tone)?.name} · {item.strength}</span></button>
                  <button className="icon-button" aria-label={`Delete favorite: ${item.text}`} onClick={() => {
                    if (persistFavorites(favorites.filter((entry) => entry.id !== item.id))) setStatus("Favorite removed.");
                  }}><Trash2 size={15} /></button>
                </li>)}</ul>}
              <p className="local-note"><ShieldCheck size={12} />Saved only when you choose. Text and tone, not audio.</p>
            </section>
          </aside>
        </div>

        <section className="bottom-strip" id="about" aria-label="About and privacy">
          <div><span className="bottom-icon"><Heart size={18} /></span><div><h3>Expression, on your terms.</h3><p>A communication prototype. Not a clinical tool or emotion detector.</p></div></div>
          <details><summary>Privacy &amp; session controls <ChevronRight size={15} /></summary>
            <p>Live generation sends your phrase and delivery instruction to Fish Audio. Browser preview may use your browser or operating system&apos;s speech service. Avoid sensitive information. Favorites remain in this browser; generated clips are held in memory until cleared or the page closes. Downloads remain on your device.</p>
            <button className="text-button" onClick={clearSessionAudio}>Clear session audio</button>
            <button className="text-button danger-text" onClick={() => {
              if (window.confirm("Delete all saved SonarAudio favorites from this browser?") && persistFavorites([])) setStatus("All saved favorites deleted.");
            }}>Delete all favorites</button>
          </details>
        </section>
      </main>
      <footer><span>SonarAudio<span className="brand-dot">.</span> <span className="footer-tagline">Words kept. Tone chosen.</span></span>
        <span>Expression studio <span className="footer-separator">/</span> Fish Audio</span></footer>
      <audio ref={audioRef} preload="none" onEnded={() => { setPlaying(null); setStatus("Finished. Your next words are yours to choose."); }}
        onError={() => { setPlaying(null); setError("Audio playback failed. Tap the playback button to retry, or clear session audio and regenerate."); }} />
    </div>
  );
}
