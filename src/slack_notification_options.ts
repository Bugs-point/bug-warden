import { BugwardenNotificationConfig } from "./notification_config";

/**
 * Configuration options for Slack notifications in Bugwarden.
 *
 * @interface BugwardenSlackNotificationOptions
 */
export interface BugwardenSlackNotificationOptions {
  /**
   **Slack webhook URL*

    1. Create a Slack app: If you don’t have one already, create your Slack app. Pick a name, choose a workspace to 
    associate your app with, and then click Create App.

    2. Enable Incoming Webhooks: After creating, you’ll be redirected to the settings page for your new app. From here select the Incoming Webhooks feature, and click the Activate Incoming Webhooks toggle to switch it on.

    3. Create an Incoming Webhook: Now that Incoming Webhooks are enabled, the settings page should refresh and some extra options will appear. One of those options will be a button marked Add New Webhook to Workspace, and you should click it.

    3. Authorize your app: Go ahead and pick a channel that the app will post to, and then click to Authorize your app.

    4. Get your Webhook URL: You’ll be sent back to your app settings, and you should now see a new entry under the Webhook URLs for Your Workspace section, with a Webhook URL.
   */
  webhookUrl: string;

  /**
   * Configuration for triggering Slack notifications.
   *
   * @property {NotificationConfig} notificationConfig
   * @description
   * An object containing properties to customize the triggering of Slack notifications. The following properties are available:
   *
   * - `routes`: Specifies the routes for which notifications should be triggered. It can be set to "all" for all routes, a specific route as a string, or an array of specific routes.
   *   - @property {RoutesType} routes
   *   - @example
   *     - "all"
   *     - "/api/user"
   *     - ["/api/posts", "/api/comments"]
   *
   * - `onStatus`: Specifies the HTTP status code(s) for which notifications should be triggered. It can be set to "all" for all status codes, or a specific status code as a string or number.
   *   - @property {HttpStatusCode} onStatus
   *   - @example
   *     - "all"
   *     - "all200"
   *     - 404
   *     - [400, 401, 404, "all500"]
   *
   * - `message`: The message to be included in the Slack notification when triggered.
   *   - @property {string} message
   *   - @example
   *     - "A new bug has been detected in the system."
   */
  notificationConfig: BugwardenNotificationConfig[] & {
    0: BugwardenNotificationConfig;
  };
}
