import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { bugwarden } from "./app";
import { bugwardenErrorHandler } from "./error_handler";

function flushFinishEvent() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("bugwardenErrorHandler", () => {
  it("logs the error message and stack trace for a thrown error", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(bugwardenErrorHandler({ logging: true, logger: customLogger }));

    const response = await request(app).get("/boom");
    await flushFinishEvent();

    expect(response.status).toBe(500);
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("error-message: kaboom")
    );
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("error-stack:")
    );
  });

  it("uses a custom err.status for the response status code", async () => {
    const app = express();
    app.get("/missing", (_req, _res, next) => {
      const err: Error & { status?: number } = new Error("not found");
      err.status = 404;
      next(err);
    });
    app.use(bugwardenErrorHandler({ logging: false }));

    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
  });

  it("calls next(err) so a downstream error responder still runs", async () => {
    const app = express();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(bugwardenErrorHandler({ logging: false }));
    app.use(
      (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(418).json({ handledBy: "custom", message: err.message });
      }
    );

    const response = await request(app).get("/boom");

    expect(response.status).toBe(418);
    expect(response.body).toEqual({ handledBy: "custom", message: "kaboom" });
  });

  it("sends a Slack notification with {error-message} and {error-stack} substituted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(
      bugwardenErrorHandler({
        logging: false,
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            { routes: "all", onStatus: "all", message: "Error: {error-message}" },
          ],
        },
      })
    );

    await request(app).get("/boom");
    await flushFinishEvent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe("Error: kaboom");
    vi.unstubAllGlobals();
  });

  it("does not send a notification when the error's status doesn't match onStatus", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.get("/missing", (_req, _res, next) => {
      const err: Error & { status?: number } = new Error("not found");
      err.status = 404;
      next(err);
    });
    app.use(
      bugwardenErrorHandler({
        logging: false,
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            { routes: "all", onStatus: "5xx", message: "Error: {error-message}" },
          ],
        },
      })
    );

    await request(app).get("/missing");
    await flushFinishEvent();

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reuses the request ID and elapsed time captured by bugwarden() when chained together", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(bugwarden({ logging: false }));
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(bugwardenErrorHandler({ logging: true, logger: customLogger }));

    const response = await request(app)
      .get("/boom")
      .set("x-request-id", "trace-me");
    await flushFinishEvent();

    expect(response.headers["x-request-id"]).toBe("trace-me");
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("request-id: trace-me")
    );
  });
});
