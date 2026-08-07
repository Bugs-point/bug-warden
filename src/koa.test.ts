import Koa from "koa";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bugwardenKoa } from "./koa";

function flushEvent() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("bugwardenKoa", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("passes requests through to the downstream middleware", async () => {
    const app = new Koa();
    app.use(bugwardenKoa({ logging: false }));
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });

    const response = await request(app.callback()).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("logs the request through a custom logger", async () => {
    const customLogger = vi.fn();
    const app = new Koa();
    app.use(bugwardenKoa({ logging: true, logger: customLogger }));
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });

    await request(app.callback()).get("/");

    expect(customLogger).toHaveBeenCalledTimes(1);
    expect(customLogger.mock.calls[0][0]).toContain("method: GET");
  });

  it("generates and echoes an x-request-id header", async () => {
    const app = new Koa();
    app.use(bugwardenKoa({ logging: false }));
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });

    const generated = await request(app.callback()).get("/");
    expect(generated.headers["x-request-id"]).toBeTruthy();

    const echoed = await request(app.callback())
      .get("/")
      .set("x-request-id", "trace-me");
    expect(echoed.headers["x-request-id"]).toBe("trace-me");
  });

  it("skips logging entirely for ignored routes", async () => {
    const customLogger = vi.fn();
    const app = new Koa();
    app.use(bugwardenKoa({ logging: true, logger: customLogger, ignore: ["/health"] }));
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });

    await request(app.callback()).get("/health");

    expect(customLogger).not.toHaveBeenCalled();
  });

  it("fires a Slack notification for a matching response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = new Koa();
    app.use(
      bugwardenKoa({
        logging: false,
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            { routes: "all", onStatus: "5xx", message: "{method} {original-url} failed" },
          ],
        },
      })
    );
    app.use((ctx) => {
      ctx.status = 500;
      ctx.body = { error: "boom" };
    });

    await request(app.callback()).get("/boom");
    await flushEvent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("GET /boom failed");
  });

  it("logs and notifies with error-message/error-stack when downstream throws, then rethrows for Koa's own error handling", async () => {
    const customLogger = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = new Koa();
    app.silent = true; // suppress Koa's default console.error for the expected error
    let onErrorEmitted: unknown;
    app.on("error", (err) => {
      onErrorEmitted = err;
    });

    app.use(
      bugwardenKoa({
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
    app.use(() => {
      throw new Error("kaboom");
    });

    const response = await request(app.callback()).get("/boom");
    await flushEvent();

    expect(response.status).toBe(500);
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("error-message: kaboom")
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("Error: kaboom");
    expect((onErrorEmitted as Error)?.message).toBe("kaboom");
  });

  it("uses a custom err.status for the response status code", async () => {
    const app = new Koa();
    app.silent = true;
    app.on("error", () => {});
    app.use(bugwardenKoa({ logging: false }));
    app.use(() => {
      const err: Error & { status?: number } = new Error("not found");
      err.status = 404;
      throw err;
    });

    const response = await request(app.callback()).get("/missing");

    expect(response.status).toBe(404);
  });

  it("wires up notifications from BUGWARDEN_* env vars with no code config", async () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = new Koa();
    app.use(bugwardenKoa({ logging: false }));
    app.use((ctx) => {
      ctx.status = 500;
      ctx.body = { error: "boom" };
    });

    await request(app.callback()).get("/boom");
    await flushEvent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/hook");
  });
});
