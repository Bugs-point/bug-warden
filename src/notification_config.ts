/**
 * Fields that can be combined to decide whether two matching events belong to the same
 * alert "group" for throttling/counting purposes. See BugwardenNotificationConfig.groupBy.
 */
export type BugwardenGroupByField = "route" | "method" | "statusCode" | "errorMessage";

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
   * Accepts "all", a range like "4xx", an exact code like "404", or a comma-separated
   * mix of both.
   *
   * @property {string} onStatus
   * @example
   * - "all" for all status codes
   * - "2xx" for all 200 status codes
   * - "3xx" for all 300 status codes
   * - "4xx,5xx" for all 400 and 500 status codes
   * - "404" for an exact status code
   * - "400,401,404,5xx" for specific codes combined with a range
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
   * - "{request-id}"
   * - "{response-body}"
   * - "{error-message}" (only meaningful with bugwardenErrorHandler)
   * - "{error-stack}" (only meaningful with bugwardenErrorHandler)
   * - "{occurrence-count}" (total times this alert group has matched, including suppressed ones)
   */
  message: string;

  /**
   * Controls what counts as "the same alert" for throttling and the {occurrence-count}
   * placeholder. Without this, a single wildcard config (e.g. routes: "all") would lump
   * together unrelated incidents happening on different routes/status codes into one
   * throttle bucket. Defaults to ["route", "statusCode"], so distinct route+status
   * combinations are tracked independently even under the same config.
   *
   * @property {BugwardenGroupByField[]} groupBy
   * @example
   * - ["route", "statusCode"] (default) — /api/a failing with 500 and /api/b failing with
   *   500 are tracked as two separate groups.
   * - ["route"] — group purely by endpoint regardless of status code.
   * - ["route", "statusCode", "errorMessage"] — with bugwardenErrorHandler, only collapse
   *   repeats that also share the exact same error message.
   */
  groupBy?: BugwardenGroupByField[];
}
