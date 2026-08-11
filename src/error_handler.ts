import { NextFunction, Request, Response } from "express";
import { BugwardenOptions } from "./bugwarden_options";
import {
  collectCapturedRequestFields,
  createNotificationThrottle,
  findMatchingCaptureRule,
  processDiscordNotification,
  processLog,
  processSlackNotification,
  processWebhookNotification,
} from "./utility";
import { getRequestId, getRequestStartTime } from "./request_context";
import { resolveZeroConfigOptions } from "./zero_config";

interface BugwardenHttpError extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Express error-handling middleware. Mount it with `app.use(bugwardenErrorHandler(options))`
 * after your routes (and after `bugwarden()` if you're also using it) to log thrown or
 * forwarded errors — including stack traces — and route them through the same
 * Slack/webhook/Discord channels as `bugwarden()`'s request logging. It only observes and
 * reports: it always calls `next(err)` afterwards so your own error responder still runs.
 */
export function bugwardenErrorHandler(options?: BugwardenOptions) {
  const slackNotificationThrottle = createNotificationThrottle();
  const webhookNotificationThrottle = createNotificationThrottle();
  const discordNotificationThrottle = createNotificationThrottle();

  return async (
    err: BugwardenHttpError,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const resolvedOptions = resolveZeroConfigOptions(options, "error");
    const logger = resolvedOptions.logger ?? console.log;

    const statusCode = err.status || err.statusCode || 500;
    if (!res.headersSent) res.statusCode = statusCode;

    const timestamp = new Date();
    const startTime = getRequestStartTime(req);
    const elapsedTime = startTime !== undefined ? Date.now() - startTime : 0;
    const requestId = getRequestId(req);
    const originalUrl = req.route?.path || req.originalUrl;
    const matchedCaptureRule = findMatchingCaptureRule(
      resolvedOptions.captureRequestData,
      originalUrl,
      statusCode
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
      undefined,
      err,
      capturedRequest
    );
    if (allowedAppLogs) logger(allowedAppLogs);

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
        undefined,
        err,
        capturedRequest
      );
    }

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
        undefined,
        err,
        capturedRequest
      );
    }

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
        undefined,
        err,
        capturedRequest
      );
    }

    next(err);
  };
}
