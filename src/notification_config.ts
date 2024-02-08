export interface BugwardenNotificationConfig {
  /**
   * Specifies the routes for which notifications should be triggered.
   * It can be set to "all" for all routes, a specific route as a string, or an array of specific routes.
   *
   * @property {RoutesType} routes
   * @example
   * - "all"
   * - "/api/user" for a specific route
   * - "/api/user/*"  for all routes starting with "/api/user/
   * - "/api/user,/api/admin,/api/public/*" multiple routes separated by comma ","
   */
  routes: string;

  /**
   * Specifies the HTTP status code(s) for which notifications should be triggered.
   * It can be set to "all" for all status codes, or a specific status code as a string.
   *
   * @property {HttpStatusCode} onStatus
   * @example
   * - "all" for all status codes
   * - "2xx" for all 200 status codes
   * - "3xx" for all 300 status codes
   * - "4xx,5xx" for all 400 and 500 status codes
   */
  onStatus: string;

  /**
   * The message to be included in the Slack notification when triggered.
   *
   * @property {string} message
   * @example
   * "A new bug has been detected in the system."
   * - You can use the following parameters in your message
   * - "{ip}"
   * - "{timestamp}"
   * - "{method}"
   * - "{original-url}"
   * - "{http-version}"
   * - "{status-code}"
   * - "{content-length}"
   * - "{referer}"
   * - "{user-agent}"
   * - "{response-time}"
   */
  message: string;
}
