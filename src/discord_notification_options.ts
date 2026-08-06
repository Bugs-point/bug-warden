import { BugwardenNotificationConfig } from "./notification_config";

/**
 * Configuration for a Discord notification channel in Bugwarden. Posts Discord's
 * { content } webhook body shape (see Discord's "Execute Webhook" API).
 *
 * @interface BugwardenDiscordNotificationOptions
 */
export interface BugwardenDiscordNotificationOptions {
  /**
   * Discord webhook URL, e.g. https://discord.com/api/webhooks/<id>/<token>.
   * Create one under a channel's Settings > Integrations > Webhooks.
   */
  webhookUrl: string;

  /**
   * Configuration for triggering Discord notifications. Same routes/onStatus/message
   * conventions as configureSlackNotification's notificationConfig.
   *
   * @property {BugwardenNotificationConfig} notificationConfig
   */
  notificationConfig: BugwardenNotificationConfig[] & {
    0: BugwardenNotificationConfig;
  };

  /**
   * Minimum time (in milliseconds) between two notifications for the same notificationConfig
   * entry. See BugwardenSlackNotificationOptions.throttleMs for details.
   *
   * @property {number} throttleMs
   */
  throttleMs?: number;
}
