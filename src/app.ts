import { NextFunction, Request, Response } from "express";
import { processLog } from "./utility";
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
    const startTime: number = Date.now();
    res.on("finish", () => {
      const allowedAppLogs = processLog(req, res, startTime, options?.logging);
      if (allowedAppLogs) console.log(allowedAppLogs);
    });
    next();
  };
}
