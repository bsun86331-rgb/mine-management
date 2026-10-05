"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(__dirname, "reports", "data-storage-audit.json");
const OUTPUT = path.join(__dirname, "reports", "database-mapping-review.md");

if (!fs.existsSync(INPUT)) {
  console.error("未找到 tests\\reports\\data-storage-audit.json");
  console.error("请先运行：node tests\\data-storage-audit.js");
  process.exit(1);
}

const audit = JSON.parse(fs.readFileSync(INPUT, "utf8"));
const rows = Array.isArray(audit.rows) ? audit.rows : [];
const unmapped = rows.filter(row => row.target === "待设计");
const crossPage = rows.filter(row => Array.isArray(row.files) && row.files.length >= 3);
const directDelete = rows.filter(row => Array.isArray(row.operations) && row.operations.includes("removeItem"));

function suggestTarget(key, category) {
  const lower = String(key || "").toLowerCase();
  if (/dispatch.*task|published.*task/.test(lower)) return "dispatch_tasks";
  if (/shift.*execution|shift.*record/.test(lower)) return "shift_executions";
  if (/trip|transport.*record|haul/.test(lower)) return "trip_records";
  if (/gps|location|zone/.test(lower)) return "gps_events / transport_zones";
  if (/equipment.*check|usage.*check/.test(lower)) return "equipment_checks";
  if (/maintenance.*request|repair.*request/.test(lower)) return "maintenance_requests";
  if (/maintenance.*order|work.*order/.test(lower)) return "maintenance_orders";
  if (/warehouse|material.*stock|inventory/.test(lower)) return "warehouse_materials / warehouse_transactions";
  if (/material.*request/.test(lower)) return "material_requests";
  if (/attendance/.test(lower)) return "attendance_records";
  if (/leave/.test(lower)) return "leave_requests";
  if (/fuel.*request/.test(lower)) return "fuel_requests";
  if (/fuel.*record/.test(lower)) return "fuel_records";
  if (/fuel.*intake/.test(lower)) return "fuel_intakes";
  if (/fuel.*adjust|stock.*adjust/.test(lower)) return "fuel_stock_adjustments";
  if (/finance|cost/.test(lower)) return "finance_costs";
  if (/payroll|salary/.test(lower)) return "payroll_*";
  if (/audit|log|history/.test(lower)) return "audit_logs";
  if (/config|setting/.test(lower)) return "system_settings";
  if (/draft|filter|search|ui|page|tab/.test(lower)) return "保留本地";
  if (category === "身份/人员") return "personnel / auth_profile / 本地会话";
  return "人工确认";
}

const groups = new Map();
for (const row of unmapped) {
  const category = row.category || "待人工确认";
  if (!groups.has(category)) groups.set(category, []);
  groups.get(category).push(row);
}

const md = [];
md.push("# mine-management 数据库映射复核清单");
md.push("");
md.push("- 存储键总数：" + (audit.stats?.totalKeys ?? rows.length));
md.push("- 业务类键：" + (audit.stats?.businessKeys ?? "-"));
md.push("- 已映射：" + (audit.stats?.mappedKeys ?? "-"));
md.push("- 待设计：" + unmapped.length);
md.push("- 跨3个以上页面：" + crossPage.length);
md.push("- 存在 removeItem：" + directDelete.length);
md.push("");
md.push("## 待设计键");
md.push("");

for (const [category, items] of [...groups.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]), "zh-CN"))) {
  md.push("### " + category);
  md.push("");
  md.push("| Key | 建议目标 | 使用文件 |");
  md.push("|---|---|---|");
  for (const row of items.sort((a,b)=>String(a.key).localeCompare(String(b.key), "en"))) {
    const files = (row.files || []).map(file => "`" + file + "`").join("<br>");
    md.push("| `" + row.key + "` | " + suggestTarget(row.key, row.category) + " | " + files + " |");
  }
  md.push("");
}

md.push("## 跨页面高优先级");
md.push("");
for (const row of crossPage.sort((a,b)=>(b.files?.length||0)-(a.files?.length||0)).slice(0,40)) {
  md.push("- `" + row.key + "`： " + (row.files || []).join("、"));
}

md.push("");
md.push("## 直接删除风险");
md.push("");
if (!directDelete.length) md.push("未发现 removeItem。");
for (const row of directDelete) md.push("- `" + row.key + "`： " + (row.files || []).join("、"));

fs.writeFileSync(OUTPUT, md.join("\n"), "utf8");

console.log("");
console.log("数据库映射复核完成");
console.log("待设计键：", unmapped.length);
console.log("跨3个以上页面：", crossPage.length);
console.log("存在removeItem：", directDelete.length);
console.log("");
console.log("待设计键明细：");
console.log("");
for (const [category, items] of [...groups.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]), "zh-CN"))) {
  console.log("[" + category + "]");
  for (const row of items) console.log(" - " + row.key + " -> " + suggestTarget(row.key, row.category));
  console.log("");
}
console.log("Markdown:", path.relative(ROOT, OUTPUT));