import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  bugwardenLog,
  coloredLogs,
  isIgnoredRoute,
  matchesRoute,
  processLog,
} from "./utility";

function createRequest(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string | undefined> = {
    referrer: undefined,
    "user-agent": "test-agent",
  };

  return {
    ip: "127.0.0.1",
    method: "GET",
    originalUrl: "/test",
    httpVersion: "1.1",
    get: (name: string) => headers[name.toLowerCase()],
    ...overrides,
  } as Request;
}

function createResponse(
  overrides: {
    statusCode?: number;
    headers?: Record<string, string | number>;
  } = {}
): Response {
  const headers = overrides.headers ?? {};
  return {
    statusCode: overrides.statusCode ?? 200,
    getHeader: (name: string) => headers[name],
  } as unknown as Response;
}

describe("coloredLogs", () => {
  it("colors 2xx status codes green", () => {
    expect(coloredLogs("ok", 200)).toBe("\x1b[32mok\x1b[0m");
  });

  it("colors 4xx status codes yellow", () => {
    expect(coloredLogs("bad", 404)).toBe("\x1b[33mbad\x1b[0m");
  });

  it("colors 5xx status codes red", () => {
    expect(coloredLogs("error", 500)).toBe("\x1b[31merror\x1b[0m");
  });
});

describe("processLog", () => {
  it("returns an empty string when logging is disabled", () => {
    const req = createRequest();
    const res = createResponse();

    expect(processLog(req, res, 12, false)).toBe("");
  });

  it("includes every field when logging is true", () => {
    const req = createRequest();
    const res = createResponse({
      statusCode: 200,
      headers: { "content-length": "34" },
    });

    const log = processLog(req, res, 12, true);

    expect(log).toContain("ip: 127.0.0.1");
    expect(log).toContain("method: GET");
    expect(log).toContain("original-url: /test");
    expect(log).toContain("http-version: HTTP/1.1");
    expect(log).toContain("status-code: 200");
    expect(log).toContain("content-length: 34");
    expect(log).toContain("referer: -");
    expect(log).toContain("user-agent: test-agent");
    expect(log).toContain("response-time: 12ms");
  });

  it("defaults to logging everything when the option is omitted", () => {
    const req = createRequest();
    const res = createResponse();

    expect(processLog(req, res, 5, undefined)).toContain("response-time: 5ms");
  });

  it("includes only the requested fields when logging is an array", () => {
    const req = createRequest();
    const res = createResponse({ statusCode: 404 });

    const log = processLog(req, res, 8, ["method", "statusCode"]);

    expect(log).toContain("method: GET");
    expect(log).toContain("status-code: 404");
    expect(log).not.toContain("ip:");
    expect(log).not.toContain("response-time");
  });

  it("returns an empty string when the logging array is empty", () => {
    const req = createRequest();
    const res = createResponse();

    expect(processLog(req, res, 3, [])).toBe("");
  });

  it("falls back to 0 for content-length and '-' for referrer when headers are missing", () => {
    const req = createRequest();
    const res = createResponse();

    const log = processLog(req, res, 1, ["contentLength", "referrer"]);

    expect(log).toContain("content-length: 0");
    expect(log).toContain("referer: -");
  });

  it("wraps the log block in a single color escape based on status code", () => {
    const req = createRequest();
    const res = createResponse({ statusCode: 500 });

    const log = processLog(req, res, 1, ["method"]);

    expect(log).toBe("\n\x1b[31mmethod: GET\x1b[0m\n");
  });

  it("emits a single-line JSON object when format is 'json'", () => {
    const req = createRequest();
    const res = createResponse({
      statusCode: 404,
      headers: { "content-length": "12" },
    });

    const log = processLog(req, res, 7, true, "json");

    expect(log).not.toContain("\x1b[");
    expect(JSON.parse(log)).toEqual({
      ip: "127.0.0.1",
      timestamp: expect.any(String),
      method: "GET",
      originalURL: "/test",
      httpVersion: "HTTP/1.1",
      statusCode: 404,
      contentLength: 12,
      referrer: "-",
      userAgent: "test-agent",
      responseTime: 7,
    });
  });

  it("only includes selected fields in JSON output", () => {
    const req = createRequest();
    const res = createResponse({ statusCode: 200 });

    const log = processLog(req, res, 3, ["method", "statusCode"], "json");

    expect(JSON.parse(log)).toEqual({ method: "GET", statusCode: 200 });
  });

  it("returns an empty string for JSON format when logging is disabled", () => {
    const req = createRequest();
    const res = createResponse();

    expect(processLog(req, res, 3, false, "json")).toBe("");
  });
});

describe("matchesRoute", () => {
  it("matches exact routes", () => {
    expect(matchesRoute("/api/user", "/api/user")).toBe(true);
    expect(matchesRoute("/api/user", "/api/admin")).toBe(false);
  });

  it("matches wildcard routes by prefix", () => {
    expect(matchesRoute("/api/user/123", "/api/user/*")).toBe(true);
    expect(matchesRoute("/other", "/api/user/*")).toBe(false);
  });
});

describe("isIgnoredRoute", () => {
  it("returns false when no ignore list is configured", () => {
    expect(isIgnoredRoute("/health", undefined)).toBe(false);
    expect(isIgnoredRoute("/health", [])).toBe(false);
  });

  it("ignores everything when the list includes 'all'", () => {
    expect(isIgnoredRoute("/anything", ["all"])).toBe(true);
  });

  it("matches exact and wildcard entries in the ignore list", () => {
    const ignore = ["/health", "/internal/*"];

    expect(isIgnoredRoute("/health", ignore)).toBe(true);
    expect(isIgnoredRoute("/internal/status", ignore)).toBe(true);
    expect(isIgnoredRoute("/api/user", ignore)).toBe(false);
  });
});

describe("bugwardenLog", () => {
  it("defaults to console.log when no logger is provided", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    bugwardenLog("hello");

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain("hello");
    logSpy.mockRestore();
  });

  it("sends output to a custom logger instead of console.log", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const customLogger = vi.fn();

    bugwardenLog("hello", "ERROR", customLogger);

    expect(logSpy).not.toHaveBeenCalled();
    expect(customLogger).toHaveBeenCalledTimes(1);
    expect(customLogger.mock.calls[0][0]).toContain("hello");
    logSpy.mockRestore();
  });
});
