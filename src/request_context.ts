import { Request } from "express";

/**
 * Symbols used to stash per-request bookkeeping (start time, request ID) on the Express
 * `req` object itself, so bugwardenErrorHandler can recover them without a shared store.
 * Symbol.for is used (not a local Symbol()) so this works even if bugwarden() and
 * bugwardenErrorHandler() somehow end up resolving this module from two different copies
 * of the package (e.g. nested dependency installs).
 */
const START_TIME_KEY = Symbol.for("bugwarden.requestStartTime");
const REQUEST_ID_KEY = Symbol.for("bugwarden.requestId");

type TaggedRequest = Request & {
  [START_TIME_KEY]?: number;
  [REQUEST_ID_KEY]?: string;
};

export function setRequestStartTime(req: Request, startTimeMS: number): void {
  (req as TaggedRequest)[START_TIME_KEY] = startTimeMS;
}

export function getRequestStartTime(req: Request): number | undefined {
  return (req as TaggedRequest)[START_TIME_KEY];
}

export function setRequestId(req: Request, requestId: string): void {
  (req as TaggedRequest)[REQUEST_ID_KEY] = requestId;
}

export function getRequestId(req: Request): string | undefined {
  return (req as TaggedRequest)[REQUEST_ID_KEY];
}
