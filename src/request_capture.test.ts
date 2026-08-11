import type { Request } from "express";
import { describe, expect, it } from "vitest";
import {
  collectCapturedRequestFields,
  findMatchingCaptureRule,
  truncateText,
} from "./utility";
import type { BugwardenRequestCaptureConfig } from "./request_capture_config";

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: { email: "user@example.com" },
    params: { id: "42" },
    query: { debug: "true" },
    headers: {
      "content-type": "application/json",
      authorization: "Bearer secret-token",
      cookie: "session=abc123",
      "x-request-id": "req-1",
    },
    ...overrides,
  } as unknown as Request;
}

describe("truncateText", () => {
  it("returns text unchanged when under the limit", () => {
    expect(truncateText("hello", 100)).toBe("hello");
  });

  it("truncates and appends a marker when over the limit", () => {
    expect(truncateText("hello world", 5)).toBe("hello…(truncated)");
  });
});

describe("findMatchingCaptureRule", () => {
  it("returns undefined when no rules are configured", () => {
    expect(findMatchingCaptureRule(undefined, "/api/users", 500)).toBeUndefined();
    expect(findMatchingCaptureRule([], "/api/users", 500)).toBeUndefined();
  });

  it("matches a rule by exact status code", () => {
    const rules: BugwardenRequestCaptureConfig[] = [
      { onStatus: "500", fields: ["body"] },
    ];
    expect(findMatchingCaptureRule(rules, "/api/users", 500)).toBe(rules[0]);
    expect(findMatchingCaptureRule(rules, "/api/users", 404)).toBeUndefined();
  });

  it("matches a rule by status range", () => {
    const rules: BugwardenRequestCaptureConfig[] = [
      { onStatus: "4xx,5xx", fields: ["body", "headers"] },
    ];
    expect(findMatchingCaptureRule(rules, "/x", 400)).toBe(rules[0]);
    expect(findMatchingCaptureRule(rules, "/x", 500)).toBe(rules[0]);
    expect(findMatchingCaptureRule(rules, "/x", 200)).toBeUndefined();
  });

  it("defaults routes to 'all' when omitted", () => {
    const rules: BugwardenRequestCaptureConfig[] = [
      { onStatus: "500", fields: ["body"] },
    ];
    expect(findMatchingCaptureRule(rules, "/anything/at/all", 500)).toBe(rules[0]);
  });

  it("respects an explicit routes filter", () => {
    const rules: BugwardenRequestCaptureConfig[] = [
      { onStatus: "500", routes: "/api/orders", fields: ["body"] },
    ];
    expect(findMatchingCaptureRule(rules, "/api/orders", 500)).toBe(rules[0]);
    expect(findMatchingCaptureRule(rules, "/api/users", 500)).toBeUndefined();
  });

  it("returns the first matching rule when multiple rules could match", () => {
    const rules: BugwardenRequestCaptureConfig[] = [
      { onStatus: "5xx", fields: ["headers"] },
      { onStatus: "500", fields: ["body", "params", "query", "headers"] },
    ];
    expect(findMatchingCaptureRule(rules, "/x", 500)).toBe(rules[0]);
  });
});

describe("collectCapturedRequestFields", () => {
  it("captures only the fields listed in the rule", () => {
    const req = createRequest();
    const rule: BugwardenRequestCaptureConfig = { onStatus: "500", fields: ["body"] };

    const captured = collectCapturedRequestFields(req, rule);

    expect(captured.body).toBe('{"email":"user@example.com"}');
    expect(captured.params).toBeUndefined();
    expect(captured.query).toBeUndefined();
    expect(captured.headers).toBeUndefined();
  });

  it("captures params and query as JSON", () => {
    const req = createRequest();
    const rule: BugwardenRequestCaptureConfig = {
      onStatus: "500",
      fields: ["params", "query"],
    };

    const captured = collectCapturedRequestFields(req, rule);

    expect(captured.params).toBe('{"id":"42"}');
    expect(captured.query).toBe('{"debug":"true"}');
  });

  it("omits body when req.body is undefined (no body parser mounted)", () => {
    const req = createRequest({ body: undefined });
    const rule: BugwardenRequestCaptureConfig = { onStatus: "500", fields: ["body"] };

    expect(collectCapturedRequestFields(req, rule).body).toBeUndefined();
  });

  it("redacts sensitive headers by default", () => {
    const req = createRequest();
    const rule: BugwardenRequestCaptureConfig = { onStatus: "500", fields: ["headers"] };

    const captured = collectCapturedRequestFields(req, rule);
    const headers = JSON.parse(captured.headers!);

    expect(headers.authorization).toBe("[REDACTED]");
    expect(headers.cookie).toBe("[REDACTED]");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-request-id"]).toBe("req-1");
  });

  it("disables redaction when redactHeaders is an empty array", () => {
    const req = createRequest();
    const rule: BugwardenRequestCaptureConfig = {
      onStatus: "500",
      fields: ["headers"],
      redactHeaders: [],
    };

    const headers = JSON.parse(collectCapturedRequestFields(req, rule).headers!);
    expect(headers.authorization).toBe("Bearer secret-token");
  });

  it("uses a custom redaction list in place of the defaults", () => {
    const req = createRequest();
    const rule: BugwardenRequestCaptureConfig = {
      onStatus: "500",
      fields: ["headers"],
      redactHeaders: ["x-request-id"],
    };

    const headers = JSON.parse(collectCapturedRequestFields(req, rule).headers!);
    expect(headers["x-request-id"]).toBe("[REDACTED]");
    expect(headers.authorization).toBe("Bearer secret-token");
  });

  it("truncates captured fields to maxChars", () => {
    const req = createRequest({ body: { text: "a".repeat(50) } });
    const rule: BugwardenRequestCaptureConfig = {
      onStatus: "500",
      fields: ["body"],
      maxChars: 20,
    };

    const captured = collectCapturedRequestFields(req, rule);
    expect(captured.body).toContain("…(truncated)");
    expect(captured.body!.length).toBe(20 + "…(truncated)".length);
  });
});
