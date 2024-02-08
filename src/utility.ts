import { Request, Response } from "express";
import { BugwardenLogProperties } from "./bugwarden_log_properties";
import { BugwardenLoggingOption } from "./types/bugwarden_logging_option";
import { BugwardenLogParameterType } from "./bugwarden_log_property.enum";
import { BugwardenSlackNotificationOptions } from "./slack_notification_options";
import { BugwardenLogLevel } from "./types/log_level";
import { BugwardenLogLevelColorsPalette } from "./bugwarden_log_level_color_palette";

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

export function bugwardenLog(
  message: string,
  logLevel: BugwardenLogLevel = "LOG"
) {
  const timestamp = getCurrentTimestamp();
  const logColor = BugwardenLogLevelColorsPalette[logLevel];
  const logMessage = `${logColor}${timestamp} - ${logLevel} [Bugwarden] ${message}\x1b[0m`;
  console.log(logMessage);
}

/**
 * Process and generate a log string based on the provided request, response, and optional logging options.
 *
 * @param req - Express Request object representing the incoming HTTP request.
 * @param res - Express Response object representing the outgoing HTTP response.
 * @param elapsedTime - A timestamp representing the start time of the request processing.
 * @param logging - Optional configuration for customizing the log output. Can be a boolean or an array of log properties.
 * @returns A formatted log string containing relevant information based on the provided options.
 */
export function processLog(
  req: Request,
  res: Response,
  elapsedTime: number,
  logging?: BugwardenLoggingOption
): string {
  let log = "";
  const statusCode = res.statusCode;

  if (Array.isArray(logging)) {
    const customLogs: string[] = [];
    logging.forEach((log) => {
      switch (log) {
        case "ip":
          customLogs.push(`${BugwardenLogParameterType.IP}: ${req.ip}`);
          break;
        case "timestamp":
          customLogs.push(
            `${
              BugwardenLogParameterType.TIMESTAMP
            }: ${new Date().toUTCString()}`
          );
          break;
        case "method":
          customLogs.push(`${BugwardenLogParameterType.METHOD}: ${req.method}`);
          break;
        case "originalURL":
          customLogs.push(
            `${BugwardenLogParameterType.ORIGINAL_URL}: ${req.originalUrl}`
          );
          break;
        case "httpVersion":
          customLogs.push(
            `${BugwardenLogParameterType.HTTP_VERSION}: HTTP/${req.httpVersion}`
          );
          break;
        case "statusCode":
          customLogs.push(
            `${BugwardenLogParameterType.STATUS_CODE}: ${res.statusCode}`
          );
          break;
        case "contentLength":
          customLogs.push(
            `${BugwardenLogParameterType.CONTENT_LENGTH}: ${
              res.getHeader("content-length") || 0
            }`
          );
          break;
        case "referrer":
          customLogs.push(
            `${BugwardenLogParameterType.REFERRER}: ${
              req.get("referrer") || "-"
            }`
          );
          break;
        case "userAgent":
          customLogs.push(
            `${BugwardenLogParameterType.USER_AGENT}: ${req.get("user-agent")}`
          );
          break;
        case "responseTime":
          customLogs.push(
            `${BugwardenLogParameterType.RESPONSE_TIME}: ${elapsedTime}ms`
          );
          break;
        default:
          break;
      }
    });
    log = customLogs.join("\n");
  } else if (logging === true || logging === undefined) {
    const allProperties = new BugwardenLogProperties(
      `${BugwardenLogParameterType.IP}: ${req.ip}`, // ip
      `${BugwardenLogParameterType.TIMESTAMP}: ${new Date().toUTCString()}`, // timestamp
      `${BugwardenLogParameterType.METHOD}: ${req.method}`, // method
      `${BugwardenLogParameterType.ORIGINAL_URL}: ${req.originalUrl}`, // original url
      `${BugwardenLogParameterType.HTTP_VERSION}: HTTP/${req.httpVersion}`, // http version
      `${BugwardenLogParameterType.STATUS_CODE}: ${res.statusCode}`, // status code
      `${BugwardenLogParameterType.CONTENT_LENGTH}: ${
        res.getHeader("content-length") || 0
      }`, // content length
      `${BugwardenLogParameterType.REFERRER}: ${req.get("referrer") || "-"}`, // referrer
      `${BugwardenLogParameterType.USER_AGENT}: ${req.get("user-agent")}`, // user agent
      `${BugwardenLogParameterType.RESPONSE_TIME}: ${elapsedTime}ms` // response time
    );
    log = Object.values(allProperties).join("\n");
  } else {
    log = "";
  }

  return log ? "\n" + coloredLogs(log, statusCode) + "\n" : "";
}

export async function processSlackNotification(
  slackConfiguration: BugwardenSlackNotificationOptions,
  req: Request,
  res: Response,
  timestamp: Date,
  elapsedTime: number
) {
  const originalUrl = req.route?.path || req.originalUrl;
  const statusCode = res.statusCode;
  let isStatusCodeIncluded: boolean = false;
  let isEndpointIncluded: boolean = false;

  if (!slackConfiguration.webhookUrl?.length) {
    bugwardenLog("Please provide a webhook URL for sending slack notification");
    return;
  }
  const webhookUrl = slackConfiguration.webhookUrl;

  for (const config of slackConfiguration?.notificationConfig) {
    if (
      !config.message?.length ||
      !config.onStatus?.length ||
      !config.routes?.length
    ) {
      bugwardenLog(
        "Config should include all <message> <routes> and <onStatus>",
        "ERROR"
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
      .replace(`${BugwardenLogParameterType.RESPONSE_TIME}`, `${elapsedTime}`)
      .replace(
        `{${BugwardenLogParameterType.USER_AGENT}}`,
        `${req.get("user-agent")}`
      );

    // Matching status code
    if (routes.includes("all")) {
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
            break;
        }

        if (found) break;
      }
    }

    // Matching endpoint
    for (const route of routes) {
      if (route.includes("*")) {
        const startingOfEndpoint = route.replace("/*", "");
        if (originalUrl.startsWith(startingOfEndpoint)) {
          isEndpointIncluded = true;
          break;
        }
      } else {
        if (originalUrl === route) {
          isEndpointIncluded = true;
          break;
        }
      }
    }

    if (isStatusCodeIncluded && isEndpointIncluded) {
      await postSlackNotification(webhookUrl, message);
    }
  }
}

async function postSlackNotification(webhookUrl: string, text: string) {
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
    bugwardenLog(`Cannot access slack webhook url:${e}`, "ERROR");
  }
}
