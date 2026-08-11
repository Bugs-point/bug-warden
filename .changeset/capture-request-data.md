---
"bugwarden": minor
---

Adds `captureRequestData` to `BugwardenOptions`: an array of rules (`onStatus`, optional `routes`, `fields: ("body" | "params" | "query" | "headers")[]`) that capture the actual `req.body`/`req.params`/`req.query`/`req.headers` that triggered a given status code — so a 500 alert shows you what payload caused it, not just that it happened. Rules are evaluated in order; the first match wins.

- Available as `requestBody`/`requestParams`/`requestQuery`/`requestHeaders` log fields and `{request-body}`/`{request-params}`/`{request-query}`/`{request-headers}` notification placeholders.
- Works with both `bugwarden()` (plain 4xx/5xx responses) and `bugwardenErrorHandler()` (thrown errors).
- Sensitive headers (`authorization`, `cookie`, `set-cookie`, `x-api-key`, `proxy-authorization`) are redacted to `"[REDACTED]"` by default — override with `redactHeaders` per rule.
- Each captured field is independently truncated (default 1000 chars, configurable via `maxChars`).

Fully backward compatible — nothing changes unless `captureRequestData` is set.
