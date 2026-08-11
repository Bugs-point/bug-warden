import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { bugwarden } from "./app";

function flushFinishEvent() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("bugwarden middleware", () => {
  it("passes requests through to the route handler", async () => {
    const app = express();
    app.use(bugwarden({ logging: false }));
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("skips logging entirely for ignored routes", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = express();
    app.use(bugwarden({ logging: true, ignore: ["/health"] }));
    app.get("/health", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get("/health");
    await flushFinishEvent();

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("logs normally for routes outside the ignore list", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = express();
    app.use(bugwarden({ logging: true, ignore: ["/health"] }));
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(logSpy).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  it("routes log output through a custom logger instead of console.log", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const customLogger = vi.fn();
    const app = express();
    app.use(bugwarden({ logging: true, logger: customLogger }));
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(logSpy).not.toHaveBeenCalled();
    expect(customLogger).toHaveBeenCalledTimes(1);
    logSpy.mockRestore();
  });

  it("generates an x-request-id response header when the client doesn't send one", async () => {
    const app = express();
    app.use(bugwarden({ logging: false }));
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get("/");

    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("echoes back an incoming x-request-id instead of generating a new one", async () => {
    const app = express();
    app.use(bugwarden({ logging: false }));
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get("/")
      .set("x-request-id", "client-supplied-id");

    expect(response.headers["x-request-id"]).toBe("client-supplied-id");
  });

  it("includes the request ID in the log output", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(bugwarden({ logging: true, logger: customLogger }));
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get("/").set("x-request-id", "trace-me");
    await flushFinishEvent();

    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("request-id: trace-me")
    );
  });

  it("fires the generic webhook channel independently of Slack", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(
      bugwarden({
        logging: false,
        configureWebhookNotification: {
          url: "https://example.com/webhook",
          notificationConfig: [
            { routes: "all", onStatus: "all", message: "hit" },
          ],
        },
      })
    );
    app.get("/", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/webhook");
    vi.unstubAllGlobals();
  });

  it("captures the response body from res.json when captureResponseBody is set", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(bugwarden({ logging: true, logger: customLogger, captureResponseBody: 200 }));
    app.get("/", (_req, res) => {
      res.status(500).json({ error: "boom" });
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining('response-body: {"error":"boom"}')
    );
  });

  it("truncates the captured response body at the configured character limit", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(bugwarden({ logging: true, logger: customLogger, captureResponseBody: 5 }));
    app.get("/", (_req, res) => {
      res.status(500).send("a very long error message");
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining("response-body: a ver…(truncated)")
    );
  });

  it("does not capture or log a response body when captureResponseBody is not set", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(bugwarden({ logging: true, logger: customLogger }));
    app.get("/", (_req, res) => {
      res.status(500).json({ error: "boom" });
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(customLogger).toHaveBeenCalledWith(
      expect.not.stringContaining("response-body")
    );
  });

  it("includes the captured response body in Slack notification messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(
      bugwarden({
        logging: false,
        captureResponseBody: 200,
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            {
              routes: "all",
              onStatus: "5xx",
              message: "Failed: {response-body}",
            },
          ],
        },
      })
    );
    app.get("/", (_req, res) => {
      res.status(500).json({ error: "boom" });
    });

    await request(app).get("/");
    await flushFinishEvent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe('Failed: {"error":"boom"}');
    vi.unstubAllGlobals();
  });

  it("captures request body, params, and query when the response status matches a captureRequestData rule", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(express.json());
    app.use(
      bugwarden({
        logging: true,
        logger: customLogger,
        captureRequestData: [
          { onStatus: "5xx", fields: ["body", "params", "query"] },
        ],
      })
    );
    app.post("/orders/:id", (_req, res) => {
      res.status(500).json({ error: "boom" });
    });

    await request(app).post("/orders/42?debug=true").send({ amount: 100 });
    await flushFinishEvent();

    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining('request-body: {"amount":100}')
    );
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining('request-params: {"id":"42"}')
    );
    expect(customLogger).toHaveBeenCalledWith(
      expect.stringContaining('request-query: {"debug":"true"}')
    );
  });

  it("does not capture request data when the status doesn't match any captureRequestData rule", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(express.json());
    app.use(
      bugwarden({
        logging: true,
        logger: customLogger,
        captureRequestData: [{ onStatus: "5xx", fields: ["body"] }],
      })
    );
    app.post("/orders", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await request(app).post("/orders").send({ amount: 100 });
    await flushFinishEvent();

    expect(customLogger).toHaveBeenCalledWith(
      expect.not.stringContaining("request-body")
    );
  });

  it("redacts sensitive headers by default when capturing request headers", async () => {
    const customLogger = vi.fn();
    const app = express();
    app.use(
      bugwarden({
        logging: true,
        logger: customLogger,
        captureRequestData: [{ onStatus: "5xx", fields: ["headers"] }],
      })
    );
    app.get("/", (_req, res) => {
      res.status(500).json({ error: "boom" });
    });

    await request(app).get("/").set("Authorization", "Bearer secret-token");
    await flushFinishEvent();

    const call = customLogger.mock.calls.find((c) => c[0].includes("request-headers"));
    expect(call?.[0]).toContain('"authorization":"[REDACTED]"');
    expect(call?.[0]).not.toContain("secret-token");
  });

  it("includes captured request data in Slack notification messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const app = express();
    app.use(express.json());
    app.use(
      bugwarden({
        logging: false,
        captureRequestData: [{ onStatus: "5xx", fields: ["body"] }],
        configureSlackNotification: {
          webhookUrl: "https://hooks.slack.com/test",
          notificationConfig: [
            {
              routes: "all",
              onStatus: "5xx",
              message: "Payload was: {request-body}",
            },
          ],
        },
      })
    );
    app.post("/", (_req, res) => {
      res.status(500).json({ error: "boom" });
    });

    await request(app).post("/").send({ email: "user@example.com" });
    await flushFinishEvent();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.text).toBe('Payload was: {"email":"user@example.com"}');
    vi.unstubAllGlobals();
  });
});
