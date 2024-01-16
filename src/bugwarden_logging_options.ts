import { BugwardenLogProperties } from "./bugwarden_log_properties";

export type BugwardenLoggingOptions =
  | boolean
  | (keyof BugwardenLogProperties)[]
  | undefined;
