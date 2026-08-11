/**
 * Which parts of the Express request to capture. Named after the Express `Request`
 * properties they read from: `req.body`, `req.params`, `req.query`, `req.headers`.
 */
export type BugwardenRequestField = "body" | "params" | "query" | "headers";

export interface BugwardenRequestCaptureConfig {
  /**
   * Which status code(s) trigger this capture rule. Same conventions as
   * BugwardenNotificationConfig.onStatus: "all", a range like "4xx", an exact code like
   * "500", or a comma-separated mix, e.g. "400,5xx".
   *
   * @example
   * - "5xx" — capture on every server error
   * - "400,404" — capture only on these exact codes
   */
  onStatus: string;

  /**
   * Which routes this rule applies to. Same conventions as
   * BugwardenNotificationConfig.routes ("all", exact paths, "/prefix/*" wildcards, or a
   * comma-separated mix). Defaults to "all" when omitted.
   */
  routes?: string;

  /**
   * Which parts of the request to capture when this rule matches.
   *
   * @example ["body", "params", "query", "headers"]
   */
  fields: BugwardenRequestField[];

  /**
   * Max characters per captured field before truncation (each field is truncated
   * independently). Default: 1000.
   */
  maxChars?: number;

  /**
   * Header names (case-insensitive) to replace with "[REDACTED]" instead of capturing
   * verbatim, when "headers" is included in `fields`. Defaults to a sensible sensitive-header
   * list (authorization, cookie, set-cookie, x-api-key, proxy-authorization) so secrets/session
   * tokens don't end up in your logs or Slack channel by accident. Pass `[]` to disable
   * redaction, or your own list to replace the defaults entirely.
   */
  redactHeaders?: string[];
}
