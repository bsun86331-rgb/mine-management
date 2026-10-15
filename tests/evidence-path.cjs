"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const OUTPUT_DIR = process.env.MINE_MANAGEMENT_EVIDENCE_DIR
  ? path.resolve(process.env.MINE_MANAGEMENT_EVIDENCE_DIR)
  : path.join(os.tmpdir(), "mine-management-test-evidence");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function dateStamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function evidencePath(name, scenario) {
  return path.join(OUTPUT_DIR, name + "_" + scenario + "_" + dateStamp() + ".png");
}

module.exports = { evidencePath };
