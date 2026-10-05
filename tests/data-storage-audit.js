"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(__dirname, "reports");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "images",
  "css",
  "tests"
]);

const EXCLUDED_FILES = new Set([
  "robot-test-center.html",
  "transport-test-fixture.html"
]);

const CATEGORY_RULES = [
  { re: /person|driver|employee|role|position|applicant|managementSession|adminPerson|managerPerson|accountantPerson/i, category: "身份/人员" },
  { re: /dispatch|task|shift|trip|transport|zone|gps|location/i, category: "调度/运输/GPS" },
  { re: /equipment|maintenance|repair|workshop|bay/i, category: "设备/维修" },
  { re: /warehouse|material|stock/i, category: "库房/物资" },
  { re: /attendance|leave|zeroProduction/i, category: "考勤/请假" },
  { re: /fuel/i, category: "油料/加油" },
  { re: /finance|cost/i, category: "财务成本" },
  { re: /payroll|salary|reward|deduction/i, category: "工资/奖扣" },
  { re: /draft|filter|search|ui|tab|page|form/i, category: "页面缓存/草稿" },
  { re: /test|fixture|demo|mock|robot/i, category: "测试/演示" }
];

const TABLE_MAP = {
  personnelRecords: "personnel",
  dispatchPublishedTasks: "dispatch_tasks",
  publishedDispatchTask: "dispatch_tasks",
  dispatchShiftExecutions: "shift_executions",
  tripRecords: "trip_records",
  driverTripRecords: "trip_records",
  transportZones: "transport_zones",
  equipmentRecords: "equipment",
  equipmentUsageChecks: "equipment_checks",
  equipmentOperationalStatus: "equipment_operational_status",
  maintenanceRequests: "maintenance_requests",
  maintenanceWorkOrders: "maintenance_orders",
  workshopBays: "workshop_bays",
  warehouseMaterials: "warehouse_materials",
  materialRequests: "material_requests",
  attendanceRecords: "attendance_records",
  leaveRequests: "leave_requests",
  leaveRecords: "leave_requests",
  driverLeaveRequests: "leave_requests",
  zeroProductionReports: "zero_production_reports",
  fuelRequests: "fuel_requests",
  fuelRecords: "fuel_records",
  fuelIntakeRecords: "fuel_intakes",
  fuelStockAdjustments: "fuel_stock_adjustments",
  fuelStationConfig: "fuel_station_config",
  financeCostRecords: "finance_costs",
  generalManagerCostInputs: "finance_costs",
  payrollStandards: "payroll_standards",
  payrollRules: "payroll_rules",
  teamTransferRequests: "team_transfer_requests",
  generalManagerBusinessSettings: "general_manager_business_settings",
  productionVolumeSettings: "production_volume_settings",
  penaltyRecords: "penalty_records",
  temporaryUnloadRequests: "temporary_unload_requests",
  auxiliaryWorkRecords: "auxiliary_work_records",
  payrollAuditLogs: "payroll_audit_logs",
  payrollMonthlyLocks: "payroll_monthly_locks",
  payrollMonthlyRecords: "payroll_monthly_records",
  attendanceGeofenceAttempts: "attendance_geofence_attempts",
  attendanceGeofenceConfig: "attendance_geofence_config",
  materialHolders: "material_holders",
  materialLedger: "warehouse_transactions",
  materialLostRecords: "material_loss_records",
  materialRecycleRecords: "material_recycle_records",
  materialScrapRecords: "material_scrap_records",
  equipmentMaintenanceRecords: "equipment_maintenance_records",
  equipmentMaintenanceSettings: "equipment_maintenance_settings",
  equipmentMeterReadings: "equipment_meter_readings",
  maintenanceAlerts: "maintenance_alerts",
  maintenanceCosts: "maintenance_costs",
  maintenanceReports: "maintenance_reports",
  driverTemporaryLoadingAssignment: "temporary_loading_assignments",
  driverVehicleChangeRequests: "vehicle_change_requests"
};

const CLIENT_ONLY_KEYS = new Set([
  "currentPersonId",
  "selectedPosition",
  "workerPersonId",
  "workerPosition",
  "adminPersonId",
  "managerPersonId",
  "accountantPersonId",
  "pendingProtectedPersonId",
  "pendingProtectedPosition",
  "waitingApplicantPersonId",
  "waitingApplicantPosition",
  "rolePersonIds",
  "managementSession",
  "fuelRequestDraft",
  "fuelRequestManualPerson",
  "maintenanceReportDraft",
  "maintenanceWorkerDrafts",
  "driverProfile",
  "dispatchUserProfile",
  "driverCurrentTask",
  "driverTransportCycleState",
  "pendingTransportZoneSelection",
  "driverLastGpsPosition"
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(ROOT, full).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(full, out);
      continue;
    }

    if (!/\.(?:html|js)$/i.test(entry.name)) continue;
    if (EXCLUDED_FILES.has(rel)) continue;

    out.push({ full, rel });
  }

  return out;
}

