---
"bugwarden": major
---

Adds error-handling middleware, zero-config env-var setup, smart alert grouping, Fastify/Koa adapters, a CLI, and a local dashboard. Bumped to a major version because the package now ships multiple entry points, a `bin`, and new optional peer dependencies (`fastify`, `koa`) — the root `bugwarden` import is unaffected and fully backward compatible.

- `bugwardenErrorHandler`: Express error-handling middleware that logs thrown/forwarded errors (including stack traces) and routes them through the same Slack/webhook/Discord channels as `bugwarden()`, via new `{error-message}`/`{error-stack}` placeholders. Always calls `next(err)` so your own error-response logic keeps working. Also available as `bugwarden.errorHandler`.
- Zero-config mode: setting `BUGWARDEN_SLACK_WEBHOOK_URL`, `BUGWARDEN_DISCORD_WEBHOOK_URL`, or `BUGWARDEN_WEBHOOK_URL` wires up alerting (`4xx,5xx`, all routes by default) with no code changes, for `bugwarden()` and `bugwardenErrorHandler()` alike. `BUGWARDEN_THROTTLE_MS` / `BUGWARDEN_NOTIFY_ON` / `BUGWARDEN_NOTIFY_ROUTES` override the defaults. Explicit code configuration always wins over env vars.
- Smart alert grouping: `notificationConfig.groupBy` (`route`/`method`/`statusCode`/`errorMessage`, default `["route","statusCode"]`) fixes a real bug where a single wildcard config (e.g. `routes: "all"`) lumped unrelated incidents on different routes/status codes into one throttle bucket. A new `{occurrence-count}` placeholder exposes a running per-group total.
- `bugwarden/fastify`: a Fastify plugin (`bugwardenFastify`) providing the same logging and notification behavior as `bugwarden()` + `bugwardenErrorHandler()` combined, via `onRequest`/`onResponse`/`onError` hooks. Requires `fastify` (optional peer dependency).
- `bugwarden/koa`: a Koa middleware (`bugwardenKoa`) with the same behavior, using Koa's `try { await next() } catch {}` onion model so one middleware naturally covers both a normal response and a thrown error. Requires `koa` (optional peer dependency).
- `npx bugwarden init`: interactive setup that asks for your framework and alert channel, writes the right `BUGWARDEN_*_WEBHOOK_URL` to `.env`, and prints the snippet to add to your app. Never touches application source files.
- `bugwarden/dashboard`: a self-contained Express router (`bugwardenDashboard`) providing a local, in-memory web UI and JSON API for recent requests, status-code breakdown, and slowest routes — no external service, no persistence, no build step.
