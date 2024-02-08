import { BugwardenLoggingOption } from "./types/bugwarden_logging_option";
import { BugwardenSlackNotificationOptions } from "./slack_notification_options";

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
   */
  constructor(
    public logging?: BugwardenLoggingOption,
    public configureSlackNotification?: BugwardenSlackNotificationOptions
  ) {
    this.logging = logging;
    this.configureSlackNotification = configureSlackNotification;
  }
}
