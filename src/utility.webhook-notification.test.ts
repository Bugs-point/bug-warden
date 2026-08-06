import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationThrottle, processWebhookNotification } from "./utility";
import type { BugwardenWebhookNotificationOptions } from "./webhook_notification_options";

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

describe("processWebhookNotification", () => {
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

  it("does nothing when no URL is configured", async () => {
    const config: BugwardenWebhookNotificationOptions = {
      url: "",
      notificationConfig: [{ routes: "all", onStatus: "all", message: "hi" }],
    };

    await processWebhookNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a { message } body, not Slack's { text } envelope", async () => {
    const config: BugwardenWebhookNotificationOptions = {
      url: "https://example.com/webhook",
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    await processWebhookNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ message: "failed" });
  });

  it("does not notify when the route matches but the status does not", async () => {
    const config: BugwardenWebhookNotificationOptions = {
      url: "https://example.com/webhook",
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    await processWebhookNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("substitutes message placeholders including {request-id}", async () => {
    const config: BugwardenWebhookNotificationOptions = {
      url: "https://example.com/webhook",
      notificationConfig: [
        {
          routes: "all",
          onStatus: "all",
          message: "{method} {original-url} trace={request-id}",
        },
      ],
    };

    await processWebhookNotification(
      config,
      createRequest({ originalUrl: "/api/user" }),
      createResponse(200),
      new Date(),
      10,
      console.log,
      "req-1"
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).message).toBe(
      "GET /api/user trace=req-1"
    );
  });

  it("throttles independently of Slack notifications", async () => {
    const throttle = createNotificationThrottle();
    const config: BugwardenWebhookNotificationOptions = {
      url: "https://example.com/webhook",
      throttleMs: 60000,
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "hit" },
      ],
    };

    await processWebhookNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    await processWebhookNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs an error through the provided logger when the request fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const customLogger = vi.fn();

    const config: BugwardenWebhookNotificationOptions = {
      url: "https://example.com/webhook",
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "hit" },
      ],
    };

    await processWebhookNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10,
      customLogger
    );

    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("Cannot access webhook url")
    );
  });
});
