import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import type { Context, Middleware } from "koa";
import { BugwardenOptions } from "./bugwarden_options";
import {
  createNotificationThrottle,
  isIgnoredRoute,
  processDiscordNotification,
  processLog,
  processSlackNotification,
  processWebhookNotification,
} from "./utility";
import { resolveZeroConfigOptions } from "./zero_config";

interface BugwardenKoaError extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Adapts a Koa context into the minimal Express-Request-shaped object the shared bugwarden
 * logging/notification logic actually reads (ip, method, originalUrl, httpVersion, get(),
 * route). Lets bugwarden's core stay framework-agnostic.
 */
function toBugwardenRequest(ctx: Context): Request {
  return {
    ip: ctx.ip,
    method: ctx.method,
    originalUrl: ctx.originalUrl,
    httpVersion: ctx.req.httpVersion,
    route: undefined,
    get: (name: string) => ctx.get(name) || undefined,
  } as unknown as Request;
}

function toBugwardenResponse(ctx: Context): Response {
  return {
    statusCode: ctx.status,
    getHeader: (name: string) => ctx.response.get(name) || undefined,
  } as unknown as Response;
}

/**
 * Koa equivalent of bugwarden() + bugwardenErrorHandler() combined into a single
 * middleware, since Koa's onion-model `try { await next() } catch {}` naturally covers both
 * a normal response and an error in one place — unlike Express/Fastify, there's no risk of
 * double-reporting the same request. Register it early with `app.use(bugwardenKoa(options))`
 * so it wraps everything downstream. Errors are still rethrown after being logged/notified,
 * so Koa's own `app.on("error", ...)` / error middleware keeps working as normal.
 */
export function bugwardenKoa(options?: BugwardenOptions): Middleware {
  const requestOptions = resolveZeroConfigOptions(options, "request");
  const errorOptions = resolveZeroConfigOptions(options, "error");
  const logger = requestOptions.logger ?? console.log;

  const slackThrottle = createNotificationThrottle();
  const webhookThrottle = createNotificationThrottle();
  const discordThrottle = createNotificationThrottle();

  const errorSlackThrottle = createNotificationThrottle();
  const errorWebhookThrottle = createNotificationThrottle();
  const errorDiscordThrottle = createNotificationThrottle();

  return async (ctx, next) => {
    const startTimeMS = Date.now();
    const requestId = ctx.get("x-request-id") || randomUUID();
    ctx.set("x-request-id", requestId);

    let error: BugwardenKoaError | undefined;

    try {
      await next();
    } catch (err) {
      error = err as BugwardenKoaError;
      ctx.status = error.status || error.statusCode || 500;
      throw err;
    } finally {
      const req = toBugwardenRequest(ctx);
      const isIgnored = !error && isIgnoredRoute(req.originalUrl, requestOptions.ignore);

      if (!isIgnored) {
        const opts = error ? errorOptions : requestOptions;
        const res = toBugwardenResponse(ctx);
        const elapsedTime = Date.now() - startTimeMS;
        const timestamp = new Date();

        const allowedAppLogs = processLog(
          req,
          res,
          elapsedTime,
          opts.logging,
          opts.format,
          requestId,
          undefined,
          error
        );
        if (allowedAppLogs) logger(allowedAppLogs);

        if (opts.configureSlackNotification) {
          await processSlackNotification(
            opts.configureSlackNotification,
            req,
            res,
            timestamp,
            elapsedTime,
            logger,
            requestId,
            error ? errorSlackThrottle : slackThrottle,
            undefined,
            error
          );
        }

        if (opts.configureWebhookNotification) {
          await processWebhookNotification(
            opts.configureWebhookNotification,
            req,
            res,
            timestamp,
            elapsedTime,
            logger,
            requestId,
            error ? errorWebhookThrottle : webhookThrottle,
            undefined,
            error
          );
        }

        if (opts.configureDiscordNotification) {
          await processDiscordNotification(
            opts.configureDiscordNotification,
            req,
            res,
            timestamp,
            elapsedTime,
            logger,
            requestId,
            error ? errorDiscordThrottle : discordThrottle,
            undefined,
            error
          );
        }
      }
    }
  };
}
