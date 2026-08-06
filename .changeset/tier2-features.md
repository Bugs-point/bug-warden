---
"bugwarden": minor
---

Adds a set of backward-compatible features on top of the existing logging and Slack notification support:

- `ignore`: skip logging and notifications entirely for noisy routes (`"all"`, exact paths, or `"/prefix/*"` wildcards)
- `logger`: route all Bugwarden output (request logs and internal warnings/errors) through a custom logger instead of `console.log`
- `format: "json"`: emit a single-line JSON object per request instead of colored text, for log aggregators like Datadog or ELK
- Automatic `x-request-id` correlation: reused from the incoming header or generated, echoed back on the response, available as the `requestId` log field and `{request-id}` notification placeholder
- `throttleMs` on notification configs: caps how often a given rule can fire, folding suppressed repeats into a "+N more since last alert" note instead of spamming during a crash loop
- `configureWebhookNotification`: a generic, channel-agnostic webhook notifier (posts `{ message }`) for services other than Slack
- `configureDiscordNotification`: a Discord-specific webhook notifier (posts Discord's `{ content }` body shape) — can be combined with Slack and/or the generic webhook, each with independent throttling
- `captureResponseBody`: opt-in, character-capped capture of the response body (from `res.send`/`res.json`), available as the `responseBody` log field and `{response-body}` placeholder — useful for seeing what an error response actually said in a Slack alert
