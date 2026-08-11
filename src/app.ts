import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import {
  collectCapturedRequestFields,
  createNotificationThrottle,
  findMatchingCaptureRule,
  isIgnoredRoute,
  processDiscordNotification,
  processLog,
  processSlackNotification,
  processWebhookNotification,
  truncateText,
} from "./utility";
import { BugwardenOptions } from "./bugwarden_options";
import { setRequestId, setRequestStartTime } from "./request_context";
import { resolveZeroConfigOptions } from "./zero_config";
import { bugwardenErrorHandler } from "./error_handler";

export { bugwardenErrorHandler };

/**
 * BugWarden middleware logs details of incoming HTTP requests and their corresponding responses,
 * including IP address, timestamp, HTTP method, URL, status code, content length,
 * referrer, user agent, and response time.
 *
 *
 * @param req - Express Request object representing the incoming HTTP request.
 * @param res - Express Response object representing the outgoing HTTP response.
 * @param next - Express NextFunction to pass control to the next middleware in the stack.
 * @returns void
 */
export function bugwarden(options?: BugwardenOptions) {
  const resolvedOptions = resolveZeroConfigOptions(options);
  const logger = resolvedOptions.logger ?? console.log;
  const slackNotificationThrottle = createNotificationThrottle();
  const webhookNotificationThrottle = createNotificationThrottle();
  const discordNotificationThrottle = createNotificationThrottle();

  return (req: Request, res: Response, next: NextFunction) => {
    const startTimeMS: number = Date.now();
    const requestId = req.get("x-request-id") || randomUUID();
    res.setHeader("x-request-id", requestId);
    setRequestStartTime(req, startTimeMS);
    setRequestId(req, requestId);

    let capturedResponseBody: string | undefined;
    const maxResponseBodyChars = resolvedOptions.captureResponseBody;

    if (maxResponseBodyChars) {
      const originalSend = res.send.bind(res);
      res.send = ((body?: unknown) => {
        if (typeof body === "string" || Buffer.isBuffer(body)) {
          const text = typeof body === "string" ? body : body.toString("utf8");
          capturedResponseBody = truncateText(text, maxResponseBodyChars);
        }
        return originalSend(body);
      }) as typeof res.send;
    }

    res.on("finish", async () => {
      if (isIgnoredRoute(req.originalUrl, resolvedOptions.ignore)) return;

      const elapsedTime = Date.now() - startTimeMS;
      const timestamp = new Date();
      const originalUrl = req.route?.path || req.originalUrl;
      const matchedCaptureRule = findMatchingCaptureRule(
        resolvedOptions.captureRequestData,
        originalUrl,
        res.statusCode
      );
      const capturedRequest = matchedCaptureRule
        ? collectCapturedRequestFields(req, matchedCaptureRule)
        : undefined;

      const allowedAppLogs = processLog(
        req,
        res,
        elapsedTime,
        resolvedOptions.logging,
        resolvedOptions.format,
        requestId,
        capturedResponseBody,
        undefined,
        capturedRequest
      );

      /* Log processing */
      if (allowedAppLogs) logger(allowedAppLogs);

      /* Slack notification processing */
      if (resolvedOptions.configureSlackNotification) {
        await processSlackNotification(
          resolvedOptions.configureSlackNotification,
          req,
          res,
          timestamp,
          elapsedTime,
          logger,
          requestId,
          slackNotificationThrottle,
          capturedResponseBody,
          undefined,
          capturedRequest
        );
      }

      /* Generic webhook notification processing */
      if (resolvedOptions.configureWebhookNotification) {
        await processWebhookNotification(
          resolvedOptions.configureWebhookNotification,
          req,
          res,
          timestamp,
          elapsedTime,
          logger,
          requestId,
          webhookNotificationThrottle,
          capturedResponseBody,
          undefined,
          capturedRequest
        );
      }

      /* Discord notification processing */
      if (resolvedOptions.configureDiscordNotification) {
        await processDiscordNotification(
          resolvedOptions.configureDiscordNotification,
          req,
          res,
          timestamp,
          elapsedTime,
          logger,
          requestId,
          discordNotificationThrottle,
          capturedResponseBody,
          undefined,
          capturedRequest
        );
      }
    });
    next();
  };
}

/**
 * Convenience alias for bugwardenErrorHandler, so callers who only imported `bugwarden`
 * can wire up error handling too: `app.use(bugwarden.errorHandler(options))`.
 */
bugwarden.errorHandler = bugwardenErrorHandler;
