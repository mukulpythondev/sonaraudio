# SonarAudio Scenes sprint checklist

This is a scope and readiness checklist, not a claim about actual hours worked.

## Sprint 1: Scene contract and provider integration

- [x] Lock two characters, one opening, two endings.
- [x] Original sample script.
- [x] Validate dialogue limits, speaker IDs, tones, labels, and tree structure.
- [x] Explicit Drama 3 model and two server-side reference voices.
- [x] Optional Gemini structured script generation.
- [x] Request bounds, timeouts, cancellation, and visible provider failures.
- [ ] Confirm actual model access, credits, and authorized voices.

## Sprint 2: Direct and play

- [x] Editable script sections, speakers, tones, title, choice labels.
- [x] Switch performance environment without rewriting dialogue.
- [x] Generate and play a line; sequentially play the opening.
- [x] Choose and play either branch.
- [x] Stop and prevent stale continuation.
- [x] Clear distinction between browser rehearsal and Fish performance.
- [ ] Listening-test all environments with actual Fish output.

## Sprint 3: Keep and rehearse

- [x] Save/load/delete script locally.
- [x] Download individual generated takes.
- [x] Bound session audio cache to 24 clips.
- [x] Preserve earlier phrase studio.
- [x] Automated contract/provider tests and production build.
- [x] Browser checks for editing, persistence, branches, settings, and responsive layout.
- [ ] Confirm real Gemini drafting and edit its output before audio generation.
- [ ] Download genuine backup takes and record a short demonstration.

## Suggested remaining event work

Import extension: local labeled-text parsing and longer bounded openings are implemented and browser-tested. Cloudflare Workers AI minimal inference and full structured scene drafting returned HTTP 200. Audio import is explicitly disabled: documented diarization exists, but the public REST binary/options transport was not verified. No live transcription is claimed.

1. Configure keys and two authorized voices without sharing secrets.
2. Verify one short Drama 3 line before generating a whole scene.
3. Verify optional Gemini topic generation; if it fails, use the original script.
4. Compare one unchanged line across environments; keep only examples with an audible difference.
5. Generate/cache the opening and both endings, then rehearse.
6. Confirm prebuilt-work eligibility and disclose the foundation.

## Cut rules

- Do not add live microphone conversations, ambience, cloning, or collaboration before the core demo works.
- No fake generated output, emotion scores, or unlabeled saved audio.
- If network generation is slow, explicitly present genuine pre-generated downloads as backups.
- Never describe browser rehearsal as Drama 3 output.
