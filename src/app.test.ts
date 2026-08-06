import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { bugwarden } from "./app";

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
});
