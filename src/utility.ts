import { Request, Response } from "express";
import { BugwardenLogProperties } from "./bugwarden_log_properties";
import { BugwardenLoggingOption } from "./types/bugwarden_logging_option";
import { BugwardenLogParameterType } from "./bugwarden_log_property.enum";
import { BugwardenSlackNotificationOptions } from "./slack_notification_options";
import { BugwardenLogLevel } from "./types/log_level";
import { BugwardenLogLevelColorsPalette } from "./bugwarden_log_level_color_palette";
import { BugwardenLogger } from "./types/bugwarden_logger";
import { BugwardenLogFormat } from "./types/bugwarden_log_format";

/**
 * Retrieves the current timestamp formatted as a string in the en-US locale with 12-hour time format.
 *
 * @returns {string} The current timestamp in the format 'MM/DD/YYYY, h:mm:ss A'.
 * @description
 * This function uses the current system date and time to generate a timestamp and formats it according to the en-US locale with a 12-hour time format. The resulting string represents the current date and time in a human-readable format.
 */
function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toLocaleString("en-US", { hour12: true });
}

/**
 * Function to paint a text with color based on HTTP status code ranges.
 * @param {string} text - The text to be colored.
 * @param {number} statusCode - The HTTP status code.
 * @returns {string} - The colored text.
 */
export function coloredLogs(text: string, statusCode: number): string {
  let colorCode =
    statusCode >= 200 && statusCode < 300
      ? "\x1b[32m" // Green for 2xx status codes
      : statusCode >= 300 && statusCode < 400
      ? "\x1b[36m" // Cyan for 3xx status codes
      : statusCode >= 400 && statusCode < 500
      ? "\x1b[33m" // Yellow for 4xx status codes
      : statusCode >= 500
      ? "\x1b[31m" // Red for 5xx status codes
      : "\x1b[0m"; // Default color (reset)
  return `${colorCode}${text}\x1b[0m`;
}

/**
 * Checks whether a URL matches a route pattern. A pattern ending in "/*"
 * matches any URL starting with that prefix; otherwise the match is exact.
 */
export function matchesRoute(originalUrl: string, route: string): boolean {
  if (route.includes("*")) {
    const startingOfEndpoint = route.replace("/*", "");
    return originalUrl.startsWith(startingOfEndpoint);
  }
  return originalUrl === route;
}

/**
 * Checks whether a URL should be skipped based on a list of ignore patterns,
 * using the same "all" / exact / wildcard conventions as Slack route matching.
 */
export function isIgnoredRoute(originalUrl: string, ignore?: string[]): boolean {
  if (!ignore?.length) return false;
  if (ignore.includes("all")) return true;
  return ignore.some((route) => matchesRoute(originalUrl, route));
}

export function bugwardenLog(
  message: string,
  logLevel: BugwardenLogLevel = "LOG",
  logger: BugwardenLogger = console.log
) {
  const timestamp = getCurrentTimestamp();
  const logColor = BugwardenLogLevelColorsPalette[logLevel];
  const logMessage = `${logColor}${timestamp} - ${logLevel} [Bugwarden] ${message}\x1b[0m`;
  logger(logMessage);
}

type LogFieldKey = keyof BugwardenLogProperties;

const ALL_LOG_FIELD_KEYS: LogFieldKey[] = [
  "ip",
  "timestamp",
  "method",
  "originalURL",
  "httpVersion",
  "statusCode",
  "contentLength",
  "referrer",
  "userAgent",
  "responseTime",
  "requestId",
];

const LOG_FIELD_LABELS: Record<LogFieldKey, string> = {
  ip: BugwardenLogParameterType.IP,
  timestamp: BugwardenLogParameterType.TIMESTAMP,
  method: BugwardenLogParameterType.METHOD,
  originalURL: BugwardenLogParameterType.ORIGINAL_URL,
  httpVersion: BugwardenLogParameterType.HTTP_VERSION,
  statusCode: BugwardenLogParameterType.STATUS_CODE,
  contentLength: BugwardenLogParameterType.CONTENT_LENGTH,
  referrer: BugwardenLogParameterType.REFERRER,
  userAgent: BugwardenLogParameterType.USER_AGENT,
  responseTime: BugwardenLogParameterType.RESPONSE_TIME,
  requestId: BugwardenLogParameterType.REQUEST_ID,
};

function collectLogFields(
  req: Request,
  res: Response,
  elapsedTime: number,
  requestId?: string
): Record<LogFieldKey, string | number | undefined> {
  return {
    ip: req.ip,
    timestamp: new Date().toUTCString(),
    method: req.method,
    originalURL: req.originalUrl,
    httpVersion: `HTTP/${req.httpVersion}`,
    statusCode: res.statusCode,
    contentLength: Number(res.getHeader("content-length") || 0),
    referrer: req.get("referrer") || "-",
    userAgent: req.get("user-agent"),
    responseTime: elapsedTime,
    requestId,
  };
}

/**
 * Process and generate a log line based on the provided request, response, and optional logging options.
 *
 * @param req - Express Request object representing the incoming HTTP request.
 * @param res - Express Response object representing the outgoing HTTP response.
 * @param elapsedTime - A timestamp representing the start time of the request processing.
 * @param logging - Optional configuration for customizing the log output. Can be a boolean or an array of log properties.
 * @param format - "text" (default) for the colored human-readable format, or "json" for a single-line JSON object.
 * @param requestId - Optional correlation ID (from the incoming x-request-id header, or generated) to include in the log.
 * @returns A formatted log line containing relevant information based on the provided options.
 */
