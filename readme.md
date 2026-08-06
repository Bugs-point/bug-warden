# BugWarden

[![npm version](https://img.shields.io/npm/v/bugwarden.svg)](https://www.npmjs.com/package/bugwarden)
[![npm downloads](https://img.shields.io/npm/dm/bugwarden.svg)](https://www.npmjs.com/package/bugwarden)
[![Build Status](https://github.com/Bugs-point/bug-warden/actions/workflows/main.yml/badge.svg)](https://github.com/Bugs-point/bug-warden/actions/workflows/main.yml)
[![License: MIT](https://img.shields.io/npm/l/bugwarden.svg)](https://github.com/Bugs-point/bug-warden/blob/master/LICENSE)

## Enhance Your Express.js Logging with Colorful Status Codes and Detailed Logs

BugWarden is an npm package designed to make your Express.js application's logging more informative and visually appealing. It provides:

- **Colorful status code indications** for easy log scanning
- **Detailed request-response logs**, including response times
- **Middleware integration** for effortless tracking of HTTP activity
- **Slack alerts** triggered by HTTP status code and route, with no separate account or service to sign up for

## Why BugWarden?

| | BugWarden | Morgan | Winston | Sentry |
|---|---|---|---|---|
| Express request/response logging | ✅ | ✅ | Manual setup | ❌ |
| Colored status-code output | ✅ | Via custom format | Depends on transport | ❌ |
| Slack alerts on status code + route, zero config | ✅ | ❌ | ❌ | Via separate integration |
| Requires an external account/service | No | No | No | Yes |
| Captures error stack traces | Not yet | ❌ | General-purpose logger | ✅ |

BugWarden isn't trying to replace full error-tracking platforms like Sentry — think of it as Morgan-style request logging with Slack alerting built in, for teams who want a signal in their team chat without standing up another service. Stack-trace capture is on the roadmap.

## Installation

To install BugWarden, use npm:

```bash
npm install bugwarden
```

## Usage

1. **Require BugWarden** in your Express.js application:

```javascript
// Common JS method
const express = require("express");
const { bugwarden } = require("bugwarden");
const app = express();

// ES Module method
import express from "express";
import { bugwarden } from "bugwarden";
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
Example : {method} - {original-url} Failed with status code {status-code}
Notification : GET - /abc/def/xyz Failed with status code 503
```

`throttleMs` caps how often a given `notificationConfig` entry can fire — useful when a crash loop or traffic spike would otherwise spam the channel with one message per matching request. Repeats inside the window are silently counted and folded into the next message that's actually sent, e.g. `... Failed with status code 503 (+42 more since last alert)`.

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

7. **Define your routes and start your server:**

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
