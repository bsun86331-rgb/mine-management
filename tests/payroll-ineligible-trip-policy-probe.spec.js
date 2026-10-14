"use strict";
const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const ORIGIN = "https://mine.test";
const ROOT = path.resolve(__dirname, "..");

test("TEST业务口径探测：不计入正式产量的运输记录是否参与工资绩效", async ({ page }) => {
  const errors = [];
  const blocked = [];
  page.on("pageerror", error => errors.push(error.message));
  const fixture = () => {
    const month = new Date().toISOString().slice(0, 7);
    const admin = { personId: "TEST-ALIAS-ADMIN", employeeNo: "TEST-ALIAS-ADMIN", name: "TEST报表管理员", position: "管理员", status: "approved", approvalStatus: "approved" };
    const driver = { personId: "TEST-ALIAS-DRIVER", employeeNo: "TEST-ALIAS-DRIVER", name: "TEST汽车司机", position: "汽车司机", status: "approved", approvalStatus: "approved" };
    const trip = { tripId: "TEST-ALIAS-TRIP-001", personId: driver.personId, personName: driver.name, status: "completed", officialCountEligible: false, materialType: "煤", completedAt: `${month}-10T03:00:00.000Z` };
    localStorage.setItem("personnelRecords", JSON.stringify([admin, driver]));
    localStorage.setItem("currentPersonId", admin.personId);
    localStorage.setItem("selectedPosition", "管理员");
    sessionStorage.setItem("managementSession", JSON.stringify({ verified: true, personId: admin.personId, position: "管理员", expiresAt: Date.now() + 600000 }));
    localStorage.setItem("adminAttendanceMonthlyLocks", JSON.stringify([{ lockId: `ADMIN_ATT_LOCK_${month.replaceAll("-", "")}`, month, status: "locked", rows: [admin, driver].map(person => ({ personId: person.personId, employeeNo: person.employeeNo, personName: person.name, finalAttendance: 20, deduction: 0 })) }]));
    localStorage.setItem("payrollStandards", JSON.stringify([
      { standardId: "TEST-ALIAS-ADMIN-STANDARD", scope: "person", standardType: "fixed_person", personId: admin.personId, salaryStage: "regular", regularSalary: 1000, baseSalary: 1000, effectiveDate: "2026-01-01", status: "active" },
      { standardId: "TEST-ALIAS-DRIVER-STANDARD", scope: "position", standardType: "frontline_performance", position: "汽车司机", salaryMode: "performance", baseSalary: 1000, performanceUnitPrice: 100, effectiveDate: "2026-01-01", status: "active" }
    ]));
    localStorage.setItem("tripRecords", JSON.stringify([trip]));
    localStorage.setItem("driverTripRecords", "[]");
    localStorage.setItem("transportRecords", "[]");
    localStorage.setItem("payrollMonthlyRecords", "[]");
    localStorage.setItem("payrollMonthlyLocks", "[]");
    localStorage.setItem("payrollAuditLogs", "[]");
    localStorage.setItem("performanceRankingRecords", "[]");
    localStorage.setItem("rewardRecords", "[]");
    localStorage.setItem("penaltyRecords", "[]");
    localStorage.setItem("overtimeRecords", "[]");
  };
  await page.addInitScript(fixture);
  await page.route("**/*", async route => {
    const req = route.request(); const url = new URL(req.url());
    if (!["GET", "HEAD"].includes(req.method()) || url.origin !== ORIGIN) { blocked.push(`${req.method()} ${req.url()}`); return route.abort(); }
    const file = path.resolve(ROOT, decodeURIComponent(url.pathname).slice(1) || "index.html");
    if (!file.startsWith(ROOT + path.sep)) return route.fulfill({ status: 403, body: "blocked" });
    try { return route.fulfill({ status: 200, contentType: path.extname(file) === ".html" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8", body: await fs.readFile(file) }); }
    catch { return route.fulfill({ status: 404, body: "missing test asset" }); }
  });
  await page.goto(`${ORIGIN}/report-center.html`, { waitUntil: "domcontentloaded" });
  const payroll = await page.evaluate(() => JSON.parse(localStorage.getItem("payrollMonthlyRecords") || "[]").find(row => row.personId === "TEST-ALIAS-DRIVER"));
  const duplicateSummary = await page.evaluate(() => {
    const officialProductionTrips = getAllProductionTripRecords().length;
    const month = new Date().toISOString().slice(0, 7);
    const driver = JSON.parse(localStorage.getItem("personnelRecords") || "[]").find(person => person.personId === "TEST-ALIAS-DRIVER");
    const rankingTripCount = getDriverTripCountForRanking(driver, month);
    const rows = ["tripRecords", "driverTripRecords", "transportRecords"].flatMap(key => JSON.parse(localStorage.getItem(key) || "[]"));
    return { totalRows: rows.length, uniqueTripIds: [...new Set(rows.map(row => row.tripId))].length, officialProductionTrips, rankingTripCount };
  });
  console.log("TEST ineligible trip policy observation:", JSON.stringify({ performanceQuantity: payroll?.performanceQuantity, performanceSalary: payroll?.performanceSalary, ...duplicateSummary }));
  expect(payroll).toBeTruthy();
  expect(payroll.performanceQuantity).toBe(1);
  expect(duplicateSummary.officialProductionTrips).toBe(0);
  expect(duplicateSummary.rankingTripCount).toBe(1);
  await page.screenshot({ path: "C:/Users/Administrator/Documents/Codex/2026-10-11/new-chat/outputs/证据_正式产量排除趟次的工资口径_2026-10-14.png", fullPage: true });
  expect(errors).toEqual([]);
  expect(blocked).toEqual([]);
});

