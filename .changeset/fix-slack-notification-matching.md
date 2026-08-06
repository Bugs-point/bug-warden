---
"bugwarden": minor
---

Fixed several bugs in Slack notification matching that could cause notifications to fire incorrectly, fire for the wrong config, or not fire at all:

- Status code matching accidentally checked the `routes` array instead of `onStatus`, so setting any route to `"all"` bypassed status filtering entirely.
- Match flags leaked across `notificationConfig` entries, so once one config matched, every later config in the array was treated as a match too, regardless of its own routes/status filters.
- The `{response-time}` message placeholder was missing its surrounding braces and was never substituted.
- `routes: "all"` never actually matched anything, since only status matching had an `"all"` special case — the most common documented example was silently broken.

Also added support for exact status codes in `onStatus` (e.g. `"404"` or `"400,401,404,5xx"`), not just `"NxxN"` ranges, and added a full automated test suite (vitest + supertest) covering the request logging and Slack notification matching logic.
