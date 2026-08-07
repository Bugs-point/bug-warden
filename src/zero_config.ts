import { BugwardenOptions } from "./bugwarden_options";
import { BugwardenNotificationConfig } from "./notification_config";

/**
 * Env vars read for zero-config mode. Set one of the webhook URL vars and
 * `app.use(bugwarden())` starts alerting with no code-level configuration at all.
 */
const ENV = {
  SLACK_WEBHOOK_URL: "BUGWARDEN_SLACK_WEBHOOK_URL",
  DISCORD_WEBHOOK_URL: "BUGWARDEN_DISCORD_WEBHOOK_URL",
  WEBHOOK_URL: "BUGWARDEN_WEBHOOK_URL",
  THROTTLE_MS: "BUGWARDEN_THROTTLE_MS",
  NOTIFY_ON: "BUGWARDEN_NOTIFY_ON",
  NOTIFY_ROUTES: "BUGWARDEN_NOTIFY_ROUTES",
} as const;

type ZeroConfigContext = "request" | "error";

function buildDefaultNotificationConfig(
  context: ZeroConfigContext
): BugwardenNotificationConfig[] & { 0: BugwardenNotificationConfig } {
  const onStatus = process.env[ENV.NOTIFY_ON] || "4xx,5xx";
  const routes = process.env[ENV.NOTIFY_ROUTES] || "all";
  const message =
    context === "error"
      ? "🐛 Unhandled error on {method} {original-url}: {error-message}"
      : "🐛 {method} {original-url} → {status-code} ({response-time}ms)";

  return [{ routes, onStatus, message }] as BugwardenNotificationConfig[] & {
    0: BugwardenNotificationConfig;
  };
}

function resolveThrottleMs(): number | undefined {
  const raw = process.env[ENV.THROTTLE_MS];
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Fills in any notification channel the caller hasn't already configured from
 * `BUGWARDEN_*` environment variables, so `bugwarden()` / `bugwardenErrorHandler()` can
 * work with zero code-level configuration. Never overrides a channel the caller already
 * set up explicitly.
 */
export function resolveZeroConfigOptions(
  options?: BugwardenOptions,
  context: ZeroConfigContext = "request"
): BugwardenOptions {
  const resolved = new BugwardenOptions(
    options?.logging,
    options?.configureSlackNotification,
    options?.ignore,
    options?.logger,
    options?.format,
    options?.configureWebhookNotification,
    options?.configureDiscordNotification,
    options?.captureResponseBody
  );

  const throttleMs = resolveThrottleMs();

  const slackWebhookUrl = process.env[ENV.SLACK_WEBHOOK_URL];
  if (!resolved.configureSlackNotification && slackWebhookUrl) {
    resolved.configureSlackNotification = {
      webhookUrl: slackWebhookUrl,
      notificationConfig: buildDefaultNotificationConfig(context),
      throttleMs,
    };
  }

  const webhookUrl = process.env[ENV.WEBHOOK_URL];
  if (!resolved.configureWebhookNotification && webhookUrl) {
    resolved.configureWebhookNotification = {
      url: webhookUrl,
      notificationConfig: buildDefaultNotificationConfig(context),
      throttleMs,
    };
  }

  const discordWebhookUrl = process.env[ENV.DISCORD_WEBHOOK_URL];
  if (!resolved.configureDiscordNotification && discordWebhookUrl) {
    resolved.configureDiscordNotification = {
      webhookUrl: discordWebhookUrl,
      notificationConfig: buildDefaultNotificationConfig(context),
      throttleMs,
    };
  }

  return resolved;
}
