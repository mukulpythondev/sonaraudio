# Verification guide

## SonarAudio Scenes verification

### Cloudflare and script import verification, 24 October 2026

- Saved canonical Cloudflare credentials were present. A minimal Workers AI inference returned HTTP 200 and the requested OK response; this establishes inference access, independently of token verification.
- The app now chooses Workers AI drafting when Cloudflare credentials are present. A browser-origin full scene request returned HTTP 200 in approximately 2.75 seconds using `@cf/meta/llama-3.1-8b-instruct`, with four opening lines and two branches after runtime validation.
- The initial terminal draft-test harness reported an inconclusive status 0; it was not counted as a provider success. The subsequent browser request above established the full route result.
- ESLint, TypeScript, 133 mocked tests in eight files, and production build passed.
- Browser file-input checks imported six labeled turns, preserved both two-line endings, and showed no horizontal overflow at 320px, 375px, and desktop widths.
- Text parsing is local; import review and replacement were tested without Fish calls. Automated tests cover UTF-8 text structure, unknown labels, long-word rejection, word-boundary splitting, limits, saved-scene compatibility, provider envelopes and explicit failures.
- Audio import is **not operational**. Nova-3 documents diarization, but its public REST binary-plus-options transport was not verified. Upload remains disabled and the server fails explicitly without contacting a provider. Parsing/mapping and request-guard tests do not establish live transcription.
- No user audio was uploaded, no new Fish requests were made, and no audio identity or listening-quality claim is established by these checks.

### Flash Lite switch, 24 October 2026

The default is now `gemini-2.5-flash-lite`, as requested. No local model override was present. ESLint, TypeScript, 70 tests, and the production build passed. The restarted preview returned HTTP 200 and displayed the new model.

Exactly one full scene-draft request was tested, without retries: the app returned HTTP 502 after approximately 0.9 seconds and the server recorded Gemini HTTP 404. This establishes that the requested endpoint/model was rejected, not the precise reason or available quota. Full scene drafting remains unverified with this model; the existing editable script and Fish playback remain available. No automatic model fallback is used.

Follow-up diagnosis (approximately 13:46 local): Google's [model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite) still lists the stable model ID and structured-output support, and its [deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations) lists no announced shutdown date. One minimal direct request, without a schema or retries, returned HTTP 404 / `NOT_FOUND` in approximately 0.84 seconds; the upstream error mentioned new users. This identifies a new-user availability restriction for the current account, rather than evidence of a scene-schema failure. No secrets or raw provider errors were logged. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) are project-specific and must be checked in AI Studio; a nominal RPM allowance does not establish model access.

### Illustrated sets and cast verification, 24 October 2026

- ESLint, TypeScript, all 69 tests, and the production build passed after the visual revamp.
- The refreshed production preview returned HTTP 200 on port 3100.
- Browser checks confirmed all three environment selectors expose their matching visual set and the speaker selector uses Akshat and Priyanshu.
- No horizontal page overflow was observed at desktop, 375px, or 320px widths.
- With mocked browser speech, Akshat's current-turn marker appeared during the opening and cleared on both Stop and an environment change.
- Original illustrated hosts, microphone setups, and environment-specific scenery are visual only; names do not verify the identities of the configured voices.
- No live provider requests were made for this UI verification.

### Live configuration check, 24 October 2026

Latest key refresh check (approximately 12:56 local time): restarted the production server to reload the saved environment and made exactly two POST requests, with no retries. Gemini scene drafting returned HTTP 502 after approximately 10.2 seconds with the application's incomplete/invalid-script-or-connection error; the exact upstream cause was not established. Fish speaker B generation returned HTTP 200, `audio/mpeg`, 73,771 bytes in approximately 1 second. Neither app response was HTTP 429 and neither supplied Retry-After; this does not establish the account's rate-limit allowance. Together with the earlier speaker A request, both configured voices have now returned audio, but human listening remains pending.

- Fish key alias `FISH_AUDIO_KEY` is now supported; the canonical `FISH_API_KEY` wins when both are set.
- Two configured voice IDs were detected as distinct without exposing their values.
- A real scene speech request returned HTTP 200, `audio/mpeg`, and 42,630 bytes in approximately 1.5 seconds. This confirms generation, not human listening quality.
- Gemini model listing succeeded. `gemini-2.5-flash` rejected a minimal request as unavailable to new users; `gemini-3.8-flash` succeeded and was the default at that time.
- Full structured scene drafting with the new model timed out at the application's 40-second limit on two attempts. Gemini scene drafting is therefore **not live-verified** despite the successful minimal model request.
- After the configuration changes, lint, typecheck, 69 tests, and production build passed.

The homepage now serves the scene studio; the older phrase UI remains at `/phrase-studio`.

Automated validation: 68 tests in five files passed, along with ESLint, TypeScript, and production build. New tests cover scene-tree validation, line limits, markup rejection, per-environment cache identity, Drama 3 selection, server-selected voices, provider errors, oversized outputs, structured Gemini output, invalid/truncated/blocked scripts, network failure, and provider timeouts.

Observed browser checks:

