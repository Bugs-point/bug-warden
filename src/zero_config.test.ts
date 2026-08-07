import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveZeroConfigOptions } from "./zero_config";

describe("resolveZeroConfigOptions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves options untouched when no BUGWARDEN_* env vars are set", () => {
    const resolved = resolveZeroConfigOptions({ logging: false });

    expect(resolved.configureSlackNotification).toBeUndefined();
    expect(resolved.configureWebhookNotification).toBeUndefined();
    expect(resolved.configureDiscordNotification).toBeUndefined();
    expect(resolved.logging).toBe(false);
  });

  it("wires a default Slack notification from BUGWARDEN_SLACK_WEBHOOK_URL", () => {
    vi.stubEnv("BUGWARDEN_SLACK_WEBHOOK_URL", "https://hooks.slack.com/zero-config");

    const resolved = resolveZeroConfigOptions();

    expect(resolved.configureSlackNotification?.webhookUrl).toBe(
      "https://hooks.slack.com/zero-config"
    );
    expect(resolved.configureSlackNotification?.notificationConfig[0]).toMatchObject({
      routes: "all",
      onStatus: "4xx,5xx",
    });
  });

  it("wires a default generic webhook notification from BUGWARDEN_WEBHOOK_URL", () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");

    const resolved = resolveZeroConfigOptions();

    expect(resolved.configureWebhookNotification?.url).toBe("https://example.com/hook");
  });

  it("wires a default Discord notification from BUGWARDEN_DISCORD_WEBHOOK_URL", () => {
    vi.stubEnv("BUGWARDEN_DISCORD_WEBHOOK_URL", "https://discord.com/api/webhooks/1/x");

    const resolved = resolveZeroConfigOptions();

    expect(resolved.configureDiscordNotification?.webhookUrl).toBe(
      "https://discord.com/api/webhooks/1/x"
    );
  });

  it("does not override a channel the caller already configured explicitly", () => {
    vi.stubEnv("BUGWARDEN_SLACK_WEBHOOK_URL", "https://hooks.slack.com/zero-config");

    const resolved = resolveZeroConfigOptions({
      configureSlackNotification: {
        webhookUrl: "https://hooks.slack.com/explicit",
        notificationConfig: [{ routes: "all", onStatus: "all", message: "hi" }],
      },
    });

    expect(resolved.configureSlackNotification?.webhookUrl).toBe(
      "https://hooks.slack.com/explicit"
    );
  });

  it("respects BUGWARDEN_NOTIFY_ON and BUGWARDEN_NOTIFY_ROUTES overrides", () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");
    vi.stubEnv("BUGWARDEN_NOTIFY_ON", "5xx");
    vi.stubEnv("BUGWARDEN_NOTIFY_ROUTES", "/api/*");

    const resolved = resolveZeroConfigOptions();

    expect(resolved.configureWebhookNotification?.notificationConfig[0]).toMatchObject({
      onStatus: "5xx",
      routes: "/api/*",
    });
  });

  it("applies BUGWARDEN_THROTTLE_MS to zero-config-created channels", () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");
    vi.stubEnv("BUGWARDEN_THROTTLE_MS", "60000");

    const resolved = resolveZeroConfigOptions();

    expect(resolved.configureWebhookNotification?.throttleMs).toBe(60000);
  });

  it("ignores a non-numeric BUGWARDEN_THROTTLE_MS", () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");
    vi.stubEnv("BUGWARDEN_THROTTLE_MS", "not-a-number");

    const resolved = resolveZeroConfigOptions();

    expect(resolved.configureWebhookNotification?.throttleMs).toBeUndefined();
  });

  it("uses an error-flavored default message when context is 'error'", () => {
    vi.stubEnv("BUGWARDEN_WEBHOOK_URL", "https://example.com/hook");

    const resolved = resolveZeroConfigOptions(undefined, "error");

    expect(resolved.configureWebhookNotification?.notificationConfig[0].message).toContain(
      "{error-message}"
    );
  });
});
