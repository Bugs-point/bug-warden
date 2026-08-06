import { BugwardenLoggingOption } from "./types/bugwarden_logging_option";
import { BugwardenSlackNotificationOptions } from "./slack_notification_options";
import { BugwardenLogger } from "./types/bugwarden_logger";

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
   */
  constructor(
    public logging?: BugwardenLoggingOption,
    public configureSlackNotification?: BugwardenSlackNotificationOptions,
    public ignore?: string[],
    public logger?: BugwardenLogger
  ) {
    this.logging = logging;
    this.configureSlackNotification = configureSlackNotification;
    this.ignore = ignore;
    this.logger = logger;
  }
}
