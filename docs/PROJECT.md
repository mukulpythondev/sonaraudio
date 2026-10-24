# SonarAudio Scenes: locked scope

## Product

A small audio-scene authoring and playback studio, centered on a two-character podcast with audience-selected continuations.

The scene graph is intentionally fixed: opening -> audience choice -> ending 1 or ending 2. This is not a general-purpose visual graph editor, full podcast production suite, or autonomous conversation system.

## Implemented

- [x] Original editable script with two hosts and two endings.
- [x] Akshat and Priyanshu character labels with original illustrated sets, microphones, and current-turn indicators. Visual scenery adds no ambient audio and makes no voice-identity claim.
- [x] Optional topic-to-script generation using Gemini structured JSON output and independent runtime validation.
- [x] Workers AI drafting takes precedence when Cloudflare credentials are configured; no error-triggered fallback.
- [x] Local labeled-text import with review, bounded splitting, and up to 40 opening lines; both endings are retained.
- [ ] Live audio transcription/diarization: UI explicitly disabled until Nova-3 public REST binary/options transport is verified. Tested parsing/mapping helpers are not an operational feature.
- [x] Per-line speaker and warm/confident/calm/playful direction controls.
- [x] Studio, café, and campfire performance settings; script words remain unchanged.
- [x] Server-side Drama 3 integration with two distinct authorized voice IDs.
- [x] Individual line playback and sequential opening/ending playback.
- [x] Audience-choice continuation and direct ending audition.
- [x] Stop/cancel, stale-response protection, bounded clip reuse, and explicit errors.
- [x] Local script save/load/delete and individual MP3 downloads.
- [x] Labeled browser rehearsal without keys; no provider-success simulation.
- [x] Earlier phrase studio retained at `/phrase-studio`.
- [x] Workers AI full structured scene request returned HTTP 200 after runtime validation.
- [ ] Actual Fish listening verification by the operator; Gemini drafting remains unavailable with current tested configuration.

## Not included

Background ambience, room acoustics, persistent audio library, combined episode export, waveform editing, character voice cloning, microphone input, automatic fact-checking, audience networking, cloud collaboration, arbitrary scene graphs, or a live multi-agent discussion.

The earlier speech-board repair/approval roadmap is superseded. It should not be presented as implemented scene-studio functionality.

## Differentiation

Drama 3 already provides expressive TTS and performance instructions. SonarAudio contributes script structure, per-line direction, a two-voice performance workflow, setting-specific takes, and playable audience branches. It does not claim novelty in speech generation or podcast synthesis.

## Acceptance criteria

1. Original editing works without any provider key.
2. Drafting and import failures retain the previous script and show an error.
3. A valid scene has a bounded opening and exactly two bounded branches.
4. Speech requests use Drama 3 and the server-selected voice for the line's speaker.
5. Switching environments preserves dialogue and invalidates only mismatched cache entries.
6. Selecting an ending plays its dialogue, not the other branch.
7. Stop/edit/settings changes prevent stale playback continuation.
8. Preview labels never imply Fish expression or ambience.
9. Script save/load round-trips text and delivery; audio retention is accurately disclosed.
