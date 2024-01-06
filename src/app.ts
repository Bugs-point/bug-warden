import { NextFunction, Request, Response } from "express";
import { paintShop } from "./utility";

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
export function BugWarden(req: Request, res: Response, next: NextFunction) {
  const startTime: number = Date.now();

  res.on("finish", () => {
    const elapsedTime = Date.now() - startTime;
    const ip = req.ip;
    const timestamp = new Date().toUTCString();
    const method = req.method;
    const originalUrl = req.originalUrl;
    const httpVersion = `HTTP/${req.httpVersion}`;
    const status = +res.statusCode;
    const contentLength = `${res.getHeader("content-length") || 0}`;
    const referrer = `${req.get("referrer") || "-"}`;
    const userAgent = `${req.get("user-agent")}`;
    const responseTime = `${elapsedTime}ms`;

    const logDetails = `
      IP: ${ip}
      Timestamp: [${timestamp}]
      Method: ${method}
      OriginalUrl: ${originalUrl}
      HttpVersion: ${httpVersion}
      Status: ${status}
      Content-Length: ${contentLength}
      Referrer: ${referrer}
      User-Agent: "${userAgent}"
      Response-Time: ${responseTime}
    `;

    console.log(paintShop(logDetails, status));
  });

  next();
}
