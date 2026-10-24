# SonarAudio Scenes demo

## Pitch

"SonarAudio turns a two-character script into a conversation you can direct. Change the performance setting, edit each voice's delivery, and let the audience choose the next turn."

## 60–90-second flow

1. Start with the original "Small Detours" script or a reviewed Gemini draft.
2. Point out the opening and two alternative endings.
3. Play the opening with genuine Fish voices. Let a judge choose an ending.
4. Replay one short, unchanged line in another performance setting.
5. Show the same text, new direction, distinct cached take, and individual MP3 download.

Full uncached playback can take longer than 90 seconds because generation is sequential. Generate and listen-test demo clips beforehand, disclose pre-generated takes, and use shorter lines for the live portion.

## Honest feature explanation

- Workers AI drafts text when Cloudflare is configured; Gemini remains the optional alternative. Fish Drama 3 performs the voice.
- Labeled text imports locally; review and replace only the opening, then edit its two retained endings.
- The original script needs no LLM.
- AI characters perform a script; they are not autonomous agents.
- Café/campfire are performance directions, not generated background sound.
- Take downloads are per line, not one assembled podcast file.
- Save script keeps text/settings only, not audio.
- Same wording across settings does not guarantee identical timing or word fidelity; listen-test the actual output.

## Submission draft

**What it does:** A two-character branching audio studio with editable scripts, optional topic-based generation, performance settings, per-line voice direction, and audience-selected continuations.

**How it is built:** Next.js, React, TypeScript, Fish Drama 3 TTS, Gemini structured generation, browser audio and localStorage. API credentials and voice IDs stay server-side.

**Our contribution:** The bounded authoring/playback workflow around existing model capabilities: stable script sections, line direction, two-voice casting, environment-aware take reuse, and branching playback.

**Limitations:** No ambience or room simulation; no autonomous discussion, persistent audio library, arbitrary scene graph, or combined episode export. Real-provider quality depends on permitted voices, model access, and listening tests.

**Prior work disclosure:** "The application shell, phrase-studio foundation, and related tests were prepared before the event. During the event we added [only actual on-site changes]. We [state organizer approval only if actually received]."

## Demo readiness

- [ ] Eligibility confirmed and prior work disclosed.
- [ ] Two permitted voice IDs and credits checked.
- [ ] One real generated line plays on the physical speakers.
- [ ] One environment contrast is audibly useful.
- [ ] Original script available if Gemini fails.
- [ ] Genuine downloaded takes and recording labeled as backups.
- [ ] Credentials not visible in browser tabs or recordings.
