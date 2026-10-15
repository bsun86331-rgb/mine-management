"use strict";

const { test, expect } = require("@playwright/test");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

test("DataService updates existing rows for schema-backed primary keys", () => {
  const output = execFileSync(
    process.execPath,
    [path.join(__dirname, "data-service-primary-key-regression.cjs")],
    {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      timeout: 30_000
    }
  );

  expect(output).toContain("SUMMARY 26/26 pass; 0 failed:");
});
