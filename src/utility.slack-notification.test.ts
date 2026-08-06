import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { processSlackNotification } from "./utility";
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
});
