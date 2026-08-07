import { describe, expect, it } from "vitest";
import { createDashboardStore } from "./dashboard_store";

function makeEvent(overrides: Partial<Parameters<ReturnType<typeof createDashboardStore>["record"]>[0]> = {}) {
  return {
    timestamp: new Date().toISOString(),
    method: "GET",
    route: "/api/users",
    statusCode: 200,
    responseTime: 10,
    ...overrides,
  };
}

describe("createDashboardStore", () => {
  it("starts empty", () => {
    const store = createDashboardStore();
    expect(store.getEvents()).toEqual([]);
    expect(store.getStats()).toMatchObject({
      totalRequests: 0,
      errorCount: 0,
      errorRate: 0,
      avgResponseTime: 0,
    });
  });

  it("returns recorded events newest first", () => {
    const store = createDashboardStore();
    store.record(makeEvent({ route: "/first" }));
    store.record(makeEvent({ route: "/second" }));

    const events = store.getEvents();
    expect(events[0].route).toBe("/second");
    expect(events[1].route).toBe("/first");
  });

  it("drops the oldest events once maxEvents is exceeded", () => {
    const store = createDashboardStore(2);
    store.record(makeEvent({ route: "/one" }));
    store.record(makeEvent({ route: "/two" }));
    store.record(makeEvent({ route: "/three" }));

    const routes = store.getEvents().map((e) => e.route);
    expect(routes).toEqual(["/three", "/two"]);
  });

  it("computes status breakdown and error rate", () => {
    const store = createDashboardStore();
    store.record(makeEvent({ statusCode: 200 }));
    store.record(makeEvent({ statusCode: 200 }));
    store.record(makeEvent({ statusCode: 404 }));
    store.record(makeEvent({ statusCode: 500 }));

    const stats = store.getStats();
    expect(stats.totalRequests).toBe(4);
    expect(stats.errorCount).toBe(2);
    expect(stats.errorRate).toBe(0.5);
    expect(stats.statusBreakdown).toEqual({
      "1xx": 0,
      "2xx": 2,
      "3xx": 0,
      "4xx": 1,
      "5xx": 1,
    });
  });

  it("computes average response time", () => {
    const store = createDashboardStore();
    store.record(makeEvent({ responseTime: 10 }));
    store.record(makeEvent({ responseTime: 20 }));
    store.record(makeEvent({ responseTime: 30 }));

    expect(store.getStats().avgResponseTime).toBe(20);
  });

  it("groups slowest routes by method + route and sorts descending by avg time", () => {
    const store = createDashboardStore();
    store.record(makeEvent({ method: "GET", route: "/fast", responseTime: 5 }));
    store.record(makeEvent({ method: "GET", route: "/fast", responseTime: 15 }));
    store.record(makeEvent({ method: "GET", route: "/slow", responseTime: 200 }));
    store.record(makeEvent({ method: "POST", route: "/slow", responseTime: 50, statusCode: 500 }));

    const { slowestRoutes } = store.getStats();
    expect(slowestRoutes[0]).toMatchObject({
      method: "GET",
      route: "/slow",
      count: 1,
      avgResponseTime: 200,
      errorCount: 0,
    });
    expect(slowestRoutes[1]).toMatchObject({
      method: "POST",
      route: "/slow",
      count: 1,
      avgResponseTime: 50,
      errorCount: 1,
    });
    expect(slowestRoutes[2]).toMatchObject({
      method: "GET",
      route: "/fast",
      count: 2,
      avgResponseTime: 10,
      errorCount: 0,
    });
  });

  it("caps slowestRoutes at 10 entries", () => {
    const store = createDashboardStore();
    for (let i = 0; i < 15; i++) {
      store.record(makeEvent({ route: `/route-${i}`, responseTime: i }));
    }

    expect(store.getStats().slowestRoutes).toHaveLength(10);
  });
});
