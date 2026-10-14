"use strict";

// Isolated regression probe for DataService primary-key selection.
// It intentionally expects distinct business rows for one person/material to coexist.
// Current GitHub snapshot is expected to fail the cases listed below; after the fix it must pass.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "js", "data-service.js"), "utf8");

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); }
  };
}

function makeService() {
  const localStorage = makeStorage();
  const context = {
    window: null, localStorage, sessionStorage: makeStorage(),
    fetch: async () => { throw new Error("network disabled in regression probe"); },
    console, setTimeout, clearTimeout, JSON, Date, Math
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "js/data-service.js" });
  return { service: context.MineDataService, localStorage };
}

const cases = [
  ["attendance_records", "attendanceId", { date:"2026-10-14" }, { date:"2026-10-15" }],
  ["leave_requests", "leaveId", { startTime:"2026-10-14" }, { startTime:"2026-10-16" }],
  ["attendance_geofence_attempts", "attemptId", { action:"check_in" }, { action:"check_out" }],
  ["zero_production_reports", "reportId", { date:"2026-10-14" }, { date:"2026-10-15" }],
  ["equipment_checks", "checkId", { equipmentId:"TEST-TRUCK-1" }, { equipmentId:"TEST-TRUCK-2" }],
  ["equipment_meter_readings", "meterRecordId", { equipmentId:"TEST-TRUCK-1", reading:1 }, { equipmentId:"TEST-TRUCK-2", reading:2 }],
  ["penalty_records", "penaltyId", { amount:10 }, { amount:20 }],
  ["payroll_monthly_records", "payrollId", { month:"2026-09" }, { month:"2026-10" }],
  ["material_requests", "requestId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_holders", "holderId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_recycle_records", "recycleId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_scrap_records", "scrapId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_loss_records", "lostId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["warehouse_transactions", "ledgerId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["trip_records", "tripId", { }, { }]
];

(async () => {
  const failures = [];
  for (const [table, idField, oldExtra, newExtra] of cases) {
    const { service, localStorage } = makeService();
    const storageKey = service.tableKeyMap[table];
    if (!storageKey) throw new Error(`${table} is missing from TABLE_KEY_MAP`);
    const oldId = `TEST-${table}-OLD`;
    const newId = `TEST-${table}-NEW`;
    const oldRow = { [idField]:oldId, personId:"TEST-SAME-PERSON", ...oldExtra };
    const newRow = { [idField]:newId, personId:"TEST-SAME-PERSON", ...newExtra };
    if (table.startsWith("material_") || table === "warehouse_transactions") {
      oldRow.materialId = "TEST-SAME-MATERIAL";
      newRow.materialId = "TEST-SAME-MATERIAL";
    }
    if (table === "trip_records") {
      oldRow.id = oldRow.tripId;
      newRow.id = newRow.tripId;
    }
    localStorage.setItem(storageKey, JSON.stringify([oldRow]));
    await service.upsert(table, oldRow);
    // Match app write order: write complete primary array, then DataService upserts the changed row.
    localStorage.setItem(storageKey, JSON.stringify([oldRow, newRow]));
    await service.upsert(table, newRow);
    const rows = await service.list(table);
    const ids = rows.map(row => row[idField]);
    const passed = ids.length === 2 && ids.includes(oldId) && ids.includes(newId);
    console.log(`${passed ? "PASS" : "FAIL"} ${table}: ${ids.join(", ")}`);
    if (!passed) failures.push(table);
  }
  console.log(`SUMMARY ${cases.length - failures.length}/${cases.length} pass; ${failures.length} failed: ${failures.join(", ")}`);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

