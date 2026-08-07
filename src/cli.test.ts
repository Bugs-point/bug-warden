import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addWebhookEnvVar, renderNextSteps } from "./cli";

describe("addWebhookEnvVar", () => {
  it("appends the key to an empty .env", () => {
    expect(addWebhookEnvVar("", "slack", "https://hooks.slack.com/x")).toBe(
      "BUGWARDEN_SLACK_WEBHOOK_URL=https://hooks.slack.com/x\n"
    );
  });

  it("appends to existing content, adding a newline separator if missing", () => {
    expect(addWebhookEnvVar("FOO=bar", "webhook", "https://example.com/hook")).toBe(
      "FOO=bar\nBUGWARDEN_WEBHOOK_URL=https://example.com/hook\n"
    );
  });

  it("doesn't add a redundant newline when the file already ends with one", () => {
    expect(addWebhookEnvVar("FOO=bar\n", "discord", "https://discord.com/x")).toBe(
      "FOO=bar\nBUGWARDEN_DISCORD_WEBHOOK_URL=https://discord.com/x\n"
    );
  });

  it("returns null without modifying anything when the key is already set", () => {
    const existing = "BUGWARDEN_SLACK_WEBHOOK_URL=https://already-set\nOTHER=1\n";
    expect(addWebhookEnvVar(existing, "slack", "https://new-url")).toBeNull();
  });

  it("uses the correct env var name per channel", () => {
    expect(addWebhookEnvVar("", "slack", "u")).toContain("BUGWARDEN_SLACK_WEBHOOK_URL=");
    expect(addWebhookEnvVar("", "discord", "u")).toContain("BUGWARDEN_DISCORD_WEBHOOK_URL=");
    expect(addWebhookEnvVar("", "webhook", "u")).toContain("BUGWARDEN_WEBHOOK_URL=");
  });
});

describe("renderNextSteps", () => {
  it("shows the Express snippet with no peer-install step", () => {
    const output = renderNextSteps("express", false);
    expect(output).toContain('require("bugwarden")');
    expect(output).not.toContain("npm install");
  });

  it("shows the Fastify snippet with a peer-install step", () => {
    const output = renderNextSteps("fastify", false);
    expect(output).toContain('require("bugwarden/fastify")');
    expect(output).toContain("npm install fastify");
  });

  it("shows the Koa snippet with a peer-install step", () => {
    const output = renderNextSteps("koa", false);
    expect(output).toContain('require("bugwarden/koa")');
    expect(output).toContain("npm install koa");
  });

  it("mentions zero-config env loading when a channel was configured", () => {
    expect(renderNextSteps("express", true)).toContain("zero-config mode");
  });

  it("points to manual configuration options when no channel was configured", () => {
    const output = renderNextSteps("express", false);
    expect(output).toContain("No alert channel configured");
    expect(output).toContain("configureSlackNotification");
  });
});

describe("main", () => {
  let answerQueue: string[];
  let closeMock: ReturnType<typeof vi.fn>;
  let existsSyncMock: ReturnType<typeof vi.fn>;
  let readFileSyncMock: ReturnType<typeof vi.fn>;
  let writeFileSyncMock: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  function queueAnswers(...answers: string[]) {
    answerQueue = answers;
  }

  beforeEach(() => {
    vi.resetModules();
    answerQueue = [];
    closeMock = vi.fn();

    vi.doMock("node:readline", () => ({
      createInterface: () => ({
        close: closeMock,
        [Symbol.asyncIterator]: () => ({
          next: async () =>
            answerQueue.length
              ? { value: answerQueue.shift(), done: false }
              : { value: undefined, done: true },
        }),
      }),
    }));

    existsSyncMock = vi.fn().mockReturnValue(false);
    readFileSyncMock = vi.fn().mockReturnValue("");
    writeFileSyncMock = vi.fn();

    vi.doMock("node:fs", () => ({
      existsSync: existsSyncMock,
      readFileSync: readFileSyncMock,
      writeFileSync: writeFileSyncMock,
    }));

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("node:readline");
    vi.doUnmock("node:fs");
  });

  it("writes the webhook URL to a fresh .env and prints the framework snippet", async () => {
    queueAnswers("fastify", "slack", "https://hooks.slack.com/test");

    const { main } = await import("./cli");
    await main();

    expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    const [, content] = writeFileSyncMock.mock.calls[0];
    expect(content).toBe("BUGWARDEN_SLACK_WEBHOOK_URL=https://hooks.slack.com/test\n");
    expect(closeMock).toHaveBeenCalledTimes(1);

    const printed = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain('require("bugwarden/fastify")');
    expect(printed).toContain("zero-config mode");
  });

  it("defaults to express and skip when given blank answers", async () => {
    queueAnswers("", "");

    const { main } = await import("./cli");
    await main();

    expect(writeFileSyncMock).not.toHaveBeenCalled();
    const printed = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain('require("bugwarden")');
    expect(printed).toContain("No alert channel configured");
  });

  it("does not overwrite an already-configured channel in an existing .env", async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue("BUGWARDEN_WEBHOOK_URL=https://already-set\n");
    queueAnswers("express", "webhook", "https://new-url");

    const { main } = await import("./cli");
    await main();

    expect(writeFileSyncMock).not.toHaveBeenCalled();
    const printed = logSpy.mock.calls.map((call) => call[0]).join("\n");
    expect(printed).toContain("already set in .env");
  });

  it("closes the readline interface even if writing the .env throws", async () => {
    queueAnswers("express", "slack", "https://hooks.slack.com/test");
    writeFileSyncMock.mockImplementation(() => {
      throw new Error("disk full");
    });

    const { main } = await import("./cli");
    await expect(main()).rejects.toThrow("disk full");

    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
