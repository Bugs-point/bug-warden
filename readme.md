# BugWarden

[![npm version](https://img.shields.io/npm/v/bugwarden.svg)](https://www.npmjs.com/package/bugwarden)
[![npm downloads](https://img.shields.io/npm/dm/bugwarden.svg)](https://www.npmjs.com/package/bugwarden)
[![Build Status](https://github.com/Bugs-point/bug-warden/actions/workflows/main.yml/badge.svg)](https://github.com/Bugs-point/bug-warden/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/npm/l/bugwarden.svg)](https://github.com/Bugs-point/bug-warden/blob/master/LICENSE)

## Enhance Your Express.js Logging with Colorful Status Codes and Detailed Logs

BugWarden is an npm package designed to make your Express.js application's logging more informative and visually appealing. It provides:

- **Colorful status code indications** for easy log scanning
- **Detailed request-response logs**, including response times
- **Middleware integration** for effortless tracking of HTTP activity, for Express, Fastify (`bugwarden/fastify`), or Koa (`bugwarden/koa`)
- **Slack alerts** triggered by HTTP status code and route, with no separate account or service to sign up for
- **A local dashboard** (`bugwarden/dashboard`) for recent requests, status trends, and slowest routes — no external service

## Why BugWarden?

| | BugWarden | Morgan | Winston | Sentry |
|---|---|---|---|---|
| Express request/response logging | ✅ | ✅ | Manual setup | ❌ |
| Colored status-code output | ✅ | Via custom format | Depends on transport | ❌ |
| Slack alerts on status code + route, zero config | ✅ | ❌ | ❌ | Via separate integration |
| Requires an external account/service | No | No | No | Yes |
| Captures error stack traces | ✅ | ❌ | General-purpose logger | ✅ |
| Works with just env vars, no code config | ✅ | ❌ | ❌ | ❌ |
| Built-in local dashboard UI | ✅ | ❌ | ❌ | Hosted (external) |

BugWarden isn't trying to replace full error-tracking platforms like Sentry — think of it as Morgan-style request logging with Slack/Discord/webhook alerting built in, for teams who want a signal in their team chat without standing up another service.

## Installation

To install BugWarden, use npm:

```bash
npm install bugwarden
```

Or skip straight to a working alert with the interactive setup:

```bash
npx bugwarden init
```

It asks which framework you're using (Express/Fastify/Koa) and which alert channel to wire up (Slack/Discord/generic webhook), writes the corresponding `BUGWARDEN_*_WEBHOOK_URL` to a `.env` file in the current directory (see "Zero-config mode" below), and prints the one-line snippet to add to your app. It never touches your application source files — only `.env` and the terminal.

## Usage

1. **Require BugWarden** in your Express.js application:

```javascript
// Common JS method
const express = require("express");
const { bugwarden, bugwardenErrorHandler } = require("bugwarden");
const app = express();

// ES Module method
import express from "express";
import { bugwarden, bugwardenErrorHandler } from "bugwarden";
const app = express();
```

2. **Apply BugWarden as middleware:**

```javascript
// Enable JSON parsing middleware (if needed)
app.use(express.json());

// Integrate BugWarden middleware
app.use(bugwarden());
```

3. **Use options:**

```javascript
// Display all logs
app.use(bugwarden());

// Display all logs
app.use(bugwarden({ logging: true }));

// No logs
app.use(bugwarden({ logging: false }));

// Specific logging
app.use(bugwarden({ logging: ["method", "responseTime", "statusCode"] }));

// Skip logging and Slack notifications entirely for noisy routes
app.use(bugwarden({ ignore: ["/health", "/metrics", "/internal/*"] }));

// Route all Bugwarden output through your own logger instead of console.log
app.use(bugwarden({ logger: (message) => myLogger.info(message) }));

// Emit single-line JSON logs instead of colored text, for log aggregators
app.use(bugwarden({ format: "json" }));
// {"ip":"::1","timestamp":"...","method":"GET","originalURL":"/","httpVersion":"HTTP/1.1","statusCode":200,"contentLength":12,"referrer":"-","userAgent":"...","responseTime":5}

// Capture up to N characters of the response body (from res.send/res.json),
// available as the responseBody log field and {response-body} placeholder
app.use(bugwarden({ captureResponseBody: 500 }));
```

Every request also gets an `x-request-id` — reused from the incoming header if the client already sent one, otherwise generated — echoed back in the response and available as the `requestId` log field / `{request-id}` Slack message placeholder, so you can correlate a log line with the Slack alert it triggered.

`captureResponseBody` is opt-in and off by default — when set, it's genuinely useful for seeing what an error response actually said (e.g. `{response-body}` in a Slack message for 5xx alerts), but be mindful it can capture sensitive data if your responses include any, and it only captures bodies sent via `res.send`/`res.json` (not raw `res.write`/streamed responses).

`ignore` accepts `"all"`, exact paths, or `"/prefix/*"` wildcards — same conventions as the Slack `routes` option below.

4. Trigger slack notifications on specific status codes on any routes you want

```javascript
app.use(
  bugwarden({
    logging: true, // Enable / Disable logging
    configureSlackNotification: {
      // Slack notification configuration
      webhookUrl: "<webhook URL>",
      throttleMs: 300000, // at most one alert per config every 5 minutes (optional)
      notificationConfig: [
        {
          onStatus: "5xx",
          message:
            {method} - {original-url} Failed with status code {status-code},
          routes: "all",
        },
      ],
    },
  })
);

// Status code examples
"all" for all status codes
"2xx" for all 200 status codes
"3xx" for all 300 status codes
"4xx,5xx" for all 400 and 500 status codes
"404" for an exact status code
"400,401,404,5xx" for specific codes combined with a range

// Route examples
"all" for all routes
"/api/user" for a specific route
"/api/user/*"  for all routes starting with "/api/user/
"/api/user,/api/admin,/api/public/*" multiple routes separated by comma ","

// Message properties
// For now bugwarden supports the following message properties
{ip}
{timestamp}
{method}
{original-url}
{http-version}
{status-code}
{content-length}
{referer}
{user-agent}
{response-time}
{request-id}
{response-body}
{error-message} // only meaningful with bugwardenErrorHandler
{error-stack}   // only meaningful with bugwardenErrorHandler
{occurrence-count} // total times this alert group has matched, including suppressed ones
Example : {method} - {original-url} Failed with status code {status-code}
Notification : GET - /abc/def/xyz Failed with status code 503
```

`throttleMs` caps how often a given `notificationConfig` entry can fire — useful when a crash loop or traffic spike would otherwise spam the channel with one message per matching request. Repeats inside the window are silently counted and folded into the next message that's actually sent, e.g. `... Failed with status code 503 (+42 more since last alert)`.

By default, throttling and `{occurrence-count}` group events by **route + status code**, not just by which `notificationConfig` entry matched. This matters for wildcard configs: without it, a single `routes: "all"` config would lump an outage on `/api/users` together with an unrelated one on `/api/orders` into the same throttle bucket, silently dropping alerts about the second incident. Override this with `groupBy` on a per-config basis:

```javascript
{
  onStatus: "5xx",
  routes: "all",
  message: "{method} {original-url} failing ({occurrence-count} times so far)",
  groupBy: ["route", "statusCode"], // default — track each route/status combination separately
  // groupBy: ["route"],                          // ignore status code, group purely by endpoint
  // groupBy: ["route", "statusCode", "errorMessage"], // with bugwardenErrorHandler: only
  //                                                       collapse repeats of the exact same error
}
```

5. Not on Slack? Trigger a generic webhook notification instead (or alongside it)

```javascript
app.use(
  bugwarden({
    configureWebhookNotification: {
      url: "<your webhook URL>",
      throttleMs: 300000, // optional, same behavior as Slack's throttleMs
      notificationConfig: [
        {
          onStatus: "5xx",
          message:
            {method} - {original-url} Failed with status code {status-code},
          routes: "all",
        },
      ],
    },
  })
);
```

Same `routes`, `onStatus`, `message`, and placeholder conventions as Slack notifications, but posts a plain `{ "message": "<templated message>" }` JSON body instead of Slack's `{ text }` envelope — useful for PagerDuty-style webhooks or your own internal services. `configureSlackNotification` and `configureWebhookNotification` can be used together; each has its own independent throttling.

6. On Discord instead? Same idea, using Discord's webhook format

```javascript
app.use(
  bugwarden({
    configureDiscordNotification: {
      webhookUrl: "<your Discord webhook URL>",
      throttleMs: 300000, // optional
      notificationConfig: [
        {
          onStatus: "5xx",
          message:
            {method} - {original-url} Failed with status code {status-code},
          routes: "all",
        },
      ],
    },
  })
);
```

Create a Discord webhook under a channel's **Settings > Integrations > Webhooks**. Same `routes`/`onStatus`/`message` conventions again, posting Discord's `{ content }` body shape. Can be combined with `configureSlackNotification` and/or `configureWebhookNotification` — all three run independently with their own throttling.

7. Catch thrown errors and stack traces, not just status codes

`bugwarden()` reports on the *response* a route produced. `bugwardenErrorHandler()` reports on errors *thrown* by a route (or passed to `next(err)`), including the stack trace — mount it after your routes (and after `bugwarden()`, if you use both):

```javascript
app.use(bugwarden());

app.get("/", (req, res) => {
  throw new Error("something broke");
});

// Must be registered after your routes, like any Express error-handling middleware
app.use(
  bugwardenErrorHandler({
    configureSlackNotification: {
      webhookUrl: "<webhook URL>",
      notificationConfig: [
        {
          onStatus: "all",
          routes: "all",
          message: "🐛 {method} {original-url} threw: {error-message}\n{error-stack}",
        },
      ],
    },
  })
);
```

It's non-intrusive: it logs, fires notifications, then always calls `next(err)` so your own error-response logic still runs — it never sends a response itself. Two new message placeholders are available here: `{error-message}` and `{error-stack}`. The response status is taken from `err.status`/`err.statusCode` when present, falling back to `500`. It accepts the exact same `BugwardenOptions` shape as `bugwarden()` (`logging`, `format`, `logger`, `configureSlackNotification`, `configureWebhookNotification`, `configureDiscordNotification`), so error alerts can go to their own channel/message, separate from request alerts. If you only imported `bugwarden`, it's also available as `bugwarden.errorHandler(options)`.

8. Zero-config mode: no code, just environment variables

If you'd rather not touch your app code at all, set one of these and `app.use(bugwarden())` / `app.use(bugwardenErrorHandler())` start alerting on their own, using sensible defaults (`onStatus: "4xx,5xx"`, `routes: "all"`):

```bash
BUGWARDEN_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
BUGWARDEN_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
BUGWARDEN_WEBHOOK_URL=https://your.internal/webhook
BUGWARDEN_THROTTLE_MS=300000       # optional, applied to zero-config channels
BUGWARDEN_NOTIFY_ON=4xx,5xx        # optional, overrides the default onStatus
BUGWARDEN_NOTIFY_ROUTES=all        # optional, overrides the default routes
```

Any channel you configure explicitly in code always wins — the env vars only fill in channels you haven't already set up yourself, so zero-config and code-based config can be mixed freely (e.g. Slack from code, Discord from an env var).

10. Not on Express? Use the Fastify plugin instead

`bugwarden/fastify` is a separate entry point exporting a Fastify plugin with the same options, logging output, and notification channels as `bugwarden()` + `bugwardenErrorHandler()` combined into one registration (Fastify's hook lifecycle doesn't need two separate ones). Requires `fastify` (v4 or v5) as a peer dependency — install it yourself if you don't already have it.

```javascript
const Fastify = require("fastify");
const { bugwardenFastify } = require("bugwarden/fastify");
// ESM: import { bugwardenFastify } from "bugwarden/fastify";

const app = Fastify();

app.register(
  bugwardenFastify({
    logging: true,
    configureSlackNotification: {
      webhookUrl: "<webhook URL>",
      notificationConfig: [
        { onStatus: "5xx", routes: "all", message: "{method} {original-url} failed: {error-message}" },
      ],
    },
  })
);

app.get("/", async (req, reply) => ({ hello: "world" }));

app.listen({ port: 3002 });
```

It logs and fires notifications on `onResponse` for normal traffic, and on `onError` for thrown/forwarded errors (with `{error-message}`/`{error-stack}` available, same as `bugwardenErrorHandler`) — a request that errors is only reported once, via the error path, not twice.

11. On Koa instead? Same idea, as Koa middleware

`bugwarden/koa` exports a Koa middleware with the same options and behavior. Koa's own `try { await next() } catch {}` onion model means one middleware naturally covers both a normal response and an error — register it early so it wraps everything downstream. Requires `koa` (v2+) as a peer dependency.

```javascript
const Koa = require("koa");
const { bugwardenKoa } = require("bugwarden/koa");
// ESM: import { bugwardenKoa } from "bugwarden/koa";

const app = new Koa();

app.use(
  bugwardenKoa({
    logging: true,
    configureSlackNotification: {
      webhookUrl: "<webhook URL>",
      notificationConfig: [
        { onStatus: "5xx", routes: "all", message: "{method} {original-url} failed: {error-message}" },
      ],
    },
  })
);

app.use((ctx) => {
  ctx.body = { hello: "world" };
});

app.listen(3002);
```

Thrown errors are logged/notified with `{error-message}`/`{error-stack}`, then rethrown so Koa's own `app.on("error", ...)` and any error-handling middleware you already have keep working unchanged.

12. Want a live view instead of scrolling logs? Mount the dashboard

`bugwarden/dashboard` is a self-contained Express router giving you a small local, in-memory web UI — recent requests, status-code breakdown, and slowest routes — with zero setup and no external service.

```javascript
const { bugwardenDashboard } = require("bugwarden/dashboard");
// ESM: import { bugwardenDashboard } from "bugwarden/dashboard";

app.use(bugwardenDashboard()); // UI + JSON API under /bugwarden
// app.use(bugwardenDashboard({ path: "/admin/monitor", maxEvents: 1000 }));
```

Open `http://localhost:<port>/bugwarden` in a browser. It polls its own JSON API (`/bugwarden/api/stats`, `/bugwarden/api/events`) every 5 seconds — no build step, no charting library, nothing else to install.

It's independent of `bugwarden()`/`bugwardenErrorHandler()` — mount it on its own, or alongside them for Slack/Discord/webhook alerts too. State is process-local, in-memory, and capped at `maxEvents` (default 500, oldest dropped first) — it's a local/dev observability tool, not a persistent log store, and it doesn't survive a restart or work across multiple processes/instances. Because it exposes request URLs, status codes, and timing, put it behind your own auth or IP allowlist if your app is reachable from outside your team.

13. **Define your routes and start your server:**

```javascript
app.get("/", (req, res) => {
  res.json("hello world");
});

app.listen(3002, () => {
  console.log("Listening on port 3002");
});
```

## Features

### paintShop(text, statusCode)

- Colors text based on HTTP status code ranges for visual distinction in logs.
- **Parameters:**
  - `text`: The text to be colored (string).
  - `statusCode`: The HTTP status code (number).
- **Returns:** A string with the colored text.

### BugWarden(req, res, next)

- Middleware function for logging HTTP request details and response time.
- **Parameters:**
  - `req`: The HTTP request object.
  - `res`: The HTTP response object.
  - `next`: The next middleware function.

### Logging Details:

- IP
- Timestamp (UTC)
- Method
- OriginalUrl
- HttpVersion
- Status
- Content-Length
- Referrer
- User-Agent
- Response-Time
- Request-Id
- Error-Message / Error-Stack (via `bugwardenErrorHandler`)

## Example Log Output

```yaml
ip: ::1
timestamp: Tue, 26 Dec 2023 12:00:00 GMT
method: GET
original-url: /
http-version: HTTP/1.1
status-code: 200
content-length: 12
referer: -
user-agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
response-time: 5ms
request-id: 3fa85f64-5717-4562-b3fc-2c963f66afa6
```

## Customize to Your Logging Needs

BugWarden offers a flexible way to enhance your Express.js logging experience. Feel free to tailor it to your specific requirements for optimal debugging and monitoring.
