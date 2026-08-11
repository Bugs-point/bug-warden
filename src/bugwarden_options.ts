import { BugwardenLoggingOption } from "./types/bugwarden_logging_option";
import { BugwardenSlackNotificationOptions } from "./slack_notification_options";
import { BugwardenWebhookNotificationOptions } from "./webhook_notification_options";
import { BugwardenDiscordNotificationOptions } from "./discord_notification_options";
import { BugwardenLogger } from "./types/bugwarden_logger";
import { BugwardenLogFormat } from "./types/bugwarden_log_format";
import { BugwardenRequestCaptureConfig } from "./request_capture_config";

/**
 * Configuration options for Bugwarden
 *
 * @class BugwardenOptions
 */
export class BugwardenOptions {
  /**
   * Constructs an instance of BugwardenOptions.
   *
   * @constructor
   * @param {BugwardenLoggingOption} logging - Optional logging configuration for Bugwarden.
   * @param {BugwardenSlackNotificationOptions[]} configureSlackNotification - Optional Slack notification configuration for Bugwarden.
   * @param {string[]} ignore - Optional list of routes to skip entirely (no logging, no Slack notifications).
   * Supports "all", exact paths, and "/prefix/*" wildcards, e.g. ["/health", "/metrics", "/internal/*"].
   * @param {BugwardenLogger} logger - Optional sink for all Bugwarden output (request logs and internal
   * warnings/errors). Defaults to console.log. Use this to route output through pino, winston, etc.
   * @param {BugwardenLogFormat} format - "text" (default) for the colored human-readable format, or "json"
   * for a single-line JSON object per request, suited to log aggregators like Datadog or ELK.
   * @param {BugwardenWebhookNotificationOptions} configureWebhookNotification - Optional generic webhook
   * notification configuration, for services other than Slack. Posts { message } instead of Slack's { text }.
   * @param {BugwardenDiscordNotificationOptions} configureDiscordNotification - Optional Discord webhook
   * notification configuration. Posts Discord's { content } webhook body shape.
   * @param {number} captureResponseBody - Optional. When set, captures up to this many characters of the
   * response body (from res.send/res.json) and makes it available as the responseBody log field and the
   * {response-body} notification placeholder. Disabled (no capture, zero overhead) when omitted.
   * @param {BugwardenRequestCaptureConfig[]} captureRequestData - Optional. Rules for capturing
   * req.body/req.params/req.query/req.headers when a request matches a given onStatus/routes filter —
   * e.g. capture body+headers on 5xx, so you can actually see what payload caused a crash instead of just
   * "it failed". Rules are evaluated in order; the first match wins. Sensitive headers (authorization,
   * cookie, etc.) are redacted by default. Available as the requestBody/requestParams/requestQuery/
   * requestHeaders log fields and {request-body}/{request-params}/{request-query}/{request-headers}
   * notification placeholders. Disabled (no capture) when omitted.
   */
  constructor(
    public logging?: BugwardenLoggingOption,
    public configureSlackNotification?: BugwardenSlackNotificationOptions,
    public ignore?: string[],
    public logger?: BugwardenLogger,
    public format?: BugwardenLogFormat,
    public configureWebhookNotification?: BugwardenWebhookNotificationOptions,
    public configureDiscordNotification?: BugwardenDiscordNotificationOptions,
    public captureResponseBody?: number,
    public captureRequestData?: BugwardenRequestCaptureConfig[]
  ) {
    this.logging = logging;
    this.configureSlackNotification = configureSlackNotification;
    this.ignore = ignore;
    this.logger = logger;
    this.format = format;
    this.configureWebhookNotification = configureWebhookNotification;
    this.configureDiscordNotification = configureDiscordNotification;
    this.captureResponseBody = captureResponseBody;
    this.captureRequestData = captureRequestData;
  }
}
