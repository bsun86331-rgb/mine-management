"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0, state = "code", escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (state === "line") { if (ch === "\n") state = "code"; continue; }
    if (state === "block") { if (ch === "*" && next === "/") { state = "code"; i++; } continue; }
    if (["single", "double", "template"].includes(state)) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if ((state === "single" && ch === "'") || (state === "double" && ch === '"') || (state === "template" && ch === "`")) state = "code";
      continue;
    }
    if (ch === "/" && next === "/") { state = "line"; i++; continue; }
    if (ch === "/" && next === "*") { state = "block"; i++; continue; }
    if (ch === "'") { state = "single"; continue; }
    if (ch === '"') { state = "double"; continue; }
    if (ch === "`") { state = "template"; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

const root = path.resolve(__dirname, "..");
const dispatchSource = fs.readFileSync(path.join(root, "js/dispatch.js"), "utf8");
const maintenanceSource = fs.readFileSync(path.join(root, "maintenance.html"), "utf8");
const normalizeStatusSource = extractFunction(dispatchSource, "normalizeEquipmentStatus");
const normalizeRecordSource = extractFunction(dispatchSource, "normalizeEquipmentRecord");
const dispatchableSource = extractFunction(dispatchSource, "isEquipmentDispatchable");
const syncStatusSource = extractFunction(maintenanceSource, "syncEquipmentMasterStatus");
const normalizeStatus = new Function(`${normalizeStatusSource}; return normalizeEquipmentStatus;`)();
const normalizeRecord = new Function("getEquipmentGroup", "normalizeEquipmentStatus", `${normalizeRecordSource}; return normalizeEquipmentRecord;`)(() => "truck", normalizeStatus);
const isDispatchable = new Function(`${dispatchableSource}; return isEquipmentDispatchable;`)();
const store = new Map([["equipmentRecords", JSON.stringify([{
  equipmentId: "TEST-DISPATCH-EQ-001", equipmentNumber: "TEST-DISPATCH-EQ-001",
  equipmentType: "矿卡", status: "available", equipmentStatus: "available", currentStatus: "可用"
}])]]);
const localStorage = {
  get length() { return store.size; },
  key(index) { return [...store.keys()][index] ?? null; },
  getItem(key) { return store.get(key) ?? null; },
  setItem(key, value) { store.set(key, String(value)); }
};
const STORAGE = {
  METER_READINGS: "equipmentMeterReadings", MAINTENANCE_SETTINGS: "equipmentMaintenanceSettings",
  MAINTENANCE_ALERTS: "maintenanceAlerts", MAINTENANCE_RECORDS: "equipmentMaintenanceRecords",
  OPERATIONAL_STATUS: "equipmentOperationalStatus"
};
const syncStatus = new Function("localStorage", "STORAGE", `${syncStatusSource}; return syncEquipmentMasterStatus;`)(localStorage, STORAGE);
const equipment = () => JSON.parse(localStorage.getItem("equipmentRecords"))[0];

for (const [status, label] of [["maintenance", "维修中"], ["service", "保养中"], ["disabled", "停用"]]) {
  syncStatus("TEST-DISPATCH-EQ-001", status);
  const raw = equipment();
  const dispatchRecord = normalizeRecord(raw);
  assert.equal(raw.currentStatus, label, `${status} label must sync to currentStatus`);
  assert.equal(dispatchRecord.status, status, `dispatch normalization must see ${status}`);
  assert.equal(isDispatchable(dispatchRecord), false, `${status} equipment must not be dispatchable`);
}
syncStatus("TEST-DISPATCH-EQ-001", "available");
const restored = normalizeRecord(equipment());
assert.equal(equipment().currentStatus, "可用");
assert.equal(restored.status, "available");
assert.equal(isDispatchable(restored), true, "restored equipment should become dispatchable again");
console.log("PASS maintenance/service/disabled blocked from dispatch; restored equipment is available.");

