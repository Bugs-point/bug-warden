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
});
