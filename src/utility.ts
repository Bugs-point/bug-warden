import { Request, Response } from "express";
import { BugwardenLogProperties } from "./bugwarden_log_properties";
import { BugwardenLoggingOptions } from "./bugwarden_logging_options";
import { BugwardenLogPropertyEnum } from "./bugwarden_log_property.enum";

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
 * Process and generate a log string based on the provided request, response, and optional logging options.
 *
 * @param req - Express Request object representing the incoming HTTP request.
 * @param res - Express Response object representing the outgoing HTTP response.
 * @param startTime - A timestamp representing the start time of the request processing.
 * @param logging - Optional configuration for customizing the log output. Can be a boolean or an array of log properties.
 * @returns A formatted log string containing relevant information based on the provided options.
 */
export function processLog(
  req: Request,
  res: Response,
  startTime: number,
  logging?: BugwardenLoggingOptions
): string {
  const elapsedTime = Date.now() - startTime;
  let log = "";
  const statusCode = res.statusCode;

  if (Array.isArray(logging)) {
    const customLogs: string[] = [];
    logging.forEach((log) => {
      switch (log) {
        case "ip":
          customLogs.push(`${BugwardenLogPropertyEnum.IP}: ${req.ip}`);
          break;
        case "timestamp":
          customLogs.push(
            `${BugwardenLogPropertyEnum.TIMESTAMP}: ${new Date().toUTCString()}`
          );
          break;
        case "method":
          customLogs.push(`${BugwardenLogPropertyEnum.METHOD}: ${req.method}`);
          break;
        case "originalURL":
          customLogs.push(
            `${BugwardenLogPropertyEnum.ORIGINAL_URL}: ${req.originalUrl}`
          );
          break;
        case "httpVersion":
          customLogs.push(
            `${BugwardenLogPropertyEnum.HTTP_VERSION}: HTTP/${req.httpVersion}`
          );
          break;
        case "statusCode":
          customLogs.push(
            `${BugwardenLogPropertyEnum.STATUS_CODE}: ${res.statusCode}`
          );
          break;
        case "contentLength":
          customLogs.push(
            `${BugwardenLogPropertyEnum.CONTENT_LENGTH}: ${
              res.getHeader("content-length") || 0
            }`
          );
          break;
        case "referrer":
          customLogs.push(
            `${BugwardenLogPropertyEnum.REFERRER}: ${
              req.get("referrer") || "-"
            }`
          );
          break;
        case "userAgent":
          customLogs.push(
            `${BugwardenLogPropertyEnum.USER_AGENT}: ${req.get("user-agent")}`
          );
          break;
        case "responseTime":
          customLogs.push(
            `${BugwardenLogPropertyEnum.RESPONSE_TIME}: ${elapsedTime}ms`
          );
          break;
        default:
          break;
      }
    });
    log = customLogs.join("\n");
  } else if (logging === true || logging === undefined) {
    const allProperties = new BugwardenLogProperties(
      `${BugwardenLogPropertyEnum.IP}: ${req.ip}`, // ip
      `${BugwardenLogPropertyEnum.TIMESTAMP}: ${new Date().toUTCString()}`, // timestamp
      `${BugwardenLogPropertyEnum.METHOD}: ${req.method}`, // method
      `${BugwardenLogPropertyEnum.ORIGINAL_URL}: ${req.originalUrl}`, // original url
      `${BugwardenLogPropertyEnum.HTTP_VERSION}: HTTP/${req.httpVersion}`, // http version
      `${BugwardenLogPropertyEnum.STATUS_CODE}: ${res.statusCode}`, // status code
      `${BugwardenLogPropertyEnum.CONTENT_LENGTH}: ${
        res.getHeader("content-length") || 0
      }`, // content length
      `${BugwardenLogPropertyEnum.REFERRER}: ${req.get("referrer") || "-"}`, // referrer
      `${BugwardenLogPropertyEnum.USER_AGENT}: ${req.get("user-agent")}`, // user agent
      `${BugwardenLogPropertyEnum.RESPONSE_TIME}: ${elapsedTime}ms` // response time
    );
    log = Object.values(allProperties).join("\n");
  } else {
    log = "";
  }

  return log ? "\n" + coloredLogs(log, statusCode) + "\n" : "";
}
