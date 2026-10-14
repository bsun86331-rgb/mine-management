"use strict";
const { evidencePath } = require("./evidence-path.cjs");
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST同一丢失记录只扣款一次且独立丢失分别计入", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-LOSS-PAY-ADMIN", employeeNo: "TEST-LOSS-PAY-ADMIN", name: "TEST工资管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const worker = { personId: "TEST-LOSS-PAY-EMPLOYEE", employeeNo: "TEST-LOSS-PAY-EMPLOYEE", name: "TEST赔偿员工", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    localStorage.setItem("personnelRecords", JSON.stringify([admin, worker]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", rows: [admin, worker].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-LOSS-PAY-ADMIN-STANDARD", scope: "person", standardType: "fixed_person", personId: admin.personId, salaryStage: "regular", regularSalary: 1000, baseSalary: 1000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-LOSS-PAY-EMPLOYEE-STANDARD", scope: "position", standardType: "frontline_position", position: "汽车司机", salaryMode: "performance", baseSalary: 1, performanceUnitPrice: 0, effectiveDate: "2026-01-01", status: "active" }
    ]));
    localStorage.setItem("materialLostRecords", JSON.stringify([
      { lostId: "TEST-LOST-002", materialId: "TEST-MAT-LOSS-001", personId: worker.personId, personName: worker.name, compensationAmount: 25, status: "written_off", writeOffAt: `${month}-10T03:00:00.000Z` },
      { lostId: "TEST-LOST-002", materialId: "TEST-MAT-LOSS-001", personId: worker.personId, personName: worker.name, compensationAmount: 25, status: "written_off", writeOffAt: `${month}-10T03:00:00.000Z` }
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
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).slice(1) || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("footer")).toContainText("V2.10.8");
  const payroll = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").find(row => row.personId === "TEST-LOSS-PAY-EMPLOYEE"));
  const lossSummary = await page.evaluate(() => { const rows = JSON.parse(localStorage.getItem("materialLostRecords") || "[]"); return { duplicateCount: rows.length, uniqueLostIds: [...new Set(rows.map(row => row.lostId))] }; });
  console.log("TEST duplicate written-off loss payroll observation:", JSON.stringify({ otherDeduction: payroll?.otherDeduction, ...lossSummary }));
  expect(payroll).toBeTruthy();
  expect(Number(payroll?.otherDeduction)).toBe(25);
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("materialLostRecords") || "[]");
    rows.push({ lostId: "TEST-LOST-003", materialId: "TEST-MAT-LOSS-001", personId: "TEST-LOSS-PAY-EMPLOYEE", personName: "TEST赔偿员工", compensationAmount: 15, status: "written_off", writeOffAt: `${new Date().toISOString().slice(0, 7)}-10T03:00:00.000Z` });
    localStorage.setItem("materialLostRecords", JSON.stringify(rows));
    localStorage.setItem("payrollMonthlyRecords", "[]");
    generateMonthlyPayroll(false);
  });
  const payrollAfterIndependentLoss = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").find(row => row.personId === "TEST-LOSS-PAY-EMPLOYEE"));
  expect(Number(payrollAfterIndependentLoss?.otherDeduction)).toBe(40);
  await page.screenshot({ path: evidencePath("证据_OPS-07_物资丢失重复计入工资", "payroll-material-loss-double-deduction-probe"), fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});
