import { BugwardenLogProperties } from "../bugwarden_log_properties";

export type BugwardenLoggingOption =
  | boolean
  | (keyof BugwardenLogProperties)[]
  | undefined;
