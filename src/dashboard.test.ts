import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { bugwardenDashboard } from "./dashboard";
import { createDashboardStore } from "./dashboard_store";

function flushFinishEvent() {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

describe("bugwardenDashboard", () => {
  it("serves the dashboard HTML page at the default path", async () => {
    const app = express();
    app.use(bugwardenDashboard());

    const response = await request(app).get("/bugwarden");

    expect(response.status).toBe(200);
    expect(response.type).toBe("text/html");
    expect(response.text).toContain("BugWarden Dashboard");
  });

  it("serves the dashboard at a custom path", async () => {
    const app = express();
    app.use(bugwardenDashboard({ path: "/admin/monitor" }));

    const response = await request(app).get("/admin/monitor");

    expect(response.status).toBe(200);
    expect(response.text).toContain("BugWarden Dashboard");
  });

  it("records requests and exposes them via the events API", async () => {
    const app = express();
    app.use(bugwardenDashboard());
    app.get("/hello", (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get("/hello");
    await flushFinishEvent();

    const response = await request(app).get("/bugwarden/api/events");
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      method: "GET",
      route: "/hello",
      statusCode: 200,
    });
  });

  it("exposes aggregated stats via the stats API", async () => {
    const app = express();
    app.use(bugwardenDashboard());
    app.get("/ok", (_req, res) => res.status(200).json({ ok: true }));
    app.get("/broken", (_req, res) => res.status(500).json({ error: "boom" }));

    await request(app).get("/ok");
    await request(app).get("/broken");
    await flushFinishEvent();

    const response = await request(app).get("/bugwarden/api/stats");
    expect(response.status).toBe(200);
    expect(response.body.totalRequests).toBe(2);
    expect(response.body.errorCount).toBe(1);
    expect(response.body.statusBreakdown["2xx"]).toBe(1);
    expect(response.body.statusBreakdown["5xx"]).toBe(1);
  });

  it("does not record its own dashboard UI/API requests", async () => {
    const app = express();
    app.use(bugwardenDashboard());

    await request(app).get("/bugwarden");
    await request(app).get("/bugwarden/api/stats");
    await request(app).get("/bugwarden/api/events");
    await flushFinishEvent();

    const response = await request(app).get("/bugwarden/api/stats");
    expect(response.body.totalRequests).toBe(0);
  });

  it("includes the x-request-id when present on the response", async () => {
    const app = express();
    app.use((req, res, next) => {
      res.setHeader("x-request-id", "trace-me");
      next();
    });
    app.use(bugwardenDashboard());
    app.get("/hello", (_req, res) => res.status(200).json({ ok: true }));

    await request(app).get("/hello");
    await flushFinishEvent();

    const response = await request(app).get("/bugwarden/api/events");
    expect(response.body[0].requestId).toBe("trace-me");
  });

  it("reuses an externally-provided store instead of creating its own", async () => {
    const sharedStore = createDashboardStore();
    sharedStore.record({
      timestamp: new Date().toISOString(),
      method: "GET",
      route: "/pre-existing",
      statusCode: 200,
      responseTime: 5,
    });

    const app = express();
    app.use(bugwardenDashboard({ store: sharedStore }));

    const response = await request(app).get("/bugwarden/api/events");
    expect(response.body).toHaveLength(1);
    expect(response.body[0].route).toBe("/pre-existing");
  });
});