function classify(key) {
  if (CLIENT_ONLY_KEYS.has(key)) {
    return "身份/本地会话";
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.re.test(key)) return rule.category;
  }

  return "待人工确认";
}

function targetFor(key, category) {
  if (TABLE_MAP[key]) return TABLE_MAP[key];
  if (category === "身份/本地会话" || category === "页面缓存/草稿") {
    return "保留本地，不迁移为业务主表";
  }
  if (category === "测试/演示") {
    return "测试专用，不进入生产数据库";
  }
  return "待设计";
}

function addUse(map, key, use) {
  if (!key || key.length > 120) return;

  if (!map.has(key)) {
    map.set(key, {
      key,
      localStorage: false,
      sessionStorage: false,
      files: new Set(),
      operations: new Set(),
      refs: []
    });
  }

  const row = map.get(key);
  row[use.storage] = true;
  row.files.add(use.file);
  row.operations.add(use.operation);

  if (row.refs.length < 12) {
    row.refs.push({
      file: use.file,
      line: use.line,
      operation: use.operation,
      storage: use.storage
    });
  }
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function extractStorageConstants(text) {
  const out = new Map();

  const objectRe = /const\s+([A-Z0-9_]*STORAGE[A-Z0-9_]*)\s*=\s*\{([\s\S]*?)\};/g;
  let match;

  while ((match = objectRe.exec(text))) {
    const body = match[2];
    const propRe = /([A-Z0-9_]+)\s*:\s*["']([^"']+)["']/g;
    let p;

    while ((p = propRe.exec(body))) {
      out.set(match[1] + "." + p[1], p[2]);
    }
  }

  const keyRe = /const\s+([A-Z0-9_]*(?:KEY|STORAGE)[A-Z0-9_]*)\s*=\s*["']([^"']+)["']/g;

  while ((match = keyRe.exec(text))) {
    out.set(match[1], match[2]);
  }

  return out;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function scanFile(file, map) {
  const text = fs.readFileSync(file.full, "utf8");
  const constants = extractStorageConstants(text);

  const directRe = /(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\s*\(\s*["']([^"']+)["']/g;
  let match;

  while ((match = directRe.exec(text))) {
    addUse(map, match[3], {
      storage: match[1],
      operation: match[2],
      file: file.rel,
      line: lineOf(text, match.index)
    });
  }

  const symbolRe = /(localStorage|sessionStorage)\.(getItem|setItem|removeItem)\s*\(\s*([A-Z0-9_]+(?:\.[A-Z0-9_]+)?)/g;

  while ((match = symbolRe.exec(text))) {
    const key = constants.get(match[3]);
    if (!key) continue;

    addUse(map, key, {
      storage: match[1],
      operation: match[2],
      file: file.rel,
      line: lineOf(text, match.index)
    });
  }

  for (const [symbol, key] of constants.entries()) {
    const genericRe = new RegExp(
      "(?:readArray|readJson|saveArray|save|saveRecords|readRecords|getItem|setItem)\\s*\\(\\s*" +
      escapeRegex(symbol) +
      "\\b",
      "g"
    );

    while ((match = genericRe.exec(text))) {
      addUse(map, key, {
        storage: "localStorage",
        operation: "via-helper",
        file: file.rel,
        line: lineOf(text, match.index)
      });
    }
  }
}

function riskNotes(row, category, target) {
  const notes = [];

  if (row.localStorage && row.sessionStorage) {
    notes.push("同一键同时出现在 localStorage/sessionStorage，需确认作用域");
  }

  if (row.operations.has("removeItem")) {
    notes.push("存在直接删除操作，迁库后建议改为状态/软删除或受控清理");
  }

  if (row.files.size >= 3 && !CLIENT_ONLY_KEYS.has(row.key)) {
    notes.push("跨多个页面读写，迁库时优先统一到 data-service");
  }

  if (target === "待设计") {
    notes.push("尚未建立明确数据库表映射");
  }

  if (category === "身份/本地会话") {
    notes.push("建议保留客户端短期缓存，不作为业务唯一数据源");
  }

  return notes;
}

function markdownEscape(value) {
  return String(value == null ? "" : value)
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

const files = walk(ROOT);
const map = new Map();

for (const file of files) {
  scanFile(file, map);
}

const rows = [...map.values()]
  .map(row => {
    const category = classify(row.key);
    const target = targetFor(row.key, category);

    return {
      key: row.key,
      storage: [
        row.localStorage ? "localStorage" : "",
        row.sessionStorage ? "sessionStorage" : ""
      ].filter(Boolean).join(" + "),
      category,
      target,
      files: [...row.files].sort(),
      operations: [...row.operations].sort(),
      refs: row.refs,
      notes: riskNotes(row, category, target)
    };
  })
  .sort((a, b) =>
    a.category.localeCompare(b.category, "zh-CN") ||
    a.key.localeCompare(b.key, "en")
  );

const stats = {
  scannedFiles: files.length,
  totalKeys: rows.length,
  businessKeys: rows.filter(row =>
    !["身份/本地会话", "页面缓存/草稿", "测试/演示"].includes(row.category)
  ).length,
  localOnlyKeys: rows.filter(row =>
    ["身份/本地会话", "页面缓存/草稿"].includes(row.category)
  ).length,
  mappedKeys: rows.filter(row =>
    !["待设计", "保留本地，不迁移为业务主表", "测试专用，不进入生产数据库"].includes(row.target)
  ).length,
  unmappedBusinessKeys: rows.filter(row =>
    row.target === "待设计"
  ).length
};

fs.mkdirSync(REPORT_DIR, { recursive: true });

const jsonPath = path.join(REPORT_DIR, "data-storage-audit.json");
fs.writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      stats,
      rows
    },
    null,
    2
  ),
  "utf8"
);

const md = [];

md.push("# mine-management 数据层审计 / 数据库迁移映射");
md.push("");
md.push("> 自动扫描正式 HTML/JS；排除 tests、robot-test-center.html、transport-test-fixture.html、图片和 CSS。");
md.push("");
md.push("## 汇总");
md.push("");
md.push("- 扫描正式代码文件：" + stats.scannedFiles);
md.push("- 发现存储键：" + stats.totalKeys);
md.push("- 业务类键：" + stats.businessKeys);
md.push("- 本地身份/草稿类键：" + stats.localOnlyKeys);
md.push("- 已有明确数据库映射：" + stats.mappedKeys);
md.push("- 仍需人工设计映射：" + stats.unmappedBusinessKeys);
md.push("");
md.push("## 迁移原则");
md.push("");
md.push("1. PostgreSQL/Supabase 成为正式业务唯一数据源。");
md.push("2. localStorage 只保留短期身份缓存、断网 pending queue、页面草稿。");
md.push("3. sessionStorage 只保留当前浏览器会话，不保存正式业务记录。");
md.push("4. 跨页面共用业务键优先封装到统一 data-service.js。");
md.push("5. 业务记录原则上不直接物理删除，使用 status / deleted_at 进行软删除或归档。");
md.push("6. 图片进入对象存储，数据库只保存 URL、业务 ID、上传人、时间。");
md.push("");
md.push("## 存储键明细");
md.push("");
md.push("| Key | 存储 | 分类 | 未来数据库/处理方式 | 使用文件 | 操作 | 风险/备注 |");
md.push("|---|---|---|---|---|---|---|");

for (const row of rows) {
  md.push(
    "| " +
    [
      "\`" + row.key + "\`",
      row.storage || "-",
      row.category,
      row.target,
      row.files.map(x => "\`" + x + "\`").join("<br>"),
      row.operations.join(", "),
      row.notes.length ? row.notes.join("；") : "-"
    ]
      .map(markdownEscape)
      .join(" | ") +
    " |"
  );
}

md.push("");
md.push("## 第一批建议迁移");
md.push("");
md.push("人员/权限 → 车辆设备 → 调度任务/班次 → 运输趟次/GPS关键节点 → 设备检查 → 维修。");
md.push("");
md.push("第二批：库房/物资 → 考勤/请假 → 油料/加油申请。");
md.push("");
md.push("第三批：财务成本 → 工资标准/奖扣 → 综合报表。");
md.push("");
md.push("## 下一步");
md.push("");
md.push("先人工复核本报告中的“待设计”和“跨多个页面读写”项，再建立 database-schema.sql 与 data-service.js，不直接改生产页面。");

const mdPath = path.join(REPORT_DIR, "data-storage-audit.md");
fs.writeFileSync(mdPath, md.join("\n"), "utf8");

console.log("");
console.log("数据层审计完成");
console.log("正式代码文件:", stats.scannedFiles);
console.log("存储键:", stats.totalKeys);
console.log("业务类键:", stats.businessKeys);
console.log("已映射:", stats.mappedKeys);
console.log("待设计:", stats.unmappedBusinessKeys);
console.log("");
console.log("Markdown:", path.relative(ROOT, mdPath));
console.log("JSON:", path.relative(ROOT, jsonPath));
