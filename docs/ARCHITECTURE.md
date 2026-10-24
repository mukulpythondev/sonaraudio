# Architecture and privacy

## Current scene-studio architecture

The homepage is now SonarAudio Scenes. The earlier phrase studio remains at `/phrase-studio`; the phrase-specific details below describe that retained feature.

```text
Local labeled text -> bounded parser -> review -> replace opening
Editable original script OR topic -> POST /api/scene -> Workers AI / Gemini structured JSON
                                                    -> runtime scene validation
Scene editor -> text + speaker + tone + environment -> POST /api/scene-speech
                                                    -> Drama 3, server-selected voice
MP3 -> bounded session cache -> sequential playback -> audience branch
```

- [Scene contract and original script](../src/lib/scene.ts)
- [Scene studio and playback lifecycle](../src/components/scene-studio.tsx)
- [Script drafting endpoint](../src/app/api/scene/route.ts)
- [Local text import](../src/lib/script-import.ts)
- [Cloudflare configuration](../src/lib/cloudflare.ts)
- [Scene speech endpoint](../src/app/api/scene-speech/route.ts)
- [Bounded HTTP helpers](../src/lib/http.ts)

Scene voice IDs are `FISH_VOICE_A` and `FISH_VOICE_B`; they must differ. Scene synthesis always sends `model: drama-3`. Credentials are never serialized to the browser. The environment determines an allowlisted natural-language delivery cue, not audio effects. User text cannot include bracket markup.

Gemini uses `generateContent`, JSON response MIME type, a response schema, and independent validation. Topics are limited to 200 code points; request bodies to 4096 bytes; model responses to 64 KiB; timeout to 40 seconds. Blocked, truncated, malformed, and invalid scripts return explicit errors. Original and current edits are not substituted into a success-shaped response.

When either Cloudflare credential is present, Workers AI is selected before requesting any generation; incomplete configuration errors explicitly rather than falling back. Workers AI uses `response_format: { type: "json_schema", json_schema: ... }`, checks its success envelope, and independently validates object or JSON-string output. It shares the topic, body, response and timeout bounds above. The model is allowlisted by ID syntax; account IDs are validated before constructing URLs.

Text import is local-only, UTF-8 `.txt` up to 64 KiB, with two recognized speakers and explicit errors for unknown labels. Imported turns split at word boundaries into at most 40 opening lines; branches remain 2–4 lines each. Longer live playback prompts for request-cost confirmation. The cache still retains only 24 clips, not an entire long episode.

Scene speech requests have the same 4096-byte request, 8 MiB response, and 45-second timeout limits as phrase speech. A sequential playback run uses one abort controller and generation token. Changing words, tone, speaker, environment, or mode aborts the run. Cache keys include all four generation inputs. Up to 24 MP3 object URLs are retained; eviction, clearing, and unmount revoke them.

Script storage is explicit localStorage save/load/delete. It contains text and settings only. Downloaded per-line audio is retained by the user. There is no persistent audio library or assembled export.

Readiness labels mean configuration is present, not authenticated connectivity. Browser rehearsal is explicitly separate and cannot demonstrate Fish expression. No provider retry or fallback occurs automatically.

## Earlier phrase studio

## Stack and flow

Next.js App Router + React + TypeScript. Tailwind v4 is loaded through PostCSS; custom CSS provides the studio's visual system. Lucide supplies icons. Vitest covers pure logic and the HTTP handler.

## Visual direction

The studio redesign applies the local UI/UX Pro Max skill used by HydroSense. Its search recommendations were adapted to a working communication tool rather than copied as a scroll-driven marketing page.

- Warm paper, charcoal listening panel, and a single rust accent.
- Editorial serif headlines paired with system UI text and monospace section labels; no external font requests.
- No decorative orb, floating badges, fake audio waveforms, gradients, or stacked rounded cards.
- Visible phrase label, explicit selected tone, 44px CSS minimum button heights, visible keyboard focus, and reduced-motion support.
- Primary text color combinations measured above 4.5:1 contrast. This is not a full accessibility certification.
- The existing generation, cancellation, preview disclosures, favorites, and privacy behavior remain unchanged.

```text
Server page: reads configuration, sends only readiness and model name
    |
Client studio: words + tone + strength + comparison variant
    |
POST /api/speech: origin/type/size/shape validation
    |
Fish Audio /v1/tts: server key + authorized reference voice
    |
Bounded MP3 response -> browser Blob -> audio element
```

## Key files

- [Studio UI and playback lifecycle](../src/components/studio.tsx)
- [Phrase validation and delivery construction](../src/lib/speech.ts)
- [Favorite data validation](../src/lib/favorites.ts)
- [Server model configuration](../src/lib/fish-config.ts)
- [Speech endpoint](../src/app/api/speech/route.ts)

## Request contract

```json
{
  "text": "Please let me finish.",
  "tone": "calm",
  "strength": "subtle",
  "variant": "expressive"
}
```

`variant` is `neutral` or `expressive`; tone is one of the four predefined choices; strength is `subtle` or `expressive`. Text must be nonblank, at most 280 Unicode code points, without bracket markup or unsupported control characters. Square and angle brackets are rejected to keep provider instructions separate from user phrases.

Requests are limited to 4096 bytes. Responses are limited to 8 MiB and generation times out after 45 seconds. The endpoint returns MP3 audio or an explicit JSON error. It never returns mock audio. There are no automatic retries.

Expressive requests prefix a natural-language bracket instruction. Neutral requests omit the instruction. Both otherwise use the same reference voice, engine, temperature, top-p, output format, and normalization. Generative variation remains; this is not a scientific acoustic-control experiment.

## Playback lifecycle

Only deliberate playback actions speak. Editing a phrase, changing controls, loading a favorite, or changing mode cancels the prior request/playback. A generation counter prevents late responses from updating the current selection. Browser object URLs are revoked on eviction, explicit clearing, and unmount. Up to 12 clips remain in session memory, keyed by every speech input field. Browser preview is not stored as a Fish clip or offered as an MP3.

## Data inventory

| Data | Destination | Retention |
|---|---|---|
| Typed phrase and cues in live mode | Local app server and Fish Audio | App does not persist; Fish policy applies |
| Phrase in preview | Browser/OS speech service | Provider/browser policy applies; not guaranteed offline |
| Favorites | Browser localStorage | Until explicit deletion or browser data clearing |
| Generated clips | Browser memory | Bounded session cache, clear action, or page close |
| Downloaded MP3 | User's device | Until user deletes it |
| API credentials | Server environment | Controlled by local operator |
| Operational errors | Server console, status/category only | Console/hosting policy |

No transcript, provider response body, key, or voice ID is intentionally logged. Status includes configuration readiness but is not a credential health check. Avoid sensitive phrases in this prototype.

## Deployment boundary

Default commands bind to `127.0.0.1`, suitable for a laptop demo. Same-origin enforcement blocks ordinary cross-origin browser requests but does **not** prevent direct requests from scripts. There is no application authentication, durable quota enforcement, distributed rate limiter, or hard spend cap.

Before public hosting, implement authenticated access, per-user and global budgets, durable rate limits, request concurrency limits, deployment-level request timeouts, HTTPS, operational monitoring, retention disclosures, and a consent/abuse policy. Configure the hosting platform's body limits and secrets. Do not expose a funded key through an unauthenticated public endpoint.
