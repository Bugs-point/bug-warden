import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNotificationThrottle, processDiscordNotification } from "./utility";
import type { BugwardenDiscordNotificationOptions } from "./discord_notification_options";

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

describe("processDiscordNotification", () => {
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
    const config: BugwardenDiscordNotificationOptions = {
      webhookUrl: "",
      notificationConfig: [{ routes: "all", onStatus: "all", message: "hi" }],
    };

    await processDiscordNotification(
      config,
      createRequest(),
      createResponse(500),
      new Date(),
      10
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts Discord's { content } body shape, not Slack's { text } or the generic { message }", async () => {
    const config: BugwardenDiscordNotificationOptions = {
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    await processDiscordNotification(
      config,
      createRequest(),
      createResponse(503),
      new Date(),
      10
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/123/abc");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ content: "failed" });
  });

  it("does not notify when the route matches but the status does not", async () => {
    const config: BugwardenDiscordNotificationOptions = {
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      notificationConfig: [
        { routes: "all", onStatus: "5xx", message: "failed" },
      ],
    };

    await processDiscordNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("substitutes message placeholders", async () => {
    const config: BugwardenDiscordNotificationOptions = {
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      notificationConfig: [
        {
          routes: "all",
          onStatus: "all",
          message: "{method} {original-url} trace={request-id}",
        },
      ],
    };

    await processDiscordNotification(
      config,
      createRequest({ originalUrl: "/api/user" }),
      createResponse(200),
      new Date(),
      10,
      console.log,
      "req-1"
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body).content).toBe(
      "GET /api/user trace=req-1"
    );
  });

  it("throttles independently of Slack and the generic webhook channel", async () => {
    const throttle = createNotificationThrottle();
    const config: BugwardenDiscordNotificationOptions = {
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      throttleMs: 60000,
      notificationConfig: [
        { routes: "all", onStatus: "all", message: "hit" },
      ],
    };

    await processDiscordNotification(
      config,
      createRequest(),
      createResponse(200),
      new Date(),
      10,
      console.log,
      undefined,
      throttle
    );
    await processDiscordNotification(
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
});
