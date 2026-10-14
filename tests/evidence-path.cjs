"use strict";

const OUTPUT_DIR = "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs";

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
  return OUTPUT_DIR + "/" + name + "_" + scenario + "_" + dateStamp() + ".png";
}

module.exports = { evidencePath };
