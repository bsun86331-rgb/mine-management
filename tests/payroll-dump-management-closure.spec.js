"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST排土管理工资使用岗位标准、个人覆盖且缺失标准不虚算", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-DUMP-PAY-ADMIN", employeeNo: "TEST-DUMP-PAY-ADMIN", name: "TEST工资管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const dumpRole = [
      { personId: "TEST-DUMP-PAY-001", employeeNo: "TEST-DUMP-PAY-001", name: "TEST排土岗位标准人员", position: "排土管理", status: "approved", approvalStatus: "approved" },
      { personId: "TEST-DUMP-PAY-002", employeeNo: "TEST-DUMP-PAY-002", name: "TEST排土个人覆盖人员", position: "排土管理", status: "approved", approvalStatus: "approved" },
      { personId: "TEST-DUMP-PAY-003", employeeNo: "TEST-DUMP-PAY-003", name: "TEST排土缺标准人员", position: "排土管理", status: "approved", approvalStatus: "approved" }
    ];
    localStorage.setItem("personnelRecords", JSON.stringify([admin, ...dumpRole]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{
      lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`,
      month,
      status: "locked",
      lockedBy: "TEST管理员",
      totalAttendance: 30,
      rows: [admin, ...dumpRole].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 30, deduction: 0 }))
    }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-DUMP-POSITION-STANDARD", scope: "position", standardType: "dump_management_fixed_position", position: "排土管理", monthlySalary: 6000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-DUMP-PERSON-OVERRIDE", scope: "person", standardType: "fixed_person", personId: "TEST-DUMP-PAY-002", salaryStage: "regular", regularSalary: 7200, probationSalary: 6800, baseSalary: 7200, effectiveDate: "2026-01-01", status: "active" }
    ]));
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
    localStorage.setItem("rewardRecords", "[]");
    localStorage.setItem("penaltyRecords", "[]");
    localStorage.setItem("overtimeRecords", "[]");
    localStorage.setItem("tripRecords", "[]");
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("performanceRankingRecords", "[]");
  });
  await page.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) {
      blocked.push(`${req.method()} ${req.url()}`);
      return route.abort();
    }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try {
      const body = await fs.readFile(file);
      const ext = path.extname(file);
      return route.fulfill({ status: 200, contentType: ext === ".html" ? "text/html; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : "application/octet-stream", body });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]"));
  const positionStandard = rows.find(row => row.personId === "TEST-DUMP-PAY-001");
  const personOverride = rows.find(row => row.personId === "TEST-DUMP-PAY-002");
  expect(positionStandard).toMatchObject({ position: "排土管理", salaryStandardKind: "dump_management_fixed", salaryStandardId: "TEST-DUMP-POSITION-STANDARD", salaryStage: "position_fixed", baseSalary: 6000, performanceSalary: 0, payableSalary: 6000 });
  expect(positionStandard.description).toContain("排土管理岗位固定月薪");
  expect(personOverride).toMatchObject({ position: "排土管理", salaryStandardKind: "dump_management_fixed", salaryStandardId: "TEST-DUMP-PERSON-OVERRIDE", baseSalary: 7200, performanceSalary: 0, payableSalary: 7200 });
  expect(personOverride.description).toContain("排土管理个人覆盖工资标准");
  const missingStandard = await page.evaluate(() => {
    localStorage.setItem("payrollStandards", "[]");
    window.generateMonthlyPayroll(true);
    return JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").find(row => row.personId === "TEST-DUMP-PAY-003");
  });
  expect(missingStandard).toMatchObject({ position: "排土管理", salaryStandardKind: "dump_management_fixed", salaryStandardId: "", baseSalary: 0, performanceSalary: 0, payableSalary: 0 });
  expect(missingStandard.description).toContain("未设置岗位工资标准");
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

