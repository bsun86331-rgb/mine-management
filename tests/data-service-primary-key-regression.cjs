"use strict";

// Isolated regression probe for DataService primary-key selection.
// It intentionally expects distinct business rows for one person/material to coexist.
// Regression invariant: distinct business rows with the same person/material must coexist.
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

function extractObjectLiteral(name) {
  const marker = `const ${name} =`;
  const declaration = source.indexOf(marker);
  if (declaration < 0) throw new Error(`Missing ${name} in DataService`);
  const start = source.indexOf("{", declaration);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) {
      return vm.runInNewContext("(" + source.slice(start, i + 1) + ")");
    }
  }
  throw new Error(`Unclosed ${name} declaration`);
}

function findSchemaPrimaryKeyGaps() {
  const appTables = extractObjectLiteral("TABLE_KEY_MAP");
  const mappedKeys = extractObjectLiteral("TABLE_PRIMARY_KEY_MAP");
  const candidateStart = source.indexOf("const candidates = [");
  const candidateEnd = source.indexOf("\n        ];", candidateStart);
  if (candidateStart < 0 || candidateEnd < 0) throw new Error("Cannot read generic primary-key candidates");
  const genericKeys = new Set(
    [...source.slice(candidateStart, candidateEnd).matchAll(/"([^"]+)"/g)].map(match => match[1])
  );
  const readStart = source.indexOf("function readRaw(");
  const readEnd = source.indexOf("\n    function writeRaw(", readStart);
  if (readStart < 0 || readEnd < 0) throw new Error("Cannot read singleton-storage rules");
  const singletonTables = new Set(
    [...source.slice(readStart, readEnd).matchAll(/table\s*===\s*"([a-z_]+)"/g)].map(match => match[1])
  );
  const schema = fs.readFileSync(path.join(ROOT, "database", "database-schema.sql"), "utf8");
  const blocks = [...schema.matchAll(/create table if not exists\s+([a-z_]+)\s*\(([\s\S]*?)\);/gi)];
  const gaps = [];
  for (const [, table, columns] of blocks) {
    if (!appTables[table] || singletonTables.has(table)) continue;
    const pk = columns.match(/^\s*([a-z_]+)\s+[^,\n]*\bprimary key\b/im)?.[1];
    if (!pk) continue;
    const camelPk = pk.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const explicit = mappedKeys[table] || [];
    if (!explicit.includes(pk) && !explicit.includes(camelPk) &&
        !genericKeys.has(pk) && !genericKeys.has(camelPk)) {
      gaps.push(`${table}.${pk}`);
    }
  }
  return gaps;
}

const cases = [
  ["attendance_records", "attendanceId", { date:"2026-10-14" }, { date:"2026-10-15" }],
  ["leave_requests", "leaveId", { startTime:"2026-10-14" }, { startTime:"2026-10-16" }],
  ["attendance_geofence_attempts", "attemptId", { action:"check_in" }, { action:"check_out" }],
  ["zero_production_reports", "reportId", { date:"2026-10-14" }, { date:"2026-10-15" }],
  ["equipment_checks", "checkId", { equipmentId:"TEST-TRUCK-1" }, { equipmentId:"TEST-TRUCK-2" }],
  ["equipment_meter_readings", "meterRecordId", { equipmentId:"TEST-TRUCK-1", reading:1 }, { equipmentId:"TEST-TRUCK-2", reading:2 }],
  ["penalty_records", "penaltyId", { amount:10 }, { amount:20 }],
  ["reward_records", "rewardId", { amount:10 }, { amount:20 }],
  ["overtime_records", "overtimeId", { hours:2 }, { hours:4 }],
  ["payroll_monthly_records", "payrollId", { month:"2026-09" }, { month:"2026-10" }],
  ["material_requests", "requestId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_holders", "holderId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_recycle_records", "recycleId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_scrap_records", "scrapId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["material_loss_records", "lostId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["warehouse_transactions", "ledgerId", { materialId:"TEST-MAT-1" }, { materialId:"TEST-MAT-2" }],
  ["trip_records", "tripId", { }, { }]
];

const upsertCases = [["shift_executions","shiftId","TEST-SHIFT-1"],["transport_zones","zoneId","TEST-ZONE-1"],["equipment","equipmentId","TEST-EQUIP-1"],["equipment_operational_status","equipmentId","TEST-EQUIP-1"],["workshop_bays","bayId","TEST-BAY-1"],["fuel_intakes","intakeId","TEST-INTAKE-1"],["fuel_stock_adjustments","adjustmentId","TEST-ADJUSTMENT-1"],["payroll_monthly_locks","month","2099-12"],["equipment_maintenance_settings","equipmentId","TEST-EQUIP-1"],["shift_executions","shift_id","TEST-SHIFT-1"],["transport_zones","zone_id","TEST-ZONE-1"],["equipment","equipment_id","TEST-EQUIP-1"],["equipment_operational_status","equipment_id","TEST-EQUIP-1"],["workshop_bays","bay_id","TEST-BAY-1"],["fuel_intakes","intake_id","TEST-INTAKE-1"],["fuel_stock_adjustments","adjustment_id","TEST-ADJUSTMENT-1"],["payroll_monthly_locks","payroll_month","2099-12"],["equipment_maintenance_settings","equipment_id","TEST-EQUIP-1"],["payroll_monthly_locks","payrollMonth","2099-12"]];

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
  for (const [table, idField, id] of upsertCases) {
    const { service, localStorage } = makeService();
    const storageKey = service.tableKeyMap[table];
    if (!storageKey) throw new Error(`${table} is missing from TABLE_KEY_MAP`);
    localStorage.setItem(storageKey, JSON.stringify([{ [idField]:id, value:"old" }]));
    await service.upsert(table, { [idField]:id, value:"new" });
    const rows = await service.list(table);
    const passed = rows.length === 1 && rows[0][idField] === id && rows[0].value === "new";
    console.log(`${passed ? "PASS" : "FAIL"} ${table} same-key upsert rows=${rows.length} value=${rows[0]?.value}`);
    if (!passed) failures.push(table);
  }
  const schemaGaps = findSchemaPrimaryKeyGaps();
  const schemaPass = schemaGaps.length === 0;
  console.log(`${schemaPass ? "PASS" : "FAIL"} schema primary-key coverage: ${schemaGaps.length ? schemaGaps.join(", ") : "all registered array tables covered"}`);
  if (!schemaPass) failures.push("schema_primary_key_coverage");
  console.log(`SUMMARY ${cases.length + upsertCases.length + 1 - failures.length}/${cases.length + upsertCases.length + 1} pass; ${failures.length} failed: ${failures.join(", ")}`);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

