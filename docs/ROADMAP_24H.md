# SonarAudio: proposed 24-hour build

**Superseded:** the project pivoted to SonarAudio Scenes. This file records the earlier speech-board proposal only. Use [PROJECT.md](PROJECT.md) and [SPRINTS.md](SPRINTS.md) for current scope.

Status: planning only. Rebranding is implemented; the features below are not. Current implementation is documented in [README](../README.md).

## Product

A personal speech board for directing, approving, and reusing spoken delivery.

Core loop: compose -> direct -> listen -> repair -> approve -> save exact take -> replay.

Fish Drama 3 provides expressive synthesis, performance directions, pauses, and word-level control. SonarAudio would provide a focused interaction and local library around those capabilities. It does not invent expressive TTS, emotion recognition, or AAC.

## Must-have work

1. Integrate Drama 3 explicitly and validate model access, permitted voice, and actual MP3 playback. Never silently fall back to another engine.
2. Add delivery repair: softer or more direct, with visible instructions, explicit generation, original/adjusted comparison, and user approval.
3. Add a keyboard-accessible word/span selector for one emphasis instruction per phrase. Build provider markup on the server from validated offsets and allowlisted controls; preserve user text.
4. Persist approved MP3 takes and phrase metadata in IndexedDB. Include play, load for editing, delete, clear-all, storage-failure feedback, and storage limits.
5. Organize saved takes into user-created boards such as everyday, work, and social. Opening a board must not auto-speak. These are examples, not clinical presets.
6. Ensure saved takes can replay without Fish access. Browser storage may be evicted; do not promise permanent storage or a fully offline app.
7. Validate cancellation, stale responses, exact-take persistence, selected span boundaries, errors, mobile layout, and private-data handling.

## Good-to-have, only after the core works

- Export/import a small board bundle with metadata and audio, with strict size/type/schema validation.
- Optional installable app shell for offline saved-board access, verified by an actual offline reload test.
- A small tested Hindi/English board with a suitable authorized voice; do not claim universal multilingual quality.

## Non-goals

Emotion detection, mental-health assessment, clinical efficacy claims, voice cloning, automatic sending, telephony, public multi-tenant deployment, full audio editing, arbitrary provider markup, and automatic sentence rewriting.

## Suggested schedule

| Hours | Exit criterion |
|---|---|
| 0-2 | Real Drama 3 audio works; scope and data handling agreed. |
| 2-6 | Original and repaired takes compare correctly, with cancellation. |
| 6-9 | Validated span emphasis works with keyboard and pointer controls. |
| 9-14 | Approved takes persist, reload, replay, and delete locally. |
| 14-17 | Boards make saved speech easy to retrieve. |
| 17-21 | Automated tests, browser checks, storage/network failure tests, and listening checks pass. |
| 21-24 | Fix failures, collect informal feedback, label limitations, prepare demo and backups. |

This is an estimate for the existing foundation, not a promise of completion. Drop export/import and installability first; if needed, cut span selection before sacrificing persistence reliability.

## Demo

Type a phrase, request an alternate delivery, compare takes, approve one, save it to a board, reload, and replay the exact saved MP3 without a new generation. Demonstrate network independence only for saved clips. Disclose pre-event work and obtain organizer approval before claiming eligibility.

## Evidence to collect

- Identical phrase text retained across delivery changes.
- Persisted MP3 bytes match the approved take after reload.
- Replaying saved audio makes zero Fish requests.
- Generation failures do not erase approved takes.
- All live synthesis is genuine Fish output; preview/backup audio is labeled.
- Informal feedback is reported as feedback, not clinical validation.
