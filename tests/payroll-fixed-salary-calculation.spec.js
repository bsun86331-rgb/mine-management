"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST固定工资按锁定考勤扣款并合并奖罚和加班", async ({ page }) => {
  const errors = [];
  const blocked = [];
  await page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-PAYCALC-001", employeeNo: "TEST-PAYCALC-001", name: "TEST工资管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const staff = { personId: "TEST-PAYCALC-002", employeeNo: "TEST-PAYCALC-002", name: "TEST维修员", position: "维修员", status: "approved", approvalStatus: "approved" };
    const driver = { personId: "TEST-PAYCALC-003", employeeNo: "TEST-PAYCALC-003", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([admin, staff, driver]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", lockedBy: "TEST管理员", totalAttendance: 58, rows: [admin, staff, driver].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: person.personId === staff.personId ? 2 : 0 })) }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-PAYCALC-ADMIN", scope: "person", standardType: "fixed_person", personId: admin.personId, salaryStage: "regular", regularSalary: 1000, probationSalary: 1000, baseSalary: 1000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-PAYCALC-STAFF", scope: "person", standardType: "fixed_person", personId: staff.personId, salaryStage: "regular", regularSalary: 5000, probationSalary: 4000, baseSalary: 5000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-PAYCALC-DRIVER", scope: "position", standardType: "frontline_position", position: "汽车司机", salaryMode: "performance", baseSalary: 1, performanceUnitPrice: 0, effectiveDate: "2026-01-01", status: "active" }
    ]));
    localStorage.setItem("rewardRecords", JSON.stringify([{ rewardId: "TEST-REWARD-001", personId: staff.personId, amount: 100, status: "acknowledged", createdAt: `${month}-10T03:00:00.000Z` }]));
    localStorage.setItem("penaltyRecords", JSON.stringify([{ penaltyId: "TEST-PENALTY-001", personId: staff.personId, amount: 20, status: "acknowledged", createdAt: `${month}-11T03:00:00.000Z` }]));
    localStorage.setItem("overtimeRecords", JSON.stringify([{ overtimeId: "TEST-OVERTIME-001", personId: staff.personId, amount: 50, status: "completed", workDate: `${month}-12` }]));
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
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
      return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) });
    } catch {
      return route.fulfill({ status: 404, body: "missing test asset" });
    }
  });

  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]"));
  const staffPayroll = rows.find(row => row.personId === "TEST-PAYCALC-002");
  expect(rows).toHaveLength(3);
  expect(staffPayroll).toMatchObject({
    baseSalary: 5000,
    attendanceDeductionDays: 2,
    payrollNaturalDays: 31,
    attendanceSalaryDeduction: 322.58,
    reward: 100,
    overtime: 50,
    otherDeduction: 20,
    payableSalary: 4807.42
  });
  expect(rows.every(row => row.salaryStandardId)).toBeTruthy();
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
