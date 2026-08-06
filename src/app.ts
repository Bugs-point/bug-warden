import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import {
  createNotificationThrottle,
  isIgnoredRoute,
  processDiscordNotification,
  processLog,
  processSlackNotification,
  processWebhookNotification,
} from "./utility";
import { BugwardenOptions } from "./bugwarden_options";

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
  const logger = options?.logger ?? console.log;
  const slackNotificationThrottle = createNotificationThrottle();
  const webhookNotificationThrottle = createNotificationThrottle();
  const discordNotificationThrottle = createNotificationThrottle();

  return (req: Request, res: Response, next: NextFunction) => {
    const startTimeMS: number = Date.now();
    const requestId = req.get("x-request-id") || randomUUID();
    res.setHeader("x-request-id", requestId);

    let capturedResponseBody: string | undefined;
    const maxResponseBodyChars = options?.captureResponseBody;

    if (maxResponseBodyChars) {
      const originalSend = res.send.bind(res);
      res.send = ((body?: unknown) => {
        if (typeof body === "string" || Buffer.isBuffer(body)) {
          const text = typeof body === "string" ? body : body.toString("utf8");
          capturedResponseBody =
            text.length > maxResponseBodyChars
              ? `${text.slice(0, maxResponseBodyChars)}…(truncated)`
              : text;
        }
        return originalSend(body);
      }) as typeof res.send;
    }

    res.on("finish", async () => {
      if (isIgnoredRoute(req.originalUrl, options?.ignore)) return;

      const elapsedTime = Date.now() - startTimeMS;
      const timestamp = new Date();
      const allowedAppLogs = processLog(
        req,
        res,
        elapsedTime,
        options?.logging,
        options?.format,
        requestId,
        capturedResponseBody
      );

      /* Log processing */
      if (allowedAppLogs) logger(allowedAppLogs);

      /* Slack notification processing */
      if (options?.configureSlackNotification) {
        await processSlackNotification(
          options.configureSlackNotification,
          req,
          res,
          timestamp,
          elapsedTime,
          logger,
          requestId,
          slackNotificationThrottle,
          capturedResponseBody
        );
      }

      /* Generic webhook notification processing */
      if (options?.configureWebhookNotification) {
        await processWebhookNotification(
          options.configureWebhookNotification,
          req,
          res,
          timestamp,
          elapsedTime,
          logger,
          requestId,
          webhookNotificationThrottle,
          capturedResponseBody
        );
      }

      /* Discord notification processing */
      if (options?.configureDiscordNotification) {
        await processDiscordNotification(
          options.configureDiscordNotification,
          req,
          res,
          timestamp,
          elapsedTime,
          logger,
          requestId,
          discordNotificationThrottle,
          capturedResponseBody
        );
      }
    });
    next();
  };
}
