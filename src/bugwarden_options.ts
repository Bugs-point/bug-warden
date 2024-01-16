import { BugwardenLoggingOptions } from "./bugwarden_logging_options";

export class BugwardenOptions {
  constructor(public logging?: BugwardenLoggingOptions) {
    this.logging = logging;
  }
}
