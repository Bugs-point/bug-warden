#!/usr/bin/env node
"use strict";

const command = process.argv[2];

if (command === "init") {
  require("../dist/cli.js")
    .main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    });
} else {
  console.log("Usage: bugwarden init");
  process.exitCode = command ? 1 : 0;
}
