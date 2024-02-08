import { BugwardenLogLevelColors } from "./types/bugwarden_log_level_color";

export const BugwardenLogLevelColorsPalette: BugwardenLogLevelColors = {
  VERBOSE: "\x1b[90m", // Gray
  LOG: "\x1b[36m",
  DEBUG: "\x1b[34m", // Blue
  ERROR: "\x1b[31m", // Red
  WARNING: "\x1b[33m", // Yellow
};
