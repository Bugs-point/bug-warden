import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type BugwardenFramework = "express" | "fastify" | "koa";
export type BugwardenChannel = "slack" | "discord" | "webhook";

const CHANNEL_ENV_KEY: Record<BugwardenChannel, string> = {
  slack: "BUGWARDEN_SLACK_WEBHOOK_URL",
  discord: "BUGWARDEN_DISCORD_WEBHOOK_URL",
  webhook: "BUGWARDEN_WEBHOOK_URL",
};

const FRAMEWORK_SNIPPET: Record<BugwardenFramework, string> = {
  express: [
    'const express = require("express");',
    'const { bugwarden } = require("bugwarden");',
    "",
    "const app = express();",
    "app.use(bugwarden());",
  ].join("\n"),
  fastify: [
    'const Fastify = require("fastify");',
    'const { bugwardenFastify } = require("bugwarden/fastify");',
    "",
    "const app = Fastify();",
    "app.register(bugwardenFastify());",
  ].join("\n"),
  koa: [
    'const Koa = require("koa");',
    'const { bugwardenKoa } = require("bugwarden/koa");',
    "",
    "const app = new Koa();",
    "app.use(bugwardenKoa());",
  ].join("\n"),
};

const FRAMEWORK_PEER_INSTALL: Record<BugwardenFramework, string | null> = {
  express: null,
  fastify: "npm install fastify",
  koa: "npm install koa",
};

/**
 * Computes the new .env contents after adding a BUGWARDEN_*_WEBHOOK_URL line for `channel`.
 * Returns null (leaving the file untouched) if that key is already present, so init never
 * clobbers a value the user already configured.
 */
export function addWebhookEnvVar(
  existingEnvContent: string,
  channel: BugwardenChannel,
  webhookUrl: string
): string | null {
  const key = CHANNEL_ENV_KEY[channel];
  if (new RegExp(`^${key}=`, "m").test(existingEnvContent)) return null;

  const needsNewline = existingEnvContent.length > 0 && !existingEnvContent.endsWith("\n");
  return `${existingEnvContent}${needsNewline ? "\n" : ""}${key}=${webhookUrl}\n`;
}

/**
 * Renders the "what to do now" text printed at the end of `bugwarden init`, tailored to the
 * chosen framework and whether a notification channel's env var was just wired up.
 */
export function renderNextSteps(
  framework: BugwardenFramework,
  channelConfigured: boolean
): string {
  const peerInstall = FRAMEWORK_PEER_INSTALL[framework];
  const steps = peerInstall
    ? [`1. ${peerInstall}`, "2. Add this to your app:"]
    : ["1. Add this to your app:"];

  const lines = ["", "Next steps:", ...steps, "", FRAMEWORK_SNIPPET[framework], ""];

  if (channelConfigured) {
    lines.push(
      "bugwarden() picks up the webhook URL from .env automatically (zero-config mode) — no",
      'options object needed. Make sure your app loads .env (e.g. require("dotenv").config()).'
    );
  } else {
    lines.push(
      "No alert channel configured. Re-run `npx bugwarden init` any time to add one, or pass",
      "configureSlackNotification / configureWebhookNotification / configureDiscordNotification",
      "directly — see the README for details."
    );
  }

  return lines.join("\n");
}

function parseFramework(answer: string): BugwardenFramework {
  const normalized = answer.trim().toLowerCase();
  return normalized === "fastify" || normalized === "koa" ? normalized : "express";
}

function parseChannel(answer: string): BugwardenChannel | "skip" {
  const normalized = answer.trim().toLowerCase();
  return normalized === "slack" || normalized === "discord" || normalized === "webhook"
    ? normalized
    : "skip";
}

/**
 * Interactive `npx bugwarden init` flow. Asks which framework and (optionally) which
 * notification channel to wire up, writes the corresponding BUGWARDEN_*_WEBHOOK_URL to a
 * .env file in the current directory (zero-config mode, see resolveZeroConfigOptions), and
 * prints the one-line code snippet needed to start using it. Never touches application
 * source files — only .env and stdout.
 */
export async function main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // readline/promises' question() hangs after the first call when stdin is piped rather
  // than a TTY (e.g. `echo "..." | npx bugwarden init`, or this file's own tests) — reading
  // answers off the interface's async iterator instead works reliably either way.
  const lines = rl[Symbol.asyncIterator]();

  const ask = async (prompt: string): Promise<string> => {
    process.stdout.write(prompt);
    const { value, done } = await lines.next();
    return done ? "" : value;
  };

  try {
    console.log("BugWarden init\n");

    const framework = parseFramework(
      await ask("Which framework are you using? [express/fastify/koa] (express): ")
    );

    const channel = parseChannel(
      await ask(
        "Which alert channel would you like to configure? [slack/discord/webhook/skip] (skip): "
      )
    );

    let channelConfigured = false;

    if (channel !== "skip") {
      const webhookUrl = (
        await ask(`Paste your ${channel} webhook URL (leave blank to fill in later): `)
      ).trim();

      const envPath = join(process.cwd(), ".env");
      const existingEnvContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
      const updatedEnvContent = addWebhookEnvVar(existingEnvContent, channel, webhookUrl);

      if (updatedEnvContent === null) {
        console.log(`\n${CHANNEL_ENV_KEY[channel]} is already set in .env — leaving it as is.`);
      } else {
        writeFileSync(envPath, updatedEnvContent, "utf8");
        console.log(`\nWrote ${CHANNEL_ENV_KEY[channel]} to ${envPath}`);
      }
      channelConfigured = true;
    }

    console.log(renderNextSteps(framework, channelConfigured));
  } finally {
    rl.close();
  }
}
