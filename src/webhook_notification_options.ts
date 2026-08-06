import { BugwardenNotificationConfig } from "./notification_config";

/**
 * Configuration for a generic webhook notification channel in Bugwarden. Unlike
 * configureSlackNotification (which posts Slack's { text } envelope), this posts a plain
 * { message } JSON body, suited to custom internal services, PagerDuty-style webhooks, or
 * anything else that accepts a raw POST.
 *
 * @interface BugwardenWebhookNotificationOptions
 */
export interface BugwardenWebhookNotificationOptions {
  /**
   * The URL to POST notifications to. Bugwarden sends
   * `{ "message": "<templated message>" }` as the JSON body.
   */
  url: string;

  /**
   * Configuration for triggering webhook notifications. Same routes/onStatus/message
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