- [x] Homepage loads with the scene title and explicit browser-rehearsal disclosure.
- [x] Edit a line/tone, save, reload, explicitly load, and verify restoration.
- [x] Switch environment and verify the dialogue is unchanged.
- [x] Edit a branch label and verify its audience button updates.
- [x] No horizontal page overflow at desktop, 375px, 320px, and landscape sizes.
- [x] With mocked browser speech events: opening plays four lines, selected ending adds two lines, then returns to idle.
- [x] With mocked browser speech events: switching setting interrupts a playback run without stale continuation.
- [x] On a temporary server with dummy credentials and browser-intercepted responses: unchanged line replay made one speech request total; changing setting and then dialogue each made a new request.
- [x] Mocked live-mode download link uses the current setting and line filename.
- [x] Mocked Gemini failure preserved the current script; a validated success replaced it and updated the branches.

The playback-event and endpoint mocks verify sequencing and state, not audible quality or real provider output. No real provider calls were made during those checks. The temporary dummy-credential server was stopped, and the browser test's saved script was removed.

Pending operator checks:

- [ ] Configure two permitted voices; verify actual Drama 3 generation and physical audio output.
- [ ] Confirm distinct voices and useful setting differences.
- [ ] Verify Gemini with the operator's account and chosen model.
- [ ] Confirm per-line MP3 download and cached replay using real audio.
- [ ] Exercise cancellation during real provider generation and playback.
- [ ] Readiness and previews are not evidence of successful provider authentication.

## Earlier phrase-studio verification

## Automated checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Tests never contact Fish. They verify Unicode length boundaries, invalid delivery markup, unchanged phrase content, comparison settings, saved-data validation, exact outbound API fields, no-store audio, credential handling, request/audio size limits, origin checks, provider errors, cancellation, and timeout.

Automated checks cannot establish expressiveness, Hindi quality, user benefit, or event eligibility.

## Browser acceptance checklist

- [x] Open the page without credentials; verify explicit browser-preview warning.
- [x] Change tones and strength; selected controls update without speaking.
- [x] Click a quick phrase; text changes, but no speech starts.
- [x] Switch Hindi quick phrases; test selected text.
- [x] Save a favorite; reload; load it and verify tone/strength.
- [ ] Save the same phrase/delivery twice; ensure no duplicate.
- [ ] Delete a favorite; reload; ensure deletion persists.
- [ ] Deny browser storage or corrupt saved data; verify explicit recovery notice.
- [x] Enter bracket markup and verify a visible error. Blank/length boundaries are also covered by automated tests.
- [ ] Test Stop during playback and generation; change text during generation.
- [ ] Navigate using only Tab, Shift+Tab, Enter, and Space.
- [x] At desktop, approximately 390px, and 320px wide, verify no horizontal page overflow.
- [ ] Test browser zoom and reduced motion.
- [ ] Check browser console for hydration or runtime failures.

## Real-provider acceptance checklist (requires your key and authorized voice)

- [ ] Configure `.env.local`, restart, verify live mode.
- [ ] Verify an actual generated MP3 plays and downloads.
- [ ] Confirm no key or voice reference appears in browser HTML or responses.
- [ ] Play neutral and expressive versions; verify identical spoken words.
- [ ] Listen to warm/confident/calm/playful; record which examples are distinguishable.
- [ ] Compare subtle/expressive; omit from pitch if not convincingly distinct.
- [ ] Test Hindi with your selected model/voice; use English-only if quality is weak.
- [ ] Verify warm/neutral labels describe the chosen instructions, not guaranteed output.
- [ ] Disconnect network and verify visible error, not a preview fallback.
- [ ] Verify replaying an unchanged generated clip reuses the session cache.
- [ ] Clear session audio, then regenerate.
- [ ] Download a genuine backup clip and label it pre-generated.

## Listening notes

Use this table during the event rather than inventing quality scores.

| Phrase | Voice/engine | Tone | Clear words? | Intended delivery audible? | Demo-worthy? |
|---|---|---|---|---|---|
| Please let me finish. | To test | Confident | Pending | Pending | Pending |
| I'm happy you're here. | To test | Warm | Pending | Pending | Pending |
| I was only joking. | To test | Playful | Pending | Pending | Pending |
| मुझे थोड़ा वक्त चाहिए। | To test | Calm | Pending | Pending | Pending |

## Verification status

Implementation checks: ESLint and TypeScript passed; 41 tests across three files passed; Next.js production build passed. A running production page returned HTTP 200. A same-origin speech POST correctly returned HTTP 503 for missing configuration, and malformed JSON returned HTTP 400. A browser-discovered Next.js hostname normalization issue was fixed and covered by a regression test. Browser smoke checks covered changing tone/strength, saving and reloading a favorite, restoring its delivery, deleting the smoke-test favorite, bracket validation, Hindi quick-phrase selection, and narrow-screen overflow checks. Desktop appearance was also visually inspected.

After the UI/UX Pro Max redesign, lint, typecheck, all 41 tests, and production build passed again. Browser checks verified favorite persistence and delivery restoration, deletion, validation feedback, and no horizontal overflow at 320px, 375px, desktop, and landscape viewport sizes. Reduced-motion emulation was enabled for validation. Four primary text/background combinations measured contrast ratios between 5.27:1 and 8.30:1. A desktop screenshot was visually inspected; no browser page errors were observed in the interaction smoke test.

The browser smoke test used the integrated browser, not a committed end-to-end runner. Manual checkboxes above distinguish observed checks from pending work. Real Fish audio, physical speaker output, browser preview audio quality, and human listening remain pending until valid credentials and voice permission are supplied. No clinical or user-outcome evaluation has been performed.
