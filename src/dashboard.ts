import { NextFunction, Request, Response, Router } from "express";
import { createDashboardStore, DashboardStore } from "./dashboard_store";

export { createDashboardStore, DashboardStore, DashboardEvent, DashboardStats } from "./dashboard_store";

export interface BugwardenDashboardOptions {
  /** Base path the dashboard UI and JSON API are mounted under. Default: "/bugwarden". */
  path?: string;
  /** Max requests kept in memory. Older ones are dropped. Default: 500. */
  maxEvents?: number;
  /**
   * Reuse an existing store (e.g. one you're also recording into from elsewhere) instead of
   * creating a new one. When omitted, bugwardenDashboard records every request that passes
   * through it automatically.
   */
  store?: DashboardStore;
}

function renderDashboardHtml(basePath: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>BugWarden Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 24px;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: #94a3b8; font-size: 13px; margin-bottom: 20px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
  .card {
    background: #1e293b;
    border-radius: 8px;
    padding: 14px 18px;
    min-width: 140px;
    flex: 1;
  }
  .card .label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  .card .value { font-size: 24px; font-weight: 600; margin-top: 4px; }
  .breakdown { display: flex; height: 10px; border-radius: 6px; overflow: hidden; margin-top: 8px; background: #334155; }
  .breakdown span { display: block; height: 100%; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #1e293b; }
  th { color: #94a3b8; font-weight: 500; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
  .status { font-weight: 600; }
  section h2 { font-size: 14px; color: #cbd5e1; margin: 0 0 8px; }
  .empty { color: #64748b; font-size: 13px; padding: 12px 0; }
  .wrap { overflow-x: auto; }
</style>
</head>
<body>
  <h1>BugWarden Dashboard</h1>
  <div class="subtitle">Local, in-memory request observability — refreshes every 5s. Not persisted across restarts.</div>

  <div class="cards" id="cards"></div>

  <section>
    <h2>Slowest routes</h2>
    <div class="wrap"><table id="routes-table"><thead>
      <tr><th>Method</th><th>Route</th><th>Avg time</th><th>Requests</th><th>Errors</th></tr>
    </thead><tbody></tbody></table></div>
  </section>

  <section>
    <h2>Recent requests</h2>
    <div class="wrap"><table id="events-table"><thead>
      <tr><th>Time</th><th>Method</th><th>Route</th><th>Status</th><th>Time</th><th>Request ID</th></tr>
    </thead><tbody></tbody></table></div>
  </section>

<script>
(function () {
  var basePath = ${JSON.stringify(basePath)};

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function statusColor(code) {
    if (code >= 500) return "#f87171";
    if (code >= 400) return "#facc15";
    if (code >= 300) return "#38bdf8";
    return "#4ade80";
  }

  function renderCards(stats) {
    var cards = [
      ["Total requests", stats.totalRequests],
      ["Error rate", Math.round(stats.errorRate * 1000) / 10 + "%"],
      ["Avg response time", stats.avgResponseTime + "ms"],
    ];
    var html = cards.map(function (c) {
      return '<div class="card"><div class="label">' + esc(c[0]) + '</div><div class="value">' + esc(c[1]) + "</div></div>";
    }).join("");

    var total = stats.totalRequests || 1;
    var groups = ["2xx", "3xx", "4xx", "5xx"];
    var colors = { "2xx": "#4ade80", "3xx": "#38bdf8", "4xx": "#facc15", "5xx": "#f87171" };
    var bars = groups.map(function (g) {
      var pct = ((stats.statusBreakdown[g] || 0) / total) * 100;
      return pct > 0 ? '<span style="width:' + pct + '%;background:' + colors[g] + '"></span>' : "";
    }).join("");

    html += '<div class="card" style="flex-basis:100%"><div class="label">Status breakdown</div><div class="breakdown">' + bars + "</div></div>";
    document.getElementById("cards").innerHTML = html;
  }

  function renderRoutes(routes) {
    var body = routes.map(function (r) {
      return "<tr><td>" + esc(r.method) + "</td><td>" + esc(r.route) + "</td><td>" + r.avgResponseTime + "ms</td><td>" + r.count + "</td><td>" + r.errorCount + "</td></tr>";
    }).join("");
    document.querySelector("#routes-table tbody").innerHTML = body || '<tr><td colspan="5" class="empty">No requests recorded yet.</td></tr>';
  }

  function renderEvents(events) {
    var body = events.slice(0, 50).map(function (e) {
      return "<tr><td>" + new Date(e.timestamp).toLocaleTimeString() + "</td><td>" + esc(e.method) + "</td><td>" + esc(e.route) +
        '</td><td class="status" style="color:' + statusColor(e.statusCode) + '">' + e.statusCode + "</td><td>" + e.responseTime + "ms</td><td>" + esc(e.requestId || "-") + "</td></tr>";
    }).join("");
    document.querySelector("#events-table tbody").innerHTML = body || '<tr><td colspan="6" class="empty">No requests recorded yet.</td></tr>';
  }

  function refresh() {
    fetch(basePath + "/api/stats").then(function (r) { return r.json(); }).then(function (stats) {
      renderCards(stats);
      renderRoutes(stats.slowestRoutes);
    });
    fetch(basePath + "/api/events").then(function (r) { return r.json(); }).then(renderEvents);
  }

  refresh();
  setInterval(refresh, 5000);
})();
</script>
</body>
</html>`;
}

/**
 * Express router providing a local, in-memory request-observability dashboard: recent
 * requests, status-code breakdown, and slowest routes. Mount it anywhere in an Express app:
 *
 *   app.use(bugwardenDashboard());          // UI + API under /bugwarden
 *   app.use(bugwardenDashboard({ path: "/admin/bugwarden" }));
 *
 * Records every request that passes through it (excluding its own UI/API routes) into an
 * in-memory ring buffer — state is process-local and not persisted, by design: this is a
 * local/dev observability tool, not a replacement for a real APM. Mount it behind your own
 * auth/IP-allowlist middleware if your app (or this router) is reachable from outside your
 * team, since it exposes request URLs, status codes, and timing.
 */
export function bugwardenDashboard(options?: BugwardenDashboardOptions): Router {
  const basePath = options?.path ?? "/bugwarden";
  const store = options?.store ?? createDashboardStore(options?.maxEvents ?? 500);
  const router = Router();

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.originalUrl.startsWith(basePath)) return next();

    const startTimeMS = Date.now();
    res.on("finish", () => {
      store.record({
        timestamp: new Date().toISOString(),
        method: req.method,
        route: req.route?.path || req.originalUrl,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTimeMS,
        requestId: (res.getHeader("x-request-id") as string) || undefined,
      });
    });
    next();
  });

  router.get(basePath, (_req: Request, res: Response) => {
    res.status(200).type("html").send(renderDashboardHtml(basePath));
  });

  router.get(`${basePath}/api/stats`, (_req: Request, res: Response) => {
    res.status(200).json(store.getStats());
  });

  router.get(`${basePath}/api/events`, (_req: Request, res: Response) => {
    res.status(200).json(store.getEvents());
  });

  return router;
}