export function processLog(
  req: Request,
  res: Response,
  elapsedTime: number,
  logging?: BugwardenLoggingOption,
  format: BugwardenLogFormat = "text",
  requestId?: string
): string {
  if (logging === false) return "";

  const selectedKeys = Array.isArray(logging) ? logging : ALL_LOG_FIELD_KEYS;
  if (!selectedKeys.length) return "";

  const fields = collectLogFields(req, res, elapsedTime, requestId);

  if (format === "json") {
    const jsonLog: Record<string, string | number | undefined> = {};
    for (const key of selectedKeys) {
      if (fields[key] !== undefined) jsonLog[key] = fields[key];
    }
    return Object.keys(jsonLog).length ? JSON.stringify(jsonLog) : "";
  }

  const lines = selectedKeys
    .filter((key) => fields[key] !== undefined)
    .map((key) => {
      const value = key === "responseTime" ? `${fields[key]}ms` : fields[key];
      return `${LOG_FIELD_LABELS[key]}: ${value}`;
    });

  const log = lines.join("\n");
  return log ? "\n" + coloredLogs(log, res.statusCode) + "\n" : "";
}

export async function processSlackNotification(
  slackConfiguration: BugwardenSlackNotificationOptions,
  req: Request,
  res: Response,
  timestamp: Date,
  elapsedTime: number,
  logger: BugwardenLogger = console.log,
  requestId?: string
) {
  const originalUrl = req.route?.path || req.originalUrl;
  const statusCode = res.statusCode;

  if (!slackConfiguration.webhookUrl?.length) {
    bugwardenLog(
      "Please provide a webhook URL for sending slack notification",
      "LOG",
      logger
    );
    return;
  }
  const webhookUrl = slackConfiguration.webhookUrl;

  for (const config of slackConfiguration?.notificationConfig) {
    let isStatusCodeIncluded: boolean = false;
    let isEndpointIncluded: boolean = false;

    if (
      !config.message?.length ||
      !config.onStatus?.length ||
      !config.routes?.length
    ) {
      bugwardenLog(
        "Config should include all <message> <routes> and <onStatus>",
        "ERROR",
        logger
      );
      break;
    }

    const onStatuses = config.onStatus?.split(",");
    const routes = config.routes?.split(",");
    const message = config.message
      .replace(`{${BugwardenLogParameterType.IP}}`, `${req?.ip}`)
      .replace(
        `{${BugwardenLogParameterType.TIMESTAMP}}`,
        timestamp.toDateString()
      )
      .replace(`{${BugwardenLogParameterType.METHOD}}`, req.method)
      .replace(`{${BugwardenLogParameterType.ORIGINAL_URL}}`, originalUrl)
      .replace(`{${BugwardenLogParameterType.HTTP_VERSION}}`, req.httpVersion)
      .replace(`{${BugwardenLogParameterType.STATUS_CODE}}`, `${statusCode}`)
      .replace(
        `{${BugwardenLogParameterType.CONTENT_LENGTH}}`,
        `${res.getHeader("content-length") || 0}`
      )
      .replace(
        `{${BugwardenLogParameterType.REFERRER}}`,
        `${req.get("referrer") || "-"}`
      )
      .replace(
        `{${BugwardenLogParameterType.RESPONSE_TIME}}`,
        `${elapsedTime}`
      )
      .replace(
        `{${BugwardenLogParameterType.USER_AGENT}}`,
        `${req.get("user-agent")}`
      )
      .replace(
        `{${BugwardenLogParameterType.REQUEST_ID}}`,
        `${requestId ?? "-"}`
      );

    // Matching status code
    if (onStatuses.includes("all")) {
      isStatusCodeIncluded = true;
    } else {
      for (const status of onStatuses) {
        let found = false;

        switch (status) {
          case "1xx":
            if (statusCode >= 100 && statusCode < 200) {
              isStatusCodeIncluded = true;
              found = true;
            }
            break;
          case "2xx":
            if (statusCode >= 200 && statusCode < 300) {
              isStatusCodeIncluded = true;
              found = true;
            }
            break;
          case "3xx":
            if (statusCode >= 300 && statusCode < 400) {
              isStatusCodeIncluded = true;
              found = true;
            }
            break;
          case "4xx":
            if (statusCode >= 400 && statusCode < 500) {
              isStatusCodeIncluded = true;
              found = true;
            }
            break;
          case "5xx":
            if (statusCode >= 500 && statusCode < 600) {
              isStatusCodeIncluded = true;
              found = true;
            }
            break;
          default:
            if (Number(status) === statusCode) {
              isStatusCodeIncluded = true;
              found = true;
            }
            break;
        }

        if (found) break;
      }
    }

    // Matching endpoint
    if (routes.includes("all")) {
      isEndpointIncluded = true;
    } else {
      for (const route of routes) {
        if (matchesRoute(originalUrl, route)) {
          isEndpointIncluded = true;
          break;
        }
      }
    }

    if (isStatusCodeIncluded && isEndpointIncluded) {
      await postSlackNotification(webhookUrl, message, logger);
    }
  }
}

async function postSlackNotification(
  webhookUrl: string,
  text: string,
  logger: BugwardenLogger = console.log
) {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
      }),
    });
  } catch (e) {
    bugwardenLog(`Cannot access slack webhook url:${e}`, "ERROR", logger);
  }
}
