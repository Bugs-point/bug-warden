import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bugwardenFastify } from "./fastify";

describe("bugwardenFastify", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes requests through to the route handler", async () => {
    const app = Fastify();
    await app.register(bugwardenFastify({ logging: false }));
    app.get("/", async () => ({ ok: true }));

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("logs the request through a custom logger", async () => {
    const customLogger = vi.fn();
    const app = Fastify();
    await app.register(bugwardenFastify({ logging: true, logger: customLogger }));
    app.get("/", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/" });

    expect(customLogger).toHaveBeenCalledTimes(1);
    expect(customLogger.mock.calls[0][0]).toContain("method: GET");
  });

  it("generates and echoes an x-request-id header", async () => {
    const app = Fastify();
    await app.register(bugwardenFastify({ logging: false }));
    app.get("/", async () => ({ ok: true }));

    const generated = await app.inject({ method: "GET", url: "/" });
    expect(generated.headers["x-request-id"]).toBeTruthy();

    const echoed = await app.inject({
      method: "GET",
      url: "/",
      headers: { "x-request-id": "trace-me" },
    });
    expect(echoed.headers["x-request-id"]).toBe("trace-me");
  });

  it("skips logging entirely for ignored routes", async () => {
    const customLogger = vi.fn();
    const app = Fastify();
    await app.register(
      bugwardenFastify({ logging: true, logger: customLogger, ignore: ["/health"] })
    );
    app.get("/health", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/health" });

    expect(customLogger).not.toHaveBeenCalled();
  });

  it("fires a Slack notification for a matching response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = Fastify();
    await app.register(
      bugwardenFastify({
        logging: false,
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            { routes: "all", onStatus: "5xx", message: "{method} {original-url} failed" },
          ],
        },
      })
    );
    app.get("/boom", async (_req, reply) => {
      reply.status(500);
      return { error: "boom" };
    });

    await app.inject({ method: "GET", url: "/boom" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("GET /boom failed");
  });

  it("logs and notifies with error-message/error-stack when a route handler throws", async () => {
    const customLogger = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = Fastify();
    await app.register(
      bugwardenFastify({
        logging: true,
        logger: customLogger,
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            { routes: "all", onStatus: "all", message: "Error: {error-message}" },
          ],
        },
      })
    );
    app.get("/boom", async () => {
      throw new Error("kaboom");
    });

    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("error-message: kaboom")
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("Error: kaboom");
  });

  it("wires up notifications from BUGWARDEN_* env vars with no code config", async () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = Fastify();
    await app.register(bugwardenFastify({ logging: false }));
    app.get("/boom", async (_req, reply) => {
      reply.status(500);
      return { error: "boom" };
    });

    await app.inject({ method: "GET", url: "/boom" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/hook");

    vi.unstubAllEnvs();
  });
});
