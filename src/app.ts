import { NextFunction, Request, Response } from "express";
import { processLog, processSlackNotification } from "./utility";
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
  return (req: Request, res: Response, next: NextFunction) => {
    const startTimeMS: number = Date.now();
    res.on("finish", async () => {
      const elapsedTime = Date.now() - startTimeMS;
      const timestamp = new Date();
      const allowedAppLogs = processLog(
        req,
        res,
        elapsedTime,
        options?.logging
      );

      /* Log processing */
      if (allowedAppLogs) console.log(allowedAppLogs);

      /* Slack notification processing */
      if (options?.configureSlackNotification) {
        await processSlackNotification(
          options.configureSlackNotification,
          req,
          res,
          timestamp,
          elapsedTime
        );
      }
    });
    next();
  };
}
