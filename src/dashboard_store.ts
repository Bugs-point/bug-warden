import { HttpStatusGroup } from "./interfaces/http_status_group";

export interface DashboardEvent {
  timestamp: string;
  method: string;
  route: string;
  statusCode: number;
  responseTime: number;
  requestId?: string;
}

export interface DashboardRouteStat {
  route: string;
  method: string;
  count: number;
  avgResponseTime: number;
  errorCount: number;
}

export interface DashboardStats {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  statusBreakdown: Record<HttpStatusGroup, number>;
  slowestRoutes: DashboardRouteStat[];
}

export interface DashboardStore {
  /** Records one completed request. Intended to be called once per request/response. */
  record(event: DashboardEvent): void;
  /** Returns recorded events, newest first. */
  getEvents(): DashboardEvent[];
  /** Aggregates the currently-recorded events into summary stats. */
  getStats(): DashboardStats;
}

function statusGroup(statusCode: number): HttpStatusGroup {
  const group = Math.floor(statusCode / 100);
  return `${group}xx` as HttpStatusGroup;
}

/**
 * Creates an in-memory ring-buffer store for bugwardenDashboard(). Keeps at most
 * `maxEvents` of the most recent requests (default 500) — old ones are dropped as new ones
 * come in, so memory use stays bounded regardless of how long the process runs. Local/dev
 * observability only: state isn't persisted and isn't shared across processes.
 */
export function createDashboardStore(maxEvents = 500): DashboardStore {
  const events: DashboardEvent[] = [];

  return {
    record(event) {
      events.push(event);
      if (events.length > maxEvents) events.shift();
    },

    getEvents() {
      return [...events].reverse();
    },

    getStats() {
      const statusBreakdown: Record<HttpStatusGroup, number> = {
        "1xx": 0,
        "2xx": 0,
        "3xx": 0,
        "4xx": 0,
        "5xx": 0,
      };

      const routeTotals = new Map<
        string,
        { method: string; route: string; count: number; totalTime: number; errorCount: number }
      >();

      let totalResponseTime = 0;
      let errorCount = 0;

      for (const event of events) {
        statusBreakdown[statusGroup(event.statusCode)]++;
        totalResponseTime += event.responseTime;
        if (event.statusCode >= 400) errorCount++;

        const routeKey = `${event.method} ${event.route}`;
        const existing = routeTotals.get(routeKey);
        if (existing) {
          existing.count++;
          existing.totalTime += event.responseTime;
          if (event.statusCode >= 400) existing.errorCount++;
        } else {
          routeTotals.set(routeKey, {
            method: event.method,
            route: event.route,
            count: 1,
            totalTime: event.responseTime,
            errorCount: event.statusCode >= 400 ? 1 : 0,
          });
        }
      }

      const slowestRoutes: DashboardRouteStat[] = [...routeTotals.values()]
        .map((r) => ({
          route: r.route,
          method: r.method,
          count: r.count,
          avgResponseTime: Math.round(r.totalTime / r.count),
          errorCount: r.errorCount,
        }))
        .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        .slice(0, 10);

      return {
        totalRequests: events.length,
        errorCount,
        errorRate: events.length ? errorCount / events.length : 0,
        avgResponseTime: events.length ? Math.round(totalResponseTime / events.length) : 0,
        statusBreakdown,
        slowestRoutes,
      };
    },
  };
}
