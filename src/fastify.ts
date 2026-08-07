import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
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

interface BugwardenFastifyError extends Error {
  statusCode?: number;
}

type BugwardenDecoratedRequest = FastifyRequest & {
  bugwardenStartTime?: number;
  bugwardenRequestId?: string;
  bugwardenErrorOccurred?: boolean;
};

/**
 * Adapts a Fastify request into the minimal Express-Request-shaped object the shared
 * bugwarden logging/notification logic actually reads (ip, method, originalUrl,
 * httpVersion, get(), route). Lets bugwarden's core stay framework-agnostic without a
 * parallel Fastify-specific implementation of every log field / placeholder.
 */
function toBugwardenRequest(request: FastifyRequest): Request {
  return {
    ip: request.ip,
    method: request.method,
    originalUrl: request.url ?? "",
    httpVersion: request.raw.httpVersion,
    route: undefined,
    get: (name: string) => {
      const value = request.headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    },
  } as unknown as Request;
}

function toBugwardenResponse(reply: FastifyReply): Response {
  return {
    statusCode: reply.statusCode,
    getHeader: (name: string) => reply.getHeader(name),
  } as unknown as Response;
}

/**
 * Fastify equivalent of bugwarden() + bugwardenErrorHandler() combined into a single
 * plugin, since Fastify's hook-based lifecycle doesn't need two separate registrations.
 * Register once: `fastify.register(bugwardenFastify(options))`. Logs and fires the same
 * Slack/webhook/Discord notification channels for both normal responses (onResponse) and
 * thrown/forwarded errors (onError, including {error-message}/{error-stack}). Accepts the
 * same BugwardenOptions shape as the Express middleware, including zero-config env vars.
 *
 * onResponse always fires after onError for the same request (Fastify sends a response
 * either way), so a request that errored is reported once, via onError's error-aware
 * log/notifications — onResponse skips it rather than reporting it a second time as if it
 * were a plain successful-ish response.
 */
export function bugwardenFastify(options?: BugwardenOptions) {
  const requestOptions = resolveZeroConfigOptions(options, "request");
  const errorOptions = resolveZeroConfigOptions(options, "error");
  const logger = requestOptions.logger ?? console.log;

  const slackThrottle = createNotificationThrottle();
  const webhookThrottle = createNotificationThrottle();
  const discordThrottle = createNotificationThrottle();

  const errorSlackThrottle = createNotificationThrottle();
  const errorWebhookThrottle = createNotificationThrottle();
  const errorDiscordThrottle = createNotificationThrottle();

  return fp(
    async (fastify: FastifyInstance) => {
      fastify.addHook("onRequest", async (request: BugwardenDecoratedRequest, reply) => {
        const incoming = request.headers["x-request-id"];
        const requestId =
          (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

        request.bugwardenStartTime = Date.now();
        request.bugwardenRequestId = requestId;
        reply.header("x-request-id", requestId);
      });

      fastify.addHook("onResponse", async (request: BugwardenDecoratedRequest, reply) => {
        if (request.bugwardenErrorOccurred) return;

        const req = toBugwardenRequest(request);
        if (isIgnoredRoute(req.originalUrl, requestOptions.ignore)) return;

        const res = toBugwardenResponse(reply);
        const elapsedTime =
          request.bugwardenStartTime !== undefined
            ? Date.now() - request.bugwardenStartTime
            : 0;
        const requestId = request.bugwardenRequestId;
        const timestamp = new Date();

        const allowedAppLogs = processLog(
          req,
          res,
          elapsedTime,
          requestOptions.logging,
          requestOptions.format,
          requestId
        );
        if (allowedAppLogs) logger(allowedAppLogs);

        if (requestOptions.configureSlackNotification) {
          await processSlackNotification(
            requestOptions.configureSlackNotification,
            req,
            res,
            timestamp,
            elapsedTime,
            logger,
            requestId,
            slackThrottle
          );
        }

        if (requestOptions.configureWebhookNotification) {
          await processWebhookNotification(
            requestOptions.configureWebhookNotification,
            req,
            res,
            timestamp,
            elapsedTime,
            logger,
            requestId,
            webhookThrottle
          );
        }

        if (requestOptions.configureDiscordNotification) {
          await processDiscordNotification(
            requestOptions.configureDiscordNotification,
            req,
            res,
            timestamp,
            elapsedTime,
            logger,
            requestId,
            discordThrottle
          );
        }
      });

      fastify.addHook(
        "onError",
        async (
          request: BugwardenDecoratedRequest,
          reply,
          error: BugwardenFastifyError
        ) => {
          request.bugwardenErrorOccurred = true;

          const req = toBugwardenRequest(request);
          const res = toBugwardenResponse(reply);
          const elapsedTime =
            request.bugwardenStartTime !== undefined
              ? Date.now() - request.bugwardenStartTime
              : 0;
          const requestId = request.bugwardenRequestId;
          const timestamp = new Date();

          const allowedAppLogs = processLog(
            req,
            res,
            elapsedTime,
            errorOptions.logging,
            errorOptions.format,
            requestId,
            undefined,
            error
          );
          if (allowedAppLogs) logger(allowedAppLogs);

          if (errorOptions.configureSlackNotification) {
            await processSlackNotification(
              errorOptions.configureSlackNotification,
              req,
              res,
              timestamp,
              elapsedTime,
              logger,
              requestId,
              errorSlackThrottle,
              undefined,
              error
            );
          }

          if (errorOptions.configureWebhookNotification) {
            await processWebhookNotification(
              errorOptions.configureWebhookNotification,
              req,
              res,
              timestamp,
              elapsedTime,
              logger,
              requestId,
              errorWebhookThrottle,
              undefined,
              error
            );
          }

          if (errorOptions.configureDiscordNotification) {
            await processDiscordNotification(
              errorOptions.configureDiscordNotification,
              req,
              res,
              timestamp,
              elapsedTime,
              logger,
              requestId,
              errorDiscordThrottle,
              undefined,
              error
            );
          }
        }
      );
    },
    { name: "bugwarden" }
  );
}
