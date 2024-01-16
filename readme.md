# BugWarden

## Enhance Your Express.js Logging with Colorful Status Codes and Detailed Logs

BugWarden is an npm package designed to make your Express.js application's logging more informative and visually appealing. It provides:

- **Colorful status code indications** for easy log scanning
- **Detailed request-response logs**, including response times
- **Middleware integration** for effortless tracking of HTTP activity

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
```

4. **Define your routes and start your server:**

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

## Example Log Output

```yaml
IP: ::1
Timestamp: [Tue, 26 Dec 2023 12:00:00 GMT]
Method: GET
OriginalUrl: /
HttpVersion: HTTP/1.1
Status: 200
Content-Length: 12
Referrer: -
User-Agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36"
Response-Time: 5ms
```

## Customize to Your Logging Needs

BugWarden offers a flexible way to enhance your Express.js logging experience. Feel free to tailor it to your specific requirements for optimal debugging and monitoring.
