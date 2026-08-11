import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationThrottle, processSlackNotification } from "./utility";
import type { BugwardenSlackNotificationOptions } from "./slack_notification_options";

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    ip: "127.0.0.1",
    method: "GET",
    originalUrl: "/api/user",
    httpVersion: "1.1",
    route: undefined,
    get: () => undefined,
    ...overrides,
  } as Request;
}

function createResponse(statusCode: number): Response {
  return {
    statusCode,
    getHeader: () => undefined,
  } as unknown as Response;
}

describe("processSlackNotification", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does nothing when no webhook URL is configured", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "",
      notificationConfig: [{ routes: "all", onStatus: "all", message: "hi" }],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("matches routes: 'all' against any URL (regression: 'all' route never matched anything)", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "hit" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/anything/goes" }),
      createResponse(200),
      new Date(),
      10
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the route matches but the status does not (regression: status check read the wrong array)", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("notifies when both route and status match", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("evaluates each notificationConfig entry independently (regression: match flags leaked across entries)", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "first" },
        { routes: "/only-this-route", onStatus: "404", message: "second" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/user" }),
      createResponse(200),
      new Date(),
      10
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ text: "first" });
  });

  it("substitutes {response-time} in the message (regression: missing braces skipped substitution)", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "took {response-time}ms" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      42
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).text).toBe("took 42ms");
  });

  it("substitutes {request-id} when a requestId is passed, falls back to '-' otherwise", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "trace: {request-id}" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10,
      console.log,
      "req-42"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe(
      "trace: req-42"
    );

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).toBe("trace: -");
  });

  it("matches an exact status code", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "404", message: "not found" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(400),
      new Date(),
      10
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(404),
      new Date(),
      10
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("matches wildcard routes", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [{ routes: "/api/*", onStatus: "all", message: "hit" }],
    };

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/other" }),
      createResponse(200),
      new Date(),
      10
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/user" }),
      createResponse(200),
      new Date(),
      10
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("matches multiple comma-separated exact routes", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        {
          routes: "/api/user,/api/admin",
          onStatus: "all",
          message: "hit",
        },
      ],
    };

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/admin" }),
      createResponse(200),
      new Date(),
      10
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends diagnostic messages to a custom logger instead of console.log", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const customLogger = vi.fn();

    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "",
      notificationConfig: [{ routes: "all", onStatus: "all", message: "hi" }],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10,
      customLogger
    );

    expect(logSpy).not.toHaveBeenCalled();
    expect(customLogger).toHaveBeenCalledTimes(1);
    expect(customLogger.mock.calls[0][0]).toContain(
      "Please provide a webhook URL"
    );
  });

  it("throttles repeated notifications for the same config and reports suppressed count", async () => {
    vi.useFakeTimers();

    const throttle = createNotificationThrottle();
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      throttleMs: 60000,
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    // First match sends immediately.
    await processSlackNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    // Two more within the window are suppressed.
    await processSlackNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    await processSlackNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60000);

    // Window reopened: this one sends, and reports the two suppressed in between.
    await processSlackNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).toBe(
      "failed (+2 more since last alert)"
    );

    vi.useRealTimers();
  });

  it("groups by route+statusCode by default, so a wildcard config throttles each route independently", async () => {
    vi.useFakeTimers();

    const throttle = createNotificationThrottle();
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      throttleMs: 60000,
      notificationConfig: [{ routes: "all", onStatus: "5xx", message: "failed" }],
    };

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/users" }),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    // Different route matching the same wildcard config: not suppressed, since it's a
    // distinct incident by default (route + statusCode) grouping.
    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/orders" }),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("honors a custom groupBy to widen or narrow what counts as the same alert", async () => {
    vi.useFakeTimers();

    const throttle = createNotificationThrottle();
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      throttleMs: 60000,
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed", groupBy: ["statusCode"] },
      ],
    };

    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/users" }),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    // Same statusCode, different route: grouped together (and thus suppressed) because
    // groupBy only considers statusCode here.
    await processSlackNotification(
      config,
      createRequest({ originalUrl: "/api/orders" }),
      createResponse(503),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("substitutes {occurrence-count} with the running total for the group", async () => {
    const throttle = createNotificationThrottle();
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "Seen {occurrence-count} times" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    await processSlackNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe("Seen 1 times");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text).toBe("Seen 2 times");
  });

  it("substitutes {request-body}, {request-params}, {request-query}, and {request-headers}", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        {
          routes: "all",
          onStatus: "all",
          message: "body={request-body} params={request-params} query={request-query} headers={request-headers}",
        },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10,
      console.log,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        body: '{"email":"x@y.com"}',
        params: '{"id":"42"}',
        query: '{"debug":"true"}',
        headers: '{"authorization":"[REDACTED]"}',
      }
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe(
      'body={"email":"x@y.com"} params={"id":"42"} query={"debug":"true"} headers={"authorization":"[REDACTED]"}'
    );
  });

  it("falls back to '-' for request capture placeholders when nothing was captured", async () => {
    const config: BugwardenSlackNotificationOptions = {
      webhookUrl: "https://hooks.slack.com/test",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "body={request-body}" },
      ],
    };

    await processSlackNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10
    );

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toBe("body=-");
  });
});
